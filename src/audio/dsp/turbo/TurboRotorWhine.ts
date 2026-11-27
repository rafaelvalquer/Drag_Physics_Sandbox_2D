import type { Prng } from '../../../core/prng';
import { OnePole } from '../Filters';

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
  // slow per-order drift (random walk through a low-pass)
  private readonly drift: OnePole[];
  private readonly driftVal = new Float64Array(4);
  out = 0;
  /** Last partial outputs (lab exports: 1X alone, harmonics, blade-pass). */
  out1 = 0;
  outH = 0;
  outB = 0;

  constructor(
    sampleRate: number,
    private readonly blades: number,
    private readonly rng: Prng,
    private readonly modulationDepth: number,
    private readonly lowQuality: boolean,
    initialPhase = 0,
  ) {
    this.dt = 1 / sampleRate;
    this.nyq = sampleRate / 2;
    // ≈ 12 ms frequency smoothing: removes the 120 Hz / network staircase without lagging the rotor
    this.freqK = 1 - Math.exp(-1 / (0.012 * sampleRate));
    this.phase = initialPhase;
    this.drift = [0, 1, 2, 3].map(() => new OnePole(sampleRate / 32, 3));
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
    const d = this.modulationDepth;
    for (let k = 0; k < 4; k++) this.driftVal[k] = 1 + d * 4 * this.drift[k]!.lowpass(this.rng.bipolar());
    const g1 = t.g1 * lowGain(f) * partialGain(f, this.nyq) * this.driftVal[0]!;
    const g2 = t.g2 * lowGain(2 * f) * partialGain(2 * f, this.nyq) * this.driftVal[1]!;
    const g3 = this.lowQuality ? 0 : t.g3 * lowGain(3 * f) * partialGain(3 * f, this.nyq) * this.driftVal[2]!;
    const gB = t.gB * lowGain(this.blades * f) * partialGain(this.blades * f, this.nyq) * this.driftVal[3]!;
    const inv = 1 / Math.max(1, n);
    this.d1 = (g1 - this.a1) * inv;
    this.d2 = (g2 - this.a2) * inv;
    this.d3 = (g3 - this.a3) * inv;
    this.dB = (gB - this.aB) * inv;
    this.dAm = (t.am - this.am) * inv;
    this.pulseHz = t.pulseHz;
    this.pulseDepth = this.lowQuality ? 0 : t.pulseDepth;
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
    if (this.a1 + this.a2 + this.a3 + this.aB < 1e-9 && this.d1 <= 0 && this.d2 <= 0 && this.d3 <= 0 && this.dB <= 0) {
      // all partials silent (idle, engine off, faded above Nyquist): keep the phase, skip the trig
      this.out1 = this.outH = this.outB = this.out = 0;
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
      const lobe = 4 * u * (1 - u);
      pulse = 1 + this.pulseDepth * (q < 0.3 ? lobe : -0.25 * lobe);
    }
    const g = this.am * pulse;
    this.out1 = this.a1 * s1 * g;
    this.outH = (this.a2 * s2 + this.a3 * s3) * g;
    this.outB = this.aB * sB * g;
    this.out = this.out1 + this.outH + this.outB;
    return this.out;
  }
}
