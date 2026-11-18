import type { CarConfig, TrackConfig } from '../../../data/schema';
import { runAccelerationTest } from '../../race/accelerationTest';
import { resolveBuild, type ResolverVersion } from './BuildResolver';
import { findPart, type PartDef } from './parts';
import { reliabilityLimits } from './EngineReliability';
import { presetsFor } from './ProjectRequirements';
import { fuelCapacity, BSFC_KG_KWH } from './FuelSystemModel';

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
  /** Seconds the engine lasts at its mechanical limit (EngineReliability) before / after. */
  enduranceBefore: number;
  enduranceAfter: number;
  /** Peak power the fuel supply sustains on a boosted engine (cv) before / after. */
  fuelSupportBeforeCv: number;
  fuelSupportAfterCv: number;
}

/** Peak power (cv) the fuel supply of `ids` sustains on `car` with a boosted mixture. */
function fuelSupportCv(car: CarConfig, ids: readonly string[]): number {
  const parts = ids.map(findPart);
  // the link a part does not touch is assumed generous, so each part is measured on its own link
  const open = { injectorScale: 3, pumpScale: 3, hpPumpScale: 3 } as never;
  const cap = fuelCapacity(car, {
    injectors: (parts.find((p) => p?.category === 'fuel-system') as never) ?? open,
    hpPump: (parts.find((p) => p?.category === 'fuel-hp-pump') as never) ?? open,
  });
  return (cap.capacityGs * 3.6) / BSFC_KG_KWH.boosted / 0.73549875;
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
/**
 * Chapter 3 supporting builds: the parts of each project preset of the car (and its prefixes), so a
 * part is measured inside the project it belongs to (a fuel system on top of the turbo kit it feeds).
 */
function chapter3Contexts(car: CarConfig, version: ResolverVersion): string[][] {
  if (version !== 2) return [];
  const out: string[][] = [];
  for (const p of presetsFor(car)) for (let n = p.parts.length; n >= 1; n--) out.push(p.parts.slice(0, n));
  return out;
}

export function measurePartGain(car: CarConfig, part: PartDef, track: TrackConfig, version: ResolverVersion): PartGain | null {
  // Chapter 3 hardware is measured inside the project it belongs to: the first supporting build that
  // shows a gain counts (a lubrication system only gains where the oil demand outgrew the factory one)
  const everyContext = part.chapter === 3;
  let first: PartGain | null = null;
  for (const ctx0 of [...CONTEXTS, ...chapter3Contexts(car, version)]) {
    const ctx = ctx0.filter((id) => findPart(id)?.category !== part.category);
    const withPart = build(car, [...ctx, part.id], version);
    if (!withPart) continue;
    // a turbo kit is compared with the same build without any turbo hardware
    const baseIds = part.category === 'turbo' ? ctx.filter((id) => !requiresTurbo(id) && findPart(id)?.category !== 'turbo') : ctx;
    const base = build(car, baseIds, version);
    if (!base) continue;
    const a = measure(base.key, base.car, track);
    const b = measure(withPart.key, withPart.car, track);
    const g: PartGain = {
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
      enduranceBefore: reliabilityLimits(base.car, baseIds).enduranceS,
      enduranceAfter: reliabilityLimits(base.car, [...ctx, part.id]).enduranceS,
      fuelSupportBeforeCv: fuelSupportCv(car, baseIds),
      fuelSupportAfterCv: fuelSupportCv(car, [...ctx, part.id]),
    };
    if (!everyContext) return g;
    first ??= g;
    if (isGain(g)) return g;
  }
  return first;
}

/** Tolerances of the gain check (s, cv). NOT_WORSE_S is the run-to-run resolution of the test. */
export const GAIN_ET_S = 0.005;
export const NOT_WORSE_S = 0.01;
export const GAIN_CV = 0.3;
export const GAIN_CLUTCH_NM = 1;
export const GAIN_SAFE_RPM = 100;
export const GAIN_LAUNCH_RPM = 100;
export const GAIN_ENDURANCE_S = 0.1;
export const GAIN_FUEL_CV = 5;
/**
 * Parts whose benefit the straight-line test cannot show, with the reason (printed by the report).
 * forged-v6-turbo: lowers compression (slower as a bolt-on); it exists to take boost and lasts longer.
 * boost-by-gear: trades low-gear boost for traction; the test track shows the lost torque, not the spin avoided.
 */
export const GAIN_EXEMPT: Readonly<Record<string, string>> = {
  'forged-v6-turbo': 'peça de durabilidade: baixa a compressão para aceitar pressão; vida no limite +50 %',
  'boost-by-gear': 'troca pressão nas marchas baixas por tração; a pista de testes não mede a patinação evitada',
};

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
    g.launchRpmAfter - g.launchRpmBefore >= GAIN_LAUNCH_RPM ||
    g.enduranceAfter - g.enduranceBefore >= GAIN_ENDURANCE_S ||
    g.fuelSupportAfterCv - g.fuelSupportBeforeCv >= GAIN_FUEL_CV
  );
}
