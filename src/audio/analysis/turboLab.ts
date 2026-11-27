/**
 * Turbo Acoustics lab: scripted turbocharger telemetry, isolated renders of the `turbo` channel and
 * the spectral / temporal metrics used by scripts/audio-turbo-lab.ts, scripts/audio-turbo-report.ts
 * and the turbo regression tests.
 *
 * The synthetic scenarios do NOT invent shaft speed or boost: they drive the game's own reduced-order
 * `Turbocharger` (src/physics/engine/Turbocharger.ts) with a scripted engine speed / throttle /
 * exhaust-flow schedule, so spool lag, wastegate cap, BOV venting and the twin-rotor mismatch are the
 * ones the physics produces. `renderTurboPhysics` (turboPhysics.ts) uses the full VehicleSimulation.
 */
import { AF } from '../../core/contracts';
import { Turbocharger } from '../../physics/engine/Turbocharger';
import type { TurboConfig } from '../../data/schema';
import { CH, CHANNEL_COUNT, type AcousticVehicleConfig } from '../dsp/AcousticConfig';
import { VehicleAcoustics } from '../dsp/VehicleAcoustics';
import { averagedSpectrum, aWeightedLevel, magnitudeSpectrum, rms } from './spectrum';

export const H = 1 / 120;

export const TURBO_SCENARIOS = ['steady', 'spool-sweep', 'tip-out', 'gear-shift', 'twin', 'stress', 'idle', 'engine-off'] as const;
export type TurboScenarioId = (typeof TURBO_SCENARIOS)[number];

/** One scripted control point (engine side). */
export interface TurboScript {
  rpm: number;
  throttle: number;
  /** Engine running (combustion). */
  running?: boolean;
  gear?: number;
}

/** Per physics frame record of the turbo state (for order tracking and event metrics). */
export interface TurboFrameMeta {
  t: number;
  shaftRpm: number;
  shaftRpm2: number;
  boostPa: number;
  bovFlow: number;
  throttle: number;
  rpm: number;
}

export interface TurboRender {
  ch: Float32Array[];
  meta: TurboFrameMeta[];
  voice: VehicleAcoustics;
  sampleRate: number;
}

/** Scenario scripts (engine rpm and throttle over time). Durations in seconds. */
export function scenarioScript(id: TurboScenarioId, redline: number, idle: number): { seconds: number; at: (t: number) => TurboScript } {
  const r = redline;
  switch (id) {
    case 'steady':
      return { seconds: 4, at: () => ({ rpm: 0.8 * r, throttle: 1, gear: 3 }) };
    case 'spool-sweep':
      // third-gear pull from low rpm to the redline: the rotor spools with the exhaust flow
      return { seconds: 7, at: (t) => ({ rpm: idle + 600 + (r - idle - 600) * Math.min(1, t / 6.2), throttle: t < 0.3 ? 0.2 : 1, gear: 3 }) };
    case 'tip-out':
      // full load, then the throttle snaps shut at 3 s (BOV / flutter), reopened at 5.2 s
      return {
        seconds: 6.5,
        at: (t) => ({ rpm: t < 3 ? Math.min(0.85 * r, 0.45 * r + t * 0.2 * r) : Math.max(0.35 * r, 0.85 * r - (t - 3) * 0.15 * r), throttle: t < 3 ? 1 : t < 5.2 ? 0 : 1, gear: 3 }),
      };
    case 'gear-shift': {
      // WOT pulls with 0.22 s lifts at each shift: the rotor keeps most of its speed
      const shifts = [2.2, 4.4];
      return {
        seconds: 6,
        at: (t) => {
          let seg = 0;
          for (const s of shifts) if (t >= s) seg++;
          const t0 = seg === 0 ? 0 : shifts[seg - 1]!;
          const lift = shifts.some((s) => t >= s - 0.22 && t < s);
          const rpm0 = seg === 0 ? 0.5 * r : 0.68 * r;
          const rpm = Math.min(0.97 * r, rpm0 + (t - t0) * 0.22 * r);
          return { rpm, throttle: lift ? 0 : 1, gear: 2 + seg };
        },
      };
    }
    case 'twin':
      return { seconds: 6, at: (t) => ({ rpm: 0.4 * r + 0.55 * r * Math.min(1, t / 4), throttle: t < 4.5 ? 1 : 0, gear: 3 }) };
    case 'stress':
      // fast alternating WOT / closed throttle at the redline (extreme but reachable operating points)
      return { seconds: 5, at: (t) => ({ rpm: r * (0.9 + 0.08 * Math.sin(t * 7)), throttle: Math.floor(t * 2.7) % 2 === 0 ? 1 : 0, gear: 4 }) };
    case 'idle':
      return { seconds: 3, at: () => ({ rpm: idle, throttle: 0.02, gear: 0 }) };
    case 'engine-off':
      // full load, then the engine dies at 2 s: the rotor coasts down, no sustained sound
      return { seconds: 5, at: (t) => ({ rpm: t < 2 ? 0.8 * r : Math.max(0, 0.8 * r * (1 - (t - 2) * 1.5)), throttle: t < 2 ? 1 : 0, running: t < 2, gear: 3 }) };
  }
}

