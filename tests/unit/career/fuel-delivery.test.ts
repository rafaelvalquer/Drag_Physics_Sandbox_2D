import { describe, expect, it } from 'vitest';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { EngineModel } from '../../../src/physics/engine/EngineModel';
import { EngineDyno } from '../../../src/physics/engine/EngineDyno';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { factoryFuelSupply, peakFuelDemandKgS } from '../../../src/game/career/tuning/fuelDelivery';
import { MODERN_FUEL_PARTS } from '../../../src/game/career/tuning/modernFuelParts';

const modern = [...CHAPTER2_CARS, ...CHAPTER3_CARS];

describe('capacidade de alimentação', () => {
  it.each(modern.map((car) => [car.id, car] as const))('%s oferece três capacidades progressivas', (_, car) => {
    const options = MODERN_FUEL_PARTS.filter((part) => !incompatibility(car, part));
    expect(options.map((part) => part.progression?.tier)).toEqual([1, 2, 3]);
    const reference = factoryFuelSupply(car.engine);
    let previous = reference.maxFuelKgS;
    const stock = resolveBuild(car, [], {}, 2);
    if (!stock.ok) throw new Error(stock.errors.join('; '));
    for (const part of options) {
      const result = resolveBuild(car, [part.id], {}, 2);
      if (!result.ok) throw new Error(result.errors.join('; '));
      expect(result.car.engine.fueling!.maxFuelKgS).toBeGreaterThan(previous);
      expect(result.car.engine.fueling!.airFuelRatio).toBe(reference.airFuelRatio);
      expect(result.car.engine.torqueCurve).toEqual(stock.car.engine.torqueCurve);
      previous = result.car.engine.fueling!.maxFuelKgS;
    }
    expect(stock.car.engine.fueling).toBeUndefined();
  });

  it.each(['vw-jetta-tsi-2012', 'lexus-is350-2015'])('limita a combustão à mistura comandada do %s', (id) => {
    const car = modern.find((entry) => entry.id === id)!;
    const reference = factoryFuelSupply(car.engine);
    const powerRpm = car.engine.revLimitRpm - 200;
    const open = new EngineModel(car.engine).wotOperatingPoint(powerRpm);
    const limitedConfig = {
      ...car.engine,
      fueling: { ...reference, maxFuelKgS: 0.7 * open.flow / reference.airFuelRatio },
    };
    const limited = new EngineModel(limitedConfig).wotOperatingPoint(powerRpm);
    expect(limited.flow).toBeLessThanOrEqual(open.flow + 1e-6);
    expect(limited.indicatedNm).toBeLessThan(0.8 * open.indicatedNm);
    expect(reference.maxFuelKgS).toBeGreaterThan(peakFuelDemandKgS(car.engine, reference.airFuelRatio));

    const normalDyno = new EngineDyno(car.engine);
    const restrictedDyno = new EngineDyno(limitedConfig);
    expect(normalDyno.start()).toBe(true);
    expect(restrictedDyno.start()).toBe(true);
    const good = normalDyno.measure(powerRpm, 1, 1 / 120, 6, 0.4);
    const leanProtection = restrictedDyno.measure(powerRpm, 1, 1 / 120, 6, 0.4);
    expect(leanProtection.torqueNm).toBeLessThan(0.85 * good.torqueNm);
  });

  it('rejeita um conjunto abaixo da demanda e aceita o estágio de maior vazão', () => {
    const car = modern.find((entry) => entry.id === 'lexus-is350-2015')!;
    const supply = factoryFuelSupply(car.engine);
    const demand = peakFuelDemandKgS(car.engine, supply.airFuelRatio);
    const bench = {
      ...car,
      id: 'lexus-is350-fuel-bench',
      engine: { ...car.engine, fueling: { ...supply, maxFuelKgS: demand * 0.76 } },
    };
    const intake = 'intake-airbox-toyota-2gr-fse-s1';
    expect(resolveBuild(bench, [intake, 'fuel-toyota-2gr-fse-s1'], {}, 2))
      .toMatchObject({ ok: false, errors: [expect.stringMatching(/Alimentação insuficiente/)] });
    expect(resolveBuild(bench, [intake, 'fuel-toyota-2gr-fse-s3'], {}, 2)).toMatchObject({ ok: true });
  });
});
