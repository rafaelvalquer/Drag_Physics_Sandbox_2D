/**
 * A blown engine is a DNF ('engine-blown'), even before the green; the rival still finishes, the
 * exact failure speed is recorded and a car that breaks while moving coasts before the safety
 * braking. Real campaign builds and the normal failure limits (nothing injected).
 */
import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { DragAI } from '../../../src/game/ai/DragAI';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { failureSpecFor, tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';
import { BLOWN_COAST_S, RaceController, type RaceLane } from '../../../src/game/race/RaceController';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;
const base = CAREER_CARS.find((c) => c.id === 'vw-golf-gti-mk4-2003')!;
const parts = ['ecu-programmable'];

function criticalSim(): VehicleSimulation {
  const caps = tuningCapabilities(base, parts, 2);
  const r = resolveBuild(base, parts, { revLimitRpm: caps.revLimit.max }, 2);
  if (!r.ok) throw new Error(r.errors.join());
  const s = new VehicleSimulation(r.car, TRACKS[0]!);
  s.enableEngineFailure(failureSpecFor(base, parts, 2));
  return s;
}

function rival(): RaceLane {
  const b = new VehicleSimulation(base, TRACKS[0]!);
  return { sim: b, ai: new DragAI(b.car, 'advanced', 3), name: 'rival' };
}

describe('blown engine DNF', () => {
  it('revving on the limiter at the line blows the engine: DNF engine-blown, rival finishes', () => {
    const a = criticalSim();
    const race = new RaceController([{ sim: a, ai: null, name: 'player', pedal: () => 1 }, rival()], 'quarter', 'pro', 5);
    for (let i = 0; i < 120 * 90; i++) {
      race.beforeStep(H);
      for (const l of race.raceLanes) l.sim.step(H);
      race.afterStep(H);
      if (race.phase === 'finished') break;
    }
    const [ra, rb] = race.results;
    expect(ra!.dnf).toBe(true);
    expect(ra!.dnfReason).toBe('engine-blown');
    expect(ra!.blownAtRpm).toBe(a.failure!.brokenRpm);
    expect(rb!.finished).toBe(true);
    expect(race.winner).toBe(1);
  });

  it('holding gears on a critical cut breaks during the 402 m; the car coasts, then brakes', () => {
    const a = criticalSim();
    let race!: RaceController;
    let onCut = 0;
    const player: RaceLane = {
      sim: a,
      ai: null,
      name: 'player',
      pedal: () => {
        if (a.engine.runState === 'RUNNING' && a.gear === 0) a.requestShift(1);
        if (race.greenAt === null || race.time < race.greenAt) return 0;
        // late shifts: 2 s on the limiter in every gear
        if (a.engine.rpm > a.car.engine.revLimitRpm - 150) onCut += H;
        if (onCut > 2 && a.gear < a.gearbox.gearCount && !a.shift.active) {
          a.requestShift(1);
          onCut = 0;
        }
        return 1;
      },
    };
    race = new RaceController([player, rival()], 'quarter', 'pro', 9);
    let brokeAt: number | null = null;
    let speedAtBreak = 0;
    let brakeDuringCoast = false;
    let brakeAfter = false;
    for (let i = 0; i < 120 * 90; i++) {
      race.beforeStep(H);
      if (brokeAt !== null) {
        const dt = race.time - brokeAt;
        if (dt < BLOWN_COAST_S - 0.05 && a.speed > 0.5 && a.controls.autoBrake) brakeDuringCoast = true;
        if (dt > BLOWN_COAST_S + 0.05 && a.controls.autoBrake) brakeAfter = true;
      }
      for (const l of race.raceLanes) l.sim.step(H);
      race.afterStep(H);
      if (brokeAt === null && race.results[0]!.dnf) {
        brokeAt = race.time;
        speedAtBreak = a.speed;
      }
      if (race.phase === 'finished' && brokeAt !== null && race.time - brokeAt > 3) break;
    }
    const r = race.results[0]!;
    expect(r.dnfReason).toBe('engine-blown');
    expect(a.x).toBeLessThan(402.336);
    expect(speedAtBreak).toBeGreaterThan(5);
    expect(r.blownAtRpm).toBeGreaterThan(a.car.engine.revLimitRpm - 400);
    expect(brakeDuringCoast).toBe(false);
    expect(brakeAfter).toBe(true);
    expect(race.results[1]!.finished).toBe(true);
  });
});
