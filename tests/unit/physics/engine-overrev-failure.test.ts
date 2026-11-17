/**
 * Blown engine model: deterministic exposure, recovery, BROKEN state (no combustion, no autostart)
 * and a single ENGINE_BLOWN event.
 */
import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { failureSpecFor, tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';
import { EngineOverrevFailure, strainLevel } from '../../../src/physics/engine/EngineOverrevFailure';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;
const spec = { recommendedSafeRpm: 7000, maxSafeRpm: 8000, enduranceS: 4, recoveryPerS: 0.04 };

describe('EngineOverrevFailure', () => {
  it('never accumulates below the recommended speed', () => {
    const f = new EngineOverrevFailure(spec);
    for (let i = 0; i < 120 * 60; i++) f.update(H, 6990, 1, 1, 1, i * H);
    expect(f.exposure).toBe(0);
    expect(f.broken).toBe(false);
  });

  it('breaks after enduranceS at the mechanical limit, full load (deterministic)', () => {
    const run = (): number => {
      const f = new EngineOverrevFailure(spec);
      let i = 0;
      while (!f.broken && i < 120 * 30) f.update(H, 8000, 1, 0, 0, ++i * H);
      return f.brokenAt!;
    };
    const t = run();
    expect(t).toBeCloseTo(4, 1);
    expect(run()).toBe(t);
  });

  it('recovers below the recommended speed', () => {
    const f = new EngineOverrevFailure(spec);
    for (let i = 0; i < 240; i++) f.update(H, 8000, 1, 0, 0, i * H);
    const e = f.exposure;
    for (let i = 0; i < 1200; i++) f.update(H, 3000, 0.2, 0, 0, i * H);
    expect(f.exposure).toBeLessThan(e);
    expect(f.exposure).toBeGreaterThanOrEqual(0);
  });

  it('strain bands', () => {
    expect(strainLevel(0)).toBe('normal');
    expect(strainLevel(0.2)).toBe('elevated');
    expect(strainLevel(0.5)).toBe('high');
    expect(strainLevel(0.8)).toBe('critical');
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
  });

  it('max cut on the limiter breaks once: BROKEN, no restart, one event', () => {
    const r = resolveBuild(base, parts, { revLimitRpm: caps.revLimit.max }, 2);
    if (!r.ok) throw new Error(r.errors.join());
    const sim = new VehicleSimulation(r.car, TRACKS[0]!);
    sim.enableEngineFailure(failureSpecFor(base, parts, 2));
    const events: string[] = [];
    sim.onEvent = (e) => events.push(e.type);
    sim.controls.autoStart = true;
    for (let i = 0; i < 240; i++) sim.step(H);
    sim.controls.pedal = 1;
    for (let i = 0; i < 120 * 30 && sim.engine.runState !== 'BROKEN'; i++) sim.step(H);
    expect(sim.engine.runState).toBe('BROKEN');
    for (let i = 0; i < 120 * 5; i++) sim.step(H);
    expect(sim.engine.runState).toBe('BROKEN');
    expect(events.filter((e) => e === 'ENGINE_BLOWN')).toHaveLength(1);
    expect(sim.engine.rpm).toBeLessThan(500);
  });
});
