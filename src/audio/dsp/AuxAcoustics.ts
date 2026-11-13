import { Prng } from '../../core/prng';
import type { AcousticVehicleConfig } from './AcousticConfig';
import { Biquad, OnePole } from './Filters';

const TWO_PI = 2 * Math.PI;

/** Per-sample control values for the auxiliary sources. */
export interface AuxControl {
  omega: number;
  throttle: number;
  boostPa: number;
  turboShaftRpm: number;
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

/**
 * Non-engine sources of a vehicle (all new code, no third-party origin):
 * - turbo: compressor blade-pass whine f = N_shaft/60 · blades (faded out before Nyquist so it
 *   never aliases), broadband compressor hiss ∝ boost, blow-off valve vent noise ∝ BOV flow and
 *   compressor surge flutter when no BOV is fitted;
 * - tyres: squeal (stick–slip, narrow-band noise) from the driven-wheel slip speed and load, and
 *   rolling roar ∝ v^1.5;
 * - transmission: gear mesh whine at input-shaft speed × teeth, ∝ √|torque|, clutch slip noise
 *   ∝ dissipated power, engagement clunk on a gear change;
 * - environment: wind noise ∝ v² with a speed dependent spectrum.
 * Phase accumulators keep every tone continuous when its frequency changes.
 */
export class AuxAcoustics {
  private readonly dt: number;
  private readonly nyq: number;
  private readonly rng: Prng;
  private readonly hasTurbo: boolean;
  private readonly blades: number;
  private readonly bovFitted: boolean;
  private readonly teeth: number;
  private readonly mech: number;
  private readonly gearRatios: number[];
  private turboPhase = 0;
  private gearPhase = 0;
  private surgePhase = 0;
  private readonly hissBp: Biquad;
  private readonly bovBp: Biquad;
  private readonly bovLp: OnePole;
  private readonly squealBp1: Biquad;
  private readonly squealBp2: Biquad;
  private readonly rollLp: OnePole;
  private readonly rollHp: OnePole;
  private readonly clutchBp: Biquad;
  private readonly clunkLow: Biquad;
  private readonly clunkMid: Biquad;
  private readonly windLp: OnePole;
  private readonly windHp: OnePole;
  private clunk = 0;
  private squealDrift = 0;
  private slowCounter = 0;
  turboOut = 0;
  tireOut = 0;
  transmissionOut = 0;
  environmentOut = 0;

  constructor(sampleRate: number, cfg: AcousticVehicleConfig) {
    this.dt = 1 / sampleRate;
    this.nyq = sampleRate / 2;
    this.rng = new Prng(cfg.seed * 104729 + 3);
    this.hasTurbo = cfg.engine.induction === 'turbo' && !!cfg.engine.turbo;
    this.blades = cfg.engine.turbo?.compressorBlades ?? 6;
    this.bovFitted = cfg.engine.turbo?.bovEnabled ?? false;
    this.teeth = cfg.acoustic.gearTeeth;
    this.mech = cfg.acoustic.mechanicalNoise;
    this.gearRatios = cfg.gearRatios;
    this.hissBp = new Biquad(sampleRate).setBandpass(5200, 0.7);
    this.bovBp = new Biquad(sampleRate).setBandpass(2300, 1.1);
    this.bovLp = new OnePole(sampleRate, 6000);
    this.squealBp1 = new Biquad(sampleRate).setBandpass(1050, 9);
    this.squealBp2 = new Biquad(sampleRate).setBandpass(2150, 7);
    this.rollLp = new OnePole(sampleRate, 400);
    this.rollHp = new OnePole(sampleRate, 40);
    this.clutchBp = new Biquad(sampleRate).setBandpass(1700, 1.5);
    this.clunkLow = new Biquad(sampleRate).setBandpass(95, 6);
    this.clunkMid = new Biquad(sampleRate).setBandpass(430, 5);
    this.windLp = new OnePole(sampleRate, 800);
    this.windHp = new OnePole(sampleRate, 60);
  }

  process(c: AuxControl): void {
    const dt = this.dt;
    const rng = this.rng;
    // block-rate parameter updates (filters whose centre depends on the state)
    if ((this.slowCounter++ & 63) === 0) {
      const v = Math.abs(c.vehicleSpeed);
      this.windLp.setCutoff(500 + v * 25);
      this.rollLp.setCutoff(250 + v * 6);
      this.squealDrift += (rng.bipolar() * 0.5 - this.squealDrift) * 0.05;
      const slip = Math.min(c.wheelSlipSpeed, 12);
      this.squealBp1.setBandpass(980 + slip * 18 + this.squealDrift * 60, 9);
      this.squealBp2.setBandpass(2050 + slip * 30 + this.squealDrift * 90, 7);
    }

    // ---- turbo
    let turbo = 0;
    if (this.hasTurbo) {
      const f = (c.turboShaftRpm / 60) * this.blades;
      const nyqFade = 1 - smoothstep(this.nyq * 0.8, this.nyq * 0.92, f);
      this.turboPhase += f * dt;
      this.turboPhase -= Math.floor(this.turboPhase);
      const boostBar = Math.max(0, c.boostPa) / 1e5;
      const whine = Math.sin(TWO_PI * this.turboPhase) * smoothstep(1500, 6000, f) * nyqFade * (0.25 + boostBar);
      const hiss = this.hissBp.process(rng.bipolar()) * boostBar * (0.4 + c.throttle);
      let bov = 0;
      if (c.bovFlow > 0.002) bov = this.bovBp.process(this.bovLp.lowpass(rng.bipolar())) * c.bovFlow * 3.2;
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

    // ---- tyres
    const loadF = Math.sqrt(Math.max(0, c.tireLoadN) / 4000);
    const squealAmt = smoothstep(0.3, 3, c.wheelSlipSpeed) * loadF;
    let tire = 0;
    if (squealAmt > 1e-4) {
      const nz = rng.bipolar();
      tire += (this.squealBp1.process(nz) * 2.2 + this.squealBp2.process(nz) * 1.1) * squealAmt;
    }
    const v = Math.abs(c.vehicleSpeed);
    if (v > 0.05) {
      const roll = this.rollHp.highpass(this.rollLp.lowpass(rng.bipolar())) * Math.pow(v / 30, 1.5) * loadF * 0.9;
      tire += roll;
    }
    this.tireOut = tire;

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
      const x = this.clunk * rng.bipolar();
      trans += (this.clunkLow.process(x) * 9 + this.clunkMid.process(x) * 4) * this.mech;
      this.clunk *= 0.9985;
      if (this.clunk < 0.02) this.clunk = 0;
    }
    this.transmissionOut = trans;

    // ---- environment: wind
    const wind = v > 0.5 ? this.windHp.highpass(this.windLp.lowpass(rng.bipolar())) * Math.min(4, (v / 40) * (v / 40)) * 0.6 : 0;
    this.environmentOut = wind;
  }
}
