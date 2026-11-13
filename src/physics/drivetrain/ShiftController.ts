import type { ShiftState } from '../../core/contracts';
import type { TransmissionConfig } from '../../data/schema';
import { clamp, clamp01 } from '../../core/math';
import { radSToRpm } from '../../core/units';
import type { Gearbox } from './Gearbox';

export type ShiftKind = 'up' | 'down' | 'select';
export type ShiftRequestResult =
  | 'started'
  | 'buffered'
  | 'rejected-no-gear'
  | 'rejected-overrev'
  | 'waiting-overrev'
  | 'rejected-engine-off';

export interface ShiftContext {
  engineRpm: number;
  /** Driven-wheel angular velocity (rad/s). */
  wheelOmega: number;
  pedal: number;
  revLimitRpm: number;
  engineRunning: boolean;
  vehicleSpeed: number;
}

export interface ShiftEvent {
  time: number;
  kind: ShiftKind;
  from: number;
  to: number;
  result: ShiftRequestResult | 'completed';
}

/**
 * Sequential assisted shift sequencer.
 *
 * States: IDLE → TORQUE_CUT → CLUTCH_DISENGAGE → GEAR_CHANGE → REV_MATCH → CLUTCH_ENGAGE → COMPLETE.
 * Every phase has a configurable physical duration; nothing in here writes the engine speed –
 * the controller only commands spark cut, throttle blips, clutch engagement and the dog engagement
 * of the gearbox. RPM changes are the result of torques acting on the inertias.
 *
 * Request policy during an active shift: a single-slot buffer. A request received while shifting
 * is stored (the newest request replaces an older one; an opposite request cancels the stored
 * one). After COMPLETE the buffered request is re-validated against the new state, and dropped if
 * older than `bufferWindowS`.
 */
export class ShiftController {
  state: ShiftState = 'IDLE';
  kind: ShiftKind | null = null;
  fromGear = 0;
  targetGear = 0;
  stateTime = 0;
  /** Outputs read by the vehicle each step. */
  sparkCut = 0;
  clutchCommand = 1;
  throttleOverride: number | null = null;
  readonly bufferWindowS = 0.35;
  pending: { dir: 1 | -1; age: number } | null = null;
  waitingDownshift: { age: number } | null = null;
  lastResult: ShiftRequestResult | 'completed' | null = null;
  readonly history: ShiftEvent[] = [];
  private simTime = 0;
  private lastRpm = Number.NaN;
  /** Filtered engine acceleration (rpm/s) used by the predictive blip. */
  rpmRate = 0;
  private cutAtStart = 0;
  private clutchAtStart = 1;
  /** whether the clutch controller should treat the end of the shift as a launch */
  launchAfter = false;

  constructor(
    public cfg: TransmissionConfig,
    private readonly gearbox: Gearbox,
  ) {}

  get active(): boolean {
    return this.state !== 'IDLE';
  }

  reset(): void {
    this.state = 'IDLE';
    this.kind = null;
    this.stateTime = 0;
    this.sparkCut = 0;
    this.clutchCommand = 1;
    this.throttleOverride = null;
    this.pending = null;
    this.waitingDownshift = null;
    this.lastResult = null;
    this.history.length = 0;
    this.launchAfter = false;
  }

  targetRpmFor(gear: number, wheelOmega: number): number {
    return radSToRpm(Math.abs(wheelOmega) * this.gearbox.overallRatio(gear));
  }

  /**
   * Request a shift. `currentClutch` is the engagement commanded by the automatic clutch, used as
   * the starting point of the disengage ramp.
   */
  request(dir: 1 | -1, ctx: ShiftContext, currentClutch: number): ShiftRequestResult {
    if (this.active) {
      if (this.pending && this.pending.dir !== dir) this.pending = null;
      else this.pending = { dir, age: 0 };
      return this.log(dir, 'buffered');
    }
    return this.begin(dir, ctx, currentClutch);
  }

