import type { Prng } from '../../../core/prng';
import { OnePole } from '../Filters';
import type { RotorTextureConfig } from './TurboAcousticTypes';

const TWO_PI = 2 * Math.PI;

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Anti-alias gain of a partial: faded between 15 kHz and 18.5 kHz, both capped below Nyquist
 * (0.70 / 0.86 · fs/2), so at 44.1, 48 and 96 kHz the audible signature is the same and nothing
 * above Nyquist can fold back. Each partial is faded on its own: the fundamental stays when the
 * blade-pass order is gone.
 */
export function partialGain(f: number, nyq: number): number {
  const a = Math.min(15000, nyq * 0.7);
  const b = Math.min(18500, nyq * 0.86);
  return 1 - smoothstep(a, b, f);
}

/** Radiation / audibility onset of a low partial (a few hundred Hz shaft orders are barely radiated). */
function lowGain(f: number): number {
  return smoothstep(120, 520, f);
}

/** Block-rate targets of one rotor voice. */
export interface RotorTargets {
  g1: number;
  g2: number;
  g3: number;
  gB: number;
  /** Exhaust pulse amplitude modulation: rate (Hz) and depth. */
  pulseHz: number;
  pulseDepth: number;
  /** External amplitude modulation (flutter stall), 1 = none. */
  am: number;
}

/** Two low-passed quadrature coefficients, translated around an order by its own carrier.
 * Interpolation keeps the control stream continuous. No independent oscillator changes shaft pitch.
 */
class NarrowbandOrder {
  private i1 = 0;
  private i2 = 0;
  private q1 = 0;
  private q2 = 0;
  private i = 0;
  private q = 0;
  private di = 0;
  private dq = 0;

  block(hz: number, samples: number, dt: number, rng: Prng): void {
    const r = Math.exp(-TWO_PI * hz * samples * dt);
    const a = 1 - r;
    this.i1 += a * (rng.bipolar() - this.i1);
    this.i2 += a * (this.i1 - this.i2);
    this.q1 += a * (rng.bipolar() - this.q1);
    this.q2 += a * (this.q1 - this.q2);
    // White uniform input variance = 1/3. Normalize the two-pole baseband to unit variance.
    const norm = Math.sqrt(3 * (1 + r) ** 3 / (a * (1 + r * r)));
    this.di = (this.i2 * norm - this.i) / samples;
    this.dq = (this.q2 * norm - this.q) / samples;
  }

  process(sin: number, cos: number, phaseNoiseDepth: number): number {
    this.i += this.di;
    this.q += this.dq;
    // Common RNG bandwidth, with a small independently varying quadrature contribution.
    return this.i * sin * .7071067811865476 + this.q * cos * (.7071067811865476 + phaseNoiseDepth);
  }
}

/**
 * One compressor rotor: additive synthesis of the shaft orders 1X, 2X, 3X and the blade-pass
 * order, all phase-locked to one phase accumulator (the orders of a rotor ARE locked to its
 * rotation), so a frequency change never clicks and never resets a phase.
 *
 * Per sample: one sin + one cos for the shaft phase (2X and 3X by the double/triple-angle
 * identities) and one sin for the blade-pass phase B·φ (mod 1, continuous because B is an integer).
 * Amplitudes are linearly interpolated from block targets; each order has its own slow random
 * amplitude drift (no pitch jitter) so the sum never sounds like a fixed synthesizer waveform.
 */
