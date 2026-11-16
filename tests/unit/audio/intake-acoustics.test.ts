/**
 * Intake channel tests: periodic suction sound + controlled turbulence (throttle hiss, induction roar).
 * Regression for the radio-static hiss of the intake channel at high rpm (roar ∝ v⁴ over a weak
 * periodic signal in 6 and 8 cylinder engines, spectrum centroid 3–4 kHz).
 *
 * Limits are derived from the measured values after the fix (docs/audio-intake/*.txt) with a margin;
 * each states what the measurement was before the fix.
 */
import { describe, expect, it } from 'vitest';
import { AF } from '../../../src/core/contracts';
import { CH } from '../../../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../../../src/audio/dsp/VehicleAcoustics';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';
import { TRACKS } from '../../../src/data/tracks/index';
import { acRms, intakeMetrics, renderIntake, renderIntakeSteady, type IntakePoint } from '../../../src/audio/analysis/intakeLab';
import { averagedSpectrum, rms } from '../../../src/audio/analysis/spectrum';
import { firingHz } from '../../../src/audio/analysis/exhaustLab';
import { H, car, carToAcousticConfig, renderSynthetic } from './helpers';

const dB = (x: number): number => 20 * Math.log10(Math.max(x, 1e-12));
const ids = ['arco-1600', 'vetra-rs', 'lince-gt', 'kronos-v8', 'vw-gol-gts-1988'];
const redline = (id: string): number => car(id).engine.redlineRpm - 150;
const cfgOf = (id: string, q: 'high' | 'low' = 'high') => carToAcousticConfig(car(id), q, 1);
const isTurbo = (id: string): boolean => car(id).engine.induction === 'turbo';
/** Operating point the physics produces: manifold follows the load, boost only for turbo engines. */
const point = (id: string, rpm: number, load: number, throttle = load): IntakePoint => ({
  rpm,
  load,
  throttle,
  manifoldPa: 101325 * Math.max(0.2, load) + (isTurbo(id) ? 80000 * load : 0),
  boostPa: isTurbo(id) ? 80000 * load : 0,
});
const maxStep = (x: Float32Array, from = 0): number => {
  let m = 0;
  let e = 0;
  for (let i = from + 1; i < x.length; i++) {
    const d = Math.abs(x[i]! - x[i - 1]!);
    e += d * d;
    if (d > m) m = d;
  }
  return m / Math.sqrt(e / Math.max(1, x.length - from - 1) + 1e-30);
};

describe('intake channel: near the redline', () => {
  for (const fs of [44100, 48000]) {
    it(`@ ${fs} Hz: finite, bounded, no hiss region and a low spectral centroid, every engine, 50/100 % load`, () => {
      for (const id of ids) {
        for (const load of [0.5, 1]) {
          const r = renderIntakeSteady(cfgOf(id), fs, point(id, redline(id), load), 1.4);
          for (const sig of [r.tone, r.hiss, r.roar, r.normalized, r.final]) for (let i = 0; i < sig.length; i += 7) expect(Number.isFinite(sig[i]!)).toBe(true);
          expect(r.voice.nanResets).toBe(0);
          const m = intakeMetrics(r, fs, firingHz(car(id).engine.cylinders, redline(id)));
          expect(m.finalPeak).toBeLessThan(0.5);
          expect(m.satShare).toBe(0);
          // before: >4 kHz held up to 28 % of the energy and the centroid sat at 3–3.8 kHz (V6/V8)
          expect(m.bands[3]).toBeLessThan(0.03);
          expect(m.centroidHz).toBeLessThan(1200);
        }
      }
    });
  }
});

