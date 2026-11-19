import { describe, expect, it } from 'vitest';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { TRACKS } from '../../../src/data/tracks/index';
import { CHAPTER2_EVENTS, CHAPTER3_EVENTS, EVENTS } from '../../../src/game/career/CareerEvents';
import { isPartUnlocked } from '../../../src/game/career/CareerProgression';
import { CareerController } from '../../../src/game/career/CareerController';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { exhaustPressureAfterSections } from '../../../src/game/career/tuning/modernBreathing';
import { MODERN_BREATHING_PARTS } from '../../../src/game/career/tuning/modernBreathingParts';
import { auditPartStages } from '../../../src/game/career/tuning/partGain';

describe('admissão e escape modernos por família', () => {
  it.each([...CHAPTER2_CARS, ...CHAPTER3_CARS].map((car) => [car.id, car] as const))(
    '%s resolve os três estágios de cada seção',
    (_, car) => {
      const options = MODERN_BREATHING_PARTS.filter((part) => !incompatibility(car, part));
      expect(options).toHaveLength(18);
      const stock = resolveBuild(car, [], {}, 2);
      if (!stock.ok) throw new Error(stock.errors.join('; '));
      const metric = (part: typeof options[number], build: typeof stock): number => {
        const { engine } = build.car;
        if (part.category === 'intake-airbox' || part.category === 'intake-filter') return engine.breathing!.airFilterDropKPa;
        if (part.category === 'intake-throttle') return engine.throttle.responseTimeS;
        return build.exhaustRestrictionKPa ?? engine.breathing!.exhaustBackPressureKPa;
      };
      for (const category of new Set(options.map((part) => part.category))) {
        const series = options.filter((part) => part.category === category);
        let previous = stock;
        for (const part of series) {
          const next = resolveBuild(car, [part.id], {}, 2);
          if (!next.ok) throw new Error(`${part.id}: ${next.errors.join('; ')}`);
          expect(metric(part, next), part.id).toBeLessThan(metric(part, previous));
          expect(next.car.exhaust.layout).toBe(stock.car.exhaust.layout);
          previous = next;
        }
        expect(CareerController.withPart([series[0]!.id], series[1]!.id)).toEqual({
          parts: [series[1]!.id],
          replaced: series[0]!.id,
        });
      }
      const filter = options.find((part) => part.category === 'intake-filter' && part.progression?.tier === 3)!;
      const airbox = options.find((part) => part.category === 'intake-airbox' && part.progression?.tier === 3)!;
      const filterOnly = resolveBuild(car, [filter.id], {}, 2);
      const combined = resolveBuild(car, [filter.id, airbox.id], {}, 2);
      if (!filterOnly.ok || !combined.ok) throw new Error(`Filtro e caixa de ar incompatíveis em ${car.id}`);
      expect(combined.car.engine.breathing!.airFilterDropKPa).toBeLessThan(filterOnly.car.engine.breathing!.airFilterDropKPa);
    },
  );

  it('conta as restrições por seção e não soma a mesma redução ao escape completo', () => {
    const sections = { backPressureReductionKPa: 5 };
    expect(exhaustPressureAfterSections(18, 14, false, sections)).toBe(13);
    expect(exhaustPressureAfterSections(18, 10, false, sections)).toBe(10);
    expect(exhaustPressureAfterSections(18, 14, true, sections)).toBe(9);
  });

  it.each(['toyota-2gr-fse', 'alfa-690t'])('preserva a arrancada ao acelerar a borboleta do %s', (family) => {
    const car = CHAPTER3_CARS.find((item) => item.engine.family === family)!;
    const track = TRACKS.find((item) => item.id === 'test-track')!;
    const stages = MODERN_BREATHING_PARTS.filter((part) => part.category === 'intake-throttle' && !incompatibility(car, part));
    const results = auditPartStages(car, stages, track, 2);
    expect(results.map(({ audit }) => audit.status)).toEqual(['gain', 'gain', 'gain']);
    for (const { audit } of results) {
      if (!('gain' in audit)) throw new Error(audit.reasons.join('; '));
      expect(audit.gain.etAfter - audit.gain.etBefore).toBeLessThan(0.05);
    }
  }, 60_000);

  it('libera a Liga e a Elite em eventos diferentes, sem migrar o save', () => {
    const bmw = CHAPTER2_CARS.find((car) => car.engine.family === 'bmw-n20')!;
    const lexus = CHAPTER3_CARS.find((car) => car.engine.family === 'toyota-2gr-fse')!;
    const progress = (liga: number, elite: number) => ({
      completedEventIds: [...EVENTS, ...CHAPTER2_EVENTS.slice(0, liga), ...CHAPTER3_EVENTS.slice(0, elite)].map((event) => event.id),
    });
    const offers = (car: typeof bmw, liga: number, elite: number) => MODERN_BREATHING_PARTS
      .filter((part) => part.category === 'intake-airbox' && !incompatibility(car, part) && isPartUnlocked(progress(liga, elite), part))
      .map((part) => part.progression!.tier);
    expect(offers(bmw, 0, 0)).toEqual([]);
    expect(offers(bmw, 1, 0)).toEqual([1]);
    expect(offers(bmw, 8, 0)).toEqual([1, 2]);
    expect(offers(bmw, 10, 5)).toEqual([1, 2, 3]);
    expect(offers(lexus, 10, 0)).toEqual([]);
    expect(offers(lexus, 10, 1)).toEqual([1]);
    expect(offers(lexus, 10, 5)).toEqual([1, 2]);
    expect(offers(lexus, 10, 9)).toEqual([1, 2, 3]);
  });
});
