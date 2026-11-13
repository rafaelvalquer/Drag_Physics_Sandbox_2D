/**
 * Drag race timing: christmas tree, staging, reaction time, red light, interpolated splits,
 * trap speeds, winner, DNF and the automatic braking after the finish.
 */
import { describe, expect, it } from 'vitest';
import { findCar } from '../../src/data/cars/index';
import { TRACKS } from '../../src/data/tracks/index';
import { DragAI } from '../../src/game/ai/DragAI';
import { FT, RACE_DISTANCES, ROLLOUT_M, RaceController, TRAP_M, type RaceLane } from '../../src/game/race/RaceController';
import { VehicleSimulation } from '../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;

function sim(id: string): VehicleSimulation {
  const car = findCar(id);
  if (!car) throw new Error(id);
  return new VehicleSimulation(car, TRACKS[0]!);
}

/** Runs the race loop exactly like the app: beforeStep → step all → afterStep. */
function runRace(race: RaceController, maxS: number, each?: (t: number) => void): void {
  const n = Math.round(maxS / H);
  for (let i = 0; i < n; i++) {
    each?.(race.time);
    race.beforeStep(H);
    for (const l of race.raceLanes) l.sim.step(H);
    race.afterStep(H);
    if (race.phase === 'finished' && race.raceLanes.every((l) => l.sim.speed < 0.3)) break;
  }
}

/** Player-like lane: E once the engine runs, throttle after `reaction` s of green, E near the redline. */
function scriptedPlayer(s: VehicleSimulation, race: () => RaceController, reaction: number, early?: (r: RaceController) => boolean): RaceLane {
  let engaged = false;
  return {
    sim: s,
    ai: null,
    name: 'player',
    pedal: () => {
      const r = race();
      if (!engaged && s.engine.runState === 'RUNNING') engaged = s.requestShift(1) === 'started';
      if (early?.(r)) return 1;
      if (r.greenAt === null || r.time < r.greenAt + reaction) return 0;
      if (s.gear >= 1 && s.gear < s.gearbox.gearCount && !s.shift.active && s.clutchCtl.mode === 'LOCKED' && s.engine.rpm > s.car.engine.redlineRpm - 300) s.requestShift(1);
      return 1;
    },
  };
}

