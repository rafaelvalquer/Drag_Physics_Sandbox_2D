import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { Client } from '@colyseus/sdk';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import postgres from 'postgres';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { TRACKS } from '../../../src/data/tracks';
import { AuthoritativeRace } from '../../../src/game/online/AuthoritativeRace';
import { COMPETITIVE_ROOM, type OnlineGearUpdate, type OnlineLoadingState, type OnlineLobbyState, type OnlineRaceSnapshot, type RaceInput } from '../../../src/game/online/contracts';
import { ONLINE_STARTERS } from '../../../src/game/online/demoCatalog';
import { PREPARATION_TREES } from '../../../src/game/online/preparation';
import { createAuthenticator } from '../../../src/server/online/auth';
import { competitiveRaceRoom } from '../../../src/server/online/CompetitiveRaceRoom';
import { OnlineGarage, savePreparationCatalog } from '../../../src/server/online/garage';
import { OnlineMatches, type OnlineAward, type RaceBuild } from '../../../src/server/online/matches';
import { startOnlineServer } from '../../../src/server/online/server';

let db: PGlite;
let socket: PGLiteSocketServer;
let sql: postgres.Sql;
let garage: OnlineGarage;
let matches: OnlineMatches;
const users: [string, string] = [randomUUID(), randomUUID()];
const identity = (id: string) => ({ id, sessionId: randomUUID(), expiresAtMs: Date.now() + 60_000, avatarUrl: null });
const onboarding = { nickname: 'Piloto A', baseCarId: ONLINE_STARTERS[0], termsAccepted: true, useGoogleAvatar: false } as const;
const apply = (user: string, operation: Parameters<OnlineGarage['apply']>[1]['operation'], operationId = randomUUID()) =>
  garage.apply(user, { operation, operationId }, () => false);

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../../../supabase/migrations/20261124000100_online.sql', import.meta.url), 'utf8'));
  await db.query('insert into auth.users values ($1), ($2)', users);
  socket = new PGLiteSocketServer({ db, port: 0, maxConnections: 12 });
  await socket.start();
  sql = postgres(`postgresql://postgres@${socket.getServerConn()}/postgres`, { max: 1, prepare: false });
  garage = new OnlineGarage(sql, { startCredits: 4500, startRp: 1000 });
  matches = new OnlineMatches(garage);
  await savePreparationCatalog(sql);
});

afterAll(async () => {
  await sql?.end({ timeout: 1 });
  await socket?.stop();
  await db?.close();
});

