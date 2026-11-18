import { Prng } from '../../core/prng';
import type { AcousticVehicleConfig } from './AcousticConfig';
import { Biquad, OnePole, ParamSmoother } from './Filters';

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
 * - turbo: compressor blade-pass whine f = N_shaft/60 · blades (faded out before Nyquist so it
 *   never aliases), broadband compressor hiss ∝ boost, blow-off valve vent noise ∝ BOV flow and
 *   compressor surge flutter when no BOV is fitted;
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
  private readonly hasTurbo: boolean;
  private readonly blades: number;
  private readonly bovFitted: boolean;
  /** Factory diverter valve venting into the compressor inlet (heard through the intake duct). */
  private readonly bovRecirculating: boolean;
  private readonly bovDuctLp: OnePole;
  private readonly teeth: number;
  private readonly mech: number;
  private readonly gearRatios: number[];
  private turboPhase = 0;
  private turboPhase2 = 0;
  /** Parallel-twin turbo: two compressors, each with its own blade-pass whine. */
  private readonly twinTurbo: boolean;
  private gearPhase = 0;
  private surgePhase = 0;
  private readonly hissBp: Biquad;
  private readonly bovBp: Biquad;
  private readonly bovLp: OnePole;
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
    this.hasTurbo = cfg.engine.induction === 'turbo' && !!cfg.engine.turbo;
    this.blades = cfg.engine.turbo?.compressorBlades ?? 6;
    this.twinTurbo = cfg.engine.turbo?.layout === 'parallel-twin';
    this.bovFitted = cfg.engine.turbo?.bovEnabled ?? false;
    this.bovRecirculating = cfg.engine.turbo?.bovVent === 'recirculating';
    this.bovDuctLp = new OnePole(sampleRate, 1400);
    this.teeth = cfg.acoustic.gearTeeth;
    this.mech = cfg.acoustic.mechanicalNoise;
    this.gearRatios = cfg.gearRatios;
    this.hissBp = new Biquad(sampleRate).setBandpass(5200, 0.7);
    this.bovBp = new Biquad(sampleRate).setBandpass(2300, 1.1);
    this.bovLp = new OnePole(sampleRate, 6000);
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
    if (this.hasTurbo) {
      const f = (c.turboShaftRpm / 60) * this.blades;
      const nyqFade = 1 - smoothstep(this.nyq * 0.8, this.nyq * 0.92, f);
      this.turboPhase += f * dt;
      this.turboPhase -= Math.floor(this.turboPhase);
      const boostBar = Math.max(0, c.boostPa) / 1e5;
      let whine = Math.sin(TWO_PI * this.turboPhase) * smoothstep(1500, 6000, f) * nyqFade * (0.25 + boostBar);
      if (this.twinTurbo) {
        // two rotors that never turn at exactly the same speed: the whines beat against each other,
        // and each carries half the level (the air flow is shared), instead of one doubled voice
        const f2 = ((c.turboShaftRpm2 ?? c.turboShaftRpm) / 60) * this.blades;
        const nyqFade2 = 1 - smoothstep(this.nyq * 0.8, this.nyq * 0.92, f2);
        this.turboPhase2 += f2 * dt;
        this.turboPhase2 -= Math.floor(this.turboPhase2);
        whine = 0.6 * (whine + Math.sin(TWO_PI * this.turboPhase2) * smoothstep(1500, 6000, f2) * nyqFade2 * (0.25 + boostBar));
      }
      const hiss = this.hissBp.process(rng.bipolar()) * boostBar * (0.4 + c.throttle);
      let bov = 0;
      if (c.bovFlow > 0.002) {
        bov = this.bovBp.process(this.bovLp.lowpass(rng.bipolar())) * c.bovFlow * 3.2;
        // recirculated: the jet stays inside the duct; only a low, muffled whoosh gets out
        if (this.bovRecirculating) bov = this.bovDuctLp.lowpass(bov) * 0.35;
      } else if (this.bovRecirculating) this.bovDuctLp.lowpass(0);
      let surge = 0;
      if (!this.bovFitted && boostBar > 0.15 && c.throttle < 0.12) {
        // compressor surge: flow reversal cycles at ≈ 12–25 Hz while the trapped boost bleeds off
        this.surgePhase += (12 + 10 * boostBar) * dt;
        this.surgePhase -= Math.floor(this.surgePhase);
        const gate = this.surgePhase < 0.35 ? Math.sin((Math.PI * this.surgePhase) / 0.35) : 0;
        surge = this.bovBp.process(rng.bipolar()) * gate * boostBar * 2.5;
      }
      turbo = whine * 0.35 + hiss * 0.8 + bov + surge;
    }
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
