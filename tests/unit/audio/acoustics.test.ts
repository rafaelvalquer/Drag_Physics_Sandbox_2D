/**
 * Acoustic model tests (offline rendering of the same DSP code that runs in the AudioWorklet).
 * Measurements: autocorrelation pitch, Welch spectra, A-weighted levels, engine-order energies.
 */
import { describe, expect, it } from 'vitest';
import { AF } from '../../../src/core/contracts';
import { LAB_CARS as CARS } from '../../../src/data/cars/index';
import { TRACKS } from '../../../src/data/tracks/index';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';
import { CH, CHANNEL_COUNT } from '../../../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../../../src/audio/dsp/VehicleAcoustics';
import { autocorrelationPitch, averagedSpectrum, aWeightedLevel, bandEnergy, rms } from '../../../src/audio/analysis/spectrum';
import { exhaustPreset } from '../../../src/data/exhaustPresets';
import { H, car, carToAcousticConfig, renderSynthetic, withFiring } from './helpers';
import { exhaustMetrics, firingHz, renderExhaust, renderExhaustSteady } from '../../../src/audio/analysis/exhaustLab';
import { AuxAcoustics } from '../../../src/audio/dsp/AuxAcoustics';
import { NOISE_SCENARIOS, NOISE_SPEEDS_KMH, analyzeSignal, renderNoise, renderSteady, type NoiseScenario, type SignalMetrics } from '../../../src/audio/analysis/noiseLab';

const N = 16384;
const dB = (x: number): number => 20 * Math.log10(Math.max(x, 1e-12));

function exhaustSpectrum(x: Float32Array, fs: number, skipS = 0.4): Float64Array {
  return averagedSpectrum(x.subarray(Math.round(skipS * fs)), N);
}

function aLevel(x: Float32Array, fs: number, skipS = 0.5): number {
  return dB(aWeightedLevel(averagedSpectrum(x.subarray(Math.round(skipS * fs)), 8192), fs, 8192));
}

/** Largest first difference relative to the RMS of the first difference (click detector). */
function maxJumpRatio(x: Float32Array, from: number, to: number): number {
  let s = 0;
  let m = 0;
  for (let i = from + 1; i < to; i++) {
    const d = Math.abs(x[i]! - x[i - 1]!);
    s += d * d;
    if (d > m) m = d;
  }
  return m / Math.sqrt(s / (to - from - 1) + 1e-30);
}

describe('engine acoustics – pitch and firing order', () => {
  for (const c of CARS) {
    for (const fs of [44100, 48000]) {
      it(`${c.id} @ ${fs} Hz: periodic at the engine cycle, fundamental = firing frequency / k`, () => {
        const rpm = 3000;
        const fFire = ((rpm / 60) * c.engine.cylinders) / 2;
        const { ch, voice } = renderSynthetic(carToAcousticConfig(c), fs, 1.6, () => ({ rpm, load: 1 }));
        const x = ch[CH.exhaust]!;
        expect(voice.nanResets).toBe(0);
        const ac = autocorrelationPitch(x, fs, 20, fFire * 1.5, Math.round(0.4 * fs));
        // the period is the firing interval, or a whole number of them (bank / uneven firing)
        const k = fFire / ac.hz;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(0.01 * Math.round(k));
        expect(Math.round(k)).toBeGreaterThanOrEqual(1);
        expect(Math.round(k)).toBeLessThanOrEqual(8);
        // ≥ 90 % of the energy lies on harmonics of the 720° cycle frequency
        const s = exhaustSpectrum(x, fs);
        const fc = rpm / 120;
        let eh = 0;
        let et = 0;
        for (let b = 1; b < s.length; b++) {
          const f = (b * fs) / N;
          const e = s[b]! ** 2;
          et += e;
          const m = f / fc;
          if (Math.abs(m - Math.round(m)) * fc < 4) eh += e;
        }
        expect(eh / et).toBeGreaterThan(0.9);
      });
    }
  }

  it('fundamental follows the crankshaft speed (2000 → 4000 rpm doubles the pitch)', () => {
    const c = car('arco-1600');
    const p = (rpm: number): number => {
      const { ch } = renderSynthetic(carToAcousticConfig(c), 48000, 1.4, () => ({ rpm, load: 1 }));
      return autocorrelationPitch(ch[CH.exhaust]!, 48000, 30, 250, Math.round(0.4 * 48000)).hz;
    };
    const f2 = p(2000);
    const f4 = p(4000);
    expect(f2).toBeCloseTo((2000 / 60) * 2, 0);
    expect(f4 / f2).toBeCloseTo(2, 2);
  });
});

describe('engine acoustics – sample rate independence', () => {
  for (const id of ['vetra-rs', 'kronos-v8', 'tempest-v8']) {
    it(`${id}: same pitch, level and spectral balance at 44.1 and 48 kHz`, () => {
      const c = car(id);
      const res = [44100, 48000].map((fs) => {
        const { ch } = renderSynthetic(carToAcousticConfig(c), fs, 1.6, () => ({ rpm: 4000, load: 1 }));
        const x = ch[CH.exhaust]!;
        const s = exhaustSpectrum(x, fs);
        const bands: number[] = [];
        for (let f0 = 62.5; f0 < 4000; f0 *= 2) {
          let e = 0;
          for (let b = Math.ceil(f0 / (fs / N)); b < (2 * f0) / (fs / N); b++) e += s[b]! ** 2;
          bands.push(10 * Math.log10(e + 1e-30));
        }
        return { pitch: autocorrelationPitch(x, fs, 20, 300, Math.round(0.4 * fs)).hz, a: dB(aWeightedLevel(s, fs, N)), bands };
      });
      const [a, b] = res as [(typeof res)[0], (typeof res)[0]];
      expect(Math.abs(a.pitch / b.pitch - 1)).toBeLessThan(0.003);
      expect(Math.abs(a.a - b.a)).toBeLessThan(1);
      for (let i = 0; i < a.bands.length; i++) expect(Math.abs(a.bands[i]! - b.bands[i]!)).toBeLessThan(2);
    });
  }
});