it('protege cadastro, inventário, saldos, PP, histórico e liquidação da corrida no PostgreSQL', async () => {
  await Promise.all([garage.create(identity(users[0]), onboarding), garage.create(identity(users[0]), onboarding)]);
  await expect(garage.create(identity(users[1]), { ...onboarding, nickname: 'piloto a' })).rejects.toThrow('nickname');
  await garage.create(identity(users[1]), { ...onboarding, nickname: 'Piloto B', baseCarId: ONLINE_STARTERS[1] });
  const before = (await garage.get(users[0]))!;
  const [first] = before.cars;
  expect(before.profile.cr_balance).toBe(4500);
  expect(before.cars).toHaveLength(1);
  const operationId = randomUUID();
  const purchase = { kind: 'buy', baseCarId: ONLINE_STARTERS[0] } as const;
  const [bought, retried] = await Promise.all([apply(users[0], purchase, operationId), apply(users[0], purchase, operationId)]);
  expect(bought).toEqual(retried);
  expect((await garage.get(users[0]))?.profile.cr_balance).toBe(3700);
  await expect(apply(users[0], { kind: 'buy', baseCarId: 'nissan-gtr-r35-2017' })).rejects.toThrow();
  await expect(apply(users[1], { kind: 'select', carId: first!.id })).rejects.toThrow('indisponível');
  const tree = PREPARATION_TREES.get(first!.base_car_id)!;
  const node = tree.nodes.find((entry) => entry.id === 'aderencia-1')!;
  const partId = node.unlocksPartIds[0]!;
  await expect(apply(users[0], { kind: 'buyPart', carId: first!.id, partId })).rejects.toThrow('bloqueada');
  await expect(apply(users[0], { kind: 'unlock', carId: first!.id, nodeId: node.id })).rejects.toThrow('insuficientes');

  const matchId = randomUUID();
  const builds = await matches.start(matchId, TRACKS[0]!.id, 1, users, [first!.id, undefined]);
  await apply(users[0], { kind: 'select', carId: bought.carId });
  const race = new AuthoritativeRace(matchId, builds, TRACKS[0]!, 1);
  const snapshot = race.snapshot();
  snapshot.phase = 'finished';
  snapshot.winner = 0;
  snapshot.lanes[0].result.rt = 0.1;
  snapshot.lanes[1].result.rt = 0.2;
  const rewards = await matches.finish(matchId, snapshot, null);
  expect(rewards.map(({ cr, rp, pp }) => [cr, rp, pp])).toEqual([[600, 16, 5], [300, -16, 3]]);
  expect(await matches.finish(matchId, snapshot, null)).toEqual(rewards);
  const after = (await garage.get(users[0]))!;
  expect(after.profile.cr_balance).toBe(4300);
  expect(after.profile.rp).toBe(1016);
  expect(after.cars.find((car) => car.id === first!.id)?.pp_balance).toBe(5);
  expect(after.cars.find((car) => car.id === bought.carId)?.pp_balance).toBe(0);
  expect((await matches.history(users[0], 0, first!.id)).length).toBe(1);
  expect((await matches.ranking(users[0], 0)).ownPosition).toBe(1);

  await sql`update online_car_progression set pp_balance = ${node.costPP}, pp_earned_total = ${node.costPP} where car_id = ${first!.id}`;
  await expect(apply(users[0], { kind: 'unlock', carId: first!.id, nodeId: 'aderencia-2' })).rejects.toThrow('pré-requisitos');
  await Promise.all([apply(users[0], { kind: 'unlock', carId: first!.id, nodeId: node.id }), apply(users[0], { kind: 'unlock', carId: first!.id, nodeId: node.id })]);
  const unlocked = (await garage.get(users[0]))!.cars.find((car) => car.id === first!.id)!;
  expect(unlocked.pp_balance).toBe(0);
  expect(unlocked.pp_spent_total).toBe(node.costPP);
  await expect(apply(users[0], { kind: 'buyPart', carId: bought.carId, partId })).rejects.toThrow('bloqueada');
  await expect(apply(users[0], { kind: 'tune', carId: first!.id, buildRevision: 0, tune: { tirePressureKpa: 190 } })).rejects.toThrow('Pressão dos pneus');
  await expect(apply(users[0], { kind: 'install', carId: first!.id, partId, buildRevision: 0 })).rejects.toThrow('Compre');
  await apply(users[0], { kind: 'buyPart', carId: first!.id, partId });
  await apply(users[0], { kind: 'install', carId: first!.id, partId, buildRevision: 0 });
  await expect(apply(users[0], { kind: 'tune', carId: first!.id, buildRevision: 1, tune: { revLimitRpm: 100_000 } })).rejects.toThrow();
  const stockPressure = await garage.raceBuild(sql, users[0], first!.id);
  await apply(users[0], { kind: 'tune', carId: first!.id, buildRevision: 1, tune: { tirePressureKpa: 190 } });
  await expect(apply(users[0], { kind: 'tune', carId: first!.id, buildRevision: 1, tune: { tirePressureKpa: 210 } })).rejects.toThrow('projeto foi atualizado');
  const tuned = (await garage.get(users[0]))!.cars.find((car) => car.id === first!.id)!;
  expect(tuned.tune.tirePressureKpa).toBe(190);
  expect((await garage.raceBuild(sql, users[0], first!.id)).car.tires).toEqual(tuned.config.tires);
  expect(tuned.config.tires).not.toEqual(stockPressure.car.tires);
  await apply(users[0], { kind: 'remove', carId: first!.id, partId, buildRevision: 2 });
  expect((await garage.get(users[0]))!.cars.find((car) => car.id === first!.id)!.tune.tirePressureKpa).toBeUndefined();
  await apply(users[0], { kind: 'sell', carId: first!.id, confirmed: true });
  await expect(apply(users[0], { kind: 'sell', carId: bought.carId, confirmed: true })).rejects.toThrow('Mantenha');
  expect((await matches.history(users[0], 0, first!.id)).length).toBe(1);

  const interrupted = randomUUID();
  await matches.start(interrupted, TRACKS[0]!.id, 1, users, [undefined, undefined]);
  await matches.recoverInterrupted();
  expect((await matches.finish(interrupted, null, null)).map((award) => award.rp)).toEqual([0, 0]);
  await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${users[0]}, true)`;
    await tx`set local role authenticated`;
    expect(await tx`select user_id from online_wallets`).toEqual([{ user_id: users[0] }]);
  });
  await expect(sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${users[0]}, true)`;
    await tx`set local role authenticated`;
    await tx`update online_wallets set cr_balance = 999999`;
  })).rejects.toThrow('permission denied');
});

