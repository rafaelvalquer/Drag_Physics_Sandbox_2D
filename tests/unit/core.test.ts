import { describe, expect, it } from 'vitest';
import { MonotoneCubic, clamp, firstOrder, positiveMod, wrapSigned } from '../../src/core/math';
import { Prng } from '../../src/core/prng';
import {
  ATMOSPHERIC_PRESSURE,
  DISTANCES,
  WATTS_PER_CV,
  airDensity,
  msToKmh,
  radSToRpm,
  rpmToRadS,
  speedOfSound,
  wattsToCv,
} from '../../src/core/units';

describe('units', () => {
  it('uses the metric horsepower definition (cv = W / 735.49875)', () => {
    expect(WATTS_PER_CV).toBe(735.49875);
    expect(wattsToCv(735.49875 * 300)).toBeCloseTo(300, 10);
  });

  it('converts rpm and rad/s both ways', () => {
    expect(rpmToRadS(60)).toBeCloseTo(2 * Math.PI, 12);
    expect(radSToRpm(rpmToRadS(6543.21))).toBeCloseTo(6543.21, 9);
    expect(msToKmh(100 / 3.6)).toBeCloseTo(100, 12);
  });

  it('computes air density and speed of sound from the ideal gas law', () => {
    // dry air, 1 atm, 15 °C → 1.225 kg/m³ (ISA)
    expect(airDensity(ATMOSPHERIC_PRESSURE, 288.15)).toBeCloseTo(1.225, 2);
    // c = sqrt(γ R T): 343 m/s at 20 °C
    expect(speedOfSound(293.15)).toBeCloseTo(343.2, 0);
    // hot exhaust gas is much faster
    expect(speedOfSound(900)).toBeGreaterThan(590);
  });

  it('has the official drag distances', () => {
    expect(DISTANCES.eighthMile).toBeCloseTo(201.168, 6);
    expect(DISTANCES.quarterMile).toBeCloseTo(402.336, 6);
    expect(DISTANCES.oneKm).toBe(1000);
    expect(DISTANCES.sixtyFeet).toBeCloseTo(18.288, 6);
  });
});

describe('math helpers', () => {
  it('first-order filter is the exact exponential solution', () => {
    const tau = 0.3;
    let x = 0;
    for (let i = 0; i < 100; i++) x = firstOrder(x, 1, 0.01, tau);
    expect(x).toBeCloseTo(1 - Math.exp(-1 / tau), 10);
    // step-size independence
    let y = 0;
    for (let i = 0; i < 1000; i++) y = firstOrder(y, 1, 0.001, tau);
    expect(y).toBeCloseTo(x, 10);
  });

  it('monotone cubic never overshoots monotone data and holds the end values', () => {
    const c = new MonotoneCubic([1000, 2000, 3000, 4000, 5000], [100, 180, 200, 200, 150]);
    for (let r = 1000; r <= 5000; r += 7) {
      const v = c.evaluate(r);
      expect(v).toBeLessThanOrEqual(200 + 1e-9);
      expect(v).toBeGreaterThanOrEqual(100 - 1e-9);
    }
    // flat segment stays flat
    expect(c.evaluate(3500)).toBeCloseTo(200, 9);
    expect(c.evaluate(0)).toBe(100);
    expect(c.evaluate(9000)).toBe(150);
  });

  it('wraps angles', () => {
    expect(positiveMod(-1, 10)).toBe(9);
    expect(wrapSigned(2.5 * Math.PI, 2 * Math.PI)).toBeCloseTo(0.5 * Math.PI, 12);
    expect(clamp(5, 0, 1)).toBe(1);
  });

  it('PRNG is deterministic per seed', () => {
    const a = new Prng(42);
    const b = new Prng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
    const g = new Prng(7);
    let s = 0;
    let s2 = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const x = g.gaussian();
      s += x;
      s2 += x * x;
    }
    expect(Math.abs(s / n)).toBeLessThan(0.03);
    expect(Math.abs(s2 / n - 1)).toBeLessThan(0.05);
  });
});