/**
 * Scripted telemetry: the engine side comes from the script, the turbo state from the physics
 * Turbocharger driven with an exhaust flow ∝ rpm × throttle × charge density (a lab approximation of
 * the engine's mass flow, normalized so WOT at the redline with full boost is the reference flow).
 */
export function renderTurboScenario(
  cfg: AcousticVehicleConfig,
  sampleRate: number,
  scenario: TurboScenarioId,
  opts: { turbo?: TurboConfig; mutate?: (f: Float64Array, t: number) => void; script?: { seconds: number; at: (t: number) => TurboScript }; tap?: VehicleAcoustics['turboTap'] } = {},
): TurboRender {
  const e = cfg.engine;
  const tc = opts.turbo ?? e.turbo;
  if (scenario === 'steady' && !opts.mutate && !opts.script && tc) {
    // constant rotor speed and pressure (isolated analysis): 75 % of max shaft speed, 80 % of max boost
    const rpm = 0.75 * tc.maxShaftRpm;
    const boost = 0.8 * tc.maxBoostBar * 1e5;
    opts = { ...opts, mutate: (f) => { f[AF.turboShaftRpm] = rpm; f[AF.turboShaftRpm2] = tc.layout === 'parallel-twin' ? rpm * 0.985 : 0; f[AF.boostPressure] = boost; f[AF.bovFlow] = 0; } };
  }
  const sc = opts.script ?? scenarioScript(scenario, e.redlineRpm, e.idleRpm);
  const voice = new VehicleAcoustics(sampleRate, cfg);
  voice.turboTap = opts.tap ?? null;
  const total = Math.round(sc.seconds * sampleRate);
  const ch = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(total));
  const f = new Float64Array(AF.length);
  const meta: TurboFrameMeta[] = [];
  const turbo = tc ? new Turbocharger(tc, 1) : null;
  let theta = 0;
  let written = 0;
  let acc = 0;
  let throttleEff = 0;
  const steps = Math.ceil(sc.seconds / H);
  const tmp = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(sampleRate * H) + 2));
  for (let i = 0; i < steps; i++) {
    const t = i * H;
    const p = sc.at(t);
    const running = p.running !== false;
    throttleEff += (p.throttle - throttleEff) * (1 - Math.exp(-H / 0.04));
    const w = (p.rpm * 2 * Math.PI) / 60;
    theta = (theta + w * H) % (4 * Math.PI);
    if (turbo) {
      const boostBar = Math.max(0, turbo.boostPa) / 1e5;
      const flow = running ? (p.rpm / e.redlineRpm) * (0.08 + 0.92 * throttleEff) * ((1 + boostBar) / (1 + tc!.maxBoostBar)) : 0;
      turbo.update(H, flow, throttleEff, running ? 0.6 + 0.4 * throttleEff : 0.3);
    }
    f.fill(0);
    f[AF.simTime] = t;
    f[AF.omega] = w;
    f[AF.crankAngle] = theta;
    f[AF.throttle] = throttleEff;
    f[AF.load] = running ? Math.max(0.05, throttleEff) : 0;
    f[AF.manifoldPressure] = 101325 * Math.max(0.25, throttleEff) + (turbo ? Math.max(0, turbo.boostPa) * throttleEff : 0);
    f[AF.boostPressure] = turbo ? turbo.boostPa : 0;
    f[AF.combustionEnabled] = running ? 1 : 0;
    f[AF.exhaustTempK] = 650 + 450 * throttleEff * Math.min(1, p.rpm / 6000);
    f[AF.turboShaftRpm] = turbo ? turbo.shaftRpm : 0;
    f[AF.turboShaftRpm2] = turbo ? turbo.shaftRpm2 : 0;
    f[AF.bovFlow] = turbo ? turbo.bovFlow : 0;
    f[AF.gear] = p.gear ?? 3;
    f[AF.vehicleSpeed] = (p.gear ?? 0) > 0 ? p.rpm / 150 : 0;
    f[AF.tireLoadN] = 4000;
    opts.mutate?.(f, t);
    voice.pushFrame(f);
    meta.push({ t, shaftRpm: f[AF.turboShaftRpm]!, shaftRpm2: f[AF.turboShaftRpm2]!, boostPa: f[AF.boostPressure]!, bovFlow: f[AF.bovFlow]!, throttle: f[AF.throttle]!, rpm: p.rpm });
    acc += sampleRate * H;
    const n = Math.min(Math.floor(acc), total - written);
    acc -= Math.floor(acc);
    if (n > 0) {
      voice.render(tmp, n);
      for (let k = 0; k < CHANNEL_COUNT; k++) ch[k]!.set(tmp[k]!.subarray(0, n), written);
      written += n;
    }
  }
  return { ch, meta, voice, sampleRate };
}

