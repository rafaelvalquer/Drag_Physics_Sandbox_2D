/** Every ECU unlocks the boost and rev-limit settings; the range grows with the stage. */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';
import { planInstall } from '../../../src/game/career/tuning/ProjectRequirements';

const car = (id: string) => findCampaignCar(id)!;
const FAMILY = 'bmw-n20';
const bmw = car('bmw-320i-f30-2014');
/** A valid part list with the stage map and the hardware the map asks for (the install planner finds it). */
const withMap = (tier: number): string[] =>
  planInstall({ base: bmw, car: { baseCarId: bmw.id, installedParts: [] }, save: { completedEventIds: [], inventoryPartIds: [], credits: 9e6 }, partId: `ecu-map-${FAMILY}-s${tier}`, versionOf: () => 2 }).parts;

describe('ECU sliders', () => {
  it('a car without an ECU has both settings locked', () => {
    const c = tuningCapabilities(bmw, [], 2);
    expect(c.boost.enabled).toBe(false);
    expect(c.revLimit.enabled).toBe(false);
  });

  it('every stage map unlocks pressure and cut, with a range that grows with the stage', () => {
    const r = [1, 2, 3].map((t) => tuningCapabilities(bmw, withMap(t), 2));
    for (const c of r) {
      expect(c.boost.enabled, c.boost.reason ?? '').toBe(true);
      expect(c.revLimit.enabled, c.revLimit.reason ?? '').toBe(true);
    }
    expect(r[0]!.boost.max).toBeLessThanOrEqual(r[1]!.boost.max);
    expect(r[1]!.boost.max).toBeLessThanOrEqual(r[2]!.boost.max);
    expect(r[0]!.revLimit.max).toBeLessThan(r[1]!.revLimit.max);
    expect(r[1]!.revLimit.max).toBeLessThanOrEqual(r[2]!.revLimit.max);
    expect(r[0]!.revLimit.max).toBeGreaterThanOrEqual(r[0]!.revLimit.default);
  });

  it('the resolver accepts a pressure and a cut set inside the range of a stage map', () => {
    const parts = withMap(1);
    const c = tuningCapabilities(bmw, parts, 2, { exactBoostMax: true }); // the pressure the fuel system accepts
    const b = resolveBuild(bmw, parts, { boostBar: c.boost.max, revLimitRpm: c.revLimit.max }, 2);
    expect(b.ok, b.ok ? '' : b.errors.join('; ')).toBe(true);
  });

  it('the programmable ECU and the classic ECUs keep their full cut range', () => {
    const p = tuningCapabilities(bmw, ['ecu-programmable'], 2);
    const s1 = tuningCapabilities(bmw, withMap(1), 2);
    expect(p.revLimit.max).toBeGreaterThan(s1.revLimit.max);
    const gol = car('vw-gol-gts-1988');
    expect(tuningCapabilities(gol, ['ecu-remap'], 1).revLimit.enabled).toBe(true);
    expect(tuningCapabilities(gol, ['ecu-street'], 1).revLimit.max).toBeGreaterThan(tuningCapabilities(gol, ['ecu-remap'], 1).revLimit.max);
  });
});
