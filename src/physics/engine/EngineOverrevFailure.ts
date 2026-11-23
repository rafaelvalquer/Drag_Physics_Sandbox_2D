/**
 * Over-rev failure of an engine (career "blown engine"). Deterministic: the same run always breaks
 * at the same step; no random numbers and no allocation per step.
 *
 * Exposure model (fatigue of valvetrain / rods above the speed the engine is built for):
 *   rpmF   = engine speed through a first-order filter (τ = 250 ms). The ignition cut makes the
 *            speed saw-tooth around the cut; the parts feel the sustained speed, so the model
 *            reads the filtered speed and a brief dip under the safe speed is not a "rest".
 *   x      = (rpmF − recommendedSafeRpm) / (maxSafeRpm − LIMITER_SAG_RPM − recommendedSafeRpm)
 *            x = 1 is the filtered speed of an engine held on a cut set at the mechanical limit;
 *            above it (missed shift, over-rev) up to X_MAX
 *   stress = x^1.5
 *   load   = 0.3 + 0.7·min(1, load) + 0.5·boostBar                       (gas + inertia loads)
 *   heat   = 1 + 0.4·clamp(egtFraction, 0, 1)                            (only modulates)
 *   dE/dt  = stress · load · heat / enduranceS
 * Recovery: only after RECOVERY_DELAY_S continuously under the safe speed, then `recoveryPerS`.
 * The engine breaks when the exposure reaches 1 (`enduranceS` ≈ seconds held on a cut at the
 * mechanical limit, full throttle). The factory cut's filtered speed sits under the safe speed,
 * so a factory engine on its own limiter never accumulates.
 */
export interface OverrevSpec {
  /** Highest (filtered) speed the engine runs for good (rpm). Exposure starts above it. */
  recommendedSafeRpm: number;
  /** Mechanical limit of the build (rpm): the highest cut the ECU may be set to. */
  maxSafeRpm: number;
  /** Seconds held on a cut at the mechanical limit, full throttle, before the engine breaks. */
  enduranceS: number;
  /** Exposure recovered per second once the engine has rested under the safe speed. */
  recoveryPerS: number;
}

/** Filter of the engine speed seen by the parts (s). */
export const RPM_FILTER_S = 0.25;
/** The filtered speed of an engine held on its limiter sits this far under the cut (measured 12–130 rpm). */
export const LIMITER_SAG_RPM = 100;
/** Continuous time under the safe speed before the exposure starts to recover (s). */
export const RECOVERY_DELAY_S = 0.5;
/** Highest normalized excess (mechanical over-rev). */
export const X_MAX = 2.5;

/** Strain bands of the HUD gauge (enter / leave thresholds: hysteresis). */
export type StrainLevel = 'normal' | 'elevated' | 'high' | 'critical';
export const STRAIN_BANDS: readonly { level: StrainLevel; enter: number; leave: number }[] = [
  { level: 'elevated', enter: 0.15, leave: 0.1 },
  { level: 'high', enter: 0.45, leave: 0.4 },
  { level: 'critical', enter: 0.75, leave: 0.7 },
];
const ORDER: StrainLevel[] = ['normal', 'elevated', 'high', 'critical'];

/** Band of a value without history (entry thresholds). */
export function strainLevel(strain: number): StrainLevel {
  let lvl: StrainLevel = 'normal';
  for (const b of STRAIN_BANDS) if (strain >= b.enter) lvl = b.level;
  return lvl;
}

/** Band with hysteresis: going up needs the entry threshold, going down needs to fall under the exit one. */
export function strainLevelHyst(strain: number, prev: StrainLevel): StrainLevel {
  const up = strainLevel(strain);
  if (ORDER.indexOf(up) >= ORDER.indexOf(prev)) return up;
  let lvl: StrainLevel = prev;
  while (lvl !== 'normal') {
    const b = STRAIN_BANDS.find((s) => s.level === lvl)!;
    if (strain >= b.leave) break;
    lvl = ORDER[ORDER.indexOf(lvl) - 1]!;
  }
  return lvl;
}