/** Steady turbo state at an exact shaft speed and boost (no spool dynamics), for isolated analysis. */
export function renderTurboSteady(cfg: AcousticVehicleConfig, sampleRate: number, shaftRpm: number, boostPa: number, seconds = 2, shaftRpm2?: number): TurboRender {
  const r = cfg.engine.redlineRpm;
  return renderTurboScenario(cfg, sampleRate, 'steady', {
    script: { seconds, at: () => ({ rpm: 0.8 * r, throttle: 1, gear: 3 }) },
    mutate: (f) => {
      f[AF.turboShaftRpm] = shaftRpm;
      f[AF.turboShaftRpm2] = shaftRpm2 ?? (cfg.engine.turbo?.layout === 'parallel-twin' ? shaftRpm : 0);
      f[AF.boostPressure] = boostPa;
      f[AF.bovFlow] = 0;
    },
  });
}

// ---------------------------------------------------------------- metrics

export const TURBO_BANDS_HZ: readonly [number, number][] = [
  [20, 700],
  [700, 2000],
  [2000, 4500],
  [4500, 8000],
  [8000, 24000],
];

export interface TurboMetrics {
  rms: number;
  peak: number;
  clipped: number;
  nonFinite: number;
  centroidHz: number;
  /** Energy share per TURBO_BANDS_HZ band (sums to ≈ 1). */
  bands: number[];
  /** Tonal-to-noise ratio (dB): energy of prominent spectral peaks vs the remaining energy. */
  tonalToNoiseDb: number;
  /** Strongest component (Hz) of the averaged spectrum. */
  dominantHz: number;
  /** Spectral flatness (0 = pure tones, 1 = white noise). */
  flatness: number;
  /** A-weighted level (dB re full scale) – the loudness proxy used to level-match A/B renders. */
  aLevelDb: number;
}

