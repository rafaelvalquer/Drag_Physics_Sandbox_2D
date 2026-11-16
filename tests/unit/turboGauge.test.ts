/** Turbo gauge: visibility by build, Pa→bar conversion, dial range, needle filter and live boost. */
import { describe, expect, it } from 'vitest';
import { cloneCar, findCar } from '../../src/data/cars/index';
import { TRACKS } from '../../src/data/tracks/index';
import { VehicleSimulation } from '../../src/physics/vehicle/VehicleSimulation';
import { boostAngle, paToBar, smoothBoost, turboGaugeMax, turboGaugeState } from '../../src/ui/hud/TurboGauge';

function sim(id: string): VehicleSimulation {
  const car = findCar(id);
  if (!car) throw new Error(id);
  return new VehicleSimulation(car, TRACKS[0]!);
}

describe('turbo gauge', () => {
  it('is hidden for a naturally aspirated car and shown for a turbo car', () => {
    expect(turboGaugeState(sim('arco-1600')).visible).toBe(false);
    const t = turboGaugeState(sim('vetra-rs'));
    expect(t.visible).toBe(true);
    expect(t.maxBoostBar).toBeGreaterThan(0);
  });

  it('follows the effective build: a turbo kit makes it visible, removing the turbo hides it', () => {
    const turbo = findCar('vetra-rs')!;
    const kit = cloneCar(findCar('arco-1600')!);
    kit.engine = { ...kit.engine, induction: 'turbo', turbo: turbo.engine.turbo };
    expect(turboGaugeState(new VehicleSimulation(kit, TRACKS[0]!)).visible).toBe(true);
    const stripped = cloneCar(turbo);
    stripped.engine = { ...stripped.engine, induction: 'NA', turbo: undefined };
    expect(turboGaugeState(new VehicleSimulation(stripped, TRACKS[0]!)).visible).toBe(false);
  });

  it('converts Pa to bar and clamps negatives / non-finite values', () => {
    expect(paToBar(0)).toBe(0);
    expect(paToBar(100_000)).toBe(1);
    expect(paToBar(65_000)).toBeCloseTo(0.65, 12);
    expect(paToBar(-5000)).toBe(0);
    expect(paToBar(NaN)).toBe(0);
  });

  it('dial range = configured boost + 20 %, rounded up to 0.1 and clamped to 0.8..2.5 bar', () => {
    expect(turboGaugeMax(0.3)).toBe(0.8);
    expect(turboGaugeMax(0.6)).toBe(0.8);
    expect(turboGaugeMax(1.0)).toBe(1.2);
    expect(turboGaugeMax(1.5)).toBe(1.8);
    expect(turboGaugeMax(5)).toBe(2.5);
  });

  it('needle angle clamps to the dial', () => {
    expect(boostAngle(-1, 1.2)).toBe(boostAngle(0, 1.2));
    expect(boostAngle(9, 1.2)).toBe(boostAngle(1.2, 1.2));
    expect(boostAngle(0.6, 1.2)).toBeGreaterThan(boostAngle(0, 1.2));
  });

  it('visual filter converges without overshoot and keeps the target when dt = 0', () => {
    let s = 0;
    for (let i = 0; i < 6; i++) {
      s = smoothBoost(s, 1, 1 / 60);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(s).toBeGreaterThan(0.5);
    expect(smoothBoost(0.2, 0.9, 0)).toBe(0.9);
    expect(smoothBoost(0.2, NaN, 0.016)).toBe(0);
  });

  it('reads the real simulated boost: rises when revving at full throttle and falls when lifting', () => {
    const s = sim('vetra-rs');
    s.controls.pedal = 1;
    let peak = 0;
    for (let i = 0; i < 1200; i++) {
      s.step(1 / 120);
      peak = Math.max(peak, turboGaugeState(s).boostBar);
    }
    const state = turboGaugeState(s);
    expect(state.boostBar).toBeCloseTo(s.engine.turbo!.boostPa / 1e5, 12);
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThanOrEqual(state.maxBoostBar * 1.31);
    s.controls.pedal = 0;
    for (let i = 0; i < 600; i++) s.step(1 / 120);
    expect(turboGaugeState(s).boostBar).toBeLessThan(peak * 0.5);
  });
});