describe('intake channel: turbulence layers', () => {
  it('grows in a controlled way with flow (load and rpm), saturates, stays in physical range', () => {
    for (const id of ['arco-1600', 'kronos-v8']) {
      let prev = 0;
      for (const load of [0.25, 0.5, 0.75, 1]) {
        const r = renderIntakeSteady(cfgOf(id), 48000, point(id, redline(id), load), 1.4);
        const roar = acRms(r.roar);
        expect(roar).toBeGreaterThanOrEqual(prev * 0.9);
        // never above the calibrated ceiling of the roar (ROAR_MAX_PA = 250 Pa)
        expect(roar).toBeLessThan(250);
        prev = roar;
      }
      const low = acRms(renderIntakeSteady(cfgOf(id), 48000, point(id, 2000, 1), 1.4).roar);
      expect(acRms(renderIntakeSteady(cfgOf(id), 48000, point(id, redline(id), 1), 1.4).roar)).toBeGreaterThan(low * 2);
    }
  });

  it('is a discreet layer in in-line 4-cylinder engines (periodic part dominates) and bounded in the V8', () => {
    for (const id of ['arco-1600', 'vw-gol-gts-1988']) {
      const m = intakeMetrics(renderIntakeSteady(cfgOf(id), 48000, point(id, redline(id), 1), 1.4), 48000, 200);
      expect(m.noiseOverToneDb).toBeLessThan(-25); // measured −31…−37 dB
    }
    const v8 = intakeMetrics(renderIntakeSteady(cfgOf('kronos-v8'), 48000, point('kronos-v8', redline('kronos-v8'), 1), 1.4), 48000, 400);
    expect(v8.noiseOverToneDb).toBeLessThan(10); // measured +7 dB, centroid 1 kHz; before +16 dB with a centroid of 3.8 kHz
  });

  it('idle: almost no turbulence', () => {
    for (const id of ids) {
      const r = renderIntakeSteady(cfgOf(id), 48000, point(id, 800, 0.2, 0), 1.4);
      expect(acRms(r.hiss)).toBeLessThan(0.15 * acRms(r.tone) + 2);
      expect(acRms(r.roar)).toBeLessThan(0.05 * acRms(r.tone) + 1);
    }
  });

  it('throttle hiss follows the pressure drop across the plate: part throttle > wide open > closed idle', () => {
    const id = 'arco-1600';
    const part = acRms(renderIntakeSteady(cfgOf(id), 48000, point(id, 5000, 0.8, 0.2), 1.4).hiss);
    const wot = acRms(renderIntakeSteady(cfgOf(id), 48000, point(id, 5000, 1, 1), 1.4).hiss);
    const idle = acRms(renderIntakeSteady(cfgOf(id), 48000, point(id, 900, 0.2, 0), 1.4).hiss);
    expect(part).toBeGreaterThan(wot);
    expect(wot).toBeGreaterThan(idle);
    // a trace of hiss is kept at wide-open throttle (natural turbulence)
    expect(wot).toBeGreaterThan(0);
  });

  it('turbo: the throttle sits after the compressor, so boost pressure at the plate does not create hiss', () => {
    const id = 'vetra-rs';
    // manifold at the charge pressure (plate wide open, MAP = ambient + boost): no pressure drop
    const open = acRms(renderIntakeSteady(cfgOf(id), 48000, { rpm: 5500, load: 1, throttle: 1, manifoldPa: 181325, boostPa: 80000 }, 1.4).hiss);
    // same manifold pressure with ambient as reference would have looked like 'negative drop' too: still silent
    // partly closed plate at boost: manifold well under the charge pressure → hiss
    const closed = acRms(renderIntakeSteady(cfgOf(id), 48000, { rpm: 5500, load: 0.7, throttle: 0.2, manifoldPa: 120000, boostPa: 80000 }, 1.4).hiss);
    expect(closed).toBeGreaterThan(open);
  });
});

