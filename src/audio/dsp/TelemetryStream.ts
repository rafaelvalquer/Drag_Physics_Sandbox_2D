import { AF } from '../../core/contracts';

const FOUR_PI = 4 * Math.PI;
const RING = 64;

/**
 * Receives physics telemetry frames (AF layout, one per physics step) and reconstructs a smooth
 * per-sample control signal for the audio thread. Physics remains the source of truth; this
 * class only resamples it:
 *
 * - Jitter buffer: playback runs `latencyS` behind the newest frame. The playback clock rate is
 *   adjusted by at most ±2 % to keep that latency (drift between the render loop and the audio
 *   clock), so continuous parameters are linearly interpolated between frames without jumps.
 * - Crank phase: integrated from ω in the audio thread (phase continuous), with a soft PLL towards
 *   the physics crank angle (correction limited to a few % of the speed – never a jump while
 *   audible).
 * - Discrete values (gear, spark cut, combustion enable) come from the frame at or before the
 *   playback time; one-shot events (afterfire) fire once when their frame is passed.
 * - Telemetry loss: the last frame is held and, after `starveFadeS`, the output fades to silence;
 *   when frames resume the stream re-synchronizes under the fade (no discontinuity).
 * - Frames with non-finite values are rejected (counted in `rejectedFrames`).
 *
 * Allocation free after construction.
 */
export class TelemetryStream {
  private readonly frames = new Float64Array(RING * AF.length);
  private readonly times = new Float64Array(RING);
  private head = -1; // index of newest frame
  private count = 0;
  private cursor = -1; // index of frame at or before playback time
  /** Interpolated values for the current sample (AF layout). */
  readonly cur = new Float64Array(AF.length);
  playTime = 0;
  rate = 1;
  /** Audio crank angle (unwrapped modulo 4π). */
  theta = 0;
  /** Seconds since the playback time passed the newest frame. */
  starvedS = 0;
  rejectedFrames = 0;
  receivedFrames = 0;
  resyncs = 0;
  /** True on the sample at which a one-shot event (afterfire) frame was passed. */
  eventAfterfire = false;
  /** Gear in the previous and current frame (for engagement clunks). */
  gearChanged = false;
  private lastGear = 0;
  /** 0..1 output gain handled by the stream (starvation, pause, re-sync). */
  fade = 0;
  private fadeTarget = 0;
  private needSnap = true;
  private readonly dt: number;

  constructor(
    readonly sampleRate: number,
    public latencyS = 0.05,
    public starveFadeS = 0.25,
  ) {
    this.dt = 1 / sampleRate;
  }

  get hasData(): boolean {
    return this.count > 0;
  }

  get newestTime(): number {
    return this.count > 0 ? this.times[this.head]! : 0;
  }

  /** Copies a frame (no allocation). Returns false when rejected. */
  push(src: ArrayLike<number>, offset = 0): boolean {
    for (let k = 0; k < AF.length; k++) {
      if (!Number.isFinite(src[offset + k]!)) {
        this.rejectedFrames++;
        return false;
      }
    }
    const t = src[offset + AF.simTime]!;
    if (this.count > 0 && t <= this.times[this.head]!) {
      // simulation was reset or frame repeated: restart the stream
      if (t < this.times[this.head]! - 1e-9) {
        this.count = 0;
        this.cursor = -1;
        this.needSnap = true;
      } else {
        return false;
      }
    }
    // first frame after a telemetry stall: jump to the new data (we are silent by now)
    if (this.starvedS > this.starveFadeS) this.needSnap = true;
    this.head = (this.head + 1) % RING;
    const base = this.head * AF.length;
    for (let k = 0; k < AF.length; k++) this.frames[base + k] = src[offset + k]!;
    this.times[this.head] = t;
    if (this.count < RING) this.count++;
    this.receivedFrames++;
    return true;
  }

  private idx(back: number): number {
    return (this.head - back + RING * 2) % RING;
  }

