import { describe, expect, it } from 'vitest';
import { ENGINES } from '../../../src/data/engines/index';
import { EngineDyno } from '../../../src/physics/engine/EngineDyno';
import { EngineModel } from '../../../src/physics/engine/EngineModel';
import { engineGeometry, numericalDisplacement } from '../../../src/physics/engine/EngineGeometry';
import { IgnitionModule } from '../../../src/physics/engine/IgnitionModule';
import { FOUR_PI, radSToRpm, rpmToRadS, wattsToCv } from '../../../src/core/units';
import { Prng } from '../../../src/core/prng';

const H = 1 / 120;
const byId = (id: string) => ENGINES.find((e) => e.id === id)!;

describe('engine geometry', () => {
  it.each(ENGINES.map((e) => [e.id, e] as const))('%s numerical displacement equals the analytic swept volume', (_id, e) => {
    const g = engineGeometry(e);
    const analytic = (Math.PI / 4) * (e.boreMm / 1000) ** 2 * (e.strokeMm / 1000) * e.cylinders;
    expect(g.displacement).toBeCloseTo(analytic, 9);
    expect(numericalDisplacement(g, e.cylinders) / analytic).toBeCloseTo(1, 3);
  });
});

describe('ignition module (engine-sim port)', () => {
  it.each(ENGINES.map((e) => [e.id, e] as const))('%s fires each cylinder exactly once per 720°', (_id, e) => {
    const ign = new IgnitionModule(e.firingAnglesDeg, rpmToRadS(20000), 0.05);
    ign.enabledGlobal = true;
    const omega = rpmToRadS(3000);
    let theta = 0;
    ign.reset(0);
    let events = 0;
    const cycles = 10;
    const steps = Math.round((cycles * FOUR_PI) / (omega * H));
    for (let i = 0; i < steps; i++) {
      theta += omega * H;
      events += ign.update(H, theta % FOUR_PI, omega);
    }
    expect(Math.abs(events - cycles * e.cylinders)).toBeLessThanOrEqual(e.cylinders);
  });

  it('rev limiter cuts ignition for the configured time (hysteresis)', () => {
    const e = byId('kronos-v8-57');
    const ign = new IgnitionModule(e.firingAnglesDeg, rpmToRadS(e.revLimitRpm), e.limiterCutTimeS);
    ign.enabledGlobal = true;
    ign.update(H, 0.1, rpmToRadS(e.revLimitRpm + 50));
    expect(ign.limiterActive).toBe(true);
    // stays cut even below the limit until the timer expires
    let t = H;
    while (ign.limiterActive && t < 1) {
      ign.update(H, 0.2, rpmToRadS(e.revLimitRpm - 500));
      t += H;
    }
    expect(t).toBeGreaterThanOrEqual(e.limiterCutTimeS - 1e-9);
    expect(t).toBeLessThan(e.limiterCutTimeS + 2 * H);
  });
});

describe('engine model: start, idle and stall', () => {
  it.each(ENGINES.map((e) => [e.id, e] as const))('%s starts with the starter and settles at its idle speed', (_id, e) => {
    const d = new EngineDyno(e);
    expect(d.engine.runState).toBe('OFF');
    expect(d.start()).toBe(true);
    for (let i = 0; i < 6 / H; i++) d.step(H);
    expect(d.engine.runState).toBe('RUNNING');
    expect(Math.abs(d.engine.rpm - e.idleRpm)).toBeLessThan(25);
    expect(d.engine.stallCount).toBe(0);
    // idle manifold vacuum is in a realistic range (20–45 kPa abs)
    expect(d.engine.manifoldPressure).toBeGreaterThan(20e3);
    expect(d.engine.manifoldPressure).toBeLessThan(45e3);
  });

  it('cannot start without ignition and is OFF with the ignition switched off', () => {
    const d = new EngineDyno(byId('arco-i4-16'));
    d.inputs.ignitionOn = false;
    d.inputs.starter = true;
    for (let i = 0; i < 2 / H; i++) d.step(H);
    expect(d.engine.runState).toBe('OFF');
    expect(d.engine.torqueCombustion).toBe(0);
  });

  it('stalls when loaded beyond its torque at low speed', () => {
    const d = new EngineDyno(byId('arco-i4-16'));
    d.start();
    for (let i = 0; i < 3 / H; i++) d.step(H);
    // dynamometer brakes the crank to zero speed with a large torque
    d.engine.dyno.enabled = true;
    d.engine.dyno.hold = false;
    d.engine.dyno.targetOmega = 0;
    d.engine.dyno.maxTorque = 400;
    for (let i = 0; i < 2 / H; i++) d.step(H);
    expect(d.engine.runState).toBe('STALLED');
    expect(d.engine.stallCount).toBeGreaterThanOrEqual(1);
  });
});