describe('engine acoustics – firing order character', () => {
  it('cross-plane V8 has strong irregular (half/odd order) content, flat-plane does not', () => {
    const k = car('kronos-v8');
    // same engine with the left bank firing every 180° and the right bank in between (flat-plane)
    const flat = withFiring(k, [0, 90, 180, 270, 360, 450, 540, 630], 'flatplane');
    const metric = (cfg: typeof k): number => {
      const rpm = 3000;
      const fs = 48000;
      const { ch } = renderSynthetic(carToAcousticConfig(cfg), fs, 1.6, () => ({ rpm, load: 1 }));
      const s = exhaustSpectrum(ch[CH.exhaust]!, fs);
      const o = (ord: number): number => bandEnergy(s, fs, N, (rpm / 60) * ord, 4);
      const irregular = [0.5, 1, 1.5, 2.5, 3, 3.5].map(o).reduce((p, q) => p + q, 0);
      const regular = o(2) + o(4);
      return 10 * Math.log10(irregular / regular);
    };
    const cross = metric(k);
    const flatM = metric(flat);
    expect(cross).toBeGreaterThan(0);
    expect(flatM).toBeLessThan(-10);
    expect(cross - flatM).toBeGreaterThan(15);
  });

  it('changing the firing order changes the sound (configurable 720° firing table)', () => {
    const k = car('kronos-v8');
    // a different (valid) cross-plane order: 1-5-4-2-6-3-7-8 with the same banks
    const order = [1, 5, 4, 2, 6, 3, 7, 8];
    const angles = new Array<number>(8);
    order.forEach((cyl, i) => (angles[cyl - 1] = i * 90));
    const alt = withFiring(k, angles, 'crossplane');
    const a = renderSynthetic(carToAcousticConfig(k), 48000, 1.2, () => ({ rpm: 3000, load: 1 })).ch[CH.exhaust]!;
    const b = renderSynthetic(carToAcousticConfig(alt), 48000, 1.2, () => ({ rpm: 3000, load: 1 })).ch[CH.exhaust]!;
    const sa = exhaustSpectrum(a, 48000);
    const sb = exhaustSpectrum(b, 48000);
    let diff = 0;
    let tot = 0;
    for (let i = 1; i < 1400; i++) {
      diff += (sa[i]! - sb[i]!) ** 2;
      tot += sa[i]! ** 2;
    }
    expect(diff / tot).toBeGreaterThan(0.05);
  });
});

describe('engine acoustics – load, spark cut and combustion', () => {
  it('ignition cut lowers the exhaust level and nearly silences combustion noise', () => {
    const c = carToAcousticConfig(car('kronos-v8'));
    const fired = renderSynthetic(c, 48000, 1.5, () => ({ rpm: 5000, load: 1 }));
    const cut = renderSynthetic(c, 48000, 1.5, () => ({ rpm: 5000, load: 1, sparkCut: 1 }));
    expect(aLevel(fired.ch[CH.exhaust]!, 48000) - aLevel(cut.ch[CH.exhaust]!, 48000)).toBeGreaterThan(3);
    expect(aLevel(fired.ch[CH.block]!, 48000) - aLevel(cut.ch[CH.block]!, 48000)).toBeGreaterThan(10);
    expect(cut.voice.engine.firedEvents).toBe(0);
  });

  it('partial spark cut suppresses the commanded fraction of combustion events', () => {
    const c = carToAcousticConfig(car('orion-xr'));
    const { voice } = renderSynthetic(c, 48000, 1.5, () => ({ rpm: 4000, load: 1, sparkCut: 0.5 }));
    const e = voice.engine;
    expect(e.cutEvents / (e.cutEvents + e.firedEvents)).toBeGreaterThan(0.45);
    expect(e.cutEvents / (e.cutEvents + e.firedEvents)).toBeLessThan(0.55);
  });

  it('full throttle is louder than part load at the same speed', () => {
    for (const id of ['arco-1600', 'kronos-v8']) {
      const c = carToAcousticConfig(car(id));
      const wot = renderSynthetic(c, 48000, 1.5, () => ({ rpm: 5000, load: 1 }));
      const part = renderSynthetic(c, 48000, 1.5, () => ({ rpm: 5000, load: 0.3 }));
      expect(aLevel(wot.ch[CH.exhaust]!, 48000) - aLevel(part.ch[CH.exhaust]!, 48000)).toBeGreaterThan(3);
      expect(aLevel(wot.ch[CH.intake]!, 48000)).toBeGreaterThan(aLevel(part.ch[CH.intake]!, 48000));
    }
  });

  it('exhaust presets change the acoustic response (spectral shape), not just the volume', () => {
    const base = car('vetra-rs');
    const octaves = (id: 'stock' | 'sport' | 'straight'): { bands: number[]; a: number } => {
      const c: typeof base = JSON.parse(JSON.stringify(base));
      c.exhaust = { ...exhaustPreset(id, c.exhaust), outputGain: 1 };
      const fs = 48000;
      const x = renderSynthetic(carToAcousticConfig(c), fs, 1.4, () => ({ rpm: 4500, load: 1 })).ch[CH.exhaust]!;
      const s = averagedSpectrum(x.subarray(Math.round(0.4 * fs)), 8192);
      const bands: number[] = [];
      let total = 0;
      for (let f0 = 62.5; f0 < 8000; f0 *= 2) {
        let e = 0;
        for (let k = Math.ceil(f0 / (fs / 8192)); k < (2 * f0) / (fs / 8192); k++) e += s[k]! ** 2;
        bands.push(e);
        total += e;
      }
      // band levels relative to the total: the shape, independent of overall volume
      return { bands: bands.map((e) => 10 * Math.log10(e / total)), a: dB(aWeightedLevel(s, fs, 8192)) };
    };
    const stock = octaves('stock');
    const sport = octaves('sport');
    const straight = octaves('straight');
    const maxShapeDiff = (p: number[], q: number[]): number => Math.max(...p.map((v, i) => Math.abs(v - q[i]!)));
    expect(maxShapeDiff(stock.bands, straight.bands)).toBeGreaterThan(6);
    expect(maxShapeDiff(sport.bands, straight.bands)).toBeGreaterThan(6);
    // stock vs sport differ by 4–5 dB per octave band once the broadband jet no longer fills in the shape
    expect(maxShapeDiff(stock.bands, sport.bands)).toBeGreaterThan(4);
    // fewer chambers and less absorption: louder
    expect(straight.a).toBeGreaterThan(sport.a);
  });
});

