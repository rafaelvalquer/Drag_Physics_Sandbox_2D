/**
 * N₂O injection of a car (subsystem of the simulation, never a permanent power bonus).
 *
 * The controller holds the cylinder (kg of N₂O), splits it between one or two discharges, and turns
 * the flow into extra engine torque. It is advanced with the physics step only (no wall-clock timers)
 * and is deterministic: the same state and requests give the same run.
 *
 *   flow = maxFlow · flowFraction · ramp(t) · injectable(0|1)      (kg/s)
 *   P    = flow · ENERGY · fuelFactor                              (W, extra combustion power)
 *   T    = P / ω                                                   (N·m, added to the crank torque)
 *
 * The torque goes through the engine, clutch, gearbox, differential, tyres and road like any other:
 * it cannot bypass grip or driveline limits.
 */
import { NITROUS_ENERGY_J_PER_KG } from '../../game/career/tuning/nitrousParts';

export type NitrousMode = 'single' | 'dual';

export type NitrousStatus = 'UNAVAILABLE' | 'READY' | 'STAGE_1_ACTIVE' | 'STAGE_2_READY' | 'STAGE_2_ACTIVE' | 'DEPLETED' | 'DISABLED';

/** Physical kit + the tune of one car (what the resolver puts on the car). */
export interface NitrousSetup {
  kitId: string;
  capacityKg: number;
  maxFlowKgS: number;
  /** Fuel system capacity the kit asks for (1 = stock). */
  fuelNeed: number;
  /** Lowest engine speed the injection may start and run at (rpm). */
  minRpm: number;
  mode: NitrousMode;
  /** Share of the cylinder of stage 1 (dual mode); stage 2 takes the rest. Single mode: 1. */
  stage1Share: number;
  stage1Flow: number;
  stage1RampS: number;
  stage2Flow: number;
  stage2RampS: number;
  /** Capacity of the car's fuel system (1 = stock; pump and injectors raise it). */
  fuelSupply: number;
  /** Peak torque the internals carry (N·m) for the strain check; 0 = unknown. */
  torqueLimitNm: number;
}

export interface NitrousTelemetry {
  status: NitrousStatus;
  activeStage: 0 | 1 | 2;
  remainingFraction: number;
  stage1RemainingFraction: number;
  stage2RemainingFraction: number;
  flowKgPerS: number;
  additionalTorqueNm: number;
  additionalPowerW: number;
  estimatedRemainingS: number | null;
  consumedKg: number;
  activeTimeS: number;
}

export type NitrousEvent = { type: 'START'; stage: 1 | 2 } | { type: 'STAGE_END'; stage: 1 | 2 } | { type: 'DEPLETED' };

export interface NitrousContext {
  /** Engine speed (rpm). */
  rpm: number;
  /** The engine is burning now (running, no fuel cut, no limiter, no spark cut). */
  injectable: boolean;
  /** The engine is broken. */
  broken: boolean;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** Shortest ramp (s): a zero setting still rises over a few steps, never as a single torque step. */
const MIN_RAMP_S = 0.06;
const MIN_OMEGA = (1500 * 2 * Math.PI) / 60;

export class NitrousController {
  status: NitrousStatus;
  private activeStage: 0 | 1 | 2 = 0;
  private reserve1: number;
  private reserve2: number;
  private stageTimeS = 0;
  private consumedKg = 0;
  private activeTimeS = 0;
  private flowKgS = 0;
  private torqueNm = 0;
  private powerW = 0;
  /** Raised by the simulation (HUD, audio): consumed by `drainEvents`. */
  private readonly events: NitrousEvent[] = [];
  readonly setup: NitrousSetup;

  constructor(setup: NitrousSetup) {
    this.setup = { ...setup };
    const dual = setup.mode === 'dual';
    const share = dual ? clamp(setup.stage1Share, 0.2, 0.8) : 1;
    this.setup.stage1Share = share;
    this.reserve1 = setup.capacityKg * share;
    this.reserve2 = dual ? setup.capacityKg * (1 - share) : 0;
    this.status = 'READY';
  }

