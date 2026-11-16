/**
 * Automatic start with free revving in neutral (race mode): readiness without a gear, automatic
 * tree, the three separate timers (time since green, RT, ET, total), N→1 with a high rpm and
 * the existing rules (red light, DNF, AI).
 */
import { describe, expect, it } from 'vitest';
import { findCar } from '../../src/data/cars/index';
import { TRACKS } from '../../src/data/tracks/index';
import { DragAI } from '../../src/game/ai/DragAI';
import { RACE_DISTANCES, READY_MESSAGE, ROLLOUT_M, RaceController, type RaceDistanceId, type RaceLane, type TreeType } from '../../src/game/race/RaceController';
import { VehicleSimulation } from '../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;

function sim(id: string): VehicleSimulation {
  const car = findCar(id);
  if (!car) throw new Error(id);
  return new VehicleSimulation(car, TRACKS[0]!);
}

type Script = (r: RaceController, s: VehicleSimulation) => number;

/** Player lane driven by a script that returns the pedal and may call requestShift itself. */
function player(s: VehicleSimulation, script: Script, race: () => RaceController): RaceLane {
  return { sim: s, ai: null, name: 'player', pedal: () => script(race(), s) };
}

function loop(race: RaceController, maxS: number, each?: (r: RaceController) => boolean | void): void {
  for (let i = 0, n = Math.round(maxS / H); i < n; i++) {
    if (each?.(race) === true) return;
    race.beforeStep(H);
    for (const l of race.raceLanes) l.sim.step(H);
    race.afterStep(H);
    if (race.phase === 'finished' && race.raceLanes.every((l) => l.sim.speed < 0.3)) return;
  }
}

function solo(script: Script, id = 'arco-1600', dist: RaceDistanceId = 'eighth', tree: TreeType = 'pro', seed = 5): { race: RaceController; s: VehicleSimulation } {
  const s = sim(id);
  let race!: RaceController;
  race = new RaceController([player(s, script, () => race)], dist, tree, seed);
  return { race, s };
}

/** Shift up near the redline once locked (like a driver). */
function upshift(s: VehicleSimulation): void {
  if (s.gear >= 1 && s.gear < s.gearbox.gearCount && !s.shift.active && s.clutchCtl.mode === 'LOCKED' && s.engine.rpm > s.car.engine.redlineRpm - 300) s.requestShift(1);
}

describe('neutral start — preparation', () => {
  it('1. ready in neutral (no gear needed) and the tree starts by itself', () => {
    const { race, s } = solo(() => 0);
    loop(race, 8, (r) => r.phase !== 'staging');
    expect(s.gear).toBe(0);
    expect(race.phase).toBe('tree');
    expect(race.greenAt).not.toBeNull();
    expect(race.lights().prestage[0]).toBe(true);
    expect(race.status).toBe(READY_MESSAGE);
    expect(s.speed).toBeLessThan(0.05);
    expect(s.x).toBeLessThan(ROLLOUT_M);
  });

  it('2. revving in neutral: rpm climbs to the limiter, car stays still, ready holds, no wheel torque', () => {
    const { race, s } = solo((r) => (r.time > 1 ? 1 : 0), 'arco-1600', 'eighth', 'sportsman');
    let maxRpm = 0;
    let readyAll = true;
    let maxClutchTorque = 0;
    loop(race, 4, (r) => {
      if (r.time > 2.5) {
        maxRpm = Math.max(maxRpm, s.engine.rpm);
        readyAll &&= r.lights().prestage[0];
        maxClutchTorque = Math.max(maxClutchTorque, Math.abs(s.clutchTorque));
      }
      return r.greenAt !== null && r.time > r.greenAt - 0.01;
    });
    expect(s.gear).toBe(0);
    expect(s.engine.runState).toBe('RUNNING');
    expect(maxRpm).toBeGreaterThan(s.car.engine.idleRpm + 2500);
    expect(maxRpm).toBeLessThanOrEqual(s.car.engine.revLimitRpm + 150);
    expect(Math.abs(s.speed)).toBeLessThan(0.05);
    expect(s.x).toBeLessThan(0.01);
    expect(readyAll).toBe(true);
    expect(maxClutchTorque).toBeLessThan(1e-6);
    expect(Number.isFinite(s.engine.rpm)).toBe(true);
  });
});

