import type { Prng } from '../../../core/prng';
import { Biquad } from '../Filters';
import type { ResolvedTurboProfile } from './TurboAcousticTypes';
import { smoothstep } from './TurboRotorWhine';

export const FLUTTER_STATE = { INACTIVE: 0, ARMED: 1, PRESSURE_RELEASE: 2, OSCILLATING: 3, DECAYING: 4 } as const;
export type FlutterState = (typeof FLUTTER_STATE)[keyof typeof FLUTTER_STATE];

/** Block-rate inputs (interpolated telemetry and its filtered derivatives). */
export interface FlutterInput {
  shaftNorm: number;
  boostNorm: number;
  throttle: number;
  /** d(throttle)/dt (1/s). */
  throttleRate: number;
  bovFlow: number;
}

/** Thresholds of the state machine (exported for tests and docs). */
export const FLUTTER_TUNING = {
  armShaft: 0.3,
  armBoost: 0.25,
  armThrottle: 0.45,
  /** The throttle must be (nearly) closed and closing fast. */
  triggerThrottle: 0.2,
  triggerRate: -2.5,
  /** Re-opening the throttle above this ends the oscillation. */
  reopenThrottle: 0.35,
  maxPulses: 14,
  /** Pulses stop once they fall below this fraction of the first one. */
  floor: 0.06,
  /** Smallest initial energy that produces an audible event. */
  minEnergy: 0.02,
} as const;

/**
 * How much of the compressor's back-flow the fitted valve removes (0..1). An efficient valve
 * suppresses most of the flutter; a slow valve (long vent time) less. Acoustic estimate only.
 */
export function reliefCapacity(p: ResolvedTurboProfile): number {
  if (p.ventType === 'none') return 0;
  const base = p.ventType === 'recirculating' ? 0.9 : 0.85;
  const slow = Math.min(0.3, Math.max(0, (p.bovVentTimeS - 0.08) / 0.6));
  return base * (1 - slow);
}

/**
 * Compressor flutter ("stu-tu-tu-tu"): a reduced acoustic model of the transient back-flow
 * oscillation when the throttle snaps shut with pressure in the charge pipe.
 *
 * INACTIVE → ARMED (rotor speed, boost and open throttle) → PRESSURE_RELEASE (the first, bright
 * "ST" burst) → OSCILLATING (damped "TU" pulses whose rate follows the slowing rotor) → DECAYING →
 * INACTIVE. The initial energy depends on pressure, rotor speed and the valve's relief capacity;
 * each pulse keeps `damping` of the previous one, the series is bounded (`maxPulses`) and the
 * machine only re-arms after the throttle opens again — so the simplified physics that can hold
 * boost against a closed throttle never turns into an endless flutter. Opening the throttle or the
 * valve venting cuts the oscillation short.
 *
 * Acoustic only: no pressure, flow or durability effect.
 */
export class CompressorFlutter {
  state: FlutterState = FLUTTER_STATE.INACTIVE;
  private readonly relief: number;
  private e0 = 0;
  private amp = 0;
  private boostAtTrigger = 1;
  private pulses = 0;
  private untilNext = 0;
  private sinceStart = 0;
  private envDecay: number;
  private readonly dt: number;
  private pulseT = 1;
  private pulseAmp = 0;
  private stWeight = 1;
  private impulse = 0;
  private decayGain = 1;
  private readonly bodyRes: Biquad;
  private readonly lowRes: Biquad;
  private readonly attackBp: Biquad;
  private readonly noiseScale: number;
  private rate = 10;
  /** Amplitude modulation for the rotor tones (compressor stall on each back-flow pulse). */
  rotorAm = 1;
  /** Count of completed flutter events (tests, diagnostics). */
  events = 0;
  totalPulses = 0;
  out = 0;

  constructor(
    sampleRate: number,
    private readonly p: ResolvedTurboProfile,
    private readonly rng: Prng,
    private readonly lowQuality: boolean,
  ) {
    this.dt = 1 / sampleRate;
    this.relief = reliefCapacity(p);
    this.envDecay = 0.03;
    this.bodyRes = new Biquad(sampleRate).setBandpass(p.flutter.bodyHz, 2.2);
    this.lowRes = new Biquad(sampleRate).setBandpass(p.flutter.bodyHz * 0.55, 2);
    this.attackBp = new Biquad(sampleRate).setBandpass(p.flutter.attackHz, 1.2);
    this.noiseScale = Math.sqrt(sampleRate / 48000);
  }

  get enabled(): boolean {
    return this.p.flutter.enabled;
  }

