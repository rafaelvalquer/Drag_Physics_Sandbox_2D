import { Prng } from '../../../core/prng';
import type { AcousticVehicleConfig } from '../AcousticConfig';
import { BlowOffAcoustics } from './BlowOffAcoustics';
import { CompressorFlutter } from './CompressorFlutter';
import { CompressorWhoosh, type WhooshInput } from './CompressorWhoosh';
import { TurboAcousticMixer, TWIN_ROTOR_GAIN } from './TurboAcousticMixer';
import { TURBO_LAYER, type ResolvedTurboProfile, type TurboAcousticControl, type TurboAcousticEstimates, type TurboDiagnostics } from './TurboAcousticTypes';
import { TurboDuctResonance } from './TurboDuctResonance';
import { resolveTurboProfile } from './TurboProfileResolver';
import { smoothstep, TurboRotorWhine, type RotorTargets } from './TurboRotorWhine';
import { estimateWastegateOpening, WastegateAcoustics } from './WastegateAcoustics';

/** Samples per control block (a power of two). */
export const TURBO_BLOCK = 32;

/** Resolves the acoustic profile of a voice configuration (undefined when the engine has no turbo). */
export function turboProfileOf(cfg: AcousticVehicleConfig): ResolvedTurboProfile | undefined {
  const t = cfg.engine.turbo;
  if (cfg.engine.induction !== 'turbo' || !t) return undefined;
  return resolveTurboProfile({ engineId: cfg.engine.id, family: cfg.engine.family, turbo: t, hints: cfg.acoustic.turbo });
}

/**
 * Turbo Acoustics 2.0: the turbocharger voice of one vehicle, rendered into the existing `turbo`
 * channel. Driven only by interpolated physics telemetry (shaft speeds, boost, BOV flow, throttle,
 * load, engine speed, EGT); derivatives are taken at block rate from that interpolated signal and
 * low-passed, never from raw network snapshots.
 *
 * Sources: one TurboRotorWhine per rotor (two independent rotors for a parallel twin, each with
 * its own phase and drift, the pair energy-normalized), CompressorWhoosh, BlowOffAcoustics,
 * CompressorFlutter, WastegateAcoustics, TurboDuctResonance and TurboAcousticMixer. Each source
 * owns its own pseudo-random stream, so retuning one never changes another one's noise.
 *
 * Allocation free after construction.
 */
export class TurboAcoustics {
  readonly profile: ResolvedTurboProfile;
  readonly estimates: TurboAcousticEstimates = {
    shaftNorm: 0,
    boostNorm: 0,
    pressureRatio: 1,
    shaftAccel: 0,
    boostRate: 0,
    throttleRate: 0,
    compressorFlow: 0,
    turbineFlow: 0,
    wastegateOpening: 0,
    instability: 0,
  };
  readonly rotorA: TurboRotorWhine;
  readonly rotorB: TurboRotorWhine | null;
  readonly whoosh: CompressorWhoosh;
  readonly bov: BlowOffAcoustics;
  readonly flutter: CompressorFlutter;
  readonly wastegate: WastegateAcoustics;
  readonly duct: TurboDuctResonance;
  readonly mixer: TurboAcousticMixer;
  private readonly sampleRate: number;
  private readonly blockS: number;
  private readonly redlineOmega: number;
  private readonly cylinders: number;
  private readonly lowQuality: boolean;
  private readonly diagnostics: TurboDiagnostics;
  private readonly reduced: boolean;
  private readonly hybrid: boolean;
  private counter = 0;
  private prevShaft = 0;
  private prevBoost = 0;
  private prevThrottle = 0;
  private readonly kAccel: number;
  private readonly kRate: number;
  private readonly kFlow: number;
  private readonly ta: RotorTargets = { g1: 0, g2: 0, g3: 0, gB: 0, pulseHz: 0, pulseDepth: 0, am: 1 };
  private readonly tb: RotorTargets = { g1: 0, g2: 0, g3: 0, gB: 0, pulseHz: 0, pulseDepth: 0, am: 1 };
  private readonly wi: WhooshInput = { shaftNorm: 0, boostNorm: 0, flow: 0, instability: 0 };
  private primed = false;
  /** Layer outputs of the last sample (lab exports, diagnostics). */
  rotorOut = 0;
  whooshOut = 0;
  bovOut = 0;
  flutterOut = 0;
  wastegateOut = 0;
  out = 0;