  /** Advances one sample and fills `cur`. */
  step(): void {
    this.eventAfterfire = false;
    this.gearChanged = false;
    if (this.count === 0) {
      this.fadeTarget = 0;
      this.fade += (this.fadeTarget - this.fade) * 0.002;
      return;
    }
    const newest = this.times[this.head]!;
    const target = newest - this.latencyS;
    // Re-sync when the data is far ahead of the playback clock (first data, burst after a gap);
    // never towards stale data while starving (that would loop the last frames).
    if (this.needSnap || target - this.playTime > 0.25) {
      // jump under silence
      if (this.fade < 0.01 || this.needSnap) {
        // exactly the target latency; before the oldest frame the first frame is held
        this.playTime = target;
        this.cursor = -1;
        this.needSnap = false;
        this.resyncPending = false;
        this.resyncs++;
        this.snapTheta = true;
      } else {
        this.resyncPending = true; // fade out first, jump when silent
      }
    }
    // playback clock with gentle rate control towards the target latency
    const err = target - this.playTime;
    this.rate = 1 + Math.max(-0.02, Math.min(0.02, err * 0.8));
    this.playTime += this.dt * this.rate;

    // locate the frame interval
    if (this.cursor < 0) {
      // search from the oldest
      this.cursor = this.idx(this.count - 1);
    }
    let next = (this.cursor + 1) % RING;
    let guard = 0;
    while (this.cursor !== this.head && this.times[next]! <= this.playTime && guard++ < RING) {
      this.cursor = next;
      next = (this.cursor + 1) % RING;
      const b = this.cursor * AF.length;
      if (this.frames[b + AF.afterfire]! > 0.5) this.eventAfterfire = true;
    }
    const b0 = this.cursor * AF.length;
    const t0 = this.times[this.cursor]!;
    const c = this.cur;
    if (this.cursor === this.head || this.playTime < t0) {
      // starvation (or before the first frame): hold
      for (let k = 0; k < AF.length; k++) c[k] = this.frames[b0 + k]!;
      if (this.playTime > newest) this.starvedS += this.dt;
    } else {
      this.starvedS = 0;
      const b1 = next * AF.length;
      const t1 = this.times[next]!;
      const f = t1 > t0 ? (this.playTime - t0) / (t1 - t0) : 0;
      for (let k = 0; k < AF.length; k++) {
        const a = this.frames[b0 + k]!;
        c[k] = a + (this.frames[b1 + k]! - a) * f;
      }
      // discrete / unwrapped quantities
      c[AF.gear] = this.frames[b0 + AF.gear]!;
      c[AF.combustionEnabled] = this.frames[b0 + AF.combustionEnabled]!;
      c[AF.revLimiter] = this.frames[b0 + AF.revLimiter]!;
      c[AF.starterActive] = this.frames[b0 + AF.starterActive]!;
      c[AF.paused] = this.frames[b0 + AF.paused]!;
      c[AF.afterfire] = 0;
      // crank angle: θ0 + mean ω·Δt (the stored angle wraps at 4π)
      const w0 = this.frames[b0 + AF.omega]!;
      const w1 = this.frames[b1 + AF.omega]!;
      const dtp = this.playTime - t0;
      c[AF.crankAngle] = this.frames[b0 + AF.crankAngle]! + (w0 + (w1 - w0) * f * 0.5) * dtp;
    }
    const g = c[AF.gear]!;
    if (g !== this.lastGear) {
      this.gearChanged = true;
      this.lastGear = g;
    }

    // crank phase: integrate ω, soft PLL to the physics angle
    const w = c[AF.omega]!;
    if (this.snapTheta) {
      this.theta = c[AF.crankAngle]!;
      this.snapTheta = false;
    } else {
      this.theta += w * this.dt;
      let e = (c[AF.crankAngle]! - this.theta) % FOUR_PI;
      if (e > 2 * Math.PI) e -= FOUR_PI;
      else if (e < -2 * Math.PI) e += FOUR_PI;
      const maxCorr = Math.abs(w) * this.dt * 0.04 + 1e-6;
      let corr = e * (this.dt / 0.05);
      if (corr > maxCorr) corr = maxCorr;
      else if (corr < -maxCorr) corr = -maxCorr;
      this.theta += corr;
    }
    if (this.theta > 1e6 || this.theta < -1e6) this.theta %= FOUR_PI;

    // output fade: starvation, pause
    const paused = c[AF.paused]! > 0.5;
    this.fadeTarget = paused || this.resyncPending || this.starvedS > this.starveFadeS ? 0 : 1;
    const k = this.fadeTarget > this.fade ? 0.0008 : 0.004;
    this.fade += (this.fadeTarget - this.fade) * k;
  }

  private snapTheta = true;
  private resyncPending = false;

  reset(): void {
    this.count = 0;
    this.head = -1;
    this.cursor = -1;
    this.needSnap = true;
    this.fade = 0;
    this.starvedS = 0;
  }
}