  private log(dir: 1 | -1, result: ShiftRequestResult): ShiftRequestResult {
    const g = this.gearbox.gear;
    this.lastResult = result;
    this.history.push({ time: this.simTime, kind: dir > 0 ? 'up' : 'down', from: g, to: g + dir, result });
    if (this.history.length > 64) this.history.shift();
    return result;
  }

  private begin(dir: 1 | -1, ctx: ShiftContext, currentClutch: number): ShiftRequestResult {
    const gb = this.gearbox;
    const g = gb.gear;
    const target = g + dir;
    if (target < 0 || target > gb.gearCount) return this.log(dir, 'rejected-no-gear');
    if (dir < 0 && target >= 1) {
      const targetRpm = this.targetRpmFor(target, ctx.wheelOmega);
      const limit = this.cfg.shift.maxDownshiftRpmFraction * ctx.revLimitRpm;
      if (targetRpm > limit) {
        if (this.cfg.shift.overRevProtection === 'wait') {
          this.waitingDownshift = { age: 0 };
          return this.log(dir, 'waiting-overrev');
        }
        return this.log(dir, 'rejected-overrev');
      }
    }
    this.waitingDownshift = null;
    this.fromGear = g;
    this.targetGear = target;
    this.kind = g === 0 ? 'select' : dir > 0 ? 'up' : 'down';
    this.cutAtStart = 0;
    this.clutchAtStart = currentClutch;
    this.clutchCommand = currentClutch;
    this.launchAfter = false;
    // From neutral the clutch is already open: go straight to the dog engagement.
    if (this.kind === 'select') {
      this.enter(currentClutch < 0.02 ? 'GEAR_CHANGE' : 'CLUTCH_DISENGAGE');
    } else if (ctx.pedal > 0.05 && currentClutch > 0.05) {
      this.enter('TORQUE_CUT');
    } else {
      this.enter('CLUTCH_DISENGAGE');
    }
    return this.log(dir, 'started');
  }

  private enter(s: ShiftState): void {
    this.state = s;
    this.stateTime = 0;
    if (s === 'CLUTCH_DISENGAGE') this.clutchAtStart = this.clutchCommand;
    if (s === 'CLUTCH_ENGAGE') this.cutAtStart = this.sparkCut;
  }