  constructor(sampleRate: number, cfg: AcousticVehicleConfig, profile?: ResolvedTurboProfile) {
    const p = profile ?? turboProfileOf(cfg);
    if (!p) throw new Error('TurboAcoustics needs a turbocharged engine');
    this.profile = p;
    this.hybrid = cfg.turboModel === undefined || cfg.turboModel === 'hybrid';
    this.reduced = this.hybrid || cfg.turboModel === 'reduced';
    const d = this.diagnostics = cfg.turboDiagnostics ?? {};
    this.sampleRate = sampleRate;
    this.blockS = TURBO_BLOCK / sampleRate;
    this.lowQuality = cfg.quality === 'low';
    this.redlineOmega = (cfg.engine.redlineRpm * 2 * Math.PI) / 60;
    this.cylinders = cfg.engine.cylinders;
    const seed = cfg.seed * 7027 + 101;
    const lq = this.lowQuality;
    const am = d.amplitude ?? 1;
    const texture = this.hybrid ? { ...p.texture, ...d.texture } : undefined;
    if (texture) texture.amplitudeVariation *= am;
    const makeRotor = (sourceSeed: number, phase: number) => new TurboRotorWhine(
      sampleRate, p.blades, new Prng(sourceSeed), p.rotor.modulationDepth * am, lq, phase,
      texture, d.coherent, d.narrowband, !lq || (d.exhaustPulse ?? 0) > 0,
    );
    this.rotorA = makeRotor(seed + 1, 0);
    // the second rotor starts at an unrelated phase: two real rotors are never phase-aligned
    this.rotorB = p.twin ? makeRotor(seed + 2, 0.37) : null;
    this.whoosh = new CompressorWhoosh(sampleRate, p, new Prng(seed + 3), lq);
    this.bov = new BlowOffAcoustics(sampleRate, p, new Prng(seed + 4), lq);
    this.flutter = new CompressorFlutter(sampleRate, p, new Prng(seed + 5), lq);
    this.wastegate = new WastegateAcoustics(sampleRate, p, new Prng(seed + 6), lq);
    this.duct = new TurboDuctResonance(sampleRate, p, lq, this.hybrid, d.resonances);
    this.mixer = new TurboAcousticMixer(cfg.turboLayers ?? TURBO_LAYER.all, p.overallGain, d.whoosh);
    this.kAccel = 1 - Math.exp(-2 * Math.PI * 6 * this.blockS);
    this.kRate = 1 - Math.exp(-2 * Math.PI * 20 * this.blockS);
    this.kFlow = 1 - Math.exp(-this.blockS / 0.04);
  }

  private rotorTargets(t: RotorTargets, s: number, work: number, spool: number, load: number, omega: number): void {
    const r = this.profile.rotor;
    const onset = smoothstep(r.onsetShaft * 0.45, r.onsetShaft * 1.5, s);
    const a = r.level * Math.pow(Math.min(1.25, s), 2.2) * (0.22 + 0.78 * work) * onset;
    const exposure = 1 + 0.35 * this.profile.intakeExposure;
    const [g1, g2, g3, gB] = this.profile.reducedOrders;
    const d = this.diagnostics;
    t.g1 = a * (this.reduced ? g1 : r.order1Gain) * (0.7 + 0.3 * s) * (d.order1 ?? 1);
    t.g2 = a * (this.reduced ? g2 : r.order2Gain) * (0.55 + 0.45 * work) * (this.reduced ? 1 : 1 + 0.5 * spool) * (d.order2 ?? 1);
    t.g3 = a * (this.reduced ? g3 : r.order3Gain) * (0.45 + 0.55 * work) * (this.reduced ? 1 : 1 + 0.6 * spool) * (d.order3 ?? 1);
    t.gB = a * (this.reduced ? gB : r.bladePassGain) * (0.35 + 0.65 * work) * (1 + 0.4 * spool) * exposure * (d.bladePass ?? 1);
    // four-stroke: cylinders/2 exhaust pulses per crank revolution
    t.pulseHz = (Math.abs(omega) / (2 * Math.PI)) * (this.cylinders / 2);
    t.pulseDepth = r.pulseModulation * Math.min(1, load) * (this.hybrid ? .24 : 1) * (d.exhaustPulse ?? 1);
    t.am = 1;
  }

