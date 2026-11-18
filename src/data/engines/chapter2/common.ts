import type { CamProfile, EngineConfig, TurboConfig } from '../../schema';
import { KGFM_TO_NM, ratedAirFlowKgS, torqueForPower } from '../../provenance';
import { firingAngles, fmepFriction } from '../builders';

/**
 * Builder of the Chapter 2 engines. It only fills the parts every modern engine shares in this
 * simulator (idle controller, starter, friction law, breathing reference); every value that
 * describes the engine itself – geometry, compression, valve events, intake, rev limits, the
 * WOT curve and the turbocharger – is passed explicitly by the engine file with its provenance.
 */
export interface ModernEngineSpec {
  id: string;
  /** Workshop compatibility family (see EngineSchema.family). */
  family: string;
  name: string;
  architecture: 'I4' | 'I6' | 'V6';
  firingOrder: number[];
  /** V engines: angle between the banks (deg). Absent = 0 (inline). */
  bankAngleDeg?: number;
  /** Crankshaft layout. Absent = 'inline'. */
  crankType?: EngineConfig['crankType'];
  /** V engines: bank (0/1) of every cylinder, index = cylinder number − 1. */
  bankOfCylinder?: number[];
  /** Firing intervals (deg) between consecutive events of the firing order; absent = even (720/n). */
  firingIntervalsDeg?: number | number[];
  boreMm: number;
  strokeMm: number;
  rodLengthMm: number;
  compressionRatio: number;
  inertiaKgM2: number;
  reciprocatingMassKg: number;
  idleRpm: number;
  redlineRpm: number;
  revLimitRpm: number;
  limiterCutTimeS: number;
  torqueCurve: { rpm: number[]; torqueNm: number[] };
  ratedPowerCv: number;
  ratedPowerRpm: number;
  /** FMEP law coefficients a, b, c (bar) – see fmepFriction. */
  fmep: [number, number, number];
  accessoriesNm: number;
  throttle: EngineConfig['throttle'];
  intake: EngineConfig['intake'];
  cam: CamProfile;
  variableCam?: EngineConfig['variableCam'];
  breathing: { airFilterDropKPa: number; exhaustBackPressureKPa: number };
  fuel: 'gasoline' | 'ethanol';
  combustion: EngineConfig['combustion'];
  turbo?: TurboConfig;
  egt: EngineConfig['egt'];
  starterTorqueNm: number;
}

export function modernEngine(s: ModernEngineSpec): EngineConfig {
  const n = s.firingOrder.length;
  const cylinders = n;
  const displacementCm3 = (Math.PI / 4) * (s.boreMm / 10) ** 2 * (s.strokeMm / 10) * cylinders;
  return {
    id: s.id,
    name: s.name,
    architecture: s.architecture,
    cylinders,
    bankAngleDeg: s.bankAngleDeg ?? 0,
    crankType: s.crankType ?? 'inline',
    firingOrder: [...s.firingOrder],
    firingAnglesDeg: firingAngles(s.firingOrder, s.firingIntervalsDeg ?? 720 / n),
    bankOfCylinder: s.bankOfCylinder ? [...s.bankOfCylinder] : new Array<number>(n).fill(0),
    boreMm: s.boreMm,
    strokeMm: s.strokeMm,
    rodLengthMm: s.rodLengthMm,
    compressionRatio: s.compressionRatio,
    inertiaKgM2: s.inertiaKgM2,
    reciprocatingMassKg: s.reciprocatingMassKg,
    idleRpm: s.idleRpm,
    redlineRpm: s.redlineRpm,
    revLimitRpm: s.revLimitRpm,
    limiterCutTimeS: s.limiterCutTimeS,
    maxSafeRpm: s.revLimitRpm + 400,
    torqueCurve: { rpm: [...s.torqueCurve.rpm], torqueNm: [...s.torqueCurve.torqueNm] },
    friction: fmepFriction(s.boreMm, s.strokeMm, cylinders, ...s.fmep),
    accessoriesNm: s.accessoriesNm,
    throttle: { ...s.throttle },
    intake: { ...s.intake },
    cam: { ...s.cam },
    ...(s.variableCam ? { variableCam: structuredClone(s.variableCam) } : {}),
    breathing: {
      referenceFlowKgS: ratedAirFlowKgS(displacementCm3, s.ratedPowerRpm, s.turbo ? 0.85 * (1 + s.turbo.maxBoostBar) : 0.88),
      airFilterDropKPa: s.breathing.airFilterDropKPa,
      exhaustBackPressureKPa: s.breathing.exhaustBackPressureKPa,
    },
    family: s.family,
    fuel: s.fuel,
    combustion: { ...s.combustion },
    ratedPowerCv: s.ratedPowerCv,
    induction: s.turbo ? 'turbo' : 'NA',
    ...(s.turbo ? { turbo: { ...s.turbo } } : {}),
    egt: { ...s.egt },
    starter: { torqueNm: s.starterTorqueNm, speedRpm: 230 },
    idleControl: { naturalFrequencyRadS: 2.6, damping: 1, maxAirFraction: 0.05 },
  };
}

/** N·m from kgfm, rounded to 0.1. */
export const kgfm = (v: number): number => Math.round(v * KGFM_TO_NM * 10) / 10;
export { torqueForPower };

/** Documented sheet of an engine (what the sources say; the config is built from it). */
export interface EngineDoc {
  code: string;
  displacementCm3: number;
  boreMm: number;
  strokeMm: number;
  compressionRatio: number;
  fuel: string;
  feed: string;
  power: { cv: number; rpm: number; rpmTo?: number };
  torque: { nm: number; rpm: number; rpmTo?: number };
  layout: string;
  firingOrder: readonly number[];
  sources: readonly string[];
  /** As published in the source units (the figures above are converted: hp → cv, lb-ft → N·m). */
  published?: { hp?: number; lbFt?: number; kw?: number; ps?: number };
}
