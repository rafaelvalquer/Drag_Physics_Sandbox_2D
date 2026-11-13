/** Small numeric helpers shared by physics, audio (worklet-safe: no DOM access) and UI. */

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const sign = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Positive modulo (engine-sim `positiveMod`). */
export const positiveMod = (x: number, m: number): number => {
  const r = x % m;
  return r < 0 ? r + m : r;
};

/** Wraps a value to [-half, half) of the given period. */
export const wrapSigned = (x: number, period: number): number => {
  const r = positiveMod(x + period / 2, period);
  return r - period / 2;
};

/** Moves `current` toward `target` by at most `maxDelta`. */
export const approach = (current: number, target: number, maxDelta: number): number => {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
};

/** First-order low-pass step with time constant tau (exact discretization). */
export const firstOrder = (current: number, target: number, dt: number, tau: number): number => {
  if (tau <= 0) return target;
  const a = 1 - Math.exp(-dt / tau);
  return current + (target - current) * a;
};

export const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Monotone cubic (Fritsch–Carlson) interpolation over sorted x values.
 * Used for torque curves: smooth, C1-continuous, and without overshoot between points
 * (overshoot would invent torque that the configured curve does not contain).
 */
export class MonotoneCubic {
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;
  private readonly ms: Float64Array;

  constructor(xs: readonly number[], ys: readonly number[]) {
    if (xs.length !== ys.length || xs.length < 2) {
      throw new Error('MonotoneCubic requires at least two points with matching lengths.');
    }
    for (let i = 1; i < xs.length; i++) {
      if (!(xs[i]! > xs[i - 1]!)) throw new Error('MonotoneCubic x values must be strictly increasing.');
    }
    const n = xs.length;
    this.xs = Float64Array.from(xs);
    this.ys = Float64Array.from(ys);
    const d = new Float64Array(n - 1);
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!);
    const m = new Float64Array(n);
    m[0] = d[0]!;
    m[n - 1] = d[n - 2]!;
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1]! * d[i]! <= 0) m[i] = 0;
      else m[i] = (d[i - 1]! + d[i]!) / 2;
    }
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i]! / d[i]!;
      const b = m[i + 1]! / d[i]!;
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d[i]!;
        m[i + 1] = t * b * d[i]!;
      }
    }
    this.ms = m;
  }

  get minX(): number {
    return this.xs[0]!;
  }
  get maxX(): number {
    return this.xs[this.xs.length - 1]!;
  }

  /** Evaluates the curve; outside the range the end values are held (no extrapolation). */
  evaluate(x: number): number {
    const xs = this.xs;
    const n = xs.length;
    if (x <= xs[0]!) return this.ys[0]!;
    if (x >= xs[n - 1]!) return this.ys[n - 1]!;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid]! > x) hi = mid;
      else lo = mid;
    }
    const h = xs[hi]! - xs[lo]!;
    const t = (x - xs[lo]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * this.ys[lo]! + h10 * h * this.ms[lo]! + h01 * this.ys[hi]! + h11 * h * this.ms[hi]!;
  }
}
