import { validateCar, type CarConfig } from '../../../data/schema';
import { boostRangeForParts, resolveHardware, type ResolverVersion } from './BuildResolver';
import { curvePeakCv } from './breathingModel';
import {
  deepFreeze,
  FINAL_DRIVE_PRESETS,
  NOMINAL_TIRE_KPA,
  THROTTLE_PRESETS,
  TUNE_FIELDS,
  type BuildResult,
  type BuildTune,
  type FinalDrivePreset,
  type ThrottlePreset,
  type TuneField,
} from './buildCommon';
import { overrevSpecOf, reliabilityLimits, reliabilityLevel, type ReliabilityLevel, type ReliabilityLimits } from './EngineReliability';
import type { OverrevSpec } from '../../../physics/engine/EngineOverrevFailure';
import { findPart, type BoostControlPart, type EcuPart, type PartDef } from './parts';
import { wastegateMaxBar } from './factoryTurboModel';

/**
 * Dyno Lab capabilities: which settings a build can take, from the parts really installed.
 *  - boost: a turbo AND something that controls it (classic kit + the tuners' wastegate actuator,
 *    factory turbo + programmable ECU). A naturally aspirated engine: "Exige kit turbo compatível.";
 *  - rev limit: a programmable ECU (or the NA remap that moves the cut), never above the
 *    mechanical limit of the hardware (EngineReliability);
 *  - launch speed: launch control or a reinforced clutch (manual), launch control or the DSG/SST
 *    upgrade (twin clutch). Not on torque-converter automatics (the launch is the converter stall);
 *  - throttle response: electronic throttle remapped by an ECU (modern) / reworked throttle (classic);
 *  - final drive: a prepared differential (discrete crown-and-pinion presets);
 *  - shift speed: automatics / twin clutch with the gearbox upgrade (reprogrammed TCU);
 *  - tyre pressure: performance tyres or the pressure kit.
 * The resolver validates every setting again (applyTuneOverlay): the UI is never the only check.
 */

export interface TuneContext {
  /** Chapter 1 tuners (engine-tuners unlock): they set the boost of a classic turbo kit. */
  tunersUnlocked?: boolean;
}

export interface RangeControl {
  enabled: boolean;
  /** Why the control is locked (pt-BR), null when enabled. */
  reason: string | null;
  min: number;
  max: number;
  step: number;
  /** Value of the hardware without the setting. */
  default: number;
}

export interface PresetControl<T extends string> {
  enabled: boolean;
  reason: string | null;
  options: readonly { value: T; label: string }[];
  default: T;
}

export interface TuningCapabilities {
  boost: RangeControl;
  revLimit: RangeControl;
  launch: RangeControl;
  throttle: PresetControl<ThrottlePreset>;
  finalDrive: PresetControl<FinalDrivePreset>;
  shift: RangeControl;
  tirePressure: RangeControl;
  /** Reliability limits of the hardware (null when the hardware build is invalid). */
  limits: ReliabilityLimits | null;
}

export const TUNE_LABEL: Record<TuneField, string> = {
  boostBar: 'Pressão do turbo',
  revLimitRpm: 'Corte de giro',
  launchRpm: 'Rotação de largada',
  throttleResponse: 'Resposta do acelerador',
  finalDrive: 'Relação final',
  shiftRpm: 'Ponto de troca',
  tirePressureKpa: 'Pressão dos pneus',
};

export const THROTTLE_OPTIONS: readonly { value: ThrottlePreset; label: string }[] = [
  { value: 'soft', label: 'Suave' },
  { value: 'standard', label: 'Padrão' },
  { value: 'sharp', label: 'Agressiva' },
];
export const FINAL_DRIVE_OPTIONS: readonly { value: FinalDrivePreset; label: string }[] = [
  { value: 'short', label: 'Curta (+6 %)' },
  { value: 'standard', label: 'Padrão' },
  { value: 'long', label: 'Longa (−5 %)' },
];

/** ECUs that move the ignition cut (programmable, or the NA remap). */
const REV_ECUS = new Set(['ecu-programmable', 'ecu-stage1-na', 'ecu-street', 'ecu-race']);
const CLASSIC_THROTTLES = new Set(['throttle-rework', 'throttle-large']);
const GEARBOX_TCU = new Set(['dct-upgrade', 'at-upgrade']);
/** Parts whose effect is applied by the overlay (no resolver knows them). */
export const OVERLAY_PARTS = new Set(['valve-springs', 'launch-control']);

