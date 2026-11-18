/** Turbo conversion of the aspirated V6: induction from the hardware, kit profiles, compression, internals. */
import { describe, expect, it } from 'vitest';
import { MonotoneCubic } from '../../../../src/core/math';
import { incompatibility } from '../../../../src/game/career/tuning/BuildResolverV2';
import { findPart } from '../../../../src/game/career/tuning/parts';
import { build, car, errors, IS350, Z350, Z370 } from './_helpers';

const base370 = ['forged-v6-turbo', 'fuel-v6-highflow', 'oil-system-street', 'clutch-v6-comp'];
const at = (r: ReturnType<typeof build>, rpm: number): number => new MonotoneCubic(r.car.engine.torqueCurve.rpm, r.car.engine.torqueCurve.torqueNm).evaluate(rpm);
const boostAt = (r: ReturnType<typeof build>, rpm: number): number => r.steadyBoostBar.reduce((best, p) => (Math.abs(p.rpm - rpm) < Math.abs(best.rpm - rpm) ? p : best)).bar;

describe('conversion changes the resolved induction and removing the kit restores it', () => {
  it('turns the 370Z into a turbo car and back, without touching the catalogue', () => {
    const before = JSON.stringify(car(Z370));
    const stock = build(Z370, []);
    const conv = build(Z370, ['turbo-vq37-street', 'fuel-v6-injectors', 'clutch-v6-comp']);
    expect(conv.car.engine.induction).toBe('turbo');
    expect(conv.car.engine.turbo?.maxBoostBar).toBeGreaterThan(0);
    expect(conv.diagnostics).toMatchObject({ factoryInduction: 'NA', currentInduction: 'turbo' });
    const back = build(Z370, ['clutch-v6-comp']);
    expect(back.car.engine.induction).toBe('NA');
    expect(back.car.engine.torqueCurve).toEqual(stock.car.engine.torqueCurve);
    expect(JSON.stringify(car(Z370))).toBe(before);
  });
  it('a converted car makes more power than the aspirated one on the same fuel and internals', () => {
    const conv = build(Z370, ['turbo-vq37-street', 'fuel-v6-injectors', 'clutch-v6-comp']);
    expect(conv.peakPowerCv).toBeGreaterThan(build(Z370, []).peakPowerCv * 1.2);
  });
});

describe('turbine profiles respond differently', () => {
  it('the small turbo fills earlier, the big one makes more power at the top', () => {
    const street = build(Z370, ['turbo-vq37-street', ...base370]);
    const big = build(Z370, ['turbo-vq37-highflow', ...base370]);
    expect(boostAt(street, 3000)).toBeGreaterThan(boostAt(big, 3000));
    expect(big.peakPowerCv).toBeGreaterThan(street.peakPowerCv);
    expect(big.car.engine.turbo!.spoolTimeS).toBeGreaterThan(street.car.engine.turbo!.spoolTimeS);
  });
  it('the twin turbo is two parallel rotors, one per bank, and spools faster than the big single', () => {
    const twin = build(Z370, ['turbo-vq37-twin-comp', ...base370]);
    const big = build(Z370, ['turbo-vq37-highflow', ...base370]);
    expect(twin.car.engine.turbo!.layout).toBe('parallel-twin');
    expect(big.car.engine.turbo!.layout).toBeUndefined();
    expect(twin.car.engine.turbo!.spoolTimeS).toBeLessThan(big.car.engine.turbo!.spoolTimeS);
    expect(at(twin, 3000)).toBeGreaterThan(0);
  });
  it('the compressor runs out of flow: boost falls with rpm on the small turbo', () => {
    const street = build(Z370, ['turbo-vq37-street', ...base370]);
    expect(boostAt(street, 7000)).toBeLessThan(Math.max(...street.steadyBoostBar.map((p) => p.bar)) - 0.01);
  });
});

describe('compression, internals and compatibility', () => {
  it('refuses a high-compression engine on a high-flow kit and says which part fixes it', () => {
    expect(errors(Z370, ['turbo-vq37-highflow', 'fuel-v6-highflow', 'clutch-v6-comp']).join(' ')).toMatch(/taxa de compressão.*pistões forjados de baixa compressão/);
    expect(build(Z370, ['turbo-vq37-highflow', ...base370]).car.engine.compressionRatio).toBeLessThan(10);
  });
  it('refuses a kit of another engine', () => {
    expect(incompatibility(car(Z350), findPart('turbo-vq37-street')!)).toMatch(/não é feita para/);
    expect(incompatibility(car(IS350), findPart('turbo-vq35-street')!)).toMatch(/não é feita para/);
  });
  it('refuses the stock internals when the torque outgrows them', () => {
    const stockInternals = ['turbo-vq35-street', 'ecu-vq35-comp', 'filter-v6-dual', 'exhaust-v6-sport', 'fuel-v6-highflow', 'oil-system-street', 'clutch-v6-comp'];
    expect(errors(Z350, stockInternals, { boostBar: 0.65 }).join(' ')).toMatch(/pistões e bielas aguentam/);
    expect(errors(Z350, [...stockInternals, 'forged-v6-turbo'], { boostBar: 0.65 }).length).toBe(0);
  });
  it('refuses a gearbox that cannot carry the torque', () => {
    expect(errors(Z370, ['turbo-vq37-balanced', 'forged-v6-turbo', 'fuel-v6-highflow', 'oil-system-street']).join(' ')).toMatch(/embreagem/);
  });
  it('parts of the factory turbo do not fit a converted engine, and aspirated maps do not either', () => {
    const kit = ['turbo-vq37-street', 'fuel-v6-highflow', 'clutch-v6-comp'];
    expect(errors(Z370, [...kit, 'ecu-stage1']).join(' ')).toMatch(/turbo de fábrica/);
    expect(errors(Z370, [...kit, 'ecu-vq37-s2', 'filter-v6-dual', 'exhaust-v6-sport']).join(' ')).toMatch(/aspirado/);
    // but the programmable central, the intercooler and the free-flow parts do
    expect(errors(Z370, [...kit, 'forged-v6-turbo', 'oil-system-street', 'ecu-vq37-comp', 'filter-v6-dual', 'exhaust-v6-sport', 'intercooler-comp']).length).toBe(0);
  });
  it('the intercooler lowers the charge temperature through knock: less retard than the kit core', () => {
    const kit = ['turbo-vq37-balanced', ...base370];
    const plain = build(Z370, kit);
    const ic = build(Z370, [...kit, 'intercooler-comp']);
    expect(ic.knockLoss).toBeLessThan(plain.knockLoss);
    expect(ic.peakPowerCv).toBeGreaterThan(plain.peakPowerCv);
  });
  it('the 2GR-FSE (direct injection) takes the kit with the high-pressure pump', () => {
    const r = build(IS350, ['turbo-2gr-balanced', 'forged-v6-turbo', 'fuel-v6-highflow', 'fuel-hp-pump', 'oil-system-street', 'at-upgrade-s2']);
    expect(r.car.engine.induction).toBe('turbo');
    expect(r.diagnostics?.fuel?.limiter).toBeDefined();
  });
  it('has no NaN anywhere in a converted curve', () => {
    for (const k of ['street', 'balanced', 'highflow']) {
      const r = build(Z370, [`turbo-vq37-${k}`, ...base370]);
      for (const t of r.car.engine.torqueCurve.torqueNm) expect(Number.isFinite(t)).toBe(true);
      for (const b of r.steadyBoostBar) expect(Number.isFinite(b.bar)).toBe(true);
    }
  });
});
