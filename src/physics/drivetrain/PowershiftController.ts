import type { ShiftState } from '../../core/contracts';
import type { TransmissionConfig, TransmissionKind } from '../../data/schema';
import { clamp, clamp01 } from '../../core/math';
import { radSToRpm } from '../../core/units';
import type { Gearbox } from './Gearbox';
import type { ShiftContext, ShiftEvent, ShiftKind, ShiftRequestResult } from './ShiftController';

export type GearboxMode = 'D' | 'M';

/**
 * Clutch-to-clutch power shift sequencer for dual-clutch gearboxes and planetary automatics.
 *
 * Unlike the manual sequencer there is no dog change with the driveline open: every gear has its
 * own friction element (a clutch of the odd/even shaft of a DCT, or the shift elements of a
 * planetary set). The vehicle solves two bounded rows – the offgoing element at the current ratio
 * and the oncoming element at the target ratio – and this controller only commands their
 * capacities:
 *
 * Upshift: TORQUE_PHASE (oncoming capacity rises while the offgoing one falls; the engine speed is
 * still tied to the old ratio, the torque is handed over without interruption) → INERTIA_PHASE
 * (offgoing open, the oncoming element slips at a set capacity and pulls the input speed down to
 * the new ratio, the engine control removes part of the torque) → COMPLETE when synchronized.
 *
 * Downshift: CLUTCH_DISENGAGE (offgoing releases, throttle blip) → REV_MATCH (input rises
 * towards the lower-gear speed) → CLUTCH_ENGAGE (oncoming closes) → COMPLETE.
 *
 * Selecting first from neutral engages the first-gear element (CLUTCH_ENGAGE). On a dual-clutch
 * gearbox the launch is then done by the automatic clutch logic on the first-gear clutch.
 */
export class PowershiftController {
  state: ShiftState = 'IDLE';
  kind: ShiftKind | null = null;
  fromGear = 0;
  targetGear = 0;
  stateTime = 0;
  sparkCut = 0;
  /** Capacity command of the element of the current gear (0..1). */
  clutchCommand = 1;
  /** Capacity command of the oncoming element (0..1). */
  oncomingCommand = 0;
  throttleOverride: number | null = null;
  launchAfter = false;
  mode: GearboxMode = 'D';
  pending: { dir: 1 | -1; age: number } | null = null;
  readonly bufferWindowS = 0.35;
  lastResult: ShiftRequestResult | 'completed' | null = null;
  readonly history: ShiftEvent[] = [];
  /** Duration of the last completed shift (request → synchronized), for tests and telemetry. */
  lastShiftDurationS = 0;
  private simTime = 0;
  private startedAt = 0;
  private offAtStart = 1;

  constructor(
    public cfg: TransmissionConfig,
    private readonly gearbox: Gearbox,
    readonly transmissionKind: TransmissionKind,
  ) {}

  get active(): boolean {
    return this.state !== 'IDLE';
  }

  /** Gear of the oncoming element while a shift is in progress (0 otherwise). */
  get oncomingGear(): number {
    return this.active && this.kind !== 'select' ? this.targetGear : 0;
  }

  reset(): void {
    this.state = 'IDLE';
    this.kind = null;
    this.stateTime = 0;
    this.sparkCut = 0;
    this.clutchCommand = 1;
    this.oncomingCommand = 0;
    this.throttleOverride = null;
    this.launchAfter = false;
    this.pending = null;
    this.lastResult = null;
    this.history.length = 0;
    this.mode = 'D';
  }

  /** Manual request (paddles / E-Q). Any request in gear puts an automatic in manual mode. */
  request(dir: 1 | -1, ctx: ShiftContext, currentClutch: number): ShiftRequestResult {
    if (this.gearbox.gear >= 1) this.mode = 'M';
    return this.requestInternal(dir, ctx, currentClutch);
  }

  /** Request from the shift schedule (mode D). */
  requestAuto(dir: 1 | -1, ctx: ShiftContext, currentClutch: number): ShiftRequestResult {
    return this.requestInternal(dir, ctx, currentClutch);
  }