const off = (reason: string, def = 0): RangeControl => ({ enabled: false, reason, min: def, max: def, step: 1, default: def });
const round = (v: number, step: number): number => Math.round(v / step) * step;

export function tuningCapabilities(base: CarConfig, partIds: readonly string[], version: ResolverVersion, ctx: TuneContext = {}): TuningCapabilities {
  const hwR = resolveHardware(base, partIds, {}, version);
  const tOff = { enabled: false, reason: 'build inválido', options: THROTTLE_OPTIONS, default: 'standard' as const };
  if (!hwR.ok)
    return {
      boost: off('build inválido'),
      revLimit: off('build inválido'),
      launch: off('build inválido'),
      throttle: tOff,
      finalDrive: { enabled: false, reason: 'build inválido', options: FINAL_DRIVE_OPTIONS, default: 'standard' },
      shift: off('build inválido'),
      tirePressure: off('build inválido', NOMINAL_TIRE_KPA),
      limits: null,
    };
  const hw = withOverlayParts(hwR.car, partIds);
  const parts = partIds.map(findPart).filter((p): p is PartDef => !!p);
  const has = (pred: (p: PartDef) => boolean): boolean => parts.some(pred);
  const modern = !!base.engine.family;
  const kind = base.transmission.kind ?? 'manual';
  const limits = reliabilityLimits(hwR.car, partIds);
  const e = hw.engine;

  // ---- boost ----
  let boost: RangeControl;
  const programmable = parts.find((p) => p.id === 'ecu-programmable') as EcuPart | undefined;
  const factoryBoost = base.engine.induction === 'turbo' ? base.engine.turbo?.maxBoostBar : undefined;
  const classicRange = boostRangeForParts(partIds.filter((id) => (findPart(id)?.since ?? 1) === 1));
  if (factoryBoost !== undefined && modern) {
    if (!programmable) boost = off('Exige ECU programável.', factoryBoost);
    else {
      const [lo, hi] = programmable.boostRangeAddBar ?? [0.1, 0.8];
      const def = hwR.steadyBoostBar.length ? Math.max(...hwR.steadyBoostBar.map((x) => x.bar), factoryBoost) : factoryBoost;
      // the wastegate (factory actuator, or the boost-control kit) caps what the ECU can ask for
      const wg = wastegateMaxBar(base.engine, parts.find((p) => p.category === 'boost-control') as BoostControlPart | undefined, programmable);
      const max = Math.floor(Math.min(factoryBoost + hi, wg) * 100 + 1e-6) / 100;
      boost = { enabled: true, reason: null, min: round(factoryBoost + lo, 0.01), max, step: 0.05, default: Math.min(max, round(def, 0.01)) };
    }
  } else if (classicRange) {
    const def = e.turbo?.maxBoostBar ?? 0.6;
    boost =
      ctx.tunersUnlocked === false
        ? off('Os preparadores de motor ainda não trabalham para você.', def)
        : { enabled: true, reason: null, min: classicRange[0], max: classicRange[1], step: 0.05, default: round(def, 0.01) };
  } else if (base.engine.induction === 'turbo') boost = off('Exige controle de pressão compatível.', factoryBoost ?? 0);
  else boost = off('Exige kit turbo compatível.');

  // ---- rev limit ----
  const revLimit: RangeControl = has((p) => REV_ECUS.has(p.id))
    ? { enabled: true, reason: null, min: round(Math.max(e.idleRpm * 3, e.revLimitRpm - 600), 50), max: Math.floor(limits.maxSafeRpm / 50) * 50, step: 50, default: e.revLimitRpm }
    : off('Exige ECU programável.', e.revLimitRpm);

  // ---- launch ----
  const launchDef = hw.transmission.clutch.launchRpm;
  const launchOk =
    kind === 'manual'
      ? has((p) => p.category === 'clutch' || p.id === 'launch-control')
      : kind === 'dual-clutch'
        ? has((p) => p.id === 'launch-control' || p.id === 'dct-upgrade')
        : false;
  const launch: RangeControl =
    kind === 'torque-converter-auto'
      ? off('No automático com conversor de torque, a largada é o estol do conversor.', launchDef)
      : launchOk
        ? { enabled: true, reason: null, min: round(e.idleRpm + 800, 100), max: round(Math.min(e.redlineRpm - 800, launchDef + 2500), 100), step: 100, default: launchDef }
        : off(kind === 'manual' ? 'Exige controle de largada ou embreagem reforçada.' : 'Exige controle de largada ou upgrade do câmbio.', launchDef);

  // ---- throttle ----
  const throttleOk = modern ? has((p) => p.category === 'ecu') : has((p) => CLASSIC_THROTTLES.has(p.id));
  const throttle: PresetControl<ThrottlePreset> = {
    enabled: throttleOk,
    reason: throttleOk ? null : modern ? 'Exige remapeamento da ECU (acelerador eletrônico).' : 'Exige borboleta retrabalhada (came progressiva).',
    options: THROTTLE_OPTIONS,
    default: 'standard',
  };

  // ---- final drive ----
  const diffOk = has((p) => p.category === 'differential');
  const finalDrive: PresetControl<FinalDrivePreset> = {
    enabled: diffOk,
    reason: diffOk ? null : 'Exige diferencial preparado (relação final).',
    options: FINAL_DRIVE_OPTIONS,
    default: 'standard',
  };

  // ---- shift speed (automatic schedule) ----
  const auto = hw.transmission.autoShift;
  const shiftDef = auto ? round(auto.wotUpshiftFraction * e.revLimitRpm, 50) : e.revLimitRpm;
  const shift: RangeControl =
    kind === 'manual' || !auto
      ? off('Câmbio manual: o ponto de troca é do piloto.', shiftDef)
      : has((p) => GEARBOX_TCU.has(p.id))
        ? { enabled: true, reason: null, min: round(e.revLimitRpm * 0.75, 50), max: Math.max(...[revLimit.max, e.revLimitRpm]) - 50, step: 50, default: shiftDef }
        : off('Exige upgrade do câmbio (TCU reprogramada).', shiftDef);

  // ---- tyre pressure ----
  const tyreOk = has((p) => p.category === 'tires' || p.category === 'tires-pressure');
  const tirePressure: RangeControl = tyreOk
    ? { enabled: true, reason: null, min: 140, max: 260, step: 5, default: NOMINAL_TIRE_KPA }
    : off('Exige pneus de competição ou kit de pressão.', NOMINAL_TIRE_KPA);

  return { boost, revLimit, launch, throttle, finalDrive, shift, tirePressure, limits };
}

