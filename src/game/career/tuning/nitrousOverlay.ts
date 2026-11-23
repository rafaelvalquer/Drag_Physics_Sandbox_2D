import { validateCar, type CarConfig, type NitrousConfig } from '../../../data/schema';
import type { BuildResult, BuildTune } from './buildCommon';
import { deepFreeze } from './buildCommon';
import { findNitrousKit, NITROUS_FLOW_MAX, NITROUS_FLOW_MIN, NITROUS_RAMP_MAX_S, NITROUS_SHARE_MAX, NITROUS_SHARE_MIN } from './nitrousParts';
import { findPart, type NitrousKitPart } from './parts';

/** Defaults of a freshly installed kit: one discharge at 70 % of the flow with a short ramp. */
export const NITROUS_DEFAULTS = { mode: 'single' as const, share: 0.5, flow1: 0.7, ramp1: 0.3, flow2: 0.5, ramp2: 1 };

export interface NitrousTuneValues {
  mode: 'single' | 'dual';
  share: number;
  flow1: number;
  ramp1: number;
  flow2: number;
  ramp2: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The kit installed in a part list (one per car), or undefined. */
export function nitrousKitOf(partIds: readonly string[]): NitrousKitPart | undefined {
  for (const id of partIds) {
    const k = findNitrousKit(id);
    if (k) return k;
  }
  return undefined;
}

/** The tune with every setting filled in (defaults) and limited to what the kit allows. */
export function nitrousTuneOf(kit: NitrousKitPart, tune: BuildTune): NitrousTuneValues {
  const d = NITROUS_DEFAULTS;
  const rampMax = NITROUS_RAMP_MAX_S * kit.kit.rampControl;
  return {
    mode: tune.nitrousMode ?? d.mode,
    share: clamp(tune.nitrousShare ?? d.share, NITROUS_SHARE_MIN, NITROUS_SHARE_MAX),
    flow1: clamp(tune.nitrousFlow1 ?? d.flow1, NITROUS_FLOW_MIN, NITROUS_FLOW_MAX),
    ramp1: clamp(tune.nitrousRamp1 ?? d.ramp1, 0, rampMax),
    flow2: clamp(tune.nitrousFlow2 ?? d.flow2, NITROUS_FLOW_MIN, NITROUS_FLOW_MAX),
    ramp2: clamp(tune.nitrousRamp2 ?? d.ramp2, 0, rampMax),
  };
}

/** Ranges the Workshop shows for a kit. */
export function nitrousLimits(kit: NitrousKitPart): { flowMin: number; flowMax: number; rampMax: number; shareMin: number; shareMax: number } {
  return { flowMin: NITROUS_FLOW_MIN, flowMax: NITROUS_FLOW_MAX, rampMax: NITROUS_RAMP_MAX_S * kit.kit.rampControl, shareMin: NITROUS_SHARE_MIN, shareMax: NITROUS_SHARE_MAX };
}

const NITROUS_LABEL: Record<string, string> = {
  nitrousMode: 'Modo do nitro',
  nitrousShare: 'Divisão do nitro',
  nitrousFlow1: 'Vazão do estágio 1',
  nitrousRamp1: 'Rampa do estágio 1',
  nitrousFlow2: 'Vazão do estágio 2',
  nitrousRamp2: 'Rampa do estágio 2',
};

/** Errors (pt-BR) of the nitrous settings of a tune against the installed kit. */
export function validateNitrousTune(kit: NitrousKitPart | undefined, tune: BuildTune): string[] {
  const errs: string[] = [];
  const set = Object.keys(NITROUS_LABEL).filter((k) => (tune as Record<string, unknown>)[k] !== undefined);
  if (!set.length) return errs;
  if (!kit) return set.map((k) => `${NITROUS_LABEL[k]}: exige um kit de nitro instalado.`);
  const lim = nitrousLimits(kit);
  const inRange = (k: string, v: number | undefined, lo: number, hi: number): void => {
    if (v === undefined) return;
    if (!Number.isFinite(v) || v < lo - 1e-6 || v > hi + 1e-6) errs.push(`${NITROUS_LABEL[k]} fora da faixa (${lo.toFixed(2).replace('.', ',')} a ${hi.toFixed(2).replace('.', ',')})`);
  };
  if (tune.nitrousMode !== undefined && tune.nitrousMode !== 'single' && tune.nitrousMode !== 'dual') errs.push('modo do nitro desconhecido');
  inRange('nitrousShare', tune.nitrousShare, lim.shareMin, lim.shareMax);
  inRange('nitrousFlow1', tune.nitrousFlow1, lim.flowMin, lim.flowMax);
  inRange('nitrousFlow2', tune.nitrousFlow2, lim.flowMin, lim.flowMax);
  inRange('nitrousRamp1', tune.nitrousRamp1, 0, lim.rampMax);
  inRange('nitrousRamp2', tune.nitrousRamp2, 0, lim.rampMax);
  return errs;
}

/** Fuel system capacity of a part list, relative to the stock one (pump, injectors, modern fuel stages). */
export function fuelSupplyOf(partIds: readonly string[]): number {
  const fuel = partIds.map(findPart).find((p) => p?.category === 'electronics-fuel');
  if (!fuel) return 1;
  if ('fuelCapacityScale' in fuel && typeof fuel.fuelCapacityScale === 'number') return fuel.fuelCapacityScale;
  if ('mod' in fuel && fuel.mod.fuelBoostLimitBar) return fuel.mod.fuelBoostLimitBar >= 1.4 ? 1.45 : 1.15;
  return 1;
}

/** Peak crank torque the internals carry (N·m): stock limit, or what the installed forged parts allow. */
export function internalsTorqueLimitOf(base: CarConfig, partIds: readonly string[], hw: Extract<BuildResult, { ok: true }>): number {
  if ('internalTorqueLimitNm' in hw && typeof hw.internalTorqueLimitNm === 'number') return hw.internalTorqueLimitNm;
  let limit = Math.max(320, base.transmission.clutch.maxTorqueNm * 1.45);
  for (const id of partIds) {
    const p = findPart(id);
    if (p && 'mod' in p && typeof p.mod.internalTorqueLimitNm === 'number') limit = Math.max(limit, p.mod.internalTorqueLimitNm);
  }
  return limit;
}

/**
 * Puts the N₂O system on a resolved car: the kit's mass (carried with the nitro off too) and the
 * physical setup the simulation runs. The engine curve and the rest of the build are untouched: the
 * extra torque only exists while an injection runs.
 */
export function applyNitrousOverlay(base: CarConfig, partIds: readonly string[], hw: Extract<BuildResult, { ok: true }>, tune: BuildTune, kit: NitrousKitPart, key: string): BuildResult {
  const errors = validateNitrousTune(kit, tune);
  if (errors.length) return { ok: false, errors };
  const t = nitrousTuneOf(kit, tune);
  const car = structuredClone(hw.car) as CarConfig;
  car.massKg = Math.round((car.massKg + kit.kit.massKg) * 100) / 100;
  const dual = t.mode === 'dual';
  const setup: NitrousConfig = {
    kitId: kit.id,
    capacityKg: kit.kit.capacityKg,
    maxFlowKgS: kit.kit.maxFlowKgS,
    fuelNeed: kit.kit.fuelNeed,
    minRpm: Math.max(kit.kit.minRpm, car.engine.idleRpm * 2),
    mode: t.mode,
    stage1Share: dual ? t.share : 1,
    stage1Flow: t.flow1,
    stage1RampS: t.ramp1,
    stage2Flow: dual ? t.flow2 : t.flow1,
    stage2RampS: dual ? t.ramp2 : t.ramp1,
    fuelSupply: fuelSupplyOf(partIds),
    torqueLimitNm: Math.round(internalsTorqueLimitOf(base, partIds, hw)),
  };
  car.nitrous = setup;
  const v = validateCar(car);
  if (!v.ok) return { ok: false, errors: v.errors };
  return { ...hw, car: deepFreeze(v.value!), key };
}
