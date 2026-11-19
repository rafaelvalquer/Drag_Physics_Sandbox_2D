import type { CarConfig } from '../../../data/schema';
import type { MechanicalMods, PartDef, TirePart } from './parts';

/** Resolver versions. A build is always resolved by the version stored with it (saves keep theirs). */
export type ResolverVersion = 1 | 2;

/** A turbocharged build needs a clutch with this margin over the engine's peak torque. */
export const CLUTCH_TORQUE_MARGIN = 1.2;
/** Largest ignition-retard loss a tuner accepts before calling the boost setting unsafe. */
export const MAX_KNOCK_LOSS = 0.25;

/** Discrete crown-and-pinion presets of an adjustable final drive (ratio scale over the build's). */
export const FINAL_DRIVE_PRESETS = { short: 1.06, standard: 1, long: 0.95 } as const;
export type FinalDrivePreset = keyof typeof FINAL_DRIVE_PRESETS;
/** Pedal map presets of an electronic / reworked throttle: actuator time and linkage exponent scales. */
export const THROTTLE_PRESETS = {
  soft: { responseScale: 1.4, gammaScale: 1.15 },
  standard: { responseScale: 1, gammaScale: 1 },
  sharp: { responseScale: 0.7, gammaScale: 0.85 },
} as const;
export type ThrottlePreset = keyof typeof THROTTLE_PRESETS;
/** Nominal cold tyre pressure every car leaves the factory with (kPa). */
export const NOMINAL_TIRE_KPA = 220;

/**
 * Settings made on the dyno (Dyno Lab). Every field is optional: absent = the hardware's default.
 * Each one changes a real physical input of the simulation (see TuningCapabilities.applyTuneOverlay):
 *  - boostBar: wastegate / ECU boost target (applied by the resolvers);
 *  - revLimitRpm: ignition cut of a programmable ECU (never raises the mechanical limit);
 *  - launchRpm: speed the launch clutch logic holds at the start;
 *  - throttleResponse: actuator time constant and pedal linkage exponent;
 *  - finalDrive: crown-and-pinion preset of an adjustable differential;
 *  - shiftRpm: full-throttle upshift speed of the automatic shift schedule (TCU);
 *  - tirePressureKpa: cold pressure of the tyres (grip, slip stiffness, rolling resistance).
 */
export interface BuildTune {
  boostBar?: number;
  revLimitRpm?: number;
  launchRpm?: number;
  throttleResponse?: ThrottlePreset;
  finalDrive?: FinalDrivePreset;
  shiftRpm?: number;
  tirePressureKpa?: number;
}

/** Fields of BuildTune in their canonical order (keys, comparison, migration). */
export const TUNE_FIELDS = ['boostBar', 'revLimitRpm', 'launchRpm', 'throttleResponse', 'finalDrive', 'shiftRpm', 'tirePressureKpa'] as const;
export type TuneField = (typeof TUNE_FIELDS)[number];

/** Canonical string of the tune (build key); '' for the default tune. boostBar keeps its old format. */
export function tuneKey(t: BuildTune): string {
  let k = t.boostBar !== undefined ? `|b${t.boostBar.toFixed(2)}` : '';
  if (t.revLimitRpm !== undefined) k += `|r${Math.round(t.revLimitRpm)}`;
  if (t.launchRpm !== undefined) k += `|l${Math.round(t.launchRpm)}`;
  if (t.throttleResponse !== undefined) k += `|t${t.throttleResponse}`;
  if (t.finalDrive !== undefined) k += `|f${t.finalDrive}`;
  if (t.shiftRpm !== undefined) k += `|s${Math.round(t.shiftRpm)}`;
  if (t.tirePressureKpa !== undefined) k += `|p${Math.round(t.tirePressureKpa)}`;
  return k;
}

export function sameTune(a: BuildTune, b: BuildTune): boolean {
  return tuneKey(a) === tuneKey(b);
}

/** Only the boost setting is applied inside the resolvers; the rest is an overlay on the result. */
export function resolverTune(t: BuildTune): BuildTune {
  return t.boostBar === undefined ? {} : { boostBar: t.boostBar };
}

export type BuildResult =
  | {
      ok: true;
      car: CarConfig;
      parts: PartDef[];
      key: string;
      peakTorqueNm: number;
      peakPowerCv: number;
      steadyBoostBar: { rpm: number; bar: number }[];
      /** Modelled exhaust restriction at reference flow. Factory turbo keeps its turbine-side live calibration. */
      exhaustRestrictionKPa?: number;
      chargeTemperatureAtTargetK?: number;
      knockLoss: number;
      /** Resolver version that produced the build. */
      version: ResolverVersion;
    }
  | { ok: false; errors: string[] };

