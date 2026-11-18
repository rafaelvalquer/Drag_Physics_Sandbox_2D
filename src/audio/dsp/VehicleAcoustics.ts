import { AF } from '../../core/contracts';
import { Prng } from '../../core/prng';
import { CHANNEL_COUNT, CH, type AcousticVehicleConfig } from './AcousticConfig';
import { AuxAcoustics, type AuxControl } from './AuxAcoustics';
import { EngineAcoustics, type EngineControl } from './EngineAcoustics';
import { DcBlocker, softClip } from './Filters';
import { TelemetryStream } from './TelemetryStream';

/**
 * Pa → output-scale factors per channel. They only map the physical source levels into a
 * comfortable digital range (calibrated once with scripts/audio-calibrate.ts so a typical car at
 * full throttle near redline peaks below ≈ 0.5 per channel); relative levels between cars,
 * exhaust presets and operating points come from the model.
 */
export const CHANNEL_NORM: Readonly<Record<number, number>> = {
  [CH.intake]: 1 / 66000,
  [CH.block]: 1 / 200000,
  [CH.exhaust]: 1 / 1800,
  [CH.turbo]: 0.1,
  [CH.tire]: 0.25,
  [CH.transmission]: 0.45,
  [CH.environment]: 0.12,
};

/**
 * One vehicle voice: telemetry stream → engine and auxiliary source models → 7 mono channels.
 * Allocation free in `render`. A non-finite value anywhere resets the voice (counted, never
 * propagated to the output).
 */
export class VehicleAcoustics {
  readonly stream: TelemetryStream;
  readonly engine: EngineAcoustics;
  readonly aux: AuxAcoustics;
  private readonly ec: EngineControl = {
    theta: 0,
    omega: 0,
    throttle: 0,
    load: 0,
    manifoldPa: 101325,
    boostPa: 0,
    combustion: false,
    sparkCut: 0,
    exhaustTempK: 700,
    starter: false,
  };
  private readonly ac: AuxControl = {
    omega: 0,
    throttle: 0,
    boostPa: 0,
    turboShaftRpm: 0,
    bovFlow: 0,
    vehicleSpeed: 0,
    wheelSlipSpeed: 0,
    tireLoadN: 0,
    gearboxOutputOmega: 0,
    clutchSlipOmega: 0,
    transmissionTorque: 0,
    gear: 0,
    gearChanged: false,
  };
  private readonly dc: DcBlocker[] = [];
  private readonly gains = new Float64Array(CHANNEL_COUNT);
  private readonly rng: Prng;
  private counter = 0;
  private popEnv = 0;
  ambientK = 298;
  /** Offline diagnostics only: called per sample with radiated, jet, combined (Pa), normalized (pre-softClip) and final exhaust samples. */
  exhaustTap: ((radiated: number, jet: number, combined: number, normalized: number, final: number) => void) | null = null;
  /** Offline diagnostics only: per sample tone, hiss, roar, combined (Pa), normalized (pre-softClip) and final intake samples. */
  intakeTap: ((tone: number, hiss: number, roar: number, combined: number, normalized: number, final: number) => void) | null = null;
  /** Peak absolute output per channel since the last `resetStats` (diagnostics, calibration). */
  readonly peak = new Float64Array(CHANNEL_COUNT);
  readonly sumSq = new Float64Array(CHANNEL_COUNT);
  /** Sum of squares of the physical (Pa-scale, pre-normalization) channel signals. */
  readonly rawSumSq = new Float64Array(CHANNEL_COUNT);
  samples = 0;
  nanResets = 0;

  constructor(
    readonly sampleRate: number,
    readonly config: AcousticVehicleConfig,
    latencyS = 0.05,
  ) {
    this.stream = new TelemetryStream(sampleRate, latencyS);
    this.engine = new EngineAcoustics(sampleRate, config);
    this.aux = new AuxAcoustics(sampleRate, config);
    this.rng = new Prng(config.seed * 31 + 5);
    for (let k = 0; k < CHANNEL_COUNT; k++) this.dc.push(new DcBlocker(sampleRate, 15));
    const a = config.acoustic;
    this.gains[CH.intake] = a.intakeGain;
    this.gains[CH.block] = a.blockGain;
    this.gains[CH.exhaust] = a.exhaustGain * config.exhaust.outputGain;
    this.gains[CH.turbo] = a.turboGain;
    this.gains[CH.tire] = a.tireGain;
    this.gains[CH.transmission] = a.transmissionGain;
    this.gains[CH.environment] = a.environmentGain;
    for (let k = 0; k < CHANNEL_COUNT; k++) this.gains[k]! *= CHANNEL_NORM[k]!;
  }

  pushFrame(src: ArrayLike<number>, offset = 0): boolean {
    return this.stream.push(src, offset);
  }

  resetStats(): void {
    this.peak.fill(0);
    this.sumSq.fill(0);
    this.rawSumSq.fill(0);
    this.samples = 0;
  }

  /** Physical-scale RMS of a channel (before normalization and gains). */
  rawRms(channel: number): number {
    return this.samples > 0 ? Math.sqrt(this.rawSumSq[channel]! / this.samples) : 0;
  }

