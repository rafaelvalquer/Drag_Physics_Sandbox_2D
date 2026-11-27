import { describe, expect, it } from 'vitest';
import { AF } from '../../../src/core/contracts';
import { CH } from '../../../src/audio/dsp/AcousticConfig';
import { renderTurboScenario, type TurboScript } from '../../../src/audio/analysis/turboLab';
import { FLUTTER_STATE, FLUTTER_TUNING } from '../../../src/audio/dsp/turbo/CompressorFlutter';
import type { AuxAcoustics } from '../../../src/audio/dsp/AuxAcoustics';
import { carById, dB, golTurbo, rmsOf, v2, withHardware } from './turboTestUtils';

const FS = 48000;

function run(car: ReturnType<typeof golTurbo>, script: { seconds: number; at: (t: number) => TurboScript }, mutate?: (f: Float64Array, t: number) => void) {
  let flutterSq = 0;
  let n = 0;
  const states: number[] = [];
  const r = renderTurboScenario(v2(car), FS, 'tip-out', {
    script,
    mutate,
    tap: (aux: AuxAcoustics) => {
      const fl = aux.turbo!.flutter;
      flutterSq += fl.out * fl.out;
      n++;
      if ((n & 255) === 0) states.push(fl.state);
    },
  });
  const fl = (r.voice.aux as AuxAcoustics).turbo!.flutter;
  return { r, fl, flutterRms: Math.sqrt(flutterSq / Math.max(1, n)), states };
}

const redline = golTurbo().engine.redlineRpm;
/** WOT 3 s, closed for `closedS`, then reopened. */
const tipOut = (closedS: number) => ({
  seconds: 3 + closedS + 1,
  at: (t: number): TurboScript => ({ rpm: 0.8 * redline, throttle: t < 3 ? 1 : t < 3 + closedS ? 0 : 1, gear: 3 }),
});

describe('Turbo Acoustics 2.0 — compressor flutter', () => {
  it('without a valve: a tip-out under boost flutters once, with a bounded, decaying pulse series', () => {
    const { fl, r } = run(withHardware(golTurbo(), { bov: 'none' }), tipOut(1.5));
    expect(fl.events).toBe(1);
    expect(fl.totalPulses).toBeGreaterThan(3);
    expect(fl.totalPulses).toBeLessThanOrEqual(FLUTTER_TUNING.maxPulses);
    const x = r.ch[CH.turbo]!;
    // pulses decay: the second half-second after the tip-out is quieter than the first 0.15 s
    const t0 = Math.round(3.05 * FS);
    expect(rmsOf(x, t0, t0 + 0.15 * FS)).toBeGreaterThan(rmsOf(x, t0 + 0.9 * FS, t0 + 1.4 * FS) * 2);
  });

  it('never repeats while the throttle stays closed, even if the simplified physics holds the boost', () => {
    // dead-heading compressor: boost held for 6 s with the throttle closed
    const { fl, states } = run(withHardware(golTurbo(), { bov: 'none' }), tipOut(6), (f, t) => {
      if (t >= 3 && t < 9) f[AF.boostPressure] = Math.max(f[AF.boostPressure]!, 0.45e5);
    });
    expect(fl.events).toBe(1);
    // by the end of the closed phase the machine is idle (DECAYING, silent) — not oscillating
    const late = states.slice(Math.round((8.5 * FS) / 256), Math.round((8.9 * FS) / 256));
    expect(late.every((s) => s === FLUTTER_STATE.DECAYING)).toBe(true);
  });

  it('re-opening the throttle interrupts the oscillation', () => {
    const long = run(withHardware(golTurbo(), { bov: 'none' }), tipOut(1.5));
    const cut = run(withHardware(golTurbo(), { bov: 'none' }), tipOut(0.12));
    expect(cut.fl.totalPulses).toBeLessThan(long.fl.totalPulses);
  });

  it('a working valve suppresses most of it (≥ 10 dB less flutter energy)', () => {
    const none = run(withHardware(golTurbo(), { bov: 'none' }), tipOut(1.5));
    const atm = run(withHardware(golTurbo(), { bov: 'atmosphere' }), tipOut(1.5));
    const rec = run(withHardware(golTurbo(), { bov: 'recirculating' }), tipOut(1.5));
    expect(dB(atm.flutterRms)).toBeLessThan(dB(none.flutterRms) - 10);
    expect(dB(rec.flutterRms)).toBeLessThan(dB(none.flutterRms) - 10);
  });

  it('no trigger on a twin-clutch shift (spark cut, throttle stays open) nor at the rev limiter', () => {
    const car = withHardware(carById('vw-jetta-tsi-2012'), { bov: 'none' });
    const script = { seconds: 5, at: (t: number): TurboScript => ({ rpm: 0.95 * car.engine.redlineRpm, throttle: 1, gear: t < 2.5 ? 2 : 3 }) };
    const { fl } = run(car, script, (f, t) => {
      f[AF.sparkCut] = Math.abs(t - 2.5) < 0.08 ? 1 : 0;
      f[AF.revLimiter] = Math.sin(t * 40) > 0.6 ? 1 : 0;
      f[AF.combustionEnabled] = f[AF.revLimiter]! > 0 ? 0 : 1;
    });
    expect(fl.events).toBe(0);
  });

  it('a lift without boost (part load) does not flutter', () => {
    const car = withHardware(golTurbo(), { bov: 'none' });
    const script = { seconds: 5, at: (t: number): TurboScript => ({ rpm: 0.35 * redline, throttle: t < 3 ? 0.25 : 0, gear: 3 }) };
    expect(run(car, script).fl.events).toBe(0);
  });
});
