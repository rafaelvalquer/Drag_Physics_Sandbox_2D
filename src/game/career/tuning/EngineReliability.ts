import type { CarConfig } from '../../../data/schema';
import { LIMITER_SAG_RPM, type OverrevSpec } from '../../../physics/engine/EngineOverrevFailure';
import { findPart } from './parts';

/**
 * Engine reliability of a build: three speeds that are kept apart on purpose.
 *  - revLimitRpm: where the ignition cut is (factory, or set on a programmable ECU);
 *  - recommendedSafeRpm: the highest speed the engine runs for good; exposure starts above it.
 *    The factory cut always sits under it (with a margin for the limiter overshoot), so a factory
 *    engine on its factory cut never breaks;
 *  - maxSafeRpm: the mechanical limit of the hardware (EngineSchema.maxSafeRpm). The cut can be set
 *    up to it, never above; only hardware (valve springs, forged internals) raises it.
 *
 * The family data below are ESTIMATES (marked `estimated: true`): no manufacturer publishes a
 * failure speed. They come from the factory figures already in the car data (cut, mechanical
 * limit), the mean piston speed at the factory cut (2·stroke·rpm/60; street engines live under
 * ≈ 20 m/s, short-stroke and forged-crank designs tolerate more) and the reputation of each design
 * (documented per family in docs/ENGINE_LIMITS.md). They are tuned for gameplay with the headless
 * calibration in scripts/overrev-calibration.ts.
 */
export interface EngineFamilyReliability {
  label: string;
  /** Seconds at the mechanical limit, full load, before the engine breaks (factory hardware). */
  enduranceS: number;
  /** How the number was obtained. */
  source: string;
  estimated: boolean;
}

/**
 * Margin of the safe speed over the factory cut. The failure model reads the filtered speed
 * (EngineOverrevFailure, τ 250 ms), which on the factory limiter sits 12–130 rpm under the cut
 * (measured on seven engines), so the factory cut stays safe with this margin.
 */
export const LIMITER_MARGIN_RPM = 50;
/** Exposure recovered per second once the engine rested 0.5 s under the safe speed. */
export const RECOVERY_PER_S = 0.05;

const EST = 'Estimativa: velocidade média do pistão no corte de fábrica e fama do projeto.';

/** Keys: engine family (modern engines) or the engine id prefix (Chapter 1 / sandbox engines). */
export const ENGINE_RELIABILITY: Record<string, EngineFamilyReliability> = {
  'vw-ap': { label: 'VW AP 1.8 (curso longo 86,4 mm)', enduranceS: 2.2, source: `${EST} 18,7 m/s a 6.500 rpm; bielas longas de ferro fundido.`, estimated: true },
  'fiat-fiasa': { label: 'Fiat Fiasa 1.0 (curso curto 54,8 mm)', enduranceS: 2.8, source: `${EST} 12,2 m/s a 6.700 rpm: curso curto tolera giro.`, estimated: true },
  'gm-chevette': { label: 'GM Chevette 1.6', enduranceS: 2.4, source: `${EST} 15,9 m/s a 6.300 rpm; comando no cabeçote com correia.`, estimated: true },
  'gm-familia1': { label: 'GM Família I', enduranceS: 2.8, source: `${EST} 14–15 m/s no corte; 8V de comando simples.`, estimated: true },
  'gm-familia2': { label: 'GM Família II', enduranceS: 2.4, source: `${EST} 17–18 m/s no corte; bloco de ferro robusto, 8V.`, estimated: true },
  'honda-k20': { label: 'Honda K20 i-VTEC', enduranceS: 1.8, source: `${EST} 23,8 m/s a 8.300 rpm com virabrequim forjado de fábrica.`, estimated: true },
  'psa-prince-thp': { label: 'PSA/BMW Prince 1.6 THP', enduranceS: 2.5, source: `${EST} corrente de comando e pistões sensíveis a giro alto com pressão.`, estimated: true },
  'vw-ea113': { label: 'VW EA113 1.8T 20V', enduranceS: 3.1, source: `${EST} bielas forjadas de fábrica; curso de 86,4 mm.`, estimated: true },
  'mb-m274': { label: 'Mercedes M274 2.0', enduranceS: 2.9, source: `${EST} curso longo de 92 mm.`, estimated: true },
  'bmw-n20': { label: 'BMW N20 2.0', enduranceS: 2.9, source: `${EST} curso de 90,1 mm; corrente de comando traseira.`, estimated: true },
  'vw-ea888': { label: 'VW EA888 2.0 TSI', enduranceS: 2.9, source: `${EST} curso longo de 92,8 mm.`, estimated: true },
  'mitsubishi-4b11': { label: 'Mitsubishi 4B11T', enduranceS: 3.4, source: `${EST} bloco de alumínio com internos de competição de fábrica (Evo).`, estimated: true },
  'bmw-n55': { label: 'BMW N55 3.0', enduranceS: 3.3, source: `${EST} seis em linha balanceado; curso de 89,6 mm.`, estimated: true },
  default: { label: 'Motor genérico', enduranceS: 3, source: `${EST} valor médio para motores sem dados próprios (Sandbox).`, estimated: true },
};

