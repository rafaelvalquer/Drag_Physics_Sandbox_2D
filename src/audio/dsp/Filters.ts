/**
 * Small allocation-free filters for the audio thread. Coefficients are always computed from the
 * real sample rate.
 *
 * `OnePole` replaces engine-sound-generator's `LowpassFilter` (MIT © Antonio-R1), which computed
 * α = 2π·f/fs / (2π·f/fs + 1) with fs hard-coded to 44100 Hz; here fs is a constructor argument
 * and the exact pole e^(−2π·f/fs) is used.
 */

/** States below this magnitude are flushed to zero (far below the 16/24-bit noise floor). */
const DENORMAL = 1e-30;

export class OnePole {
  private a = 0;
  y = 0;
  constructor(
    private readonly sampleRate: number,
    cutoffHz: number,
  ) {
    this.setCutoff(cutoffHz);
  }
  setCutoff(hz: number): void {
    const f = Math.min(Math.max(hz, 1), this.sampleRate * 0.49);
    this.a = Math.exp((-2 * Math.PI * f) / this.sampleRate);
  }
  lowpass(x: number): number {
    const y = x + (this.y - x) * this.a;
    this.y = y < DENORMAL && y > -DENORMAL ? 0 : y;
    return this.y;
  }
  /** One-pole high-pass (x − lowpass(x)). */
  highpass(x: number): number {
    return x - this.lowpass(x);
  }
  reset(v = 0): void {
    this.y = v;
  }
}

/** RBJ biquad (transposed direct form II). */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;
  constructor(private readonly sampleRate: number) {}

  private coeffs(f: number, q: number): { w: number; cos: number; alpha: number } {
    const fc = Math.min(Math.max(f, 5), this.sampleRate * 0.45);
    const w = (2 * Math.PI * fc) / this.sampleRate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * Math.max(q, 0.05));
    return { w, cos, alpha };
  }

  setLowpass(f: number, q = 0.7071): this {
    const { cos, alpha } = this.coeffs(f, q);
    const a0 = 1 + alpha;
    this.b0 = (1 - cos) / 2 / a0;
    this.b1 = (1 - cos) / a0;
    this.b2 = this.b0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }

  setHighpass(f: number, q = 0.7071): this {
    const { cos, alpha } = this.coeffs(f, q);
    const a0 = 1 + alpha;
    this.b0 = (1 + cos) / 2 / a0;
    this.b1 = -(1 + cos) / a0;
    this.b2 = this.b0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }

  /** Constant 0 dB peak gain band-pass. */
  setBandpass(f: number, q: number): this {
    const { cos, alpha } = this.coeffs(f, q);
    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b1 = 0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }

  process(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    // flush decaying states before they become subnormal (slow on x86 without FTZ)
    if (this.z1 < DENORMAL && this.z1 > -DENORMAL) this.z1 = 0;
    if (this.z2 < DENORMAL && this.z2 > -DENORMAL) this.z2 = 0;
    return y;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }
}

/** DC blocker y[n] = x[n] − x[n−1] + R·y[n−1]. */
export class DcBlocker {
  private x1 = 0;
  private y1 = 0;
  private readonly r: number;
  constructor(sampleRate: number, cutoffHz = 12) {
    this.r = Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  }
  process(x: number): number {
    const y = x - this.x1 + this.r * this.y1;
    this.x1 = x;
    this.y1 = y < DENORMAL && y > -DENORMAL ? 0 : y;
    return y;
  }
}

/** Smooth bounded saturation (keeps every channel inside ±1 without hard clipping). */
export function softClip(x: number): number {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

/** Linear parameter smoother (per-sample ramp to the target over `timeS`). */
export class Smoother {
  value: number;
  private readonly step: number;
  constructor(sampleRate: number, timeS: number, initial = 0) {
    this.value = initial;
    this.step = 1 / Math.max(1, timeS * sampleRate);
  }
  next(target: number): number {
    this.value += (target - this.value) * this.step * 4;
    return this.value;
  }
}
