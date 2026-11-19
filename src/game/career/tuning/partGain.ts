import type { CarConfig, TrackConfig } from '../../../data/schema';
import { runAccelerationTest } from '../../race/accelerationTest';
import { RACE_DISTANCES } from '../../race/RaceController';
import { resolveBuild, type BuildResult, type ResolverVersion } from './BuildResolver';
import { incompatibility } from './BuildResolverV2';
import { findPart, type PartDef } from './parts';
import { reliabilityLimits } from './EngineReliability';
import { physicalSlotOf, progressionOf } from './partProgression';
import { isModernBreathingPart } from './modernBreathing';

/**
 * Workshop audit: the gain of one part on one car, measured with the real physics (factory-style
 * acceleration test with the AI driver) against the same car without it. Parts that only work on
 * top of others (a turbine needs a turbo kit) are measured on the smallest build that accepts them.
 */
export interface PartGain {
  partId: string;
  carId: string;
  /** Supporting parts installed in both builds. */
  context: string[];
  cvBefore: number;
  cvAfter: number;
  torqueBeforeNm: number;
  torqueAfterNm: number;
  redlineBeforeRpm: number;
  redlineAfterRpm: number;
  massBeforeKg: number;
  massAfterKg: number;
  intakeRestrictionBeforeKPa: number | null;
  intakeRestrictionAfterKPa: number | null;
  exhaustRestrictionBeforeKPa: number | null;
  exhaustRestrictionAfterKPa: number | null;
  throttleBeforeS: number;
  throttleAfterS: number;
  fuelCapacityBeforeKgS: number | null;
  fuelCapacityAfterKgS: number | null;
  etBefore: number;
  etAfter: number;
  t100Before: number;
  t100After: number;
  clutchBeforeNm: number;
  clutchAfterNm: number;
  couplingBeforeNm: number | null;
  couplingAfterNm: number | null;
  drivelineEfficiencyBefore: number;
  drivelineEfficiencyAfter: number;
  engineInertiaBeforeKgM2: number;
  engineInertiaAfterKgM2: number;
  /** Recommended safe engine speed (EngineReliability) before / after (rpm). */
  safeRpmBefore: number;
  safeRpmAfter: number;
  /** Launch speed of the clutch logic before / after (rpm). */
  launchRpmBefore: number;
  launchRpmAfter: number;
}

export const WORKSHOP_DISTANCE_M = RACE_DISTANCES.quarter.m;

export type PartAudit =
  | { status: 'incompatible' | 'dependency-blocked' | 'invalid-build' | 'simulation-failed'; reasons: string[] }
  | { status: 'no-effect' | 'no-gain' | 'gain'; gain: PartGain };

/** Smallest supporting builds tried in order until the part fits. */
const CONTEXTS: readonly string[][] = [
  [],
  ['clutch-reinforced'],
  ['turbo-basic', 'clutch-reinforced'],
  ['turbo-basic', 'clutch-reinforced', 'injectors'],
  ['turbo-medium', 'clutch-ceramic-race', 'injectors', 'rods-reinforced', 'compression-low'],
  ['turbo-strong', 'clutch-ceramic-race', 'fuel-pump', 'forged-kit', 'compression-low'],
  ['ecu-programmable'],
  ['ecu-programmable', 'dct-upgrade'],
  ['ecu-programmable', 'at-upgrade'],
  // Stage 2 map: on its own hardware (downpipe, intercooler), with forged internals and a gearbox upgrade
  ['downpipe-catless', 'intercooler-race'],
  ['downpipe-catless', 'intercooler-race', 'clutch-reinforced'],
  ['downpipe-catless', 'intercooler-race', 'dct-upgrade'],
  ['downpipe-catless', 'intercooler-race', 'at-upgrade'],
  ['downpipe-catless', 'intercooler-race', 'pistons-forged-modern', 'clutch-reinforced'],
  ['downpipe-catless', 'intercooler-race', 'pistons-forged-modern', 'dct-upgrade'],
  ['downpipe-catless', 'intercooler-race', 'pistons-forged-modern', 'at-upgrade'],
];