  /** Block update of the state machine (blockS = block duration). */
  block(x: FlutterInput, blockS: number): void {
    const T = FLUTTER_TUNING;
    const f = this.p.flutter;
    switch (this.state) {
      case FLUTTER_STATE.INACTIVE:
        if (f.enabled && x.shaftNorm > T.armShaft && x.boostNorm > T.armBoost && x.throttle > T.armThrottle) this.state = FLUTTER_STATE.ARMED;
        break;
      case FLUTTER_STATE.ARMED: {
        if (x.boostNorm < T.armBoost * 0.5 || x.shaftNorm < T.armShaft * 0.7) {
          this.state = FLUTTER_STATE.INACTIVE;
          break;
        }
        if (x.throttle < T.triggerThrottle && x.throttleRate < T.triggerRate) {
          const e0 = f.gain * Math.pow(Math.min(1.3, x.boostNorm), 1.2) * smoothstep(0.25, 0.75, x.shaftNorm) * (1 - this.relief);
          if (e0 < T.minEnergy) {
            // the valve takes the back-flow: no audible flutter, wait for the next re-arm
            this.state = FLUTTER_STATE.DECAYING;
            this.decayGain = 0;
            break;
          }
          this.e0 = e0;
          this.amp = e0;
          this.boostAtTrigger = Math.max(0.05, x.boostNorm);
          this.pulses = 0;
          this.sinceStart = 0;
          this.stWeight = 1;
          this.decayGain = 1;
          this.state = FLUTTER_STATE.PRESSURE_RELEASE;
          this.events++;
          this.startPulse(x.shaftNorm);
        }
        break;
      }
      case FLUTTER_STATE.PRESSURE_RELEASE:
      case FLUTTER_STATE.OSCILLATING: {
        this.sinceStart += blockS;
        if (x.throttle > T.reopenThrottle) {
          this.state = FLUTTER_STATE.DECAYING;
          break;
        }
        this.untilNext -= blockS;
        if (this.untilNext <= 0) {
          if (this.state === FLUTTER_STATE.PRESSURE_RELEASE) this.state = FLUTTER_STATE.OSCILLATING;
          // remaining pressure and the valve's venting both drain the oscillation
          const pressure = Math.sqrt(Math.min(1, Math.max(0, x.boostNorm / this.boostAtTrigger)));
          this.amp *= f.damping * (1 - 0.6 * Math.min(1, x.bovFlow * 2));
          const a = this.amp * (0.4 + 0.6 * pressure);
          if (this.pulses >= T.maxPulses || a < this.e0 * T.floor) {
            this.state = FLUTTER_STATE.DECAYING;
            break;
          }
          // the bright "ST" belongs to the first release; later pulses are mostly the duct "TU"
          this.stWeight = this.pulses <= 1 ? 0.35 : this.stWeight * 0.75;
          this.startPulse(x.shaftNorm, a);
        }
        break;
      }
      case FLUTTER_STATE.DECAYING:
        this.decayGain *= Math.exp(-blockS / 0.025);
        // stays silent while the throttle is closed: it re-arms only once the throttle opens again
        if (x.throttle > T.armThrottle) this.state = FLUTTER_STATE.INACTIVE;
        break;
    }
  }

  private startPulse(shaftNorm: number, amplitude = this.amp): void {
    const f = this.p.flutter;
    // the pulse rate follows the (slowing) rotor and varies slightly from pulse to pulse
    this.rate = f.basePulseRateHz * (0.8 + 0.35 * Math.min(1, shaftNorm)) * (1 + 0.08 * this.rng.bipolar());
    this.untilNext = 1 / this.rate;
    this.envDecay = Math.min(0.04, 0.32 / this.rate);
    this.pulseT = 0;
    this.pulseAmp = amplitude;
    this.impulse = 1;
    this.pulses++;
    this.totalPulses++;
  }

  process(): number {
    const active = this.state === FLUTTER_STATE.PRESSURE_RELEASE || this.state === FLUTTER_STATE.OSCILLATING || this.state === FLUTTER_STATE.DECAYING;
    if (!active || this.pulseT > 0.2) {
      this.rotorAm = 1;
      this.out = 0;
      if (active) this.pulseT += this.dt;
      return 0;
    }
    this.pulseT += this.dt;
    const t = this.pulseT;
    // alpha-function pulse: 3 ms rise, exponential fall
    const env = (t < 0.003 ? t / 0.003 : Math.exp(-(t - 0.003) / this.envDecay)) * this.pulseAmp * (this.state === FLUTTER_STATE.DECAYING ? this.decayGain : 1);
    const w = this.rng.bipolar() * this.noiseScale;
    // noise burst + a kick at the pulse start into the duct resonators (the "TU" body)
    const src = w + this.impulse * 40;
    this.impulse = 0;
    let y = this.bodyRes.process(src) * 4.5;
    if (!this.lowQuality) y += this.lowRes.process(src) * 2.6;
    y += this.attackBp.process(w) * this.stWeight * 1.4;
    y *= env * 2.5;
    this.rotorAm = 1 - 0.55 * Math.min(1, env / Math.max(1e-6, this.e0));
    this.out = y;
    return y;
  }
}
