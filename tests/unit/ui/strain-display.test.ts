/** HUD risk gauge: display filter (frame-rate independent), hysteresis, separate alert, beep cooldown. */
import { describe, expect, it } from 'vitest';
import { RISK_DISPLAY_TAU_S, StrainDisplay, WARNING_COOLDOWN_S } from '../../../src/ui/hud/strainDisplay';
import { recommendedShiftRpms } from '../../../src/game/career/tuning/dynoLab';

const inp = (exposure: number, overrev = false, canUpshift = true) => ({ exposure, broken: false, overrev, canUpshift });

describe('StrainDisplay', () => {
  it('filters the bar the same at 30, 60 and 144 FPS', () => {
    const at = (fps: number): number => {
      const d = new StrainDisplay();
      let v = 0;
      for (let i = 0; i < fps * 2 * RISK_DISPLAY_TAU_S; i++) v = d.update(1 / fps, inp(1)).shown;
      return v;
    };
    const ref = 1 - Math.exp(-2);
    for (const fps of [30, 60, 144]) expect(at(fps)).toBeCloseTo(ref, 2);
  });

  it('does not follow fast exposure noise; broken shows 100 % at once; reset clears', () => {
    const d = new StrainDisplay();
    for (let i = 0; i < 120; i++) d.update(1 / 60, inp(0.5));
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < 60; i++) {
      const v = d.update(1 / 60, inp(i % 2 ? 0.55 : 0.45)).shown;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(hi - lo).toBeLessThan(0.05);
    expect(d.update(1 / 60, { exposure: 0.6, broken: true, overrev: false, canUpshift: false })).toMatchObject({ shown: 1, level: 'broken' });
    d.reset();
    expect(d.update(1 / 60, inp(0)).shown).toBe(0);
  });

  it('level hysteresis does not flicker at a threshold', () => {
    const d = new StrainDisplay();
    const levels = new Set<string>();
    d.update(1 / 60, inp(0.46));
    for (let i = 0; i < 100; i++) levels.add(d.update(1 / 60, inp(i % 2 ? 0.46 : 0.43)).level);
    expect([...levels]).toEqual(['high']);
  });

  it('over-rev alert is separate from the bar; action text depends on the gear', () => {
    const d = new StrainDisplay();
    expect(d.update(1 / 60, inp(0.05, true)).alert).toBe('RPM EXCESSIVO');
    expect(d.update(1 / 60, inp(0.05, false)).alert).toBeNull();
    expect(d.update(1 / 60, inp(0.5, true, true)).alert).toBe('TROQUE DE MARCHA!');
    expect(d.update(1 / 60, inp(0.5, true, false)).alert).toBe('REDUZA O GIRO!');
  });

  it('beeps once when entering critical, with a cooldown', () => {
    const d = new StrainDisplay();
    let beeps = 0;
    for (let i = 0; i < 60 * (WARNING_COOLDOWN_S - 1); i++) if (d.update(1 / 60, inp(i % 20 < 10 ? 0.8 : 0.6)).beep) beeps++;
    expect(beeps).toBe(1);
  });
});

describe('recommended shift points', () => {
  it('flat torque: shift at the cut; falling torque: earlier, never above the cut', () => {
    const flat = [2000, 4000, 6000, 7000].map((rpm) => ({ rpm, torqueNm: 200, powerCv: 0 }));
    expect(recommendedShiftRpms(flat, [3.5, 2.1, 1.4, 1.0], 7000)).toEqual([7000, 7000, 7000]);
    const peaky = [2000, 4000, 5000, 6000, 7000].map((rpm) => ({ rpm, torqueNm: rpm <= 5000 ? 200 : 200 - (rpm - 5000) * 0.08, powerCv: 0 }));
    const s = recommendedShiftRpms(peaky, [3.5, 2.1, 1.4, 1.0], 7000);
    for (const r of s) expect(r).toBeLessThanOrEqual(7000);
    expect(Math.min(...s)).toBeLessThan(7000);
  });
});
