import type { TurboConfig } from '../../data/schema';
import { clamp, firstOrder } from '../../core/math';

/**
 * Reduced-order turbocharger model (NOT a CFD or compressor-map simulation).
 *
 * - Shaft speed s (fraction of max) follows a first-order lag towards a target that grows with the
 *   square root of the exhaust mass flow (turbine power ∝ flow · enthalpy drop).
 * - Compressor pressure rise ∝ s² (tip speed squared, Euler turbomachine equation).
 * - The wastegate caps the shaft speed at the value that produces the configured maximum boost.
 * - Boost in the charge pipe follows the compressor with a short pipe filling time constant.
 * - Blow-off valve: when the throttle closes while boost is present, the BOV opens and vents the
 *   charge pipe with time constant `bovVentTimeS`; its normalized vent flow drives the BOV sound.
 *
 * Parallel twin (`cfg.layout === 'parallel-twin'`, one turbo per bank): the bank flows are equal,
 * so each rotor sees half of the engine flow against half of the reference flow and the target
 * speed is the one of a single turbo; what the pair changes is the rotor — half the compressor
 * means a lighter rotor, i.e. a shorter `spoolTimeS` (given per rotor in the configuration). The
 * two compressors feed one plenum: the pressure they hold is the mean of the two (not their sum;
 * parallel compressors add mass flow, not pressure ratio). The second rotor sees a slightly lower
 * share of the exhaust energy (`ROTOR_MISMATCH`, an assumption: banks are never exactly equal), so
 * the speeds differ by a few percent while spooling and the audio can render two beating whines.
 */
export const ROTOR_MISMATCH = 0.015;

export class Turbocharger {
  shaft = 0; // 0..1 (rotor A)
  /** Rotor B of a parallel twin (0 on a single turbo). */
  shaftB = 0;
  boostPa = 0; // charge pipe gauge pressure
  bovFlow = 0; // 0..1
  private bovOpen = false;
  private readonly overspeedFactor = 1.3;

  constructor(
    public cfg: TurboConfig,
    /** Exhaust mass flow (kg/s) at WOT/peak torque, used to normalize turbine energy. */
    public referenceFlow: number,
  ) {}

  get twin(): boolean {
    return this.cfg.layout === 'parallel-twin';
  }

  /** Number of turbochargers. */
  get count(): number {
    return this.twin ? 2 : 1;
  }

  reset(): void {
    this.shaft = 0;
    this.shaftB = 0;
    this.boostPa = 0;
    this.bovFlow = 0;
    this.bovOpen = false;
  }

  get shaftRpm(): number {
    return this.shaft * this.cfg.maxShaftRpm;
  }

  /** Speed of the second rotor (rpm); 0 on a single turbo. */
  get shaftRpm2(): number {
    return this.twin ? this.shaftB * this.cfg.maxShaftRpm : 0;
  }

  /** Shaft speed target (0..1) for an exhaust flow and EGT ratio, wastegate included. */
  private shaftTarget(exhaustFlow: number, exhaustTempRatio: number): number {
    const cfg = this.cfg;
    const maxBoost = cfg.maxBoostBar * 1e5;
    const potential = maxBoost * this.overspeedFactor;
    const energy = clamp(exhaustFlow / (this.referenceFlow * cfg.fullBoostFlowFraction), 0, 1.5);
    const target = Math.sqrt(energy) * (0.55 + 0.45 * clamp(exhaustTempRatio, 0, 1.2));
    return Math.min(target, Math.sqrt(maxBoost / potential));
  }

  /** Boost (Pa gauge) the model settles at for a constant exhaust flow with the throttle open. */
  steadyBoost(exhaustFlow: number, exhaustTempRatio: number): number {
    const s = this.shaftTarget(exhaustFlow, exhaustTempRatio);
    return this.cfg.maxBoostBar * 1e5 * this.overspeedFactor * s * s;
  }

  /**
   * @param exhaustFlow exhaust mass flow (kg/s)
   * @param throttleOpening throttle plate opening 0..1
   * @param exhaustTempRatio EGT / max EGT (hotter gas carries more energy)
   */
  update(dt: number, exhaustFlow: number, throttleOpening: number, exhaustTempRatio: number): void {
    const cfg = this.cfg;
    const maxBoost = cfg.maxBoostBar * 1e5;
    const potential = maxBoost * this.overspeedFactor; // boost at s = 1 without wastegate
    const target = this.shaftTarget(exhaustFlow, exhaustTempRatio);
    const tau = target > this.shaft ? cfg.spoolTimeS : cfg.spoolTimeS * 1.6;
    this.shaft = firstOrder(this.shaft, target, dt, tau);
    let compressorBoost = potential * this.shaft * this.shaft;
    if (this.twin) {
      const targetB = this.shaftTarget(exhaustFlow * (1 - ROTOR_MISMATCH), exhaustTempRatio);
      const tauB = (targetB > this.shaftB ? cfg.spoolTimeS : cfg.spoolTimeS * 1.6) * (1 + ROTOR_MISMATCH);
      this.shaftB = firstOrder(this.shaftB, targetB, dt, tauB);
      compressorBoost = 0.5 * potential * (this.shaft * this.shaft + this.shaftB * this.shaftB);
    }
    // BOV logic: opens when throttle snaps shut with boost present, closes when throttle reopens.
    if (cfg.bovEnabled) {
      if (!this.bovOpen && throttleOpening < 0.12 && this.boostPa > 0.25e5) this.bovOpen = true;
      if (this.bovOpen && (throttleOpening > 0.3 || this.boostPa < 0.05e5)) this.bovOpen = false;
    }
    if (this.bovOpen) {
      const before = this.boostPa;
      this.boostPa = firstOrder(this.boostPa, 0, dt, cfg.bovVentTimeS);
      this.bovFlow = clamp(((before - this.boostPa) / dt / maxBoost) * cfg.bovVentTimeS * 2, 0, 1);
    } else {
      // with the throttle closed and no BOV, the compressor dead-heads: boost holds at what the
      // compressor can make (surge not modelled)
      const throttleFlowFactor = clamp(throttleOpening * 3, 0.1, 1);
      this.boostPa = firstOrder(this.boostPa, compressorBoost, dt, 0.04 / throttleFlowFactor);
      this.bovFlow = firstOrder(this.bovFlow, 0, dt, 0.05);
    }
  }
}
