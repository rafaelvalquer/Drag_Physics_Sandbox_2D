/**
 * Isolated exhaust-channel renderer + metrics (tests, scripts/audio-exhaust-lab.ts).
 * Drives a real VehicleAcoustics voice with steady synthetic telemetry and taps the exhaust chain:
 * radiated (pipe) and jet (turbulence) in Pa, the combined source, the normalized signal before
 * softClip, and the final channel sample.
 */
import { AF } from '../../core/contracts';
import { CHANNEL_COUNT, type AcousticVehicleConfig } from '../dsp/AcousticConfig';
import { VehicleAcoustics } from '../dsp/VehicleAcoustics';
import { averagedSpectrum, rms } from './spectrum';

const H = 1 / 120;

export interface ExhaustRender {
  radiated: Float32Array;
  jet: Float32Array;
  combined: Float32Array;
  normalized: Float32Array;
  final: Float32Array;
  voice: VehicleAcoustics;
}

export interface ExhaustPoint {
  rpm: number;
  load: number;
}

/** Renders `seconds` at an operating point (or a time-varying one); skips `warmupS` at the start. */
export function renderExhaust(cfg: AcousticVehicleConfig, fs: number, point: (t: number) => ExhaustPoint, seconds: number, warmupS = 0.5): ExhaustRender {
  const voice = new VehicleAcoustics(fs, cfg);
  const total = Math.round(seconds * fs);
  const mk = (): Float32Array => new Float32Array(total);
  const radiated = mk();
  const jet = mk();
  const combined = mk();
  const normalized = mk();
  const final = mk();
  let w = 0;
  voice.exhaustTap = (r, j, c, nrm, y) => {
    if (w < total) {
      radiated[w] = r;
      jet[w] = j;
      combined[w] = c;
      normalized[w] = nrm;
      final[w] = y;
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
    f[AF.throttle] = p.load;
    f[AF.load] = p.load;
    f[AF.manifoldPressure] = 101325 * Math.max(0.2, p.load);
    f[AF.combustionEnabled] = 1;
    f[AF.exhaustTempK] = 650 + 450 * p.load * Math.min(1, p.rpm / 6000);
    voice.pushFrame(f);
    acc += fs * H;
    const n = Math.floor(acc);
    acc -= n;
    if (n > 0) voice.render(ch, n);
  }
  const s = Math.round(warmupS * fs);
  const cut = (x: Float32Array): Float32Array => x.subarray(s, Math.min(w, total));
  return { radiated: cut(radiated), jet: cut(jet), combined: cut(combined), normalized: cut(normalized), final: cut(final), voice };
}

export function renderExhaustSteady(cfg: AcousticVehicleConfig, fs: number, rpm: number, load: number, seconds = 2.5): ExhaustRender {
  return renderExhaust(cfg, fs, () => ({ rpm, load }), seconds);
}

export interface ExhaustMetrics {
  radiatedRms: number;
  jetRms: number;
  /** jet / radiated RMS in dB (positive = turbulence louder than the pulses). */
  jetOverRadiatedDb: number;
  normRms: number;
  normPeak: number;
  /** Share of samples with |normalized| above 1.5 (strongly into the soft-clip region). */
  satShare: number;
  finalRms: number;
  finalPeak: number;
  /** Energy share of the final signal per band: <200 Hz, 200–1000, 1000–4000, >4000. */
  bands: [number, number, number, number];
  /** Share of the 30–2000 Hz energy sitting at multiples of the firing frequency (±6 %). */
  harmonicShare: number;
  /** Spectral centroid of the final signal (Hz). */
  centroidHz: number;
}

export function exhaustMetrics(r: ExhaustRender, fs: number, firingHz: number): ExhaustMetrics {
  const N = 8192;
  const spec = averagedSpectrum(r.final, N);
  const binHz = fs / N;
  const edges = [0, 200, 1000, 4000, fs / 2];
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
  for (let i = 0; i < r.normalized.length; i++) {
    const a = Math.abs(r.normalized[i]!);
    if (a > nPeak) nPeak = a;
    if (a > 1.5) sat++;
    const b = Math.abs(r.final[i]!);
    if (b > fPeak) fPeak = b;
  }
  const rr = rms(r.radiated);
  const jj = rms(r.jet);
  return {
    radiatedRms: rr,
    jetRms: jj,
    jetOverRadiatedDb: 20 * Math.log10(Math.max(jj, 1e-12) / Math.max(rr, 1e-12)),
    normRms: rms(r.normalized),
    normPeak: nPeak,
    satShare: sat / Math.max(1, r.normalized.length),
    finalRms: rms(r.final),
    finalPeak: fPeak,
    bands: [e[0]! * norm, e[1]! * norm, e[2]! * norm, e[3]! * norm],
    harmonicShare: band2k > 0 ? harm / band2k : 0,
    centroidHz: tot > 0 ? wsum / tot : 0,
  };
}

/** Firing frequency of a 4-stroke engine: cylinders · rpm / 120. */
export const firingHz = (cylinders: number, rpm: number): number => (cylinders * rpm) / 120;
