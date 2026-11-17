import type { ClutchMode } from '../../core/contracts';
import type { TorqueConverterConfig } from '../../data/schema';
import { approach } from '../../core/math';
import { radSToRpm } from '../../core/units';

/** (30/π)²: converts ω² (rad/s)² to n² (rpm)². */
const RPM2 = (30 / Math.PI) ** 2;

export interface ConverterState {
  /** Impeller (engine) torque absorbed, N·m (positive = engine drives the turbine). */
  impellerTorque: number;
  /** Turbine/impeller torque ratio applied to the turbine side. */
  torqueRatio: number;
  /** Turbine/impeller speed ratio. */
  speedRatio: number;
  /** ∂T_impeller/∂ω used to linearize the converter row (N·m·s/rad). */
  stiffness: number;
}

/**
 * Hydrodynamic torque converter (impeller on the crank, turbine on the gearbox input).
 *
 * Capacity: T_i = (n_i² − n_t²)/K², with K the stall capacity factor (rpm/√N·m). At stall
 * (n_t = 0) this is the classic (n/K)² law; it falls smoothly to zero at a speed ratio of 1
 * (fluid coupling) and reverses when the turbine overruns the impeller (engine braking).
 * Torque multiplication (stator reaction): TR = TR_stall at stall, falling linearly to 1 at the
 * coupling point; above it, and in overrun, TR = 1. Power lost = T_i·ω_i − TR·T_i·ω_t (heat).
 */
export function converterState(cfg: TorqueConverterConfig, impellerOmega: number, turbineOmega: number): ConverterState {
  const wi = impellerOmega;
  const wt = turbineOmega;
  const K2 = cfg.kFactor * cfg.kFactor;
  const t = (RPM2 * (wi * Math.abs(wi) - wt * Math.abs(wt))) / K2;
  const sr = Math.abs(wi) > 1 ? wt / wi : 1;
  let tr = 1;
  if (t > 0 && sr < cfg.couplingSpeedRatio) tr = cfg.stallTorqueRatio + (1 - cfg.stallTorqueRatio) * Math.max(0, sr) / cfg.couplingSpeedRatio;
  const stiffness = (2 * RPM2 * Math.max(Math.abs(wi), Math.abs(wt), 60)) / K2;
  return { impellerTorque: t, torqueRatio: tr, speedRatio: sr, stiffness };
}

export interface LockupContext {
  gear: number;
  gearEngaged: boolean;
  shiftActive: boolean;
  turbineOmega: number;
  engineOmega: number;
  pedal: number;
  forceOpen: boolean;
}

/**
 * Lock-up clutch actuator + the clutch-mode view used by HUD/AI/telemetry for an automatic:
 * OPEN in neutral, SHIFT during a shift, LAUNCH while the converter slips, LOCKED with the lock-up
 * clutch closed. `engagement` is the lock-up clutch command.
 */
export class TorqueConverterController {
  mode: ClutchMode = 'OPEN';
  engagement = 0;

  constructor(public cfg: TorqueConverterConfig) {}

  reset(): void {
    this.mode = 'OPEN';
    this.engagement = 0;
  }

  update(h: number, c: LockupContext): number {
    const lu = this.cfg.lockup;
    const turbineRpm = radSToRpm(c.turbineOmega);
    const allowed = !c.forceOpen && c.gearEngaged && c.gear >= lu.minGear && !c.shiftActive && turbineRpm > lu.minTurbineRpm;
    this.engagement = approach(this.engagement, allowed ? 1 : 0, h * lu.engageRatePerS * (allowed ? 1 : 4));
    if (!c.gearEngaged || c.gear === 0) this.mode = 'OPEN';
    else if (c.shiftActive) this.mode = 'SHIFT';
    else if (this.engagement > 0.9 && Math.abs(radSToRpm(c.engineOmega) - turbineRpm) < 150) this.mode = 'LOCKED';
    else this.mode = 'LAUNCH';
    return this.engagement;
  }
}
