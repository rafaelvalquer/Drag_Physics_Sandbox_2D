import type { ClutchMode } from '../../core/contracts';
import type { TransmissionConfig } from '../../data/schema';
import { approach, clamp, clamp01 } from '../../core/math';

export interface ClutchContext {
  gear: number;
  gearEngaged: boolean;
  engineRpm: number;
  /** Clutch disc (gearbox input) speed in rpm = G·ω_wheel. */
  inputRpm: number;
  idleRpm: number;
  pedal: number;
  engineRunning: boolean;
  /** Torque the clutch transmitted in the previous step (N·m). */
  clutchTorque: number;
  /** Currently available engine torque estimate (N·m) at the present speed and load. */
  engineTorque: number;
  vehicleSpeed: number;
  /** Driven-axle slip ratio (driven wheel surface speed vs. free-axle/vehicle speed). */
  drivenSlipRatio: number;
  shiftActive: boolean;
  shiftClutchCommand: number;
  /** True right after a standing-start gear selection. */
  launchRequested: boolean;
  /** Forces the clutch open (e.g. automatic braking after the finish line). */
  forceOpen: boolean;
}

/**
 * Automatic clutch actuator logic shared by the player and the AI.
 *
 * The *physics* of the clutch is a bounded constraint (see VehicleSimulation): the clutch can
 * transmit any torque in [−T_capacity, +T_capacity] with T_capacity = T_max · engagement. This
 * controller only decides the engagement command:
 *
 * - OPEN: neutral or nothing to transmit.
 * - LAUNCH: standing start. The controller raises the clamp load while the engine is above the
 *   launch speed target and relaxes it when the engine drops below it, so the clutch slips at the
 *   torque the engine can sustain. It locks once the disc speed approaches the engine speed.
 *   The engagement rate scales with the speed error, the available torque and the throttle.
 * - SHIFT: the ShiftController owns the engagement ramps.
 * - LOCKED: fully clamped.
 * - ANTI_STALL: opens the clutch when the disc speed (vehicle) falls below what the engine can
 *   sustain, so the engine keeps idling when the car stops.
 */
/**
 * Driven-wheel slip ratio above which the launch logic relaxes the clamp load (the actuator
 * considers wheel rotation as well as engine speed). Below it wheelspin is allowed – drivers
 * still see and hear it; above it the clutch slips instead of the tires.
 */
export const LAUNCH_SLIP_LIMIT = 0.6;

/** Engine speed the launch logic holds while slipping, as a function of the throttle request. */
export function launchTargetRpm(pedal: number, idleRpm: number, launchRpm: number): number {
  return clamp(idleRpm + (launchRpm - idleRpm) * clamp01(pedal * 1.15), idleRpm + 250, launchRpm);
}

export class AutomaticClutchController {
  mode: ClutchMode = 'OPEN';
  engagement = 0;

  constructor(public cfg: TransmissionConfig) {}

  reset(): void {
    this.mode = 'OPEN';
    this.engagement = 0;
  }

  update(h: number, c: ClutchContext): number {
    const cl = this.cfg.clutch;
    const rate = cl.engageRatePerS;
    if (c.shiftActive) {
      this.mode = 'SHIFT';
      this.engagement = clamp01(c.shiftClutchCommand);
      return this.engagement;
    }
    if (c.forceOpen || c.gear === 0 || !c.gearEngaged || !c.engineRunning) {
      this.mode = 'OPEN';
      this.engagement = approach(this.engagement, 0, h * rate * 3);
      return this.engagement;
    }
    if (c.launchRequested && this.mode !== 'LAUNCH') {
      this.mode = 'LAUNCH';
    }
    if (this.mode === 'SHIFT') this.mode = 'LOCKED';

    const slip = c.engineRpm - c.inputRpm;
    const antiStallRpm = Math.max(cl.antiStallRpm, c.idleRpm * 0.85);

    // Anti-stall: the disc is turning too slowly for the engine to sustain it.
    if (c.inputRpm < antiStallRpm && (this.mode === 'LOCKED' || this.mode === 'ANTI_STALL')) {
      if (c.pedal > 0.02 && c.vehicleSpeed < 6) this.mode = 'LAUNCH';
      else this.mode = 'ANTI_STALL';
    }
    if (this.mode === 'OPEN') this.mode = c.pedal > 0.02 ? 'LAUNCH' : 'OPEN';

    switch (this.mode) {
      case 'ANTI_STALL': {
        this.engagement = approach(this.engagement, 0, h * rate * 3);
        if (c.pedal > 0.02) this.mode = 'LAUNCH';
        break;
      }
      case 'OPEN': {
        this.engagement = approach(this.engagement, 0, h * rate * 2);
        break;
      }
      case 'LAUNCH': {
        if (c.pedal < 0.02) {
          // no throttle: release the clamp (no creep), stay ready for the next launch
          this.engagement = approach(this.engagement, 0, h * rate * 2);
          if (this.engagement === 0) this.mode = 'OPEN';
          break;
        }
        // target engine speed while slipping grows with the throttle request
        const target = launchTargetRpm(c.pedal, c.idleRpm, cl.launchRpm);
        const err = (c.engineRpm - target) / 1000;
        // feed-forward: capacity that matches the torque the engine is producing, so the engine
        // speed stops rising near the target; the actuator fills quickly to this bite point
        // (as automated clutch actuators do) and the speed error then modulates around it.
        const ff = clamp01(Math.max(c.engineTorque, 0) / cl.maxTorqueNm);
        let next = this.engagement + h * rate * clamp(err, -1.5, 1.5) * (0.35 + 0.65 * c.pedal);
        if (err > -0.25 && next < ff) next = Math.max(next, approach(this.engagement, ff, h * rate * 3));
        // shaft speed difference: as the disc approaches the engine speed the remaining slip
        // energy is small, so the clamp is allowed to rise faster towards lock-up
        const slipFrac = clamp01(slip / Math.max(c.engineRpm, 1));
        if (slipFrac < 0.35 && err > -0.3) next = Math.max(next, approach(this.engagement, 1, h * rate * (1 - slipFrac)));
        // wheel rotation: excessive wheelspin relaxes the clamp (engine speed rises instead)
        if (c.drivenSlipRatio > LAUNCH_SLIP_LIMIT) {
          next = Math.min(next, this.engagement - h * rate * 0.5 * (c.drivenSlipRatio - LAUNCH_SLIP_LIMIT));
        }
        // engine bogging: back off quickly
        if (c.engineRpm < c.idleRpm * 0.95) next = approach(this.engagement, 0, h * rate * 2.5);
        this.engagement = clamp01(next);
        // lock-up once the disc caught up with the engine
        if (Math.abs(slip) < 150 && c.inputRpm > c.idleRpm) this.mode = 'LOCKED';
        break;
      }
      case 'LOCKED': {
        this.engagement = approach(this.engagement, 1, h * rate);
        break;
      }
      default:
        break;
    }
    return this.engagement;
  }
}
