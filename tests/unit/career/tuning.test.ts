/** Career parts and the Vehicle Build Resolver: physical effects and build rules. */
import { describe, expect, it } from 'vitest';
import { MonotoneCubic } from '../../../src/core/math';
import { CAR_VW_GOL_GTS_1988 } from '../../../src/data/cars/vwGolGts1988';
import { CAR_FIAT_UNO_MILLE_1995 } from '../../../src/data/cars/fiatUnoMille1995';
import { CAR_VW_SAVEIRO_GL_1994 } from '../../../src/data/cars/vwSaveiroGl1994';
import { CAR_GM_CELTA_2003 } from '../../../src/data/cars/gmCelta2003';
import type { CarConfig } from '../../../src/data/schema';
import { buildKey, resolveBuild, resolveBuildOrThrow } from '../../../src/game/career/tuning/BuildResolver';
import { PARTS } from '../../../src/game/career/tuning/parts';
import { EngineDyno } from '../../../src/physics/engine/EngineDyno';

const at = (car: CarConfig, rpm: number): number => new MonotoneCubic(car.engine.torqueCurve.rpm, car.engine.torqueCurve.torqueNm).evaluate(rpm);
const ok = (base: CarConfig, ids: string[]) => {
  const r = resolveBuild(base, ids);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r;
};

describe('parts catalogue', () => {
  it('has the brief prices and describes the physics of every part', () => {
    const price = Object.fromEntries(PARTS.map((p) => [p.id, p.price]));
    expect(price).toEqual({
      'filter-sport': 250,
      'exhaust-sport': 450,
      'manifold-sport': 650,
      'cam-sport': 900,
      'clutch-reinforced': 900,
      'tires-sport': 1000,
      'differential-short': 1200,
      'tires-semislick': 1600,
      'turbo-basic': 4000,
    });
    for (const p of PARTS) expect(p.physics.length).toBeGreaterThan(20);
  });
});

describe('build resolver rules', () => {
  it('stock build keeps the documented curve and leaves the base car untouched', () => {
    const before = JSON.stringify(CAR_FIAT_UNO_MILLE_1995);
    const r = ok(CAR_FIAT_UNO_MILLE_1995, []);
    expect(r.car.engine.torqueCurve).toEqual(CAR_FIAT_UNO_MILLE_1995.engine.torqueCurve);
    expect(r.car.tires).toEqual(CAR_FIAT_UNO_MILLE_1995.tires);
    expect(JSON.stringify(CAR_FIAT_UNO_MILLE_1995)).toBe(before);
    expect(Object.isFrozen(r.car.engine.torqueCurve)).toBe(true);
  });

  it('is independent of install order and idempotent', () => {
    const a = ok(CAR_VW_SAVEIRO_GL_1994, ['cam-sport', 'filter-sport', 'tires-sport', 'exhaust-sport']);
    const b = ok(CAR_VW_SAVEIRO_GL_1994, ['exhaust-sport', 'tires-sport', 'filter-sport', 'cam-sport', 'filter-sport']);
    expect(JSON.stringify(b.car)).toBe(JSON.stringify(a.car));
    expect(buildKey('x', ['b', 'a', 'a'])).toBe(buildKey('x', ['a', 'b']));
  });

  it('removing a part restores the base values exactly', () => {
    const stock = ok(CAR_VW_SAVEIRO_GL_1994, []).car;
    ok(CAR_VW_SAVEIRO_GL_1994, ['differential-short', 'tires-semislick', 'cam-sport']);
    const back = ok(CAR_VW_SAVEIRO_GL_1994, []).car;
    expect(JSON.stringify(back)).toBe(JSON.stringify(stock));
    const onlyCam = ok(CAR_VW_SAVEIRO_GL_1994, ['cam-sport']).car;
    expect(onlyCam.transmission.finalDrive).toBe(CAR_VW_SAVEIRO_GL_1994.transmission.finalDrive);
    expect(onlyCam.tires).toEqual(CAR_VW_SAVEIRO_GL_1994.tires);
  });

  it('tyres replace tyres (two tyre sets is an invalid build)', () => {
    const r = resolveBuild(CAR_VW_SAVEIRO_GL_1994, ['tires-sport', 'tires-semislick']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/só cabe uma peça em Pneus/);
    const semi = ok(CAR_VW_SAVEIRO_GL_1994, ['tires-semislick']).car;
    expect(semi.tires.muPeak).toBe(1.32);
    expect(semi.tires.wheelInertiaKgM2).toBeCloseTo(CAR_VW_SAVEIRO_GL_1994.tires.wheelInertiaKgM2 + 0.15, 9);
    expect(semi.tires.radiusM).toBe(CAR_VW_SAVEIRO_GL_1994.tires.radiusM);
    expect(semi.visual.mods?.tyre).toBe('semiSlick');
  });

  it('rejects unknown parts with a message', () => {
    const r = resolveBuild(CAR_VW_SAVEIRO_GL_1994, ['nitro']);
    expect(r).toEqual({ ok: false, errors: ['peça desconhecida: nitro'] });
    expect(() => resolveBuildOrThrow(CAR_VW_SAVEIRO_GL_1994, ['nitro'])).toThrow(/peça desconhecida/);
  });
});