/** Errors of a tune on a build (pt-BR); [] when every setting is allowed and in range. */
export function validateTune(base: CarConfig, partIds: readonly string[], version: ResolverVersion, tune: BuildTune, ctx: TuneContext = {}): string[] {
  const c = tuningCapabilities(base, partIds, version, ctx);
  const errs: string[] = [];
  const range = (f: TuneField, ctl: RangeControl, v: number | undefined, fmt: (x: number) => string): void => {
    if (v === undefined) return;
    if (!ctl.enabled) errs.push(`${TUNE_LABEL[f]}: ${ctl.reason}`);
    else if (!Number.isFinite(v) || v < ctl.min - 1e-6 || v > ctl.max + 1e-6) errs.push(`${TUNE_LABEL[f]} fora da faixa (${fmt(ctl.min)} a ${fmt(ctl.max)})`);
  };
  const rpm = (x: number): string => `${Math.round(x).toLocaleString('pt-BR')} rpm`;
  range('boostBar', c.boost, tune.boostBar, (x) => `${x.toFixed(2).replace('.', ',')} bar`);
  range('revLimitRpm', c.revLimit, tune.revLimitRpm, rpm);
  range('launchRpm', c.launch, tune.launchRpm, rpm);
  range('shiftRpm', c.shift, tune.shiftRpm, rpm);
  range('tirePressureKpa', c.tirePressure, tune.tirePressureKpa, (x) => `${Math.round(x)} kPa`);
  if (tune.throttleResponse !== undefined) {
    if (!c.throttle.enabled) errs.push(`${TUNE_LABEL.throttleResponse}: ${c.throttle.reason}`);
    else if (!(tune.throttleResponse in THROTTLE_PRESETS)) errs.push('resposta do acelerador desconhecida');
  }
  if (tune.finalDrive !== undefined) {
    if (!c.finalDrive.enabled) errs.push(`${TUNE_LABEL.finalDrive}: ${c.finalDrive.reason}`);
    else if (!(tune.finalDrive in FINAL_DRIVE_PRESETS)) errs.push('relação final desconhecida');
  }
  // the launch speed must stay under the cut that is set
  const cut = tune.revLimitRpm ?? c.revLimit.default;
  if (tune.launchRpm !== undefined && tune.launchRpm > cut - 800) errs.push('a rotação de largada precisa ficar 800 rpm abaixo do corte');
  if (tune.shiftRpm !== undefined && tune.shiftRpm > cut - 50) errs.push('o ponto de troca precisa ficar abaixo do corte');
  return errs;
}

