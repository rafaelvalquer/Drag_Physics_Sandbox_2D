import { MonotoneCubic, clamp } from '../../../core/math';
import type { TrackConfig } from '../../../data/schema';
import { AI_PROFILES, optimalShiftRpms, type AiProfile } from '../../ai/DragAI';
import { RACE_DISTANCES, type RaceDistanceId } from '../../race/RaceController';
import type { ChapterId } from '../chapters';
import type { FreeBuild } from './FreeBuildGenerator';
import type { FreeTier } from './FreeEventTypes';

type Resolved = FreeBuild['resolved'];
type Bands = Record<RaceDistanceId, Record<FreeTier, readonly [fast: number, slow: number]>>;

// Seconds from green. Adjacent classes overlap so slow prepared cars and quick stock
// cars can meet, and each chapter retains a range of approachable cars as parts unlock.
const BANDS: Record<ChapterId, Bands> = {
  'chapter-1': {
    eighth: { iniciante: [11.1, 16], rua: [10.8, 13.7], preparado: [10.3, 13.3], competicao: [7.3, 11.35] },
    quarter: { iniciante: [17.5, 24], rua: [17.5, 21], preparado: [16.7, 20.3], competicao: [11.8, 17.7] },
    km: { iniciante: [33, 49], rua: [31, 43], preparado: [28, 40], competicao: [22, 34] },
  },
  'chapter-2': {
    eighth: { iniciante: [8.9, 12], rua: [8.4, 10.7], preparado: [7.7, 9.9], competicao: [6.4, 9.35] },
    quarter: { iniciante: [14, 19], rua: [13.2, 16.7], preparado: [12.2, 15.5], competicao: [9.9, 14.4] },
    km: { iniciante: [26, 37], rua: [24, 34], preparado: [22, 31], competicao: [18, 28] },
  },
  'chapter-3': {
    eighth: { iniciante: [7.8, 10], rua: [7.4, 9.4], preparado: [7.0, 8.9], competicao: [5.8, 8.4] },
    quarter: { iniciante: [12.4, 15.4], rua: [11.8, 14.4], preparado: [11.2, 13.7], competicao: [9, 13.0] },
    km: { iniciante: [22.7, 28.6], rua: [21.5, 27.2], preparado: [20.2, 25.5], competicao: [17, 24] },
  },
};

export function freePerformanceBand(chapter: ChapterId, distance: RaceDistanceId, tier: FreeTier) {
  return BANDS[chapter][distance][tier];
}

const estimates = new Map<string, number>();

/** Cheap forward integration of wheel force through the resolved gearing. Full calibration uses
 * the race controller. This approximation ranks offers and never modifies either race lane. */
export function estimateFreeTime(build: Resolved, track: TrackConfig, distance: RaceDistanceId, driver: AiProfile = AI_PROFILES.advanced): number {
  const key = `${build.key}/${track.id}/${distance}/${driver.reactionMeanS}/${driver.shiftOffsetRpm}/${driver.traction?.forceFraction ?? 0}`;
  const cached = estimates.get(key);
  if (cached !== undefined) return cached;
  const { car } = build;
  const e = car.engine;
  const t = car.transmission;
  const tire = car.tires;
  const wot = new MonotoneCubic(e.torqueCurve.rpm, e.torqueCurve.torqueNm);
  const shifts = optimalShiftRpms(car);
  const launch = t.torqueConverter
    ? clamp(t.torqueConverter.kFactor * Math.sqrt(wot.evaluate(2200)), 1400, 3500)
    : t.clutch.launchRpm;
  const grip = tire.muPeak * track.surfaceGrip * Math.max(0.55, 1 - Math.abs(tire.optimalTempC - track.surfaceTempC) * tire.tempSensitivityPerC);
  const normal = car.massKg * 9.81;
  const front = car.frontWeightFraction;
  const weightShift = car.cgHeightM / car.wheelbaseM;
  const driveShare = car.drivenAxle === 'front' ? front : car.drivenAxle === 'rear' ? 1 - front : 0.94;
  const transfer = car.drivenAxle === 'front' ? -weightShift : car.drivenAxle === 'rear' ? weightShift : 0;
  const rolling = normal * (tire.rollingResistance * track.rollingResistanceFactor + track.gradePercent / 100);
  const air = 0.5 * track.ambientPressurePa / (287.05 * (273.15 + track.ambientTempC)) * car.dragCoefficient * car.frontalAreaM2;
  const dt = 0.08;
  const finish = RACE_DISTANCES[distance].m;
  let elapsed = 0;
  let x = 0;
  let v = 0;
  let g = 0;
  let shift = 0;
  let accel = 0;
  for (; x < finish && elapsed < 95; elapsed += dt) {
    const ratio = t.gearRatios[g]! * t.finalDrive;
    const rpm = v / tire.radiusM * ratio * 60 / (2 * Math.PI);
    const point = t.kind === 'torque-converter-auto' && t.autoShift
      ? t.autoShift.wotUpshiftFraction * e.revLimitRpm
      : clamp((shifts[g] ?? e.revLimitRpm) + driver.shiftOffsetRpm, launch + 500, e.revLimitRpm - 60);
    if (shift <= 0 && rpm >= point && g < t.gearRatios.length - 1) {
      g++;
      shift = t.kind === 'dual-clutch' ? 0.11 : t.kind === 'torque-converter-auto' ? 0.16 : 0.32;
      continue;
    }
    const drivenLoad = normal * clamp(driveShare + transfer * (accel / 9.81), 0.15, 1);
    const control = driver.traction?.forceFraction ?? 0.9;
    const traction = grip * drivenLoad * (v < 14 ? control : 1);
    const spool = e.turbo ? 1 - 0.34 * Math.exp(-elapsed / Math.max(0.2, e.turbo.spoolTimeS * 1.4)) : 1;
    const coupling = rpm < launch ? 0.72 + 0.27 * clamp(elapsed / 1.2, 0, 1) : 1;
    const torque = wot.evaluate(clamp(Math.max(launch, rpm), e.idleRpm, e.revLimitRpm));
    const force = torque * ratio * t.efficiency * (car.awd?.transferEfficiency ?? 1) / tire.radiusM;
    const thrust = Math.min(traction, force * coupling * spool) * (shift > 0 ? (t.kind && t.kind !== 'manual' ? 0.72 : 0.15) : 1);
    const relativeWind = v - track.windMs;
    accel = (thrust - rolling - air * relativeWind * Math.abs(relativeWind)) / (car.massKg * 1.06);
    v = Math.max(0, v + accel * dt);
    x += v * dt;
    shift -= dt;
  }
  const result = elapsed + driver.reactionMeanS;
  if (estimates.size >= 2500) estimates.clear();
  estimates.set(key, result);
  return result;
}