export const dB = (x: number): number => 20 * Math.log10(Math.max(1e-12, x));

/** Splits a magnitude spectrum into prominent peaks (> `prominenceDb` above the local median) and the rest. */
export function tonalSplit(spec: Float64Array, prominenceDb = 10, halfWindow = 40): { tonal: number; noise: number } {
  const n = spec.length;
  const k = 10 ** (prominenceDb / 20);
  let tonal = 0;
  let noise = 0;
  const win: number[] = [];
  for (let i = 1; i < n; i++) {
    win.length = 0;
    for (let j = Math.max(1, i - halfWindow); j < Math.min(n, i + halfWindow); j += 3) win.push(spec[j]!);
    win.sort((a, b) => a - b);
    const med = win[win.length >> 1] ?? 0;
    const e = spec[i]! * spec[i]!;
    if (spec[i]! > med * k) tonal += e;
    else noise += e;
  }
  return { tonal, noise };
}

export function turboMetrics(x: Float32Array, sampleRate: number, start = 0, end = x.length): TurboMetrics {
  const seg = x.subarray(start, end);
  let peak = 0;
  let clipped = 0;
  let nonFinite = 0;
  for (let i = 0; i < seg.length; i++) {
    const v = seg[i]!;
    if (!Number.isFinite(v)) {
      nonFinite++;
      continue;
    }
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
  }
  const n = 4096;
  const spec = seg.length >= n ? averagedSpectrum(seg, n) : magnitudeSpectrum(seg, n);
  const binHz = sampleRate / n;
  let e = 0;
  let ef = 0;
  let logSum = 0;
  let linSum = 0;
  let best = 1;
  const bands = TURBO_BANDS_HZ.map(() => 0);
  for (let k = 1; k < spec.length; k++) {
    const p = spec[k]! * spec[k]!;
    const fk = k * binHz;
    e += p;
    ef += p * fk;
    logSum += Math.log(p + 1e-30);
    linSum += p;
    if (spec[k]! > spec[best]!) best = k;
    for (let b = 0; b < bands.length; b++) if (fk >= TURBO_BANDS_HZ[b]![0] && fk < TURBO_BANDS_HZ[b]![1]) bands[b]! += p;
  }
  const m = spec.length - 1;
  const flatness = linSum > 0 ? Math.exp(logSum / m) / (linSum / m) : 1;
  const split = tonalSplit(spec);
  return {
    rms: rms(seg),
    peak,
    clipped,
    nonFinite,
    centroidHz: e > 0 ? ef / e : 0,
    bands: bands.map((b) => (e > 0 ? b / e : 0)),
    tonalToNoiseDb: 10 * Math.log10((split.tonal + 1e-30) / (split.noise + 1e-30)),
    dominantHz: best * binHz,
    flatness,
    aLevelDb: dB(aWeightedLevel(spec, sampleRate, n)),
  };
}

/**
 * Order tracking: for analysis windows across the render, compares the energy around k × shaft
 * frequency (k = 1, 2, 3 and the blade-pass order) with the energy of the neighbouring bins.
 * Returns the mean prominence (dB) per order over the windows where the order is below 0.85·Nyquist.
 */