describe('drag race controller', () => {
  it('AI opponents stage by themselves (engage first gear at the line) and finish the race', () => {
    const a = sim('lince-gt');
    const b = sim('orion-xr');
    const race = new RaceController(
      [
        { sim: a, ai: new DragAI(a.car, 'advanced', 1), name: 'A' },
        { sim: b, ai: new DragAI(b.car, 'intermediate', 2), name: 'B' },
      ],
      'quarter',
      'pro',
      3,
    );
    runRace(race, 80);
    expect(race.phase).toBe('finished');
    for (const r of race.results) {
      expect(r.finished).toBe(true);
      expect(r.redLight).toBe(false);
      expect(r.rt).toBeGreaterThan(0);
      expect(r.et).toBeGreaterThan(9);
      expect(r.et).toBeLessThan(20);
    }
    expect(race.winner).not.toBeNull();
  });

  it('pro tree: green 0.4 s after the ambers; sportsman: 0.5 s per amber', () => {
    for (const [tree, expected] of [
      ['pro', 0.4],
      ['sportsman', 1.5],
    ] as const) {
      const s = sim('arco-1600');
      let race!: RaceController;
      race = new RaceController([scriptedPlayer(s, () => race, 0.3)], 'eighth', tree, 5);
      let firstAmberAt: number | null = null;
      let ambersAtHalf = -1;
      runRace(race, 12, (t) => {
        const l = race.lights();
        if (firstAmberAt === null && l.amber[0] > 0) firstAmberAt = t;
        if (firstAmberAt !== null && tree === 'sportsman' && Math.abs(t - firstAmberAt - 0.6) < H / 2) ambersAtHalf = l.amber[0];
        if (race.greenAt !== null && t > race.greenAt + 0.2) return;
      });
      expect(firstAmberAt).not.toBeNull();
      expect(race.greenAt! - firstAmberAt!).toBeCloseTo(expected, 1);
      if (tree === 'sportsman') expect(ambersAtHalf).toBe(2);
    }
  });

  it('reaction time = stage beam unblocked (rollout) − green; splits are interpolated and consistent', () => {
    const s = sim('kronos-v8');
    let race!: RaceController;
    race = new RaceController([scriptedPlayer(s, () => race, 0.25)], 'quarter', 'pro', 7);
    // record the exact crossing of the rollout distance independently
    let prevX = 0;
    let prevT = 0;
    let leftAt: number | null = null;
    const n = Math.round(60 / H);
    for (let i = 0; i < n; i++) {
      race.beforeStep(H);
      s.step(H);
      race.afterStep(H);
      if (leftAt === null && prevX < ROLLOUT_M && s.x >= ROLLOUT_M) leftAt = prevT + (H * (ROLLOUT_M - prevX)) / (s.x - prevX);
      prevX = s.x;
      prevT = race.time;
      if (race.phase === 'finished') break;
    }
    const r = race.results[0]!;
    expect(r.redLight).toBe(false);
    expect(r.rt).toBeCloseTo(leftAt! - race.greenAt!, 9);
    expect(r.rt).toBeGreaterThan(0.25); // driver delay + vehicle rollout time
    const sp = r.splits;
    expect(sp['60ft']!).toBeLessThan(sp['330ft']!);
    expect(sp['330ft']!).toBeLessThan(sp['eighth']!);
    expect(sp['eighth']!).toBeLessThan(sp['1000ft']!);
    expect(sp['1000ft']!).toBeLessThan(sp['quarter']!);
    expect(r.et).toBe(sp['quarter']);
    // trap speed = 66 ft / time between (d − 66 ft) and d, close to the speed at the line
    expect(r.trapMs!).toBeGreaterThan(r.maxSpeedMs * 0.9);
    expect(r.trapMs!).toBeLessThanOrEqual(r.maxSpeedMs + 1e-9);
    expect(TRAP_M).toBeCloseTo(66 * FT, 12);
    expect(race.distanceM).toBeCloseTo(1320 * FT, 9);
  });

  it('leaving before the green is a red light and loses against a clean run', () => {
    const a = sim('vetra-rs');
    const b = sim('vetra-rs');
    let race!: RaceController;
    race = new RaceController([scriptedPlayer(a, () => race, 0, (r) => r.lights().stage[0] || r.results[0]!.redLight), { sim: b, ai: new DragAI(b.car, 'beginner', 9), name: 'B' }], 'eighth', 'pro', 11);
    runRace(race, 60);
    const [ra, rb] = race.results;
    expect(ra!.redLight).toBe(true);
    expect(ra!.rt!).toBeLessThan(0);
    expect(race.lights().red[0]).toBe(true);
    expect(rb!.redLight).toBe(false);
    expect(race.winner).toBe(1);
  });

  it('a car that never leaves is a DNF after the timeout; the other wins', () => {
    const a = sim('arco-1600');
    const b = sim('arco-1600');
    let race!: RaceController;
    race = new RaceController([{ sim: a, ai: new DragAI(a.car, 'advanced', 1), name: 'A' }, scriptedPlayer(b, () => race, 1e9)], 'eighth', 'pro', 2);
    race.dnfTimeoutS = 25;
    runRace(race, 40);
    expect(race.results[1]!.dnf).toBe(true);
    expect(race.winner).toBe(0);
  });

  it('after the finish the car brakes by itself to a stop (no brake key)', () => {
    const s = sim('orion-xr');
    let race!: RaceController;
    race = new RaceController([scriptedPlayer(s, () => race, 0.3)], 'eighth', 'pro', 4);
    runRace(race, 60);
    expect(race.phase).toBe('finished');
    expect(s.controls.autoBrake).toBe(true);
    expect(s.speed).toBeLessThan(0.3);
    expect(s.x).toBeGreaterThan(RACE_DISTANCES.eighth.m);
    expect(s.x).toBeLessThan(TRACKS[0]!.lengthM);
  });
});
