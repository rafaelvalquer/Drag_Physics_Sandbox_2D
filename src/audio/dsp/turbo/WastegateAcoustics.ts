import type { Prng } from '../../../core/prng';
import { Biquad, OnePole } from '../Filters';
import type { ResolvedTurboProfile } from './TurboAcousticTypes';
import { smoothstep } from './TurboRotorWhine';

/**
 * Normalized shaft speed at which the physics wastegate caps the rotor: the reduced-order
 * Turbocharger limits the shaft target to √(maxBoost / (maxBoost · 1.3)) (overspeed factor 1.3).
 * The physics does not output a valve position; this constant lets the sound ESTIMATE when the
 * gate is regulating (tests check it against Turbocharger.steadyBoost).
 */
export const WASTEGATE_SHAFT_CAP = Math.sqrt(1 / 1.3);

/** Passive estimate (0..1) of the wastegate opening from shaft speed, boost and load. */
export function estimateWastegateOpening(shaftNorm: number, boostNorm: number, load: number): number {
  return smoothstep(0.93, 0.995, shaftNorm / WASTEGATE_SHAFT_CAP) * smoothstep(0.7, 0.95, boostNorm) * Math.min(1, Math.max(0, load));
}

/**
 * Exhaust gas bypassing the turbine. The sound depends on the topology of the fitted hardware:
 * - internal: the bypass stays inside the turbine housing — a faint, low-passed hiss;
 * - external-recirculated: separate valve plumbed back into the downpipe — a darker rush that
 *   follows the exhaust pulses;
 * - external-open ("screamer"): its own outlet — a raspy, pulsing exhaust-side noise under load.
 * Driven by the opening estimate × turbine gas flow (EGT shifts the band slightly: hotter gas =
 * higher speed of sound). It is an exhaust-side, under-load sound, never a throttle-lift event.
 */
export class WastegateAcoustics {
  private readonly band: Biquad;
  private readonly lp: OnePole;
  private readonly hp: OnePole;
  private gain = 0;
  private dGain = 0;
  private pulsePhase = 0;
  private pulseHz = 0;
  private readonly dt: number;
  private readonly noiseScale: number;
  private fc: number;
  out = 0;

  constructor(
    sampleRate: number,
    private readonly p: ResolvedTurboProfile,
    private readonly rng: Prng,
    private readonly lowQuality: boolean,
  ) {
    this.dt = 1 / sampleRate;
    this.fc = p.wastegateType === 'external-open' ? 1500 : p.wastegateType === 'external-recirculated' ? 900 : 1800;
    this.band = new Biquad(sampleRate).setBandpass(this.fc, p.wastegateType === 'external-open' ? 0.9 : 0.8);
    this.lp = new OnePole(sampleRate, p.wastegateType === 'internal' ? 1500 : 3000);
    this.hp = new OnePole(sampleRate, 4000);
    this.noiseScale = Math.sqrt(sampleRate / 48000);
  }

  /** @param opening estimate 0..1, turbineFlow estimate 0..1, firingHz exhaust pulse rate */
  setBlock(opening: number, turbineFlow: number, exhaustTempK: number, firingHz: number, n: number): void {
    const type = this.p.wastegateType;
    const typeGain = type === 'external-open' ? 1 : type === 'external-recirculated' ? 0.35 : 0.12;
    const target = this.lowQuality && type === 'internal' ? 0 : this.p.wastegate.gain * typeGain * opening * Math.min(1.2, turbineFlow);
    this.dGain = (target - this.gain) / Math.max(1, n);
    this.pulseHz = firingHz;
    const base = type === 'external-open' ? 1500 : type === 'external-recirculated' ? 900 : 1800;
    const fc = base * Math.sqrt(Math.max(400, exhaustTempK) / 900);
    this.fc += (fc - this.fc) * 0.2;
    if (target > 1e-6 || this.gain > 1e-6) this.band.setBandpass(this.fc, type === 'external-open' ? 0.9 : 0.8);
  }

  process(): number {
    this.gain += this.dGain;
    if (this.gain < 1e-6) {
      this.out = 0;
      return 0;
    }
    const w = this.rng.bipolar() * this.noiseScale;
    this.pulsePhase += this.pulseHz * this.dt;
    this.pulsePhase -= Math.floor(this.pulsePhase);
    const type = this.p.wastegateType;
    let y: number;
    if (type === 'external-open') {
      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(2 * Math.PI * this.pulsePhase)) ** 2;
      y = (this.band.process(w) * 1.6 + (this.lowQuality ? 0 : (w - this.hp.lowpass(w)) * 0.3)) * pulse;
    } else if (type === 'external-recirculated') {
      const pulse = 0.7 + 0.3 * Math.sin(2 * Math.PI * this.pulsePhase);
      y = this.lp.lowpass(this.band.process(w)) * 1.8 * pulse;
    } else {
      y = this.lp.lowpass(this.band.process(w)) * 1.2;
    }
    this.out = y * this.gain;
    return this.out;
  }
}
