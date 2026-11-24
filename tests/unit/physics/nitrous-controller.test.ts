import { describe, expect, it } from 'vitest';
import { NitrousController, nitrousPreview, type NitrousContext, type NitrousSetup } from '../../../src/physics/engine/NitrousController';

const H = 1 / 120;
const setup: NitrousSetup = {
  kitId: 'test', capacityKg: 0.04, maxFlowKgS: 0.005,
  fuelNeed: 1, minRpm: 3000, flow: 1, rampS: 0, fuelSupply: 1, torqueLimitNm: 400,
};
const valid: NitrousContext = { rpm: 5000, injectable: true, broken: false };

function run(n: NitrousController, seconds: number, held: boolean, ctx = valid, dt = H): void {
  for (let i = 0; i < Math.round(seconds / dt); i++) n.update(dt, ctx, held);
}

describe('continuous nitrous injection', () => {
  it('stops flow and torque on release, then restarts the ramp with the same charge', () => {
    const n = new NitrousController(setup);
    run(n, 1, true);
    const active = n.telemetry();
    expect(active.status).toBe('INJECTING');
    expect(active.consumedKg).toBeCloseTo(0.00485, 9);
    run(n, 3, false);
    expect(n.telemetry()).toMatchObject({ status: 'READY', flowKgPerS: 0, additionalTorqueNm: 0, consumedKg: active.consumedKg });
    n.update(H, valid, true);
    expect(n.telemetry().flowKgPerS).toBeLessThan(active.flowKgPerS);
    expect(n.telemetry().consumedKg).toBeGreaterThan(active.consumedKg);
    expect(n.drainEvents().map(e => e.type)).toEqual(['START', 'STOP', 'START']);
  });

  it('resumes after a temporary cut while held and forbids reuse after engine failure', () => {
    const n = new NitrousController(setup);
    run(n, 1, true);
    const remaining = n.remainingFraction;
    for (const ctx of [{ ...valid, injectable: false }, { ...valid, rpm: 2999 }]) {
      run(n, 1, true, ctx);
      expect(n.remainingFraction).toBe(remaining);
      expect(n.additionalTorqueNm).toBe(0);
    }
    run(n, 1, true);
    expect(n.remainingFraction).toBeLessThan(remaining);
    n.update(H, { ...valid, broken: true }, true);
    run(n, 1, true);
    expect(n.status).toBe('DISABLED');
    expect(n.additionalTorqueNm).toBe(0);
    n.reset();
    expect(n.remainingFraction).toBe(1);
  });

  it('uses only the available mass and stays empty until reset', () => {
    const n = new NitrousController(setup);
    run(n, 20, true);
    expect(n.telemetry()).toMatchObject({ status: 'DEPLETED', consumedKg: setup.capacityKg, flowKgPerS: 0, remainingFraction: 0 });
    expect(n.telemetry().activeTimeS).toBeCloseTo(nitrousPreview(setup, valid.rpm).durationS, 8);
    run(n, 1, false);
    run(n, 1, true);
    expect(n.telemetry().consumedKg).toBe(setup.capacityKg);
    n.reset();
    expect(n.status).toBe('READY');
  });

  it('uses the same integrated flow at different step sizes and cannot benefit from repeated pulses', () => {
    const a = new NitrousController(setup);
    const b = new NitrousController(setup);
    const pulsed = new NitrousController(setup);
    run(a, 1, true);
    run(b, 1, true, valid, H / 2);
    for (let i = 0; i < 120; i++) {
      pulsed.update(H, valid, true);
      pulsed.update(H, valid, false);
    }
    expect(a.telemetry().consumedKg).toBeCloseTo(b.telemetry().consumedKg, 10);
    expect(pulsed.telemetry().consumedKg).toBeLessThan(a.telemetry().consumedKg);
  });

  it('trades duration for power and reduces torque when fuel capacity is lower', () => {
    const high = nitrousPreview(setup, valid.rpm);
    const low = nitrousPreview({ ...setup, flow: 0.25 }, valid.rpm);
    expect(high.powerCv).toBeCloseTo(low.powerCv * 4);
    expect(high.durationS).toBeLessThan(low.durationS);
    expect(nitrousPreview({ ...setup, fuelSupply: 0.5 }, valid.rpm).torqueNm).toBeLessThan(high.torqueNm);
  });
});
