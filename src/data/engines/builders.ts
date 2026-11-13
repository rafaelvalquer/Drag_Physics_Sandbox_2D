import { MonotoneCubic } from '../../core/math';
import { cvToWatts, rpmToRadS } from '../../core/units';

/**
 * Builds the firing-angle table (0..720°) of every cylinder from a firing order and the crank
 * angle between consecutive events. `intervalsDeg` may be a single even interval or one value per
 * event (uneven firing).
 */
export function firingAngles(firingOrder: readonly number[], intervalsDeg: number | readonly number[]): number[] {
  const n = firingOrder.length;
  const angles = new Array<number>(n).fill(0);
  let a = 0;
  for (let k = 0; k < n; k++) {
    angles[firingOrder[k]! - 1] = a % 720;
    const step = typeof intervalsDeg === 'number' ? intervalsDeg : intervalsDeg[k]!;
    a += step;
  }
  return angles;
}

/**
 * Friction parameters from a friction-mean-effective-pressure law
 *   FMEP(bar) = a + b·(N/1000) + c·(N/1000)²
 * (the usual empirical form of Chen–Flynn type correlations). Torque = FMEP·V_d/(4π).
 */
export function fmepFriction(
  boreMm: number,
  strokeMm: number,
  cylinders: number,
  a = 0.8,
  b = 0.12,
  c = 0.025,
): { coulombNm: number; viscousNmPerRadS: number; quadraticNmPerRadS2: number } {
  const vd = (Math.PI / 4) * (boreMm / 1000) ** 2 * (strokeMm / 1000) * cylinders;
  const nmPerBar = (1e5 * vd) / (4 * Math.PI);
  const k = rpmToRadS(1000);
  const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    coulombNm: round(a * nmPerBar, 2),
    viscousNmPerRadS: round((b * nmPerBar) / k, 5),
    quadraticNmPerRadS2: round((c * nmPerBar) / (k * k), 8),
  };
}

/**
 * Scales a normalized torque shape so that the configured WOT brake torque curve has the given
 * peak power. This is how the illustrative "target power" of each fictional engine is turned into
 * a torque curve; during the simulation the power is never imposed – it results from T·ω.
 * Returns rounded values (N·m) at the given rpm points.
 */
export function curveForTargetPower(
  points: ReadonlyArray<readonly [number, number]>,
  targetCv: number,
): { rpm: number[]; torqueNm: number[] } {
  const rpm = points.map((p) => p[0]);
  const shape = points.map((p) => p[1]);
  const curve = new MonotoneCubic(rpm, shape);
  let maxP = 0;
  for (let r = rpm[0]!; r <= rpm[rpm.length - 1]!; r += 10) {
    const p = curve.evaluate(r) * rpmToRadS(r);
    if (p > maxP) maxP = p;
  }
  const scale = cvToWatts(targetCv) / maxP;
  return { rpm, torqueNm: shape.map((s) => Math.round(s * scale * 10) / 10) };
}
