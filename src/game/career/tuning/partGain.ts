import type { CarConfig, TrackConfig } from '../../../data/schema';
import { runAccelerationTest } from '../../race/accelerationTest';
import { RACE_DISTANCES } from '../../race/RaceController';
import { resolveBuild, type ResolverVersion } from './BuildResolver';
import { incompatibility } from './BuildResolverV2';
import { findPart, type PartDef } from './parts';
import { reliabilityLimits } from './EngineReliability';

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
  etBefore: number;
  etAfter: number;
  t100Before: number;
  t100After: number;
  clutchBeforeNm: number;
  clutchAfterNm: number;
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
    let a: ReturnType<typeof measure>;
    let b: ReturnType<typeof measure>;
    try {
      a = measure(base.key, base.car, track);
      b = measure(withPart.key, withPart.car, track);
    } catch (error) {
      return { status: 'simulation-failed', reasons: [String(error)] };
    }
    if (!Number.isFinite(a.et) || !Number.isFinite(b.et)) {
      return { status: 'simulation-failed', reasons: ['Uma das provas não completou a distância de referência.'] };
    }
    const gain: PartGain = {
      partId: part.id,
      carId: car.id,
      context: baseIds,
      cvBefore: base.peakPowerCv,
      cvAfter: withPart.peakPowerCv,
      etBefore: a.et,
      etAfter: b.et,
      t100Before: a.t100,
      t100After: b.t100,
      clutchBeforeNm: base.car.transmission.clutch.maxTorqueNm,
      clutchAfterNm: withPart.car.transmission.clutch.maxTorqueNm,
      safeRpmBefore: reliabilityLimits(base.car, baseIds).recommendedSafeRpm,
      safeRpmAfter: reliabilityLimits(base.car, [...ctx, part.id]).recommendedSafeRpm,
      launchRpmBefore: base.car.transmission.clutch.launchRpm,
      launchRpmAfter: withPart.car.transmission.clutch.launchRpm,
    };
    const effect = physicsSignature(base.car) !== physicsSignature(withPart.car) || gain.safeRpmBefore !== gain.safeRpmAfter;
    return { status: !effect ? 'no-effect' : isGain(gain) ? 'gain' : 'no-gain', gain };
  }
  const reasons = [...errors];
  // Existing resolvers expose human-readable validation errors rather than structured codes.
  const missingSupport = /exige|instale|insuficiente/;
  return {
    status: reasons.length > 0 && reasons.every((reason) => missingSupport.test(reason)) ? 'dependency-blocked' : 'invalid-build',
    reasons: reasons.length ? reasons : ['Nenhum contexto de referência produziu um build válido.'],
  };
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
