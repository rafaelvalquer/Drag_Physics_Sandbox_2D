import { NITROUS_ENERGY_J_PER_KG } from '../../game/career/tuning/nitrousParts';
import { nitrousDurationS, nitrousFlowIntegral } from './nitrousFlow';

export type NitrousStatus = 'UNAVAILABLE' | 'READY' | 'INJECTING' | 'DEPLETED' | 'DISABLED';

export interface NitrousSetup {
  kitId: string;
  capacityKg: number;
  maxFlowKgS: number;
  fuelNeed: number;
  minRpm: number;
  flow: number;
  rampS: number;
  fuelSupply: number;
  torqueLimitNm: number;
}

export interface NitrousTelemetry {
  status: NitrousStatus;
  remainingFraction: number;
  flowKgPerS: number;
  additionalTorqueNm: number;
  additionalPowerW: number;
  estimatedRemainingS: number | null;
  consumedKg: number;
  activeTimeS: number;
}

export type NitrousEvent = { type: 'START' | 'STOP' | 'DEPLETED' };

export interface NitrousContext {
  rpm: number;
  injectable: boolean;
  broken: boolean;
}

function fuelFactor(setup: NitrousSetup): number {
  return Math.min(1, Math.max(0, setup.fuelSupply / Math.max(setup.fuelNeed, 0.01))) ** 1.5;
}

function torqueAt(powerW: number, rpm: number): number {
  return powerW / (Math.max(1500, rpm) * 2 * Math.PI / 60);
}

/** One cylinder per attempt. The fixed simulation step owns all flow and torque. */
export class NitrousController {
  status: NitrousStatus = 'READY';
  private remainingKg: number;
  private rampElapsedS = 0;
  private activeTimeS = 0;
  private flowKgS = 0;
  private torqueNm = 0;
  private powerW = 0;
  private readonly events: NitrousEvent[] = [];
  readonly setup: NitrousSetup;

  constructor(setup: NitrousSetup) {
    this.setup = { ...setup };
    this.remainingKg = setup.capacityKg;
  }

  reset(): void {
    this.remainingKg = this.setup.capacityKg;
    this.status = 'READY';
    this.stopFlow();
    this.activeTimeS = 0;
    this.events.length = 0;
  }

  get additionalTorqueNm(): number { return this.torqueNm; }
  get active(): boolean { return this.flowKgS > 0; }
  get remainingFraction(): number { return this.remainingKg / this.setup.capacityKg; }

  private stopFlow(): void {
    if (this.active) this.events.push({ type: 'STOP' });
    this.rampElapsedS = 0;
    this.flowKgS = 0;
    this.torqueNm = 0;
    this.powerW = 0;
  }

  disable(): void {
    this.stopFlow();
    this.status = 'DISABLED';
  }

  interrupt(): void {
    this.stopFlow();
    if (this.status === 'INJECTING') this.status = 'READY';
  }

  drainEvents(): NitrousEvent[] {
    return this.events.splice(0);
  }

  update(h: number, ctx: NitrousContext, nitrousHeld: boolean): void {
    if (ctx.broken || this.status === 'DISABLED') {
      this.disable();
      return;
    }
    const nominal = this.setup.maxFlowKgS * this.setup.flow;
    if (this.remainingKg <= 0 || !nitrousHeld || !ctx.injectable || ctx.rpm < this.setup.minRpm || nominal <= 0) {
      this.stopFlow();
      this.status = this.remainingKg > 0 ? 'READY' : 'DEPLETED';
      return;
    }
    if (!Number.isFinite(h) || h <= 0) return;

    const start = this.rampElapsedS;
    const end = start + h;
    const { rampS } = this.setup;
    const requested = nominal * (nitrousFlowIntegral(end, rampS) - nitrousFlowIntegral(start, rampS));
    const available = this.remainingKg;
    const spend = Math.min(available, requested);
    if (!this.active) this.events.push({ type: 'START' });
    this.rampElapsedS = end;
    this.remainingKg = available - spend;
    this.activeTimeS += requested > available ? nitrousDurationS(available, nominal, rampS, start) : h;
    this.flowKgS = spend / h;
    this.powerW = this.flowKgS * NITROUS_ENERGY_J_PER_KG * fuelFactor(this.setup);
    this.torqueNm = torqueAt(this.powerW, ctx.rpm);
    this.status = this.remainingKg === 0 ? 'DEPLETED' : 'INJECTING';
    if (this.status === 'DEPLETED') this.events.push({ type: 'DEPLETED' });
  }

  telemetry(): NitrousTelemetry {
    const nominal = this.setup.maxFlowKgS * this.setup.flow;
    return {
      status: this.status,
      remainingFraction: this.remainingFraction,
      flowKgPerS: this.flowKgS,
      additionalTorqueNm: this.torqueNm,
      additionalPowerW: this.powerW,
      estimatedRemainingS: this.status === 'DISABLED' ? null :
        nitrousDurationS(this.remainingKg, nominal, this.setup.rampS, this.rampElapsedS),
      consumedKg: this.setup.capacityKg - this.remainingKg,
      activeTimeS: this.activeTimeS,
    };
  }

  torqueRatio(engineTorqueNm: number): number {
    return this.setup.torqueLimitNm > 0 ? engineTorqueNm / this.setup.torqueLimitNm : 0;
  }
}

export function nitrousPreview(setup: NitrousSetup, rpm: number) {
  const flow = setup.maxFlowKgS * setup.flow;
  const powerW = flow * NITROUS_ENERGY_J_PER_KG * fuelFactor(setup);
  return {
    powerCv: powerW / 735.5,
    torqueNm: torqueAt(powerW, rpm),
    durationS: nitrousDurationS(setup.capacityKg, flow, setup.rampS),
    reserveKg: setup.capacityKg,
  };
}
