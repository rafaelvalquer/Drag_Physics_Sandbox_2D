/**
 * Fixed-size ring buffer of per-frame render diagnostics (camera and player positions, clocks,
 * interpolation). Preallocated typed arrays: recording a frame allocates nothing, and nothing is
 * logged to the console. Read through `RaceScene.visualDebug().frames` by the tests and by hand
 * from the browser console.
 */
export const FRAME_FIELDS = [
  /** performance.now() of the frame (ms). */
  't',
  /** Player front axle: latest physics state and the interpolated position that is drawn (m). */
  'physicsX',
  'renderX',
  /** Camera centre (m) and the player's front axle on screen (px). */
  'cameraX',
  'screenX',
  'interpolationAlpha',
  'physicsSteps',
  /** Real time between frames (performance.now) and the time step used by the camera (ms). */
  'realDeltaMs',
  'visualDeltaMs',
  /** Phaser's own (smoothed) frame delta, kept for comparison (ms). */
  'phaserDeltaMs',
  'fps',
  /** Pixels per metre and zoom relative to the world's base scale. */
  'ppm',
  'zoom',
  /** 0 = start, 1 = follow, 2 = wide. */
  'cameraMode',
  'speed',
] as const;

export type FrameField = (typeof FRAME_FIELDS)[number];
export type FrameRecord = Record<FrameField, number>;
export const CAMERA_MODE_CODE = { start: 0, follow: 1, wide: 2 } as const;

export class FrameLog {
  private readonly cols: Record<FrameField, Float64Array>;
  private head = 0;
  private count = 0;
  /** The record being filled for the current frame; `commit()` copies it into the buffer. */
  readonly row: FrameRecord;

  constructor(readonly capacity = 900) {
    const cols = {} as Record<FrameField, Float64Array>;
    const row = {} as FrameRecord;
    for (const f of FRAME_FIELDS) {
      cols[f] = new Float64Array(capacity);
      row[f] = 0;
    }
    this.cols = cols;
    this.row = row;
  }

  commit(): void {
    for (const f of FRAME_FIELDS) this.cols[f][this.head] = this.row[f];
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }

  /** The recorded frames, oldest first, as plain columns (allocates; diagnostics only). */
  dump(last = this.count): Record<FrameField, number[]> {
    const n = Math.min(last, this.count);
    const out = {} as Record<FrameField, number[]>;
    const start = (this.head - n + this.capacity) % this.capacity;
    for (const f of FRAME_FIELDS) {
      const col = this.cols[f];
      const a = new Array<number>(n);
      for (let i = 0; i < n; i++) a[i] = col[(start + i) % this.capacity]!;
      out[f] = a;
    }
    return out;
  }
}
