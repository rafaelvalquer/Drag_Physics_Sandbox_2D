/** N₂O controller: one press starts a stage, stages share one cylinder, the cylinder refills only on reset. */
import { describe, expect, it } from 'vitest';
import { NitrousController, nitrousStagePreview, type NitrousContext, type NitrousSetup } from '../../../src/physics/engine/NitrousController';

const H = 1 / 120;
const setup = (o: Partial<NitrousSetup> = {}): NitrousSetup => ({
  kitId: 'test', capacityKg: 0.04, maxFlowKgS: 0.005, fuelNeed: 1, minRpm: 3000, mode: 'single', stage1Share: 1,
  stage1Flow: 1, stage1RampS: 0, stage2Flow: 1, stage2RampS: 0, fuelSupply: 1, torqueLimitNm: 0, ...o,
});
const ok: NitrousContext = { rpm: 5000, injectable: true, broken: false };
function run(n: NitrousController, seconds: number, ctx: NitrousContext = ok, dt = H): void {
  for (let i = 0; i < Math.round(seconds / dt); i++) n.update(dt, ctx);
}

describe('single discharge', () => {
  it('one press starts the injection; pressing again while it runs does nothing (no restart, no extra)', () => {
    const n = new NitrousController(setup());
    expect(n.status).toBe('READY');
    expect(n.request(ok)).toBe(true);
    expect(n.status).toBe('STAGE_1_ACTIVE');
    run(n, 1);
    const before = n.telemetry();
    for (let i = 0; i < 20; i++) expect(n.request(ok)).toBe(false);
    run(n, 0.5);
    const after = n.telemetry();
    expect(after.activeTimeS).toBeGreaterThan(before.activeTimeS);
    expect(after.consumedKg).toBeGreaterThan(before.consumedKg);
    expect(after.consumedKg).toBeLessThan(0.04);
  });

  it('runs by itself until the cylinder is empty, then ignores presses until a reset', () => {
    const n = new NitrousController(setup());
    n.request(ok);
    run(n, 20);
    const t = n.telemetry();
    expect(t.status).toBe('DEPLETED');
    expect(t.remainingFraction).toBe(0);
    expect(t.consumedKg).toBeCloseTo(0.04, 8);
    expect(n.request(ok)).toBe(false);
    expect(n.additionalTorqueNm).toBe(0);
    n.reset();
    expect(n.status).toBe('READY');
    expect(n.remainingFraction).toBe(1);
  });

  it('refuses a start the engine cannot take, without spending N₂O', () => {
    for (const bad of [{ ...ok, rpm: 2000 }, { ...ok, injectable: false }, { ...ok, broken: true }]) {
      const n = new NitrousController(setup());
      expect(n.request(bad)).toBe(false);
      expect(n.status).toBe('READY');
      expect(n.remainingFraction).toBe(1);
      expect(n.telemetry().consumedKg).toBe(0);
    }
  });

  it('an interrupted injection (spark cut, limiter) pauses without spending and resumes', () => {
    const n = new NitrousController(setup());
    n.request(ok);
    run(n, 0.5);
    const c = n.telemetry().consumedKg;
    run(n, 1, { ...ok, injectable: false });
    expect(n.telemetry().consumedKg).toBe(c);
    expect(n.status).toBe('STAGE_1_ACTIVE'); // still committed
    run(n, 0.2);
    expect(n.telemetry().consumedKg).toBeGreaterThan(c);
  });

  it('an engine failure or the end of the attempt shuts it for good', () => {
    const n = new NitrousController(setup());
    n.request(ok);
    run(n, 0.3);
    n.update(H, { ...ok, broken: true });
    expect(n.status).toBe('DISABLED');
    expect(n.request(ok)).toBe(false);
    const m = new NitrousController(setup());
    m.disable();
    expect(m.request(ok)).toBe(false);
  });

  it('consumption does not depend on the step size', () => {
    const a = new NitrousController(setup());
    const b = new NitrousController(setup());
    a.request(ok);
    b.request(ok);
    run(a, 3, ok, 1 / 120);
    run(b, 3, ok, 1 / 240);
    expect(a.telemetry().consumedKg).toBeCloseTo(b.telemetry().consumedKg, 4); // ≤ 0.1 % (the ramp is sampled per step)
  });
});

