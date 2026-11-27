import type { Prng } from '../../../core/prng';
import { Biquad, OnePole } from '../Filters';
import type { BovVentType, ResolvedTurboProfile } from './TurboAcousticTypes';

/** Vent flow below which the valve is considered closed (physics `bovFlow`, 0..1). */
export const BOV_FLOW_GATE = 0.004;
/** Minimum boost (Pa) when the valve opens for an audible event (prevents events without pressure). */
export const BOV_MIN_BOOST_PA = 0.12e5;

/**
 * Blow-off / diverter valve sound, driven ONLY by the vent flow the physics computes (`bovFlow`):
 * no event is ever triggered by a gear change, the limiter or the throttle alone.
 *
 * - atmosphere: fast attack, a short pressure "body", the jet noise whose centre falls with the
 *   remaining pressure ("psssh" pitching down), a valve resonance with a small tonal component and
 *   a progressive decay (the profile's release);
 * - recirculating: the jet stays in the duct: low-passed, resonant inside the intake, slower
 *   attack and much less high frequency content (its own filters, not the atmospheric sound turned
 *   down);
 * - none: silent.
 *
 * The envelope follows the vent flow with asymmetric attack / release one-poles, so opening and
 * closing never click.
 */
export class BlowOffAcoustics {
  private readonly vent: BovVentType;
  private env = 0;
  private readonly ka: number;
  private readonly kr: number;
  private transient = 0;
  private readonly kTransient: number;
  private eventArmed = true;
  private eventGain = 0;
  // atmosphere
  private readonly jet: Biquad;
  private readonly bodyBp: Biquad;
  private readonly valve: Biquad;
  private readonly air: OnePole;
  private jetFc = 3000;
  // recirculating
  private readonly ductLp: Biquad;
  private readonly ductRes: Biquad;
  private readonly noiseScale: number;
  private counter = 0;
  events = 0;
  out = 0;

  constructor(
    sampleRate: number,
    private readonly p: ResolvedTurboProfile,
    private readonly rng: Prng,
    private readonly lowQuality: boolean,
  ) {
    this.vent = p.ventType;
    const b = p.blowOff;
    const atk = this.vent === 'recirculating' ? Math.max(b.attackMs, 8) : b.attackMs;
    this.ka = 1 - Math.exp(-1 / ((atk / 1000) * sampleRate));
    this.kr = 1 - Math.exp(-1 / ((b.releaseMs / 1000) * sampleRate));
    this.kTransient = Math.exp(-1 / (0.018 * sampleRate));
    this.jet = new Biquad(sampleRate).setBandpass(3000, 0.8);
    this.bodyBp = new Biquad(sampleRate).setBandpass(780, 1.3);
    this.valve = new Biquad(sampleRate).setBandpass(b.resonanceHz, 6);
    this.air = new OnePole(sampleRate, 5500);
    this.ductLp = new Biquad(sampleRate).setLowpass(1100, 0.8);
    this.ductRes = new Biquad(sampleRate).setBandpass(430, 2);
    this.noiseScale = Math.sqrt(sampleRate / 48000);
  }

  /**
   * @param bovFlow physics vent flow 0..1
   * @param boostNorm remaining charge pressure / max boost
   */
  process(bovFlow: number, boostNorm: number, boostPa: number): number {
    if (this.vent === 'none') {
      this.out = 0;
      return 0;
    }
    const open = bovFlow > BOV_FLOW_GATE;
    // an event needs pressure behind the valve when it opens
    if (open && this.eventArmed) {
      this.eventArmed = false;
      this.eventGain = boostPa > BOV_MIN_BOOST_PA ? Math.min(1.3, 0.55 + boostNorm) : 0;
      if (this.eventGain > 0) {
        this.transient = 1;
        this.events++;
      }
    } else if (!open) this.eventArmed = true; // a valve that closed opens again as a new event
    const target = open ? Math.min(1, bovFlow * 1.6) * this.eventGain : 0;
    this.env += (target - this.env) * (target > this.env ? this.ka : this.kr);
    if (this.env < 1e-6 && this.transient < 1e-4) {
      this.out = 0;
      this.transient = 0;
      return 0;
    }
    this.transient *= this.kTransient;
    const b = this.p.blowOff;
    const w = this.rng.bipolar() * this.noiseScale;
    let y: number;
    if (this.vent === 'atmosphere') {
      if ((this.counter++ & 31) === 0) {
        // jet centre follows the pressure left in the charge pipe: the hiss falls while venting
        const fc = 1400 + (2200 + 3200 * b.spectralColor) * Math.sqrt(Math.max(0, boostNorm));
        this.jetFc += (fc - this.jetFc) * 0.3;
        this.jet.setBandpass(this.jetFc, 0.8);
      }
      const jet = this.jet.process(w) * (0.6 + 0.4 * b.spectralColor);
      const body = this.bodyBp.process(w) * this.transient * 2.4;
      const valve = this.lowQuality ? 0 : this.valve.process(w) * b.tonalGain * 2.5;
      const air = this.lowQuality ? 0 : (w - this.air.lowpass(w)) * 0.35 * b.spectralColor;
      y = (jet + body + valve + air) * this.env;
    } else {
      // recirculated: the jet re-enters the compressor inlet, heard through the intake duct
      const duct = this.ductLp.process(w);
      const res = this.ductRes.process(w) * 1.6;
      y = (duct * 0.8 + res + this.bodyBp.process(w) * this.transient * 0.8) * this.env * 0.55;
    }
    this.out = y * b.gain;
    return this.out;
  }
}
