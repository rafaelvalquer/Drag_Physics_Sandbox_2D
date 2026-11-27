import { Prng } from '../../core/prng';
import type { AcousticVehicleConfig } from './AcousticConfig';
import { Biquad, OnePole, ParamSmoother } from './Filters';
import { LegacyTurboAcoustics } from './turbo/LegacyTurboAcoustics';
import { TurboAcoustics } from './turbo/TurboAcoustics';

const TWO_PI = 2 * Math.PI;

/** Per-sample control values for the auxiliary sources. */
export interface AuxControl {
  omega: number;
  throttle: number;
  boostPa: number;
  turboShaftRpm: number;
  /** Second rotor of a parallel-twin turbo (absent / 0: single turbo). */
  turboShaftRpm2?: number;
  bovFlow: number;
  vehicleSpeed: number;
  wheelSlipSpeed: number;
  tireLoadN: number;
  gearboxOutputOmega: number;
  clutchSlipOmega: number;
  transmissionTorque: number;
  gear: number;
  gearChanged: boolean;
  /** Engine load 0..1 (turbo flow estimates; default: throttle). */
  load?: number;
  exhaustTempK?: number;
  /** Engine burning (default true). */
  combustion?: boolean;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Samples between filter retunes of the noise models (a power of two). */
const CONTROL_BLOCK = 32;

/**
 * Calibratable shape of the tyre and wind noise (raw/physical scale, before CHANNEL_NORM and the
 * per-car gains). Measured with scripts/audio-noise-lab.ts.
 */
export interface NoiseTuning {
  /** Wind: level = windMax · (1 − exp(−(v/windRefMs)^windExp)). */
  windMax: number;
  windRefMs: number;
  windExp: number;
  /** Wind low-pass corner at standstill and at windBwSpeedMs (Hz); opens linearly in between. */
  windLpMinHz: number;
  windLpMaxHz: number;
  windBwSpeedMs: number;
  /** Relative depth of the slow (≈ 1–2 Hz) gusts. */
  windGust: number;
  /** Rolling: level = rollMax · (1 − exp(−v/rollTauMs)) · √(load/4 kN). */
  rollMax: number;
  rollTauMs: number;
  rollLpMinHz: number;
  rollLpPerMs: number;
  /** Squeal gates: smoothstep(ratioLo, ratioHi, slipRatio) · smoothstep(slipLo, slipHi, slipSpeed). */
  slipRatioLo: number;
  slipRatioHi: number;
  slipSpeedLo: number;
  slipSpeedHi: number;
  /** Squeal level (tonal part) and scrub (broadband low/mid part) at full slip. */
  squealGain: number;
  scrubGain: number;
}

export const DEFAULT_NOISE_TUNING: Readonly<NoiseTuning> = {
  windMax: 6,
  windRefMs: 70,
  windExp: 1.8,
  windLpMinHz: 260,
  windLpMaxHz: 1300,
  windBwSpeedMs: 85,
  windGust: 0.18,
  rollMax: 1.5,
  rollTauMs: 30,
  rollLpMinHz: 320,
  rollLpPerMs: 5,
  slipRatioLo: 0.05,
  slipRatioHi: 0.22,
  slipSpeedLo: 1,
  slipSpeedHi: 4,
  squealGain: 1.5,
  scrubGain: 0.3,
};

/**
 * Non-engine sources of a vehicle (all new code, no third-party origin):
 * - turbo: delegated to Turbo Acoustics 2.0 (src/audio/dsp/turbo/TurboAcoustics.ts) or, for the
 *   A/B comparison, to the legacy model (turbo/LegacyTurboAcoustics.ts); each has its own noise
 *   generator, independent of the transmission noise;
 * - tyres: two separate sources – continuous rolling noise (low/mid-weighted filtered noise whose
 *   level saturates with speed) and skid squeal (stick–slip narrow-band noise + scrub) gated by
 *   BOTH the slip ratio |slip|/max(|v|, 2) and the absolute slip speed with soft thresholds, so the
 *   small, normal wheel-speed/ground-speed mismatch at high speed never squeals;
 * - transmission: gear mesh whine at input-shaft speed × teeth, ∝ √|torque|, clutch slip noise
 *   ∝ dissipated power, engagement clunk on a gear change;
 * - environment: aerodynamic noise – steeply low-passed, gently gusting noise whose level follows a
 *   calibratable saturating power curve of speed and whose bandwidth opens only slowly.
 * Gains and filter frequencies are smoothed per sample (filters are retuned every CONTROL_BLOCK
 * samples without allocating) and the noise drive is scaled so band-limited levels match at
 * 44.1 and 48 kHz.
 * Phase accumulators keep every tone continuous when its frequency changes.
 */
export class AuxAcoustics {
  private readonly dt: number;
  private readonly nyq: number;
  private readonly rng: Prng;
  /** Separate stream for the tyre/wind noise so retuning them never changes the clunk and turbo randomness. */
  private readonly noiseRng: Prng;
  /** Turbo Acoustics 2.0 voice (null without turbo or in legacy mode). */
  readonly turbo: TurboAcoustics | null;
  /** Legacy turbo model (A/B comparison only). */
  readonly legacyTurbo: LegacyTurboAcoustics | null;
  private readonly turboCtl = { shaftRpm: 0, shaftRpm2: 0, boostPa: 0, throttle: 0, engineLoad: 0, bovFlow: 0, omega: 0, exhaustTempK: 700, engineRunning: true };
  private readonly teeth: number;
  private readonly mech: number;
  private readonly gearRatios: number[];
  private gearPhase = 0;
  private readonly squealBp1: Biquad;
  private readonly squealBp2: Biquad;
  private readonly rollLp: Biquad;
  private readonly rollRumble: Biquad;
  private readonly rollHp: OnePole;
  private readonly scrubLp: Biquad;
  private readonly tune: NoiseTuning;
  private readonly noiseScale: number;
  private readonly windGain: ParamSmoother;
  private readonly windFc: ParamSmoother;
  private readonly rollGain: ParamSmoother;
  private readonly rollFc: ParamSmoother;
  private readonly slipAmt: ParamSmoother;
  private readonly squealF1: ParamSmoother;
  private readonly squealF2: ParamSmoother;
  private readonly gustLp: OnePole;
  private windTarget = 0;
  private windFcTarget = 0;
  private rollTarget = 0;
  private rollFcTarget = 0;
  private slipTarget = 0;
  private squealT1 = 980;
  private squealT2 = 2050;
  private readonly clutchBp: Biquad;
  private readonly clunkLow: Biquad;
  private readonly clunkMid: Biquad;
  private readonly windLp: Biquad;
  private readonly windLp2: OnePole;
  private readonly windHp: OnePole;
  private clunk = 0;
  private squealDrift = 0;
  private slowCounter = 0;
  turboOut = 0;
  tireOut = 0;
  transmissionOut = 0;
  environmentOut = 0;
  /** The two parts of `tireOut`, exposed for diagnostics and tests. */
  tireRollOut = 0;
  tireSlipOut = 0;