describe('engine acoustics – robustness', () => {
  it('rejects non-finite frames and stays finite and bounded under random telemetry', () => {
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const c = carToAcousticConfig(car('vetra-rs'));
    const { ch, voice } = renderSynthetic(
      c,
      48000,
      3,
      () => ({ rpm: 500 + rnd() * 9000, load: rnd() * 1.6, sparkCut: rnd() < 0.2 ? rnd() : 0, combustion: rnd() > 0.05 }),
      {
        noise: (f) => {
          f[AF.turboShaftRpm] = rnd() * 200000;
          f[AF.bovFlow] = rnd() < 0.1 ? rnd() : 0;
          f[AF.wheelSlipSpeed] = rnd() * 20;
          f[AF.tireLoadN] = rnd() * 8000;
          f[AF.vehicleSpeed] = rnd() * 90;
          f[AF.gear] = Math.floor(rnd() * 7);
          f[AF.gearboxOutputOmega] = rnd() * 300;
          f[AF.transmissionTorque] = rnd() * 2000 - 1000;
          f[AF.clutchSlipOmega] = rnd() * 200 - 100;
          f[AF.afterfire] = rnd() < 0.01 ? 1 : 0;
          if (rnd() < 0.02) f[Math.floor(rnd() * AF.length)] = rnd() < 0.5 ? Number.NaN : Number.POSITIVE_INFINITY;
        },
      },
    );
    expect(voice.stream.rejectedFrames).toBeGreaterThan(0);
    for (let k = 0; k < CHANNEL_COUNT; k++) {
      const x = ch[k]!;
      for (let i = 0; i < x.length; i++) {
        expect(Number.isFinite(x[i]!)).toBe(true);
        expect(Math.abs(x[i]!)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a smooth rpm sweep produces no clicks (jumps no larger than in steady running)', () => {
    const c = carToAcousticConfig(car('kronos-v8'));
    const fs = 48000;
    const sweep = renderSynthetic(c, fs, 3, (t) => ({ rpm: 1500 + Math.min(1, Math.max(0, (t - 0.5) / 2)) * 4500, load: 1 }));
    const steady = renderSynthetic(c, fs, 3, () => ({ rpm: 6000, load: 1 }));
    const x = sweep.ch[CH.exhaust]!;
    const y = steady.ch[CH.exhaust]!;
    // largest sample step of the sweep vs the largest step at the top speed (fs-normalized)
    let mx = 0;
    let my = 0;
    for (let i = Math.round(0.5 * fs); i < x.length; i++) {
      mx = Math.max(mx, Math.abs(x[i]! - x[i - 1]!));
      my = Math.max(my, Math.abs(y[i]! - y[i - 1]!));
    }
    expect(mx).toBeLessThan(my * 1.5);
    expect(maxJumpRatio(x, Math.round(0.5 * fs), x.length)).toBeLessThan(12);
  });

  it('fades out when telemetry stops and resumes without a click', () => {
    const c = carToAcousticConfig(car('orion-xr'));
    const fs = 48000;
    const { ch, voice } = renderSynthetic(c, fs, 3.5, () => ({ rpm: 3000, load: 0.8 }), { stopFramesAt: 1.2, resumeFramesAt: 2.2 });
    const x = ch[CH.exhaust]!;
    const before = rms(x, Math.round(0.7 * fs), Math.round(1.2 * fs));
    const silent = rms(x, Math.round(1.9 * fs), Math.round(2.2 * fs));
    const after = rms(x, Math.round(3.0 * fs), Math.round(3.5 * fs));
    expect(before).toBeGreaterThan(1e-3);
    expect(silent).toBeLessThan(before * 0.02);
    expect(after).toBeGreaterThan(before * 0.5);
    expect(voice.stream.resyncs).toBeGreaterThanOrEqual(2);
    // fade-in after the gap: no large step in the first 30 ms
    const i0 = Math.round(2.2 * fs + 0.05 * fs);
    for (let i = i0; i < i0 + Math.round(0.03 * fs); i++) expect(Math.abs(x[i]! - x[i - 1]!)).toBeLessThan(0.05);
  });

  it('a simulation reset (time going backwards) re-synchronizes under a fade', () => {
    const c = carToAcousticConfig(car('arco-1600'));
    const fs = 48000;
    const voice = new VehicleAcoustics(fs, c);
    const out = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(400));
    const f = new Float64Array(AF.length);
    let theta = 0;
    const w = (3000 * 2 * Math.PI) / 60;
    let maxStep = 0;
    let last = 0;
    for (let i = 0; i < 360; i++) {
      const t = (i < 180 ? i : i - 180) * H; // reset at i = 180
      theta = (theta + w * H) % (4 * Math.PI);
      f[AF.simTime] = t;
      f[AF.omega] = w;
      f[AF.crankAngle] = theta;
      f[AF.load] = 1;
      f[AF.throttle] = 1;
      f[AF.manifoldPressure] = 101325;
      f[AF.combustionEnabled] = 1;
      f[AF.exhaustTempK] = 1000;
      voice.pushFrame(f);
      voice.render(out, 400);
      const x = out[CH.exhaust]!;
      for (let j = 0; j < 400; j++) {
        if (i > 170) maxStep = Math.max(maxStep, Math.abs(x[j]! - last));
        last = x[j]!;
      }
    }
    expect(voice.stream.resyncs).toBeGreaterThanOrEqual(2);
    expect(voice.nanResets).toBe(0);
    expect(maxStep).toBeLessThan(0.2);
  });
});

describe('engine acoustics – independence and determinism', () => {
  it('two voices rendered together are bit-identical to each rendered alone', () => {
    const a = carToAcousticConfig(car('kronos-v8'), 'high', 1);
    const b = carToAcousticConfig(car('vetra-rs'), 'high', 2);
    const alone = renderSynthetic(a, 48000, 0.8, () => ({ rpm: 4200, load: 1 })).ch[CH.exhaust]!;
    // interleaved: both voices fed and rendered alternately in the same thread
    const va = new VehicleAcoustics(48000, a);
    const vb = new VehicleAcoustics(48000, b);
    const oa = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(alone.length));
    const ob = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(alone.length));
    const fa = new Float64Array(AF.length);
    const fb = new Float64Array(AF.length);
    let ta = 0;
    let tb = 0;
    let written = 0;
    let acc = 0;
    const wa = (4200 * 2 * Math.PI) / 60;
    const wb = (6100 * 2 * Math.PI) / 60;
    for (let i = 0; written < alone.length; i++) {
      ta = (ta + wa * H) % (4 * Math.PI);
      tb = (tb + wb * H) % (4 * Math.PI);
      for (const [f, th, w] of [
        [fa, ta, wa],
        [fb, tb, wb],
      ] as const) {
        f.fill(0);
        f[AF.simTime] = i * H;
        f[AF.omega] = w;
        f[AF.crankAngle] = th;
        f[AF.throttle] = 1;
        f[AF.load] = 1;
        f[AF.manifoldPressure] = 101325;
        f[AF.combustionEnabled] = 1;
        f[AF.exhaustTempK] = 650 + 450 * Math.min(1, w / ((6000 * 2 * Math.PI) / 60));
      }
      va.pushFrame(fa);
      vb.pushFrame(fb);
      acc += 48000 * H;
      const n = Math.min(Math.floor(acc), alone.length - written);
      acc -= Math.floor(acc);
      va.render(oa, n, written);
      vb.render(ob, n, written);
      written += n;
    }
    expect(Array.from(oa[CH.exhaust]!)).toEqual(Array.from(alone));
    expect(rms(ob[CH.exhaust]!)).toBeGreaterThan(1e-3);
  });

  it('same seed renders identically; another seed differs (cycle variation)', () => {
    const c1 = carToAcousticConfig(car('lince-gt'), 'high', 7);
    const c2 = carToAcousticConfig(car('lince-gt'), 'high', 8);
    const a = renderSynthetic(c1, 44100, 0.6, () => ({ rpm: 3500, load: 1 })).ch[CH.exhaust]!;
    const b = renderSynthetic(c1, 44100, 0.6, () => ({ rpm: 3500, load: 1 })).ch[CH.exhaust]!;
    const d = renderSynthetic(c2, 44100, 0.6, () => ({ rpm: 3500, load: 1 })).ch[CH.exhaust]!;
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(d));
  });

  it('low quality mode renders with fewer segments and stays in the same pitch', () => {
    const c = car('tempest-v8');
    const hi = renderSynthetic(carToAcousticConfig(c, 'high'), 48000, 1.2, () => ({ rpm: 4000, load: 1 }));
    const lo = renderSynthetic(carToAcousticConfig(c, 'low'), 48000, 1.2, () => ({ rpm: 4000, load: 1 }));
    expect(lo.voice.engine.exhaust.segmentCount).toBeLessThan(hi.voice.engine.exhaust.segmentCount);
    const ph = autocorrelationPitch(hi.ch[CH.exhaust]!, 48000, 20, 400, 19200).hz;
    const pl = autocorrelationPitch(lo.ch[CH.exhaust]!, 48000, 20, 400, 19200).hz;
    const k = ph / pl;
    expect(Math.abs(k - Math.round(k))).toBeLessThan(0.02);
  });
});