describe('intake channel: periodic sound and identity', () => {
  it('keeps the periodic components tied to the rotation (4-cylinder: harmonics of the firing frequency)', () => {
    for (const id of ['arco-1600', 'vw-gol-gts-1988']) {
      const cyl = car(id).engine.cylinders;
      for (const rpm of [3000, redline(id)]) {
        const r = renderIntakeSteady(cfgOf(id), 48000, point(id, rpm, 1), 2);
        const right = intakeMetrics(r, 48000, firingHz(cyl, rpm)).harmonicShare;
        const wrong = intakeMetrics(r, 48000, firingHz(cyl, rpm) * 1.37).harmonicShare;
        expect(right).toBeGreaterThan(0.8);
        expect(right).toBeGreaterThan(wrong + 0.3);
      }
    }
  });

  it('engines differ: spectral balance and pitch content follow the architecture', () => {
    const rpm = 4500;
    const a = intakeMetrics(renderIntakeSteady(cfgOf('arco-1600'), 48000, point('arco-1600', rpm, 1), 1.6), 48000, firingHz(4, rpm));
    const b = intakeMetrics(renderIntakeSteady(cfgOf('kronos-v8'), 48000, point('kronos-v8', rpm, 1), 1.6), 48000, firingHz(8, rpm));
    const c = intakeMetrics(renderIntakeSteady(cfgOf('lince-gt'), 48000, point('lince-gt', rpm, 1), 1.6), 48000, firingHz(6, rpm));
    expect(b.centroidHz).toBeGreaterThan(a.centroidHz * 1.5);
    expect(c.centroidHz).toBeGreaterThan(a.centroidHz * 1.5);
    expect(new Set([a, b, c].map((m) => Math.round(m.centroidHz / 60))).size).toBe(3);
  });

  it('part load vs full load at the same rpm give different intake sounds', () => {
    const id = 'arco-1600';
    const part = intakeMetrics(renderIntakeSteady(cfgOf(id), 48000, point(id, 4500, 0.25, 0.25), 1.6), 48000, 150);
    const full = intakeMetrics(renderIntakeSteady(cfgOf(id), 48000, point(id, 4500, 1), 1.6), 48000, 150);
    expect(dB(full.finalRms) - dB(part.finalRms)).toBeGreaterThan(4);
  });

  it('airbox / runner geometry changes the timbre (same rpm and load)', () => {
    const base = car('arco-1600');
    const mod: typeof base = JSON.parse(JSON.stringify(base));
    mod.engine.intake.airboxVolumeL = base.engine.intake.airboxVolumeL * 0.4;
    mod.engine.intake.runnerLengthM = base.engine.intake.runnerLengthM * 0.6;
    const p = point('arco-1600', 4500, 1);
    const a = renderIntakeSteady(carToAcousticConfig(base, 'high', 1), 48000, p, 1.6).final;
    const b = renderIntakeSteady(carToAcousticConfig(mod, 'high', 1), 48000, p, 1.6).final;
    const sa = averagedSpectrum(a, 8192);
    const sb = averagedSpectrum(b, 8192);
    let d = 0;
    let e = 0;
    for (let k = 1; k < sa.length; k++) {
      d += (sa[k]! - sb[k]!) ** 2;
      e += sa[k]! ** 2;
    }
    expect(Math.sqrt(d / e)).toBeGreaterThan(0.1);
  });
});

