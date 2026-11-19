import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { CareerController } from '../../../src/game/career/CareerController';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { ALL_PARTS } from '../../../src/game/career/tuning/parts';
import { progressionOf } from '../../../src/game/career/tuning/partProgression';
import { careerResolverVersion } from '../../../src/game/career/tuning/resolverVersion';

const groups = ['tire-compound', 'tire-width', 'tire-pressure', 'weight-reduction', 'launch-suspension'];

describe('progressão de pneus, estrutura e suspensão', () => {
  it.each(CAREER_CARS.map((car) => [car.id, car] as const))('%s instala três níveis por categoria', (_, car) => {
    const version = careerResolverVersion(car.id);
    for (const group of groups) {
      const stages = ALL_PARTS.filter((part) => progressionOf(part)?.group === group && !incompatibility(car, part))
        .sort((a, b) => progressionOf(a)!.tier - progressionOf(b)!.tier);
      expect(stages.map((part) => progressionOf(part)!.tier), group).toEqual([1, 2, 3]);
      const stock = resolveBuild(car, [], {}, version);
      if (!stock.ok) throw new Error(stock.errors.join('\n'));
      let previous = stock.car;
      for (const stage of stages) {
        const result = resolveBuild(car, [stage.id], {}, version);
        if (!result.ok) throw new Error(`${stage.id}: ${result.errors.join('\n')}`);
        const next = result.car;
        if (group === 'tire-width') {
          expect(next.tires.muPeak).toBeGreaterThan(previous.tires.muPeak);
          expect(next.tires.wheelInertiaKgM2).toBeGreaterThan(previous.tires.wheelInertiaKgM2);
        }
        if (group === 'tire-pressure') expect(next.tires.rollingResistance).toBeLessThan(previous.tires.rollingResistance);
        if (group === 'weight-reduction' || group === 'launch-suspension') expect(next.massKg).toBeLessThan(previous.massKg);
        if (group === 'launch-suspension') {
          const direction = car.drivenAxle === 'front' ? -1 : 1;
          expect((next.cgHeightM - previous.cgHeightM) * direction).toBeGreaterThan(0);
        }
        expect(next.engine.torqueCurve).toEqual(stock.car.engine.torqueCurve);
        previous = next;
      }
      expect(CareerController.withPart([stages[0]!.id], stages[1]!.id).replaced).toBe(stages[0]!.id);
    }
  }, 60_000);
});
