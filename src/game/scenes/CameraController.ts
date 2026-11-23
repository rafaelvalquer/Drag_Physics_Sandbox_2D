/**
 * Side-view camera. Pure logic (no rendering): from the vehicles and the view size it produces
 * the horizontal position, the zoom (pixels per metre) and the screen height of the near lane.
 *
 * Framing goals: the cars are the subject – at rest the player's car fills about a third of the
 * view width – the track sits in the lower-middle of the picture, the zoom opens moderately with
 * speed, the camera leads the car in its direction of travel and never jumps (except when the
 * car itself is teleported back to the start or the camera mode changes: those are cuts).
 *
 * Stability: in follow and wide the camera is carried by exactly the distance the player's car
 * moved on screen since the last frame (the same interpolated position the sprite is drawn at),
 * and only the remaining difference to the framing target – look-ahead, zoom, an opponent or the
 * tree in frame – is eased. At any constant or changing speed the car therefore keeps its place
 * on screen to a fraction of a pixel; there is no second, velocity-based prediction that could
 * disagree with the drawn position. The track limits clamp the final position, not the target.
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
/** Time constants (s) of the framing residual, the look-ahead and the zoom. */
const FRAME_TAU_S = 0.18;
const LEAD_TAU_S = 0.5;
const ZOOM_TAU_S = 0.45;
/** Longest frame step used for easing (s); positions are carried exactly whatever the gap. */
const MAX_EASE_DT_S = 0.1;
/** A jump of the followed car larger than this in one frame is a teleport (m): cut. */
const TELEPORT_M = 30;
/** An opponent closer than this (m) is kept in frame by opening the zoom a little. */
const PAIR_RANGE_M = 16;
const MIN_PPM = 6;
const MAX_PPM = 150;
/** Reference viewport: keep the same vertical world coverage while horizontal FOV adapts. */
const REFERENCE_VIEW_W = 1280;
const REFERENCE_VIEW_H = 720;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export class CameraController {
  private x = 0;
  private ppm = 0;
  private lead = 0;
  private initialised = false;
  private lastMode: CameraMode | null = null;
  /** Player's drawn centre (m) at the last frame, NaN when there was none. */
  private lastAnchor = Number.NaN;
  state: CameraState = { x: 0, ppm: 60, groundY: 400 };

  /** Fraction of the view height where the near lane's ground line sits. */
  static groundFraction(viewH: number): number {
    return viewH < 520 ? 0.66 : 0.7;
  }

  /** Forget the tracking state: the next update cuts straight to the framing target. */
  reset(): void {
    this.initialised = false;
    this.lastAnchor = Number.NaN;
    this.lead = 0;
  }

  update(dtS: number, i: CameraInput): CameraState {
    const dt = Number.isFinite(dtS) ? Math.min(Math.max(dtS, 0), MAX_EASE_DT_S) : 0;
    const p = i.player;
    const anchor = p ? p.x - p.wheelbaseM * 0.5 : Number.NaN;
    // a new camera mode or a car put somewhere else starts the tracking from scratch
    if (i.mode !== this.lastMode || (Number.isFinite(this.lastAnchor) && Math.abs(anchor - this.lastAnchor) > TELEPORT_M) || Number.isFinite(anchor) !== Number.isFinite(this.lastAnchor)) this.reset();
    this.lastMode = i.mode;
    const W = Math.max(1, i.viewW);
    const zoomUser = Math.min(2, Math.max(0.4, i.userZoom));
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
      // the look-ahead is a damped offset from the drawn car, never a position prediction
      this.lead = this.initialised ? this.lead + (leadTarget - this.lead) * (1 - Math.exp(-dt / LEAD_TAU_S)) : leadTarget;
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
    // Keep the vertical framing on wider screens and fit the full target span on narrow ones.
    const framingWidth = Math.min(W, i.viewH * REFERENCE_VIEW_W / REFERENCE_VIEW_H);
    const targetPpm = Math.min(MAX_PPM, Math.max(MIN_PPM, framingWidth / span));
    targetX = this.clampToTrack(targetX, targetPpm, W, i);

    if (!this.initialised || Math.abs(targetX - this.x) > 120) {
      // first frame, new mode, or the car was put back on the start line: cut instead of flying
      this.x = targetX;
      this.ppm = targetPpm;
      this.initialised = true;
    } else {
      // carry the view with the drawn car (exactly, whatever the frame time), then ease only the
      // remaining difference to the framing target
      if (i.mode !== 'start' && Number.isFinite(anchor)) this.x += anchor - this.lastAnchor;
      this.x += (targetX - this.x) * (1 - Math.exp(-dt / FRAME_TAU_S));
      this.ppm += (targetPpm - this.ppm) * (1 - Math.exp(-dt / ZOOM_TAU_S));
      // the limits apply to what is shown: near the ends of the track the car moves on screen
      this.x = this.clampToTrack(this.x, this.ppm, W, i);
    }
    this.lastAnchor = anchor;
    this.state.x = this.x;
    this.state.ppm = this.ppm;
    this.state.groundY = Math.round(i.viewH * CameraController.groundFraction(i.viewH));
    return this.state;
  }

  private clampToTrack(x: number, ppm: number, W: number, i: CameraInput): number {
    const half = W / 2 / ppm;
    const lo = i.trackStartM + half;
    const hi = i.trackEndM - half;
    return lo < hi ? Math.min(hi, Math.max(lo, x)) : (i.trackStartM + i.trackEndM) / 2;
  }
}
