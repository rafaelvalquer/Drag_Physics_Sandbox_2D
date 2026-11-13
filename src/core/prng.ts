/**
 * Deterministic pseudo random generator (mulberry32). Used everywhere randomness is part
 * of a model (combustion cycle variation, AI reaction jitter, noise sources) so that
 * simulations and tests are reproducible. Allocation free – safe inside the audio callback.
 */
export class Prng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  reseed(seed: number): void {
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [-1, 1). */
  bipolar(): number {
    return this.next() * 2 - 1;
  }

  /** Approximately normal (sum of 4 uniforms), zero mean, unit variance. */
  gaussian(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508075688772;
  }
}