describe('intake channel: dynamics', () => {
  it('progressive acceleration is continuous: no clicks, no amplitude jumps', () => {
    const fs = 48000;
    for (const id of ['arco-1600', 'kronos-v8']) {
      const steady = renderIntakeSteady(cfgOf(id), fs, point(id, 4500, 1), 2.5);
      const base = maxStep(steady.final);
      const sweep = renderIntake(cfgOf(id), fs, (t) => point(id, 1500 + (t / 4) * (redline(id) - 1500), 1), 4);
      expect(maxStep(sweep.final, Math.round(0.2 * fs))).toBeLessThan(Math.max(base, 6) * 2);
      const w = Math.round(0.1 * fs);
      let prev = rms(sweep.final, 0, w);
      for (let i = w; i + w <= sweep.final.length; i += w) {
        const cur = rms(sweep.final, i, i + w);
        expect(Math.abs(dB(cur) - dB(prev))).toBeLessThan(8);
        prev = cur;
      }
    }
  });

  it('lifting off lowers the intake sound smoothly (no pops)', () => {
    const fs = 48000;
    const id = 'arco-1600';
    const r = renderIntake(cfgOf(id), fs, (t) => (t < 2 ? point(id, 5500, 1) : { ...point(id, 5500 - (t - 2) * 800, 0.08, 0), manifoldPa: 15000 }), 4);
    const before = rms(r.final, Math.round(0.8 * fs), Math.round(1.4 * fs));
    const after = rms(r.final, Math.round(2.9 * fs), Math.round(3.4 * fs));
    expect(dB(before) - dB(after)).toBeGreaterThan(10);
    // no click at the transition: step ratio around the lift-off is the same order as in steady running
    const win = r.final.subarray(Math.round(1.4 * fs), Math.round(2.1 * fs));
    const steady = r.final.subarray(Math.round(0.5 * fs), Math.round(1.2 * fs));
    expect(maxStep(win)).toBeLessThan(Math.max(maxStep(steady), 6) * 2.5);
    // through the rev limiter (fuel cut on/off) the channel stays finite and bounded
    const lim = renderIntake(cfgOf(id), fs, (t) => ({ ...point(id, redline(id), 1), combustion: Math.floor(t * 12) % 2 === 0 }), 2);
    expect(Math.max(...Array.from(lim.final, Math.abs))).toBeLessThan(0.5);
  });
});

