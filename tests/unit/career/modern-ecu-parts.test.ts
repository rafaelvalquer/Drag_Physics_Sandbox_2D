import { describe, expect, it } from 'vitest';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import type { CarConfig } from '../../../src/data/schema';
import { CareerController } from '../../../src/game/career/CareerController';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility, transmissionKindOf } from '../../../src/game/career/tuning/BuildResolverV2';
import { MODERN_ECU_PARTS } from '../../../src/game/career/tuning/modernEcuParts';

const modern = [...CHAPTER2_CARS, ...CHAPTER3_CARS];

/** Hardware the maps ask for. `competition` adds what the Competition map needs on top (downpipe, big turbine). */
function supportFor(car: CarConfig, competition = false): string[] {
  const f = car.engine.family!;
  const kind = transmissionKindOf(car);
  const gearbox = kind === 'manual' ? 'clutch-reinforced' : kind === 'dual-clutch' ? 'dct-upgrade' : 'at-upgrade';
  return [`fuel-${f}-s3`, gearbox, ...(car.engine.induction === 'turbo'
    ? [`charge-cooler-${f}-s3`, `rotating-assembly-${f}-s3`, ...(competition ? [`exhaust-downpipe-${f}-s3`, `factory-turbo-${f}-s3`] : [])] : [])];
}

describe('mapas de ECU modernos', () => {
  it.each(modern.map((car) => [car.id, car] as const))('%s usa três calibrações para sua própria família', (_, car) => {
    const maps = MODERN_ECU_PARTS.filter((map) => !incompatibility(car, map));
    expect(maps.map((map) => map.progression?.tier)).toEqual([1, 2, 3]);
    const support = supportFor(car);
    const baseline = resolveBuild(car, support, {}, 2);
    if (!baseline.ok) throw new Error(baseline.errors.join('\n'));
    let previous = baseline;
    for (const map of maps) {
      // the Competition map also asks for the downpipe and the big turbine (turbo cars)
      const hardware = map.progression?.tier === 3 ? supportFor(car, true) : support;
      const next = resolveBuild(car, [...hardware, map.id], {}, 2);
      if (!next.ok) throw new Error(`${map.id}: ${next.errors.join('\n')}`);
      expect(next.car.engine.fueling!.airFuelRatio).toBeLessThan(previous.car.engine.fueling!.airFuelRatio);
      expect(next.car.engine.revLimitRpm).toBeGreaterThanOrEqual(previous.car.engine.revLimitRpm);
      expect(next.car.engine.induction).toBe(car.engine.induction);
      expect(next.peakTorqueNm).toBeLessThanOrEqual(next.mappedTorqueLimitNm! + 0.05);
      if (car.engine.induction === 'turbo') {
        expect(next.car.engine.turbo!.maxBoostBar).toBeGreaterThan(previous.car.engine.turbo!.maxBoostBar);
        expect(next.car.engine.turbo!.layout).toBe(car.engine.turbo!.layout);
      }
      previous = next;
    }
    expect(CareerController.withPart([maps[0]!.id], maps[1]!.id))
      .toEqual({ parts: [maps[1]!.id], replaced: maps[0]!.id });
  }, 60_000);

  it('rejeita mapa de outra arquitetura e valida as dependências do Stage 3 turbo', () => {
    const bmw = modern.find((car) => car.engine.family === 'bmw-n20')!;
    const civic = modern.find((car) => car.engine.family === 'honda-k20')!;
    const race = 'ecu-map-bmw-n20-s3';
    expect(incompatibility(civic, MODERN_ECU_PARTS.find((p) => p.id === race)!)).not.toBeNull();
    const missing = resolveBuild(bmw, [race], {}, 2);
    expect(missing.ok ? [] : missing.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('alimentação'),
      expect.stringContaining('intercooler'),
      expect.stringContaining('pistões'),
    ]));
    expect(resolveBuild(bmw, [...supportFor(bmw), 'ecu-map-bmw-n20-s2', 'factory-turbo-bmw-n20-s2'], {}, 2).ok).toBe(true);
  }, 60_000);

  it('recusa usar a calibração aspirada depois da conversão turbo', () => {
    const civic = modern.find((car) => car.engine.family === 'honda-k20')!;
    const converted = [
      'conversion-turbo-honda-k20-s1', 'conversion-compression-honda-k20', 'conversion-oil-honda-k20',
      'fuel-honda-k20-s1', 'ignition-honda-k20-s1', 'rotating-assembly-honda-k20-s1', 'clutch-reinforced',
    ];
    expect(resolveBuild(civic, converted, {}, 2).ok).toBe(true);
    const mismatch = resolveBuild(civic, [...converted, 'ecu-map-honda-k20-s1'], {}, 2);
    expect(mismatch.ok ? [] : mismatch.errors).toContainEqual(expect.stringContaining('remover o remap aspirado'));
  }, 60_000);
});
