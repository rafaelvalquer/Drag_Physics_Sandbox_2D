/**
 * Integration: fixed-step loop + vehicle + race timing + telemetry, independent of the render
 * frame rate, with honest accounting of time that could not be simulated.
 */
import { describe, expect, it } from 'vitest';
import { findCar } from '../../src/data/cars/index';
import { TRACKS } from '../../src/data/tracks/index';
import { DragAI } from '../../src/game/ai/DragAI';
import { RaceController } from '../../src/game/race/RaceController';
import { PHYSICS_DT, SimulationRunner } from '../../src/game/SimulationRunner';
import { CHANNELS, TelemetryRecorder } from '../../src/telemetry/TelemetryRecorder';

function raceRunner(frameDt: number, frames: number): { runner: SimulationRunner; race: RaceController } {
  const runner = new SimulationRunner(TRACKS[0]!);
  const a = runner.add(findCar('kronos-v8')!, { id: 'a', lane: 0, isPlayer: true });
  const b = runner.add(findCar('orion-xr')!, { id: 'b', lane: 1, isPlayer: false });
  const race = new RaceController(
    [
      { sim: a.sim, ai: new DragAI(a.sim.car, 'advanced', 5), name: 'A' },
      { sim: b.sim, ai: new DragAI(b.sim.car, 'advanced', 6), name: 'B' },
    ],
    'eighth',
    'pro',
    9,
  );
  a.control = (h) => race.beforeStep(h);
  runner.afterStep.push((h) => race.afterStep(h));
  for (let i = 0; i < frames; i++) runner.advance(frameDt);
  return { runner, race };
}

describe('simulation runner', () => {
  it('the physics result does not depend on the render frame rate', () => {
    // 24 s of real time rendered at 30, 60 and 144 fps (and an irregular pattern)
    const r30 = raceRunner(1 / 30, 24 * 30);
    const r144 = raceRunner(1 / 144, 24 * 144);
    const r60 = raceRunner(1 / 60, 24 * 60);
    expect(r30.race.phase).toBe('finished');
    const et = (r: { race: RaceController }): (number | null)[] => r.race.results.map((x) => x.et);
    expect(et(r144)).toEqual(et(r30));
    expect(et(r60)).toEqual(et(r30));
    // identical step count => bit-identical state
    const steps = [r30, r60, r144].map((r) => r.runner.stats.steps);
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThanOrEqual(1);
    const x = (r: { runner: SimulationRunner }): number => r.runner.vehicles[0]!.sim.x;
    if (r30.runner.stats.steps === r144.runner.stats.steps) expect(x(r144)).toBe(x(r30));
  });

  it('a long frame (tab hidden) is capped and the lost time is reported, not silently simulated', () => {
    const runner = new SimulationRunner(TRACKS[0]!);
    runner.add(findCar('arco-1600')!, { id: 'p', lane: 0, isPlayer: true });
    runner.advance(1.0);
    expect(runner.stats.droppedRealTimeS).toBeCloseTo(0.75, 12);
    expect(runner.simTime).toBeCloseTo(Math.floor(0.25 / PHYSICS_DT) * PHYSICS_DT, 12);
    runner.paused = true;
    const s = runner.stats.steps;
    runner.advance(0.1);
    expect(runner.stats.steps).toBe(s);
    runner.paused = false;
    runner.stepOnce();
    expect(runner.stats.steps).toBe(s + 1);
  });

  it('telemetry records one sample per physics step and states losses in the CSV header', () => {
    const runner = new SimulationRunner(TRACKS[0]!);
    const p = runner.add(findCar('vetra-rs')!, { id: 'p', lane: 0, isPlayer: true });
    const rec = new TelemetryRecorder(240);
    rec.start({ carro: 'Vetra RS' });
    runner.afterStep.push(() => rec.sample(p.sim));
    for (let i = 0; i < 60 * 3; i++) runner.advance(1 / 60); // 3 s = 360 steps, capacity 240
    expect(rec.count).toBe(240);
    expect(rec.lost).toBe(runner.stats.steps - 240);
    const csv = rec.toCsv(['nota de teste']);
    const lines = csv.trim().split('\n');
    expect(lines).toContain('# carro: Vetra RS');
    expect(lines).toContain(`# amostras perdidas (buffer cheio): ${rec.lost}`);
    expect(lines).toContain('# nota de teste');
    const header = lines.find((l) => !l.startsWith('#'))!;
    expect(header.split(',')).toHaveLength(CHANNELS.length);
    const rows = lines.filter((l) => !l.startsWith('#')).slice(1);
    expect(rows).toHaveLength(240);
    const t = rec.column('t')!;
    for (let i = 1; i < t.length; i++) expect(t[i]! - t[i - 1]!).toBeCloseTo(PHYSICS_DT, 9);
    // the engine started by itself (automatic ignition on the track)
    expect(rec.column('rpm')![239]).toBeGreaterThan(300);
  });
});
