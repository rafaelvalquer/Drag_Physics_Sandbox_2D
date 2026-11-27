import { describe, expect, it } from 'vitest';
import { Prng } from '../../../src/core/prng';
import { CH } from '../../../src/audio/dsp/AcousticConfig';
import { renderTurboScenario, turboMetrics } from '../../../src/audio/analysis/turboLab';
import { CompressorWhoosh, type WhooshInput } from '../../../src/audio/dsp/turbo/CompressorWhoosh';
import { turboProfileOf } from '../../../src/audio/dsp/turbo/TurboAcoustics';
import type { AuxAcoustics } from '../../../src/audio/dsp/AuxAcoustics';
import { dB, golTurbo, rmsOf, v2 } from './turboTestUtils';

function whoosh(fs: number, x: WhooshInput): Float32Array {
  const p = turboProfileOf(v2(golTurbo()))!;
  const w = new CompressorWhoosh(fs, p, new Prng(9), false);
  const out = new Float32Array(fs);
  for (let i = 0; i < fs; i++) {
    if ((i & 31) === 0) w.setBlock(x, 32);
    out[i] = w.process();
  }
  return out.subarray(fs / 4);
}

describe('Turbo Acoustics 2.0 — compressor whoosh', () => {
  it('is several moving bands, not one fixed 5.2 kHz band: the centroid rises with rotor speed and flow', () => {
    const lo = turboMetrics(whoosh(48000, { shaftNorm: 0.35, boostNorm: 0.2, flow: 0.3, instability: 0 }), 48000);
    const hi = turboMetrics(whoosh(48000, { shaftNorm: 0.9, boostNorm: 1, flow: 1, instability: 0 }), 48000);
    expect(hi.centroidHz).toBeGreaterThan(lo.centroidHz * 1.1);
    expect(hi.rms).toBeGreaterThan(lo.rms * 2);
    // energy spread over body, turbulence and brightness
    expect(hi.bands[1]! + hi.bands[2]! + hi.bands[3]!).toBeGreaterThan(0.65);
    expect(Math.max(hi.bands[1]!, hi.bands[2]!, hi.bands[3]!)).toBeLessThan(0.8);
  });

  it('pressure alone is not the multiplier: no air flow → (almost) no whoosh', () => {
    const noFlow = rmsOf(whoosh(48000, { shaftNorm: 0.8, boostNorm: 1, flow: 0, instability: 0 }));
    const flow = rmsOf(whoosh(48000, { shaftNorm: 0.8, boostNorm: 1, flow: 1, instability: 0 }));
    expect(dB(noFlow)).toBeLessThan(dB(flow) - 20);
  });

  it('44.1 and 48 kHz band-limited levels agree within 1 dB', () => {
    const x = { shaftNorm: 0.8, boostNorm: 0.8, flow: 0.8, instability: 0 };
    expect(Math.abs(dB(rmsOf(whoosh(44100, x))) - dB(rmsOf(whoosh(48000, x))))).toBeLessThan(1);
  });

  it('under steady full load the rotor tones are not masked by the whoosh', () => {
    let rotor = 0;
    let air = 0;
    let n = 0;
    const r = renderTurboScenario(v2(golTurbo()), 48000, 'steady', {
      tap: (aux: AuxAcoustics) => {
        if (n++ < 24000) return;
        rotor += aux.turbo!.rotorOut ** 2;
        air += aux.turbo!.whooshOut ** 2;
      },
    });
    expect(dB(Math.sqrt(rotor))).toBeGreaterThan(dB(Math.sqrt(air)) + 6);
    expect(turboMetrics(r.ch[CH.turbo]!, 48000, 24000).tonalToNoiseDb).toBeGreaterThan(0);
  });
});
