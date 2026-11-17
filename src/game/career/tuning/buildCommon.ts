import type { CarConfig } from '../../../data/schema';
import type { PartDef, TirePart } from './parts';

/** Resolver versions. A build is always resolved by the version stored with it (saves keep theirs). */
export type ResolverVersion = 1 | 2;

/** A turbocharged build needs a clutch with this margin over the engine's peak torque. */
export const CLUTCH_TORQUE_MARGIN = 1.2;
/** Largest ignition-retard loss a tuner accepts before calling the boost setting unsafe. */
export const MAX_KNOCK_LOSS = 0.25;

/** Settings made on the dyno by the engine tuners (career unlock). */
export interface BuildTune {
  boostBar?: number;
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
      knockLoss: number;
      /** Resolver version that produced the build. */
      version: ResolverVersion;
    }
  | { ok: false; errors: string[] };

export const fmtBar = (b: number): string => b.toFixed(2).replace('.', ',');

export function applyTyre(car: CarConfig, base: CarConfig, t: TirePart): void {
  car.tires = {
    ...base.tires,
    muPeak: t.muPeak,
    B: t.B,
    C: t.C,
    E: t.E,
    wheelInertiaKgM2: base.tires.wheelInertiaKgM2 + t.wheelInertiaAddKgM2,
    rollingResistance: base.tires.rollingResistance + t.rollingResistanceAdd,
    optimalTempC: t.optimalTempC,
    tempSensitivityPerC: t.tempSensitivityPerC,
  };
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
