import { matchMaker, Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import postgres from 'postgres';
import { z } from 'zod';
import { COMPETITIVE_ROOM, GarageRequestSchema, OnboardingSchema } from '../../game/online/contracts';
import { ONLINE_START_CREDITS, ONLINE_START_RP } from '../../game/online/economy';
import { createAuthenticator, type OnlineIdentity } from './auth';
import { competitiveRaceRoom } from './CompetitiveRaceRoom';
import { OnlineGarage, savePreparationCatalog } from './garage';
import { OnlineMatches } from './matches';
import { OnlineError } from './OnlineError';

const configSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
  SUPABASE_JWT_ISSUER: z.url().optional(),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PORT: z.coerce.number().int().min(0).max(65_535).default(2567),
  ALLOWED_ORIGINS: z.string().transform((value, ctx) => {
    const origins = value.split(',').map((origin) => origin.trim().replace(/\/$/, ''));
    if (origins.some((origin) => !z.url({ protocol: /^https?$/ }).safeParse(origin).success)) {
      ctx.addIssue({ code: 'custom', message: 'Informe origens HTTP ou HTTPS separadas por vírgulas.' });
      return z.NEVER;
    }
    return origins;
  }),
  ONLINE_START_CREDITS: z.coerce.number().int().min(0).max(1_000_000).default(ONLINE_START_CREDITS),
  ONLINE_START_RP: z.coerce.number().int().min(0).max(100_000).default(ONLINE_START_RP),
  LOBBY_SELECTION_SECONDS: z.coerce.number().int().min(5).max(120).default(30),
  ONLINE_LOADING_SECONDS: z.coerce.number().int().min(5).max(120).default(15),
});

function limiter(max: number, windowMs: number) {
  const keys = new Map<string, { count: number; reset: number }>();
  const prune = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of keys) if (value.reset <= now) keys.delete(key);
  }, windowMs);
  prune.unref();
  return {
    stop: () => clearInterval(prune),
    accept: (key: string) => {
      const now = Date.now();
      const entry = keys.get(key);
      if (!entry || entry.reset <= now) {
        if (keys.size >= 20_000 && !entry) return false;
        keys.set(key, { count: 1, reset: now + windowMs });
        return true;
      }
      return ++entry.count <= max;
    },
  };
}

const page = z.strictObject({ offset: z.coerce.number().int().min(0).max(100_000).default(0) });
const historyPage = page.extend({ carId: z.uuid().optional() });

