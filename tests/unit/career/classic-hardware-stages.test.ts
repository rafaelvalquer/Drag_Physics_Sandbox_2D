import { describe, expect, it } from 'vitest';
import { CHAPTER1_CARS } from '../../../src/data/cars/campaign';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { reliabilityLimits } from '../../../src/game/career/tuning/EngineReliability';
import { ALL_PARTS } from '../../../src/game/career/tuning/parts';
import { progressionOf } from '../../../src/game/career/tuning/partProgression';

const groups = ['classic-exhaust-header', 'classic-exhaust-pipe', 'classic-exhaust-muffler', 'classic-exhaust-system'];
const gol = CHAPTER1_CARS.find((car) => car.id === 'vw-gol-gts-1988')!;

describe('escape, ignição e alimentação dos clássicos', () => {
  it.each(CHAPTER1_CARS.map((car) => [car.id, car] as const))('%s aplica os estágios de escape à física e ao áudio', (_, car) => {
    const stock = resolveBuild(car, [], {}, 1);
    if (!stock.ok) throw new Error(stock.errors.join('\n'));
    for (const group of groups) {
      const parts = ALL_PARTS.filter((p) => progressionOf(p)?.group === group)
        .sort((a, b) => progressionOf(a)!.tier - progressionOf(b)!.tier);
      expect(parts).toHaveLength(3);
      let previous = stock.car;
      for (const part of parts) {
        const result = resolveBuild(car, [part.id], {}, 1);
        if (!result.ok) throw new Error(result.errors.join('\n'));
        const after = result.car;
        expect(after.engine.breathing!.exhaustBackPressureKPa).toBeLessThan(previous.engine.breathing!.exhaustBackPressureKPa);
        expect(after.exhaust.layout).toBe(car.exhaust.layout);
        if (group === 'classic-exhaust-header') expect(after.exhaust.headerDiameterMm).toBeGreaterThan(previous.exhaust.headerDiameterMm);
        if (group === 'classic-exhaust-pipe') expect(after.exhaust.tailpipeDiameterMm).toBeGreaterThan(previous.exhaust.tailpipeDiameterMm);
        if (group === 'classic-exhaust-muffler') expect(after.exhaust.mufflerAbsorption).toBeLessThan(previous.exhaust.mufflerAbsorption);
        if (group === 'classic-exhaust-system') expect(after.exhaust.tailpipeDiameterMm).toBeGreaterThan(previous.exhaust.tailpipeDiameterMm);
        previous = after;
      }
    }
  });

  it('evita somar a redução do sistema completo à das mesmas seções', () => {
    const sections = ['header-classic-race', 'pipe-race', 'muffler-straight'];
    const modular = resolveBuild(gol, sections, {}, 1);
    const complete = resolveBuild(gol, ['exhaust-classic-race'], {}, 1);
    const combined = resolveBuild(gol, ['exhaust-classic-race', ...sections], {}, 1);
    if (!modular.ok || !complete.ok || !combined.ok) throw new Error('Escape inválido');
    expect(combined.car.engine.breathing!.exhaustBackPressureKPa).toBeCloseTo(
      Math.min(modular.car.engine.breathing!.exhaustBackPressureKPa, complete.car.engine.breathing!.exhaustBackPressureKPa),
    );
    expect(combined.car.exhaust.tailpipeDiameterMm).toBe(
      Math.max(modular.car.exhaust.tailpipeDiameterMm, complete.car.exhaust.tailpipeDiameterMm),
    );
  });

  it('habilita mais pressão com a alimentação estabilizada', () => {
    const support = ['turbo-basic', 'clutch-ceramic-race', 'forged-kit'];
    const tune = { boostBar: 0.97 };
    const original = resolveBuild(gol, support, tune, 1);
    expect(original.ok ? [] : original.errors).toContainEqual(expect.stringContaining('bicos ou bomba'));
    expect(resolveBuild(gol, [...support, 'fuel-classic-regulation'], tune, 1).ok).toBe(true);
  });

  it('amplia a rotação segura com molas, mantendo o corte original', () => {
    let safeRpm = 0;
    for (const id of ['valve-springs-classic-s1', 'valve-springs', 'valve-springs-classic-s3']) {
      const built = resolveBuild(gol, [id], {}, 1);
      if (!built.ok) throw new Error(built.errors.join('\n'));
      expect(built.car.engine.revLimitRpm).toBe(gol.engine.revLimitRpm);
      const safe = reliabilityLimits(built.car, [id]).recommendedSafeRpm;
      expect(safe).toBeGreaterThan(safeRpm);
      safeRpm = safe;
    }
  });
});

describe('internos dos clássicos', () => {
  it.each(CHAPTER1_CARS.map((car) => [car.id, car] as const))('%s amplia o limite de torque em cada estágio', (_, car) => {
    const ids = [null, 'rods-reinforced', 'pistons-forged', 'forged-kit'];
    const limits = ids.map((id) => {
      const build = resolveBuild(car, id ? [id] : [], {}, 1);
      if (!build.ok) throw new Error(build.errors.join('\n'));
      return build.internalTorqueLimitNm!;
    });
    expect(limits[0]).toBeLessThan(400);
    expect(limits.slice(1)).toEqual([400, 440, 520]);
  });

  it('exige o conjunto de pistões e bielas no Gol preparado acima de 400 N·m', () => {
    const support = [
      'turbo-strong', 'clutch-ceramic-race', 'fuel-pump', 'ecu-race', 'ignition-race',
      'compression-low', 'wastegate-race', 'cam-turbo', 'head-race', 'exhaust-classic-race',
      'turbine-large', 'manifold-classic-race', 'filter-direct',
      // the cam's overlap now costs boost pressure (breathingModel): the intercooler brings the build back above 400 N·m
      'ic-large',
    ];
    const tune = { boostBar: 1.5 };
    const rods = resolveBuild(gol, [...support, 'rods-reinforced'], tune, 1);
    expect(rods.ok ? [] : rods.errors).toContainEqual(expect.stringContaining('limite mecânico dos internos'));
    const pistons = resolveBuild(gol, [...support, 'pistons-forged'], tune, 1);
    if (!pistons.ok) throw new Error(pistons.errors.join('\n'));
    expect(pistons.peakTorqueNm).toBeGreaterThan(400);
    expect(pistons.peakTorqueNm).toBeLessThan(440);
  });
});

describe('intercoolers dos clássicos', () => {
  it.each(CHAPTER1_CARS.map((car) => [car.id, car] as const))('%s resfria a carga por estágio à mesma pressão', (_, car) => {
    const support = ['turbo-basic', 'clutch-reinforced'];
    if (car.id === 'gm-celta-2003') support.push('compression-celta-turbo');
    const tune = { boostBar: 0.6 };
    let previousTemperature = Infinity;
    for (const id of [null, 'ic-small', 'ic-medium', 'ic-large']) {
      const result = resolveBuild(car, id ? [...support, id] : support, tune, 1);
      if (!result.ok) throw new Error(result.errors.join('\n'));
      expect(result.car.engine.turbo?.maxBoostBar).toBe(tune.boostBar);
      expect(result.chargeTemperatureAtTargetK).toBeLessThan(previousTemperature);
      previousTemperature = result.chargeTemperatureAtTargetK!;
    }
  });
});
