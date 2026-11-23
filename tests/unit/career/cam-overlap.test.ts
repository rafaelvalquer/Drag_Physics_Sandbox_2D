/** Camshaft overlap vs. forced induction: cam-na-race / cam-turbo must each have their own place. */
import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { EngineDyno } from '../../../src/physics/engine/EngineDyno';

const chevette = CAREER_CARS.find((c) => c.id === 'gm-chevette-sl-1988')!;
const TURBO = ['turbo-street', 'fuel-pump', 'clutch-reinforced'];
/** Fully built turbo Chevette (big kit, ported head, low compression, forged internals, free exhaust). */
const TURBO_BUILT = ['turbo-strong', 'fuel-pump', 'clutch-ceramic-race', 'head-race', 'compression-low', 'forged-kit', 'exhaust-sport'];

function dyno(ids: string[]) {
  const r = resolveBuild(chevette, ids);
  if (!r.ok) throw new Error(r.errors.join('; '));
  const d = new EngineDyno(r.car.engine);
  d.start();
  const tq: Record<number, number> = {};
  let peakCv = 0;
  for (let rpm = 1600; rpm <= r.car.engine.revLimitRpm; rpm += 200) {
    const m = d.measure(rpm, 1, 1 / 120, 1.2, 0.2);
    tq[rpm] = m.torqueNm;
    peakCv = Math.max(peakCv, m.powerCv);
  }
  return { tq, peakCv };
}

describe('cam overlap × induction', () => {
  it('naturally aspirated: cam-na-race beats cam-turbo on peak power, and both beat the stock cam', () => {
    const stock = dyno([]);
    const race = dyno(['cam-na-race']);
    const turbo = dyno(['cam-turbo']);
    expect(race.peakCv).toBeGreaterThan(turbo.peakCv + 2);
    expect(turbo.peakCv).toBeGreaterThan(stock.peakCv);
  });

  it('turbo: cam-turbo gives more low/mid torque (2000–3000 rpm) than cam-na-race and the stock cam', () => {
    const stock = dyno(TURBO);
    const race = dyno([...TURBO, 'cam-na-race']);
    const turbo = dyno([...TURBO, 'cam-turbo']);
    for (const rpm of [2000, 2200, 2400, 2600, 2800, 3000]) {
      expect(turbo.tq[rpm]!).toBeGreaterThanOrEqual(race.tq[rpm]!);
    }
    // the overlap of the NA cam blows boost out of the exhaust: it must cost torque against the stock cam
    expect(race.tq[2000]!).toBeLessThan(stock.tq[2000]!);
    // …while the turbo cam keeps most of it and still wins on peak power
    expect(turbo.tq[2400]!).toBeGreaterThan(race.tq[2400]! * 1.05);
    expect(turbo.peakCv).toBeGreaterThan(stock.peakCv);
  });

  it('turbo: cam-turbo peak power is at least comparable to cam-na-race', () => {
    const race = dyno([...TURBO, 'cam-na-race']);
    const turbo = dyno([...TURBO, 'cam-turbo']);
    expect(turbo.peakCv).toBeGreaterThanOrEqual(race.peakCv * 0.99);
  });

  it('fully built turbo: swapping cam-turbo for cam-na-race gives no power and loses low/mid torque', () => {
    const race = dyno([...TURBO_BUILT, 'cam-na-race']);
    const turbo = dyno([...TURBO_BUILT, 'cam-turbo']);
    expect(turbo.peakCv).toBeGreaterThanOrEqual(race.peakCv);
    for (const rpm of [2000, 2400, 3000, 4000]) expect(turbo.tq[rpm]!).toBeGreaterThan(race.tq[rpm]!);
  });
});
