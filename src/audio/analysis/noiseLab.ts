/**
 * Isolated renderer + metrics for the tyre / wind noise channels (tests, scripts/audio-noise-lab.ts).
 * Drives a real VehicleAcoustics voice with synthetic steady telemetry (no physics) so the
 * environment and tyre channels can be measured at exact speeds and slip conditions.
 */
import { AF } from '../../core/contracts';
import { CH, CHANNEL_COUNT, type AcousticVehicleConfig } from '../dsp/AcousticConfig';
import { VehicleAcoustics } from '../dsp/VehicleAcoustics';
import { averagedSpectrum, aWeightedLevel, rms } from './spectrum';

export const NOISE_SPEEDS_KMH = [0, 40, 80, 120, 180, 240, 300] as const;

export interface NoiseScenario {
  id: string;
  label: string;
  /** Driven-wheel slip speed |ωr − v| (m/s) at vehicle speed `v` (m/s). */
  slip(v: number): number;
}

/** Slip speed for a given slip ratio, with an absolute floor (burnouts at standstill). */
const slipFor =
  (ratio: number, floor: number) =>
  (v: number): number =>
    Math.max(ratio * Math.max(Math.abs(v), 2), floor);

export const NOISE_SCENARIOS: readonly NoiseScenario[] = [
  // normal driven-wheel rotation vs. ground speed mismatch (≈ 1.5 % + a little) – no skid
  { id: 'roll', label: 'Rolamento sem patinação', slip: (v) => 0.015 * Math.abs(v) + 0.05 },
  { id: 'slip-light', label: 'Patinação leve', slip: slipFor(0.12, 2.5) },
  { id: 'slip-heavy', label: 'Patinação intensa', slip: slipFor(0.4, 10) },
];

export interface RenderNoiseOptions {
  sampleRate: number;
  seconds: number;
  /** Vehicle speed (m/s) over time. */
  speed: (t: number) => number;
  slip: (v: number) => number;
  tireLoadN?: number;
  throttle?: number;
  /** Seconds skipped from the returned signal (filter / smoother warm-up). */
  warmupS?: number;
}

const H = 1 / 120;

/** Renders every channel of a voice driven by synthetic speed/slip telemetry. */
export function renderNoise(cfg: AcousticVehicleConfig, o: RenderNoiseOptions): { ch: Float32Array[]; voice: VehicleAcoustics } {
  const fs = o.sampleRate;
  const voice = new VehicleAcoustics(fs, cfg);
  const total = Math.round(o.seconds * fs);
  const ch = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(total));
  const f = new Float64Array(AF.length);
  const e = cfg.engine;
  let theta = 0;
  let written = 0;
  let acc = 0;
  const steps = Math.ceil(o.seconds / H);
  for (let i = 0; i < steps; i++) {
    const t = i * H;
    const v = o.speed(t);
    // engine speed roughly follows road speed through the gearbox (kept inside the rev range)
    const rpm = Math.min(e.redlineRpm - 200, Math.max(e.idleRpm + 800, e.idleRpm + (v / 83) * (e.redlineRpm - e.idleRpm)));
    const w = (rpm * 2 * Math.PI) / 60;
    theta = (theta + w * H) % (4 * Math.PI);
    f.fill(0);
    f[AF.simTime] = t;
    f[AF.omega] = w;
    f[AF.crankAngle] = theta;
    f[AF.throttle] = o.throttle ?? 1;
    f[AF.load] = o.throttle ?? 1;
    f[AF.manifoldPressure] = 101325;
    f[AF.combustionEnabled] = 1;
    f[AF.exhaustTempK] = 1000;
    f[AF.vehicleSpeed] = v;
    f[AF.wheelSlipSpeed] = o.slip(v);
    f[AF.tireLoadN] = o.tireLoadN ?? 4000;
    voice.pushFrame(f);
    acc += fs * H;
    const n = Math.min(Math.floor(acc), total - written);
    acc -= Math.floor(acc);
    if (n > 0) {
      voice.render(ch, n, written);
      written += n;
    }
  }
  const skip = Math.round((o.warmupS ?? 0) * fs);
  return { ch: ch.map((c) => c.subarray(skip)), voice };
}

/** Steady-speed render (m/s given in km/h). */
export function renderSteady(cfg: AcousticVehicleConfig, sampleRate: number, kmh: number, scenario: NoiseScenario, seconds = 2.5, warmupS = 0.8) {
  const v = kmh / 3.6;
  return renderNoise(cfg, { sampleRate, seconds, speed: () => v, slip: scenario.slip, warmupS });
}

export interface SignalMetrics {
  rms: number;
  peak: number;
  clipped: number;
  /** A-weighted level of the averaged spectrum (dB, same scale as the spectrum). */
  aLevelDb: number;
  /** Energy share per band: <300 Hz, 300–1500, 1500–4000, >4000 (sums to ≈ 1). */
  bands: [number, number, number, number];
  centroidHz: number;
  /** Largest sample-to-sample step relative to the RMS of the signal. */
  maxStepOverRms: number;
  /** Largest step / RMS of steps (click detector). */
  maxJumpRatio: number;
}

const SPEC_N = 8192;

export function analyzeSignal(x: Float32Array, sampleRate: number): SignalMetrics {
  const r = rms(x);
  let peak = 0;
  let clipped = 0;
  let maxStep = 0;
  let stepSq = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]!);
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    if (i > 0) {
      const d = Math.abs(x[i]! - x[i - 1]!);
      stepSq += d * d;
      if (d > maxStep) maxStep = d;
    }
  }
  const spec = averagedSpectrum(x, SPEC_N);
  const nyq = sampleRate / 2;
  const edges = [0, 300, 1500, 4000, nyq];
  const e = [0, 0, 0, 0];
  let total = 0;
  let wsum = 0;
  const binHz = sampleRate / SPEC_N;
  for (let k = 1; k < spec.length; k++) {
    const p = spec[k]! * spec[k]!;
    const fr = k * binHz;
    total += p;
    wsum += p * fr;
    for (let b = 0; b < 4; b++) {
      if (fr >= edges[b]! && fr < edges[b + 1]!) {
        e[b]! += p;
        break;
      }
    }
  }
  const norm = total > 0 ? 1 / total : 0;
  return {
    rms: r,
    peak,
    clipped,
    aLevelDb: 20 * Math.log10(Math.max(aWeightedLevel(spec, sampleRate, SPEC_N), 1e-12)),
    bands: [e[0]! * norm, e[1]! * norm, e[2]! * norm, e[3]! * norm],
    centroidHz: total > 0 ? wsum / total : 0,
    maxStepOverRms: r > 1e-12 ? maxStep / r : 0,
    maxJumpRatio: maxStep / Math.sqrt(stepSq / Math.max(1, x.length - 1) + 1e-30),
  };
}

export const dB = (x: number): number => 20 * Math.log10(Math.max(x, 1e-12));

export { CH };
