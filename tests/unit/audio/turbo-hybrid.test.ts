import { describe, expect, it } from 'vitest';
import { Prng } from '../../../src/core/prng';
import { averagedSpectrum, bandEnergy, peakFrequency, rms } from '../../../src/audio/analysis/spectrum';
import { dB, maxJump, renderTurboScenario, rotorOrderMetrics } from '../../../src/audio/analysis/turboLab';
import { carToAcousticConfig, CH } from '../../../src/audio/dsp/AcousticConfig';
import { AuxAcoustics, type AuxControl } from '../../../src/audio/dsp/AuxAcoustics';
import { TurboAcoustics } from '../../../src/audio/dsp/turbo/TurboAcoustics';
import { ROTOR_CALIBRATION } from '../../../src/audio/dsp/turbo/TurboAcousticProfiles';
import { TURBO_LAYER, type RotorTextureConfig, type TurboAcousticControl } from '../../../src/audio/dsp/turbo/TurboAcousticTypes';
import { TurboRotorWhine, type RotorTargets } from '../../../src/audio/dsp/turbo/TurboRotorWhine';
import { carById, golTurbo } from './turboTestUtils';
import { referenceTurboBuilds } from '../../../src/audio/analysis/turboBuilds';

const FS = 48000;
const SHAFT = 1500;
const BLADES = 6;
const TEXTURE = ROTOR_CALIBRATION['classic-small-turbo'].texture;
const TARGET: RotorTargets = { g1: .22, g2: .10, g3: .03, gB: .55, pulseHz: 0, pulseDepth: 0, am: 1 };
const PROBE: TurboAcousticControl = {
  shaftRpm: 95000, shaftRpm2: 0, boostPa: 75000, throttle: .8, engineLoad: .85,
  omega: 555, engineRunning: true, bovFlow: 0, exhaustTempK: 860,
};

function rotorSignal(
  rate: number, { at = () => SHAFT, config = TEXTURE, quality = 'high', seed = 3, targets = TARGET, tone = 1, noise = 1 }:
  { at?: (s: number) => number; config?: RotorTextureConfig; quality?: 'high' | 'low'; seed?: number; targets?: RotorTargets; tone?: number; noise?: number } = {},
) {
  const rotor = new TurboRotorWhine(rate, BLADES, new Prng(seed), 0, quality === 'low', 0, config, tone, noise);
  const signal = new Float32Array(rate);
  for (let i = 0; i < rate; i++) {
    const f = at(i / rate);
    if ((i & 31) === 0) rotor.setBlock(f, targets, 32);
    signal[i] = rotor.process(f);
  }
  return signal;
}