describe('physical effects', () => {
  const base = ok(CAR_VW_SAVEIRO_GL_1994, []).car;

  it('the filter and the exhaust gain most at high flow (top end), little at low rpm', () => {
    for (const id of ['filter-sport', 'exhaust-sport']) {
      const c = ok(CAR_VW_SAVEIRO_GL_1994, [id]).car;
      const lowGain = at(c, 1800) / at(base, 1800) - 1;
      const highGain = at(c, 5600) / at(base, 5600) - 1;
      expect(highGain).toBeGreaterThan(0.02);
      expect(highGain).toBeGreaterThan(lowGain * 3);
      expect(highGain).toBeLessThan(0.08);
    }
    const ex = ok(CAR_VW_SAVEIRO_GL_1994, ['exhaust-sport']).car;
    expect(ex.engine.breathing!.exhaustBackPressureKPa).toBe(7);
    expect(ex.exhaust.presetId).toBe('sport');
    expect(ex.visual.mods?.sportTip).toBe(true);
  });

  it('the cam trades low-speed torque for top end and a higher limiter', () => {
    const c = ok(CAR_VW_SAVEIRO_GL_1994, ['cam-sport']).car;
    expect(at(c, 2000)).toBeLessThan(at(base, 2000));
    expect(at(c, 5800)).toBeGreaterThan(at(base, 5800) * 1.05);
    expect(c.engine.revLimitRpm).toBe(base.engine.revLimitRpm + 400);
  });

  it('the intake manifold moves the ram-tuning bump up in rpm', () => {
    const c = ok(CAR_VW_SAVEIRO_GL_1994, ['manifold-sport']).car;
    expect(at(c, 2400)).toBeLessThan(at(base, 2400));
    expect(at(c, 4600)).toBeGreaterThan(at(base, 4600));
  });

  it('the turbo makes boost from exhaust flow, needs the clutch and adds the kit mass', () => {
    const noClutch = resolveBuild(CAR_VW_SAVEIRO_GL_1994, ['turbo-basic']);
    expect(noClutch.ok).toBe(false);
    if (!noClutch.ok) expect(noClutch.errors[0]).toMatch(/embreagem reforçada/);
    const r = ok(CAR_VW_SAVEIRO_GL_1994, ['turbo-basic', 'clutch-reinforced']);
    expect(r.car.engine.induction).toBe('turbo');
    expect(r.car.massKg).toBe(base.massKg + 18);
    expect(r.car.visual.mods?.intercooler).toBe(true);
    // boost builds with engine speed (spool), never a flat multiplier
    const b = r.steadyBoostBar;
    expect(b.find((p) => p.rpm === 1000)!.bar).toBeLessThan(0.3);
    expect(Math.max(...b.map((p) => p.bar))).toBeCloseTo(0.6, 1);
    expect(r.peakPowerCv / 88).toBeGreaterThan(1.3);
    expect(r.peakPowerCv / 88).toBeLessThan(1.65);
  });

  it('high-compression petrol engines cannot take the turbo kit', () => {
    const r = resolveBuild(CAR_GM_CELTA_2003, ['turbo-basic', 'clutch-reinforced']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/taxa de compressão 12,6:1 a gasolina/);
  });

  it('the dyno measures the resolved curve (the physics really changed)', () => {
    const r = ok(CAR_VW_GOL_GTS_1988, ['turbo-basic', 'clutch-reinforced', 'exhaust-sport']);
    const d = new EngineDyno(r.car.engine);
    expect(d.start()).toBe(true);
    d.measure(4800, 1, 1 / 120, 3, 0.2); // spool the turbo first
    const m = d.measure(5600, 1, 1 / 120, 4, 0.4);
    expect(Math.abs(m.torqueNm - at(r.car, 5600)) / at(r.car, 5600)).toBeLessThan(0.02);
    expect(m.powerCv).toBeGreaterThan(130);
  });

  it('clutch and differential change the driveline only', () => {
    const c = ok(CAR_VW_SAVEIRO_GL_1994, ['clutch-reinforced', 'differential-short']).car;
    expect(c.transmission.clutch.maxTorqueNm).toBe(Math.round(235 * 1.5));
    expect(c.transmission.finalDrive).toBeCloseTo(4.111 * 1.12, 3);
    expect(c.engine.torqueCurve).toEqual(base.engine.torqueCurve);
  });
});