it('liquida uma corrida realmente empatada uma única vez', async () => {
  const tiedUsers: [string, string] = [randomUUID(), randomUUID()];
  await sql`insert into auth.users values (${tiedUsers[0]}), (${tiedUsers[1]})`;
  await Promise.all(tiedUsers.map((user, lane) => garage.create(identity(user), { ...onboarding, nickname: `Empate ${lane}` })));
  const matchId = randomUUID();
  const seed = 17;
  const builds = await matches.start(matchId, TRACKS[0]!.id, seed, tiedUsers, [undefined, undefined]);
  const race = new AuthoritativeRace(matchId, builds, TRACKS[0]!, seed);
  while (race.race.phase !== 'finished' && race.tick < 6_000) {
    if (race.tick % 4 === 0) {
      const sim = race.race.raceLanes[0]!.sim;
      const launch = race.race.greenAt !== null && race.race.time >= race.race.greenAt;
      const shift = launch && (sim.gear === 0 || sim.engine.rpm >= 5_750) ? 1 : undefined;
      const input = { matchId, sequence: race.tick, observedTick: race.tick, throttle: Number(launch), shift } as const;
      race.submit(0, input);
      race.submit(1, input);
    }
    race.step();
  }
  const result = race.snapshot();
  expect(result.phase).toBe('finished');
  expect(result.winner).toBeNull();
  expect(result.lanes.every((lane) => lane.result.finished && !lane.result.redLight)).toBe(true);
  expect(result.lanes[0].result.total).toBe(result.lanes[1].result.total);
  const [first, retry] = await Promise.all([matches.finish(matchId, result, null), matches.finish(matchId, result, null)]);
  expect(retry).toEqual(first);
  expect(first.map(({ outcome, cr, rp, pp }) => [outcome, cr, rp, pp])).toEqual([['draw', 450, 0, 4], ['draw', 450, 0, 4]]);
  for (const user of tiedUsers) {
    const saved = await garage.get(user);
    expect(saved?.profile).toMatchObject({ cr_balance: 4_950, rp: 1_000 });
    expect(saved?.cars[0]).toMatchObject({ pp_balance: 4, total_races: 1, wins: 0, losses: 0 });
    expect(await matches.history(user, 0, undefined)).toMatchObject([{ id: matchId, outcome: 'draw', cr_reward: 450, rp_delta: 0, pp_reward: 4 }]);
  }
});

