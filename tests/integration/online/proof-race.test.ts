import { Client } from '@colyseus/sdk';
import { expect, it } from 'vitest';
import type { OnlineRaceSnapshot } from '../../../src/game/online/contracts';
import { PROOF_ROOM } from '../../../src/server/online/ProofRaceRoom';
import { startProofServer } from '../../../src/server/online/proofServer';

it('dois clientes WebSocket controlam faixas distintas e recebem o mesmo resultado', async () => {
  const server = await startProofServer(0);
  try {
    const address = server.transport.server?.address();
    if (!address || typeof address === 'string') throw new Error('Servidor sem porta TCP');
    const endpoint = `http://127.0.0.1:${address.port}`;
    const rooms = await Promise.all([new Client(endpoint), new Client(endpoint)].map((client) => client.joinOrCreate(PROOF_ROOM)));
    const lanes = new Set<number>();
    const results = rooms.map((room) => new Promise<OnlineRaceSnapshot>((resolve, reject) => {
      let lane: 0 | 1 | undefined;
      let sequence = 0;
      let lastInputMs = 0;
      let lastSnapshotMs = 0;
      const snapshotIntervals: number[] = [];
      room.onLeave(() => reject(new Error('Conexão encerrada antes do resultado')));
      room.onMessage('assignment', (assignment: { lane: 0 | 1 }) => {
        lane = assignment.lane;
        lanes.add(lane);
      });
      room.onMessage('snapshot', (snapshot: OnlineRaceSnapshot) => {
        if (lane === undefined) return;
        const now = performance.now();
        if (lastSnapshotMs > 0) snapshotIntervals.push(now - lastSnapshotMs);
        lastSnapshotMs = now;
        if (now - lastInputMs < 34) return;
        lastInputMs = now;
        const telemetry = snapshot.lanes[lane];
        const launch = snapshot.scheduledGreenTick !== null && snapshot.tick >= snapshot.scheduledGreenTick + 16 * lane;
        room.send('input', {
          matchId: snapshot.matchId, observedTick: snapshot.tick, sequence: sequence++, throttle: launch ? 1 : 0,
          shift: launch && (telemetry.gear === 0 || telemetry.rpm > 5_750) ? 1 : undefined,
        });
      });
      room.onMessage('result', (result: OnlineRaceSnapshot) => {
        console.info('race-proof-client', { lane, snapshots: snapshotIntervals.length + 1, meanIntervalMs: snapshotIntervals.reduce((a, b) => a + b, 0) / snapshotIntervals.length });
        resolve(result);
      });
      room.send('ready');
    }));
    const [first, second] = await Promise.all(results);
    expect(lanes).toEqual(new Set([0, 1]));
    expect(first).toEqual(second);
    expect(first?.lanes.every((lane) => lane.result.et !== null && !lane.result.redLight)).toBe(true);
  } finally {
    await server.gracefullyShutdown(false);
  }
}, 55_000);