export function orderTracking(r: TurboRender, blades: number, opts: { channel?: number; window?: number; fromS?: number } = {}): Record<string, number> {
  const x = r.ch[opts.channel ?? CH.turbo]!;
  const fs = r.sampleRate;
  const n = opts.window ?? 4096;
  const binHz = fs / n;
  const orders: [string, number][] = [
    ['1X', 1],
    ['2X', 2],
    ['3X', 3],
    ['BPF', blades],
  ];
  const acc: Record<string, { s: number; c: number }> = {};
  for (const [name] of orders) acc[name] = { s: 0, c: 0 };
  for (let s = Math.round((opts.fromS ?? 0.5) * fs); s + n <= x.length; s += n) {
    const tMid = (s + n / 2) / fs;
    const fr = r.meta[Math.min(r.meta.length - 1, Math.round(tMid / H))]!;
    const f1 = fr.shaftRpm / 60;
    if (f1 < 100) continue;
    const spec = magnitudeSpectrum(x, n, s);
    for (const [name, k] of orders) {
      const f = f1 * k;
      if (f > fs * 0.42) continue;
      const kc = Math.round(f / binHz);
      let on = 0;
      for (let j = kc - 3; j <= kc + 3; j++) on = Math.max(on, spec[j] ?? 0);
      let off = 0;
      let c = 0;
      for (let j = kc - 40; j <= kc + 40; j++) {
        if (Math.abs(j - kc) < 8 || j < 1 || j >= spec.length) continue;
        off += spec[j]!;
        c++;
      }
      off /= Math.max(1, c);
      acc[name]!.s += dB(on / Math.max(1e-12, off));
      acc[name]!.c++;
    }
  }
  const out: Record<string, number> = {};
  for (const [name] of orders) out[name] = acc[name]!.c > 0 ? acc[name]!.s / acc[name]!.c : NaN;
  return out;
}

/** RMS envelope (dB) in `hopS` steps (for flutter-rate and decay analysis). */
export function envelope(x: Float32Array, sampleRate: number, hopS = 0.005, start = 0, end = x.length): Float64Array {
  const hop = Math.max(1, Math.round(hopS * sampleRate));
  const out = new Float64Array(Math.floor((end - start) / hop));
  for (let i = 0; i < out.length; i++) out[i] = rms(x, start + i * hop, start + (i + 1) * hop);
  return out;
}

/**
 * Dominant amplitude-modulation rate (Hz) of an envelope in [fMin, fMax] by autocorrelation of the
 * mean-removed envelope; `strength` is the normalized correlation at that lag.
 */
export function modulationRate(env: Float64Array, hopS: number, fMin = 4, fMax = 40): { hz: number; strength: number } {
  const n = env.length;
  // detrend with a moving average longer than the slowest period (the decay is not a modulation)
  const half = Math.max(1, Math.round(1 / (fMin * hopS) / 2));
  const d = Array.from(env, (v, i) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      s += env[j]!;
      c++;
    }
    return v - s / c;
  });
  let e0 = 0;
  for (const v of d) e0 += v * v;
  const lagMin = Math.max(1, Math.floor(1 / (fMax * hopS)));
  const lagMax = Math.min(n - 2, Math.ceil(1 / (fMin * hopS)));
  // first local maximum of the autocorrelation (the period), not the always-high shortest lag
  const rs = new Float64Array(lagMax + 2);
  for (let lag = 1; lag <= lagMax + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += d[i]! * d[i + lag]!;
    rs[lag] = s / (e0 + 1e-30);
  }
  let best = lagMin;
  let bestR = -2;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const peak = rs[lag]! >= rs[lag - 1]! && rs[lag]! >= rs[lag + 1]!;
    if (peak && rs[lag]! > bestR) {
      bestR = rs[lag]!;
      best = lag;
    }
  }
  return { hz: 1 / (best * hopS), strength: bestR };
}

/** Largest sample-to-sample step relative to the local RMS (click detector). */
export function maxJump(x: Float32Array, start = 0, end = x.length): number {
  let m = 0;
  for (let i = start + 1; i < end; i++) {
    const d = Math.abs(x[i]! - x[i - 1]!);
    if (d > m) m = d;
  }
  return m;
}

/** Weighted mono mix of channels (e.g. DEFAULT_MIX weights). */
export function mixChannels(ch: Float32Array[], weights: readonly number[]): Float32Array {
  const n = ch[0]!.length;
  const out = new Float32Array(n);
  for (let k = 0; k < ch.length; k++) {
    const w = weights[k] ?? 0;
    if (!w) continue;
    const c = ch[k]!;
    for (let i = 0; i < n; i++) out[i]! += c[i]! * w;
  }
  return out;
}