export class EngineOverrevFailure {
  /** Accumulated exposure 0..1 (1 = broken): the real progress to the failure. */
  exposure = 0;
  /** Instantaneous excess over the safe speed, normalized (0 below; follows the limiter saw-tooth). */
  excess = 0;
  /** Excess of the filtered speed (what the model integrates; steady on the limiter). */
  smoothedExcess = 0;
  /** Filtered engine speed (rpm). */
  filteredRpm = 0;
  /** Continuous time under the safe speed (s). */
  safeTime = 0;
  broken = false;
  /** Simulation time of the failure. */
  brokenAt: number | null = null;
  /** Engine speed at the failure (rpm). */
  brokenRpm = 0;
  private primed = false;

  constructor(readonly spec: OverrevSpec) {}

  /** Risk shown to the driver: the accumulated exposure (1 once broken). */
  get strain(): number {
    return this.broken ? 1 : this.exposure;
  }

  /** The engine is over the safe speed right now (filtered). */
  get overrev(): boolean {
    return !this.broken && this.smoothedExcess > 0;
  }

  reset(): void {
    this.exposure = 0;
    this.excess = 0;
    this.smoothedExcess = 0;
    this.filteredRpm = 0;
    this.safeTime = 0;
    this.broken = false;
    this.brokenAt = null;
    this.brokenRpm = 0;
    this.primed = false;
  }

  /**
   * Torque strain (nitrous): the crank torque against what the internals carry. Above the limit the
   * exposure grows with the excess (ratio 1.3 breaks in ≈ 4 s); at or under it nothing accumulates and
   * the exposure is untouched (it only recovers through the speed model). Returns true when it breaks.
   */
  updateTorque(h: number, torqueRatio: number, rpm: number, simTime: number): boolean {
    if (this.broken || !(torqueRatio > 1)) return false;
    const x = (torqueRatio - 1) / 0.3;
    this.exposure += (x * Math.sqrt(x) * h) / 4;
    this.safeTime = 0;
    if (this.exposure < 1) return false;
    this.exposure = 1;
    this.broken = true;
    this.brokenAt = simTime;
    this.brokenRpm = rpm;
    return true;
  }

  /** One physics step. Returns true on the step the engine breaks (once). */
  update(h: number, rpm: number, load: number, boostBar: number, egtFraction: number, simTime: number): boolean {
    if (this.broken) return false;
    const s = this.spec;
    if (!this.primed) {
      this.filteredRpm = rpm;
      this.primed = true;
    } else this.filteredRpm += (rpm - this.filteredRpm) * (1 - Math.exp(-h / RPM_FILTER_S));
    const span = Math.max(100, s.maxSafeRpm - LIMITER_SAG_RPM - s.recommendedSafeRpm);
    this.excess = Math.max(0, (rpm - s.recommendedSafeRpm) / span);
    const x = Math.min(X_MAX, (this.filteredRpm - s.recommendedSafeRpm) / span);
    if (!(x > 0)) {
      this.smoothedExcess = 0;
      this.safeTime += h;
      if (this.safeTime >= RECOVERY_DELAY_S) this.exposure = Math.max(0, this.exposure - s.recoveryPerS * h);
      return false;
    }
    this.smoothedExcess = x;
    this.safeTime = 0;
    const l = 0.3 + 0.7 * Math.min(1, Math.max(0, load)) + 0.5 * Math.max(0, boostBar);
    const heat = 1 + 0.4 * Math.min(1, Math.max(0, egtFraction));
    this.exposure += (x * Math.sqrt(x) * l * heat * h) / Math.max(0.05, s.enduranceS);
    if (this.exposure < 1) return false;
    this.exposure = 1;
    this.broken = true;
    this.brokenAt = simTime;
    this.brokenRpm = rpm;
    return true;
  }
}
