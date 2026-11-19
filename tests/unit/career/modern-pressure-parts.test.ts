import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { MODERN_PRESSURE_PARTS } from '../../../src/game/career/tuning/modernPressureParts';
import { reconcileTune, tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';

const car = findCampaignCar('bmw-320i-f30-2014')!;
const family = car.engine.family!;
const e = car.engine.turbo!;
const mechanics = ['ecu-programmable', 'at-upgrade'];
const valveId = (tier: number) => `wastegate-${family}-s${tier}`;
const controllerId = (tier: number) => `boost-solenoid-${family}-s${tier}`;

describe('atuadores e solenoides de pressão', () => {
  it('amplia a faixa ajustável sem mudar o alvo previsto pela ECU', () => {
    const initial = resolveBuild(car, mechanics, {}, 2);
    if (!initial.ok) throw new Error(initial.errors.join('\n'));
    const initialMax = tuningCapabilities(car, mechanics, 2).boost.max;
    expect(initialMax).toBeCloseTo(e.maxBoostBar + 0.35);
    let previous = initialMax;
    for (const tier of [1, 2, 3]) {
      const parts = [...mechanics, valveId(tier)];
      const next = resolveBuild(car, parts, {}, 2);
      if (!next.ok) throw new Error(next.errors.join('\n'));
      const caps = tuningCapabilities(car, parts, 2).boost;
      expect(caps).toMatchObject({ enabled: true, step: 0.01 });
      expect(caps.max).toBeGreaterThan(previous);
      expect(next.wastegateLimitBar).toBeCloseTo(caps.max);
      expect(next.car.engine.turbo!.maxBoostBar).toBe(initial.car.engine.turbo!.maxBoostBar);
      previous = caps.max;
    }
    const request = { boostBar: e.maxBoostBar + 0.4 };
    const rejected = resolveBuild(car, mechanics, request, 2);
    expect(rejected.ok ? [] : rejected.errors).toContainEqual(expect.stringContaining('wastegate'));
    const accepted = resolveBuild(car, [...mechanics, valveId(1)], request, 2);
    expect(accepted.ok && accepted.car.engine.turbo?.maxBoostBar).toBeCloseTo(request.boostBar);
    expect(reconcileTune(car, mechanics, 2, request).dropped).toContain('boostBar');
  }, 60_000);

  it('reduz a constante de resposta sem somar pressão nem alterar a arquitetura', () => {
    const build = resolveBuild(car, [valveId(2)], {}, 2);
    if (!build.ok) throw new Error(build.errors.join('\n'));
    let previous = e.spoolTimeS;
    for (const tier of [1, 2, 3]) {
      const next = resolveBuild(car, [valveId(2), controllerId(tier)], {}, 2);
      if (!next.ok) throw new Error(next.errors.join('\n'));
      expect(next.car.engine.turbo!.spoolTimeS).toBeLessThan(previous);
      expect(next.car.engine.turbo!.maxBoostBar).toBe(e.maxBoostBar);
      expect(next.car.engine.turbo!.layout).toBe(e.layout);
      expect(next.wastegateLimitBar).toBe(build.wastegateLimitBar);
      previous = next.car.engine.turbo!.spoolTimeS;
    }
    const legacy = resolveBuild(car, ['boost-control'], {}, 2);
    const legacyWithValve = resolveBuild(car, ['boost-control', valveId(3)], {}, 2);
    if (!legacy.ok || !legacyWithValve.ok) throw new Error('Kit de controle legado inválido');
    expect(legacyWithValve.wastegateLimitBar).toBeCloseTo(legacy.wastegateLimitBar!);
    expect(legacyWithValve.car.engine.turbo!.maxBoostBar).toBe(legacy.car.engine.turbo!.maxBoostBar);
  }, 60_000);

  it('oferece três peças de cada tipo para os biturbos e recusa o aspirado', () => {
    const gtr = findCampaignCar('nissan-gtr-r35-2015')!;
    const lexus = findCampaignCar('lexus-is350-2015')!;
    const parts = MODERN_PRESSURE_PARTS.filter((part) => !incompatibility(gtr, part));
    expect(parts.filter((part) => part.category === 'turbo-wastegate')).toHaveLength(3);
    expect(parts.filter((part) => part.category === 'boost-control')).toHaveLength(3);
    expect(parts.every((part) => incompatibility(lexus, part))).toBe(true);
  });
});