  constructor(sampleRate: number, cfg: AcousticVehicleConfig, tuning: Partial<NoiseTuning> = {}) {
    this.tune = { ...DEFAULT_NOISE_TUNING, ...tuning };
    // equal band-limited noise power at every sample rate (white PSD ∝ σ²/fs)
    this.noiseScale = Math.sqrt(sampleRate / 48000);
    this.windGain = new ParamSmoother(sampleRate, 0.06, 0.12);
    this.windFc = new ParamSmoother(sampleRate, 0.15, 0.15, this.tune.windLpMinHz);
    this.rollGain = new ParamSmoother(sampleRate, 0.05, 0.1);
    this.rollFc = new ParamSmoother(sampleRate, 0.15, 0.15, this.tune.rollLpMinHz);
    this.slipAmt = new ParamSmoother(sampleRate, 0.03, 0.15);
    this.squealF1 = new ParamSmoother(sampleRate, 0.2, 0.2, 980);
    this.squealF2 = new ParamSmoother(sampleRate, 0.2, 0.2, 2050);
    this.gustLp = new OnePole(sampleRate, 1.4);
    this.dt = 1 / sampleRate;
    this.nyq = sampleRate / 2;
    this.rng = new Prng(cfg.seed * 104729 + 3);
    this.noiseRng = new Prng(cfg.seed * 7919 + 11);
    const t = cfg.engine.induction === 'turbo' ? cfg.engine.turbo : undefined;
    const legacy = !!t && cfg.turboModel === 'legacy';
    this.turbo = t && !legacy ? new TurboAcoustics(sampleRate, cfg) : null;
    this.legacyTurbo = t && legacy
      ? new LegacyTurboAcoustics(sampleRate, cfg.seed * 104729 + 17, t.compressorBlades, t.layout === 'parallel-twin', t.bovEnabled, t.bovVent === 'recirculating')
      : null;
    this.teeth = cfg.acoustic.gearTeeth;
    this.mech = cfg.acoustic.mechanicalNoise;
    this.gearRatios = cfg.gearRatios;
    this.squealBp1 = new Biquad(sampleRate).setBandpass(1050, 9);
    this.squealBp2 = new Biquad(sampleRate).setBandpass(2150, 7);
    this.rollLp = new Biquad(sampleRate).setLowpass(this.tune.rollLpMinHz, 0.7);
    this.rollRumble = new Biquad(sampleRate).setBandpass(130, 0.9);
    this.rollHp = new OnePole(sampleRate, 35);
    this.scrubLp = new Biquad(sampleRate).setLowpass(1600, 0.7);
    this.clutchBp = new Biquad(sampleRate).setBandpass(1700, 1.5);
    this.clunkLow = new Biquad(sampleRate).setBandpass(95, 6);
    this.clunkMid = new Biquad(sampleRate).setBandpass(430, 5);
    this.windLp = new Biquad(sampleRate).setLowpass(this.tune.windLpMinHz, 0.6);
    this.windLp2 = new OnePole(sampleRate, this.tune.windLpMinHz * 2);
    this.windHp = new OnePole(sampleRate, 45);
  }

