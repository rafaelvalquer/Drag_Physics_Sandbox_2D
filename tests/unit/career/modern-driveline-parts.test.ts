import { describe, expect, it } from 'vitest';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility, transmissionKindOf } from '../../../src/game/career/tuning/BuildResolverV2';
import { MODERN_DRIVELINE_PARTS } from '../../../src/game/career/tuning/modernDrivelineParts';
import { auditPartStages } from '../../../src/game/career/tuning/partGain';
import { tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';

const cars = [...CHAPTER2_CARS, ...CHAPTER3_CARS];

describe('transmissão moderna em três estágios', () => {
  it.each(cars.map((car) => [car.id, car] as const))('%s aceita somente a preparação aplicável', (_, car) => {
    const manual = transmissionKindOf(car) === 'manual';
    const slots = [manual ? 'transmission-gearbox' : 'gearbox', 'differential'];
    if (manual) slots.push('clutch', 'flywheel');
    if (car.awd) slots.push('awd');
    const offers = MODERN_DRIVELINE_PARTS.filter((part) => !incompatibility(car, part));
    expect(offers).toHaveLength(slots.length * 3);
    const stock = resolveBuild(car, [], {}, 2);
    if (!stock.ok) throw new Error(stock.errors.join('; '));
    for (const slot of slots) {
      const series = offers.filter((part) => part.category === slot);
      expect(series.map((part) => part.progression?.tier)).toEqual([1, 2, 3]);
      let previous = stock.car;
      for (const part of series) {
        const build = resolveBuild(car, [part.id], {}, 2);
        if (!build.ok) throw new Error(`${part.id}: ${build.errors.join('; ')}`);
        const next = build.car;
        if (slot === 'gearbox' || slot === 'clutch') expect(next.transmission.clutch.maxTorqueNm).toBeGreaterThan(previous.transmission.clutch.maxTorqueNm);
        if (slot === 'awd') expect(next.awd!.centerCouplingNm).toBeGreaterThan(previous.awd!.centerCouplingNm);
        if (slot === 'differential' || slot === 'transmission-gearbox') expect(next.transmission.efficiency).toBeGreaterThan(previous.transmission.efficiency);
        if (slot === 'flywheel') {
          expect(next.engine.inertiaKgM2).toBeLessThan(previous.engine.inertiaKgM2);
          expect(next.massKg).toBeLessThan(previous.massKg);
        }
        if (slot === 'transmission-gearbox') {
          expect(next.transmission.gearRatios[0]).toBe(car.transmission.gearRatios[0]);
          expect(next.transmission.gearRatios.at(-1)).toBe(car.transmission.gearRatios.at(-1));
        }
        if (slot === 'gearbox') {
          expect(next.transmission.powershift!.torquePhaseS).toBeLessThan(previous.transmission.powershift!.torquePhaseS);
          if (next.transmission.torqueConverter) {
            expect(next.transmission.torqueConverter.lockup.maxTorqueNm).toBeGreaterThan(previous.transmission.torqueConverter!.lockup.maxTorqueNm);
            expect(next.transmission.torqueConverter.kFactor).toBe(car.transmission.torqueConverter!.kFactor);
          }
        }
        expect(next.engine.torqueCurve).toEqual(stock.car.engine.torqueCurve);
        previous = next;
      }
      expect(resolveBuild(car, [series[0]!.id, series[1]!.id], {}, 2)).toMatchObject({ ok: false });
    }
  });

  it('autoriza controle de largada nos novos pacotes de dupla embreagem, sem simular embreagem manual', () => {
    const car = cars.find((item) => item.id === 'nissan-gtr-r35-2015')!;
    const part = MODERN_DRIVELINE_PARTS.find((item) => item.category === 'gearbox' && !incompatibility(car, item))!;
    expect(tuningCapabilities(car, [part.id], 2).launch.enabled).toBe(true);
    expect(resolveBuild(car, [part.id], {}, 2)).toMatchObject({ ok: true, car: { transmission: { kind: 'dual-clutch' } } });
  });

  it('mede o ganho de capacidade sem perda relevante de tempo no R35', () => {
    const car = cars.find((item) => item.id === 'nissan-gtr-r35-2015')!;
    const track = TRACKS.find((item) => item.id === 'test-track')!;
    const stages = MODERN_DRIVELINE_PARTS.filter((part) => part.category === 'gearbox' && !incompatibility(car, part));
    expect(auditPartStages(car, stages, track, 2).map(({ audit }) => audit.status)).toEqual(['gain', 'gain', 'gain']);
  }, 60_000);
});
