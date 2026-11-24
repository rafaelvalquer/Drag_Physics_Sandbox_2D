import { validateCar, type CarConfig, type NitrousConfig } from '../../../data/schema';
import type { BuildResult, BuildTune } from './buildCommon';
import { deepFreeze } from './buildCommon';
import { findNitrousKit, NITROUS_FLOW_MAX, NITROUS_FLOW_MIN, NITROUS_RAMP_MAX_S } from './nitrousParts';
import { findPart, type NitrousKitPart } from './parts';

export const NITROUS_DEFAULTS = { flow: 0.7, rampS: 0.3 };

export interface NitrousTuneValues {
  flow: number;
  rampS: number;
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
    flow: clamp(tune.nitrousFlow ?? d.flow, NITROUS_FLOW_MIN, NITROUS_FLOW_MAX),
    rampS: clamp(tune.nitrousRampS ?? d.rampS, 0, rampMax),
  };
}

/** Ranges the Workshop shows for a kit. */
export function nitrousLimits(kit: NitrousKitPart): { flowMin: number; flowMax: number; rampMax: number } {
  return { flowMin: NITROUS_FLOW_MIN, flowMax: NITROUS_FLOW_MAX, rampMax: NITROUS_RAMP_MAX_S * kit.kit.rampControl };
}

const NITROUS_LABEL: Record<string, string> = {
  nitrousFlow: 'Vazão do nitro',
  nitrousRampS: 'Entrada progressiva do nitro',
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
  inRange('nitrousFlow', tune.nitrousFlow, lim.flowMin, lim.flowMax);
  inRange('nitrousRampS', tune.nitrousRampS, 0, lim.rampMax);
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
  const setup: NitrousConfig = {
    kitId: kit.id,
    capacityKg: kit.kit.capacityKg,
    maxFlowKgS: kit.kit.maxFlowKgS,
    fuelNeed: kit.kit.fuelNeed,
    minRpm: Math.max(kit.kit.minRpm, car.engine.idleRpm * 2),
    ...t,
    fuelSupply: fuelSupplyOf(partIds),
    torqueLimitNm: Math.round(internalsTorqueLimitOf(base, partIds, hw)),
  };
  car.nitrous = setup;
  const v = validateCar(car);
  if (!v.ok) return { ok: false, errors: v.errors };
  return { ...hw, car: deepFreeze(v.value!), key };
}
