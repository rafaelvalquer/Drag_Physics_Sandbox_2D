import { describe, expect, it } from 'vitest';
import { Prng } from '../../../src/core/prng';
import { magnitudeSpectrum } from '../../../src/audio/analysis/spectrum';
import { partialGain, TurboRotorWhine, type RotorTargets } from '../../../src/audio/dsp/turbo/TurboRotorWhine';

const BLADES = 6;
const T: RotorTargets = { g1: 1, g2: 1, g3: 1, gB: 1, pulseHz: 0, pulseDepth: 0, am: 1 };

function render(fs: number, rpm: number | ((t: number) => number), seconds = 0.5, lowQuality = false): Float32Array {
  const r = new TurboRotorWhine(fs, BLADES, new Prng(3), 0, lowQuality);
  const n = Math.round(seconds * fs);
  const out = new Float32Array(n);
  const at = typeof rpm === 'number' ? () => rpm : rpm;
  for (let i = 0; i < n; i++) {
    const hz = at(i / fs) / 60;
    if ((i & 31) === 0) r.setBlock(hz, T, 32);
    out[i] = r.process(hz);
  }
  return out;
}

const level = (spec: Float64Array, fs: number, n: number, f: number): number => {
  const k = Math.round((f * n) / fs);
  let m = 0;
  for (let j = k - 2; j <= k + 2; j++) m = Math.max(m, spec[j] ?? 0);
  return m;
};
const dB = (x: number): number => 20 * Math.log10(Math.max(1e-12, x));

describe('Turbo Acoustics 2.0 — rotor orders', () => {
  for (const fs of [44100, 48000, 96000]) {
    for (const rpm of [20000, 50000, 100000, 150000, 200000, 240000]) {
      it(`${rpm} rpm @ ${fs} Hz: orders at k·N/60, each faded before Nyquist, nothing folds back`, () => {
        const x = render(fs, rpm, 0.6);
        const n = 16384;
        const spec = magnitudeSpectrum(x, n, x.length - n);
        const f1 = rpm / 60;
        const floor = Math.max(...Array.from(spec)) * 1e-4; // −80 dB re the strongest partial
        for (const k of [1, 2, 3, BLADES]) {
          const f = f1 * k;
          const expectGain = partialGain(f, fs / 2);
          if (f < fs / 2 && expectGain > 0.9 && f > 600) expect(dB(level(spec, fs, n, f)), `${k}X present`).toBeGreaterThan(dB(floor) + 40);
          if (f >= fs / 2 || expectGain === 0) {
            // an order above the fade must not appear, neither at f nor folded at fs − f
            const alias = Math.abs(fs - f) < fs / 2 ? fs - f : NaN;
            if (Number.isFinite(alias) && alias > 100) expect(level(spec, fs, n, alias), `${k}X alias`).toBeLessThan(floor * 10);
          }
        }
        // the fundamental stays when the blade-pass order is faded out
        if (f1 * BLADES > 18500 && f1 > 600) expect(level(spec, fs, n, f1)).toBeGreaterThan(floor * 100);
      });
    }
  }

  it('phase is continuous through a fast sweep (no step larger than the slope bound)', () => {
    const fs = 48000;
    const x = render(fs, (t) => 30000 + 200000 * t, 1);
    let maxStep = 0;
    for (let i = 1; i < x.length; i++) maxStep = Math.max(maxStep, Math.abs(x[i]! - x[i - 1]!));
    // |d/dt Σ a·sin(kωt)| ≤ Σ a·kω; the faded partials only lower it
    const fMax = (230000 / 60) * (1 + 2 + 3);
    expect(maxStep).toBeLessThan(((2 * Math.PI * fMax) / fs) * 1.2 + 0.05);
    expect(x.every(Number.isFinite)).toBe(true);
  });

  it('amplitude changes are interpolated: a target step never clicks', () => {
    const fs = 48000;
    const r = new TurboRotorWhine(fs, BLADES, new Prng(1), 0, false);
    let prev = 0;
    let stepAtSwitch = 0;
    let steadyStep = 0;
    const sw = fs / 4;
    for (let i = 0; i < fs / 2; i++) {
      const g = i < sw ? 0 : 1; // abrupt target step
      if ((i & 31) === 0) r.setBlock(1500, { ...T, g1: g, g2: g, g3: g, gB: g }, 32);
      const y = r.process(1500);
      const d = Math.abs(y - prev);
      if (i >= sw && i < sw + 64) stepAtSwitch = Math.max(stepAtSwitch, d);
      if (i > sw + 4800) steadyStep = Math.max(steadyStep, d);
      prev = y;
    }
    // the onset is a ramp over one block: no step larger than the steady waveform's own slope
    expect(stepAtSwitch).toBeLessThanOrEqual(steadyStep * 1.05);
  });

  it('44.1 and 48 kHz give the same signature (level within 0.5 dB at 150 krpm)', () => {
    const rms = (x: Float32Array): number => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
    const a = rms(render(44100, 150000, 0.5).subarray(4410));
    const b = rms(render(48000, 150000, 0.5).subarray(4800));
    expect(Math.abs(dB(a) - dB(b))).toBeLessThan(0.5);
  });

  it('low quality drops the third order but keeps 1X, 2X and blade-pass', () => {
    const fs = 48000;
    const n = 16384;
    const x = render(fs, 60000, 0.6, true);
    const spec = magnitudeSpectrum(x, n, x.length - n);
    const f1 = 1000;
    expect(level(spec, fs, n, 3 * f1)).toBeLessThan(level(spec, fs, n, 2 * f1) * 0.01);
    expect(level(spec, fs, n, BLADES * f1)).toBeGreaterThan(0.1);
  });
});