export class TurboRotorWhine {
  private phase = 0;
  private pulsePhase = 0;
  private readonly dt: number;
  private readonly nyq: number;
  private freq = 0;
  private readonly freqK: number;
  // interpolated amplitudes
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private aB = 0;
  private d1 = 0;
  private d2 = 0;
  private d3 = 0;
  private dB = 0;
  private am = 1;
  private dAm = 0;
  private pulseHz = 0;
  private pulseDepth = 0;
  private dPulseDepth = 0;
  private readonly noise: NarrowbandOrder[] | null;
  private readonly pulsing: boolean;
  // slow per-order drift (random walk through a low-pass)
  private readonly drift: OnePole[];
  private readonly driftVal = new Float64Array(4);
  out = 0;
  /** Last partial outputs (lab exports: 1X alone, harmonics, blade-pass). */
  out1 = 0;
  out2 = 0;
  out3 = 0;
  outH = 0;
  outB = 0;
  narrowbandOut = 0;

  constructor(
    sampleRate: number,
    private readonly blades: number,
    private readonly rng: Prng,
    private readonly modulationDepth: number,
    private readonly lowQuality: boolean,
    initialPhase = 0,
    private readonly texture?: RotorTextureConfig,
    private readonly coherent = 1,
    private readonly narrowband = 1,
    pulsing = !lowQuality,
  ) {
    this.dt = 1 / sampleRate;
    this.nyq = sampleRate / 2;
    // ≈ 12 ms frequency smoothing: removes the 120 Hz / network staircase without lagging the rotor
    this.freqK = 1 - Math.exp(-1 / (0.012 * sampleRate));
    this.phase = initialPhase;
    this.drift = [0, 1, 2, 3].map(() => new OnePole(sampleRate / 32, 3));
    this.noise = texture && narrowband > 0 ? Array.from({ length: lowQuality ? 3 : 4 }, () => new NarrowbandOrder()) : null;
    this.pulsing = pulsing;
  }

  reset(): void {
    this.a1 = this.a2 = this.a3 = this.aB = 0;
    this.freq = 0;
    this.am = 1;
  }

  /**
   * Block update. `shaftHz` is the current shaft frequency; `n` the block length in samples.
   * Targets are scaled by the per-partial anti-alias and onset gains at the block frequency.
   */
  setBlock(shaftHz: number, t: RotorTargets, n: number): void {
    const f = Math.max(this.freq, shaftHz);
    const d = this.texture?.amplitudeVariation ?? this.modulationDepth;
    for (let k = 0; k < 4; k++) this.driftVal[k] = 1 + d * 4 * this.drift[k]!.lowpass(this.rng.bipolar());
    const guard = this.texture ? 600 : 0;
    const g1 = t.g1 * lowGain(f) * partialGain(f + guard, this.nyq) * this.driftVal[0]!;
    const g2 = t.g2 * lowGain(2 * f) * partialGain(2 * f + guard, this.nyq) * this.driftVal[1]!;
    const g3 = this.lowQuality ? 0 : t.g3 * lowGain(3 * f) * partialGain(3 * f + guard, this.nyq) * this.driftVal[2]!;
    const gB = t.gB * lowGain(this.blades * f) * partialGain(this.blades * f + guard, this.nyq) * this.driftVal[3]!;
    const inv = 1 / Math.max(1, n);
    this.d1 = (g1 - this.a1) * inv;
    this.d2 = (g2 - this.a2) * inv;
    this.d3 = (g3 - this.a3) * inv;
    this.dB = (gB - this.aB) * inv;
    this.dAm = (t.am - this.am) * inv;
    this.pulseHz = t.pulseHz;
    const pulseDepth = this.pulsing ? t.pulseDepth : 0;
    if (this.texture) this.dPulseDepth = (pulseDepth - this.pulseDepth) * inv;
    else this.pulseDepth = pulseDepth;
    if (this.noise && this.texture) {
      for (let k = 0; k < this.noise.length; k++) {
        const order = k === this.noise.length - 1 ? this.blades : k + 1;
        const hz = Math.max(8, Math.min(145, order * f * this.texture.bandwidthRatio));
        this.noise[k]!.block(hz, Math.max(1, n), this.dt, this.rng);
      }
    }
  }