/**
 * Settings that survive a hardware change: each field is kept only while the new parts still
 * allow it and its value is in the new range. The dropped ones are reported (never removed silently).
 */
export function reconcileTune(
  base: CarConfig,
  partIds: readonly string[],
  version: ResolverVersion,
  tune: BuildTune,
  ctx: TuneContext = {},
): { tune: BuildTune; dropped: TuneField[] } {
  const kept: BuildTune = {};
  const dropped: TuneField[] = [];
  for (const f of TUNE_FIELDS) {
    const v = tune[f];
    if (v === undefined) continue;
    const trial = { ...kept, [f]: v } as BuildTune;
    if (validateTune(base, partIds, version, trial, ctx).length) dropped.push(f);
    else (kept as Record<string, unknown>)[f] = v;
  }
  return { tune: kept, dropped };
}

/** pt-BR notice of dropped settings, null when nothing was dropped. */
export function droppedNotice(dropped: readonly TuneField[]): string | null {
  if (!dropped.length) return null;
  return `Ajustes do Dyno Lab que a nova configuração não aceita voltaram ao padrão: ${dropped.map((f) => TUNE_LABEL[f].toLowerCase()).join(', ')}.`;
}

/** Hardware of the Dyno Lab parts that no resolver knows (valve springs, launch control). */
function withOverlayParts(hw: CarConfig, partIds: readonly string[]): CarConfig {
  if (!partIds.some((id) => OVERLAY_PARTS.has(id))) return hw;
  const car = structuredClone(hw);
  const limits = reliabilityLimits(hw, partIds);
  if (partIds.includes('valve-springs')) car.engine.maxSafeRpm = Math.max(car.engine.maxSafeRpm, limits.maxSafeRpm);
  const lc = findPart('launch-control');
  if (partIds.includes('launch-control') && lc && 'launchRpmAdd' in lc)
    car.transmission.clutch.launchRpm = Math.min(car.transmission.clutch.launchRpm + (lc.launchRpmAdd ?? 0), car.engine.redlineRpm - 800);
  return car;
}

/** Torque curve that covers `rpm`: past its last point the engine is beyond its breathing peak. */
function extendCurve(car: CarConfig, rpm: number): void {
  const c = car.engine.torqueCurve;
  const last = c.rpm[c.rpm.length - 1]!;
  if (last >= rpm) return;
  const tLast = c.torqueNm[c.torqueNm.length - 1]!;
  const rpms = [...c.rpm];
  const tq = [...c.torqueNm];
  for (let r = last + 250; ; r += 250) {
    const x = Math.min(r, rpm + 250);
    rpms.push(x);
    tq.push(Math.round(tLast * Math.pow(last / x, 2.5) * 10) / 10);
    if (x >= rpm || rpms.length >= 64) break;
  }
  car.engine.torqueCurve = { rpm: rpms, torqueNm: tq };
}

/** Does this tune / part list need the overlay on top of the resolver result? */
export function needsOverlay(tune: BuildTune, partIds: readonly string[]): boolean {
  return TUNE_FIELDS.some((f) => f !== 'boostBar' && tune[f] !== undefined) || partIds.some((id) => OVERLAY_PARTS.has(id));
}

/**
 * Applies the Dyno Lab settings (and the overlay parts) on a resolved hardware build. Validated
 * here again (any caller, any UI): an invalid setting rejects the build with a message.
 */