describe('two stages', () => {
  const dual = (o: Partial<NitrousSetup> = {}) => setup({ mode: 'dual', stage1Share: 0.4, stage1Flow: 0.8, stage2Flow: 0.5, ...o });

  it('stage 1 spends only its share; stage 2 stays reserved and needs a new press', () => {
    const n = new NitrousController(dual());
    n.request(ok);
    for (let i = 0; i < 5; i++) expect(n.request(ok)).toBe(false); // pressing during stage 1 queues nothing
    run(n, 10);
    expect(n.status).toBe('STAGE_2_READY');
    expect(n.remainingFraction).toBeCloseTo(0.6, 6);
    run(n, 5); // no press: it never starts by itself
    expect(n.status).toBe('STAGE_2_READY');
    expect(n.telemetry().stage2RemainingFraction).toBeCloseTo(1, 6);
    expect(n.request(ok)).toBe(true);
    expect(n.status).toBe('STAGE_2_ACTIVE');
    run(n, 30);
    expect(n.status).toBe('DEPLETED');
    expect(n.remainingFraction).toBe(0);
    expect(n.telemetry().consumedKg).toBeCloseTo(0.04, 8);
  });

  it('the stages have their own flow and ramp', () => {
    const n = new NitrousController(dual({ stage1RampS: 0, stage2RampS: 2, stage1Flow: 0.8, stage2Flow: 0.5 }));
    n.request(ok);
    run(n, 0.5);
    expect(n.telemetry().flowKgPerS).toBeCloseTo(0.005 * 0.8, 6);
    run(n, 10);
    n.request(ok);
    run(n, 1); // half way up the 2 s ramp: below the stage 2 plateau
    const mid = n.telemetry().flowKgPerS;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(0.005 * 0.5);
    run(n, 2);
    expect(n.telemetry().flowKgPerS).toBeCloseTo(0.005 * 0.5, 6);
  });

  it('a single-mode setup ignores the second stage settings', () => {
    const n = new NitrousController(setup({ stage1Share: 0.3, stage2Flow: 0.2 }));
    expect(n.setup.stage1Share).toBe(1);
    n.request(ok);
    run(n, 20);
    expect(n.status).toBe('DEPLETED');
  });
});

describe('physics of the flow', () => {
  it('more flow: more power and a shorter discharge, from the same cylinder', () => {
    const lo = nitrousStagePreview(setup({ stage1Flow: 0.4 }), 1, 5000);
    const hi = nitrousStagePreview(setup({ stage1Flow: 1 }), 1, 5000);
    expect(hi.powerCv).toBeGreaterThan(lo.powerCv);
    expect(hi.durationS).toBeLessThan(lo.durationS);
    // the energy is the cylinder, not a free bonus: power × duration stays close
    expect(hi.powerCv * hi.durationS).toBeGreaterThan(lo.powerCv * lo.durationS * 0.9);
    expect(hi.powerCv * hi.durationS).toBeLessThan(lo.powerCv * lo.durationS * 1.1);
  });

  it('a slower ramp rises smoothly (no torque step) and the same power is more torque at low speed', () => {
    const n = new NitrousController(setup({ stage1RampS: 2 }));
    n.request(ok);
    let prev = 0;
    let maxStep = 0;
    for (let i = 0; i < 240; i++) {
      n.update(H, ok);
      maxStep = Math.max(maxStep, n.additionalTorqueNm - prev);
      prev = n.additionalTorqueNm;
    }
    expect(maxStep).toBeLessThan(2);
    const slow = new NitrousController(setup());
    const fast = new NitrousController(setup());
    slow.request({ ...ok, rpm: 4000 });
    fast.request({ ...ok, rpm: 8000 });
    run(slow, 1, { ...ok, rpm: 4000 });
    run(fast, 1, { ...ok, rpm: 8000 });
    expect(slow.additionalTorqueNm).toBeGreaterThan(fast.additionalTorqueNm);
    expect(slow.telemetry().additionalPowerW).toBeCloseTo(fast.telemetry().additionalPowerW, 3);
  });

  it('a weak fuel system makes less power from the same flow (never more)', () => {
    const full = nitrousStagePreview(setup({ fuelSupply: 1.5 }), 1, 5000).powerCv;
    const weak = nitrousStagePreview(setup({ fuelSupply: 0.6 }), 1, 5000).powerCv;
    expect(weak).toBeLessThan(full);
    expect(full).toBe(nitrousStagePreview(setup({ fuelSupply: 1 }), 1, 5000).powerCv);
  });

  it('is deterministic and never produces NaN, Infinity or a negative cylinder', () => {
    const a = new NitrousController(setup({ mode: 'dual', stage1Share: 0.35 }));
    const b = new NitrousController(setup({ mode: 'dual', stage1Share: 0.35 }));
    for (const n of [a, b]) {
      n.request(ok);
      run(n, 12);
      n.request(ok);
      run(n, 12);
    }
    expect(a.telemetry()).toEqual(b.telemetry());
    for (const v of Object.values(a.telemetry())) if (typeof v === 'number') expect(Number.isFinite(v) && v >= 0).toBe(true);
  });
});