  process(c: AuxControl): void {
    const dt = this.dt;
    const rng = this.rng;
    const nrng = this.noiseRng;
    const v = Math.abs(c.vehicleSpeed);
    const tn = this.tune;
    // block-rate targets and filter retunes (only smoothed values reach the filters, so nothing steps)
    if ((this.slowCounter++ & (CONTROL_BLOCK - 1)) === 0) {
      const loadF = Math.sqrt(Math.max(0, c.tireLoadN) / 4000);
      // wind: saturating power curve, bandwidth opening with speed
      this.windTarget = v > 0.5 ? tn.windMax * (1 - Math.exp(-Math.pow(v / tn.windRefMs, tn.windExp))) : 0;
      this.windFcTarget = tn.windLpMinHz + (tn.windLpMaxHz - tn.windLpMinHz) * Math.min(1, v / tn.windBwSpeedMs);
      // rolling: level saturates with speed, brighter only slowly
      this.rollTarget = v > 0.05 ? tn.rollMax * (1 - Math.exp(-v / tn.rollTauMs)) * loadF : 0;
      this.rollFcTarget = tn.rollLpMinHz + tn.rollLpPerMs * Math.min(v, 90);
      // squeal gate: slip ratio AND absolute slip speed (soft thresholds)
      const slip = Math.abs(c.wheelSlipSpeed);
      const ratio = slip / Math.max(v, 2);
      this.slipTarget = smoothstep(tn.slipRatioLo, tn.slipRatioHi, ratio) * smoothstep(tn.slipSpeedLo, tn.slipSpeedHi, slip) * loadF;
      this.squealDrift += (nrng.bipolar() * 0.5 - this.squealDrift) * 0.05;
      const sp = Math.min(slip, 12);
      this.squealT1 = 980 + sp * 18 + this.squealDrift * 60;
      this.squealT2 = 2050 + sp * 30 + this.squealDrift * 90;
      this.windLp.setLowpass(this.windFc.value, 0.6);
      this.windLp2.setCutoff(this.windFc.value * 2);
      this.rollLp.setLowpass(this.rollFc.value, 0.7);
      this.squealBp1.setBandpass(this.squealF1.value, 8);
      this.squealBp2.setBandpass(this.squealF2.value, 6);
    }
    const windG = this.windGain.next(this.windTarget);
    this.windFc.next(this.windFcTarget);
    const rollG = this.rollGain.next(this.rollTarget);
    this.rollFc.next(this.rollFcTarget);
    const slipG = this.slipAmt.next(this.slipTarget);
    this.squealF1.next(this.squealT1);
    this.squealF2.next(this.squealT2);
    const ns = this.noiseScale;

    // ---- turbo
    let turbo = 0;
    if (this.turbo) {
      const tc = this.turboCtl;
      tc.shaftRpm = c.turboShaftRpm;
      tc.shaftRpm2 = c.turboShaftRpm2 ?? 0;
      tc.boostPa = c.boostPa;
      tc.throttle = c.throttle;
      tc.engineLoad = c.load ?? c.throttle;
      tc.bovFlow = c.bovFlow;
      tc.omega = c.omega;
      tc.exhaustTempK = c.exhaustTempK ?? 700;
      tc.engineRunning = c.combustion ?? true;
      turbo = this.turbo.process(tc);
    } else if (this.legacyTurbo) turbo = this.legacyTurbo.process(c.turboShaftRpm, c.turboShaftRpm2, c.boostPa, c.throttle, c.bovFlow);
    this.turboOut = turbo;

    // ---- tyres: continuous rolling noise + (separate) skid squeal
    let roll = 0;
    if (rollG > 1e-5) {
      const nz = nrng.bipolar() * ns;
      roll = this.rollHp.highpass(this.rollLp.process(nz) + this.rollRumble.process(nz) * 0.9) * rollG;
    }
    let skid = 0;
    if (slipG > 1e-4) {
      const nz = nrng.bipolar() * ns;
      skid = ((this.squealBp1.process(nz) * 2.2 + this.squealBp2.process(nz) * 1.1) * tn.squealGain + this.scrubLp.process(nz) * tn.scrubGain) * slipG;
    }
    this.tireRollOut = roll;
    this.tireSlipOut = skid;
    this.tireOut = roll + skid;

    // ---- transmission
    let trans = 0;
    const g = c.gear;
    const ratio = g >= 1 && g <= this.gearRatios.length ? this.gearRatios[g - 1]! : 0;
    const inputOmega = Math.abs(c.gearboxOutputOmega) * ratio;
    const torque = Math.abs(c.transmissionTorque);
    if (ratio > 0 && inputOmega > 1) {
      const f = (inputOmega / TWO_PI) * this.teeth;
      const fade = 1 - smoothstep(this.nyq * 0.75, this.nyq * 0.9, f);
      this.gearPhase += f * dt;
      this.gearPhase -= Math.floor(this.gearPhase);
      // lower gears (higher ratios) are louder; straight-cut style mesh
      const gearW = 0.4 + 0.6 * Math.min(1, ratio / 3.5);
      trans += Math.sin(TWO_PI * this.gearPhase) * Math.sqrt(torque / 300) * gearW * fade * 0.12 * this.mech;
    }
    const slipPower = Math.abs(c.clutchSlipOmega) * torque;
    if (slipPower > 50) trans += this.clutchBp.process(rng.bipolar()) * Math.min(1, slipPower / 60000) * 0.35;
    if (c.gearChanged) this.clunk = 1;
    if (this.clunk > 1e-4) {
      const r = rng.bipolar();
      // keep the excitation away from zero so the clunk level does not depend on the noise seed
      const x = this.clunk * (r < 0 ? -1 : 1) * (0.6 + 0.4 * Math.abs(r));
      trans += (this.clunkLow.process(x) * 9 + this.clunkMid.process(x) * 4) * this.mech;
      this.clunk *= 0.9985;
      if (this.clunk < 0.02) this.clunk = 0;
    }
    this.transmissionOut = trans;

    // ---- environment: aerodynamic noise (steep low-pass, slow gusts, level from the speed curve)
    let wind = 0;
    if (windG > 1e-5) {
      const gust = Math.max(0.4, 1 + tn.windGust * 6 * this.gustLp.lowpass(nrng.bipolar()));
      const shaped = this.windLp2.lowpass(this.windLp.process(nrng.bipolar() * ns));
      wind = this.windHp.highpass(shaped) * windG * gust;
    }
    this.environmentOut = wind;
  }
}
