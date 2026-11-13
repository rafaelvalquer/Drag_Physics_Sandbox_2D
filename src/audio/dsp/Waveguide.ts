/**
 * Digital waveguide primitives.
 *
 * ORIGIN (MIT © 2021-2022 Antonio-R1): engine-sound-generator `DelayLine` and `Waveguide`
 * (src/engine_sound_generator/waveguide.js, sound_generator_wasm/waveguide.cpp): a bidirectional
 * waveguide made of two delay lines (one per travel direction) whose ends reflect a fraction of
 * the arriving wave and pass the rest to the neighbour.
 *
 * CHANGES:
 * - Lengths are physical (metres). The delay in samples is L / c(T) · fs, with the speed of sound
 *   c = sqrt(γ·R·T) of the gas temperature in the pipe and the *real* AudioContext sample rate
 *   (the original used integer sample counts tuned for 44.1 kHz).
 * - Fractional delay with linear interpolation, so the delay can follow the gas temperature
 *   continuously without clicks (the original could not change the length at run time).
 * - Read / write are split so a network of pipes can be updated in two passes (all pipes read
 *   their arriving waves, junctions scatter, all pipes write), independent of update order.
 * - Propagation losses: broadband wall loss (dB/m) and a one-pole thermo-viscous low-pass per
 *   direction (frequency-dependent damping); the original had none and relied on reflection < 1.
 * - All storage is allocated once (capacity for the longest delay at the coldest temperature);
 *   the per-sample path does not allocate.
 */

export const GAMMA_AIR = 1.4;
export const R_AIR_SPECIFIC = 287.05;
/** Exhaust gas has a lower γ and a slightly different gas constant than air. */
export const GAMMA_EXHAUST = 1.33;
export const R_EXHAUST_SPECIFIC = 291;

export function soundSpeed(temperatureK: number, gamma = GAMMA_AIR, r = R_AIR_SPECIFIC): number {
  return Math.sqrt(gamma * r * Math.max(temperatureK, 150));
}

/** Delay (samples) of a one-way trip along a pipe of length L at temperature T. */
export function pipeDelaySamples(lengthM: number, temperatureK: number, sampleRate: number, gamma = GAMMA_AIR, r = R_AIR_SPECIFIC): number {
  return (lengthM / soundSpeed(temperatureK, gamma, r)) * sampleRate;
}

/** Fractional delay line (ring buffer). */
export class FractionalDelay {
  private readonly buf: Float32Array;
  private readonly mask: number;
  private w = 0;
  delay: number;

  constructor(maxDelaySamples: number, delay: number) {
    let size = 4;
    while (size < maxDelaySamples + 4) size <<= 1;
    this.buf = new Float32Array(size);
    this.mask = size - 1;
    this.delay = Math.min(Math.max(delay, 1), size - 3);
  }

  get capacity(): number {
    return this.buf.length - 3;
  }

  setDelay(d: number): void {
    this.delay = d < 1 ? 1 : d > this.buf.length - 3 ? this.buf.length - 3 : d;
  }

  /** Value written `delay` samples ago (linear interpolation). */
  read(): number {
    const d = this.delay;
    const i = Math.floor(d);
    const f = d - i;
    const a = this.buf[(this.w - i) & this.mask]!;
    const b = this.buf[(this.w - i - 1) & this.mask]!;
    return a + (b - a) * f;
  }

  write(x: number): void {
    this.w = (this.w + 1) & this.mask;
    this.buf[this.w] = x;
  }

  clear(): void {
    this.buf.fill(0);
  }
}

/**
 * Bidirectional waveguide segment of a pipe.
 * - `arriveLeft`: wave arriving at the left end (travelled right → left).
 * - `arriveRight`: wave arriving at the right end (travelled left → right).
 */
export class Waveguide {
  private readonly rightGoing: FractionalDelay;
  private readonly leftGoing: FractionalDelay;
  arriveLeft = 0;
  arriveRight = 0;
  private lpR = 0;
  private lpL = 0;
  private lossGain = 1;
  private lpCoeff = 0;
  readonly areaM2: number;

