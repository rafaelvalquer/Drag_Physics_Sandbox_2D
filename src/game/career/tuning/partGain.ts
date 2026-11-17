import type { CarConfig, TrackConfig } from '../../../data/schema';
import { runAccelerationTest } from '../../race/accelerationTest';
import { resolveBuild, type ResolverVersion } from './BuildResolver';
import { findPart, type PartDef } from './parts';

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
}

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

const measured = new Map<string, { et: number; t100: number }>();
function measure(key: string, car: CarConfig, track: TrackConfig): { et: number; t100: number } {
  const hit = measured.get(key);
  if (hit) return hit;
  const r = runAccelerationTest(car, track, { speedsKmh: [100], distancesM: [400], maxS: 40 });
  const m = { et: r.distanceTimes.get(400) ?? Infinity, t100: r.speedTimes.get(100) ?? Infinity };
  measured.set(key, m);
  return m;
}

/** Gain of `part` on `car`, or null when no supporting build accepts it (incompatible). */
export function measurePartGain(car: CarConfig, part: PartDef, track: TrackConfig, version: ResolverVersion): PartGain | null {
  for (const ctx0 of CONTEXTS) {
    const ctx = ctx0.filter((id) => findPart(id)?.category !== part.category);
    const withPart = build(car, [...ctx, part.id], version);
    if (!withPart) continue;
    // a turbo kit is compared with the same build without any turbo hardware
    const baseIds = part.category === 'turbo' ? ctx.filter((id) => !requiresTurbo(id) && findPart(id)?.category !== 'turbo') : ctx;
    const base = build(car, baseIds, version);
    if (!base) continue;
    const a = measure(base.key, base.car, track);
    const b = measure(withPart.key, withPart.car, track);
    return {
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
    };
  }
  return null;
}

/** Tolerances of the gain check (s, cv). NOT_WORSE_S is the run-to-run resolution of the test. */
export const GAIN_ET_S = 0.005;
export const NOT_WORSE_S = 0.01;
export const GAIN_CV = 0.3;
export const GAIN_CLUTCH_NM = 1;

/**
 * A part gains when it makes the car quicker over 402 m, or when it raises one of the car's
 * performance figures (power, clutch capacity) without costing time.
 */
export function isGain(g: PartGain): boolean {
  const dEt = g.etAfter - g.etBefore;
  if (dEt <= -GAIN_ET_S) return true;
  if (dEt > NOT_WORSE_S) return false;
  return g.cvAfter - g.cvBefore >= GAIN_CV || g.clutchAfterNm - g.clutchBeforeNm >= GAIN_CLUTCH_NM;
}
