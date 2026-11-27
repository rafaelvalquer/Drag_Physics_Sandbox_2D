import { describe, expect, it } from 'vitest';
import { Prng } from '../../../src/core/prng';
import { turboMetrics } from '../../../src/audio/analysis/turboLab';
import { BlowOffAcoustics } from '../../../src/audio/dsp/turbo/BlowOffAcoustics';
import { turboProfileOf } from '../../../src/audio/dsp/turbo/TurboAcoustics';
import { golTurbo, rmsOf, v2, withHardware } from './turboTestUtils';

const FS = 48000;

/** Drives a valve with a physics-like vent: bovFlow pulse decaying with the vent time, boost venting. */
function vent(bov: BlowOffAcoustics, opts: { boostPa: number; maxBoostPa: number; openAt?: number; seconds?: number; ventS?: number; reopenAt?: number }): Float32Array {
  const n = Math.round((opts.seconds ?? 1) * FS);
  const out = new Float32Array(n);
  const t0 = opts.openAt ?? 0.2;
  const tau = opts.ventS ?? 0.12;
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    const open = t >= t0 && (opts.reopenAt === undefined || t < opts.reopenAt);
    const boost = open ? opts.boostPa * Math.exp(-(t - t0) / tau) : t < t0 ? opts.boostPa : 0;
    // the physics valve closes once the charge pipe is below 0.05 bar
    const flow = open && boost >= 0.05e5 ? Math.min(1, 2 * Math.exp(-(t - t0) / tau)) : 0;
    out[i] = bov.process(flow, boost / opts.maxBoostPa, boost);
  }
  return out;
}

const profileFor = (bov: 'none' | 'atmosphere' | 'recirculating') => turboProfileOf(v2(withHardware(golTurbo(), { bov })))!;

describe('Turbo Acoustics 2.0 — blow-off valve', () => {
  it('no event without accumulated boost', () => {
    const p = profileFor('atmosphere');
    const b = new BlowOffAcoustics(FS, p, new Prng(1), false);
    const x = vent(b, { boostPa: 0.05e5, maxBoostPa: p.maxBoostPa });
    expect(b.events).toBe(0);
    expect(rmsOf(x)).toBe(0);
  });

  it('atmospheric: an event per opening, bright, decaying, finite and click-free', () => {
    const p = profileFor('atmosphere');
    const b = new BlowOffAcoustics(FS, p, new Prng(1), false);
    const x = vent(b, { boostPa: 0.6e5, maxBoostPa: p.maxBoostPa, seconds: 1.2 });
    expect(b.events).toBe(1);
    const t0 = Math.round(0.2 * FS);
    const early = rmsOf(x, t0, t0 + 0.08 * FS);
    const late = rmsOf(x, t0 + 0.5 * FS, t0 + 0.6 * FS);
    expect(early).toBeGreaterThan(0.05);
    expect(late).toBeLessThan(early * 0.15);
    expect(x.every(Number.isFinite)).toBe(true);
    // onset: no single-sample jump larger than the noise itself allows
    let jump = 0;
    for (let i = t0; i < t0 + 200; i++) jump = Math.max(jump, Math.abs(x[i]! - x[i - 1]!));
    expect(jump).toBeLessThan(early * 6);
    expect(rmsOf(x, 0, t0)).toBe(0);
  });

  it('recirculating is its own darker sound, not the atmospheric one turned down', () => {
    const pa = profileFor('atmosphere');
    const pr = profileFor('recirculating');
    const a = vent(new BlowOffAcoustics(FS, pa, new Prng(2), false), { boostPa: 0.6e5, maxBoostPa: pa.maxBoostPa });
    const r = vent(new BlowOffAcoustics(FS, pr, new Prng(2), false), { boostPa: 0.6e5, maxBoostPa: pr.maxBoostPa });
    const ma = turboMetrics(a, FS, Math.round(0.2 * FS), Math.round(0.45 * FS));
    const mr = turboMetrics(r, FS, Math.round(0.2 * FS), Math.round(0.45 * FS));
    expect(mr.centroidHz).toBeLessThan(ma.centroidHz * 0.5);
    expect(mr.bands[3]! + mr.bands[4]!).toBeLessThan(0.08); // little content above 4.5 kHz
    expect(mr.rms).toBeLessThan(ma.rms);
    expect(mr.rms).toBeGreaterThan(ma.rms * 0.05);
  });

  it('no valve fitted: silent', () => {
    const p = profileFor('none');
    const b = new BlowOffAcoustics(FS, p, new Prng(1), false);
    expect(rmsOf(vent(b, { boostPa: 0.8e5, maxBoostPa: p.maxBoostPa }))).toBe(0);
  });

  it('repeated openings are separate events', () => {
    const p = profileFor('atmosphere');
    const b = new BlowOffAcoustics(FS, p, new Prng(3), false);
    let events = 0;
    for (let k = 0; k < 3; k++) {
      vent(b, { boostPa: 0.6e5, maxBoostPa: p.maxBoostPa, seconds: 0.8, openAt: 0.1 });
      events = b.events;
    }
    expect(events).toBe(3);
  });

  it('closing the valve (throttle re-opened) ends the sound smoothly', () => {
    const p = profileFor('atmosphere');
    const b = new BlowOffAcoustics(FS, p, new Prng(4), false);
    const x = vent(b, { boostPa: 0.7e5, maxBoostPa: p.maxBoostPa, reopenAt: 0.26, ventS: 0.3 });
    const during = rmsOf(x, Math.round(0.2 * FS), Math.round(0.26 * FS));
    const after = rmsOf(x, Math.round(0.26 * FS) + Math.round((p.blowOff.releaseMs / 1000) * FS * 5), Math.round(0.9 * FS));
    expect(after).toBeLessThan(during * 0.01);
  });
});