const requiresTurbo = (id: string): boolean => {
  const p = findPart(id);
  return !!p && 'requiresTurbo' in p && !!p.requiresTurbo;
};

/** Build of `ids` (null when the resolver refuses it). */
function build(car: CarConfig, ids: string[], version: ResolverVersion) {
  const r = resolveBuild(car, ids, {}, version);
  return r.ok ? r : null;
}

const measured = new WeakMap<TrackConfig, Map<string, { et: number; t100: number }>>();
function measure(key: string, car: CarConfig, track: TrackConfig): { et: number; t100: number } {
  const cache = measured.get(track) ?? new Map();
  measured.set(track, cache);
  const hit = cache.get(key);
  if (hit) return hit;
  const r = runAccelerationTest(car, track, { speedsKmh: [100], distancesM: [WORKSHOP_DISTANCE_M], maxS: 45, stopAtLastSplit: true });
  const m = { et: r.distanceTimes.get(WORKSHOP_DISTANCE_M) ?? Infinity, t100: r.speedTimes.get(100) ?? Infinity };
  cache.set(key, m);
  return m;
}

function physicsSignature(car: CarConfig): string {
  const { id, name, description, visual, ...physics } = car;
  return JSON.stringify(physics);
}

type ValidBuild = Extract<BuildResult, { ok: true }>;

function compareBuilds(base: ValidBuild, after: ValidBuild, part: PartDef, context: string[], track: TrackConfig): PartAudit {
  let a: ReturnType<typeof measure>;
  let b: ReturnType<typeof measure>;
  try {
    a = measure(base.key, base.car, track);
    b = measure(after.key, after.car, track);
  } catch (error) {
    return { status: 'simulation-failed', reasons: [String(error)] };
  }
  if (!Number.isFinite(a.et) || !Number.isFinite(b.et)) {
    return { status: 'simulation-failed', reasons: ['Uma das provas não completou a distância de referência.'] };
  }
  const gain: PartGain = {
    partId: part.id,
    carId: base.car.id,
    context,
    cvBefore: base.peakPowerCv,
    cvAfter: after.peakPowerCv,
    torqueBeforeNm: base.peakTorqueNm,
    torqueAfterNm: after.peakTorqueNm,
    redlineBeforeRpm: base.car.engine.revLimitRpm,
    redlineAfterRpm: after.car.engine.revLimitRpm,
    massBeforeKg: base.car.massKg,
    massAfterKg: after.car.massKg,
    intakeRestrictionBeforeKPa: base.car.engine.breathing?.airFilterDropKPa ?? null,
    intakeRestrictionAfterKPa: after.car.engine.breathing?.airFilterDropKPa ?? null,
    exhaustRestrictionBeforeKPa: base.exhaustRestrictionKPa ?? base.car.engine.breathing?.exhaustBackPressureKPa ?? null,
    exhaustRestrictionAfterKPa: after.exhaustRestrictionKPa ?? after.car.engine.breathing?.exhaustBackPressureKPa ?? null,
    throttleBeforeS: base.car.engine.throttle.responseTimeS,
    throttleAfterS: after.car.engine.throttle.responseTimeS,
    fuelCapacityBeforeKgS: base.car.engine.fueling?.maxFuelKgS ??
      ('fuelCapacityScale' in part && after.car.engine.fueling ? after.car.engine.fueling.maxFuelKgS / part.fuelCapacityScale : null),
    fuelCapacityAfterKgS: after.car.engine.fueling?.maxFuelKgS ?? null,
    etBefore: a.et,
    etAfter: b.et,
    t100Before: a.t100,
    t100After: b.t100,
    clutchBeforeNm: base.car.transmission.clutch.maxTorqueNm,
    clutchAfterNm: after.car.transmission.clutch.maxTorqueNm,
    couplingBeforeNm: base.car.awd?.centerCouplingNm ?? null,
    couplingAfterNm: after.car.awd?.centerCouplingNm ?? null,
    drivelineEfficiencyBefore: base.car.transmission.efficiency * (base.car.awd?.transferEfficiency ?? 1),
    drivelineEfficiencyAfter: after.car.transmission.efficiency * (after.car.awd?.transferEfficiency ?? 1),
    engineInertiaBeforeKgM2: base.car.engine.inertiaKgM2,
    engineInertiaAfterKgM2: after.car.engine.inertiaKgM2,
    safeRpmBefore: reliabilityLimits(base.car, base.parts.map((p) => p.id)).recommendedSafeRpm,
    safeRpmAfter: reliabilityLimits(after.car, after.parts.map((p) => p.id)).recommendedSafeRpm,
    launchRpmBefore: base.car.transmission.clutch.launchRpm,
    launchRpmAfter: after.car.transmission.clutch.launchRpm,
  };
  const effect = physicsSignature(base.car) !== physicsSignature(after.car) ||
    gain.safeRpmBefore !== gain.safeRpmAfter || gain.exhaustRestrictionBeforeKPa !== gain.exhaustRestrictionAfterKPa;
  const fuelGain = 'fuelCapacityScale' in part && gain.fuelCapacityBeforeKgS !== null && gain.fuelCapacityAfterKgS !== null &&
    gain.fuelCapacityAfterKgS - gain.fuelCapacityBeforeKgS >= 0.0001 && gain.etAfter - gain.etBefore <= 0.05;
  const improvement = isGain(gain) || (isModernBreathingPart(part) && breathingGain(part, gain)) || drivelineGain(part, gain) || fuelGain;
  return { status: !effect ? 'no-effect' : improvement ? 'gain' : 'no-gain', gain };
}