  /** Full cylinder again (new attempt, restart, new dyno run). */
  reset(): void {
    const s = this.setup;
    this.reserve1 = s.capacityKg * s.stage1Share;
    this.reserve2 = s.mode === 'dual' ? s.capacityKg * (1 - s.stage1Share) : 0;
    this.status = 'READY';
    this.activeStage = 0;
    this.stageTimeS = 0;
    this.consumedKg = 0;
    this.activeTimeS = 0;
    this.flowKgS = 0;
    this.torqueNm = 0;
    this.powerW = 0;
    this.events.length = 0;
  }

  /** Extra torque to add to the crank this step (N·m). */
  get additionalTorqueNm(): number {
    return this.torqueNm;
  }

  get active(): boolean {
    return this.status === 'STAGE_1_ACTIVE' || this.status === 'STAGE_2_ACTIVE';
  }

  /** Fraction of the whole cylinder left. */
  get remainingFraction(): number {
    return clamp((this.reserve1 + this.reserve2) / this.setup.capacityKg, 0, 1);
  }

  /** The stage the next press of the key would start, or 0. */
  get startableStage(): 0 | 1 | 2 {
    return this.status === 'READY' ? 1 : this.status === 'STAGE_2_READY' ? 2 : 0;
  }

  /**
   * A press of the key. Starts stage 1 (READY) or stage 2 (STAGE_2_READY); anything else is ignored,
   * and a start the engine cannot take (stopped, broken, too slow) is refused without spending N₂O.
   * Returns true when a stage started.
   */
  request(ctx: NitrousContext): boolean {
    const stage = this.startableStage;
    if (stage === 0 || ctx.broken || !ctx.injectable || ctx.rpm < this.setup.minRpm) return false;
    this.activeStage = stage;
    this.stageTimeS = 0;
    this.status = stage === 1 ? 'STAGE_1_ACTIVE' : 'STAGE_2_ACTIVE';
    this.events.push({ type: 'START', stage });
    return true;
  }

  /** The attempt ended (finish line, engine failure): no more injection until `reset`. */
  disable(): void {
    if (this.status === 'UNAVAILABLE') return;
    this.status = 'DISABLED';
    this.activeStage = 0;
    this.flowKgS = 0;
    this.torqueNm = 0;
    this.powerW = 0;
  }

  drainEvents(): NitrousEvent[] {
    return this.events.length ? this.events.splice(0) : this.events;
  }

  private stageFlow(stage: 1 | 2): number {
    const s = this.setup;
    return s.maxFlowKgS * clamp(stage === 1 ? s.stage1Flow : s.stage2Flow, 0, 1);
  }

  private stageRamp(stage: 1 | 2): number {
    const r = stage === 1 ? this.setup.stage1RampS : this.setup.stage2RampS;
    return Math.max(MIN_RAMP_S, r);
  }

  /** Smooth 0..1 rise of the flow over the ramp (no step in torque). */
  private ramp(stage: 1 | 2): number {
    const x = clamp(this.stageTimeS / this.stageRamp(stage), 0, 1);
    return x * x * (3 - 2 * x);
  }

  /** Power per kg/s of N₂O the engine can use: limited by the fuel system (lean = less power). */
  fuelFactor(): number {
    const f = this.setup.fuelSupply / Math.max(this.setup.fuelNeed, 0.01);
    return clamp(f, 0, 1) ** 1.5;
  }

