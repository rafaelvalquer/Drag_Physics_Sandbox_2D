import { FOUR_PI } from '../../core/units';
import { positiveMod } from '../../core/math';

/**
 * Ignition module: firing-angle table over the 720° cycle, ignition event detection and
 * rev limiter.
 *
 * ORIGIN (MIT): port of ange-yaghi/engine-sim `IgnitionModule` (src/ignition_module.cpp):
 *   - `update()` detects, for every spark plug, whether its (advance-adjusted) firing angle was
 *     crossed between the previous and current crank cycle angle, handling the 4π wrap;
 *   - the rev limiter re-arms a `m_revLimitTimer` of `m_limiterDuration` whenever |ω| exceeds
 *     `m_revLimit`; while the timer is non-zero no plug fires (time-based hysteresis instead of a
 *     hard RPM clamp).
 * CHANGES: positive rotation is forward here (engine-sim spins clockwise, negative v_theta);
 * on a 4π wrap engine-sim shifts every plug angle by 4π, which misses plugs located between the
 * previous angle and 4π (harmless at engine-sim's 10+ kHz rate, not at 120 Hz) – here only plugs
 * located before the previous angle are shifted;
 * spark advance is a constant (the timing curve lives in the torque curve of the mean-value model);
 * the event counter is kept for diagnostics/tests; a per-step "events this step" count is exposed
 * because at 120 Hz several cylinders can fire inside one physics step.
 */
export class IgnitionModule {
  private readonly angles: Float64Array;
  private readonly enabled: Uint8Array;
  private lastCycleAngle = 0;
  private revLimitTimer = 0;
  enabledGlobal = false;
  /** Number of ignition events produced during the last update. */
  eventsLastStep = 0;
  totalEvents = 0;
  /** Fraction of cylinders currently suppressed by an external spark cut (shift torque cut). */
  sparkCut = 0;
  private cutAccumulator = 0;

  constructor(
    firingAnglesDeg: readonly number[],
    public revLimitOmega: number,
    public limiterDuration: number,
    public advanceRad = 0,
  ) {
    this.angles = Float64Array.from(firingAnglesDeg.map((d) => (d * Math.PI) / 180));
    this.enabled = new Uint8Array(firingAnglesDeg.length).fill(1);
  }

  get cylinderCount(): number {
    return this.angles.length;
  }

  firingAngle(i: number): number {
    return this.angles[i]!;
  }

  reset(cycleAngle: number): void {
    this.lastCycleAngle = cycleAngle;
    this.revLimitTimer = 0;
    this.eventsLastStep = 0;
  }

  get limiterActive(): boolean {
    return this.revLimitTimer > 0;
  }

  update(dt: number, cycleAngle: number, omega: number): number {
    let events = 0;
    if (this.enabledGlobal && this.revLimitTimer === 0) {
      const r0 = this.lastCycleAngle;
      for (let i = 0; i < this.angles.length; i++) {
        let adjusted = positiveMod(this.angles[i]! - this.advanceRad, FOUR_PI);
        let r1 = cycleAngle;
        if (omega >= 0) {
          if (r1 < r0) {
            r1 += FOUR_PI;
            if (adjusted < r0) adjusted += FOUR_PI;
          }
          if (adjusted >= r0 && adjusted < r1 && this.enabled[i]) {
            // spark cut: suppress a fraction of the events deterministically (cylinder skipping)
            this.cutAccumulator += this.sparkCut;
            if (this.cutAccumulator >= 1) {
              this.cutAccumulator -= 1;
            } else {
              events++;
            }
          }
        }
      }
    }
    this.revLimitTimer -= dt;
    if (Math.abs(omega) > this.revLimitOmega) this.revLimitTimer = this.limiterDuration;
    if (this.revLimitTimer < 0) this.revLimitTimer = 0;
    this.lastCycleAngle = cycleAngle;
    this.eventsLastStep = events;
    this.totalEvents += events;
    return events;
  }
}
