import { clamp, firstOrder } from '../../core/math';

/**
 * Idle air control as done by an engine ECU:
 *
 *   opening = base + Kp·e + Ki·∫e + Kd·de/dt,     e = (target − rpm)/1000
 *
 * - base: steady-state calibration (opening with zero net torque at idle speed, from the model).
 * - Kp, Ki: pole placement on I·dω/dt = S·u using the model's idle torque sensitivity S.
 * - Kd = Kp·τ_manifold: lead that compensates the manifold filling lag (the air added now only
 *   produces torque after the manifold has filled).
 * - dashpot: while the engine falls towards idle from well above the target with the pedal
 *   released the trim is not allowed below zero, so the manifold does not empty after a start
 *   flare or a throttle lift and the engine settles instead of undershooting into a stall.
 * - conditional integration (anti wind-up) when the output saturates.
 */
export class IdleAirController {
  private integral = 0;
  private lastRpm = Number.NaN;
  private rpmRate = 0;
  trim = 0;
  /** Width of the band above the target in which the dashpot is not active (rpm). */
  dashpotBandRpm = 150;

  constructor(
    public base: number,
    public kp: number,
    public ki: number,
    public kd: number,
    public maxTrim: number,
  ) {}

  reset(): void {
    this.integral = 0;
    this.trim = 0;
    this.lastRpm = Number.NaN;
    this.rpmRate = 0;
  }

  update(dt: number, targetRpm: number, rpm: number, pedalReleased: boolean): number {
    if (Number.isNaN(this.lastRpm)) this.lastRpm = rpm;
    const rawRate = (rpm - this.lastRpm) / dt;
    this.lastRpm = rpm;
    this.rpmRate = firstOrder(this.rpmRate, rawRate, dt, 0.03);
    const e = (targetRpm - rpm) / 1000;
    const de = -this.rpmRate / 1000;
    const lo = pedalReleased && rpm > targetRpm + this.dashpotBandRpm ? 0 : -this.base;
    const unsat = this.kp * e + this.integral + this.kd * de;
    // integrate only while the output is not pushed further into saturation
    const pushingHigh = unsat >= this.maxTrim && e > 0;
    const pushingLow = unsat <= lo && e < 0;
    if (!pushingHigh && !pushingLow) {
      this.integral = clamp(this.integral + this.ki * e * dt, -this.base, this.maxTrim);
    }
    if (lo === 0 && this.integral < 0) this.integral = 0;
    this.trim = clamp(this.kp * e + this.integral + this.kd * de, lo, this.maxTrim);
    return this.base + this.trim;
  }
}
