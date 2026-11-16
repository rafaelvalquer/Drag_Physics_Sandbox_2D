/**
 * Isolated intake-channel renderer + metrics (tests, scripts/audio-intake-lab.ts).
 * Drives a real VehicleAcoustics voice with synthetic telemetry (rpm, load, throttle, manifold
 * pressure and boost are independent inputs) and taps the intake chain: periodic tone, throttle
 * hiss, induction roar (Pa), the combined source, the normalized signal before softClip and the
 * final channel sample.
 */
import { AF } from '../../core/contracts';
import { CHANNEL_COUNT, type AcousticVehicleConfig } from '../dsp/AcousticConfig';
import { VehicleAcoustics } from '../dsp/VehicleAcoustics';
import { averagedSpectrum, rms } from './spectrum';

const H = 1 / 120;

export interface IntakeRender {
  tone: Float32Array;
  hiss: Float32Array;
  roar: Float32Array;
  combined: Float32Array;
  normalized: Float32Array;
  final: Float32Array;
  voice: VehicleAcoustics;
}

export interface IntakePoint {
  rpm: number;
  /** Engine load 0..1 (air charge). */
  load: number;
  /** Throttle plate / pedal 0..1; defaults to load. */
  throttle?: number;
  /** Manifold pressure (Pa); defaults to 101325·max(0.2, load) (naturally aspirated). */
  manifoldPa?: number;
  /** Boost above ambient (Pa); 0 for naturally aspirated. */
  boostPa?: number;
  /** false = fuel cut / ignition off. */
  combustion?: boolean;
}

export function renderIntake(cfg: AcousticVehicleConfig, fs: number, point: (t: number) => IntakePoint, seconds: number, warmupS = 0.5): IntakeRender {
  const voice = new VehicleAcoustics(fs, cfg);
  const total = Math.round(seconds * fs);
  const mk = (): Float32Array => new Float32Array(total);
  const o = { tone: mk(), hiss: mk(), roar: mk(), combined: mk(), normalized: mk(), final: mk() };
  let w = 0;
  voice.intakeTap = (t, h, r, c, nrm, y) => {
    if (w < total) {
      o.tone[w] = t;
      o.hiss[w] = h;
      o.roar[w] = r;
      o.combined[w] = c;
      o.normalized[w] = nrm;
      o.final[w] = y;
    }
    w++;
  };
  const ch = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(fs * H) + 2));
  const f = new Float64Array(AF.length);
  let theta = 0;
  let acc = 0;
  const steps = Math.ceil(seconds / H);
  for (let i = 0; i < steps; i++) {
    const t = i * H;
    const p = point(t);
    const om = (p.rpm * 2 * Math.PI) / 60;
    theta = (theta + om * H) % (4 * Math.PI);
    f.fill(0);
    f[AF.simTime] = t;
    f[AF.omega] = om;
    f[AF.crankAngle] = theta;
    f[AF.throttle] = p.throttle ?? p.load;
    f[AF.load] = p.load;
    f[AF.manifoldPressure] = p.manifoldPa ?? 101325 * Math.max(0.2, p.load);
    f[AF.boostPressure] = p.boostPa ?? 0;
    f[AF.combustionEnabled] = p.combustion === false ? 0 : 1;
    f[AF.exhaustTempK] = 650 + 450 * p.load * Math.min(1, p.rpm / 6000);
    voice.pushFrame(f);
    acc += fs * H;
    const n = Math.floor(acc);
    acc -= n;
    if (n > 0) voice.render(ch, n);
  }
  const s = Math.round(warmupS * fs);
  const cut = (x: Float32Array): Float32Array => x.subarray(s, Math.min(w, total));
  return { tone: cut(o.tone), hiss: cut(o.hiss), roar: cut(o.roar), combined: cut(o.combined), normalized: cut(o.normalized), final: cut(o.final), voice };
}

export function renderIntakeSteady(cfg: AcousticVehicleConfig, fs: number, p: IntakePoint, seconds = 2.5): IntakeRender {
  return renderIntake(cfg, fs, () => p, seconds);
}