  private block(c: TurboAcousticControl): void {
    const p = this.profile;
    const est = this.estimates;
    const maxRpm = p.maxShaftRpm;
    const s = Math.max(0, c.shaftRpm) / maxRpm;
    const s2 = this.rotorB ? Math.max(0, c.shaftRpm2) / maxRpm : s;
    const sMean = this.rotorB ? 0.5 * (s + s2) : s;
    const boostNorm = Math.max(0, c.boostPa) / p.maxBoostPa;
    if (!this.primed) {
      this.prevShaft = sMean;
      this.prevBoost = boostNorm;
      this.prevThrottle = c.throttle;
      this.primed = true;
    }
    // filtered derivatives of the interpolated telemetry
    est.shaftAccel += ((sMean - this.prevShaft) / this.blockS - est.shaftAccel) * this.kAccel;
    est.boostRate += ((boostNorm - this.prevBoost) / this.blockS - est.boostRate) * this.kAccel;
    est.throttleRate += ((c.throttle - this.prevThrottle) / this.blockS - est.throttleRate) * this.kRate;
    this.prevShaft = sMean;
    this.prevBoost = boostNorm;
    this.prevThrottle = c.throttle;
    est.shaftNorm = sMean;
    est.boostNorm = boostNorm;
    est.pressureRatio = (101325 + Math.max(0, c.boostPa)) / 101325;
    const omegaNorm = Math.min(1.2, Math.abs(c.omega) / this.redlineOmega);
    const boostBar = Math.max(0, c.boostPa) / 1e5;
    const density = (1 + boostBar) / (1 + p.maxBoostPa / 1e5);
    // acoustic flow estimates (not physics outputs)
    // (smoothed ≈ 40 ms: a limiter / spark cut does not chop the rotor sound sample-accurately)
    const cf = c.engineRunning ? Math.min(1.2, omegaNorm * (0.12 + 0.88 * c.throttle) * density * 1.15) : omegaNorm * 0.1;
    const tf = c.engineRunning ? Math.min(1.2, omegaNorm * Math.min(1, c.engineLoad) * density * 1.15) : 0;
    est.compressorFlow += (cf - est.compressorFlow) * this.kFlow;
    est.turbineFlow += (tf - est.turbineFlow) * this.kFlow;
    est.wastegateOpening = estimateWastegateOpening(s, boostNorm, c.engineLoad);
    est.instability = smoothstep(0.35, 0.9, boostNorm) * (1 - smoothstep(0.08, 0.35, est.compressorFlow)) * smoothstep(0.3, 0.6, sMean);
    // compressor work: air flow first; pressure only counts while air actually flows through it
    const flow1 = Math.min(1, est.compressorFlow);
    const work = smoothstep(0, 1, 0.65 * flow1 + 0.35 * Math.min(1, boostNorm, flow1 * 2.5));
    const spool = smoothstep(0.1, 1.2, est.shaftAccel) * p.rotor.spoolEmphasis * smoothstep(0.05, 0.4, c.throttle);
    this.rotorTargets(this.ta, s, work, spool, c.engineLoad, c.omega);
    this.rotorA.setBlock(c.shaftRpm / 60, this.ta, TURBO_BLOCK);
    if (this.rotorB) {
      this.rotorTargets(this.tb, s2, work, spool, c.engineLoad, c.omega);
      this.rotorB.setBlock(c.shaftRpm2 / 60, this.tb, TURBO_BLOCK);
    }
    const wi = this.wi;
    wi.shaftNorm = sMean;
    wi.boostNorm = boostNorm;
    wi.flow = Math.min(1, est.compressorFlow);
    wi.instability = est.instability;
    this.whoosh.setBlock(wi, TURBO_BLOCK);
    const firingHz = (Math.abs(c.omega) / (2 * Math.PI)) * (this.cylinders / 2);
    this.wastegate.setBlock(est.wastegateOpening, est.turbineFlow, c.exhaustTempK, firingHz, TURBO_BLOCK);
    this.flutter.block({ shaftNorm: sMean, boostNorm, throttle: c.throttle, throttleRate: est.throttleRate, bovFlow: c.bovFlow }, this.blockS);
  }

  process(c: TurboAcousticControl): number {
    if ((this.counter++ & (TURBO_BLOCK - 1)) === 0) this.block(c);
    let rotor = this.rotorA.process(c.shaftRpm / 60);
    if (this.rotorB) rotor = (rotor + this.rotorB.process(c.shaftRpm2 / 60)) * TWIN_ROTOR_GAIN;
    const whoosh = this.whoosh.process();
    const flutter = this.flutter.process();
    const bov = this.bov.process(c.bovFlow, this.estimates.boostNorm, c.boostPa);
    const wg = this.wastegate.process();
    const recirc = this.profile.ventType === 'recirculating';
    const rotorAm = 1 + (this.flutter.rotorAm - 1) * (this.diagnostics.amplitude ?? 1);
    const inlet = this.mixer.inlet(rotor, rotorAm, whoosh, flutter, recirc ? bov : 0);
    const ducted = this.duct.process(inlet);
    this.rotorOut = rotor;
    this.whooshOut = whoosh;
    this.bovOut = bov;
    this.flutterOut = flutter;
    this.wastegateOut = wg;
    this.out = this.mixer.output(ducted, inlet, recirc ? 0 : bov, wg);
    return this.out;
  }

  get sampleRateHz(): number {
    return this.sampleRate;
  }
}