const ID_PREFIXES: [RegExp, string][] = [
  [/^vw-ap/, 'vw-ap'],
  [/^fiat-fiasa/, 'fiat-fiasa'],
  [/^gm-chevette/, 'gm-chevette'],
  [/^gm-familia1/, 'gm-familia1'],
  [/^gm-familia2/, 'gm-familia2'],
];

export function reliabilityKeyOf(car: CarConfig): string {
  const fam = car.engine.family;
  if (fam && ENGINE_RELIABILITY[fam]) return fam;
  for (const [re, k] of ID_PREFIXES) if (re.test(car.engine.id)) return k;
  return 'default';
}

/** Hardware that raises the safe speeds: valve springs and the existing forged internals. */
const HARDWARE: Record<string, { safeRpmAdd: number; enduranceScale: number }> = {
  'rods-reinforced': { safeRpmAdd: 150, enduranceScale: 1.25 },
  'pistons-forged': { safeRpmAdd: 200, enduranceScale: 1.3 },
  'forged-kit': { safeRpmAdd: 400, enduranceScale: 1.6 },
  'pistons-forged-modern': { safeRpmAdd: 300, enduranceScale: 1.5 },
};

export interface ReliabilityLimits extends OverrevSpec {
  key: string;
  label: string;
  /** Cut of the hardware build (factory, or moved by cams/ECU maps), before any Dyno Lab setting. */
  hardwareRevLimitRpm: number;
  source: string;
  estimated: boolean;
}

/**
 * Limits of a build. `hw` is the resolved hardware car (no rev-limit setting): its cut is safe by
 * definition (the factory or the part maker calibrated it), its maxSafeRpm is the schema limit.
 */
export function reliabilityLimits(hw: CarConfig, partIds: readonly string[]): ReliabilityLimits {
  const key = reliabilityKeyOf(hw);
  const fam = ENGINE_RELIABILITY[key]!;
  let add = 0;
  let endurance = fam.enduranceS;
  for (const id of partIds) {
    const p = findPart(id);
    if (p && 'safeRpmAdd' in p) add += p.safeRpmAdd;
    const h = HARDWARE[id];
    if (h) {
      add += h.safeRpmAdd;
      endurance *= h.enduranceScale;
    }
  }
  const cut = hw.engine.revLimitRpm;
  const recommended = cut + LIMITER_MARGIN_RPM + add;
  const maxSafe = Math.max(hw.engine.maxSafeRpm + add, recommended + LIMITER_SAG_RPM + 150);
  return {
    key,
    label: fam.label,
    hardwareRevLimitRpm: cut,
    recommendedSafeRpm: recommended,
    maxSafeRpm: Math.min(13000, maxSafe),
    enduranceS: Math.round(endurance * 100) / 100,
    recoveryPerS: RECOVERY_PER_S,
    source: fam.source,
    estimated: fam.estimated,
  };
}

/** Plain physics spec of the limits (for VehicleSimulation.enableEngineFailure). */
export function overrevSpecOf(l: ReliabilityLimits): OverrevSpec {
  return { recommendedSafeRpm: l.recommendedSafeRpm, maxSafeRpm: l.maxSafeRpm, enduranceS: l.enduranceS, recoveryPerS: l.recoveryPerS };
}

export type ReliabilityLevel = 'safe' | 'sport' | 'aggressive' | 'critical';
export const RELIABILITY_LABEL: Record<ReliabilityLevel, string> = { safe: 'Seguro', sport: 'Esportivo', aggressive: 'Agressivo', critical: 'Crítico' };

/** Band of a cut setting: under the recommended speed (safe) up to the mechanical limit (critical). */
export function reliabilityLevel(l: Pick<OverrevSpec, 'recommendedSafeRpm' | 'maxSafeRpm'>, revLimitRpm: number, boostOverDefaultBar = 0): ReliabilityLevel {
  // the engine held on the cut runs (filtered) LIMITER_SAG_RPM under it; x = 1 on a cut at the mechanical limit
  const reach = revLimitRpm - LIMITER_SAG_RPM;
  const x = (reach - l.recommendedSafeRpm) / Math.max(100, l.maxSafeRpm - LIMITER_SAG_RPM - l.recommendedSafeRpm);
  let lvl: ReliabilityLevel = x <= 0 ? 'safe' : x <= 0.35 ? 'sport' : x <= 0.75 ? 'aggressive' : 'critical';
  // more boost loads the parts that over-rev harder (see EngineOverrevFailure): one band up
  if (boostOverDefaultBar > 0.15 && x > 0) lvl = lvl === 'sport' ? 'aggressive' : lvl === 'aggressive' ? 'critical' : lvl;
  else if (boostOverDefaultBar > 0.15 && lvl === 'safe') lvl = 'sport';
  return lvl;
}