  /** Advances the sequencer; returns true on the step the shift completed. */
  update(h: number, ctx: ShiftContext, simTime: number, currentClutch: number): boolean {
    this.simTime = simTime;
    if (!Number.isNaN(this.lastRpm)) {
      const raw = (ctx.engineRpm - this.lastRpm) / h;
      this.rpmRate += (raw - this.rpmRate) * Math.min(1, h / 0.02);
    }
    this.lastRpm = ctx.engineRpm;
    const sh = this.cfg.shift;
    const gb = this.gearbox;
    if (this.pending) {
      this.pending.age += h;
      if (this.pending.age > this.bufferWindowS + 1) this.pending = null;
    }
    if (this.waitingDownshift && this.state === 'IDLE') {
      this.waitingDownshift.age += h;
      const target = gb.gear - 1;
      const ok =
        target >= 1 &&
        this.targetRpmFor(target, ctx.wheelOmega) <= sh.maxDownshiftRpmFraction * ctx.revLimitRpm;
      if (ok) {
        this.waitingDownshift = null;
        this.begin(-1, ctx, currentClutch);
      } else if (this.waitingDownshift.age > 1.5) {
        this.waitingDownshift = null;
        this.log(-1, 'rejected-overrev');
      }
    }
    if (this.state === 'IDLE') {
      this.sparkCut = 0;
      this.throttleOverride = null;
      return false;
    }
    this.stateTime += h;
    const t = this.stateTime;
    switch (this.state) {
      case 'TORQUE_CUT': {
        const d = sh.torqueCutTimeS;
        this.sparkCut = clamp01(t / d);
        this.clutchCommand = this.clutchAtStart;
        if (t >= d) this.enter('CLUTCH_DISENGAGE');
        break;
      }
      case 'CLUTCH_DISENGAGE': {
        const d = sh.clutchDisengageTimeS;
        if (this.kind !== 'select') this.sparkCut = this.kind === 'up' || ctx.pedal > 0.05 ? 1 : 0;
        this.clutchCommand = this.clutchAtStart * (1 - clamp01(t / d));
        if (t >= d) {
          this.clutchCommand = 0;
          gb.engaged = false; // dogs out: neutral path
          this.enter('GEAR_CHANGE');
        }
        break;
      }
      case 'GEAR_CHANGE': {
        this.clutchCommand = 0;
        gb.engaged = false;
        if (this.kind === 'up') {
          this.sparkCut = 1;
          this.throttleOverride = 0; // throttle closed so pumping helps the revs fall
        } else if (this.kind === 'down') {
          this.sparkCut = 0;
          this.throttleOverride = this.blip(ctx);
        } else {
          this.sparkCut = 0;
          this.throttleOverride = null;
        }
        if (t >= sh.gearChangeTimeS) {
          gb.gear = this.targetGear;
          gb.engaged = this.targetGear > 0;
          if (this.targetGear === 0) {
            this.enter('COMPLETE');
          } else if (this.kind === 'select' && Math.abs(ctx.vehicleSpeed) < 1.5) {
            // standing start: the automatic clutch performs the launch
            this.launchAfter = true;
            this.enter('COMPLETE');
          } else {
            this.enter('REV_MATCH');
          }
        }
        break;
      }
      case 'REV_MATCH': {
        this.clutchCommand = 0;
        const target = this.targetRpmFor(this.targetGear, ctx.wheelOmega);
        const err = target - ctx.engineRpm;
        const rm = sh.revMatch;
        if (this.kind === 'up') {
          // rev drop: keep the spark cut and the throttle closed while the inertia slows the crank
          this.sparkCut = 1;
          this.throttleOverride = 0;
        } else {
          this.sparkCut = 0;
          this.throttleOverride = rm.enabled ? this.blip(ctx) : null;
        }
        if (this.kind === 'up') {
          // the clutch synchronizes whatever the free fall did not (slip energy goes to the clutch)
          if (err > -rm.toleranceRpm || t >= sh.upshiftFreeFallMaxS) this.enter('CLUTCH_ENGAGE');
        } else {
          const done = !rm.enabled || Math.abs(err) < rm.toleranceRpm;
          if (done || t >= rm.timeoutS) this.enter('CLUTCH_ENGAGE');
        }
        break;
      }
      case 'CLUTCH_ENGAGE': {
        const d = sh.clutchEngageTimeS;
        const x = clamp01(t / d);
        this.throttleOverride = null;
        // progressive clamp; slip absorbs the remaining speed difference
        this.clutchCommand = x * x * (3 - 2 * x);
        this.sparkCut = this.cutAtStart * (1 - x);
        if (t >= d) {
          this.clutchCommand = 1;
          this.sparkCut = 0;
          this.enter('COMPLETE');
        }
        break;
      }
      case 'COMPLETE': {
        this.sparkCut = 0;
        this.throttleOverride = null;
        this.history.push({
          time: simTime,
          kind: this.kind ?? 'up',
          from: this.fromGear,
          to: this.targetGear,
          result: 'completed',
        });
        if (this.history.length > 64) this.history.shift();
        this.lastResult = 'completed';
        this.state = 'IDLE';
        this.kind = null;
        const p = this.pending;
        this.pending = null;
        if (p && p.age <= this.bufferWindowS) this.begin(p.dir, ctx, this.launchAfter ? 0 : 1);
        return true;
      }
      default:
        break;
    }
    return false;
  }

  /**
   * Predictive throttle blip towards the rev-match target: acts on the speed the engine will have
   * one lead time ahead (the torque answers the throttle only after the actuator and manifold
   * lags), so the blip is released before the target instead of overshooting it.
   */
  private blip(ctx: ShiftContext): number {
    const rm = this.cfg.shift.revMatch;
    if (!rm.enabled) return 0;
    const target = this.targetRpmFor(this.targetGear, ctx.wheelOmega);
    const err = target - (ctx.engineRpm + this.rpmRate * rm.leadTimeS);
    return clamp((err / 1000) * rm.gain, 0, rm.maxBlipThrottle);
  }
}
