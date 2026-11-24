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
  /** Highest speed reached in the test run (km/h; the run is time-limited, not a settled top speed). */
  vmaxKmh: number;
  /** Time the driven tyres spent above 15 % slip (s). */
  wheelspinS: number;
  revLimitRpm: number;
  /**
   * Recommended upshift speed per gear (index 0 = 1st → 2nd), from the measured torque curve and the
   * gear ratios: the speed where the next gear gives at least the same wheel torque.
   */
  shiftRpms: number[];
  /** Present when the car has a N₂O kit: curves measured on the bench with each stage's flow and the run's use. */
  nitrous?: LabNitrous;
}

/** N₂O bench curve at the configured flow and the observed injection in the track run. */
export interface LabNitrous {
  /** How the driver used the kit in the test run. */
  mode: LabNitrousMode;
  points: LabPoint[];
  peakCv: number;
  observedExtraCv: number;
  /** Cylinder spent and injection time in the test run. */
  usedKg: number;
  activeS: number;
  capacityKg: number;
}

export type LabNitrousMode = 'off' | 'continuous' | 'strategic';

/**
 * Best upshift speed of each gear: wheel torque ∝ T(rpm)·ratio. Shifting at rpm lands the engine at
 * rpm·next/ratio; the best point is the lowest speed where the next gear pulls at least as hard
 * (it then pulls harder from there on). When the current gear always pulls harder, it is the cut.
 * Final drive multiplies both sides (it does not move the point).
 */
export function recommendedShiftRpms(points: readonly LabPoint[], ratios: readonly number[], cutRpm: number): number[] {
  const tq = (rpm: number): number => {
    if (rpm <= points[0]!.rpm) return points[0]!.torqueNm;
    for (let i = 1; i < points.length; i++) {
      const p = points[i]!;
      if (rpm <= p.rpm) {
        const q = points[i - 1]!;
        return q.torqueNm + ((p.torqueNm - q.torqueNm) * (rpm - q.rpm)) / (p.rpm - q.rpm);
      }
    }
    return points[points.length - 1]!.torqueNm;
  };
  const out: number[] = [];
  for (let g = 0; g + 1 < ratios.length; g++) {
    const r0 = ratios[g]!;
    const r1 = ratios[g + 1]!;
    let best = cutRpm;
    for (let rpm = 2500; rpm <= cutRpm; rpm += 25) {
      if (tq(rpm) * r0 <= tq((rpm * r1) / r0) * r1) {
        best = rpm;
        break;
      }
    }
    out.push(Math.round(best / 25) * 25);
  }
  return out;
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
  opts: { rpmStep?: number; topSpeedS?: number; nitrous?: LabNitrousMode } = {},
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
  const mode = opts.nitrous ?? 'off';
  const acc = runAccelerationTest(car, track, { speedsKmh: [100], distancesM: [LAB_EIGHTH_M, LAB_QUARTER_M], maxS: opts.topSpeedS ?? 45, nitrous: mode });
  let nitrous: LabNitrous | undefined;
  if (car.nitrous) {
    const nz = car.nitrous;
    const curve = (): LabPoint[] => {
      const nd = new EngineDyno(e, undefined, nz);
      if (!nd.start()) return [];
      const out: LabPoint[] = [];
      for (const r of rpms.filter((_, i) => i % 2 === 0)) {
        // Each spot measurement is a separate bench run at the selected RPM.
        nd.nitrousHeld = false;
        nd.measure(r, 1, H, e.induction === 'turbo' ? 1.5 : 0.6, 0.15);
        nd.nitrous!.reset();
        nd.nitrousHeld = true;
        const p = nd.measure(r, 1, H, Math.max(0.15, nz.rampS), 0.15);
        out.push({ rpm: p.rpm, torqueNm: p.torqueNm, powerCv: p.powerCv });
      }
      return out;
    };
    const injectedPoints = curve();
    nitrous = {
      mode, points: injectedPoints, peakCv: injectedPoints.reduce((peak, p) => Math.max(peak, p.powerCv), 0),
      observedExtraCv: acc.nitrousPeakPowerCv, usedKg: acc.nitrousUsedKg,
      activeS: acc.nitrousActiveS, capacityKg: nz.capacityKg,
    };
  }
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
    shiftRpms: recommendedShiftRpms(points, car.transmission.gearRatios, e.revLimitRpm),
    ...(nitrous ? { nitrous } : {}),
  };
}
