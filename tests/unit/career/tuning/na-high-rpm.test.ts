/** Aspirado High RPM: breathing, valve events, ECU and compression act through the engine model. */
import { describe, expect, it } from 'vitest';
import { MonotoneCubic } from '../../../../src/core/math';
import { incompatibility } from '../../../../src/game/career/tuning/BuildResolverV2';
import { reliabilityLimits } from '../../../../src/game/career/tuning/EngineReliability';
import { findPart } from '../../../../src/game/career/tuning/parts';
import { build, car, errors, IS350, NA_CARS, Z350, Z370 } from './_helpers';

const at = (r: ReturnType<typeof build>, rpm: number): number => new MonotoneCubic(r.car.engine.torqueCurve.rpm, r.car.engine.torqueCurve.torqueNm).evaluate(rpm);

describe('aspirated V6 stay aspirated without a kit', () => {
  it('keeps the induction and an untouched sheet for every high-RPM part', () => {
    for (const id of NA_CARS) {
      const r = build(id, ['filter-v6-dual', 'exhaust-v6-race', 'manifold-v6-sport']);
      expect(r.car.engine.induction).toBe('NA');
      expect(r.car.engine.turbo).toBeUndefined();
      expect(car(id).engine.induction).toBe('NA');
    }
  });
});

describe('what each part does to the curve', () => {
  const stock = build(Z370, []);
  it('the manifold moves torque up the rev range (more at the top, less at the bottom)', () => {
    const r = build(Z370, ['manifold-v6-comp']);
    expect(at(r, 7000)).toBeGreaterThan(at(stock, 7000));
    expect(at(r, 2500)).toBeLessThanOrEqual(at(stock, 2500) + 0.5);
  });
  it('the cylinder head adds flow where the valves choke', () => {
    const r = build(Z370, ['head-v6-comp']);
    expect(at(r, 7000)).toBeGreaterThan(at(stock, 7000));
    expect(at(r, 1500)).toBeCloseTo(at(stock, 1500), 0);
  });
  it('VVEL changes the valve events of the 370Z, not a conventional cam', () => {
    const r = build(Z370, ['vvel-370z-s1']);
    expect(r.car.engine.cam.intakeLiftMm).toBeGreaterThan(stock.car.engine.cam.intakeLiftMm);
    expect(r.peakPowerCv).toBeGreaterThan(stock.peakPowerCv);
    expect(errors(Z370, ['vvel-370z-s1']).length).toBe(0);
    expect(incompatibility(car(Z350), findPart('vvel-370z-s1')!)).toMatch(/não é feita para/);
  });
  it('the exhaust frees back pressure and the intake frees the filter', () => {
    const r = build(Z350, ['filter-v6-dual', 'exhaust-v6-race']);
    expect(r.car.engine.breathing!.exhaustBackPressureKPa).toBeLessThan(car(Z350).engine.breathing!.exhaustBackPressureKPa);
    expect(r.car.engine.breathing!.airFilterDropKPa).toBeLessThan(car(Z350).engine.breathing!.airFilterDropKPa);
    expect(r.peakPowerCv).toBeGreaterThan(build(Z350, []).peakPowerCv);
  });
  it('the 2GR-FSE head gains less than a Nissan head (D-4S ports are already tuned)', () => {
    const gain = (id: string, head: string) => build(id, [head]).peakPowerCv / build(id, []).peakPowerCv;
    expect(gain(IS350, 'head-2gr-ported')).toBeGreaterThan(1);
    expect(gain(IS350, 'head-2gr-ported')).toBeLessThan(gain(Z350, 'head-v6-ported'));
  });
});

describe('ECU only moves the cut; the mechanical limit comes from springs and internals', () => {
  it('raises the cut within the factory valve train and never above the mechanical limit it declares', () => {
    const stock = build(Z370, []);
    const ecu = build(Z370, ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-vq37-s2']);
    expect(ecu.car.engine.revLimitRpm).toBeGreaterThan(stock.car.engine.revLimitRpm);
    expect(ecu.car.engine.revLimitRpm - stock.car.engine.revLimitRpm).toBeLessThanOrEqual(300);
  });
  it('the Dyno ceiling does not move with the ECU, only with springs', () => {
    const ecuParts = ['filter-v6-dual', 'exhaust-v6-sport', 'ecu-vq37-comp'];
    const withEcu = reliabilityLimits(build(Z370, ecuParts).car, ecuParts);
    const withSprings = reliabilityLimits(build(Z370, [...ecuParts, 'valve-springs-v6-comp']).car, [...ecuParts, 'valve-springs-v6-comp']);
    expect(withSprings.maxSafeRpm).toBeGreaterThanOrEqual(withEcu.maxSafeRpm + 700);
    expect(withSprings.recommendedSafeRpm).toBeGreaterThan(withEcu.recommendedSafeRpm);
    // springs alone add no power
    const sp = build(Z370, ['valve-springs-v6-comp']);
    expect(sp.peakPowerCv).toBeCloseTo(build(Z370, []).peakPowerCv, 1);
  });
  it('a calibrated map refuses to be installed without the hardware it is made for', () => {
    expect(errors(Z370, ['ecu-vq37-s2']).join(' ')).toMatch(/exige a admissão/);
    expect(errors(Z350, ['cam-vq35-s2']).join(' ')).toMatch(/exige as molas/);
    expect(errors(Z370, ['vvel-370z-comp']).join(' ')).toMatch(/molas de válvula de competição/);
  });
  it('a map of another engine does not fit', () => {
    expect(incompatibility(car(IS350), findPart('ecu-vq35-s2')!)).toMatch(/não é feita para/);
  });
});

describe('compression and fuel', () => {
  it('high-compression pistons fit the VQ35 but not the 11.8:1 2GR-FSE (knock on pump fuel)', () => {
    expect(errors(Z350, ['pistons-v6-hcr']).length).toBe(0);
    expect(errors(IS350, ['pistons-v6-hcr']).join(' ')).toMatch(/detona/);
    expect(build(Z350, ['pistons-v6-hcr']).car.engine.compressionRatio).toBeCloseTo(11.1, 5);
  });
  it('light rods lower the inertia of the rotating assembly', () => {
    expect(build(Z350, ['rods-v6-light']).car.engine.inertiaKgM2).toBeLessThan(car(Z350).engine.inertiaKgM2);
  });
  it('the balanced crank lowers friction', () => {
    const r = build(Z350, ['crank-balanced-v6']);
    expect(r.car.engine.friction.coulombNm).toBeLessThan(car(Z350).engine.friction.coulombNm);
    expect(r.peakPowerCv).toBeGreaterThan(build(Z350, []).peakPowerCv);
  });
});
