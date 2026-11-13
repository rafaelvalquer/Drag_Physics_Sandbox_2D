/**
 * Semi-automatic transmission: the ten acceptance tests of the plan change
 * ("ALTERAÇÃO DO PLANO TÉCNICO — TRANSMISSÃO SEMIAUTOMÁTICA") plus automatic braking.
 * The player only has throttle (W), upshift (E) and downshift (Q).
 */
import { describe, expect, it } from 'vitest';
import { AF } from '../../../src/core/contracts';
import { radSToRpm } from '../../../src/core/units';
import { findCar } from '../../../src/data/cars/index';
import { TRACKS } from '../../../src/data/tracks/index';
import { DragAI } from '../../../src/game/ai/DragAI';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';
import type { ShiftState } from '../../../src/core/contracts';

const H = 1 / 120;

function makeSim(carId = 'kronos-v8'): VehicleSimulation {
  const car = findCar(carId);
  if (!car) throw new Error(`car ${carId} not found`);
  return new VehicleSimulation(car, TRACKS[0]!);
}

function run(sim: VehicleSimulation, seconds: number, each?: (s: VehicleSimulation) => void): void {
  const n = Math.round(seconds / H);
  for (let i = 0; i < n; i++) {
    sim.step(H);
    each?.(sim);
  }
}

/** Enter the track: the engine starts by itself; E selects first gear. */
function readyInFirst(sim: VehicleSimulation): void {
  run(sim, 4);
  expect(sim.engine.runState).toBe('RUNNING');
  expect(sim.requestShift(1)).toBe('started');
  run(sim, 0.3);
  expect(sim.gear).toBe(1);
}

/** Accelerate flat out, upshifting with E near the redline (player-like). */
function driveTo(sim: VehicleSimulation, gear: number, rpm: number, pedal = 1): void {
  sim.controls.pedal = pedal;
  let guard = 0;
  while (guard++ < 120 * 30) {
    sim.step(H);
    if (sim.shift.active) continue;
    if (sim.gear < gear && sim.engine.rpm > sim.car.engine.redlineRpm - 400 && sim.clutchCtl.mode === 'LOCKED') {
      sim.requestShift(1);
      continue;
    }
    if (sim.gear === gear && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm >= rpm) return;
  }
  throw new Error(`could not reach gear ${gear} at ${rpm} rpm`);
}

function phasesDuring(sim: VehicleSimulation, maxS: number, sample: (s: VehicleSimulation, st: ShiftState) => void): void {
  let t = 0;
  while (t < maxS) {
    sim.step(H);
    t += H;
    sample(sim, sim.shift.state);
    if (!sim.shift.active) break;
  }
}

