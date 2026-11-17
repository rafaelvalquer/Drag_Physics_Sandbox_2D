import type { CarConfig, TrackConfig } from '../../../data/schema';
import { EngineDyno } from '../../../physics/engine/EngineDyno';
import { runAccelerationTest } from '../../race/accelerationTest';

/** One measured point of the bench (never interpolated from the configured curve). */
export interface LabPoint {
  rpm: number;
  torqueNm: number;
  powerCv: number;
}

/**
 * Dyno Lab measurement of a build: the engine on the bench (EngineDyno, brake torque measured
 * with the dynamometer constraint) and the car on the test track (runAccelerationTest with the
 * game's AI driver, the same physics as a race). Nothing is estimated from formulas.
 */
export interface LabMeasurement {
  points: LabPoint[];
  peakCv: number;
  peakCvRpm: number;
  peakNm: number;
  peakNmRpm: number;
  boostMaxBar: number | null;
  t100: number | null;
  t201: number | null;
  t402: number | null;
  /** Speed the car settles at in the test (top speed reached, km/h). */
  vmaxKmh: number;
  /** Time the driven tyres spent above 15 % slip (s). */
  wheelspinS: number;
  revLimitRpm: number;
}

export const LAB_EIGHTH_M = 201.168;
export const LAB_QUARTER_M = 402.336;
const H = 1 / 120;

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * Measures `car`. Async in small chunks (the screen stays responsive); returns null as soon as
 * `isStale()` turns true. `progress(fraction)` is called while it runs.
 */
export async function measureLab(
  car: CarConfig,
  track: TrackConfig,
  isStale: () => boolean = () => false,
  progress: (f: number) => void = () => {},
  opts: { rpmStep?: number; topSpeedS?: number } = {},
): Promise<LabMeasurement | null> {
  const e = car.engine;
  const d = new EngineDyno(e);
  if (!d.start()) return null;
  const rpms: number[] = [];
  const step = opts.rpmStep ?? 250;
  for (let r = 1500; r < e.revLimitRpm; r += step) rpms.push(r);
  rpms.push(e.revLimitRpm - 50);
  const points: LabPoint[] = [];
  let boost = 0;
  for (let i = 0; i < rpms.length; i += 3) {
    for (let k = i; k < Math.min(rpms.length, i + 3); k++) {
      const p = d.measure(rpms[k]!, 1, H, e.induction === 'turbo' ? 1.5 : 0.6, 0.15);
      points.push({ rpm: p.rpm, torqueNm: p.torqueNm, powerCv: p.powerCv });
      boost = Math.max(boost, p.boostPa / 1e5);
    }
    progress((0.6 * points.length) / rpms.length);
    await tick();
    if (isStale()) return null;
  }
  const acc = runAccelerationTest(car, track, { speedsKmh: [100], distancesM: [LAB_EIGHTH_M, LAB_QUARTER_M], maxS: opts.topSpeedS ?? 45 });
  progress(1);
  if (isStale()) return null;
  const pk = points.reduce((a, p) => (p.powerCv > a.powerCv ? p : a));
  const tk = points.reduce((a, p) => (p.torqueNm > a.torqueNm ? p : a));
  return {
    points,
    peakCv: pk.powerCv,
    peakCvRpm: pk.rpm,
    peakNm: tk.torqueNm,
    peakNmRpm: tk.rpm,
    boostMaxBar: e.induction === 'turbo' ? boost : null,
    t100: acc.speedTimes.get(100) ?? null,
    t201: acc.distanceTimes.get(LAB_EIGHTH_M) ?? null,
    t402: acc.distanceTimes.get(LAB_QUARTER_M) ?? null,
    vmaxKmh: acc.topSpeedKmh,
    wheelspinS: acc.wheelspinS,
    revLimitRpm: e.revLimitRpm,
  };
}
