import { describe, expect, it } from 'vitest';
import { CH } from '../../../src/audio/dsp/AcousticConfig';
import { magnitudeSpectrum } from '../../../src/audio/analysis/spectrum';
import { renderTurboSteady } from '../../../src/audio/analysis/turboLab';
import type { AuxAcoustics } from '../../../src/audio/dsp/AuxAcoustics';
import { carById, dB, rmsOf, v2 } from './turboTestUtils';

const FS = 48000;
const gtr = carById('nissan-gtr-r35-2015');

function rotorOnly(car = gtr, a = 150000, b = 150000): { x: Float32Array; aux: AuxAcoustics } {
  const cfg = { ...v2(car), turboLayers: 1 }; // rotor layer only
  const r = renderTurboSteady(cfg, FS, a, 0.8 * car.engine.turbo!.maxBoostBar * 1e5, 1.5, b);
  return { x: r.ch[CH.turbo]!.subarray(Math.round(0.5 * FS)), aux: r.voice.aux };
}

describe('Turbo Acoustics 2.0 — parallel twin turbo', () => {
  it('two independent rotors (own phase / voice); twin-scroll stays ONE rotor', () => {
    expect(rotorOnly().aux.turbo!.rotorB).not.toBeNull();
    const n20 = rotorOnly(carById('bmw-320i-f30-2014'), 150000, 0).aux.turbo!;
    expect(n20.rotorB).toBeNull();
    expect(n20.profile.housing).toBe('twin-scroll');
    expect(n20.profile.twin).toBe(false);
  });

  it('different rotor speeds show two separate blade-pass lines that follow the physics difference', () => {
    const { x } = rotorOnly(gtr, 120000, 114000);
    const n = 32768;
    const spec = magnitudeSpectrum(x, n, 0);
    const at = (f: number): number => spec[Math.round((f * n) / FS)]!;
    const fA = (120000 / 60) * 6;
    const fB = (114000 / 60) * 6;
    const between = at((fA + fB) / 2);
    expect(dB(at(fA))).toBeGreaterThan(dB(between) + 20);
    expect(dB(at(fB))).toBeGreaterThan(dB(between) + 20);
  });

  it('energy is normalized: the pair is not twice as loud as one rotor', () => {
    const pair = rmsOf(rotorOnly(gtr, 150000, 147000).x);
    const one = rmsOf(rotorOnly(gtr, 150000, 0).x); // rotor B stopped
    // each rotor carries 1/√2: two rotors add power (+3 dB over one running alone), never +6 dB
    // (a doubled voice); the pair is then as loud as a single turbo of the same class
    expect(dB(pair) - dB(one)).toBeGreaterThan(1.5);
    expect(dB(pair) - dB(one)).toBeLessThan(4.5);
  });

  it('a rotor near zero and equal speeds stay finite', () => {
    for (const [a, b] of [[150000, 200], [150000, 150000], [0, 0]] as const) {
      const { x } = rotorOnly(gtr, a, b);
      expect(x.every(Number.isFinite)).toBe(true);
    }
  });
});
