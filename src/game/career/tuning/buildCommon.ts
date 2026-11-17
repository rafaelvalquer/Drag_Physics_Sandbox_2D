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
