/**
 * Blown engine model: filtered speed, sustained-rest recovery, deterministic failure, BROKEN state
 * (no combustion, no autostart), a single ENGINE_BLOWN event and the reset of a restart.
 */
import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { failureSpecFor, failureSpecForCar, tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';
import { EngineOverrevFailure, LIMITER_SAG_RPM, RECOVERY_DELAY_S, strainLevel, strainLevelHyst } from '../../../src/physics/engine/EngineOverrevFailure';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;
const spec = { recommendedSafeRpm: 7000, maxSafeRpm: 8000, enduranceS: 3, recoveryPerS: 0.05 };
/** Filtered speed of x = 1 (held on a cut at the mechanical limit). */
const X1 = spec.maxSafeRpm - LIMITER_SAG_RPM;

/** Limiter-like saw-tooth: ±amp around `mid` with a 60 ms period. */
const saw = (i: number, mid: number, amp: number): number => mid + amp * (((i % 7) / 3.5) - 1);

describe('EngineOverrevFailure', () => {
  it('never accumulates below the recommended speed', () => {
    const f = new EngineOverrevFailure(spec);
    for (let i = 0; i < 120 * 60; i++) f.update(H, 6990, 1, 1, 1, i * H);
    expect(f.exposure).toBe(0);
    expect(f.broken).toBe(false);
  });

  it('a limiter saw-tooth peaking over the safe speed (factory cut) does not accumulate', () => {
    const f = new EngineOverrevFailure(spec);
    for (let i = 0; i < 120 * 30; i++) f.update(H, saw(i, 6900, 150), 1, 0, 0, i * H);
    expect(f.exposure).toBe(0);
  });

  it('breaks after ≈ enduranceS held at x = 1, full load (deterministic, finite)', () => {
    const run = (): number => {
      const f = new EngineOverrevFailure(spec);
      let i = 0;
      while (!f.broken && i < 120 * 30) {
        f.update(H, X1, 1, 0, 0, ++i * H);
        expect(Number.isFinite(f.exposure)).toBe(true);
      }
      return f.brokenAt!;
    };
    const t = run();
    expect(t).toBeGreaterThan(2.8);
    expect(t).toBeLessThan(3.4);
    expect(run()).toBe(t);
  });

  it('limiter cycling: dips under the safe speed while held never lower the exposure', () => {
    const f = new EngineOverrevFailure(spec);
    let prev = 0;
    let falls = 0;
    for (let i = 0; i < 240; i++) {
      // the saw-tooth crosses under the safe speed every cycle
      f.update(H, saw(i, X1 - 200, 1300), 1, 0, 0, i * H);
      if (f.exposure < prev) falls++;
      prev = f.exposure;
    }
    expect(f.exposure).toBeGreaterThan(0);
    expect(falls).toBe(0);
  });

  it('recovery starts only after a sustained rest, then falls gradually', () => {
    const f = new EngineOverrevFailure(spec);
    for (let i = 0; i < 180; i++) f.update(H, X1, 1, 0, 0, i * H);
    const e = f.exposure;
    // under the safe speed: the filter needs a moment, then RECOVERY_DELAY_S without recovery
    let firstFall = -1;
    for (let i = 0; i < 120 * 10; i++) {
      f.update(H, 3000, 0.2, 0, 0, i * H);
      if (firstFall < 0 && f.exposure < e) firstFall = i * H;
    }
    expect(firstFall).toBeGreaterThanOrEqual(RECOVERY_DELAY_S);
    expect(f.exposure).toBeLessThan(e);
    expect(f.exposure).toBeGreaterThanOrEqual(0);
  });

  it('a mechanical over-rev (x well above 1) breaks within 0.5–1.5 s', () => {
    const f = new EngineOverrevFailure(spec);
    let i = 0;
    while (!f.broken && i < 120 * 10) f.update(H, 9500, 1, 0, 0, ++i * H);
    expect(f.brokenAt!).toBeGreaterThan(0.5);
    expect(f.brokenAt!).toBeLessThan(1.5);
  });

  it('strain = accumulated exposure only (not the instantaneous excess); 1 once broken', () => {
    const f = new EngineOverrevFailure(spec);
    f.update(H, 9000, 1, 0, 0, 0);
    expect(f.excess).toBeGreaterThan(1);
    expect(f.strain).toBe(f.exposure);
    expect(f.strain).toBeLessThan(0.05);
  });

  it('bands use hysteresis', () => {
    expect(strainLevel(0)).toBe('normal');
    expect(strainLevel(0.2)).toBe('elevated');
    expect(strainLevel(0.5)).toBe('high');
    expect(strainLevel(0.8)).toBe('critical');
    expect(strainLevelHyst(0.43, 'high')).toBe('high');
    expect(strainLevelHyst(0.39, 'high')).toBe('elevated');
    expect(strainLevelHyst(0.72, 'critical')).toBe('critical');
    expect(strainLevelHyst(0.69, 'critical')).toBe('high');
    expect(strainLevelHyst(0.44, 'elevated')).toBe('elevated');
  });
});

describe('blown engine in the vehicle simulation', () => {
  const base = CAREER_CARS.find((c) => c.id === 'vw-golf-gti-mk4-2003')!;
  const parts = ['ecu-programmable'];
  const caps = tuningCapabilities(base, parts, 2);

  it('factory build on the limiter for 30 s does not break', () => {
    const car = resolveBuild(base, [], {}, 2);
    if (!car.ok) throw new Error(car.errors.join());
    const sim = new VehicleSimulation(car.car, TRACKS[0]!);
    sim.enableEngineFailure(failureSpecFor(base, [], 2));
    for (let i = 0; i < 240; i++) sim.step(H);
    sim.controls.pedal = 1;
    for (let i = 0; i < 120 * 30; i++) sim.step(H);
    expect(sim.engine.runState).not.toBe('BROKEN');
    expect(sim.failure!.exposure).toBe(0);
  });

  it('critical cut held breaks in 2–4 s, once: BROKEN, no restart, one event; reset restores it', () => {
    const r = resolveBuild(base, parts, { revLimitRpm: caps.revLimit.max }, 2);
    if (!r.ok) throw new Error(r.errors.join());
    const sim = new VehicleSimulation(r.car, TRACKS[0]!);
    sim.enableEngineFailure(failureSpecFor(base, parts, 2));
    const events: string[] = [];
    sim.onEvent = (e) => events.push(e.type);
    sim.controls.autoStart = true;
    for (let i = 0; i < 240; i++) sim.step(H);
    sim.controls.pedal = 1;
    const t0 = sim.simTime;
    for (let i = 0; i < 120 * 30 && sim.engine.runState !== 'BROKEN'; i++) sim.step(H);
    expect(sim.engine.runState).toBe('BROKEN');
    const at = sim.failure!.brokenAt! - t0;
    expect(at).toBeGreaterThan(2);
    expect(at).toBeLessThan(4);
    for (let i = 0; i < 120 * 5; i++) sim.step(H);
    expect(sim.engine.runState).toBe('BROKEN');
    expect(events.filter((e) => e === 'ENGINE_BLOWN')).toHaveLength(1);
    expect(sim.engine.rpm).toBeLessThan(500);
    // restart (Sandbox R): fresh engine, failures still on, breaks again the same way
    sim.reset();
    sim.controls.autoStart = true;
    expect(sim.failure).not.toBeNull();
    expect(sim.failure!.exposure).toBe(0);
    expect(sim.failure!.broken).toBe(false);
    for (let i = 0; i < 240; i++) sim.step(H);
    expect(sim.engine.runState).toBe('RUNNING');
    sim.controls.pedal = 1;
    const t1 = sim.simTime;
    for (let i = 0; i < 120 * 30 && sim.engine.runState !== 'BROKEN'; i++) sim.step(H);
    expect(sim.failure!.brokenAt! - t1).toBeCloseTo(at, 6);
  });

  it('sandbox: a raised cut does not raise the safe speed; a raised mechanical limit does', () => {
    const ref = base;
    const edited = { ...ref, engine: { ...ref.engine, revLimitRpm: ref.engine.maxSafeRpm } };
    expect(failureSpecForCar(edited, ref).recommendedSafeRpm).toBe(failureSpecForCar(ref).recommendedSafeRpm);
    expect(failureSpecForCar(edited).recommendedSafeRpm).toBeGreaterThan(failureSpecForCar(ref).recommendedSafeRpm);
    const stronger = { ...ref, engine: { ...ref.engine, maxSafeRpm: ref.engine.maxSafeRpm + 500 } };
    expect(failureSpecForCar(stronger, ref).maxSafeRpm).toBeGreaterThan(failureSpecForCar(ref).maxSafeRpm);
  });
});
