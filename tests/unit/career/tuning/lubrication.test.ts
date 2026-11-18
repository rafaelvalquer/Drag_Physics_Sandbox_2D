/** Lubrication model: oil flow and heat rejection against what the build asks for. */
import { describe, expect, it } from 'vitest';
import { oilCheck, OIL_MIN_MARGIN } from '../../../../src/game/career/tuning/LubricationModel';
import { findPart, type OilSystemPart } from '../../../../src/game/career/tuning/parts';
import { BITURBO_CARS, build, car, GTR, NA_CARS, C43, Z370 } from './_helpers';

const oil = (id: string) => findPart(id) as OilSystemPart;

describe('lubrication model', () => {
  it('never starves a factory car', () => {
    for (const id of [...NA_CARS, ...BITURBO_CARS]) {
      const c = oilCheck(car(id), build(id, []).car);
      expect(c.margin, id).toBeGreaterThanOrEqual(1);
      expect(c.enduranceScale, id).toBe(1);
    }
  });
  it('margin falls as torque and heat grow, and the part restores it', () => {
    const base = car(Z370);
    const kit = ['turbo-vq37-balanced', 'forged-v6-turbo', 'fuel-v6-highflow', 'clutch-v6-comp'];
    const hot = build(Z370, kit).car;
    const without = oilCheck(base, hot);
    expect(without.margin).toBeLessThan(oilCheck(base, build(Z370, []).car).margin);
    const street = oilCheck(base, hot, oil('oil-system-street'));
    const race = oilCheck(base, hot, oil('oil-system-race'));
    expect(street.margin).toBeGreaterThan(without.margin);
    expect(race.margin).toBeGreaterThan(street.margin);
    expect(race.enduranceScale).toBeGreaterThanOrEqual(street.enduranceScale);
  });
  it('below the minimum the oil system cannot keep the engine alive and the build is refused', () => {
    const c = oilCheck(car(Z370), build(Z370, []).car);
    expect(c.ok).toBe(true);
    expect(OIL_MIN_MARGIN).toBeGreaterThan(0.5);
    // the biggest biturbo project needs the competition system to stay above the limit
    const parts = ['ecu-biturbo-comp', 'turbo-hybrid-hf', 'downpipe-catless', 'intercooler-comp', 'manifold-turbo-hf', 'internals-biturbo-s3', 'fuel-v6-highflow', 'fuel-hp-pump', 'at-upgrade-s2'];
    const without = build(C43, parts);
    expect(without.diagnostics?.oil?.margin).toBeLessThan(1);
    const withOil = build(C43, [...parts, 'oil-system-race']);
    expect(withOil.diagnostics?.oil?.margin).toBeGreaterThan(without.diagnostics!.oil!.margin);
  });
  it('the thermal margin is measured against the heat of the new power, not a fixed number', () => {
    const a = oilCheck(car(GTR), build(GTR, ['ecu-stage1']).car);
    const b = oilCheck(car(GTR), build(GTR, ['ecu-stage1', 'oil-system-race']).car, oil('oil-system-race'));
    expect(b.thermalMargin).toBeGreaterThan(a.thermalMargin);
  });
});
