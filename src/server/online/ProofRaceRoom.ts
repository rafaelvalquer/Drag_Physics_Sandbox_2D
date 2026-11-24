import { randomInt, randomUUID } from 'node:crypto';
import { Room, type Client } from '@colyseus/core';
import { TRACKS } from '../../data/tracks';
import { AuthoritativeRace } from '../../game/online/AuthoritativeRace';
import { ONLINE_SNAPSHOT_HZ, RaceInputSchema } from '../../game/online/contracts';
import { ONLINE_STARTERS, stockOnlineBuild } from '../../game/online/demoCatalog';
import { PHYSICS_DT } from '../../game/SimulationRunner';

export const PROOF_ROOM = 'race_proof';
const STEP_MS = PHYSICS_DT * 1000;
const SNAPSHOT_STEPS = Math.round(1 / (PHYSICS_DT * ONLINE_SNAPSHOT_HZ));
const MAX_CATCH_UP_MS = 250;

/** Loopback-only infrastructure proof with factory cars and no persistent rewards. */
export class ProofRaceRoom extends Room {
  override maxClients = 2;
  override maxMessagesPerSecond = 40;
  private readonly drivers = new Map<string, 0 | 1>();
  private readonly ready = new Set<string>();
  private simulation?: AuthoritativeRace;
  private previousFrameMs = 0;
  private pendingMs = 0;
  private simulatedMs = 0;
  private droppedMs = 0;

  override onCreate(): void {
    this.setPatchRate(null);
    this.onMessage('ready', (client) => {
      const lane = this.drivers.get(client.sessionId);
      if (lane === undefined) return;
      client.send('assignment', { lane, carId: ONLINE_STARTERS[lane] });
      this.ready.add(client.sessionId);
      if (this.ready.size === 2 && !this.simulation) this.start();
    });
    this.onMessage('input', RaceInputSchema, (client, input) => {
      const lane = this.drivers.get(client.sessionId);
      if (lane !== undefined) this.simulation?.submit(lane, input);
    });
  }

  override onJoin(client: Client): void {
    const lane = [...this.drivers.values()].includes(0) ? 1 : 0;
    this.drivers.set(client.sessionId, lane);
  }

  override onLeave(client: Client): void {
    this.drivers.delete(client.sessionId);
    this.ready.delete(client.sessionId);
    if (this.simulation && this.simulation.race.phase !== 'finished') {
      this.setSimulationInterval();
      this.broadcast('cancelled', { reason: 'Um dos pilotos saiu da prova.' });
      void this.disconnect();
    }
  }

  private start(): void {
    const simulation = new AuthoritativeRace(randomUUID(), [
      stockOnlineBuild(ONLINE_STARTERS[0], 'Piloto 1'),
      stockOnlineBuild(ONLINE_STARTERS[1], 'Piloto 2'),
    ], TRACKS[0]!, randomInt(1, 2 ** 31));
    this.simulation = simulation;
    this.previousFrameMs = performance.now();
    this.broadcast('snapshot', simulation.snapshot());
    this.setSimulationInterval(() => this.advance(simulation), STEP_MS);
  }

  private advance(simulation: AuthoritativeRace): void {
    const now = performance.now();
    const elapsed = now - this.previousFrameMs;
    this.previousFrameMs = now;
    this.droppedMs += Math.max(0, elapsed - MAX_CATCH_UP_MS);
    this.pendingMs += Math.min(MAX_CATCH_UP_MS, elapsed);
    while (this.pendingMs >= STEP_MS) {
      const beforeStep = performance.now();
      simulation.step();
      this.simulatedMs += performance.now() - beforeStep;
      this.pendingMs -= STEP_MS;
      if (simulation.race.phase === 'finished') {
        this.setSimulationInterval();
        this.broadcast('result', simulation.snapshot());
        console.info('race-proof', {
          ticks: simulation.tick,
          meanStepMs: this.simulatedMs / simulation.tick,
          droppedMs: this.droppedMs,
        });
        this.clock.setTimeout(() => { void this.disconnect(); }, 15_000);
        return;
      }
      if (simulation.tick % SNAPSHOT_STEPS === 0) this.broadcast('snapshot', simulation.snapshot());
    }
  }
}