it('valida tokens pelo JWKS e completa um lobby competitivo com reconexão', async () => {
  const users = [randomUUID(), randomUUID(), randomUUID()] as const;
  await sql`insert into auth.users (id) values (${users[0]}), (${users[1]}), (${users[2]})`;
  await garage.create(identity(users[0]), { ...onboarding, nickname: 'Rede A' });
  await garage.create(identity(users[1]), { ...onboarding, nickname: 'Rede B', baseCarId: ONLINE_STARTERS[1] });
  await garage.create(identity(users[2]), { ...onboarding, nickname: 'Rede C', baseCarId: ONLINE_STARTERS[2] });
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const kid = randomUUID();
  const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig', key_ops: ['verify'] }] };
  const provider = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/auth/v1/.well-known/jwks.json') response.end(JSON.stringify(jwks));
    else { response.statusCode = 404; response.end('{}'); }
  });
  await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const address = provider.address();
  if (!address || typeof address === 'string') throw new Error('Provedor sem endereço TCP');
  const providerUrl = `http://127.0.0.1:${address.port}`;
  const token = (id: string, override = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const claims = { sub: id, iss: `${providerUrl}/auth/v1`, aud: 'authenticated', role: 'authenticated',
      session_id: randomUUID(), exp: now + 300, iat: now, app_metadata: { provider: 'google' }, ...override };
    const data = `${encode({ alg: 'ES256', typ: 'JWT', kid })}.${encode(claims)}`;
    return `${data}.${sign('sha256', Buffer.from(data), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  let server: Awaited<ReturnType<typeof startOnlineServer>> | undefined;
  const commands: { matchId: string; tick: number; lane: 0 | 1; input?: RaceInput; delayTicks?: number }[] = [];
  const submit = AuthoritativeRace.prototype.submit;
  const release = AuthoritativeRace.prototype.release;
  const submissions = vi.spyOn(AuthoritativeRace.prototype, 'submit').mockImplementation(function (this: AuthoritativeRace, lane, input, delayTicks) {
    const accepted = submit.call(this, lane, input, delayTicks);
    if (accepted) commands.push({ matchId: this.matchId, tick: this.tick, lane, input, delayTicks });
    return accepted;
  });
  const releases = vi.spyOn(AuthoritativeRace.prototype, 'release').mockImplementation(function (this: AuthoritativeRace, lane) {
    release.call(this, lane);
    commands.push({ matchId: this.matchId, tick: this.tick, lane });
  });
  try {
    server = await startOnlineServer({
      SUPABASE_URL: providerUrl, SUPABASE_SECRET_KEY: 'test-secret-only-for-jwks', PORT: '0',
      ALLOWED_ORIGINS: 'http://localhost:5173', DATABASE_URL: `postgresql://postgres@${socket.getServerConn()}/postgres`,
    });
    const httpAddress = server.transport.server?.address();
    if (!httpAddress || typeof httpAddress === 'string') throw new Error('Backend sem endereço TCP');
    const endpoint = `http://127.0.0.1:${httpAddress.port}`;
    const tokens = users.map((id) => token(id));
    const request = (path: string, bearer?: string, body?: unknown) => fetch(`${endpoint}${path}`, {
      method: body ? 'POST' : 'GET', headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
    });
    expect((await request('/health')).status).toBe(200);
    expect((await request('/v1/garage', token(users[0], { aud: 'other' }))).status).toBe(401);
    expect((await request('/v1/garage', token(users[0], { exp: 1 }))).status).toBe(401);
    expect((await request('/v1/garage', token(users[0], { app_metadata: { provider: 'email' } }))).status).toBe(401);
    expect((await request('/v1/garage', `${tokens[0]!.slice(0, -6)}_bad__`)).status).toBe(401);
    expect((await request('/v1/garage', tokens[0])).status).toBe(200);

    const networks = tokens.map((bearer) => { const client = new Client(endpoint); client.auth.token = bearer; return client; });
    const left = await networks[0]!.joinOrCreate(COMPETITIVE_ROOM);
    await expect(networks[0]!.joinOrCreate(COMPETITIVE_ROOM)).rejects.toThrow();
    const right = await networks[1]!.joinOrCreate(COMPETITIVE_ROOM);
    expect(left.roomId).toBe(right.roomId);
    const waiting = await networks[2]!.joinOrCreate(COMPETITIVE_ROOM);
    expect(waiting.roomId).not.toBe(left.roomId);
    const thirdState = await new Promise<OnlineLobbyState>((resolve) => {
      waiting.onMessage('lobby', resolve);
      waiting.send('sync');
    });
    expect(thirdState.phase).toBe('queue');
    await waiting.leave();
    const attemptedPurchase = { operationId: randomUUID(), operation: { kind: 'buy', baseCarId: ONLINE_STARTERS[0] } };
    expect((await request('/v1/garage', tokens[0], attemptedPurchase)).status).toBe(409);
    const lanes = new Set<number>();
    let reconnected = false;
    let foreignCarId: string | undefined;
    const engagedGears = [new Set<number>(), new Set<number>()];
    const setup = await Promise.all([garage.get(users[0]), garage.get(users[1])]);
    const results = [left, right].map((room, index) => new Promise<{ snapshot: OnlineRaceSnapshot; award: OnlineAward }>((resolve, reject) => {
      room.reconnection.minUptime = 0;
      room.reconnection.minDelay = room.reconnection.delay = 100;
      let confirmed = false;
      let sequence = 0;
      let dropped = false;
      room.onLeave(() => reject(new Error('Conexão encerrada antes da liquidação')));
      room.onMessage('lobby', (state: OnlineLobbyState) => {
        if (state.phase !== 'lobby' || confirmed) return;
        confirmed = true;
        lanes.add(state.lane);
        expect(state.deadline! - state.serverTime).toBeGreaterThan(20_000);
        if (index === 0) room.send('select', setup[1]!.cars[0]!.id);
        else room.send('confirm');
      });
      room.onMessage('notice', () => { foreignCarId = setup[1]!.cars[0]!.id; room.send('confirm'); });
      room.onMessage('loading', (state: OnlineLoadingState) => {
        expect(state.ownCarId).toBe(setup[index]!.profile.active_car_id);
        room.send('loaded', state.matchId);
      });
      room.onReconnect(() => { reconnected = true; room.send('sync'); });
      room.onMessage('gear', (update: OnlineGearUpdate) => { engagedGears[index]!.add(update.gear); });
      room.onMessage('snapshot', (snapshot: OnlineRaceSnapshot) => {
        if (index === 1 && snapshot.tick >= 120 && !dropped) {
          dropped = true;
          void room.leave(false);
          return;
        }
        const lane = snapshot.lanes[index]!;
        const launch = snapshot.scheduledGreenTick !== null && snapshot.tick >= snapshot.scheduledGreenTick + index * 24;
        room.send('input', { matchId: snapshot.matchId, sequence: sequence++, observedTick: snapshot.tick,
          throttle: launch ? 1 : 0, shift: launch && (lane.gear === 0 || lane.rpm > 5_750) ? 1 : undefined });
      });
      room.onMessage('cancelled', (notice: { reason: string }) => reject(new Error(notice.reason)));
      room.onMessage('result', resolve);
      room.send('sync');
    }));
    const [a, b] = await Promise.all(results);
    expect(foreignCarId).toBeDefined();
    expect(lanes).toEqual(new Set([0, 1]));
    expect(reconnected).toBe(true);
    expect(engagedGears.every((gears) => gears.has(1))).toBe(true);
    expect(a!.snapshot).toEqual(b!.snapshot);
    expect(a!.snapshot.lanes.every((lane) => lane.result.finished)).toBe(true);
    expect([a!.award.cr, b!.award.cr].sort()).toEqual([300, 600]);
    expect((await request('/v1/history', tokens[0])).status).toBe(200);

    const official = a!.snapshot;
    const [match] = await sql<{ seed: number }[]>`select seed from online_matches where id = ${official.matchId}`;
    const [laneA, laneB] = await sql<{ build_snapshot: RaceBuild }[]>`
      select build_snapshot from online_match_players where match_id = ${official.matchId} order by lane`;
    const replay = new AuthoritativeRace(official.matchId, [laneA!.build_snapshot, laneB!.build_snapshot], TRACKS[0]!, match!.seed);
    const inputs = commands.filter((command) => command.matchId === official.matchId);
    expect(inputs.some((command) => !command.input)).toBe(true);
    expect(inputs.some((command) => command.input?.shift !== undefined)).toBe(true);
    for (const command of inputs) {
      while (replay.tick < command.tick && replay.race.phase !== 'finished') replay.step();
      expect(replay.tick).toBe(command.tick);
      if (command.input) expect(submit.call(replay, command.lane, command.input, command.delayTicks)).toBe(true);
      else release.call(replay, command.lane);
    }
    while (replay.tick < official.tick && replay.race.phase !== 'finished') replay.step();
    // The wire codec normalizes negative zero in audio channels.
    expect(JSON.parse(JSON.stringify(replay.snapshot()))).toEqual(official);

    // Exercise the same room with shorter deadlines so the test does not wait through a full second lobby.
    const deadlineRoom = 'race_deadlines';
    const active = new Map<string, string>();
    server.define(deadlineRoom, competitiveRaceRoom({
      authenticate: createAuthenticator(providerUrl, 'test-secret-only-for-jwks'),
      garage, matches, active, lobbySeconds: 2, loadingSeconds: 2, canJoin: () => true,
    }));
    const alternate = await apply(users[0], { kind: 'buy', baseCarId: ONLINE_STARTERS[2] });
    const garagesBefore = await Promise.all(users.slice(0, 2).map((id) => garage.get(id)));
    const waitingRooms = [await networks[0]!.joinOrCreate(deadlineRoom), await networks[1]!.joinOrCreate(deadlineRoom)];
    expect(waitingRooms[0]!.roomId).toBe(waitingRooms[1]!.roomId);
    const cancellations = await Promise.all(waitingRooms.map((room, index) => new Promise<{ loaded: OnlineLoadingState; reason: string }>((resolve, reject) => {
      let loaded: OnlineLoadingState | undefined;
      let selected = false;
      room.onMessage('lobby', (state: OnlineLobbyState) => {
        if (index === 0 && state.phase === 'lobby' && !selected) {
          selected = true;
          room.send('select', alternate.carId);
        }
      });
      room.onMessage('loading', (payload: OnlineLoadingState) => {
        loaded = payload;
        if (index === 0) room.send('loaded', payload.matchId);
      });
      room.onMessage('snapshot', () => reject(new Error('A corrida largou sem os dois pilotos.')));
      room.onMessage('cancelled', ({ reason }: { reason: string }) => {
        if (loaded) resolve({ loaded, reason });
        else reject(new Error('O lobby foi cancelado sem selecionar os carros.'));
      });
      room.onLeave(() => reject(new Error('A sala fechou sem registrar o cancelamento.')));
      room.send('sync');
    })));
    const interrupted = cancellations[0]!.loaded.matchId;
    expect(cancellations.map(({ loaded }) => loaded.matchId)).toEqual([interrupted, interrupted]);
    expect(cancellations.map(({ loaded }) => loaded.ownCarId)).toEqual([alternate.carId, garagesBefore[1]?.profile.active_car_id]);
    expect(cancellations.map(({ reason }) => reason)).toEqual(['Tempo limite de carregamento.', 'Tempo limite de carregamento.']);
    const [cancelled] = await sql`select status, winner_user_id from online_matches where id = ${interrupted}`;
    expect(cancelled).toMatchObject({ status: 'cancelled', winner_user_id: null });
    expect(await Promise.all(users.slice(0, 2).map((id) => garage.get(id)))).toEqual(garagesBefore);
    expect(active.size).toBe(0);
  } finally {
    submissions.mockRestore();
    releases.mockRestore();
    await server?.gracefullyShutdown(false);
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
}, 55_000);