  private requestInternal(dir: 1 | -1, ctx: ShiftContext, currentClutch: number): ShiftRequestResult {
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

  targetRpmFor(gear: number, outputOmega: number): number {
    return radSToRpm(Math.abs(outputOmega) * this.gearbox.overallRatio(gear));
  }

  private begin(dir: 1 | -1, ctx: ShiftContext, currentClutch: number): ShiftRequestResult {
    const gb = this.gearbox;
    const g = gb.gear;
    const target = g + dir;
    if (target < 0 || target > gb.gearCount) return this.log(dir, 'rejected-no-gear');
    if (dir < 0 && target >= 1) {
      const rpm = this.targetRpmFor(target, ctx.wheelOmega);
      if (rpm > this.cfg.shift.maxDownshiftRpmFraction * ctx.revLimitRpm) return this.log(dir, 'rejected-overrev');
    }
    this.fromGear = g;
    this.targetGear = target;
    this.startedAt = this.simTime;
    this.launchAfter = false;
    this.offAtStart = currentClutch;
    if (g === 0) {
      // N → 1: engage the first-gear element
      this.kind = 'select';
      gb.gear = target;
      gb.engaged = true;
      this.clutchCommand = 0;
      this.oncomingCommand = 0;
      this.enter('CLUTCH_ENGAGE');
    } else if (target === 0) {
      this.kind = 'down';
      this.enter('CLUTCH_DISENGAGE');
    } else if (dir > 0) {
      this.kind = 'up';
      this.oncomingCommand = 0;
      this.enter('TORQUE_PHASE');
    } else {
      this.kind = 'down';
      this.oncomingCommand = 0;
      this.enter('CLUTCH_DISENGAGE');
    }
    return this.log(dir, 'started');
  }

  private enter(s: ShiftState): void {
    this.state = s;
    this.stateTime = 0;
  }

  /**
   * Advances the sequencer. `inputOmega` is the speed of the gearbox input member (crank of a
   * DCT, turbine of an automatic) and `outputOmega` the gearbox output referred to the wheels.
   */
  update(h: number, ctx: ShiftContext, simTime: number, inputOmega: number, _currentClutch: number): boolean {
    this.simTime = simTime;
    const ps = this.cfg.powershift!;
    const gb = this.gearbox;
    if (this.pending) {
      this.pending.age += h;
      if (this.pending.age > this.bufferWindowS + 1) this.pending = null;
    }
    if (this.state === 'IDLE') {
      this.sparkCut = 0;
      this.throttleOverride = null;
      this.oncomingCommand = 0;
      return false;
    }
    this.stateTime += h;
    const t = this.stateTime;
    const inputRpm = radSToRpm(Math.abs(inputOmega));
    switch (this.state) {
      case 'TORQUE_PHASE': {
        // hand-over: the sum of capacities stays ≥ 1 so the torque path is never open
        const x = clamp01(t / ps.torquePhaseS);
        this.oncomingCommand = ps.inertiaCapacity * x;
        this.clutchCommand = this.offAtStart * (1 - x);
        this.sparkCut = ps.torqueReduction * x * 0.5;
        if (t >= ps.torquePhaseS) {
          this.clutchCommand = 0;
          this.enter('INERTIA_PHASE');
        }
        break;
      }
      case 'INERTIA_PHASE': {
        this.clutchCommand = 0;
        this.oncomingCommand = ps.inertiaCapacity;
        this.sparkCut = ps.torqueReduction;
        const target = this.targetRpmFor(this.targetGear, ctx.wheelOmega);
        if (inputRpm - target < 60 || t >= ps.inertiaPhaseMaxS) this.finishShift(simTime);
        break;
      }
      case 'CLUTCH_DISENGAGE': {
        const x = clamp01(t / ps.downshiftReleaseS);
        this.clutchCommand = this.offAtStart * (1 - x);
        this.sparkCut = 0;
        this.throttleOverride = this.targetGear > 0 ? this.blip(ctx) : null;
        if (t >= ps.downshiftReleaseS) {
          this.clutchCommand = 0;
          if (this.targetGear === 0) {
            gb.gear = 0;
            gb.engaged = false;
            this.complete(simTime);
            return true;
          }
          this.enter('REV_MATCH');
        }
        break;
      }
      case 'REV_MATCH': {
        this.clutchCommand = 0;
        this.throttleOverride = this.blip(ctx);
        const target = this.targetRpmFor(this.targetGear, ctx.wheelOmega);
        const rm = this.cfg.shift.revMatch;
        if (Math.abs(target - inputRpm) < rm.toleranceRpm || t >= rm.timeoutS) this.enter('CLUTCH_ENGAGE');
        break;
      }
      case 'CLUTCH_ENGAGE': {
        const d = this.kind === 'select' ? Math.max(this.cfg.shift.clutchEngageTimeS, 0.15) : ps.torquePhaseS;
        const x = clamp01(t / d);
        this.throttleOverride = null;
        if (this.kind === 'select') {
          if (this.transmissionKind === 'dual-clutch') {
            // first gear preselected: the clutch stays open, the launch logic will close it
            this.clutchCommand = 0;
            this.launchAfter = true;
            this.complete(simTime);
            return true;
          }
          // planetary automatic: the first-gear element closes; the converter does the launch
          this.clutchCommand = x * x * (3 - 2 * x);
          if (t >= d) {
            this.clutchCommand = 1;
            this.complete(simTime);
            return true;
          }
        } else {
          this.oncomingCommand = x * x * (3 - 2 * x);
          if (t >= d) this.finishShift(simTime);
        }
        break;
      }
      default:
        break;
    }
    return !this.active;
  }

  private finishShift(simTime: number): void {
    this.gearbox.gear = this.targetGear;
    this.gearbox.engaged = true;
    this.clutchCommand = 1;
    this.oncomingCommand = 0;
    this.complete(simTime);
  }

  private complete(simTime: number): void {
    this.sparkCut = 0;
    this.throttleOverride = null;
    this.lastShiftDurationS = simTime - this.startedAt;
    this.history.push({ time: simTime, kind: this.kind ?? 'up', from: this.fromGear, to: this.targetGear, result: 'completed' });
    if (this.history.length > 64) this.history.shift();
    this.lastResult = 'completed';
    this.state = 'IDLE';
    this.kind = null;
    if (this.gearbox.gear === 0) this.mode = 'D';
    const p = this.pending;
    this.pending = null;
    if (p && p.age <= this.bufferWindowS) this.pendingRetry = p.dir;
  }

  /** Buffered request re-issued by the vehicle on the next step (needs a fresh context). */
  pendingRetry: 1 | -1 | null = null;

  private blip(ctx: ShiftContext): number {
    const rm = this.cfg.shift.revMatch;
    if (!rm.enabled) return 0;
    const target = this.targetRpmFor(this.targetGear, ctx.wheelOmega);
    return clamp(((target - ctx.engineRpm) / 1000) * rm.gain, 0, rm.maxBlipThrottle);
  }
}

/**
 * Upshift/downshift decision of the automatic mode (D). pedalMemory is the driver demand the
 * gearbox controller keeps (fast attack, slow release – it does not upshift early because the
 * driver feathered the pedal for traction); kickdown is true on the step the pedal is pushed
 * past the kickdown point.
 */
export function autoShiftDecision(
  cfg: TransmissionConfig,
  gear: number,
  gearCount: number,
  inputRpm: number,
  outputOmega: number,
  pedal: number,
  pedalMemory: number,
  kickdown: boolean,
  idleRpm: number,
  revLimitRpm: number,
  overallRatio: (g: number) => number,
): 1 | -1 | 0 {
  const a = cfg.autoShift;
  if (!a || gear < 1) return 0;
  const p = clamp01(Math.max(pedal, pedalMemory));
  const up = a.lightUpshiftRpm + (a.wotUpshiftFraction * revLimitRpm - a.lightUpshiftRpm) * clamp01((p - 0.15) / 0.75);
  if (gear < gearCount && inputRpm >= up) return 1;
  if (gear > 1) {
    const lowerRpm = radSToRpm(Math.abs(outputOmega) * overallRatio(gear - 1));
    const fits = lowerRpm < 0.85 * revLimitRpm;
    if (kickdown && inputRpm < a.kickdownRpm && fits) return -1;
    // lugging: never stay below 1.6 × idle under load
    if (pedal > 0.3 && inputRpm < 1.6 * idleRpm && fits) return -1;
    if (pedal < 0.05 && inputRpm < a.coastDownshiftRpm) return -1;
  }
  return 0;
}
