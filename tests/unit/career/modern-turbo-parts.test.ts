import { describe, expect, it } from 'vitest';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import type { CarConfig } from '../../../src/data/schema';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility, transmissionKindOf } from '../../../src/game/career/tuning/BuildResolverV2';
import { MODERN_INTERCOOLER_PARTS, MODERN_TURBO_PARTS } from '../../../src/game/career/tuning/modernTurboParts';

const factoryTurboCars = [...CHAPTER2_CARS, ...CHAPTER3_CARS].filter((car) => car.engine.induction === 'turbo');

function supportFor(car: CarConfig): string[] {
  const family = car.engine.family!;
  const kind = transmissionKindOf(car);
  const transmission = kind === 'manual' ? 'clutch-reinforced' : kind === 'dual-clutch' ? 'dct-upgrade' : 'at-upgrade';
  return ['ecu-programmable', 'intercooler-race', `fuel-${family}-s3`, `rotating-assembly-${family}-s3`, transmission];
}

describe('turbinas para motores com turbo de fábrica', () => {
  it.each(factoryTurboCars.map((car) => [car.id, car] as const))('%s instala três turbinas com a mesma calibração de ECU', (_, car) => {
    const turbos = MODERN_TURBO_PARTS.filter((part) => !incompatibility(car, part));
    expect(turbos.map((part) => part.factoryTurboStage)).toEqual([1, 2, 3]);
    const support = supportFor(car);
    const original = resolveBuild(car, support, {}, 2);
    if (!original.ok) throw new Error(original.errors.join('\n'));
    let restriction = original.exhaustRestrictionKPa!;
    for (const turbo of turbos) {
      const built = resolveBuild(car, [...support, turbo.id], {}, 2);
      if (!built.ok) throw new Error(`${turbo.id}: ${built.errors.join('\n')}`);
      expect(built.exhaustRestrictionKPa).toBeLessThan(restriction);
      expect(built.car.engine.turbo!.maxBoostBar).toBe(original.car.engine.turbo!.maxBoostBar);
      expect(built.car.engine.turbo!.layout).toBe(car.engine.turbo!.layout);
      expect(built.car.engine.turbo!.compressorBlades).toBe(turbo.compressorBlades);
      expect(built.car.engine.turbo!.spoolTimeS).toBeLessThan(car.engine.turbo!.spoolTimeS);
      expect(built.chargeTemperatureAtTargetK).toBeLessThan(original.chargeTemperatureAtTargetK!);
      restriction = built.exhaustRestrictionKPa!;
    }
  }, 60_000);

  it('preserva o mapa original no primeiro estágio e exige hardware de competição no último', () => {
    const bmw = factoryTurboCars.find((car) => car.engine.family === 'bmw-n20')!;
    const [street, hybrid, race] = MODERN_TURBO_PARTS.filter((part) => !incompatibility(bmw, part));
    const simple = resolveBuild(bmw, [street!.id], {}, 2);
    expect(simple.ok && simple.car.engine.turbo?.maxBoostBar).toBe(bmw.engine.turbo?.maxBoostBar);
    expect(resolveBuild(bmw, [hybrid!.id], {}, 2).ok).toBe(false);
    const missing = resolveBuild(bmw, [race!.id], {}, 2);
    expect(missing.ok ? [] : missing.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('ECU programável'),
      expect.stringContaining('pistões'),
      expect.stringContaining('intercooler'),
      expect.stringContaining('alimentação'),
    ]));
    const old = ['ecu-map-bmw-n20-s3', 'fuel-bmw-n20-s3', 'downpipe-catless', 'pistons-forged-modern', 'intercooler-race', 'at-upgrade'];
    expect(resolveBuild(bmw, [...old, 'turbo-hybrid'], {}, 2).ok).toBe(true);
    const staged = [...supportFor(bmw).filter((id) => id !== 'ecu-programmable'), 'ecu-map-bmw-n20-s3', 'downpipe-catless', race!.id];
    const prepared = resolveBuild(bmw, staged, {}, 2);
    if (!prepared.ok) throw new Error(prepared.errors.join('\n'));
  }, 60_000);

  it('reduz a temperatura da carga no biturbo e deixa usar o intercooler equivalente no remap', () => {
    const c43 = factoryTurboCars.find((car) => car.engine.family === 'mercedes-m276')!;
    const options = MODERN_INTERCOOLER_PARTS.filter((part) => !incompatibility(c43, part));
    expect(options).toHaveLength(3);
    const original = resolveBuild(c43, [], {}, 2);
    if (!original.ok) throw new Error(original.errors.join('\n'));
    let lastTemperature = original.chargeTemperatureAtTargetK!;
    for (const cooler of options) {
      const result = resolveBuild(c43, [cooler.id], {}, 2);
      if (!result.ok) throw new Error(result.errors.join('\n'));
      expect(result.car.engine.turbo?.layout).toBe('parallel-twin');
      expect(result.chargeTemperatureAtTargetK).toBeLessThan(lastTemperature);
      expect(result.car.engine.intake.manifoldVolumeL).toBeGreaterThan(original.car.engine.intake.manifoldVolumeL);
      lastTemperature = result.chargeTemperatureAtTargetK!;
    }
    const support = ['ecu-map-mercedes-m276-s2', 'fuel-mercedes-m276-s1', 'downpipe-catless', 'pistons-forged-modern', 'at-upgrade'];
    const built = resolveBuild(c43, [...support, options[1]!.id], {}, 2);
    if (!built.ok) throw new Error(built.errors.join('\n'));
  }, 60_000);
});
