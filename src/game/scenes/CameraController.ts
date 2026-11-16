/**
 * Side-view camera. Pure logic (no rendering): from the vehicles and the view size it produces
 * the horizontal position, the zoom (pixels per metre) and the screen height of the near lane.
 *
 * Framing goals: the cars are the subject – at rest the player's car fills about a third of the
 * view width – the track sits in the lower-middle of the picture, the zoom opens moderately with
 * speed, the camera leads the car in its direction of travel and never jumps (except when the
 * car itself is teleported back to the start).
 */
export type CameraMode = 'follow' | 'wide' | 'start';

export interface CameraTarget {
  /** Front axle position (m). */
  x: number;
  speed: number;
  wheelbaseM: number;
}

export interface CameraInput {
  mode: CameraMode;
  player: CameraTarget | null;
  others: CameraTarget[];
  viewW: number;
  viewH: number;
  /** Visible extent of the track (m). */
  trackStartM: number;
  trackEndM: number;
  /** User zoom multiplier (settings). */
  userZoom: number;
  /** A point (m) to keep in frame together with the player while it is nearby, or null. */
  include: number | null;
}

export interface CameraState {
  /** World position at the centre of the view (m). */
  x: number;
  /** Pixels per metre. */
  ppm: number;
  /** Screen y of the near-lane ground line. */
  groundY: number;
}

/** View width in metres at rest and at speed (follow mode). */
export const FOLLOW_SPAN_REST_M = 14;
export const FOLLOW_SPAN_FAST_M = 21;
export const FOLLOW_FAST_SPEED = 60;
const START_SPAN_M = 26;
/** An opponent closer than this (m) is kept in frame by opening the zoom a little. */
const PAIR_RANGE_M = 16;
const MIN_PPM = 6;
const MAX_PPM = 150;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export class CameraController {
  private x = 0;
  private ppm = 0;
  private lead = 0;
  private initialised = false;
  state: CameraState = { x: 0, ppm: 60, groundY: 400 };

  /** Fraction of the view height where the near lane's ground line sits. */
  static groundFraction(viewH: number): number {
    return viewH < 520 ? 0.66 : 0.7;
  }

  update(dtS: number, i: CameraInput): CameraState {
    const W = Math.max(1, i.viewW);
    const zoomUser = Math.min(2, Math.max(0.4, i.userZoom));
    const p = i.player;
    let span = FOLLOW_SPAN_REST_M;
    let targetX = 0;
    if (i.mode === 'start') {
      span = START_SPAN_M / zoomUser;
      targetX = -4.5 + span * 0.36;
    } else if (i.mode === 'wide' && p && i.others.length > 0) {
      const xs = [p, ...i.others].map((v) => v.x);
      const lo = Math.min(...xs) - 6.5;
      const hi = Math.max(...xs) + 2.5;
      // never crop the pair: the user zoom can only widen this view
      span = Math.max(FOLLOW_SPAN_REST_M, (hi - lo) / 0.9) / Math.min(1, zoomUser);
      targetX = (lo + hi) / 2;
    } else if (p) {
      const k = smoothstep(0, FOLLOW_FAST_SPEED, Math.abs(p.speed));
      span = (FOLLOW_SPAN_REST_M + (FOLLOW_SPAN_FAST_M - FOLLOW_SPAN_REST_M) * k) / zoomUser;
      const centre = p.x - p.wheelbaseM * 0.5;
      // look ahead in the direction of travel, never more than a fifth of the view
      const leadTarget = Math.min(span * 0.2, Math.max(0, p.speed) * 0.11);
      this.lead += (leadTarget - this.lead) * (1 - Math.exp(-dtS / 0.5));
      targetX = centre + this.lead;
      // something to watch next to the car (the starting-line tree): frame both
      if (i.include !== null && Math.abs(i.include - p.x) < 14) {
        const lo = Math.min(p.x - p.wheelbaseM - 1.7, i.include - 1.6);
        const hi = Math.max(p.x + 1.7, i.include + 1.6);
        span = Math.max(span, (hi - lo) / 0.94);
        targetX = (lo + hi) / 2;
      }
      // a nearby opponent: open the view just enough to keep both cars in frame
      let nearest: CameraTarget | null = null;
      for (const o of i.others) if (!nearest || Math.abs(o.x - p.x) < Math.abs(nearest.x - p.x)) nearest = o;
      if (nearest) {
        const gap = nearest.x - p.x;
        const w = 1 - smoothstep(PAIR_RANGE_M * 0.75, PAIR_RANGE_M, Math.abs(gap));
        if (w > 0) {
          const pairSpan = (Math.abs(gap) + 7.5) / 0.86;
          span = Math.max(span, span + (pairSpan - span) * w);
          targetX += (gap / 2) * w * 0.8;
        }
      }
    }
    let targetPpm = Math.min(MAX_PPM, Math.max(MIN_PPM, W / span));
    // tall narrow views: do not let the road band fill the whole height
    targetPpm = Math.min(targetPpm, i.viewH / 6.2);
    const half = W / 2 / targetPpm;
    const lo = i.trackStartM + half;
    const hi = i.trackEndM - half;
    if (lo < hi) targetX = Math.min(hi, Math.max(lo, targetX));
    else targetX = (i.trackStartM + i.trackEndM) / 2;

    if (!this.initialised || Math.abs(targetX - this.x) > 120) {
      // first frame, or the car was put back on the start line: cut instead of flying over
      this.x = targetX;
      this.ppm = targetPpm;
      this.lead = 0;
      this.initialised = true;
    } else {
      const dt = Math.min(Math.max(dtS, 0), 0.1);
      // move with the car first (no lag at constant speed), then ease towards the framing target
      if (i.mode !== 'start' && p) this.x += p.speed * dt;
      this.x += (targetX - this.x) * (1 - Math.exp(-dt / 0.18));
      this.ppm += (targetPpm - this.ppm) * (1 - Math.exp(-dt / 0.45));
    }
    this.state = { x: this.x, ppm: this.ppm, groundY: Math.round(i.viewH * CameraController.groundFraction(i.viewH)) };
    return this.state;
  }
}
