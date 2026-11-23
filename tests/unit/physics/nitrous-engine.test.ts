/** N₂O in the simulation: the torque goes through the engine and the driveline, never around them. */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import type { CarConfig, NitrousConfig } from '../../../src/data/schema';
import { TRACKS } from '../../../src/data/tracks/index';
import { DragAI } from '../../../src/game/ai/DragAI';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;
const track = TRACKS.find((t) => t.id === 'test-track')!;
const nitro = (o: Partial<NitrousConfig> = {}): NitrousConfig => ({
  kitId: 'test', capacityKg: 0.04, maxFlowKgS: 0.0075, fuelNeed: 1, minRpm: 3000, mode: 'single', stage1Share: 1,
  stage1Flow: 1, stage1RampS: 0.3, stage2Flow: 1, stage2RampS: 0.3, fuelSupply: 1.2, torqueLimitNm: 0, ...o,
});
const withNitro = (base: CarConfig, o: Partial<NitrousConfig> = {}): CarConfig => ({ ...structuredClone(base), nitrous: nitro(o) });
const gol = findCampaignCar('vw-gol-gts-1988')!;

/** 402 m with the advanced AI; presses the nitro key once the car is in `gear` or higher (null = never). */
function race(car: CarConfig, gear: number | null): { et: number; maxSpeed: number; sim: VehicleSimulation } {
  const sim = new VehicleSimulation(car, track);
  sim.controls.autoStart = true;
  const ai = new DragAI(car, 'advanced', 7);
  for (let i = 0; i < 120 * 6; i++) {
    ai.update(H, sim, { timeSinceGreen: null, staged: true, finished: false });
    sim.controls.holdBrake = sim.gear === 0 || sim.controls.pedal < 0.02;
    sim.step(H);
  }
  sim.controls.holdBrake = false;
  const green = sim.simTime;
  let t0: number | null = null;
  let pressed = false;
  let et = NaN;
  for (let i = 0; i < 120 * 40; i++) {
    ai.update(H, sim, { timeSinceGreen: sim.simTime - green, staged: true, finished: false });
    sim.controls.holdBrake = false;
    if (gear !== null && !pressed && sim.gear >= gear) pressed = sim.requestNitrous();
    sim.step(H);
    if (t0 === null && sim.x > 0.29) t0 = sim.simTime;
    if (sim.x >= 402.336) {
      et = sim.simTime - t0!;
      break;
    }
  }
  return { et, maxSpeed: sim.maxRpm, sim };
}

describe('nitrous in the simulation', () => {
  it('a car without a kit has no nitrous system and the key does nothing', () => {
    const sim = new VehicleSimulation(gol, track);
    expect(sim.nitrous).toBeNull();
    expect(sim.requestNitrous()).toBe(false);
    expect(sim.telemetry.nitrous).toBeUndefined();
  });

  it('the injection adds crank torque while it runs and the engine goes back to normal after', () => {
    const base = new VehicleSimulation(gol, track);
    const nit = new VehicleSimulation(withNitro(gol), track);
    for (const s of [base, nit]) {
      s.controls.autoStart = true;
      for (let i = 0; i < 240; i++) s.step(H);
      s.controls.pedal = 0.3;
      for (let i = 0; i < 240; i++) s.step(H);
    }
    expect(Math.abs(base.engine.rpm - nit.engine.rpm)).toBeLessThan(1);
    expect(nit.engine.torqueCombustion).toBeCloseTo(base.engine.torqueCombustion, 3); // no injection: same engine
    expect(nit.requestNitrous()).toBe(true);
    let baseMax = 0;
    let nitMax = 0;
    let addMax = 0;
    for (let i = 0; i < 60; i++) {
      base.step(H);
      nit.step(H);
      baseMax = Math.max(baseMax, base.engine.torqueCombustion);
      nitMax = Math.max(nitMax, nit.engine.torqueCombustion); // the limiter cuts both now and then: compare the peaks
      addMax = Math.max(addMax, nit.telemetry.nitrous!.additionalTorqueNm);
    }
    expect(nitMax).toBeGreaterThan(baseMax + 3);
    expect(addMax).toBeGreaterThan(3);
    // run until it is empty: the extra torque is gone, the engine is the original one again
    // (on the limiter the injection pauses: it takes longer than the nominal seconds)
    for (let i = 0; i < 120 * 90 && nit.nitrous!.status !== 'DEPLETED'; i++) {
      base.step(H);
      nit.step(H);
    }
    expect(nit.nitrous!.status).toBe('DEPLETED');
    nit.step(H); // the last injected step is over: the next one has no extra torque
    expect(nit.engine.nitrousTorqueNm).toBe(0);
  });

  it('a restart gives a full cylinder again; a pause (no steps) spends nothing', () => {
    const sim = new VehicleSimulation(withNitro(gol), track);
    sim.controls.autoStart = true;
    for (let i = 0; i < 480; i++) sim.step(H);
    sim.controls.pedal = 0.3;
    for (let i = 0; i < 120; i++) sim.step(H);
    expect(sim.requestNitrous()).toBe(true);
    for (let i = 0; i < 60; i++) sim.step(H);
    const left = sim.nitrous!.remainingFraction;
    expect(left).toBeLessThan(1);
    // "paused": nothing is stepped
    expect(sim.nitrous!.remainingFraction).toBe(left);
    sim.reset();
    expect(sim.nitrous!.remainingFraction).toBe(1);
    expect(sim.nitrous!.status).toBe('READY');
  });

  it('the injected torque makes the car faster through the driveline (402 m)', () => {
    const car = withNitro(gol);
    const plain = race(gol, null);
    const fast = race(car, 2);
    expect(Number.isFinite(plain.et) && Number.isFinite(fast.et)).toBe(true);
    expect(fast.et).toBeLessThan(plain.et - 0.05);
    // it is the nitro that gains, not the extra mass: with the key never pressed the car is not faster
    const idle = race(car, null);
    expect(idle.et).toBeGreaterThan(plain.et - 0.01);
  }, 60_000);

  it('a stronger flow gains more while the tyres hold, and the gain is bounded by what the cylinder holds', () => {
    const weak = race(withNitro(gol, { stage1Flow: 0.25 }), 2);
    const strong = race(withNitro(gol, { stage1Flow: 0.5 }), 2);
    expect(strong.et).toBeLessThan(weak.et);
    expect(strong.sim.nitrous!.telemetry().consumedKg).toBeLessThanOrEqual(0.04 + 1e-9);
  }, 60_000);
});
