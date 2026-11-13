import { describe, expect, it } from 'vitest';
import { STANDARD_GRAVITY, airDensity, celsiusToKelvin } from '../../../src/core/units';
import { findCar } from '../../../src/data/cars/index';
import { TRACKS } from '../../../src/data/tracks/index';
import { TireModel } from '../../../src/physics/vehicle/TireModel';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';
import { peakSlipRatio } from '../../../src/game/ai/DragAI';

const H = 1 / 120;

describe('tire model (Magic Formula, slip ratio)', () => {
  const cfg = findCar('kronos-v8')!.tires;

  it('force grows with slip, saturates at μ·N and falls to a sliding value', () => {
    const tire = new TireModel(cfg);
    const N = 8000;
    const v = 10;
    const kPeak = peakSlipRatio(findCar('kronos-v8')!);
    const small = tire.evaluate(0.01 * v, v, N).force;
    const peak = tire.evaluate(kPeak * v, v, N).force;
    const slide = tire.evaluate(1.5 * v, v, N).force;
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(peak);
    expect(peak).toBeCloseTo(cfg.muPeak * tire.gripFactor * N, -1);
    expect(peak).toBeLessThanOrEqual(cfg.muPeak * 1.05 * N + 1e-6);
    expect(slide / peak).toBeGreaterThan(0.65);
    expect(slide / peak).toBeLessThan(0.9);
    // odd symmetry (braking slip)
    expect(tire.evaluate(-kPeak * v, v, N).force).toBeCloseTo(-peak, 6);
  });

  it('peak slip ratio is in the realistic 8–20 % range', () => {
    for (const id of ['arco-1600', 'vetra-rs', 'kronos-v8', 'tempest-v8']) {
      const k = peakSlipRatio(findCar(id)!);
      expect(k).toBeGreaterThan(0.08);
      expect(k).toBeLessThan(0.2);
    }
  });

  it('linearization slope keeps the implicit tire row dissipative', () => {
    const tire = new TireModel(cfg);
    for (const k of [0.05, 0.2, 0.5, 1, 3]) {
      const r = tire.evaluate(k * 5, 5, 6000);
      // secant/tangent max: slope ≥ F/Δv so the linear model never exceeds the curve backwards
      expect(r.slope).toBeGreaterThanOrEqual(Math.abs(r.force) / Math.abs(k * 5) - 1e-6);
    }
  });
});

describe('vehicle forces', () => {
  it('coast-down deceleration equals aerodynamic drag + rolling resistance over the effective mass', () => {
    const car = findCar('lince-gt')!;
    const track = TRACKS[0]!;
    const sim = new VehicleSimulation(car, track);
    for (let i = 0; i < 3 / H; i++) sim.step(H); // engine running, neutral
    const v = 40;
    sim.body.v = v;
    sim.driveline.v = v / car.tires.radiusM;
    sim.step(H);
    // forces of a step are evaluated at the velocity at the start of the step
    const vv = sim.speed - track.windMs;
    sim.step(H);
    const rho = airDensity(track.ambientPressurePa, celsiusToKelvin(track.ambientTempC));
    const aero = 0.5 * rho * car.dragCoefficient * car.frontalAreaM2 * vv * vv;
    expect(sim.dragForce / aero).toBeCloseTo(1, 9);
    const roll = car.tires.rollingResistance * track.rollingResistanceFactor * car.massKg * STANDARD_GRAVITY;
    expect(sim.rollingForce).toBeCloseTo(roll, 0);
    const r = car.tires.radiusM;
    const t = car.transmission;
    const mEff =
      car.massKg + (2 * car.tires.wheelInertiaKgM2) / r ** 2 + (2 * car.tires.wheelInertiaKgM2 + t.outputInertiaKgM2 * t.finalDrive ** 2) / r ** 2;
    const expected = -(aero + roll) / mEff;
    expect(sim.acceleration).toBeLessThan(0);
    expect(Math.abs(sim.acceleration - expected) / Math.abs(expected)).toBeLessThan(0.08);
  });

  it('energy balance: kinetic energy lost while coasting equals the work of the resistive forces', () => {
    const car = findCar('lince-gt')!;
    const track = TRACKS[0]!;
    const sim = new VehicleSimulation(car, track);
    for (let i = 0; i < 3 / H; i++) sim.step(H); // engine running, neutral: no engine torque reaches the wheels
    const r = car.tires.radiusM;
    const t = car.transmission;
    const iFree = 2 * car.tires.wheelInertiaKgM2;
    const iDriveline = 2 * car.tires.wheelInertiaKgM2 + t.outputInertiaKgM2 * t.finalDrive ** 2;
    const ke = (): number => 0.5 * car.massKg * sim.body.v ** 2 + 0.5 * iFree * (sim.body.v / r) ** 2 + 0.5 * iDriveline * sim.driveline.v ** 2;
    sim.body.v = 40;
    sim.driveline.v = 40 / r;
    const e0 = ke();
    let work = 0;
    for (let i = 0; i < 10 / H; i++) {
      const v = sim.body.v;
      const w = sim.driveline.v;
      sim.step(H);
      // dissipated power over the step: aero drag and rolling resistance on the body, viscous
      // driveline drag (0.015 N·m·s/rad) and tyre slip work (force × slip speed)
      work += H * ((sim.dragForce + sim.rollingForce) * v + 0.015 * w * w + Math.abs(sim.tireForce * (w * r - v)));
    }
    const lost = e0 - ke();
    expect(sim.body.v).toBeLessThan(40 - 3); // it really slowed down
    expect(lost).toBeGreaterThan(0);
    // the integrator neither creates nor destroys energy beyond the modelled losses (±2 %)
    expect(Math.abs(lost - work) / lost).toBeLessThan(0.02);
  });

  it('weight transfers to the rear under acceleration (pitch nose-up)', () => {
    const car = findCar('kronos-v8')!;
    const sim = new VehicleSimulation(car, TRACKS[0]!);
    for (let i = 0; i < 4 / H; i++) sim.step(H);
    sim.requestShift(1);
    for (let i = 0; i < 0.3 / H; i++) sim.step(H);
    const staticRear = car.massKg * STANDARD_GRAVITY * (1 - car.frontWeightFraction);
    sim.controls.pedal = 1;
    let maxRear = 0;
    for (let i = 0; i < 1.5 / H; i++) {
      sim.step(H);
      maxRear = Math.max(maxRear, sim.telemetry.normalLoadDriven);
    }
    expect(maxRear).toBeGreaterThan(staticRear * 1.08);
    expect(sim.loadTransfer).toBeGreaterThan(0);
  });

  it('wheelspin appears when torque exceeds grip (burnout on a low-grip surface)', () => {
    const car = findCar('tempest-v8')!;
    const wet = { ...TRACKS[0]!, surfaceGrip: 0.55 };
    const sim = new VehicleSimulation(car, wet);
    for (let i = 0; i < 4 / H; i++) sim.step(H);
    sim.requestShift(1);
    for (let i = 0; i < 0.3 / H; i++) sim.step(H);
    sim.controls.pedal = 1;
    let maxSlip = 0;
    for (let i = 0; i < 2 / H; i++) {
      sim.step(H);
      maxSlip = Math.max(maxSlip, sim.telemetry.slipRatio);
    }
    expect(maxSlip).toBeGreaterThan(0.4);
    // slip power heats the tire (bulk temperature, ~20 kW into ~30 kJ/K of rubber)
    expect(sim.tire.temperatureC).toBeGreaterThan(wet.surfaceTempC + 1);
  });
});
