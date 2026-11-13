import type { TireConfig } from '../../data/schema';
import { clamp, firstOrder } from '../../core/math';

/**
 * Longitudinal tire force from the slip ratio with a simplified Pacejka "Magic Formula":
 *   F = N · D · sin(C · atan(B·κ − E·(B·κ − atan(B·κ)))),   D = μ_peak · grip
 * The slip ratio uses a low-speed floor so it stays finite at standstill:
 *   κ = (ω·r − v) / max(|v|, v_low)
 * For the implicit solve the force is linearized around the current slip velocity:
 *   F(Δv) ≈ F0 + k·(Δv − Δv0),   k = max(N·dF/dκ / max(|v|, v_low),  F0/Δv0)
 * Beyond the peak the tangent slope is ≤ 0; using it would turn the tire term explicit and, on the
 * small driveline inertia (clutch open), overshoot and pump energy into the system. The secant
 * slope F0/Δv0 (always ≥ 0, passes through the origin) keeps the step implicit and dissipative
 * while still reproducing F0 at the current slip, so excess wheel torque still spins the wheel up
 * (wheelspin is a physical runaway, not artificially prevented).
 *
 * Tire temperature is a lumped first-order model: frictional slip power heats the tread,
 * convection cools it towards the surface temperature; grip falls linearly away from the optimal
 * temperature (simplified, calibrated – not a thermal tire model).
 */
export const LOW_SPEED_FLOOR = 2.0;

export interface TireEval {
  kappa: number;
  force: number;
  /** dF/dΔv (N per m/s) */
  slope: number;
  peakForce: number;
}

export class TireModel {
  temperatureC: number;
  surfaceGrip = 1;
  surfaceTempC = 25;
  readonly result: TireEval = { kappa: 0, force: 0, slope: 0, peakForce: 0 };

  constructor(public cfg: TireConfig) {
    this.temperatureC = 25;
  }

  get gripFactor(): number {
    const c = this.cfg;
    const t = 1 - c.tempSensitivityPerC * Math.abs(this.temperatureC - c.optimalTempC);
    return clamp(t, 0.6, 1.05) * this.surfaceGrip;
  }

  /** Normalized magic formula μ(κ) and its derivative dμ/dκ (without D). */
  static shape(kappa: number, B: number, C: number, E: number): { mu: number; dmu: number } {
    const bx = B * kappa;
    const atanBx = Math.atan(bx);
    const phi = bx - E * (bx - atanBx);
    const dphi = B - E * (B - B / (1 + bx * bx));
    const inner = C * Math.atan(phi);
    return { mu: Math.sin(inner), dmu: (Math.cos(inner) * C * dphi) / (1 + phi * phi) };
  }

  evaluate(slipVelocity: number, vehicleSpeed: number, normalLoad: number): TireEval {
    const c = this.cfg;
    const denom = Math.max(Math.abs(vehicleSpeed), LOW_SPEED_FLOOR);
    const kappa = slipVelocity / denom;
    const D = c.muPeak * this.gripFactor;
    const s = TireModel.shape(kappa, c.B, c.C, c.E);
    const n = Math.max(normalLoad, 0);
    const r = this.result;
    r.kappa = kappa;
    r.force = n * D * s.mu;
    const tangent = (n * D * s.dmu) / denom;
    const secant = Math.abs(slipVelocity) > 1e-6 ? r.force / slipVelocity : tangent;
    r.slope = Math.max(tangent, secant, 1);
    r.peakForce = n * D;
    return r;
  }

  updateTemperature(dt: number, slipPowerW: number, speed: number): void {
    // heat capacity of the tread layer of one axle ≈ 9 kJ/K; convection grows with speed
    const heat = (Math.abs(slipPowerW) * 0.6) / 9000;
    const tau = 40 / (1 + 0.08 * Math.abs(speed));
    this.temperatureC = firstOrder(this.temperatureC, this.surfaceTempC, dt, tau) + heat * dt;
    if (this.temperatureC > 160) this.temperatureC = 160;
  }
}