describe('Turbo 2.1 hybrid rotor', () => {
  for (const rate of [48000, 44100, 32000]) {
    for (const quality of ['high', 'low'] as const) {
      it(`centers the physical orders and removes BPF above Nyquist at ${rate} Hz (${quality})`, () => {
        const n = 8192;
        const x = rotorSignal(rate, { quality });
        const spectrum = averagedSpectrum(x.subarray(rate / 2), n);
        for (const order of [1, 2, ...(quality === 'high' ? [3] : []), BLADES]) {
          const center = SHAFT * order;
          const measured = peakFrequency(spectrum, rate, n, center - 60, center + 60);
          expect(Math.abs(measured - center)).toBeLessThan(rate / n);
        }
        if (quality === 'low') expect(bandEnergy(spectrum, rate, n, SHAFT * 3, 50)).toBeLessThan(1e-6);
        const aliased = (rate / 2 + 1200) / BLADES;
        const xBpf = rotorSignal(rate, { quality, at: () => aliased, targets: { ...TARGET, g1: 0, g2: 0, g3: 0 } });
        expect(rms(xBpf.subarray(rate / 2))).toBeLessThan(1e-8);
        const fundamental = rotorSignal(rate, { quality, at: () => aliased, targets: { ...TARGET, gB: 0 } });
        const full = rotorSignal(rate, { quality, at: () => aliased });
        expect(full.subarray(rate / 2)).toEqual(fundamental.subarray(rate / 2));
      });
    }
  }

  it('adds reproducible, band-limited texture without moving the order centers', () => {
    const targets = { ...TARGET, g2: 0, g3: 0, gB: 0 };
    const x = rotorSignal(FS, { targets, tone: 0 });
    expect(rotorSignal(FS, { targets, tone: 0 })).toEqual(x);
    const other = rotorSignal(FS, { targets, tone: 0, seed: 7 });
    expect(rms(x.map((v, i) => v - other[i]!))).toBeGreaterThan(.02);
    const n = 8192;
    const spec = averagedSpectrum(x.subarray(FS / 2), n);
    const within = bandEnergy(spec, FS, n, SHAFT, 250);
    const entire = spec.reduce((sum, v) => sum + v * v, 0);
    expect(within / entire).toBeGreaterThan(.99);
    const tone = rotorSignal(FS, { targets, noise: 0 });
    const width = (s: Float32Array) => rotorOrderMetrics(averagedSpectrum(s.subarray(FS / 2), n), FS / n, SHAFT, BLADES)['1X']!.width90Hz;
    expect(width(x)).toBeGreaterThan(width(tone) * 2);
  });

  it('preserves level through sample-rate changes within the common passband', () => {
    const levels = [48000, 44100, 32000].map((rate) => dB(rms(rotorSignal(rate).subarray(rate * .2))));
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(.85);
  });

  it('crossfades a live comparison using the same controls and preserves the other sources', () => {
    const config = carToAcousticConfig(golTurbo());
    const test = new AuxAcoustics(FS, config);
    const unchanged = new AuxAcoustics(FS, config);
    const controls: AuxControl = {
      omega: PROBE.omega, throttle: PROBE.throttle, boostPa: PROBE.boostPa, turboShaftRpm: PROBE.shaftRpm,
      bovFlow: 0, vehicleSpeed: 30, wheelSlipSpeed: 2, tireLoadN: 3500,
      gearboxOutputOmega: 120, clutchSlipOmega: 0, transmissionTorque: 250, gear: 2, gearChanged: false,
    };
    let differs = false;
    for (let i = 0; i < 12000; i++) {
      if (i === 6000) test.compareTurbo({ ...config, turboModel: 'v2' });
      if (i === 6001) test.compareTurbo({ ...config, turboModel: 'reduced' });
      test.process(controls);
      unchanged.process(controls);
      if (test.tireOut !== unchanged.tireOut || test.transmissionOut !== unchanged.transmissionOut ||
          test.environmentOut !== unchanged.environmentOut) throw new Error(`Unrelated channel changed at sample ${i}`);
      if (i === 6000) expect(test.turboOut).toBeCloseTo(unchanged.turboOut, 12);
      if (i > 6000 && test.turboOut !== unchanged.turboOut) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('fades the BPF continuously during spool, without spikes or abrupt power steps', () => {
    const targets = { ...TARGET, g1: 0, g2: 0, g3: 0 };
    const at = (s: number) => 1800 + 2200 * s;
    const x = rotorSignal(FS, { at, targets, tone: 1, noise: 0 });
    expect(x.every(Number.isFinite)).toBe(true);
    const step = maxJump(x, 0, x.length);
    expect(step).toBeLessThan(1);
    const powers = Array.from({ length: 50 }, (_, i) => rms(x, i * 960, (i + 1) * 960));
    expect(Math.max(...powers.slice(2).map((p, i) => Math.abs(p - powers[i + 1]!)))).toBeLessThan(.08);
    expect(powers[45]).toBeLessThan(1e-8);
  });

  it('keeps deterministic voices independent when two cars and two rotors are rendered together', () => {
    const twin = referenceTurboBuilds(['nissan-gtr-r35-2015'])[0]!.car;
    const config = carToAcousticConfig(twin, 'high', 11);
    const a = new TurboAcoustics(FS, config);
    const b = new TurboAcoustics(FS, carToAcousticConfig(golTurbo(), 'low', 23));
    const alone = new TurboAcoustics(FS, config);
    const twinControl = { ...PROBE, shaftRpm2: PROBE.shaftRpm };
    let different = 0;
    for (let i = 0; i < 12000; i++) {
      const withOther = a.process(twinControl);
      if (i % 2 === 0) b.process(PROBE);
      if (a.rotorA.narrowbandOut !== a.rotorB!.narrowbandOut) different++;
      if (withOther !== alone.process(twinControl)) throw new Error(`Voice changed at sample ${i}`);
    }
    expect(different).toBeGreaterThan(10000);
  });

  it('exercises the real car configs without leaking turbo audio into an aspirated car', () => {
    for (const [car, expected] of [[golTurbo(), true], [carById('vw-gol-gts-1988'), false]] as const) {
      const config = carToAcousticConfig(car);
      const r = renderTurboScenario({ ...config, turboLayers: TURBO_LAYER.rotor }, FS, 'steady', {
        script: { seconds: .45, at: () => ({ rpm: 5100, throttle: 1 }) },
      });
      expect(rms(r.ch[CH.turbo]!) > 0).toBe(expected);
    }
  });
});