function drivelineGain(part: PartDef, gain: PartGain): boolean {
  if (!part.progression || part.since !== 2 || gain.etAfter - gain.etBefore > 0.05) return false;
  if (part.category === 'clutch' || part.category === 'gearbox') return gain.clutchAfterNm - gain.clutchBeforeNm >= GAIN_CLUTCH_NM;
  if (part.category === 'awd')
    return gain.couplingAfterNm !== null && gain.couplingBeforeNm !== null && gain.couplingAfterNm - gain.couplingBeforeNm >= 10;
  if (part.category === 'differential' || part.category === 'transmission-gearbox')
    return gain.drivelineEfficiencyAfter - gain.drivelineEfficiencyBefore >= 0.001;
  if (part.category === 'flywheel') return gain.engineInertiaBeforeKgM2 - gain.engineInertiaAfterKgM2 >= 0.001;
  return false;
}

function breathingGain(part: PartDef, gain: PartGain): boolean {
  // These street parts should not worsen the reference pass enough to outweigh the hardware gain.
  if (gain.etAfter - gain.etBefore > 0.05) return false;
  const reduction = (before: number | null, after: number | null): boolean =>
    before !== null && after !== null && before - after >= 0.1;
  if (part.category === 'intake-airbox') return reduction(gain.intakeRestrictionBeforeKPa, gain.intakeRestrictionAfterKPa);
  if (part.category === 'intake-throttle') return gain.throttleBeforeS - gain.throttleAfterS >= 0.001;
  return reduction(gain.exhaustRestrictionBeforeKPa, gain.exhaustRestrictionAfterKPa);
}

