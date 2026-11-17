/**
 * Over-rev failure of an engine (career "blown engine"). Deterministic: the same run always breaks
 * at the same step; no random numbers and no allocation per step.
 *
 * Exposure model (fatigue of valvetrain / rods above the speed the engine is built for):
 *   x      = (rpm − recommendedSafeRpm) / (maxSafeRpm − recommendedSafeRpm)      (excess, 0 below)
 *   load   = 0.3 + 0.7·min(1, load) + 0.5·boostBar                             (gas + inertia loads)
 *   heat   = 1 + 0.4·clamp(egtFraction, 0, 1)                                  (only modulates)
 *   dE/dt  = x² · load · heat / enduranceS
 * Below the recommended speed the exposure recovers at `recoveryPerS`. The engine breaks when the
 * exposure reaches 1. With x = 1 at full load the engine lasts `enduranceS` seconds on the cut.
 * The factory build (factory cut) sits under the recommended speed with a margin for the limiter
 * overshoot, so it never accumulates exposure.
 */
export interface OverrevSpec {
  /** Highest speed the engine runs for good (rpm). Exposure starts above it. */
  recommendedSafeRpm: number;
  /** Mechanical limit of the build (rpm): exposure rate of the full excess. */
  maxSafeRpm: number;
  /** Seconds at the mechanical limit, full load, before the engine breaks. */
  enduranceS: number;
  /** Exposure recovered per second below the recommended speed. */
  recoveryPerS: number;
}

/** Strain bands of the HUD gauge and the Dyno Lab panel. */
export type StrainLevel = 'normal' | 'elevated' | 'high' | 'critical';

export function strainLevel(strain: number): StrainLevel {
  if (strain >= 0.75) return 'critical';
  if (strain >= 0.45) return 'high';
  if (strain >= 0.15) return 'elevated';
  return 'normal';
}

export class EngineOverrevFailure {
  /** Accumulated exposure 0..1 (1 = broken). */
  exposure = 0;
  /** Instantaneous excess over the recommended speed, normalized (0 below it, 1 at the limit). */
  excess = 0;
  broken = false;
  /** Simulation time of the failure. */
  brokenAt: number | null = null;
  /** Engine speed at the failure (rpm). */
  brokenRpm = 0;

  constructor(readonly spec: OverrevSpec) {}

  /** Strain shown to the driver: the larger of the accumulated exposure and the current excess. */
  get strain(): number {
    return this.broken ? 1 : Math.max(this.exposure, Math.min(1, this.excess));
  }

  reset(): void {
    this.exposure = 0;
    this.excess = 0;
    this.broken = false;
    this.brokenAt = null;
    this.brokenRpm = 0;
  }

  /** One physics step. Returns true on the step the engine breaks (once). */
  update(h: number, rpm: number, load: number, boostBar: number, egtFraction: number, simTime: number): boolean {
    if (this.broken) return false;
    const s = this.spec;
    const span = Math.max(50, s.maxSafeRpm - s.recommendedSafeRpm);
    const x = (rpm - s.recommendedSafeRpm) / span;
    if (x <= 0) {
      this.excess = 0;
      this.exposure = Math.max(0, this.exposure - s.recoveryPerS * h);
      return false;
    }
    this.excess = x;
    const l = 0.3 + 0.7 * Math.min(1, Math.max(0, load)) + 0.5 * Math.max(0, boostBar);
    const heat = 1 + 0.4 * Math.min(1, Math.max(0, egtFraction));
    this.exposure += (x * x * l * heat * h) / Math.max(0.05, s.enduranceS);
    if (this.exposure < 1) return false;
    this.exposure = 1;
    this.broken = true;
    this.brokenAt = simTime;
    this.brokenRpm = rpm;
    return true;
  }
}