describe('engine model: torque and power are measured, not imposed', () => {
  it.each(ENGINES.map((e) => [e.id, e] as const))('%s full-load dyno torque follows the configured curve', (_id, e) => {
    const d = new EngineDyno(e);
    d.start();
    const turbo = e.induction === 'turbo';
    const pts = [0.35, 0.55, 0.75, 0.92].map((f) => Math.round(e.idleRpm + f * (e.redlineRpm - e.idleRpm)));
    for (const rpm of pts) {
      if (turbo && rpm < 2000) continue;
      const p = d.measure(rpm, 1, H, turbo ? 6 : 2, 0.4);
      const ref = d.engine.torqueCurve.evaluate(rpm);
      expect(Math.abs(p.torqueNm - ref) / ref).toBeLessThan(0.01);
      // P = T·ω and cv = W/735.49875
      expect(p.powerW).toBeCloseTo(p.torqueNm * rpmToRadS(p.rpm), 6);
      expect(p.powerCv).toBeCloseTo(wattsToCv(p.powerW), 9);
    }
  });

  it.each(ENGINES.map((e) => [e.id, e] as const))('%s peak power emerges from T·ω within 1.5 % of the rated value', (_id, e) => {
    const d = new EngineDyno(e);
    d.start();
    let peak = 0;
    for (let rpm = Math.round(e.redlineRpm * 0.7); rpm <= e.revLimitRpm - 100; rpm += 100) {
      const p = d.measure(rpm, 1, H, e.induction === 'turbo' ? 1.5 : 0.8, 0.2);
      peak = Math.max(peak, p.powerCv);
    }
    expect(Math.abs(peak - e.ratedPowerCv) / e.ratedPowerCv).toBeLessThan(0.015);
  });

  it('part throttle produces less torque and lower manifold pressure than WOT', () => {
    const d = new EngineDyno(byId('lince-v6-35'));
    d.start();
    const wot = d.measure(3000, 1);
    const part = d.measure(3000, 0.15);
    expect(part.torqueNm).toBeLessThan(wot.torqueNm * 0.8);
    expect(part.manifoldPa).toBeLessThan(wot.manifoldPa * 0.8);
  });

  it('closed throttle at speed gives negative (engine braking) torque', () => {
    const d = new EngineDyno(byId('kronos-v8-57'));
    d.start();
    const p = d.measure(3500, 0);
    expect(p.torqueNm).toBeLessThan(0);
  });
});

describe('engine model: limiter, turbo and robustness', () => {
  it('free-revving at WOT is held by the rev limiter', () => {
    const e = byId('tempest-v8-40fp');
    const d = new EngineDyno(e);
    d.start();
    d.inputs.pedal = 1;
    let maxRpm = 0;
    let limiterSeen = false;
    for (let i = 0; i < 4 / H; i++) {
      d.step(H);
      maxRpm = Math.max(maxRpm, d.engine.rpm);
      limiterSeen ||= d.engine.ignition.limiterActive;
    }
    expect(limiterSeen).toBe(true);
    expect(maxRpm).toBeLessThan(e.revLimitRpm + 350);
    expect(maxRpm).toBeGreaterThan(e.revLimitRpm - 200);
  });

  it('turbo boost builds over time under load (spool) and the BOV vents on lift-off', () => {
    const e = byId('orion-i6-30t');
    const d = new EngineDyno(e);
    d.start();
    const t = d.engine.turbo!;
    d.engine.dyno.enabled = true;
    d.engine.dyno.hold = true;
    d.engine.dyno.targetOmega = rpmToRadS(4500);
    d.inputs.pedal = 1;
    d.step(H);
    const b0 = t.boostPa;
    for (let i = 0; i < 0.3 / H; i++) d.step(H);
    const b03 = t.boostPa;
    for (let i = 0; i < 3 / H; i++) d.step(H);
    const bFull = t.boostPa;
    expect(b0).toBeLessThan(0.1e5);
    expect(b03).toBeGreaterThan(b0);
    expect(b03).toBeLessThan(bFull * 0.9);
    expect(Math.abs(bFull - e.turbo!.maxBoostBar * 1e5) / (e.turbo!.maxBoostBar * 1e5)).toBeLessThan(0.05);
    // lift
    d.inputs.pedal = 0;
    let maxBov = 0;
    for (let i = 0; i < 0.5 / H; i++) {
      d.step(H);
      maxBov = Math.max(maxBov, t.bovFlow);
    }
    expect(maxBov).toBeGreaterThan(0.2);
    expect(t.boostPa).toBeLessThan(0.3e5);
  });

  it('stays finite under random inputs', () => {
    const prng = new Prng(99);
    for (const e of ENGINES) {
      const d = new EngineDyno(e);
      d.start();
      for (let i = 0; i < 4 / H; i++) {
        if (i % 30 === 0) {
          d.inputs.pedal = prng.next();
          d.inputs.sparkCut = prng.next() < 0.1 ? 1 : 0;
          d.engine.dyno.enabled = prng.next() < 0.5;
          d.engine.dyno.targetOmega = prng.next() * rpmToRadS(e.revLimitRpm);
        }
        d.step(H);
        expect(Number.isFinite(d.engine.omega)).toBe(true);
        expect(Number.isFinite(d.engine.manifoldPressure)).toBe(true);
        expect(Number.isFinite(d.engine.torqueCombustion)).toBe(true);
      }
    }
  });

  it('result does not depend on the step size (fixed-step integration converges)', () => {
    const run = (h: number) => {
      const d = new EngineDyno(byId('kronos-v8-57'));
      d.start(h);
      for (let t = 0; t < 2; t += h) d.step(h);
      d.inputs.pedal = 1;
      let t = 0;
      while (d.engine.rpm < 5000 && t < 5) {
        d.step(h);
        t += h;
      }
      return t;
    };
    const t120 = run(1 / 120);
    const t240 = run(1 / 240);
    expect(Math.abs(t120 - t240) / t240).toBeLessThan(0.03);
  });

  it('exposes a telemetry frame consistent with the state', () => {
    const e = byId('vetra-i4-20t');
    const m = new EngineModel(e);
    expect(m.frame.engineId).toBe(e.id);
    const d = new EngineDyno(e);
    d.start();
    for (let i = 0; i < 1 / H; i++) d.step(H);
    const f = d.engine.frame;
    expect(f.rpm).toBeCloseTo(radSToRpm(d.engine.omega), 9);
    expect(f.crankAngle).toBeGreaterThanOrEqual(0);
    expect(f.crankAngle).toBeLessThan(FOUR_PI);
    expect(f.runState).toBe('RUNNING');
  });
});