/** RMS about the mean. */
export function acRms(x: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < x.length; i++) m += x[i]!;
  m /= Math.max(1, x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i]! - m) * (x[i]! - m);
  return Math.sqrt(s / Math.max(1, x.length));
}

export interface IntakeMetrics {
  toneRms: number;
  hissRms: number;
  roarRms: number;
  /** (hiss ⊕ roar) / tone RMS in dB: positive = random turbulence louder than the periodic part. */
  noiseOverToneDb: number;
  normRms: number;
  normPeak: number;
  /** Share of samples with |normalized| above 1.5 (strongly into the soft-clip region). */
  satShare: number;
  finalRms: number;
  finalPeak: number;
  /** Energy share of the final signal per band: <500, 500–1500, 1500–4000, >4000 Hz. */
  bands: [number, number, number, number];
  /** Share of the 30–2000 Hz energy of the final signal sitting at multiples of the firing frequency (±6 %). */
  harmonicShare: number;
  /** Spectral centroid of the final signal (Hz). */
  centroidHz: number;
  /** Largest sample-to-sample step relative to the RMS of the steps (click detector). */
  maxStepRatio: number;
}

export function intakeMetrics(r: IntakeRender, fs: number, firingHz: number): IntakeMetrics {
  const N = 8192;
  const spec = averagedSpectrum(r.final, N);
  const binHz = fs / N;
  const edges = [0, 500, 1500, 4000, fs / 2];
  const e = [0, 0, 0, 0];
  let tot = 0;
  let wsum = 0;
  let band2k = 0;
  let harm = 0;
  for (let k = 1; k < spec.length; k++) {
    const p = spec[k]! * spec[k]!;
    const fr = k * binHz;
    tot += p;
    wsum += p * fr;
    for (let b = 0; b < 4; b++) {
      if (fr >= edges[b]! && fr < edges[b + 1]!) {
        e[b]! += p;
        break;
      }
    }
    if (fr >= 30 && fr <= 2000) {
      band2k += p;
      const m = Math.round(fr / firingHz);
      if (m >= 1 && Math.abs(fr - m * firingHz) <= 0.06 * m * firingHz) harm += p;
    }
  }
  const norm = tot > 0 ? 1 / tot : 0;
  let nPeak = 0;
  let sat = 0;
  let fPeak = 0;
  let stepMax = 0;
  let stepE = 0;
  for (let i = 0; i < r.normalized.length; i++) {
    const a = Math.abs(r.normalized[i]!);
    if (a > nPeak) nPeak = a;
    if (a > 1.5) sat++;
    const b = Math.abs(r.final[i]!);
    if (b > fPeak) fPeak = b;
    if (i > 0) {
      const d = Math.abs(r.final[i]! - r.final[i - 1]!);
      stepE += d * d;
      if (d > stepMax) stepMax = d;
    }
  }
  // the suction has a large mean (mean induction flow): compare the AC parts, which is what is heard
  const tr = acRms(r.tone);
  const hr = acRms(r.hiss);
  const rr = acRms(r.roar);
  const noise = Math.sqrt(hr * hr + rr * rr);
  return {
    toneRms: tr,
    hissRms: hr,
    roarRms: rr,
    noiseOverToneDb: 20 * Math.log10(Math.max(noise, 1e-12) / Math.max(tr, 1e-12)),
    normRms: rms(r.normalized),
    normPeak: nPeak,
    satShare: sat / Math.max(1, r.normalized.length),
    finalRms: rms(r.final),
    finalPeak: fPeak,
    bands: [e[0]! * norm, e[1]! * norm, e[2]! * norm, e[3]! * norm],
    harmonicShare: band2k > 0 ? harm / band2k : 0,
    centroidHz: tot > 0 ? wsum / tot : 0,
    maxStepRatio: stepMax / Math.sqrt(stepE / Math.max(1, r.final.length - 1) + 1e-30),
  };
}
