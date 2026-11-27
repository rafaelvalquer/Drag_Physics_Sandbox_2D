import type { Prng } from '../../../core/prng';
import { Biquad, OnePole } from '../Filters';
import type { TurboAcousticProfile } from './TurboAcousticTypes';
import { smoothstep } from './TurboRotorWhine';

/** Block-rate operating point of the compressor (acoustic estimates, see TurboAcousticEstimates). */
export interface WhooshInput {
  shaftNorm: number;
  boostNorm: number;
  flow: number;
  instability: number;
}

/**
 * Aerodynamic compressor noise in three moving bands (body, mid turbulence, brightness) plus a
 * low "near instability" band. Replaces the single fixed 5.2 kHz noise band of the legacy model.
 *
 * Levels follow air flow, rotor speed and pressure together (not boost alone); centre frequencies
 * move with rotor speed and flow inside the profile's calibration ranges. Filters are retuned per
 * block from smoothed values; gains are interpolated per sample. The noise drive is scaled by
 * √(fs/48 kHz) so band-limited levels match across sample rates.
 */
export class CompressorWhoosh {
  private readonly body: Biquad;
  private readonly turb: Biquad;
  private readonly high: Biquad;
  private readonly unstable: Biquad;
  private readonly pink: OnePole;
  private gb = 0;
  private gt = 0;
  private gh = 0;
  private gu = 0;
  private db = 0;
  private dt = 0;
  private dh = 0;
  private du = 0;
  private fb: number;
  private ft: number;
  private fh: number;
  private readonly noiseScale: number;
  out = 0;

  constructor(
    sampleRate: number,
    private readonly p: TurboAcousticProfile,
    private readonly rng: Prng,
    private readonly lowQuality: boolean,
  ) {
    const c = p.compressor;
    this.fb = c.bodyHz[0];
    this.ft = c.turbulenceHz[0];
    this.fh = c.highHz[0];
    this.body = new Biquad(sampleRate).setBandpass(this.fb, 1.1);
    this.turb = new Biquad(sampleRate).setBandpass(this.ft, 1.2);
    this.high = new Biquad(sampleRate).setBandpass(this.fh, 1);
    this.unstable = new Biquad(sampleRate).setBandpass(520, 1.6);
    this.pink = new OnePole(sampleRate, 2500);
    this.noiseScale = Math.sqrt(sampleRate / 48000);
  }

  setBlock(x: WhooshInput, n: number): void {
    const c = this.p.compressor;
    const s = x.shaftNorm;
    const flow = x.flow;
    const pos = Math.min(1, 0.35 * s + 0.45 * flow + 0.2 * x.boostNorm);
    const k = 0.35; // smoothing of the centre frequencies per block
    this.fb += (c.bodyHz[0] + (c.bodyHz[1] - c.bodyHz[0]) * pos - this.fb) * k;
    this.ft += (c.turbulenceHz[0] + (c.turbulenceHz[1] - c.turbulenceHz[0]) * pos - this.ft) * k;
    this.fh += (c.highHz[0] + (c.highHz[1] - c.highHz[0]) * Math.min(1, s * 1.1) - this.fh) * k;
    this.body.setBandpass(this.fb, 1.1);
    this.turb.setBandpass(this.ft, 1.2);
    if (!this.lowQuality) this.high.setBandpass(this.fh, 1);
    const tilt = c.spectralTilt;
    const work = smoothstep(0, 1, 0.55 * flow + 0.45 * x.boostNorm);
    const gb = c.bodyGain * (1 - 0.3 * tilt) * flow * (0.35 + 0.65 * work) * smoothstep(0.05, 0.35, s);
    const gt = c.turbulenceGain * flow * s * (0.4 + 0.6 * work);
    const gh = this.lowQuality ? 0 : c.highFrequencyGain * (1 + 0.5 * tilt) * s * s * (0.06 + 0.94 * flow);
    const gu = c.instabilityGain * x.instability * s;
    const inv = 1 / Math.max(1, n);
    this.db = (gb - this.gb) * inv;
    this.dt = (gt - this.gt) * inv;
    this.dh = (gh - this.gh) * inv;
    this.du = (gu - this.gu) * inv;
  }

  process(): number {
    this.gb += this.db;
    this.gt += this.dt;
    this.gh += this.dh;
    this.gu += this.du;
    if (this.gb + this.gt + this.gh + this.gu < 1e-7) {
      this.out = 0;
      return 0;
    }
    const w = this.rng.bipolar() * this.noiseScale;
    // gently pinked drive for the body and the instability band (less hiss, more "air")
    const pk = this.pink.lowpass(w) * 2.2;
    let y = this.body.process(pk) * this.gb + this.turb.process(w) * this.gt;
    if (!this.lowQuality) y += this.high.process(w) * this.gh;
    if (this.gu > 1e-6) y += this.unstable.process(pk) * this.gu;
    this.out = y;
    return y;
  }
}