describe('vehicle acoustics driven by the physics', () => {
  it('start, idle, launch and upshift: finite output, shift dip in combustion noise, gear clunk', () => {
    const c = car('kronos-v8');
    const sim = new VehicleSimulation(c, TRACKS[0]!);
    const fs = 48000;
    const voice = new VehicleAcoustics(fs, carToAcousticConfig(c));
    const per = fs * H;
    const bufs = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(per) + 1));
    const blockLevel: number[] = [];
    const transPeak: number[] = [];
    const states: string[] = [];
    let acc = 0;
    const step = (): void => {
      sim.step(H);
      voice.pushFrame(sim.audioFrame);
      acc += per;
      const n = Math.floor(acc);
      acc -= n;
      voice.resetStats();
      voice.render(bufs, n);
      blockLevel.push(voice.rms(CH.block));
      transPeak.push(voice.peak[CH.transmission]!);
      states.push(sim.shift.state);
      for (let k = 0; k < CHANNEL_COUNT; k++) for (let j = 0; j < n; j++) expect(Number.isFinite(bufs[k]![j]!)).toBe(true);
    };
    for (let i = 0; i < 4 / H; i++) step();
    expect(sim.engine.runState).toBe('RUNNING');
    sim.requestShift(1);
    for (let i = 0; i < 0.4 / H; i++) step();
    sim.controls.pedal = 1;
    let shifted = false;
    for (let i = 0; i < 8 / H && !shifted; i++) {
      step();
      if (!sim.shift.active && sim.gear === 1 && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm > c.engine.redlineRpm - 300) {
        sim.requestShift(1);
        shifted = true;
      }
    }
    expect(shifted).toBe(true);
    const shiftStart = states.length;
    for (let i = 0; i < 0.6 / H; i++) step();
    // the latency of the audio stream is 50 ms (6 frames)
    const lat = 6;
    const cutIdx: number[] = [];
    for (let i = shiftStart; i < states.length; i++) if (states[i] === 'TORQUE_CUT' || states[i] === 'CLUTCH_DISENGAGE' || states[i] === 'GEAR_CHANGE') cutIdx.push(i + lat);
    expect(cutIdx.length).toBeGreaterThan(0);
    const before = blockLevel.slice(shiftStart - 12, shiftStart).reduce((a, b) => a + b, 0) / 12;
    const during = cutIdx.map((i) => blockLevel[i] ?? 0).reduce((a, b) => a + b, 0) / cutIdx.length;
    expect(dB(before) - dB(during)).toBeGreaterThan(6);
    // gear engagement clunk on the transmission channel
    const clunk = Math.max(...transPeak.slice(shiftStart, shiftStart + 50));
    const runningPeak = Math.max(...transPeak.slice(shiftStart - 40, shiftStart - 10));
    expect(clunk).toBeGreaterThan(runningPeak);
    expect(voice.nanResets).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Tyre rolling / skid squeal and wind (environment + tire channels) – regression for the radio-
// static hiss at high speed. Isolated renders at 0…300 km/h, 44.1 and 48 kHz.
// ---------------------------------------------------------------------------------------------
describe('tyre and wind noise (environment + tire channels)', () => {
  const cfg = carToAcousticConfig(car('arco-1600'), 'high', 1);
  const RATES = [44100, 48000] as const;
  const sc = (id: string): NoiseScenario => NOISE_SCENARIOS.find((s) => s.id === id)!;
  type Run = { env: SignalMetrics; tire: SignalMetrics; ch: Float32Array[] };
  const cache = new Map<string, Run>();
  function run(fs: number, kmh: number, id: string): Run {
    const key = `${fs}/${kmh}/${id}`;
    let r = cache.get(key);
    if (!r) {
      const { ch } = renderSteady(cfg, fs, kmh, sc(id));
      r = { env: analyzeSignal(ch[CH.environment]!, fs), tire: analyzeSignal(ch[CH.tire]!, fs), ch };
      cache.set(key, r);
    }
    return r;
  }

  for (const fs of RATES) {
    describe(`@ ${fs} Hz`, () => {
      it('wind alone: finite, no clipping, low-weighted spectrum (no static) and progressive growth', () => {
        let prev = 0;
        for (const kmh of NOISE_SPEEDS_KMH) {
          const { env } = run(fs, kmh, 'roll');
          expect(Number.isFinite(env.rms)).toBe(true);
          expect(env.clipped).toBe(0);
          expect(env.peak).toBeLessThan(0.3);
          if (kmh > 0) {
            expect(env.bands[3]).toBeLessThan(0.01); // < 1 % of the energy above 4 kHz
            expect(env.centroidHz).toBeLessThan(1000);
          }
          expect(env.rms).toBeGreaterThanOrEqual(prev * 0.98);
          prev = env.rms;
        }
        const w40 = run(fs, 40, 'roll').env.rms;
        const w120 = run(fs, 120, 'roll').env.rms;
        const w300 = run(fs, 300, 'roll').env.rms;
        expect(w300).toBeGreaterThan(0.01); // not removed
        expect(w300).toBeLessThan(0.06);
        expect(w40).toBeLessThan(w120 * 0.5);
        expect(w120).toBeLessThan(w300 * 0.5);
      });

      it('rolling noise without skid: low/mid weighted, bounded growth, no squeal band', () => {
        let prev = 0;
        for (const kmh of NOISE_SPEEDS_KMH) {
          const { tire } = run(fs, kmh, 'roll');
          expect(tire.clipped).toBe(0);
          expect(tire.peak).toBeLessThan(0.4);
          if (kmh > 0) {
            expect(tire.bands[0] + tire.bands[1]).toBeGreaterThan(0.9);
            expect(tire.bands[3]).toBeLessThan(0.02);
            expect(tire.centroidHz).toBeLessThan(700);
          }
          expect(tire.rms).toBeGreaterThanOrEqual(prev * 0.98);
          prev = tire.rms;
        }
        // 40 → 300 km/h grows by less than 16 dB (the old v^1.5 law gave ≈ 29 dB)
        expect(dB(run(fs, 300, 'roll').tire.rms) - dB(run(fs, 40, 'roll').tire.rms)).toBeLessThan(16);
        expect(run(fs, 300, 'roll').tire.rms).toBeLessThan(0.08);
      });

      it('normal wheel/ground speed mismatch at high speed does not squeal, heavy slip does', () => {
        for (const kmh of [120, 180, 240, 300]) {
          const roll = run(fs, kmh, 'roll').tire;
          const heavy = run(fs, kmh, 'slip-heavy').tire;
          expect(heavy.aLevelDb - roll.aLevelDb).toBeGreaterThan(5);
          // squeal puts real energy above 1.5 kHz that the rolling noise lacks
          expect(heavy.bands[2] + heavy.bands[3]).toBeGreaterThan(5 * (roll.bands[2] + roll.bands[3]));
        }
      });

      it('light slip sits between rolling and intense slip; burnouts stay clearly audible', () => {
        for (const kmh of NOISE_SPEEDS_KMH) {
          const roll = run(fs, kmh, 'roll').tire.rms;
          const light = run(fs, kmh, 'slip-light').tire.rms;
          const heavy = run(fs, kmh, 'slip-heavy').tire.rms;
          expect(light).toBeGreaterThan(roll * 0.99);
          expect(heavy).toBeGreaterThan(light * 0.99);
          expect(heavy).toBeGreaterThan(0.03);
        }
        expect(run(fs, 0, 'slip-heavy').tire.bands[2]).toBeGreaterThan(0.2);
      });

      it('wind + tyres together, and all channels combined: bounded, no clipping, no hiss dominance', () => {
        const mixAll = [0.8, 0.7, 1, 0.8, 0.8, 0.6, 0.5];
        for (const kmh of NOISE_SPEEDS_KMH) {
          for (const id of ['roll', 'slip-light', 'slip-heavy']) {
            const { ch, env, tire } = run(fs, kmh, id);
            const n = ch[0]!.length;
            const wt = new Float32Array(n);
            const all = new Float32Array(n);
            for (let i = 0; i < n; i++) {
              wt[i] = ch[CH.environment]![i]! * 0.5 + ch[CH.tire]![i]! * 0.8;
              let s = 0;
              for (let k = 0; k < ch.length; k++) s += ch[k]![i]! * mixAll[k]!;
              all[i] = s * 0.35;
            }
            const m = analyzeSignal(wt, fs);
            const a = analyzeSignal(all, fs);
            expect(m.clipped).toBe(0);
            expect(a.clipped).toBe(0);
            expect(a.peak).toBeLessThan(1);
            expect(Number.isFinite(a.rms)).toBe(true);
            expect(env.clipped + tire.clipped).toBe(0);
            if (kmh > 0) expect(m.bands[3]).toBeLessThan(id === 'roll' ? 0.02 : 0.12);
          }
        }
      });

      it('at 300 km/h the engine stays clearly more audible than wind + rolling noise (sport exhaust car)', () => {
        const { ch } = renderSteady(carToAcousticConfig(car('lince-gt'), 'high', 1), fs, 300, sc('roll'));
        const mix = [0.8, 0.7, 1, 0.8, 0.8, 0.6, 0.5];
        const level = (k: number): number => aLevel(ch[k]!, fs, 0) + dB(mix[k]!);
        const engine = Math.max(level(CH.exhaust), level(CH.intake), level(CH.block));
        expect(engine).toBeGreaterThan(level(CH.environment) + 6);
        expect(engine).toBeGreaterThan(level(CH.tire) + 3);
      });
    });
  }

  it('44.1 and 48 kHz give the same level and spectral balance', () => {
    for (const kmh of [40, 120, 300]) {
      for (const id of ['roll', 'slip-heavy']) {
        const a = run(44100, kmh, id);
        const b = run(48000, kmh, id);
        expect(Math.abs(dB(a.env.rms) - dB(b.env.rms))).toBeLessThan(1);
        expect(Math.abs(dB(a.tire.rms) - dB(b.tire.rms))).toBeLessThan(1.2);
        expect(Math.abs(a.tire.centroidHz / b.tire.centroidHz - 1)).toBeLessThan(0.1);
        expect(Math.abs(a.env.centroidHz / b.env.centroidHz - 1)).toBeLessThan(0.1);
      }
    }
  });

  it('rolling and skid are separate internal sources and the skid gate uses the slip ratio', () => {
    const fs = 48000;
    const probe = (v: number, slip: number): { roll: number; skid: number } => {
      const aux = new AuxAcoustics(fs, cfg);
      const c = {
        omega: 300,
        throttle: 1,
        boostPa: 0,
        turboShaftRpm: 0,
        bovFlow: 0,
        vehicleSpeed: v,
        wheelSlipSpeed: slip,
        tireLoadN: 4000,
        gearboxOutputOmega: 0,
        clutchSlipOmega: 0,
        transmissionTorque: 0,
        gear: 0,
        gearChanged: false,
      };
      let roll = 0;
      let skid = 0;
      for (let i = 0; i < fs; i++) {
        aux.process(c);
        if (i > fs / 2) {
          roll = Math.max(roll, Math.abs(aux.tireRollOut));
          skid = Math.max(skid, Math.abs(aux.tireSlipOut));
        }
      }
      return { roll, skid };
    };
    const normal = probe(83, 1.7); // 300 km/h, 2 % mismatch: above the old 0.3 m/s threshold
    expect(normal.skid).toBeLessThan(1e-3);
    expect(normal.roll).toBeGreaterThan(0.1);
    const burnout = probe(0, 15);
    expect(burnout.skid).toBeGreaterThan(0.5);
    expect(burnout.roll).toBe(0);
    expect(probe(83, 30).skid).toBeGreaterThan(0.5); // ratio 0.36 and 30 m/s: real skid at speed
    expect(probe(83, 3).skid).toBeLessThan(0.02); // 3.6 % ratio: below the ratio gate
  });

  it('is continuous: a 0→300 km/h sweep and slip on/off steps produce no clicks', () => {
    const fs = 48000;
    const steady = run(fs, 120, 'roll');
    const steadyJump = Math.max(steady.env.maxJumpRatio, steady.tire.maxJumpRatio);
    const sweep = renderNoise(cfg, { sampleRate: fs, seconds: 8, speed: (t) => (Math.min(1, t / 6) * 300) / 3.6, slip: sc('roll').slip });
    for (const k of [CH.environment, CH.tire]) {
      const m = analyzeSignal(sweep.ch[k]!.subarray(Math.round(0.3 * fs)), fs);
      expect(m.maxJumpRatio).toBeLessThan(Math.max(steadyJump, 6) * 1.5);
      expect(m.clipped).toBe(0);
    }
    // slip appears at t = 2 s and disappears at t = 4 s at 200 km/h (slip callback is called once per 120 Hz frame)
    let calls = 0;
    const stepped = renderNoise(cfg, {
      sampleRate: fs,
      seconds: 6,
      speed: () => 200 / 3.6,
      slip: (v) => {
        const t = calls++ / 120;
        return t >= 2 && t < 4 ? 0.4 * v : 0.015 * v;
      },
    });
    const m = analyzeSignal(stepped.ch[CH.tire]!.subarray(Math.round(0.3 * fs)), fs);
    expect(m.maxJumpRatio).toBeLessThan(12);
    const seg = (a: number, b: number): number => rms(stepped.ch[CH.tire]!, Math.round(a * fs), Math.round(b * fs));
    expect(seg(2.6, 3.8)).toBeGreaterThan(seg(0.8, 1.8) * 1.5);
    expect(seg(5, 6)).toBeLessThan(seg(2.6, 3.8) * 0.75);
    expect(seg(5, 6)).toBeLessThan(seg(0.8, 1.8) * 1.3);
  });
});

// ---------------------------------------------------------------------------------------------
// Exhaust channel: tailpipe jet turbulence must stay a discreet layer under the pipe pulses
// (regression for the radio-static hiss at high rpm and load, which came from the v⁴ jet term
// overwhelming the radiated pulses – most strongly with the narrow stock tailpipe).
// ---------------------------------------------------------------------------------------------
describe('exhaust channel: jet turbulence vs pulses near the redline', () => {
  const ids = ['arco-1600', 'vetra-rs', 'lince-gt', 'kronos-v8'];
  const presetIds = ['stock', 'sport', 'straight'] as const;
  const cfgOf = (id: string, preset?: (typeof presetIds)[number]) => {
    const base = car(id);
    const c: typeof base = JSON.parse(JSON.stringify(base));
    if (preset) c.exhaust = exhaustPreset(preset, c.exhaust);
    return { c, cfg: carToAcousticConfig(c, 'high', 1) };
  };
  const redline = (id: string): number => car(id).engine.redlineRpm - 150;

  for (const fs of [44100, 48000]) {
    it(`@ ${fs} Hz: finite, bounded and no hiss at 1000…redline, 25/50/100 % load, every preset`, () => {
      for (const id of ids) {
        for (const preset of presetIds) {
          const { c, cfg } = cfgOf(id, preset);
          for (const rpm of [1000, 3000, 4500, redline(id)]) {
            for (const load of [0.25, 0.5, 1]) {
              const r = renderExhaustSteady(cfg, fs, rpm, load, 1.6);
              for (const sig of [r.radiated, r.jet, r.normalized, r.final]) for (let i = 0; i < sig.length; i += 7) expect(Number.isFinite(sig[i]!)).toBe(true);
              const m = exhaustMetrics(r, fs, firingHz(c.engine.cylinders, rpm));
              expect(r.voice.nanResets).toBe(0);
              expect(m.finalPeak).toBeLessThanOrEqual(1);
              if (preset !== 'straight') expect(m.finalPeak).toBeLessThan(0.9);
              if (load === 1 && rpm > 3000) {
                // turbulence is a discreet layer: well below the pulses (it was up to +40 dB above them)
                expect(m.jetOverRadiatedDb).toBeLessThan(-8);
              }
              // almost no energy above 4 kHz (static region) – the old stock jet had ~25 %
              expect(m.bands[3]).toBeLessThan(0.06);
            }
          }
        }
      }
    });
  }

  it('the stock pipe keeps a low spectral centroid at full load (old centroid was 3–4 kHz)', () => {
    for (const fs of [44100, 48000]) {
      for (const id of ids) {
        const { c, cfg } = cfgOf(id, 'stock');
        for (const rpm of [4500, redline(id)]) {
          const m = exhaustMetrics(renderExhaustSteady(cfg, fs, rpm, 1), fs, firingHz(c.engine.cylinders, rpm));
          expect(m.centroidHz).toBeLessThan(900);
        }
      }
    }
  });

  it('no strong saturation before the soft clip (headroom), including the straight pipe', () => {
    for (const id of ids) {
      for (const preset of presetIds) {
        const { cfg } = cfgOf(id, preset);
        const m = exhaustMetrics(renderExhaustSteady(cfg, 48000, redline(id), 1), 48000, 100);
        if (preset !== 'straight') {
          expect(m.normPeak).toBeLessThan(1.5);
          expect(m.satShare).toBeLessThan(0.001);
        } else {
          expect(m.normPeak).toBeLessThan(3.2);
          expect(m.satShare).toBeLessThan(0.25);
        }
      }
    }
  });

  it('turbulence grows in a controlled way with load and rpm (monotonic, saturating, never above the pulses)', () => {
    for (const id of ['arco-1600', 'kronos-v8']) {
      const { cfg } = cfgOf(id, 'stock');
      let prev = 0;
      for (const load of [0.25, 0.5, 0.75, 1]) {
        const r = renderExhaustSteady(cfg, 48000, redline(id), load, 1.6);
        const j = rms(r.jet);
        expect(j).toBeGreaterThanOrEqual(prev * 0.9);
        expect(j).toBeLessThan(rms(r.radiated) * 0.5);
        prev = j;
      }
    }
  });

  it('pulse periodicity is preserved (4-cylinder: harmonics of the firing frequency dominate)', () => {
    for (const id of ['arco-1600', 'vetra-rs']) {
      const { c, cfg } = cfgOf(id);
      for (const rpm of [3000, 4500, redline(id)]) {
        const r = renderExhaustSteady(cfg, 48000, rpm, 1);
        const right = exhaustMetrics(r, 48000, firingHz(c.engine.cylinders, rpm)).harmonicShare;
        const wrong = exhaustMetrics(r, 48000, firingHz(c.engine.cylinders, rpm) * 1.37).harmonicShare;
        expect(right).toBeGreaterThan(0.85);
        expect(right).toBeGreaterThan(wrong + 0.3);
      }
    }
  });

  it('engines keep their signature: different cylinder count/firing order give different pitch content', () => {
    const rpm = 4500;
    const a = cfgOf('arco-1600');
    const b = cfgOf('kronos-v8');
    const ra = renderExhaustSteady(a.cfg, 48000, rpm, 1).final;
    const rb = renderExhaustSteady(b.cfg, 48000, rpm, 1).final;
    const pa = autocorrelationPitch(ra, 48000, 40, 400, 0, 8192);
    // the 4-cylinder fires at 150 Hz at 4500 rpm and repeats strongly each engine cycle
    expect(Math.abs(pa.hz / 150 - 1)).toBeLessThan(0.1);
    const sa = averagedSpectrum(ra, 8192);
    const sb = averagedSpectrum(rb, 8192);
    const hz = 48000 / 8192;
    const fire4 = bandEnergy(sa, 48000, 8192, 150, 8) / bandEnergy(sb, 48000, 8192, 150, 8);
    expect(fire4).toBeGreaterThan(3);
    // the V8 (cross-plane) has strong content at half-orders that the 4-cylinder lacks
    const half = (s: Float64Array): number => bandEnergy(s, 48000, 8192, 37.5, 2 * hz) / bandEnergy(s, 48000, 8192, 150, 8);
    expect(half(sb)).toBeGreaterThan(half(sa));
  });

  it('responds to the throttle: load raises the level, lifting off lowers it', () => {
    const { cfg } = cfgOf('arco-1600');
    const full = rms(renderExhaustSteady(cfg, 48000, 6000, 1).final);
    const part = rms(renderExhaustSteady(cfg, 48000, 6000, 0.25).final);
    expect(dB(full) - dB(part)).toBeGreaterThan(2);
  });

  it('the three presets stay distinct and ordered: stock < sport < straight in level, with different spectra', () => {
    for (const id of ['vetra-rs', 'lince-gt']) {
      const lv: number[] = [];
      const cent: number[] = [];
      for (const p of presetIds) {
        const { c, cfg } = cfgOf(id, p);
        const m = exhaustMetrics(renderExhaustSteady(cfg, 48000, 4500, 1), 48000, firingHz(c.engine.cylinders, 4500));
        lv.push(dB(m.radiatedRms));
        cent.push(m.centroidHz);
      }
      expect(lv[1]).toBeGreaterThan(lv[0]! + 6);
      expect(lv[2]).toBeGreaterThan(lv[1]! + 6);
      expect(new Set(cent.map((x) => Math.round(x / 20))).size).toBeGreaterThan(1);
    }
  });

  it('44.1 and 48 kHz agree in level, turbulence share and spectral balance', () => {
    for (const id of ids) {
      const { cfg: c1 } = cfgOf(id, 'stock');
      const a = renderExhaustSteady(c1, 44100, redline(id), 1);
      const b = renderExhaustSteady(c1, 48000, redline(id), 1);
      const ma = exhaustMetrics(a, 44100, 100);
      const mb = exhaustMetrics(b, 48000, 100);
      expect(Math.abs(dB(ma.finalRms) - dB(mb.finalRms))).toBeLessThan(1.5);
      expect(Math.abs(ma.jetOverRadiatedDb - mb.jetOverRadiatedDb)).toBeLessThan(3);
      expect(Math.abs(ma.centroidHz / mb.centroidHz - 1)).toBeLessThan(0.15);
    }
  });

  it('continuous across rpm and load changes, and through the rev limiter: no clicks, no amplitude jumps', () => {
    const fs = 48000;
    const maxStepRatio = (x: Float32Array, from = 0.4): number => {
      const s = Math.round(from * fs);
      let m = 0;
      let e = 0;
      for (let i = s + 1; i < x.length; i++) {
        const d = Math.abs(x[i]! - x[i - 1]!);
        e += d * d;
        if (d > m) m = d;
      }
      return m / Math.sqrt(e / (x.length - s - 1) + 1e-30);
    };
    for (const id of ['arco-1600', 'kronos-v8']) {
      const { cfg } = cfgOf(id);
      const steady = renderExhaustSteady(cfg, fs, 4500, 1, 3);
      const base = maxStepRatio(steady.final);
      // rpm sweep with a load step in the middle
      const sweep = renderExhaust(cfg, fs, (t) => ({ rpm: 1500 + (t / 4) * (redline(id) - 1500), load: t < 2 ? 0.3 : 1 }), 4);
      expect(maxStepRatio(sweep.final)).toBeLessThan(Math.max(base, 6) * 2);
      // limiter: rpm bouncing against the redline (fuel cut → load drops and returns)
      const lim = renderExhaust(cfg, fs, (t) => ({ rpm: redline(id), load: Math.floor(t * 12) % 2 === 0 ? 1 : 0.05 }), 3);
      expect(maxStepRatio(lim.final)).toBeLessThan(Math.max(base, 6) * 2.5);
      // 100 ms windowed RMS never jumps by more than 12 dB between neighbours in the sweep
      const w = Math.round(0.1 * fs);
      let prev = rms(sweep.final, 0, w);
      for (let i = w; i + w <= sweep.final.length; i += w) {
        const cur = rms(sweep.final, i, i + w);
        expect(Math.abs(dB(cur) - dB(prev))).toBeLessThan(12);
        prev = cur;
      }
    }
  });

  it('runs two engines at once without interference (jet and pulses bit-identical to solo)', () => {
    const fs = 48000;
    const { cfg: ca } = cfgOf('arco-1600');
    const { cfg: cb } = cfgOf('kronos-v8');
    const solo = renderExhaustSteady(ca, fs, 6000, 1, 1.2);
    const together = renderExhaustSteady(ca, fs, 6000, 1, 1.2);
    renderExhaustSteady(cb, fs, 5000, 1, 1.2); // a second voice rendered in between
    for (let i = 0; i < solo.final.length; i += 13) {
      expect(together.final[i]).toBe(solo.final[i]);
      expect(together.jet[i]).toBe(solo.jet[i]);
    }
  });
});