  /**
   * Advances one physics step. Reads the engine state, consumes N₂O and computes the extra torque.
   * An interrupted injection (spark cut, limiter, low speed) pauses the flow without spending N₂O;
   * a stage that already started stays committed and resumes when the engine takes it again.
   */
  update(h: number, ctx: NitrousContext): void {
    this.flowKgS = 0;
    this.torqueNm = 0;
    this.powerW = 0;
    if (ctx.broken && this.status !== 'DISABLED' && this.status !== 'UNAVAILABLE') {
      this.disable();
      return;
    }
    if (!this.active) return;
    const stage = this.activeStage as 1 | 2;
    this.stageTimeS += h;
    const okNow = ctx.injectable && ctx.rpm >= this.setup.minRpm * 0.85;
    if (!okNow) return;
    const reserve = stage === 1 ? this.reserve1 : this.reserve2;
    let flow = this.stageFlow(stage) * this.ramp(stage);
    // the last step spends only what is left
    const spend = Math.min(reserve, flow * h);
    flow = spend / h;
    if (stage === 1) this.reserve1 -= spend;
    else this.reserve2 -= spend;
    this.consumedKg += spend;
    this.activeTimeS += h;
    this.flowKgS = flow;
    const power = flow * NITROUS_ENERGY_J_PER_KG * this.fuelFactor();
    const omega = Math.max((ctx.rpm * 2 * Math.PI) / 60, MIN_OMEGA);
    this.powerW = power;
    this.torqueNm = power / omega;
    const left = stage === 1 ? this.reserve1 : this.reserve2;
    if (left <= 1e-12) this.finishStage(stage);
  }

  private finishStage(stage: 1 | 2): void {
    this.events.push({ type: 'STAGE_END', stage });
    this.activeStage = 0;
    this.stageTimeS = 0;
    if (stage === 1 && this.setup.mode === 'dual' && this.reserve2 > 1e-12) this.status = 'STAGE_2_READY';
    else {
      this.status = 'DEPLETED';
      this.events.push({ type: 'DEPLETED' });
    }
  }

  telemetry(): NitrousTelemetry {
    const s = this.setup;
    const c = s.capacityKg;
    const stage = this.activeStage;
    const nominal = stage === 0 ? 0 : this.stageFlow(stage as 1 | 2);
    const reserve = stage === 1 ? this.reserve1 : stage === 2 ? this.reserve2 : 0;
    return {
      status: this.status,
      activeStage: stage,
      remainingFraction: this.remainingFraction,
      stage1RemainingFraction: clamp(this.reserve1 / Math.max(c * s.stage1Share, 1e-9), 0, 1),
      stage2RemainingFraction: s.mode === 'dual' ? clamp(this.reserve2 / Math.max(c * (1 - s.stage1Share), 1e-9), 0, 1) : 0,
      flowKgPerS: this.flowKgS,
      additionalTorqueNm: this.torqueNm,
      additionalPowerW: this.powerW,
      estimatedRemainingS: nominal > 0 ? reserve / nominal : null,
      consumedKg: this.consumedKg,
      activeTimeS: this.activeTimeS,
    };
  }

  /** Strain ratio of the torque against what the internals carry (>1 = over the limit). */
  torqueRatio(engineTorqueNm: number): number {
    return this.setup.torqueLimitNm > 0 ? engineTorqueNm / this.setup.torqueLimitNm : 0;
  }
}

/** Nominal figures of a stage for the Workshop preview: power at a speed, duration, share of the cylinder. */
export function nitrousStagePreview(setup: NitrousSetup, stage: 1 | 2, rpm: number): { powerCv: number; torqueNm: number; durationS: number; reserveKg: number } {
  const share = setup.mode === 'dual' ? (stage === 1 ? setup.stage1Share : 1 - setup.stage1Share) : 1;
  const reserveKg = setup.capacityKg * share;
  const flow = setup.maxFlowKgS * clamp(stage === 1 ? setup.stage1Flow : setup.stage2Flow, 0, 1);
  const ramp = Math.max(MIN_RAMP_S, stage === 1 ? setup.stage1RampS : setup.stage2RampS);
  const f = Math.max(setup.fuelSupply, 0) / Math.max(setup.fuelNeed, 0.01);
  const fuel = clamp(f, 0, 1) ** 1.5;
  const powerW = flow * NITROUS_ENERGY_J_PER_KG * fuel;
  const omega = Math.max((rpm * 2 * Math.PI) / 60, MIN_OMEGA);
  // the rise over the ramp spends half the nominal flow during `ramp`
  const rampKg = (flow * ramp) / 2;
  const durationS = flow <= 0 ? 0 : reserveKg <= rampKg ? Math.sqrt((2 * reserveKg * ramp) / flow) : ramp + (reserveKg - rampKg) / flow;
  return { powerCv: powerW / 735.5, torqueNm: powerW / omega, durationS, reserveKg };
}