export function applyTuneOverlay(base: CarConfig, partIds: readonly string[], version: ResolverVersion, hw: Extract<BuildResult, { ok: true }>, tune: BuildTune, key: string): BuildResult {
  const errors = validateTune(base, partIds, version, tune);
  if (errors.length) return { ok: false, errors };
  const car = structuredClone(withOverlayParts(hw.car, partIds)) as CarConfig;
  const e = car.engine;
  if (tune.revLimitRpm !== undefined) {
    const cut = tune.revLimitRpm;
    const d = cut - e.revLimitRpm;
    extendCurve(car, cut);
    e.revLimitRpm = cut;
    e.redlineRpm = d >= 0 ? Math.min(cut, e.redlineRpm + d) : Math.min(e.redlineRpm, cut);
    car.transmission.clutch.launchRpm = Math.min(car.transmission.clutch.launchRpm, cut - 800);
  }
  if (tune.launchRpm !== undefined) car.transmission.clutch.launchRpm = tune.launchRpm;
  if (tune.throttleResponse !== undefined) {
    const p = THROTTLE_PRESETS[tune.throttleResponse];
    e.throttle = {
      ...e.throttle,
      responseTimeS: Math.min(0.5, Math.max(0.005, e.throttle.responseTimeS * p.responseScale)),
      pedalGamma: Math.min(4, Math.max(0.5, e.throttle.pedalGamma * p.gammaScale)),
    };
  }
  if (tune.finalDrive !== undefined)
    car.transmission.finalDrive = Math.min(6.5, Math.max(1.5, Math.round(car.transmission.finalDrive * FINAL_DRIVE_PRESETS[tune.finalDrive] * 1000) / 1000));
  if (tune.shiftRpm !== undefined && car.transmission.autoShift)
    car.transmission.autoShift = { ...car.transmission.autoShift, wotUpshiftFraction: Math.min(1, Math.max(0.6, tune.shiftRpm / e.revLimitRpm)) };
  else if (car.transmission.autoShift && tune.revLimitRpm !== undefined) {
    // the schedule is a fraction of the cut: keep the factory shift speed when only the cut moves
    const rpm = hw.car.transmission.autoShift!.wotUpshiftFraction * hw.car.engine.revLimitRpm;
    car.transmission.autoShift = { ...car.transmission.autoShift, wotUpshiftFraction: Math.min(1, Math.max(0.6, rpm / e.revLimitRpm)) };
  }
  if (tune.tirePressureKpa !== undefined) {
    // pressure ratio r = p/p0: rolling resistance ∝ r^-0.4, contact-patch grip ∝ r^-0.08,
    // longitudinal slip stiffness ∝ r^0.15 (a softer carcass deforms more before it slides)
    const r = tune.tirePressureKpa / NOMINAL_TIRE_KPA;
    const t = car.tires;
    t.muPeak = Math.min(2.5, t.muPeak * Math.pow(r, -0.08));
    t.B = Math.min(25, Math.max(4, t.B * Math.pow(r, 0.15)));
    t.rollingResistance = Math.min(0.05, Math.max(0.005, t.rollingResistance * Math.pow(r, -0.4)));
  }
  const peakTorqueNm = Math.max(...e.torqueCurve.torqueNm.filter((_, i) => e.torqueCurve.rpm[i]! <= e.revLimitRpm));
  const peakPowerCv = curvePeakCv(e.torqueCurve, e.revLimitRpm);
  e.ratedPowerCv = Math.max(10, Math.round(peakPowerCv));
  const v = validateCar(car);
  if (!v.ok) return { ok: false, errors: v.errors };
  return { ...hw, car: deepFreeze(v.value!), key, peakTorqueNm, peakPowerCv };
}

/** Reliability band of a tune on its build (Dyno Lab panel). */
export function tuneReliability(caps: TuningCapabilities, tune: BuildTune): ReliabilityLevel {
  if (!caps.limits) return 'safe';
  const cut = tune.revLimitRpm ?? caps.revLimit.default;
  const boostOver = tune.boostBar !== undefined && caps.boost.enabled ? tune.boostBar - caps.boost.default : 0;
  return reliabilityLevel(caps.limits, cut, boostOver);
}

/**
 * Over-rev failure spec of a build (career races): the limits of its hardware without the Dyno Lab
 * cut, so the hardware's own cut is always safe and only a raised cut (or over-revving) exposes it.
 */
export function failureSpecFor(base: CarConfig, partIds: readonly string[], version: ResolverVersion): OverrevSpec | null {
  const hw = resolveHardware(base, partIds, {}, version);
  return hw.ok ? overrevSpecOf(reliabilityLimits(hw.car, partIds)) : null;
}

/** Spec of a finished car config without part information (sandbox option "Falhas mecânicas"). */
export function failureSpecForCar(car: CarConfig): OverrevSpec {
  return overrevSpecOf(reliabilityLimits(car, []));
}