export async function startOnlineServer(environment: NodeJS.ProcessEnv) {
  const config = configSchema.parse(environment);
  const authenticate = createAuthenticator(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, config.SUPABASE_JWT_ISSUER);
  const sql = postgres(config.DATABASE_URL, { max: 12, prepare: false, connect_timeout: 10 });
  const garage = new OnlineGarage(sql, { startRp: config.ONLINE_START_RP, startCredits: config.ONLINE_START_CREDITS });
  const matches = new OnlineMatches(garage);
  const active = new Map<string, string>();
  const httpLimits = limiter(240, 60_000);
  const accountLimits = limiter(90, 60_000);
  const socketLimits = limiter(60, 60_000);
  try {
    await savePreparationCatalog(sql);
    await matches.recoverInterrupted();
    const transport = new WebSocketTransport({
      maxPayload: 16_384,
      pingInterval: 2_000,
      pingMaxRetries: 2,
      beforeUpgrade: (_url, context) => {
        const origin = context.headers.get('origin');
        if (origin && !config.ALLOWED_ORIGINS.includes(origin)) return new globalThis.Response(null, { status: 403 });
        if (!socketLimits.accept(context.ip ?? 'unknown')) return new globalThis.Response(null, { status: 429 });
      },
    });
    const server = new Server({ transport, greet: false, gracefullyShutdown: false });
    matchMaker.controller.standardHttpStatus = true;
    matchMaker.controller.exposedMethods = ['joinOrCreate', 'reconnect'];
    matchMaker.controller.getCorsHeaders = (headers) => {
      const origin = headers.get('origin');
      return {
        'Access-Control-Allow-Origin': origin && config.ALLOWED_ORIGINS.includes(origin) ? origin : 'null',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Vary': 'Origin',
      };
    };
    const app = transport.getExpressApp();
    app.disable('x-powered-by');
    app.get('/health', async (_request, response) => {
      try {
        await sql`select 1`;
        response.json({ status: 'ok' });
      } catch {
        response.status(503).json({ status: 'unavailable' });
      }
    });

    const api = express.Router();
    api.use((request, response, next) => {
      const origin = request.get('origin');
      if (origin && !config.ALLOWED_ORIGINS.includes(origin)) throw new OnlineError(403, 'Origem não autorizada.');
      response.setHeader('Cache-Control', 'no-store');
      if (origin) {
        response.vary('Origin');
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      }
      if (request.method === 'OPTIONS') return response.sendStatus(204);
      if (!httpLimits.accept(request.ip ?? 'unknown')) throw new OnlineError(429, 'Muitas solicitações. Aguarde e tente novamente.');
      next();
    });
    api.use(express.json({ limit: '12kb' }));
    api.use(async (request, response, next) => {
      const token = request.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      const user = await authenticate(token);
      if (!accountLimits.accept(user.id)) throw new OnlineError(429, 'Muitas operações nesta conta.');
      response.locals.identity = user;
      next();
    });
    const identity = (response: Response): OnlineIdentity => response.locals.identity;
    api.get('/garage', async (_request, response) => { response.json(await garage.get(identity(response).id)); });
    api.post('/profile', async (request, response) => {
      await garage.create(identity(response), OnboardingSchema.parse(request.body));
      response.json(await garage.get(identity(response).id));
    });
    api.post('/garage', async (request, response) => {
      const user = identity(response).id;
      response.json(await garage.apply(user, GarageRequestSchema.parse(request.body), () => active.has(user)));
    });
    api.get('/ranking', async (request, response) => {
      response.json(await matches.ranking(identity(response).id, page.parse(request.query).offset));
    });
    api.get('/history', async (request, response) => {
      const query = historyPage.parse(request.query);
      response.json(await matches.history(identity(response).id, query.offset, query.carId));
    });

    const errors: ErrorRequestHandler = (error, request: Request, response: Response, _next) => {
      if (error instanceof OnlineError) response.status(error.status).json({ error: error.message });
      else if (error instanceof z.ZodError) response.status(400).json({ error: 'Dados da solicitação inválidos.' });
      else if (error.status === 400 || error.status === 413) response.status(error.status).json({ error: 'Conteúdo inválido.' });
      else {
        console.error('online-api', { method: request.method, path: request.path, code: error.code ?? error.name });
        response.status(500).json({ error: 'O servidor não conseguiu concluir a operação.' });
      }
    };
    api.use(errors);
    app.use('/v1', api);
    server.define(COMPETITIVE_ROOM, competitiveRaceRoom({ authenticate, garage, matches, active,
      lobbySeconds: config.LOBBY_SELECTION_SECONDS, loadingSeconds: config.ONLINE_LOADING_SECONDS,
      canJoin: (context) => {
        const origin = context.headers.get('origin');
        return (!origin || config.ALLOWED_ORIGINS.includes(origin)) && httpLimits.accept(`matchmaking:${context.ip ?? 'unknown'}`);
      },
    }));
    server.onShutdown(async () => {
      accountLimits.stop();
      httpLimits.stop();
      socketLimits.stop();
      await sql.end({ timeout: 5 });
    });
    await server.listen(config.PORT, '0.0.0.0');
    return server;
  } catch (error) {
    accountLimits.stop();
    httpLimits.stop();
    socketLimits.stop();
    await sql.end({ timeout: 1 });
    throw error;
  }
}
