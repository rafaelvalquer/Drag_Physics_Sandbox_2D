import { describe, expect, it } from 'vitest';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { MODERN_IGNITION_PARTS } from '../../../src/game/career/tuning/modernIgnitionParts';

const modern = [...CHAPTER2_CARS, ...CHAPTER3_CARS];

describe('ignição por arquitetura de motor', () => {
  it.each(modern.map((car) => [car.id, car] as const))('%s reduz a duração da queima a cada estágio', (_, car) => {
    const options = MODERN_IGNITION_PARTS.filter((part) => !incompatibility(car, part));
    expect(options).toHaveLength(3);
    let previous = car.engine.combustion.burnDurationDeg;
    for (const part of options) {
      const built = resolveBuild(car, [part.id], {}, 2);
      if (!built.ok) throw new Error(built.errors.join('\n'));
      expect(built.car.engine.combustion.burnDurationDeg).toBeCloseTo(car.engine.combustion.burnDurationDeg * part.burnDurationScale);
      expect(built.car.engine.combustion.burnDurationDeg).toBeLessThan(previous);
      expect(built.car.engine.compressionRatio).toBe(car.engine.compressionRatio);
      expect(built.car.engine.revLimitRpm).toBe(car.engine.revLimitRpm);
      previous = built.car.engine.combustion.burnDurationDeg;
    }
  }, 60_000);

  it('reduz a perda por atraso de centelha em pressão sem aumentar a pressão alvo', () => {
    const golf = modern.find((car) => car.id === 'vw-golf-gti-mk4-2003')!;
    const support = ['ecu-programmable', 'boost-control', 'clutch-reinforced'];
    const tune = { boostBar: 1.15 };
    const original = resolveBuild(golf, support, tune, 2);
    if (!original.ok) throw new Error(original.errors.join('\n'));
    expect(original.knockLoss).toBeGreaterThan(0);
    let previous = original.knockLoss;
    for (const part of MODERN_IGNITION_PARTS.filter((p) => !incompatibility(golf, p))) {
      const built = resolveBuild(golf, [...support, part.id], tune, 2);
      if (!built.ok) throw new Error(built.errors.join('\n'));
      expect(built.knockLoss).toBeLessThan(previous);
      expect(built.car.engine.turbo?.maxBoostBar).toBe(original.car.engine.turbo?.maxBoostBar);
      previous = built.knockLoss;
    }
  }, 60_000);
});
