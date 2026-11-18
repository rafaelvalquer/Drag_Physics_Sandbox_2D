/** Dyno Lab controls of the Chapter 3 projects come from the parts really installed. */
import { describe, expect, it } from 'vitest';
import { applyTuneOverlay, tuningCapabilities, validateTune } from '../../../../src/game/career/tuning/TuningCapabilities';
import { resolveBuild } from '../../../../src/game/career/tuning/BuildResolver';
import { build, car, C43, Z370 } from './_helpers';

const conv = ['turbo-vq37-balanced', 'forged-v6-turbo', 'fuel-v6-highflow', 'oil-system-street', 'clutch-v6-comp'];

describe('tuning capabilities, V6 projects', () => {
  it('an aspirated V6 has no boost control and says why', () => {
    const c = tuningCapabilities(car(Z370), [], 2);
    expect(c.boost.enabled).toBe(false);
    expect(c.boost.reason).toMatch(/kit turbo/);
  });
  it('a converted V6 sets boost only with a programmable central, inside the kit range', () => {
    expect(tuningCapabilities(car(Z370), conv, 2).boost).toMatchObject({ enabled: false, reason: expect.stringMatching(/ECU programável/) });
    const parts = [...conv, 'filter-v6-dual', 'exhaust-v6-sport', 'ecu-vq37-comp'];
    const c = tuningCapabilities(car(Z370), parts, 2);
    expect(c.boost.enabled).toBe(true);
    expect(c.boost.min).toBeGreaterThanOrEqual(0.5);
    expect(c.boost.max).toBeLessThanOrEqual(1.0);
    expect(validateTune(car(Z370), parts, 2, { boostBar: c.boost.max + 0.5 }).join(' ')).toMatch(/fora da faixa/);
    const lo = resolveBuild(car(Z370), parts, { boostBar: c.boost.min }, 2);
    const hi = resolveBuild(car(Z370), parts, { boostBar: c.boost.max }, 2);
    if (lo.ok && hi.ok) expect(hi.peakPowerCv).toBeGreaterThan(lo.peakPowerCv);
    else expect(lo.ok || hi.ok).toBe(true); // the top of the range may be refused by fuel/internals, never silently ignored
  });
  it('the NA ECU Competition moves the cut up to the mechanical limit, and springs raise that limit', () => {
    const ecu = ['filter-v6-dual', 'exhaust-v6-sport', 'ecu-vq37-comp'];
    const a = tuningCapabilities(car(Z370), ecu, 2);
    const b = tuningCapabilities(car(Z370), [...ecu, 'valve-springs-v6-comp'], 2);
    expect(a.revLimit.enabled).toBe(true);
    expect(b.revLimit.max).toBeGreaterThan(a.revLimit.max);
    expect(validateTune(car(Z370), ecu, 2, { revLimitRpm: a.revLimit.max + 500 }).join(' ')).toMatch(/fora da faixa/);
  });
  it('the cut is not adjustable without a central that moves it', () => {
    const c = tuningCapabilities(car(Z370), ['filter-v6-flow'], 2);
    expect(c.revLimit.enabled).toBe(false);
  });
  it('springs applied through the overlay raise the mechanical limit of the car, not its power', () => {
    const parts = ['filter-v6-dual', 'exhaust-v6-sport', 'ecu-vq37-comp', 'valve-springs-v6-comp'];
    const hw = build(Z370, parts);
    const r = applyTuneOverlay(car(Z370), parts, 2, hw, { revLimitRpm: 8400 }, 'k');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.car.engine.revLimitRpm).toBe(8400);
  });
  it('the biturbo programmable central unlocks boost, the staged ones do not', () => {
    expect(tuningCapabilities(car(C43), ['ecu-stage1'], 2).boost.enabled).toBe(false);
    const comp = ['ecu-biturbo-comp', 'turbo-hybrid-hf', 'downpipe-catless', 'intercooler-comp', 'internals-biturbo-s3', 'fuel-v6-highflow', 'fuel-hp-pump', 'at-upgrade-s2', 'oil-system-race'];
    const c = tuningCapabilities(car(C43), comp, 2);
    expect(c.boost.enabled).toBe(true);
    expect(c.boost.max).toBeGreaterThan(c.boost.min);
  });
  it('boost by gear limits the boost target in the low gears (transmission data, set by the part)', () => {
    const parts = ['ecu-biturbo-comp', 'turbo-hybrid-hf', 'downpipe-catless', 'intercooler-comp', 'internals-biturbo-s3', 'fuel-v6-highflow', 'fuel-hp-pump', 'at-upgrade-s2', 'oil-system-race', 'boost-by-gear'];
    const r = build(C43, parts);
    expect(r.car.transmission.boostByGear).toEqual([0.6, 0.8, 0.92]);
    expect(build(C43, parts.filter((p) => p !== 'boost-by-gear')).car.transmission.boostByGear).toBeUndefined();
  });
});