/** Classifies every attempted pairing, including failures to produce comparable runs. */
export function auditPartGain(car: CarConfig, part: PartDef, track: TrackConfig, version: ResolverVersion): PartAudit {
  const incompatible = incompatibility(car, part);
  if (incompatible) return { status: 'incompatible', reasons: [incompatible] };
  if (version === 1 && part.since === 2) return { status: 'incompatible', reasons: ['Peça requer resolver 2.'] };
  const errors = new Set<string>();
  for (const ctx0 of CONTEXTS) {
    const ctx = ctx0.filter((id) => findPart(id)?.category !== part.category);
    // a turbo kit is compared with the same build without any turbo hardware
    const baseIds = part.category === 'turbo' ? ctx.filter((id) => !requiresTurbo(id) && findPart(id)?.category !== 'turbo') : ctx;
    const base = build(car, baseIds, version);
    if (!base) continue;
    const withPart = resolveBuild(car, [...ctx, part.id], {}, version);
    if (!withPart.ok) {
      for (const error of withPart.errors) errors.add(error);
      continue;
    }
    return compareBuilds(base, withPart, part, baseIds, track);
  }
  const reasons = [...errors];
  // Existing resolvers expose human-readable validation errors rather than structured codes.
  const missingSupport = /exige|instale|insuficiente/;
  return {
    status: reasons.length > 0 && reasons.every((reason) => missingSupport.test(reason)) ? 'dependency-blocked' : 'invalid-build',
    reasons: reasons.length ? reasons : ['Nenhum contexto de referência produziu um build válido.'],
  };
}

export interface StageComparison {
  previous: string | null;
  next: string;
  audit: PartAudit;
}

/** Uses one support build for all comparisons in a progression group. */
export function auditPartStages(car: CarConfig, stages: readonly PartDef[], track: TrackConfig, version: ResolverVersion): StageComparison[] {
  const first = stages[0];
  if (!first) return [];
  const slot = physicalSlotOf(first);
  const specialization = progressionOf(first)?.specialization;
  const errors = new Set<string>();
  for (const candidate of CONTEXTS) {
    const context = candidate.filter((id) => {
      const support = findPart(id);
      return support && physicalSlotOf(support) !== slot;
    });
    const stock = resolveBuild(car, context, {}, version);
    if (!stock.ok) continue;
    if (specialization === 'turbo' && slot !== 'turbo' && stock.car.engine.induction !== 'turbo') continue;
    const builds: ValidBuild[] = [stock];
    for (const part of stages) {
      const result = resolveBuild(car, [...context, part.id], {}, version);
      if (result.ok) builds.push(result);
      else for (const error of result.errors) errors.add(error);
    }
    if (builds.length !== stages.length + 1) continue;
    return stages.map((part, index) => ({
      previous: stages[index - 1]?.id ?? null,
      next: part.id,
      audit: compareBuilds(builds[index]!, builds[index + 1]!, part, context, track),
    }));
  }
  return stages.map((part, index) => ({
    previous: stages[index - 1]?.id ?? null,
    next: part.id,
    audit: { status: 'invalid-build', reasons: ['Nenhum contexto de apoio foi aceito por toda a sequência.', ...errors] },
  }));
}

/** Tolerances of the gain check (s, cv). NOT_WORSE_S is the run-to-run resolution of the test. */
export const GAIN_ET_S = 0.005;
export const NOT_WORSE_S = 0.01;
export const GAIN_CV = 0.3;
export const GAIN_CLUTCH_NM = 1;
export const GAIN_SAFE_RPM = 100;
export const GAIN_LAUNCH_RPM = 100;

/**
 * A part gains when it makes the car quicker over 402 m, or when it raises one of the car's
 * performance figures (power, clutch capacity, safe engine speed, launch speed) without costing time.
 */
export function isGain(g: PartGain): boolean {
  const dEt = g.etAfter - g.etBefore;
  if (dEt <= -GAIN_ET_S) return true;
  if (dEt > NOT_WORSE_S) return false;
  return (
    g.cvAfter - g.cvBefore >= GAIN_CV ||
    g.clutchAfterNm - g.clutchBeforeNm >= GAIN_CLUTCH_NM ||
    g.safeRpmAfter - g.safeRpmBefore >= GAIN_SAFE_RPM ||
    g.launchRpmAfter - g.launchRpmBefore >= GAIN_LAUNCH_RPM
  );
}
