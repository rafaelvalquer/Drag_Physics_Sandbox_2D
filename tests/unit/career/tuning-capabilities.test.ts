/** Settings are gated by the installed parts; invalid settings are reconciled away. */
import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { reliabilityLimits } from '../../../src/game/career/tuning/EngineReliability';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { reconcileTune, tuneReliability, tuningCapabilities, validateTune } from '../../../src/game/career/tuning/TuningCapabilities';

const car = (id: string) => CAREER_CARS.find((c) => c.id === id)!;

describe('tuning capabilities', () => {
  it('NA engine: boost locked with a reason', () => {
    const c = tuningCapabilities(car('vw-gol-gts-1988'), [], 1);
    expect(c.boost.enabled).toBe(false);
    expect(c.boost.reason).toBe('Exige kit turbo compatível.');
  });

  it('rev cut needs a programmable ECU; range up to the mechanical limit', () => {
    const base = car('vw-golf-gti-mk4-2003');
    expect(tuningCapabilities(base, [], 2).revLimit.enabled).toBe(false);
    const c = tuningCapabilities(base, ['ecu-programmable'], 2);
    expect(c.revLimit.enabled).toBe(true);
    expect(c.revLimit.max).toBe(c.limits!.maxSafeRpm);
    expect(c.limits!.recommendedSafeRpm).toBeGreaterThan(c.limits!.hardwareRevLimitRpm);
    expect(tuneReliability(c, { revLimitRpm: c.revLimit.max })).toBe('critical');
    expect(tuneReliability(c, {})).toBe('safe');
  });

  it('modern boost capped by the wastegate; tyre pressure needs tyres', () => {
    const base = car('vw-golf-gti-mk4-2003');
    const c = tuningCapabilities(base, ['ecu-programmable'], 2);
    expect(c.boost.enabled).toBe(true);
    expect(c.boost.max).toBeGreaterThan(c.boost.default);
    expect(c.tirePressure.enabled).toBe(false);
  });

  it('validate and reconcile drop settings the parts no longer allow', () => {
    const base = car('vw-golf-gti-mk4-2003');
    const tune = { revLimitRpm: 7000, finalDrive: 'short' as const };
    expect(validateTune(base, [], 2, tune).length).toBeGreaterThan(0);
    const r = reconcileTune(base, [], 2, tune);
    expect(r.tune.revLimitRpm).toBeUndefined();
    expect(r.dropped).toContain('revLimitRpm');
  });

  it('valve springs raise the safe speed', () => {
    const base = car('vw-gol-gts-1988');
    const hw = resolveBuild(base, [], {}, 1);
    if (!hw.ok) throw new Error();
    expect(reliabilityLimits(hw.car, ['valve-springs']).recommendedSafeRpm).toBeGreaterThan(reliabilityLimits(hw.car, []).recommendedSafeRpm);
  });
});

describe('boost slider offers only what the build accepts', () => {
  const chevette = car('gm-chevette-sl-1988');
  const kit = ['turbo-street', 'wastegate-race', 'clutch-reinforced'];
  const maxOf = (extra: string[]): number => {
    const c = tuningCapabilities(chevette, [...kit, ...extra], 1, { exactBoostMax: true });
    expect(c.boost.enabled).toBe(true);
    return c.boost.max;
  };

  it('max follows the fuel system and every offered value resolves', () => {
    const stock = maxOf([]);
    const inj = maxOf(['injectors']);
    const pump = maxOf(['fuel-pump']);
    expect(stock).toBeLessThanOrEqual(0.95);
    expect(inj).toBeGreaterThan(stock);
    expect(inj).toBeLessThanOrEqual(1.05);
    expect(pump).toBeGreaterThan(inj);
    expect(pump).toBeLessThanOrEqual(1.5);
    for (const [extra, max] of [[[], stock], [['injectors'], inj], [['fuel-pump'], pump]] as const) {
      const c = tuningCapabilities(chevette, [...kit, ...extra], 1, { exactBoostMax: true });
      expect(resolveBuild(chevette, [...kit, ...extra], { boostBar: max }, 1).ok, `${extra.join()} @ ${max}`).toBe(true);
      expect(c.boost.default).toBeLessThanOrEqual(max);
    }
  });
});
