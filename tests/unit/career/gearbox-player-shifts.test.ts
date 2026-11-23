/** An upgraded automatic / dual-clutch box has no D schedule: the player shifts, the box keeps its gains. */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';
import { runAccelerationTest } from '../../../src/game/race/accelerationTest';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

const track = TRACKS.find((t) => t.id === 'test-track')!;
const car = (id: string) => findCampaignCar(id)!;
const et = (c: ReturnType<typeof resolveBuild> & { ok: true }): number => runAccelerationTest(c.car, track, { speedsKmh: [100], distancesM: [402.336], maxS: 40 }).distanceTimes.get(402.336) ?? NaN;
const build = (id: string, parts: string[]) => {
  const r = resolveBuild(car(id), parts, {}, 2);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r;
};

describe('upgraded automatic / dual-clutch gearbox', () => {
  it('the factory box keeps the D schedule; the upgraded one starts and stays in M (player shifts)', () => {
    for (const [id, upgrade] of [['bmw-320i-f30-2014', 'at-upgrade'], ['mitsubishi-evo-x-2012', 'dct-upgrade']] as const) {
      const stock = build(id, []);
      expect(stock.car.transmission.playerShifts).toBeUndefined();
      expect(new VehicleSimulation(stock.car, track).gearboxMode).toBe('D');
      const up = build(id, [upgrade]);
      expect(up.car.transmission.playerShifts).toBe(true);
      expect(up.car.transmission.kind).toBe(car(id).transmission.kind); // same physical box: converter / power shifts stay
      const sim = new VehicleSimulation(up.car, track);
      expect(sim.gearboxMode).toBe('M');
      sim.reset();
      expect(sim.gearboxMode).toBe('M');
    }
  });

  it('every gearbox stage of the family does the same; a manual car is never affected', () => {
    expect(build('bmw-320i-f30-2014', ['automatic-bmw-n20-s1']).car.transmission.playerShifts).toBe(true);
    expect(build('bmw-320i-f30-2014', ['automatic-bmw-n20-s3']).car.transmission.playerShifts).toBe(true);
    expect(build('peugeot-208-gt-2017', ['clutch-reinforced']).car.transmission.playerShifts).toBeUndefined();
  });

  it('the shift-point setting goes away with the schedule', () => {
    const stock = tuningCapabilities(car('bmw-320i-f30-2014'), ['ecu-map-bmw-n20-s1'], 2);
    const up = tuningCapabilities(car('bmw-320i-f30-2014'), ['ecu-map-bmw-n20-s1', 'at-upgrade'], 2);
    expect(stock.shift.enabled).toBe(false); // needs the upgrade
    expect(up.shift.enabled).toBe(false);
    expect(up.shift.reason).toMatch(/suas/);
  });

  it('the upgrade keeps its gains: the AI driver shifting by hand is not slower than the factory automatic', () => {
    for (const [id, upgrade] of [['mitsubishi-evo-x-2012', 'dct-upgrade'], ['nissan-gtr-r35-2015', 'dct-upgrade'], ['kia-stinger-gt-2019', 'at-upgrade'], ['bmw-320i-f30-2014', 'at-upgrade']] as const) {
      const stock = et(build(id, []));
      const up = et(build(id, [upgrade]));
      expect(Number.isFinite(up), id).toBe(true);
      expect(up, `${id}: ${up.toFixed(2)} s with the upgrade, ${stock.toFixed(2)} s stock`).toBeLessThanOrEqual(stock + 0.01);
    }
  }, 120_000);
});