describe('semi-automatic transmission', () => {
  it('1. launches without any clutch command (there is no clutch control)', () => {
    const sim = makeSim();
    expect(Object.keys(sim.controls)).not.toContain('clutch');
    readyInFirst(sim);
    // E with the clutch open: car stands still
    expect(sim.clutchCtl.engagement).toBeLessThan(0.05);
    run(sim, 1);
    expect(Math.abs(sim.speed)).toBeLessThan(0.05);
    // W: the automatic clutch performs the launch
    sim.controls.pedal = 1;
    const modes = new Set<string>();
    run(sim, 3, (s) => modes.add(s.clutchCtl.mode));
    expect(modes.has('LAUNCH')).toBe(true);
    expect(sim.clutchCtl.mode).toBe('LOCKED');
    expect(sim.speed).toBeGreaterThan(10);
    expect(sim.engine.runState).toBe('RUNNING');
    expect(sim.engine.stallCount).toBe(0);
  });

  it('2. clutch engagement is progressive and the slip closes smoothly', () => {
    const sim = makeSim('arco-1600');
    readyInFirst(sim);
    sim.controls.pedal = 1;
    let tStart = -1;
    let tLock = -1;
    let maxStepIncrease = 0;
    let prev = sim.clutchCtl.engagement;
    let minRpm = Infinity;
    run(sim, 4, (s) => {
      const e = s.clutchCtl.engagement;
      maxStepIncrease = Math.max(maxStepIncrease, e - prev);
      prev = e;
      if (tStart < 0 && e > 0.02) tStart = s.simTime;
      if (tStart >= 0 && tLock < 0 && s.clutchCtl.mode === 'LOCKED') tLock = s.simTime;
      if (tStart >= 0) minRpm = Math.min(minRpm, s.engine.rpm);
    });
    expect(tStart).toBeGreaterThan(0);
    expect(tLock - tStart).toBeGreaterThan(0.1); // not an on/off step
    expect(maxStepIncrease).toBeLessThan(0.25); // no jump to full clamp in one step
    expect(minRpm).toBeGreaterThan(sim.car.engine.idleRpm * 0.8); // no bog
    expect(Math.abs(radSToRpm(sim.telemetry.clutchSlip))).toBeLessThan(5);
  });

  it('3. an upshift interrupts the torque and runs through every phase', () => {
    const sim = makeSim();
    readyInFirst(sim);
    driveTo(sim, 1, 5200);
    const accBefore = sim.acceleration;
    const states = new Set<ShiftState>();
    let maxCut = 0;
    let minWheelTorque = Infinity;
    let openClutchTorque = 0;
    const t0 = sim.simTime;
    expect(sim.requestShift(1)).toBe('started');
    phasesDuring(sim, 1, (s, st) => {
      states.add(st);
      maxCut = Math.max(maxCut, s.shift.sparkCut);
      minWheelTorque = Math.min(minWheelTorque, s.telemetry.wheelTorque);
      if (st === 'GEAR_CHANGE') openClutchTorque = Math.max(openClutchTorque, Math.abs(s.clutchTorque));
    });
    const duration = sim.simTime - t0;
    for (const st of ['TORQUE_CUT', 'CLUTCH_DISENGAGE', 'GEAR_CHANGE', 'REV_MATCH', 'CLUTCH_ENGAGE'] as const) {
      expect(states.has(st)).toBe(true);
    }
    expect(sim.gear).toBe(2);
    expect(maxCut).toBe(1);
    expect(openClutchTorque).toBe(0);
    expect(minWheelTorque).toBeLessThan(50);
    const sh = sim.car.transmission.shift;
    const minDuration = sh.torqueCutTimeS + sh.clutchDisengageTimeS + sh.gearChangeTimeS + sh.clutchEngageTimeS;
    expect(duration).toBeGreaterThanOrEqual(minDuration - 2 * H);
    expect(duration).toBeLessThan(0.45);
    // drive is restored afterwards
    run(sim, 0.3);
    expect(sim.acceleration).toBeGreaterThan(0.3 * accBefore);
  });

  it('4. engine speed falls to the new gear by inertia, never assigned', () => {
    const sim = makeSim();
    readyInFirst(sim);
    driveTo(sim, 1, 5200);
    const rpm0 = sim.engine.rpm;
    const ratio = sim.gearbox.overallRatio(2) / sim.gearbox.overallRatio(1);
    let maxStepDrop = 0;
    let prev = rpm0;
    sim.requestShift(1);
    phasesDuring(sim, 1, (s) => {
      maxStepDrop = Math.max(maxStepDrop, prev - s.engine.rpm);
      prev = s.engine.rpm;
    });
    const totalDrop = rpm0 - sim.engine.rpm;
    expect(totalDrop).toBeGreaterThan(rpm0 * (1 - ratio) * 0.6);
    // bounded by the torques acting on the crank inertia (no step change)
    expect(maxStepDrop).toBeLessThan(totalDrop * 0.2);
    // locked to the road speed in the new gear at the end
    const roadRpm = radSToRpm(sim.driveline.v * sim.gearbox.overallRatio(2));
    expect(Math.abs(sim.engine.rpm - roadRpm)).toBeLessThan(150);
  });

  it('5. a downshift blips the throttle and matches the revs before re-engaging', () => {
    const sim = makeSim();
    readyInFirst(sim);
    driveTo(sim, 3, 3000, 1);
    sim.controls.pedal = 0;
    run(sim, 0.4);
    const target = () => radSToRpm(sim.driveline.v * sim.gearbox.overallRatio(2));
    expect(sim.requestShift(-1)).toBe('started');
    let maxBlip = 0;
    let rpmAtEngage = -1;
    let targetAtEngage = -1;
    let minAccel = 0;
    phasesDuring(sim, 1.5, (s, st) => {
      if (st === 'REV_MATCH' || st === 'GEAR_CHANGE') maxBlip = Math.max(maxBlip, s.shift.throttleOverride ?? 0);
      if (st === 'CLUTCH_ENGAGE' && rpmAtEngage < 0) {
        rpmAtEngage = s.engine.rpm;
        targetAtEngage = target();
      }
      minAccel = Math.min(minAccel, s.acceleration);
    });
    expect(sim.gear).toBe(2);
    expect(maxBlip).toBeGreaterThan(0.1);
    expect(Math.abs(rpmAtEngage - targetAtEngage)).toBeLessThan(sim.car.transmission.shift.revMatch.toleranceRpm + 200);
    // no violent engine-braking jolt
    expect(minAccel).toBeGreaterThan(-0.6 * 9.81);
  });

  it('6. a downshift that would over-rev the engine is refused', () => {
    const sim = makeSim();
    readyInFirst(sim);
    driveTo(sim, 3, sim.car.engine.redlineRpm - 700);
    const res = sim.requestShift(-1);
    expect(res).toBe('rejected-overrev');
    run(sim, 0.5);
    expect(sim.gear).toBe(3);
    expect(sim.engine.rpm).toBeLessThan(sim.car.engine.revLimitRpm + 100);
  });

  it('7. the engine keeps running when the car stops in gear', () => {
    const sim = makeSim('lince-gt');
    readyInFirst(sim);
    driveTo(sim, 2, 4500);
    sim.controls.pedal = 0;
    sim.controls.autoBrake = true;
    run(sim, 8);
    expect(Math.abs(sim.speed)).toBeLessThan(0.05);
    expect(sim.engine.runState).toBe('RUNNING');
    expect(sim.engine.stallCount).toBe(0);
    expect(['OPEN', 'ANTI_STALL']).toContain(sim.clutchCtl.mode);
    expect(Math.abs(sim.engine.rpm - sim.car.engine.idleRpm)).toBeLessThan(200);
  });

  it('8. a shift changes the signals that drive the sound (from physics state)', () => {
    const sim = makeSim();
    readyInFirst(sim);
    driveTo(sim, 1, 5000);
    const before = { cut: sim.audioFrame[AF.sparkCut]!, gear: sim.audioFrame[AF.gear]!, torque: sim.audioFrame[AF.transmissionTorque]! };
    sim.requestShift(1);
    let maxCut = 0;
    let minTorque = Infinity;
    let maxSlip = 0;
    phasesDuring(sim, 1, (s) => {
      maxCut = Math.max(maxCut, s.audioFrame[AF.sparkCut]!);
      minTorque = Math.min(minTorque, Math.abs(s.audioFrame[AF.transmissionTorque]!));
      maxSlip = Math.max(maxSlip, Math.abs(s.audioFrame[AF.clutchSlipOmega]!));
    });
    expect(before.cut).toBe(0);
    expect(maxCut).toBe(1);
    expect(minTorque).toBeLessThan(Math.abs(before.torque) * 0.1);
    expect(maxSlip).toBeGreaterThan(5);
    expect(sim.audioFrame[AF.gear]).toBe(before.gear + 1);
  });

  it('9. a quarter mile is completed with throttle and shift requests only', () => {
    const sim = makeSim('vetra-rs');
    readyInFirst(sim);
    sim.controls.pedal = 1;
    let t = 0;
    while (sim.x < 402.336 && t < 30) {
      sim.step(H);
      t += H;
      const shiftLight = sim.engine.rpm > sim.car.engine.redlineRpm - 250;
      if (shiftLight && !sim.shift.active && sim.gear < sim.gearbox.gearCount && sim.clutchCtl.mode === 'LOCKED') {
        sim.requestShift(1);
      }
    }
    expect(sim.x).toBeGreaterThanOrEqual(402.336);
    expect(t).toBeLessThan(20);
    expect(sim.gearsUsed.size).toBeGreaterThanOrEqual(3);
    expect(sim.engine.stallCount).toBe(0);
  });

  it('10. opponents drive the same model through the same controls, without instant shifts', () => {
    const sim = makeSim('orion-xr');
    const ai = new DragAI(sim.car, 'advanced', 3);
    const written = new Set<string>();
    sim.controls = new Proxy(sim.controls, {
      set(target, prop, value) {
        written.add(String(prop));
        return Reflect.set(target, prop, value);
      },
    });
    run(sim, 3, (s) => ai.update(H, s, { timeSinceGreen: null, staged: true, finished: false }));
    const green = sim.simTime;
    let lastState: ShiftState = 'IDLE';
    let shiftStart = 0;
    const durations: number[] = [];
    run(sim, 18, (s) => {
      ai.update(H, s, { timeSinceGreen: s.simTime - green, staged: true, finished: s.x > 402.336 });
      const st = s.shift.state;
      if (lastState === 'IDLE' && st !== 'IDLE') shiftStart = s.simTime;
      if (lastState !== 'IDLE' && st === 'IDLE' && s.gear >= 2) durations.push(s.simTime - shiftStart);
      lastState = st;
    });
    expect([...written]).toEqual(['pedal']);
    expect(sim.x).toBeGreaterThan(402.336);
    const sh = sim.car.transmission.shift;
    const minUp = sh.torqueCutTimeS + sh.clutchDisengageTimeS + sh.gearChangeTimeS + sh.clutchEngageTimeS;
    const upshifts = durations; // gear selection from neutral excluded (gear ≥ 2 after the shift)
    expect(upshifts.length).toBeGreaterThanOrEqual(3);
    for (const d of upshifts) expect(d).toBeGreaterThanOrEqual(minUp - 2 * H);
  });

  it('brakes automatically with physical deceleration after the finish', () => {
    const sim = makeSim('tempest-v8');
    readyInFirst(sim);
    driveTo(sim, 4, 7000);
    const v0 = sim.speed;
    sim.controls.pedal = 0;
    sim.controls.autoBrake = true;
    let minAcc = 0;
    let dist = 0;
    run(sim, 10, (s) => {
      minAcc = Math.min(minAcc, s.acceleration);
      dist += s.speed * H;
    });
    expect(Math.abs(sim.speed)).toBeLessThan(0.05);
    expect(minAcc).toBeGreaterThan(-1.2 * 9.81); // tire/brake limited, no teleport
    // stopping distance consistent with ~0.5 g average deceleration
    expect(dist).toBeGreaterThan((v0 * v0) / (2 * 1.2 * 9.81));
    expect(sim.engine.runState).toBe('RUNNING');
  });
});
