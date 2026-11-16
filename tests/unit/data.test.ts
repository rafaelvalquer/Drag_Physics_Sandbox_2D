import { describe, expect, it } from 'vitest';
import { CARS, LAB_CARS, cloneCar, findCar } from '../../src/data/cars/index';
import { TRACKS } from '../../src/data/tracks/index';
import { validateCar, validateTrack } from '../../src/data/schema';

describe('content data', () => {
  it('ships the six fictional cars of the plan and the Gol GTS 1988 with their engines and masses', () => {
    const expected: Record<string, { cyl: number; cv: number; kg: number; induction: string }> = {
      'arco-1600': { cyl: 4, cv: 120, kg: 1050, induction: 'NA' },
      'vetra-rs': { cyl: 4, cv: 280, kg: 1260, induction: 'turbo' },
      'lince-gt': { cyl: 6, cv: 300, kg: 1380, induction: 'NA' },
      'orion-xr': { cyl: 6, cv: 420, kg: 1480, induction: 'turbo' },
      'kronos-v8': { cyl: 8, cv: 430, kg: 1590, induction: 'NA' },
      'tempest-v8': { cyl: 8, cv: 500, kg: 1390, induction: 'NA' },
      // real car: 930 kg tare (factory) + 75 kg driver + 22 kg fuel
      'vw-gol-gts-1988': { cyl: 4, cv: 99, kg: 1027, induction: 'NA' },
    };
    expect(CARS.map((c) => c.id).sort()).toEqual(Object.keys(expected).sort());
    for (const c of CARS) {
      const e = expected[c.id]!;
      expect(c.engine.cylinders).toBe(e.cyl);
      expect(c.engine.ratedPowerCv).toBe(e.cv);
      expect(c.massKg).toBe(e.kg);
      expect(c.engine.induction).toBe(e.induction);
    }
    expect(findCar('kronos-v8')!.engine.crankType).toBe('crossplane');
    expect(findCar('tempest-v8')!.engine.crankType).toBe('flatplane');
    expect(LAB_CARS.some((c) => c.engine.cylinders === 12)).toBe(true);
  });

  it.each(LAB_CARS.map((c) => [c.id, c] as const))('%s passes schema validation', (_id, c) => {
    const r = validateCar(c);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it.each(TRACKS.map((t) => [t.id, t] as const))('track %s passes schema validation', (_id, t) => {
    expect(validateTrack(t).ok).toBe(true);
  });

  it('has the four tracks of the plan', () => {
    expect(TRACKS.map((t) => t.theme).sort()).toEqual(['airfield', 'desert', 'nightIndustrial', 'testTrack']);
  });

  it('firing tables cover 720° and every cylinder exactly once', () => {
    for (const c of LAB_CARS) {
      const e = c.engine;
      expect(e.firingAnglesDeg.length).toBe(e.cylinders);
      expect(new Set(e.firingOrder).size).toBe(e.cylinders);
      for (const a of e.firingAnglesDeg) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(720);
      }
    }
    // cross-plane V8 has uneven firing per bank, flat-plane alternates banks
    const flat = findCar('tempest-v8')!.engine;
    const order = flat.firingOrder.map((cyl) => flat.bankOfCylinder[cyl - 1]);
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
    const cross = findCar('kronos-v8')!.engine;
    const crossOrder = cross.firingOrder.map((cyl) => cross.bankOfCylinder[cyl - 1]);
    let sameBankConsecutive = 0;
    for (let i = 1; i < crossOrder.length; i++) if (crossOrder[i] === crossOrder[i - 1]) sameBankConsecutive++;
    expect(sameBankConsecutive).toBeGreaterThan(0);
  });

  it('rejects invalid configurations with readable messages', () => {
    const bad = cloneCar(findCar('arco-1600')!);
    (bad as { massKg: number }).massKg = -5;
    const r = validateCar(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/massKg/);

    const bad2 = cloneCar(findCar('arco-1600')!);
    bad2.engine.torqueCurve.rpm.reverse();
    expect(validateCar(bad2).ok).toBe(false);

    const bad3 = cloneCar(findCar('arco-1600')!);
    (bad3.engine as { revLimitRpm: number }).revLimitRpm = bad3.engine.idleRpm;
    expect(validateCar(bad3).ok).toBe(false);

    expect(validateCar({}).ok).toBe(false);
    expect(validateCar(null).ok).toBe(false);
  });

  it('cloneCar returns an independent deep copy', () => {
    const a = findCar('lince-gt')!;
    const b = cloneCar(a);
    b.transmission.gearRatios[0] = 9;
    expect(a.transmission.gearRatios[0]).not.toBe(9);
  });
});
