import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { ClientState, ErrorCode, Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { WebSocketClient } from '@colyseus/ws-transport';
import { z } from 'zod';
import { TRACKS } from '../../data/tracks';
import { AuthoritativeRace } from '../../game/online/AuthoritativeRace';
import { ONLINE_SNAPSHOT_HZ, RaceInputSchema, type OnlineLobbyState, type OnlineLoadingState, type OnlineRaceSnapshot } from '../../game/online/contracts';
import { inputDelayTicks } from '../../game/online/inputTiming';
import { PHYSICS_DT } from '../../game/SimulationRunner';
import type { Authenticate, OnlineIdentity } from './auth';
import type { OnlineGarage } from './garage';
import type { OnlineMatches, RaceBuild } from './matches';

interface Services {
  authenticate: Authenticate;
  garage: OnlineGarage;
  matches: OnlineMatches;
  active: Map<string, string>;
  lobbySeconds: number;
  loadingSeconds: number;
  canJoin: (context: AuthContext) => boolean;
}

interface Driver {
  identity: OnlineIdentity;
  lane: 0 | 1;
  nickname: string;
  rp: number;
  cars: OnlineLobbyState['cars'];
  carId: string | undefined;
  confirmed: boolean;
  loaded: boolean;
  connected: boolean;
  renewing: boolean;
  rttSamples: number[];
  nextProbeAt: number;
  delayTicks: number;
}

const track = TRACKS[0]!;
const STEP_MS = PHYSICS_DT * 1_000;
const SNAPSHOT_STEPS = Math.round(1 / (PHYSICS_DT * ONLINE_SNAPSHOT_HZ));

export function competitiveRaceRoom(services: Services) {
  return class CompetitiveRaceRoom extends Room {
    override maxClients = 2;
    override maxMessagesPerSecond = 42;
    private stage: OnlineLobbyState['phase'] | 'race' | 'settling' | 'done' = 'queue';
    private readonly drivers = new Map<string, Driver>();
    private readonly matchId = randomUUID();
    private deadline: number | null = null;
    private builds?: [RaceBuild, RaceBuild];
    private simulation?: AuthoritativeRace;
    private started?: Promise<[RaceBuild, RaceBuild]>;
    private pendingMs = 0;
    private stepCostMs = 0;
    private droppedMs = 0;

    static override async onAuth(token: string, _options: unknown, context: AuthContext): Promise<OnlineIdentity> {
      if (!services.canJoin(context)) throw new ServerError(ErrorCode.AUTH_FAILED, 'Origem não autorizada ou limite de conexões atingido.');
      try {
        const identity = await services.authenticate(token);
        if (services.active.has(identity.id)) throw new Error('Conta já conectada.');
        return identity;
      } catch {
        throw new ServerError(ErrorCode.AUTH_FAILED, 'Entre com o Google ou encerre a partida anterior.');
      }
    }

    override onCreate(): void {
      this.setPatchRate(null);
      this.clock.setInterval(() => this.checkDeadline(), 250);
      this.onMessage('sync', (client) => { if (this.drivers.has(client.sessionId)) this.sendState(client); });
      this.onMessage('timeProbe', z.number().min(0).max(1e12), (client, sentAt) => {
        if (this.drivers.has(client.sessionId)) client.send('timeProbe', { sentAt, serverTime: Date.now() });
      });
      this.onMessage('select', z.uuid(), (client, carId) => {
        const driver = this.drivers.get(client.sessionId);
        if (this.stage !== 'lobby' || !driver || driver.confirmed) return;
        if (!driver.cars.some((car) => car.id === carId)) return client.send('notice', 'Escolha um carro da sua garagem.');
        driver.carId = carId;
        this.sendAllStates();
      });
      this.onMessage('confirm', (client) => {
        const driver = this.drivers.get(client.sessionId);
        if (this.stage !== 'lobby' || !driver) return;
        driver.confirmed = true;
        this.sendAllStates();
        if (this.ordered().every((item) => item.confirmed && item.connected)) void this.prepare();
      });
      this.onMessage('loaded', z.uuid(), (client, matchId) => {
        const driver = this.drivers.get(client.sessionId);
        if (this.stage !== 'loading' || !this.builds || matchId !== this.matchId || !driver) return;
        driver.loaded = true;
        this.maybeStartRace();
      });
      this.onMessage('input', RaceInputSchema, (client, input) => {
        const driver = this.drivers.get(client.sessionId);
        if (this.stage === 'race' && driver?.connected && driver.identity.expiresAtMs > Date.now()) this.simulation?.submit(driver.lane, input, driver.delayTicks);
      });
      this.onMessage('session', z.string().max(8_192), (client, token) => { void this.renewSession(client, token); });
    }

    override async onJoin(client: Client): Promise<void> {
      const identity = client.auth as OnlineIdentity;
      if (identity.expiresAtMs <= Date.now() || services.active.has(identity.id)) {
        throw new ServerError(ErrorCode.AUTH_FAILED, 'Esta conta já está em uma fila ou partida.');
      }
      services.active.set(identity.id, this.roomId);
      try {
        const garage = await services.garage.get(identity.id);
        if (!garage?.cars.length || client.state === ClientState.LEAVING || this.stage !== 'queue') throw new Error('Garagem indisponível.');
        const lane = [...this.drivers.values()].some((driver) => driver.lane === 0) ? 1 : 0;
        this.drivers.set(client.sessionId, {
          identity, lane, nickname: garage.profile.nickname, rp: garage.profile.rp,
          cars: garage.cars.map((car) => ({ id: car.id, name: car.config.name, powerCv: car.peakPowerCv, torqueNm: car.peakTorqueNm })),
          carId: garage.cars.some((car) => car.id === garage.profile.active_car_id) ? garage.profile.active_car_id : garage.cars[0]!.id,
          confirmed: false, loaded: false, connected: true, renewing: false, rttSamples: [], nextProbeAt: 0, delayTicks: 0,
        });
        this.probeRtt(client, this.drivers.get(client.sessionId)!);
        if (this.drivers.size === 2) {
          this.stage = 'lobby';
          this.deadline = Date.now() + services.lobbySeconds * 1_000;
          await this.lock();
        }
        this.sendAllStates();
      } catch {
        this.drivers.delete(client.sessionId);
        this.releaseAccount(identity.id);
        throw new ServerError(ErrorCode.APPLICATION_ERROR, 'Cadastre um perfil e selecione um carro válido para buscar uma partida.');
      }
    }

    override onDrop(client: Client): void {
      const driver = this.drivers.get(client.sessionId);
      if (!driver || this.stage === 'queue' || this.stage === 'done' || this.stage === 'settling') return;
      driver.connected = false;
      this.simulation?.release(driver.lane);
      this.allowReconnection(client, this.stage === 'race' ? 10 : 5);
    }

    override onReconnect(client: Client): void {
      const driver = this.drivers.get(client.sessionId);
      if (!driver || driver.identity.expiresAtMs <= Date.now()) {
        client.leave(4003, 'Sessão online expirada.');
        return;
      }
      driver.connected = true;
      this.sendState(client);
      if (this.stage === 'lobby' && this.ordered().every((item) => item.confirmed && item.connected)) void this.prepare();
      this.maybeStartRace();
    }

    override onLeave(client: Client): void {
      const driver = this.drivers.get(client.sessionId);
      if (!driver) return;
      driver.connected = false;
      if (this.stage === 'queue') {
        this.drivers.delete(client.sessionId);
        this.releaseAccount(driver.identity.id);
      } else if (this.stage === 'lobby' || this.stage === 'loading') {
        void this.finish(null, 'Um piloto saiu antes da largada.');
      } else if (this.stage === 'race') {
        const other = this.ordered().find((item) => item.lane !== driver.lane);
        if (other?.connected) void this.finish(driver.lane);
        else void this.finish(null, 'Os dois pilotos perderam conexão.');
      }
    }

    override onDispose(): void {
      for (const driver of this.drivers.values()) this.releaseAccount(driver.identity.id);
    }

    private releaseAccount(user: string): void {
      if (services.active.get(user) === this.roomId) services.active.delete(user);
    }

    private ordered(): Driver[] { return [...this.drivers.values()].sort((left, right) => left.lane - right.lane); }

    private async renewSession(client: Client, token: string): Promise<void> {
      const driver = this.drivers.get(client.sessionId);
      if (!driver || driver.renewing) return;
      driver.renewing = true;
      try {
        const identity = await services.authenticate(token);
        if (identity.id !== driver.identity.id || identity.sessionId !== driver.identity.sessionId) throw new Error('Sessão diferente.');
        if (identity.expiresAtMs > driver.identity.expiresAtMs) driver.identity = identity;
      } catch {
        client.leave(4003, 'Sessão online inválida.');
      } finally {
        driver.renewing = false;
      }
    }

    private checkDeadline(): void {
      const now = Date.now();
      if (this.stage !== 'done' && this.stage !== 'settling') {
        for (const client of this.clients) {
          const driver = this.drivers.get(client.sessionId);
          if (driver && driver.identity.expiresAtMs <= now) client.leave(4003, 'Sessão online expirada.');
          else if (driver && this.stage !== 'race') this.probeRtt(client, driver);
        }
      }
      if (this.deadline === null || now < this.deadline) return;
      if (this.stage === 'lobby') {
        if (this.ordered().every((driver) => driver.connected)) void this.prepare();
        else void this.finish(null, 'Seleção encerrada com um piloto desconectado.');
      } else if (this.stage === 'loading') void this.finish(null, 'Tempo limite de carregamento.');
    }

    private probeRtt(client: Client, driver: Driver): void {
      if (!(client instanceof WebSocketClient) || client.readyState !== 1 || performance.now() < driver.nextProbeAt) return;
      const nonce = Buffer.from(randomUUID());
      const sentAt = performance.now();
      driver.nextProbeAt = sentAt + 750;
      const onPong = (payload: Buffer) => {
        if (!payload.equals(nonce)) return;
        client.ref.off('pong', onPong);
        driver.rttSamples.push(performance.now() - sentAt);
        if (driver.rttSamples.length > 8) driver.rttSamples.shift();
      };
      client.ref.on('pong', onPong);
      this.clock.setTimeout(() => client.ref.off('pong', onPong), 650);
      client.ref.ping(nonce, false, (error?: Error) => { if (error) client.ref.off('pong', onPong); });
    }

    private sendAllStates(): void { for (const client of this.clients) this.sendState(client); }

    private sendState(client: Client): void {
      const driver = this.drivers.get(client.sessionId);
      if (!driver) return;
      if (this.stage === 'queue' || this.stage === 'lobby' || this.stage === 'loading') {
        const state: OnlineLobbyState = {
          phase: this.stage, lane: driver.lane, serverTime: Date.now(), deadline: this.deadline, cars: driver.cars, selectedCarId: driver.carId ?? null,
          players: this.ordered().map((item) => ({ nickname: item.nickname, rp: item.rp, confirmed: item.confirmed,
            selectedCar: item.cars.find((car) => car.id === item.carId)?.name ?? null })), trackId: track.id, distanceId: 'quarter',
        };
        client.send('lobby', state);
      }
      if (this.builds && (this.stage === 'loading' || this.stage === 'race')) {
        const [left, right] = this.builds;
        const loading: OnlineLoadingState = { lane: driver.lane, matchId: this.matchId, cars: [left.car, right.car], names: [left.name, right.name], ownCarId: this.builds[driver.lane].carId };
        client.send('loading', loading);
      }
      if (this.stage === 'race') client.send('snapshot', { ...this.simulation!.snapshot(), sentAt: Date.now() });
    }

    private async prepare(): Promise<void> {
      if (this.stage !== 'lobby') return;
      this.stage = 'loading';
      this.deadline = Date.now() + services.loadingSeconds * 1_000;
      this.sendAllStates();
      const [left, right] = this.ordered() as [Driver, Driver];
      const seed = randomInt(1, 2 ** 31);
      this.started = services.matches.start(this.matchId, track.id, seed, [left.identity.id, right.identity.id], [left.carId, right.carId]);
      try {
        const builds = await this.started;
        if (this.stage !== 'loading') return;
        this.builds = builds;
        this.simulation = new AuthoritativeRace(this.matchId, builds, track, seed);
        this.sendAllStates();
      } catch (error) {
        console.error('online-match-start', { matchId: this.matchId, code: error instanceof Error ? error.name : 'unknown' });
        if (this.stage === 'loading') void this.finish(null, 'Não foi possível carregar as preparações.');
      }
    }

    private maybeStartRace(): void {
      if (this.stage !== 'loading' || !this.simulation || !this.ordered().every((driver) => driver.loaded && driver.connected)) return;
      const drivers = this.ordered();
      const rtt = drivers.map((driver) => driver.rttSamples.length > 0 ? Math.min(...driver.rttSamples) : undefined);
      drivers.forEach((driver) => { driver.delayTicks = inputDelayTicks(rtt[driver.lane], rtt[1 - driver.lane]); });
      this.stage = 'race';
      this.deadline = null;
      this.broadcast('snapshot', { ...this.simulation.snapshot(), sentAt: Date.now() });
      this.setSimulationInterval((elapsedMs) => this.advance(elapsedMs), STEP_MS);
    }

    private advance(elapsedMs: number): void {
      const simulation = this.simulation!;
      this.droppedMs += Math.max(0, elapsedMs - 250);
      this.pendingMs += Math.min(250, elapsedMs);
      while (this.pendingMs >= STEP_MS) {
        const start = performance.now();
        simulation.step();
        this.stepCostMs += performance.now() - start;
        this.pendingMs -= STEP_MS;
        if (simulation.race.phase === 'finished') {
          void this.finish(null);
          break;
        }
        if (simulation.tick % SNAPSHOT_STEPS === 0) this.broadcast('snapshot', { ...simulation.snapshot(), sentAt: Date.now() });
      }
    }

    private async finish(forfeitLane: 0 | 1 | null, reason?: string): Promise<void> {
      if (this.stage === 'settling' || this.stage === 'done') return;
      this.stage = 'settling';
      this.deadline = null;
      this.setSimulationInterval();
      const snapshot = this.simulation?.snapshot() ?? null;
      try {
        const persisted = await this.started?.catch(() => undefined);
        const awards = persisted ? await this.settle(snapshot, forfeitLane, reason) : [];
        if (reason) this.broadcast('cancelled', { reason });
        else for (const client of this.clients) {
          const lane = this.drivers.get(client.sessionId)?.lane;
          if (lane !== undefined) client.send('result', { snapshot, award: awards[lane] });
        }
      } catch (error) {
        console.error('online-match-settlement', { matchId: this.matchId, code: error instanceof Error ? error.name : 'unknown' });
        this.broadcast('cancelled', { reason: 'Falha ao persistir o resultado da partida.' });
      } finally {
        if (snapshot?.tick) console.info('online-race-metrics', { matchId: this.matchId, ticks: snapshot.tick, meanStepMs: this.stepCostMs / snapshot.tick,
          droppedMs: this.droppedMs, inputDelayTicks: this.ordered().map((driver) => driver.delayTicks) });
        this.stage = 'done';
        for (const driver of this.drivers.values()) this.releaseAccount(driver.identity.id);
        this.clock.setTimeout(() => { void this.disconnect(); }, 5_000);
      }
    }

    private async settle(snapshot: OnlineRaceSnapshot | null, forfeitLane: 0 | 1 | null, reason?: string) {
      for (const backoff of [200, 600]) {
        try { return await services.matches.finish(this.matchId, snapshot, forfeitLane, reason); }
        catch { await delay(backoff); }
      }
      return services.matches.finish(this.matchId, snapshot, forfeitLane, reason);
    }
  };
}