export const fmtBar = (b: number): string => b.toFixed(2).replace('.', ',');

/**
 * Least grip gain of each compound over the tyre it replaces. A car that leaves the factory on
 * tyres already as grippy as a generic "sport" compound gets the sport version of ITS size and
 * construction, never a downgrade.
 */
const TYRE_MIN_GAIN: Record<TirePart['grade'], number> = { sport: 1.06, semiSlick: 1.16, slick: 1.3 };

/** Tyre temperature at the start line used to size the compound (°C, warm track after a burnout lap). */
export const TYRE_START_TEMP_C = 30;
const gripAt = (mu: number, sens: number, opt: number): number => mu * Math.min(1.05, Math.max(0.6, 1 - sens * Math.abs(TYRE_START_TEMP_C - opt)));

export function applyTyre(car: CarConfig, base: CarConfig, t: TirePart): void {
  // the guaranteed gain holds at the start line, where a soft compound is still below its
  // temperature: its peak (hot) grip is sized so that even cold it beats the tyre it replaces
  const baseGrip = gripAt(base.tires.muPeak, base.tires.tempSensitivityPerC, base.tires.optimalTempC);
  const coldFactor = gripAt(1, t.tempSensitivityPerC, t.optimalTempC);
  car.tires = {
    ...base.tires,
    muPeak: Math.min(2.5, Math.max(t.muPeak, (baseGrip * TYRE_MIN_GAIN[t.grade]) / coldFactor)),
    B: t.B,
    C: t.C,
    E: t.E,
    wheelInertiaKgM2: base.tires.wheelInertiaKgM2 + t.wheelInertiaAddKgM2,
    rollingResistance: base.tires.rollingResistance + t.rollingResistanceAdd,
    optimalTempC: t.optimalTempC,
    tempSensitivityPerC: t.tempSensitivityPerC,
  };
}

/**
 * Quarter-mile estimate used by the workshop to choose gearing for a car (the way a builder works it
 * out on paper): point mass with the engine's full-load curve, traction limited by μ·N on the
 * driven axle with the load transfer, drag, rolling resistance, the rotating inertia of the engine
 * reflected through the gearing, and a dead time per gear change. Never used to time a race.
 */
export function quarterMileEstimateS(car: CarConfig, finalDrive: number, ratios: readonly number[]): number {
  const g = 9.81;
  const m = car.massKg;
  const r = car.tires.radiusM;
  const eff = car.transmission.efficiency * (car.awd?.transferEfficiency ?? 1);
  const crv = car.engine.torqueCurve;
  const torque = (rpm: number): number => {
    if (rpm <= crv.rpm[0]!) return crv.torqueNm[0]!;
    for (let i = 1; i < crv.rpm.length; i++)
      if (rpm <= crv.rpm[i]!) return crv.torqueNm[i - 1]! + ((crv.torqueNm[i]! - crv.torqueNm[i - 1]!) * (rpm - crv.rpm[i - 1]!)) / (crv.rpm[i]! - crv.rpm[i - 1]!);
    return crv.torqueNm[crv.torqueNm.length - 1]!;
  };
  const shiftDead = (car.transmission.kind ?? 'manual') === 'manual' ? 0.25 : 0.1;
  const limit = car.engine.revLimitRpm - 100;
  const launch = car.transmission.clutch.launchRpm;
  const dt = 0.005;
  let v = 0, x = 0, t = 0, gear = 0, dead = 0, a = 0;
  while (x < 402.336 && t < 40) {
    const ratio = ratios[gear]! * finalDrive;
    const rpm = Math.max(launch, ((v / r) * ratio * 60) / (2 * Math.PI));
    if (rpm >= limit && gear < ratios.length - 1) {
      gear++;
      dead = shiftDead;
      continue;
    }
    const engineForce = rpm >= car.engine.revLimitRpm ? 0 : (torque(rpm) * ratio * eff) / r;
    const transfer = (m * a * car.cgHeightM) / car.wheelbaseM;
    const n =
      car.drivenAxle === 'awd' ? m * g : car.drivenAxle === 'rear' ? m * g * (1 - car.frontWeightFraction) + transfer : m * g * car.frontWeightFraction - transfer;
    const drive = dead > 0 ? 0 : Math.min(engineForce, car.tires.muPeak * Math.max(0, n) * 0.95);
    const resist = 0.5 * 1.2 * car.dragCoefficient * car.frontalAreaM2 * v * v + car.tires.rollingResistance * m * g;
    const mEff = m + (4 * car.tires.wheelInertiaKgM2 + car.engine.inertiaKgM2 * ratio * ratio) / (r * r);
    a = (drive - resist) / mEff;
    v = Math.max(0, v + a * dt);
    x += v * dt;
    t += dt;
    dead = Math.max(0, dead - dt);
  }
  return t;
}