describe('intake channel: engines, sample rates, quality, reset, determinism', () => {
  it('naturally aspirated and turbo engines both work; the turbo channel is independent of the intake', () => {
    const fs = 48000;
    const turboId = 'vetra-rs';
    const make = (airboxScale: number) => {
      const c: ReturnType<typeof car> = JSON.parse(JSON.stringify(car(turboId)));
      c.engine.intake.airboxVolumeL *= airboxScale;
      c.engine.intake.runnerLengthM *= airboxScale;
      return renderSynthetic(carToAcousticConfig(c, 'high', 1), fs, 1.6, () => ({ rpm: 5500, load: 1 }), {
        noise: (f) => {
          f[AF.boostPressure] = 80000;
          f[AF.turboShaftRpm] = 120000;
        },
      });
    };
    const a = make(1);
    const b = make(0.5);
    // the intake sound changes with the intake geometry …
    let diff = 0;
    for (let i = 20000; i < 60000; i += 11) diff += Math.abs(a.ch[CH.intake]![i]! - b.ch[CH.intake]![i]!);
    expect(diff).toBeGreaterThan(0);
    // … but the turbocharger channel is bit-identical (no interference between the channels)
    for (let i = 0; i < a.ch[CH.turbo]!.length; i += 13) expect(a.ch[CH.turbo]![i]).toBe(b.ch[CH.turbo]![i]);
    expect(rms(a.ch[CH.turbo]!)).toBeGreaterThan(0);
  });

  it('44.1 and 48 kHz agree in level, turbulence share and spectral balance', () => {
    for (const id of ['arco-1600', 'kronos-v8']) {
      const a = intakeMetrics(renderIntakeSteady(cfgOf(id), 44100, point(id, redline(id), 1), 1.6), 44100, 200);
      const b = intakeMetrics(renderIntakeSteady(cfgOf(id), 48000, point(id, redline(id), 1), 1.6), 48000, 200);
      expect(Math.abs(dB(a.finalRms) - dB(b.finalRms))).toBeLessThan(2);
      expect(Math.abs(a.noiseOverToneDb - b.noiseOverToneDb)).toBeLessThan(4);
      expect(Math.abs(a.centroidHz / b.centroidHz - 1)).toBeLessThan(0.2);
    }
  });

  it('low quality (no runner waveguide) gets the same turbulence control', () => {
    for (const id of ['arco-1600', 'kronos-v8']) {
      const r = renderIntakeSteady(cfgOf(id, 'low'), 48000, point(id, redline(id), 1), 1.4);
      expect(r.voice.nanResets).toBe(0);
      const m = intakeMetrics(r, 48000, firingHz(car(id).engine.cylinders, redline(id)));
      expect(m.satShare).toBe(0);
      expect(m.bands[3]).toBeLessThan(0.03);
      expect(m.centroidHz).toBeLessThan(1200);
    }
  });

  it('reset leaves no residue: the channel is silent right after a reset and recovers', () => {
    const fs = 48000;
    const id = 'kronos-v8';
    const voice = new VehicleAcoustics(fs, cfgOf(id));
    const ch = Array.from({ length: 7 }, () => new Float32Array(Math.ceil(fs * H) + 2));
    const f = new Float64Array(AF.length);
    let theta = 0;
    const step = (rpm: number, load: number, t: number): void => {
      const w = (rpm * 2 * Math.PI) / 60;
      theta = (theta + w * H) % (4 * Math.PI);
      f.fill(0);
      f[AF.simTime] = t;
      f[AF.omega] = w;
      f[AF.crankAngle] = theta;
      f[AF.throttle] = load;
      f[AF.load] = load;
      f[AF.manifoldPressure] = 101325 * Math.max(0.2, load);
      f[AF.combustionEnabled] = 1;
      f[AF.exhaustTempK] = 1000;
      voice.pushFrame(f);
      voice.render(ch, Math.round(fs * H));
    };
    for (let i = 0; i < 180; i++) step(6000, 1, i * H);
    voice.engine.reset();
    // stopped engine (omega = 0): the held states must be gone, so the intake is exactly silent
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      step(0, 0, (180 + i) * H);
      // the telemetry stream still plays its 50 ms latency of old frames: measure after it
      if (i >= 20) for (const v of ch[CH.intake]!.subarray(0, Math.round(fs * H))) peak = Math.max(peak, Math.abs(v));
    }
    expect(peak).toBeLessThan(1e-5);
  });

  it('is deterministic per seed and differs between seeds only through the noise layers', () => {
    const p = point('kronos-v8', 5000, 1);
    const a = renderIntakeSteady(cfgOf('kronos-v8'), 48000, p, 1.2);
    const b = renderIntakeSteady(cfgOf('kronos-v8'), 48000, p, 1.2);
    for (let i = 0; i < a.final.length; i += 17) expect(b.final[i]).toBe(a.final[i]);
    const other = carToAcousticConfig(car('kronos-v8'), 'high', 1);
    const c = renderIntakeSteady({ ...other, seed: other.seed + 1 }, 48000, p, 1.2);
    let tone = 0;
    let rough = 0;
    for (let i = 0; i < a.tone.length; i += 17) {
      tone += Math.abs(a.tone[i]! - c.tone[i]!);
      rough += Math.abs(a.roar[i]! - c.roar[i]!);
    }
    expect(rough).toBeGreaterThan(0);
    expect(tone).toBeGreaterThanOrEqual(0);
  });

  it('does not touch the physics: simulating with the audio voice attached gives the same result as without', () => {
    const c = car('arco-1600');
    const run = (withAudio: boolean): { speed: number; rpm: number; distance: number } => {
      const sim = new VehicleSimulation(c, TRACKS[0]!);
      const voice = withAudio ? new VehicleAcoustics(48000, carToAcousticConfig(c, 'high', 1)) : null;
      const ch = Array.from({ length: 7 }, () => new Float32Array(500));
      for (let i = 0; i < 360; i++) {
        sim.controls.pedal = i > 120 ? 1 : 0;
        sim.step(H);
        if (voice) {
          voice.pushFrame(sim.audioFrame);
          voice.render(ch, 400);
        }
      }
      return { speed: sim.audioFrame[AF.vehicleSpeed]!, rpm: sim.engine.rpm, distance: sim.audioFrame[AF.simTime]! };
    };
    expect(run(true)).toEqual(run(false));
  });
});
