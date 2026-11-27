import { Biquad } from '../Filters';
import type { ResolvedTurboProfile } from './TurboAcousticTypes';

/**
 * Acoustic path from the compressor inlet to the outside: a few resonant bands (profile, shifted by
 * the charge-air volume in the resolver) added to the dry signal, then the high-frequency
 * attenuation of the intake path (stock airbox ≈ 3 kHz corner … open inlet ≈ 14 kHz).
 *
 * Only the turbo sources that radiate through the inlet pass here (rotor, whoosh, flutter,
 * recirculated valve). The engine's own intake channel (EngineAcoustics) models the induction
 * pulses and the airbox separately, so nothing is attenuated twice; the atmospheric valve and the
 * wastegate radiate directly and bypass this path.
 */
export class TurboDuctResonance {
  private readonly res: Biquad[];
  private readonly gains: number[];
  private readonly lp1: Biquad;
  private readonly lp2: Biquad;
  private readonly dryGain: number;
  private readonly bypassLp: boolean;
  out = 0;

  constructor(sampleRate: number, p: ResolvedTurboProfile, lowQuality: boolean, enabled = true) {
    const list = enabled ? p.resonance.slice(0, lowQuality ? 1 : 3) : [];
    this.res = list.map((r) => new Biquad(sampleRate).setBandpass(r.frequencyHz, r.q));
    this.gains = list.map((r) => r.gain);
    const att = Math.min(1, Math.max(0, p.intakeAttenuation));
    // corner: 14 kHz with no attenuation → ≈ 3 kHz for the strongest airbox
    const fc = 14000 * Math.pow(3000 / 14000, att);
    this.lp1 = new Biquad(sampleRate).setLowpass(fc, 0.6);
    this.lp2 = new Biquad(sampleRate).setLowpass(fc * 1.4, 0.7);
    this.bypassLp = att < 0.02;
    // broadband loss of the box itself (≈ −4.5 dB at full attenuation)
    this.dryGain = 1 - 0.4 * att;
  }

  process(x: number): number {
    let y = x;
    for (let i = 0; i < this.res.length; i++) y += this.res[i]!.process(x) * this.gains[i]!;
    if (!this.bypassLp) y = this.lp2.process(this.lp1.process(y));
    this.out = y * this.dryGain;
    return this.out;
  }
}
