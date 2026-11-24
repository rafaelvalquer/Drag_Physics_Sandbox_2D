import { describe, expect, it } from 'vitest';
import { CHAPTER1_CARS, CAREER_CARS } from '../../../src/data/cars/campaign';
import { CareerController } from '../../../src/game/career/CareerController';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { familyOf } from '../../../src/game/career/tuning/BuildResolverV2';
import { progressionOf } from '../../../src/game/career/tuning/partProgression';
import { ALL_PARTS, findPart } from '../../../src/game/career/tuning/parts';

const series = [
  ['classic-clutch', 'clutch'],
  ['classic-final-drive', 'differential'],
  ['classic-manual-gearbox', 'transmission-gearbox'],
] as const;

describe('transmissão dos clássicos em três estágios', () => {
  it.each(CHAPTER1_CARS.map((car) => [car.id, car] as const))('%s aplica e substitui as peças de cada série', (_, car) => {
    const stock = resolveBuild(car, [], {}, 1);
    if (!stock.ok) throw new Error(stock.errors.join('\n'));
    for (const [group, category] of series) {
      const parts = ALL_PARTS.filter((part) => progressionOf(part, familyOf(car))?.group === group)
        .sort((a, b) => progressionOf(a)!.tier - progressionOf(b)!.tier);
      expect(parts.map((part) => progressionOf(part)!.tier)).toEqual([1, 2, 3]);
      expect(parts.every((part) => part.category === category)).toBe(true);
      let previous = stock;
      for (const part of parts) {
        const resolved = resolveBuild(car, [part.id], {}, 1);
        if (!resolved.ok) throw new Error(resolved.errors.join('\n'));
        const before = previous.car.transmission;
        const after = resolved.car.transmission;
        if (category === 'clutch') {
          expect(after.clutch.maxTorqueNm).toBeGreaterThan(before.clutch.maxTorqueNm);
          expect(after.clutch.engageRatePerS).toBeGreaterThan(before.clutch.engageRatePerS);
        } else {
          expect(after.efficiency).toBeGreaterThan(before.efficiency);
          expect(after.gearRatios[0]).toBe(before.gearRatios[0]);
          expect(after.gearRatios.at(-1)).toBe(before.gearRatios.at(-1));
        }
        expect(resolved.peakPowerCv).toBeCloseTo(stock.peakPowerCv);
        const replaced = previous.parts[0]?.id ?? null;
        expect(CareerController.withPart(replaced ? [replaced] : [], part.id)).toEqual({ parts: [part.id], replaced });
        previous = resolved;
      }
    }
  });

  it('embreagem e diferencial clássicos ficam só nos clássicos: os modernos têm as próprias séries Stage', () => {
    const golf = CAREER_CARS.find((car) => car.engine.family === 'vw-ea113')!;
    for (const [classic, stage1] of [['clutch-reinforced', 'clutch-vw-ea113-s1'], ['differential-short', 'final-drive-vw-ea113-s1']]) {
      expect(progressionOf(findPart(classic)!, familyOf(golf))).toBeUndefined();
      expect(resolveBuild(golf, [classic], {}, 2).ok, classic).toBe(false);
      expect(resolveBuild(golf, [stage1], {}, 2).ok, stage1).toBe(true);
    }
  });
});