describe('neutral start — timers', () => {
  it('3. time since green: null before the tree, 0 at green, advances with no commands; ET undefined before the sensor', () => {
    const { race } = solo(() => 0);
    expect(race.elapsedSinceGreen(0)).toBeNull();
    let atGreen: number | null = null;
    loop(race, 20, (r) => {
      if (r.greenAt !== null && r.time < r.greenAt) expect(r.elapsedSinceGreen(0)).toBe(0);
      if (atGreen === null && r.phase === 'racing') atGreen = r.elapsedSinceGreen(0);
      return r.greenAt !== null && r.time > r.greenAt + 2;
    });
    expect(atGreen).not.toBeNull();
    expect(atGreen!).toBeLessThan(2 * H + 1e-9);
    expect(race.elapsedSinceGreen(0)!).toBeCloseTo(race.time - race.greenAt!, 9);
    expect(race.elapsedSinceGreen(0)!).toBeGreaterThanOrEqual(2);
    expect(race.elapsed(0)).toBeNull();
    expect(race.results[0]!.rt).toBeNull();
    expect(race.results[0]!.et).toBeNull();
  });

  it('4. E with high rpm after the green: first gear, LAUNCH, progressive torque, car moves, rpm continuous', () => {
    let engagedAt: number | null = null;
    let pressed = false;
    const { race, s } = solo((r, v) => {
      if (r.greenAt !== null && r.time > r.greenAt + 0.8 && !pressed) {
        pressed = true;
        expect(v.engine.rpm).toBeGreaterThan(v.car.engine.idleRpm + 2500);
        expect(v.requestShift(1)).toBe('started');
        engagedAt = r.time;
      }
      return r.time > 2.5 ? 1 : 0;
    });
    const rpms: number[] = [];
    const torques: number[] = [];
    const modes = new Set<string>();
    let rpmAtPress = 0;
    loop(race, 20, (r) => {
      if (engagedAt !== null) {
        if (rpms.length === 0) rpmAtPress = s.engine.rpm;
        rpms.push(s.engine.rpm);
        torques.push(Math.abs(s.clutchTorque));
        modes.add(s.clutchCtl.mode);
      }
      return engagedAt !== null && r.time > engagedAt + 3;
    });
    expect(s.gear).toBe(1);
    expect(modes.has('LAUNCH')).toBe(true);
    expect(s.speed).toBeGreaterThan(3);
    expect(s.x).toBeGreaterThan(ROLLOUT_M);
    // torque ramps up (no step to the full clutch capacity in one 1/120 s tick) and rpm is continuous
    let maxRpmStep = 0;
    for (let i = 1; i < rpms.length; i++) maxRpmStep = Math.max(maxRpmStep, Math.abs(rpms[i]! - rpms[i - 1]!));
    expect(maxRpmStep).toBeLessThan(400);
    let maxTorqueStep = 0;
    for (let i = 1; i < torques.length; i++) maxTorqueStep = Math.max(maxTorqueStep, Math.abs(torques[i]! - torques[i - 1]!));
    expect(maxTorqueStep).toBeLessThan(s.car.transmission.clutch.maxTorqueNm * 0.6);
    // the engine was not forced to idle: rpm right after the press is still near the launch rpm
    expect(rpms[3]!).toBeGreaterThan(rpmAtPress * 0.7);
    expect(Math.min(...rpms)).toBeGreaterThan(s.car.engine.idleRpm * 0.9);
  });

  it('5. sensor exit 1.5 s after the green → RT ≈ 1.500 s (interpolated crossing)', () => {
    const { race, s } = solo(() => 0);
    let done = false;
    loop(race, 20, (r) => {
      if (!done && r.greenAt !== null && r.time >= r.greenAt + 1.5 - 0.004) {
        // put the front tyre just behind the beam moving at 2 m/s: crossing within this step
        done = true;
        s.x = ROLLOUT_M - 0.5 * 2 * H;
        s.body.v = 2;
      }
      return r.results[0]!.rt !== null;
    });
    const rt = race.results[0]!.rt!;
    expect(rt).toBeGreaterThan(1.49);
    expect(rt).toBeLessThan(1.51);
  });

  it('6/7. ET does not depend on the time waited in neutral; Total = RT + ET = finish − green', () => {
    const run = (wait: number): { rt: number; et: number; total: number; sg: number; green: number } => {
      const { race } = solo((r, v) => {
        if (r.greenAt === null || r.time < r.greenAt + wait) return v.gear === 0 && r.time > 2 ? 0.8 : 0;
        if (v.gear === 0) v.requestShift(1);
        upshift(v);
        return 1;
      });
      loop(race, 60);
      const res = race.results[0]!;
      expect(res.finished).toBe(true);
      return { rt: res.rt!, et: res.et!, total: res.total!, sg: race.elapsedSinceGreen(0)!, green: race.greenAt! };
    };
    const a = run(0.3);
    const b = run(3);
    expect(b.rt - a.rt).toBeGreaterThan(2.5);
    // same launch procedure from a different waiting time: ET differs only by launch jitter
    expect(Math.abs(a.et - b.et)).toBeLessThan(0.35);
    for (const x of [a, b]) {
      expect(x.total).toBeCloseTo(x.rt + x.et, 12);
      expect(x.sg).toBeCloseTo(x.total, 9); // time since green frozen at the finish line
    }
  });
});

