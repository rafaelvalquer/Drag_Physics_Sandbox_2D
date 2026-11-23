import { describe, expect, it } from 'vitest';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { reliabilityLimits } from '../../../src/game/career/tuning/EngineReliability';
import { MODERN_INTERNAL_PARTS } from '../../../src/game/career/tuning/modernInternalParts';
import { tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';

const modern = [...CHAPTER2_CARS, ...CHAPTER3_CARS];

describe('internos e compressão dos carros modernos', () => {
  it.each(modern.map((car) => [car.id, car] as const))('%s aplica os limites do conjunto instalado', (_, car) => {
    const available = MODERN_INTERNAL_PARTS.filter((part) => !incompatibility(car, part));
    const rotating = available.filter((part) => part.category === 'pistons');
    const compression = available.filter((part) => part.category === 'engine-compression');
    expect(rotating).toHaveLength(3);
    expect(compression).toHaveLength(3);

    let previousInertia = car.engine.inertiaKgM2;
    let previousSafe = reliabilityLimits(car, []).recommendedSafeRpm;
    let previousTorqueScale = 1;
    for (const part of rotating) {
      const built = resolveBuild(car, [part.id], {}, 2);
      if (!built.ok) throw new Error(built.errors.join('\n'));
      const engine = built.car.engine;
      const safe = reliabilityLimits(built.car, [part.id]).recommendedSafeRpm;
      expect(engine.revLimitRpm).toBe(car.engine.revLimitRpm);
      expect(engine.compressionRatio).toBe(car.engine.compressionRatio);
      expect(engine.inertiaKgM2).toBeLessThan(previousInertia);
      expect(safe).toBeGreaterThan(previousSafe);
      expect(part.torqueLimitScale).toBeGreaterThan(previousTorqueScale);
      previousInertia = engine.inertiaKgM2;
      previousSafe = safe;
      previousTorqueScale = part.torqueLimitScale;
    }
    const reference = resolveBuild(car, [rotating[0]!.id], {}, 2);
    if (!reference.ok) throw new Error(reference.errors.join('\n'));
    let knockFree = reference.knockFreeBoostBar ?? 0;
    for (const part of compression) {
      const built = resolveBuild(car, [rotating[0]!.id, part.id], {}, 2);
      if (!built.ok) throw new Error(built.errors.join('\n'));
      expect(built.car.engine.compressionRatio).toBeCloseTo(car.engine.compressionRatio + part.compressionAdd);
      if (car.engine.induction === 'turbo') {
        expect(built.knockFreeBoostBar).toBeGreaterThan(knockFree);
        expect(built.car.engine.turbo?.maxBoostBar).toBe(car.engine.turbo?.maxBoostBar);
        knockFree = built.knockFreeBoostBar!;
      }
    }
  }, 60_000);

  it('recusa empilhar conjuntos alternados ou ultrapassar o limite de taxa', () => {
    const civic = modern.find((car) => car.engine.family === 'honda-k20')!;
    const lexus = modern.find((car) => car.engine.family === 'toyota-2gr-fse')!;
    expect(resolveBuild(civic, ['pistons-high-cr', 'rotating-assembly-honda-k20-s2'], {}, 2).ok).toBe(false);
    const nearLimit = { ...lexus, engine: { ...lexus.engine, compressionRatio: 12.48 } };
    const result = resolveBuild(nearLimit, ['compression-chamber-toyota-2gr-fse-s3'], {}, 2);
    expect(result.ok ? [] : result.errors).toContainEqual(expect.stringContaining('detona'));
  });

  it('reconhece a capacidade dos dois conjuntos forjados aceitos pelo mapa turbo Stage 3', () => {
    const n20 = modern.find((car) => car.engine.family === 'bmw-n20')!;
    const support = ['ecu-map-bmw-n20-s3', 'fuel-bmw-n20-s3', 'turbo-hybrid', 'downpipe-catless', 'intercooler-race', 'at-upgrade'];
    for (const id of ['pistons-forged-modern', 'rotating-assembly-bmw-n20-s3']) {
      const build = resolveBuild(n20, [...support, id], {}, 2);
      if (!build.ok) throw new Error(build.errors.join('\n'));
    }
    const weak = resolveBuild(n20, [...support, 'rotating-assembly-bmw-n20-s2'], {}, 2);
    expect(weak.ok ? [] : weak.errors).toContainEqual(expect.stringContaining('exige pistões e bielas forjados'));
  });

  it('reduz o atraso de centelha no N20 à mesma pressão de sobrealimentação', () => {
    const n20 = modern.find((car) => car.engine.family === 'bmw-n20')!;
    const support = ['ecu-programmable', 'turbo-hybrid', 'boost-control', 'pistons-forged-modern', 'at-upgrade'];
    const tune = { boostBar: 1.48 };
    const original = resolveBuild(n20, support, tune, 2);
    const reduced = resolveBuild(n20, [...support, 'compression-chamber-bmw-n20-s3'], tune, 2);
    if (!original.ok || !reduced.ok) throw new Error('Montagem de referência inválida');
    expect(reduced.car.engine.turbo?.maxBoostBar).toBe(original.car.engine.turbo?.maxBoostBar);
    expect(original.knockLoss).toBeGreaterThan(0);
    expect(reduced.knockLoss).toBeLessThan(original.knockLoss);
  });

  it('expande a faixa de ajuste com molas sem mexer no corte por conta própria', () => {
    const astra = modern.find((car) => car.engine.family === 'gm-familia2')!;
    const ecu = 'ecu-stage1-na';
    const springs = MODERN_INTERNAL_PARTS.filter((part) =>
      part.category === 'engine-valvetrain' && !incompatibility(astra, part));
    expect(springs).toHaveLength(3);
    const original = tuningCapabilities(astra, [ecu], 2);
    let max = original.revLimit.max;
    for (const spring of springs) {
      const springOnly = resolveBuild(astra, [spring.id], {}, 2);
      if (!springOnly.ok) throw new Error(springOnly.errors.join('\n'));
      expect(springOnly.car.engine.revLimitRpm).toBe(astra.engine.revLimitRpm);
      expect(springOnly.car.engine.maxSafeRpm).toBeGreaterThan(astra.engine.maxSafeRpm);
      const next = tuningCapabilities(astra, [ecu, spring.id], 2);
      expect(next.revLimit.enabled).toBe(true);
      expect(next.revLimit.default).toBe(original.revLimit.default);
      expect(next.revLimit.max).toBeGreaterThan(max);
      max = next.revLimit.max;
    }
  });
});