  process(shaftHz: number): number {
    this.freq += (shaftHz - this.freq) * this.freqK;
    const f = this.freq;
    this.phase += f * this.dt;
    this.phase -= Math.floor(this.phase);
    this.a1 += this.d1;
    this.a2 += this.d2;
    this.a3 += this.d3;
    this.aB += this.dB;
    this.am += this.dAm;
    this.pulseDepth += this.dPulseDepth;
    if (this.a1 + this.a2 + this.a3 + this.aB < 1e-9 && this.d1 <= 0 && this.d2 <= 0 && this.d3 <= 0 && this.dB <= 0) {
      // all partials silent (idle, engine off, faded above Nyquist): keep the phase, skip the trig
      this.out1 = this.out2 = this.out3 = this.outH = this.outB = this.narrowbandOut = this.out = 0;
      return 0;
    }
    const x = TWO_PI * this.phase;
    const s1 = Math.sin(x);
    const c1 = Math.cos(x);
    const s2 = 2 * s1 * c1;
    const s3 = s1 * (3 - 4 * s1 * s1);
    // blade pass = sin(blades · x): imaginary part of (c1 + i·s1)^blades, by repeated squaring
    let br = 1;
    let bi = 0;
    let pr = c1;
    let pi = s1;
    for (let k = this.blades; k > 0; k >>= 1) {
      if (k & 1) {
        const t = br * pr - bi * pi;
        bi = br * pi + bi * pr;
        br = t;
      }
      const t = pr * pr - pi * pi;
      pi = 2 * pr * pi;
      pr = t;
    }
    const sB = bi;
    let pulse = 1;
    if (this.pulseDepth > 0) {
      this.pulsePhase += this.pulseHz * this.dt;
      this.pulsePhase -= Math.floor(this.pulsePhase);
      // exhaust pulses load the turbine once per firing: a soft, asymmetric modulation
      const q = this.pulsePhase;
      // (half-sine lobes approximated by parabolas 4u(1 − u): same shape within 5%, no trig per sample)
      const u = q < 0.3 ? q / 0.3 : (q - 0.3) / 0.7;
      const parabola = 4 * u * (1 - u);
      const lobe = this.texture ? parabola * parabola : parabola;
      pulse = 1 + this.pulseDepth * (q < 0.3 ? lobe : -0.25 * lobe);
    }
    const g = this.am * pulse;
    if (this.texture) {
      const tone = this.texture.coherentToneMix * this.coherent;
      const tex = this.texture.narrowbandNoiseMix * this.narrowband;
      const depth = this.texture.phaseNoiseDepth;
      const noise = this.noise;
      const n1 = noise ? tex * noise[0]!.process(s1, c1, depth) : 0;
      const n2 = noise ? tex * noise[1]!.process(s2, 1 - 2 * s1 * s1, depth) : 0;
      const n3 = noise?.length === 4 ? tex * noise[2]!.process(s3, c1 * (4 * c1 * c1 - 3), depth) : 0;
      const nB = noise ? tex * noise[noise.length - 1]!.process(sB, br, depth) : 0;
      this.out1 = this.a1 * (tone * s1 + n1) * g;
      this.out2 = this.a2 * (tone * s2 + n2) * g;
      this.out3 = this.a3 * (tone * s3 + n3) * g;
      this.outB = this.aB * (tone * sB + nB) * g;
      this.narrowbandOut = (this.a1 * n1 + this.a2 * n2 + this.a3 * n3 + this.aB * nB) * g;
      this.outH = this.out2 + this.out3;
      this.out = this.out1 + this.outH + this.outB;
      return this.out;
    }
    this.out1 = this.a1 * s1 * g;
    this.out2 = this.a2 * s2 * g;
    this.out3 = this.a3 * s3 * g;
    this.outH = (this.a2 * s2 + this.a3 * s3) * g;
    this.outB = this.aB * sB * g;
    this.out = this.out1 + this.outH + this.outB;
    return this.out;
  }
}
