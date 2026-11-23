import { describe, expect, it } from 'vitest';
import { CHAPTER1_CARS } from '../../../src/data/cars/campaign';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility, familyOf } from '../../../src/game/career/tuning/BuildResolverV2';
import { progressionOf } from '../../../src/game/career/tuning/partProgression';
import { ALL_PARTS, findPart } from '../../../src/game/career/tuning/parts';

const ordinary = CHAPTER1_CARS.filter((car) => car.id !== 'gm-celta-2003');
const celta = CHAPTER1_CARS.find((car) => car.id === 'gm-celta-2003')!;

describe('taxa dos clássicos por tipo de preparação', () => {
  it.each(ordinary.map((car) => [car.id, car] as const))('%s progride em eficiência aspirada e margem de detonação turbo', (_, car) => {
    const parts = (group: string) => ALL_PARTS.filter((part) =>
      progressionOf(part, familyOf(car), car.id)?.group === group && !incompatibility(car, part))
      .sort((a, b) => progressionOf(a)!.tier - progressionOf(b)!.tier);
    const resolve = (ids: string[], boostBar?: number) => {
      const result = resolveBuild(car, ids, boostBar === undefined ? {} : { boostBar }, 1);
      if (!result.ok) throw new Error(result.errors.join('\n'));
      return result;
    };
    const aspirated = parts('classic-na-compression');
    expect(aspirated).toHaveLength(3);
    let previous = resolve([]);
    for (const part of aspirated) {
      const next = resolve([part.id]);
      expect(next.car.engine.compressionRatio).toBeGreaterThan(previous.car.engine.compressionRatio);
      expect(next.peakPowerCv).toBeGreaterThan(previous.peakPowerCv);
      previous = next;
    }
    const boosted = parts('classic-turbo-compression');
    expect(boosted).toHaveLength(3);
    const support = ['turbo-basic', 'clutch-ceramic-race'];
    previous = resolve(support, 0.8);
    for (const part of boosted) {
      expect(resolveBuild(car, [part.id], {}, 1).ok).toBe(false);
      const next = resolve([...support, part.id], 0.8);
      expect(next.car.engine.turbo?.maxBoostBar).toBe(0.8);
      expect(next.car.engine.compressionRatio).toBeLessThan(previous.car.engine.compressionRatio);
      expect(next.knockLoss).toBeLessThan(previous.knockLoss);
      previous = next;
    }
  });

  it('preserva a taxa alta legada do Celta e reserva a série VHC para a conversão', () => {
    const oldPart = findPart('compression-high')!;
    expect(progressionOf(oldPart, familyOf(celta), celta.id)).toBeUndefined();
    expect(resolveBuild(celta, [oldPart.id], {}, 1).ok).toBe(true);
    expect(incompatibility(celta, findPart('compression-low')!)).not.toBeNull();
    expect(ALL_PARTS.filter((part) => progressionOf(part)?.group === 'celta-turbo-compression' && !incompatibility(celta, part)))
      .toHaveLength(3);
  });
});