  /** RMS of a channel since the last resetStats. */
  rms(channel: number): number {
    return this.samples > 0 ? Math.sqrt(this.sumSq[channel]! / this.samples) : 0;
  }

  /**
   * Renders `n` samples into `outputs[ch]` (each at least `offset + n` long). Channels that are
   * missing (undefined) are computed but not written.
   */
  render(outputs: ReadonlyArray<Float32Array | undefined>, n: number, offset = 0): void {
    const s = this.stream;
    const c = s.cur;
    const ec = this.ec;
    const ac = this.ac;
    for (let j = 0; j < n; j++) {
      s.step();
      const fade = s.fade;
      if (!s.hasData || fade < 1e-5) {
        for (let k = 0; k < CHANNEL_COUNT; k++) {
          const o = outputs[k];
          if (o) o[offset + j] = 0;
        }
        continue;
      }
      if ((this.counter++ & 63) === 0) this.engine.updateSlow(Math.max(c[AF.exhaustTempK]!, this.ambientK + 20), this.ambientK);
      ec.theta = s.theta;
      ec.omega = c[AF.omega]!;
      ec.throttle = c[AF.throttle]!;
      ec.load = c[AF.load]!;
      ec.manifoldPa = c[AF.manifoldPressure]!;
      ec.boostPa = c[AF.boostPressure]!;
      ec.combustion = c[AF.combustionEnabled]! > 0.5;
      ec.sparkCut = c[AF.sparkCut]!;
      ec.exhaustTempK = c[AF.exhaustTempK]!;
      ec.starter = c[AF.starterActive]! > 0.5;
      if (s.eventAfterfire) this.popEnv = 1;
      if (this.popEnv > 1e-3) {
        // unburnt mixture igniting in the hot pipe: a short pressure burst at the tailpipe inlet
        this.engine.exhaust.tailInjection += this.popEnv * (0.6 + 0.4 * this.rng.bipolar()) * 1800;
        this.popEnv *= Math.exp(-1 / (0.004 * this.sampleRate));
      } else this.popEnv = 0;
      this.engine.process(ec);

      ac.omega = ec.omega;
      ac.throttle = ec.throttle;
      ac.boostPa = ec.boostPa;
      ac.turboShaftRpm = c[AF.turboShaftRpm]!;
      ac.turboShaftRpm2 = c[AF.turboShaftRpm2]!;
      ac.bovFlow = c[AF.bovFlow]!;
      ac.vehicleSpeed = c[AF.vehicleSpeed]!;
      ac.wheelSlipSpeed = c[AF.wheelSlipSpeed]!;
      ac.tireLoadN = c[AF.tireLoadN]!;
      ac.gearboxOutputOmega = c[AF.gearboxOutputOmega]!;
      ac.clutchSlipOmega = c[AF.clutchSlipOmega]!;
      ac.transmissionTorque = c[AF.transmissionTorque]!;
      ac.gear = c[AF.gear]!;
      ac.gearChanged = s.gearChanged;
      this.aux.process(ac);

      const e = this.engine;
      const x = this.aux;
      const raw0 = e.intakeOut;
      const raw1 = e.blockOut;
      const raw2 = e.exhaustOut;
      if (!Number.isFinite(raw0 + raw1 + raw2 + x.turboOut + x.tireOut + x.transmissionOut + x.environmentOut)) {
        this.nanResets++;
        this.engine.reset();
        for (let k = 0; k < CHANNEL_COUNT; k++) {
          const o = outputs[k];
          if (o) o[offset + j] = 0;
        }
        continue;
      }
      const yIn = this.write(outputs, CH.intake, offset + j, raw0, fade);
      if (this.intakeTap) this.intakeTap(e.intakeTone, e.intakeHiss, e.intakeRoar, raw0, raw0 * this.gains[CH.intake]!, yIn);
      this.write(outputs, CH.block, offset + j, raw1, fade);
      const yEx = this.write(outputs, CH.exhaust, offset + j, raw2, fade);
      if (this.exhaustTap) this.exhaustTap(e.exhaustRadiated, e.exhaustJet, raw2, raw2 * this.gains[CH.exhaust]!, yEx);
      this.write(outputs, CH.turbo, offset + j, x.turboOut, fade);
      this.write(outputs, CH.tire, offset + j, x.tireOut, fade);
      this.write(outputs, CH.transmission, offset + j, x.transmissionOut, fade);
      this.write(outputs, CH.environment, offset + j, x.environmentOut, fade);
      this.samples++;
    }
  }

  private write(outputs: ReadonlyArray<Float32Array | undefined>, k: number, idx: number, raw: number, fade: number): number {
    this.rawSumSq[k]! += raw * raw;
    const y = softClip(this.dc[k]!.process(raw * this.gains[k]!)) * fade;
    const a = y < 0 ? -y : y;
    if (a > this.peak[k]!) this.peak[k] = a;
    this.sumSq[k]! += y * y;
    const o = outputs[k];
    if (o) o[idx] = y;
    return y;
  }

  reset(): void {
    this.stream.reset();
    this.engine.reset();
  }
}
