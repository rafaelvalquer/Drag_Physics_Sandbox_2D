/** Blown Engine integration: limits come from springs, internals and lubrication, never from the ECU alone. */
import { describe, expect, it } from 'vitest';
import { LIMITER_MARGIN_RPM, reliabilityLimits } from '../../../../src/game/career/tuning/EngineReliability';
import { failureSpecFor, tuningCapabilities } from '../../../../src/game/career/tuning/TuningCapabilities';
import { BITURBO_CARS, build, car, NA_CARS, Z350, Z370 } from './_helpers';

const lim = (id: string, parts: string[]) => reliabilityLimits(build(id, parts).car, parts);

describe('reliability of the V6 projects', () => {
  it('the factory cut of every Chapter 3 car is safe', () => {
    for (const id of [...NA_CARS, ...BITURBO_CARS]) {
      const l = lim(id, []);
      expect(l.recommendedSafeRpm, id).toBeGreaterThanOrEqual(car(id).engine.revLimitRpm + LIMITER_MARGIN_RPM);
      expect(l.maxSafeRpm, id).toBeGreaterThan(l.recommendedSafeRpm);
    }
  });
  it('the hardware cut of a project is safe by construction (the part maker calibrated it)', () => {
    for (const id of NA_CARS) {
      const p = ['filter-v6-dual', 'exhaust-v6-sport', `ecu-${id === Z350 ? 'vq35' : id === Z370 ? 'vq37' : '2gr'}-s2`];
      const l = lim(id, p);
      expect(l.recommendedSafeRpm, id).toBeGreaterThanOrEqual(build(id, p).car.engine.revLimitRpm);
    }
  });
  it('forged internals, rods, a balanced crank and springs add physical headroom', () => {
    const stock = lim(Z370, []);
    expect(lim(Z370, ['rods-v6-light']).recommendedSafeRpm).toBeGreaterThan(stock.recommendedSafeRpm);
    expect(lim(Z370, ['forged-v6-na']).enduranceS).toBeGreaterThan(stock.enduranceS);
    expect(lim(Z370, ['crank-balanced-v6']).enduranceS).toBeGreaterThan(stock.enduranceS);
    expect(lim(Z370, ['valve-springs-v6-comp']).maxSafeRpm).toBeGreaterThanOrEqual(stock.maxSafeRpm + 800);
  });
  it('the ECU alone does not raise the mechanical limit beyond the cut it moved', () => {
    const stock = lim(Z370, []);
    const ecu = lim(Z370, ['filter-v6-dual', 'exhaust-v6-sport', 'ecu-vq37-comp']);
    expect(ecu.maxSafeRpm - stock.maxSafeRpm).toBeLessThanOrEqual(300 + 1);
  });
  it('a loaded build without the oil system lasts less at the limit, and the system gives the time back', () => {
    const conv = ['turbo-vq37-balanced', 'forged-v6-turbo', 'fuel-v6-highflow', 'clutch-v6-comp'];
    const dry = lim(Z370, conv);
    const wet = lim(Z370, [...conv, 'oil-system-race']);
    expect(wet.enduranceS).toBeGreaterThan(dry.enduranceS);
    expect(dry.enduranceS).toBeLessThan(lim(Z370, ['forged-v6-turbo']).enduranceS);
  });
  it('the failure spec of the career race comes from the hardware, not from the Dyno cut', () => {
    const parts = ['filter-v6-dual', 'exhaust-v6-sport', 'ecu-vq37-comp', 'valve-springs-v6-comp'];
    const spec = failureSpecFor(car(Z370), parts, 2)!;
    const caps = tuningCapabilities(car(Z370), parts, 2);
    expect(spec.maxSafeRpm).toBe(caps.limits!.maxSafeRpm);
    expect(spec.recommendedSafeRpm).toBeGreaterThanOrEqual(build(Z370, parts).car.engine.revLimitRpm);
  });
  it('estimated figures stay flagged as estimates', () => {
    expect(lim(Z370, []).estimated).toBe(true);
  });
});
