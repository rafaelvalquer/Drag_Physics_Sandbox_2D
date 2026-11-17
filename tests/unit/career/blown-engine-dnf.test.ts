/** A blown engine is a DNF ('engine-blown'), even before the green; the rival still finishes. */
import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { DragAI } from '../../../src/game/ai/DragAI';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { failureSpecFor, tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';
import { RaceController } from '../../../src/game/race/RaceController';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;

describe('blown engine DNF', () => {
  it('revving on the limiter at the line blows the engine: DNF engine-blown, rival finishes', () => {
    const base = CAREER_CARS.find((c) => c.id === 'vw-golf-gti-mk4-2003')!;
    const parts = ['ecu-programmable'];
    const caps = tuningCapabilities(base, parts, 2);
    const r = resolveBuild(base, parts, { revLimitRpm: caps.revLimit.max }, 2);
    if (!r.ok) throw new Error(r.errors.join());
    const a = new VehicleSimulation(r.car, TRACKS[0]!);
    a.enableEngineFailure(failureSpecFor(base, parts, 2));
    const b = new VehicleSimulation(base, TRACKS[0]!);
    const race = new RaceController(
      [
        { sim: a, ai: null, name: 'player', pedal: () => 1 }, // neutral, flat out
        { sim: b, ai: new DragAI(b.car, 'advanced', 3), name: 'rival' },
      ],
      'quarter',
      'pro',
      5,
    );
    for (let i = 0; i < 120 * 90; i++) {
      race.beforeStep(H);
      for (const l of race.raceLanes) l.sim.step(H);
      race.afterStep(H);
      if (race.phase === 'finished') break;
    }
    const [ra, rb] = race.results;
    expect(ra!.dnf).toBe(true);
    expect(ra!.dnfReason).toBe('engine-blown');
    expect(rb!.finished).toBe(true);
    expect(race.winner).toBe(1);
  });
});