/**
 * Crown-and-pinion choice of the workshop: within the range the part allows (from the factory
 * ratio up to `scale`), the ratio with the best quarter-mile estimate for THIS car, in 1 % steps.
 * A part always changes the ratio by at least 2 % (it is a different crown and pinion).
 */
export function workshopFinalDrive(car: CarConfig, baseFd: number, scale: number): number {
  // the kit's crowns go from 3 % the other way up to its nominal ratio; the builder fits the best
  const lo = Math.min(scale, 0.97);
  const hi = Math.max(scale, 1.03);
  let best = 1;
  let bestT = Infinity;
  for (let s = lo; s <= hi + 1e-9; s += 0.01) {
    const t = quarterMileEstimateS(car, baseFd * s, car.transmission.gearRatios);
    if (t < bestT - 1e-6) {
      bestT = t;
      best = s;
    }
  }
  return Math.round(baseFd * best * 1000) / 1000;
}

/**
 * Close-ratio gear set of the workshop: first and top gear stay, the intermediate gears move
 * towards first by the spread exponent (0.84 = a drag box). The exponent is the one in
 * [spread, 0.98] with the best quarter-mile estimate for the car.
 */
export function workshopGearRatios(car: CarConfig, baseRatios: readonly number[], spread: number): number[] {
  const set = (k: number): number[] => {
    const first = baseRatios[0]!;
    const last = baseRatios.length - 1;
    const out = baseRatios.map((r) => r);
    for (let i = last - 1; i >= 1; i--) out[i] = Math.max(0.4, Math.min(6, Math.max(out[i + 1]! * 1.06, first * Math.pow(baseRatios[i]! / first, k))));
    return out;
  };
  let best = set(0.98);
  let bestT = quarterMileEstimateS(car, car.transmission.finalDrive, best);
  for (let k = 0.97; k >= spread - 1e-9; k -= 0.01) {
    const s = set(k);
    const t = quarterMileEstimateS(car, car.transmission.finalDrive, s);
    if (t < bestT - 1e-6) {
      bestT = t;
      best = s;
    }
  }
  return best.map((r) => Math.round(r * 1000) / 1000);
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

/** How slot-catalogue mods of several parts combine (the same rules the v1 resolver uses). */
const COMPOUND_MODS = new Set(['knockRetardScale', 'coolingKnockScale', 'coolingFrictionScale', 'burnDurationScale', 'turboSpoolScale', 'tireRollingScale']);
const ADDITIVE_MODS = new Set(['backPressureReductionKPa', 'filterDropReductionKPa', 'intercoolerEffectivenessAdd', 'intercoolerMassAddKg', 'wastegateHoldAddBar', 'drivelineEfficiencyAdd', 'massRemoveKg']);

export function combineMods(parts: readonly PartDef[]): MechanicalMods {
  const mod: MechanicalMods = {};
  for (const p of parts) if ('mod' in p) {
    for (const [k, v] of Object.entries(p.mod)) {
      if (v === undefined) continue;
      mod[k] = mod[k] === undefined ? v : COMPOUND_MODS.has(k) ? mod[k]! * v : ADDITIVE_MODS.has(k) ? mod[k]! + v : v;
    }
  }
  return mod;
}

/**
 * Car hardware of the generic slot-catalogue parts on a modern car (resolver v2): tyre size and
 * pressure (after the compound), and mass. Same physics as the v1 resolver applies.
 */
export function applyGenericChassisMods(car: CarConfig, mod: MechanicalMods): void {
  if (mod.tireMuScale) car.tires.muPeak = Math.min(2.5, car.tires.muPeak * mod.tireMuScale);
  if (mod.tireInertiaAddKgM2) car.tires.wheelInertiaKgM2 += mod.tireInertiaAddKgM2;
  if (mod.tireStiffnessScale) car.tires.B = Math.min(25, car.tires.B * mod.tireStiffnessScale);
  if (mod.tireTempSensitivityScale) car.tires.tempSensitivityPerC *= mod.tireTempSensitivityScale;
  if (mod.tireRollingScale) car.tires.rollingResistance = Math.max(0.005, car.tires.rollingResistance * mod.tireRollingScale);
  if (mod.massRemoveKg) car.massKg = Math.max(500, car.massKg - mod.massRemoveKg);
}
