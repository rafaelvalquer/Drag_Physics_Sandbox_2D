import { describe, expect, it } from 'vitest';
import { Prng } from '../../../src/core/prng';
import { Turbocharger } from '../../../src/physics/engine/Turbocharger';
import { turboProfileOf } from '../../../src/audio/dsp/turbo/TurboAcoustics';
import { estimateWastegateOpening, WASTEGATE_SHAFT_CAP, WastegateAcoustics } from '../../../src/audio/dsp/turbo/WastegateAcoustics';
import { dB, golTurbo, rmsOf, v2, withHardware } from './turboTestUtils';

const FS = 48000;

function render(type: 'internal' | 'external-recirculated' | 'external-open', opening: number, quality: 'high' | 'low' = 'high'): Float32Array {
  const p = turboProfileOf(v2(withHardware(golTurbo(), { wastegate: type }), quality))!;
  const w = new WastegateAcoustics(FS, p, new Prng(5), quality === 'low');
  const out = new Float32Array(FS);
  for (let i = 0; i < FS; i++) {
    if ((i & 31) === 0) w.setBlock(opening, 0.9, 1100, 180, 32);
    out[i] = w.process();
  }
  return out;
}

describe('Turbo Acoustics 2.0 — wastegate', () => {
  it('the opening estimate matches the shaft cap of the physics wastegate', () => {
    const t = new Turbocharger(golTurbo().engine.turbo!, 1);
    for (let i = 0; i < 2000; i++) t.update(1 / 120, 1.2, 1, 1); // far more exhaust energy than needed
    expect(t.shaft).toBeCloseTo(WASTEGATE_SHAFT_CAP, 3);
    const boostNorm = t.boostPa / (t.cfg.maxBoostBar * 1e5);
    expect(estimateWastegateOpening(t.shaft, boostNorm, 1)).toBeGreaterThan(0.9);
    expect(estimateWastegateOpening(t.shaft * 0.8, boostNorm, 1)).toBe(0);
    expect(estimateWastegateOpening(t.shaft, boostNorm, 0)).toBe(0); // under no load: closed
  });

  it('the sound depends on the topology: open dump ≫ recirculated > internal', () => {
    const internal = rmsOf(render('internal', 1));
    const recirc = rmsOf(render('external-recirculated', 1));
    const open = rmsOf(render('external-open', 1));
    expect(dB(open)).toBeGreaterThan(dB(recirc) + 6);
    expect(dB(recirc)).toBeGreaterThan(dB(internal) + 3);
    expect(internal).toBeGreaterThan(0);
  });

  it('closed gate is silent; low quality drops the internal one', () => {
    expect(rmsOf(render('external-open', 0))).toBe(0);
    expect(rmsOf(render('internal', 1, 'low'))).toBe(0);
    expect(rmsOf(render('external-open', 1, 'low'))).toBeGreaterThan(0);
  });

  it('the catalogue only produces the internal type unless an external wastegate part is fitted', () => {
    expect(turboProfileOf(v2(golTurbo()))!.wastegateType).toBe('internal');
  });
});