  constructor(
    public readonly lengthM: number,
    public readonly diameterMm: number,
    private readonly sampleRate: number,
    minTemperatureK: number,
    temperatureK: number,
    private readonly gamma = GAMMA_AIR,
    private readonly rGas = R_AIR_SPECIFIC,
    wallLossDbPerM = 1,
  ) {
    const maxD = pipeDelaySamples(lengthM, minTemperatureK, sampleRate, gamma, rGas) + 2;
    const d = pipeDelaySamples(lengthM, temperatureK, sampleRate, gamma, rGas);
    this.rightGoing = new FractionalDelay(maxD, d);
    this.leftGoing = new FractionalDelay(maxD, d);
    this.areaM2 = (Math.PI * (diameterMm / 1000) ** 2) / 4;
    this.setLosses(wallLossDbPerM);
  }

  /**
   * Broadband loss over the segment length plus a thermo-viscous one-pole low-pass whose cutoff
   * falls for narrow pipes (boundary-layer losses grow with 1/diameter).
   */
  setLosses(wallLossDbPerM: number): void {
    this.lossGain = Math.pow(10, (-wallLossDbPerM * this.lengthM) / 20);
    const fc = Math.min(16000, 9000 * (this.diameterMm / 50)) / Math.max(1, 0.6 + this.lengthM);
    const x = Math.exp((-2 * Math.PI * Math.min(fc, this.sampleRate * 0.45)) / this.sampleRate);
    this.lpCoeff = x;
  }

  /** Updates the propagation delay for a new gas temperature (smooth, fractional). */
  setTemperature(temperatureK: number): void {
    const d = pipeDelaySamples(this.lengthM, temperatureK, this.sampleRate, this.gamma, this.rGas);
    this.rightGoing.setDelay(d);
    this.leftGoing.setDelay(d);
  }

  get delaySamples(): number {
    return this.rightGoing.delay;
  }

  /** First pass: waves arriving at both ends (after propagation losses). */
  read(): void {
    const a = this.lpCoeff;
    this.lpR = this.rightGoing.read() * this.lossGain * (1 - a) + this.lpR * a;
    this.lpL = this.leftGoing.read() * this.lossGain * (1 - a) + this.lpL * a;
    this.arriveRight = this.lpR;
    this.arriveLeft = this.lpL;
  }

  /** Second pass: waves leaving the left end (travel right) and the right end (travel left). */
  write(fromLeftEnd: number, fromRightEnd: number): void {
    this.rightGoing.write(fromLeftEnd);
    this.leftGoing.write(fromRightEnd);
  }

  clear(): void {
    this.rightGoing.clear();
    this.leftGoing.clear();
    this.lpL = 0;
    this.lpR = 0;
    this.arriveLeft = 0;
    this.arriveRight = 0;
  }
}

/**
 * Kelly–Lochbaum two-port scattering of pressure waves at an area change A1 → A2:
 *   k = (A1 − A2)/(A1 + A2)
 *   to the right = (1 + k)·p⁺ − k·p⁻
 *   to the left  = k·p⁺ + (1 − k)·p⁻
 * where p⁺ arrives from the left pipe and p⁻ arrives from the right pipe.
 */
export function areaReflection(a1: number, a2: number): number {
  return (a1 - a2) / (a1 + a2);
}

/**
 * N-port parallel junction (pipes meeting at a collector): junction pressure
 *   p_J = 2·Σ(Aᵢ·pᵢ_in) / Σ Aᵢ,     pᵢ_out = p_J − pᵢ_in
 * Lossless and passive for any areas. Arrays are caller-owned (no allocation).
 */
export function scatterJunction(areas: Float64Array, incoming: Float64Array, outgoing: Float64Array, n: number): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += areas[i]! * incoming[i]!;
    den += areas[i]!;
  }
  const pJ = den > 0 ? (2 * num) / den : 0;
  for (let i = 0; i < n; i++) outgoing[i] = pJ - incoming[i]!;
  return pJ;
}
