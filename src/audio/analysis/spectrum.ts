/**
 * Offline spectral analysis helpers (tests, calibration tools and the Dyno spectrum view).
 * Radix-2 in-place FFT on Float64Arrays; Hann window; magnitude spectrum; autocorrelation pitch.
 */

export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if ((n & (n - 1)) !== 0) throw new Error('FFT length must be a power of two');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]!;
      re[i] = re[j]!;
      re[j] = t;
      t = im[i]!;
      im[i] = im[j]!;
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Hann-windowed magnitude spectrum of the first `n` (power of two) samples, bins 0..n/2. */
export function magnitudeSpectrum(x: ArrayLike<number>, n: number, start = 0): Float64Array {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re[i] = (x[start + i] ?? 0) * w;
  }
  fftInPlace(re, im);
  const out = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) out[k] = Math.hypot(re[k]!, im[k]!) / (n / 4);
  return out;
}

/** Averaged (Welch) magnitude spectrum with 50 % overlap. */
export function averagedSpectrum(x: ArrayLike<number>, n: number): Float64Array {
  const acc = new Float64Array(n / 2 + 1);
  let count = 0;
  for (let s = 0; s + n <= x.length; s += n / 2) {
    const m = magnitudeSpectrum(x, n, s);
    for (let k = 0; k < acc.length; k++) acc[k]! += m[k]! * m[k]!;
    count++;
  }
  for (let k = 0; k < acc.length; k++) acc[k] = Math.sqrt(acc[k]! / Math.max(1, count));
  return acc;
}

/** Energy of the spectrum inside ±halfWidthHz around f. */
export function bandEnergy(spec: Float64Array, sampleRate: number, n: number, f: number, halfWidthHz: number): number {
  const binHz = sampleRate / n;
  const k0 = Math.max(0, Math.floor((f - halfWidthHz) / binHz));
  const k1 = Math.min(spec.length - 1, Math.ceil((f + halfWidthHz) / binHz));
  let e = 0;
  for (let k = k0; k <= k1; k++) e += spec[k]! * spec[k]!;
  return e;
}

/** Frequency of the strongest bin within [fMin, fMax] (parabolic interpolation). */
export function peakFrequency(spec: Float64Array, sampleRate: number, n: number, fMin: number, fMax: number): number {
  const binHz = sampleRate / n;
  const k0 = Math.max(1, Math.floor(fMin / binHz));
  const k1 = Math.min(spec.length - 2, Math.ceil(fMax / binHz));
  let best = k0;
  for (let k = k0; k <= k1; k++) if (spec[k]! > spec[best]!) best = k;
  const a = spec[best - 1]!;
  const b = spec[best]!;
  const c = spec[best + 1]!;
  const den = a - 2 * b + c;
  const off = den !== 0 ? (0.5 * (a - c)) / den : 0;
  return (best + off) * binHz;
}

/**
 * Fundamental period by normalized autocorrelation within [fMin, fMax]. Returns the frequency
 * (Hz) of the best lag (parabolic refinement) and its normalized correlation.
 */
export function autocorrelationPitch(x: ArrayLike<number>, sampleRate: number, fMin: number, fMax: number, start = 0, length = 8192): { hz: number; r: number } {
  const lagMin = Math.max(2, Math.floor(sampleRate / fMax));
  const lagMax = Math.ceil(sampleRate / fMin);
  const n = Math.min(length, x.length - start - lagMax - 1);
  if (n <= 0) return { hz: 0, r: 0 };
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += x[start + i]! * x[start + i]!;
  const corr = (lag: number): number => {
    let s = 0;
    let e1 = 0;
    for (let i = 0; i < n; i++) {
      const b = x[start + i + lag]!;
      s += x[start + i]! * b;
      e1 += b * b;
    }
    return s / Math.sqrt(e0 * e1 + 1e-30);
  };
  let best = lagMin;
  let bestR = -2;
  const rs = new Float64Array(lagMax + 2);
  for (let lag = lagMin; lag <= lagMax; lag++) {
    rs[lag] = corr(lag);
    if (rs[lag]! > bestR) {
      bestR = rs[lag]!;
      best = lag;
    }
  }
  // prefer the shortest lag that is almost as good (avoid octave errors towards long periods)
  for (let lag = lagMin; lag < best; lag++) {
    if (rs[lag]! > bestR * 0.97 && rs[lag]! >= rs[lag - 1]! && rs[lag]! >= rs[lag + 1]!) {
      best = lag;
      bestR = rs[lag]!;
      break;
    }
  }
  const a = best > lagMin ? rs[best - 1]! : rs[best]!;
  const c = best < lagMax ? (rs[best + 1] ?? rs[best]!) : rs[best]!;
  const den = a - 2 * rs[best]! + c;
  const off = den !== 0 ? (0.5 * (a - c)) / den : 0;
  return { hz: sampleRate / (best + off), r: bestR };
}

/** RMS of a range. */
export function rms(x: ArrayLike<number>, start = 0, end = x.length): number {
  let s = 0;
  for (let i = start; i < end; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, end - start));
}

/** IEC 61672 A-weighting magnitude (linear, 1.0 at 1 kHz). */
export function aWeight(f: number): number {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return ra * 1.2589; // +2.0 dB normalization at 1 kHz
}

/** A-weighted RMS-equivalent level of a magnitude spectrum (same scale as the spectrum). */
export function aWeightedLevel(spec: Float64Array, sampleRate: number, n: number): number {
  const binHz = sampleRate / n;
  let e = 0;
  for (let k = 1; k < spec.length; k++) {
    const w = aWeight(k * binHz);
    e += (spec[k]! * w) ** 2;
  }
  return Math.sqrt(e / 2);
}