describe('neutral start — red light, DNF', () => {
  it('8. engaging and leaving before the green is a red light: RT < 0, red lamp, invalid result', () => {
    const { race, s } = solo((r, v) => {
      if (r.phase === 'tree' && v.gear === 0 && !v.shift.active) v.requestShift(1);
      if (r.phase === 'tree' && v.gear === 1) return 1;
      if (r.phase === 'staging' && r.time > 2.5) return 1;
      upshift(v);
      return r.phase === 'racing' ? 1 : 0;
    });
    loop(race, 40);
    const res = race.results[0]!;
    expect(res.redLight).toBe(true);
    expect(res.rt!).toBeLessThan(0);
    expect(race.lights().red[0]).toBe(true);
    expect(race.lights().green[0]).toBe(false);
    expect(res.finished).toBe(true);
    expect(race.winner).toBeNull(); // never a win / record: RaceMode only stores records for !redLight
    expect(res.total!).toBeCloseTo(res.rt! + res.et!, 12);
    expect(s.gear).toBeGreaterThanOrEqual(1);
  });

  it('10. staying in neutral after the green: clock runs, ET undefined, DNF at the timeout, no win', () => {
    const { race } = solo(() => 0.6);
    race.dnfTimeoutS = 6;
    loop(race, 30);
    const res = race.results[0]!;
    expect(res.dnf).toBe(true);
    expect(res.et).toBeNull();
    expect(res.rt).toBeNull();
    expect(res.total ?? null).toBeNull();
    expect(race.winner).toBeNull();
    expect(race.phase).toBe('finished');
    // timer frozen at the DNF instant (≈ timeout)
    expect(race.elapsedSinceGreen(0)!).toBeGreaterThan(5.9);
    expect(race.elapsedSinceGreen(0)!).toBeLessThan(6.1);
    loop(race, 1);
    expect(race.elapsedSinceGreen(0)!).toBeLessThan(6.1);
  });
});

describe('neutral start — AI and regressions', () => {
  it('9. race against the AI: preparation, tree, reaction time, shifts, finish and result', () => {
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      const s = sim('orion-xr');
      const b = sim('lince-gt');
      const ai = new DragAI(b.car, level, 4);
      let race!: RaceController;
      race = new RaceController(
        [
          player(s, (r, v) => {
            if (r.time > 3 && r.time < 3.5) return 0.9;
            if (r.greenAt === null || r.time < r.greenAt + 0.25) return 0;
            if (v.gear === 0) v.requestShift(1);
            upshift(v);
            return 1;
          }, () => race),
          { sim: b, ai, name: 'IA' },
        ],
        'eighth',
        'pro',
        8,
      );
      let aiGearBeforeGreen = 0;
      loop(race, 60, (r) => {
        if (r.greenAt !== null && r.time < r.greenAt) aiGearBeforeGreen = Math.max(aiGearBeforeGreen, b.gear);
        // the AI never starts the count by itself and never leaves before its reaction
        if (r.phase === 'staging') expect(b.x).toBeLessThan(ROLLOUT_M);
      });
      expect(race.phase).toBe('finished');
      expect(aiGearBeforeGreen).toBe(1);
      const rb = race.results[1]!;
      expect(rb.finished).toBe(true);
      expect(rb.redLight).toBe(false);
      expect(rb.rt!).toBeGreaterThan(ai.reactionTime - 0.01);
      expect(rb.gearsUsed!.length).toBeGreaterThan(1);
      expect(rb.total!).toBeCloseTo(rb.rt! + rb.et!, 12);
      expect(race.winner).not.toBeNull();
    }
  });

  it('11. every distance and both trees finish with consistent totals', () => {
    for (const d of Object.keys(RACE_DISTANCES) as RaceDistanceId[]) {
      for (const tree of ['pro', 'sportsman'] as const) {
        const { race } = solo(
          (r, v) => {
            if (r.greenAt === null || r.time < r.greenAt + 0.3) return r.time > 2 && r.time < 2.6 ? 0.7 : 0;
            if (v.gear === 0) v.requestShift(1);
            upshift(v);
            return 1;
          },
          'kronos-v8',
          d,
          tree,
          3,
        );
        loop(race, 120);
        const res = race.results[0]!;
        expect(res.finished, `${d}/${tree}`).toBe(true);
        expect(res.redLight).toBe(false);
        expect(res.total!).toBeCloseTo(res.rt! + res.et!, 12);
        expect(res.et!).toBe(res.splits[d === 'km' ? 'km' : d]);
        expect(race.winner).toBe(0);
      }
    }
  });
});
