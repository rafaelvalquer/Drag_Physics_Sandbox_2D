/**
 * Wheel presentation from the simulated wheel speed.
 *
 * The rotation angle is the one integrated by the physics for that axle (driven wheels follow
 * the driveline, free wheels the road speed), so a spinning tyre visibly turns faster than the
 * car moves. This controller only decides how the wheel is drawn at that angular speed: sharp
 * artwork at low speed, a light rotational blur at medium speed and a fully blurred disc at high
 * speed (a sharp spoke pattern would alias against the frame rate there).
 */
export interface WheelLayers {
  /** Opacity of the sharp, softly blurred and fully blurred wheel sprites (stacked in this order). */
  sharp: number;
  soft: number;
  full: number;
}

export type WheelBlurMode = 'off' | 'full' | 'staged';

/** Angular speeds (rad/s) between which each blur stage fades in. */
export const SOFT_BLUR_RANGE = [9, 20] as const;
export const FULL_BLUR_RANGE = [24, 46] as const;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export class WheelAnimationController {
  constructor(public mode: WheelBlurMode = 'staged') {}

  /**
   * Layer opacities for the angular speed `omega` (rad/s). A lower layer stays opaque until the
   * layer above it has fully faded in, so the wheel never becomes see-through during a transition.
   */
  layers(omega: number): WheelLayers {
    const w = Math.abs(omega);
    if (this.mode === 'off') return { sharp: 1, soft: 0, full: 0 };
    const s2 = smoothstep(FULL_BLUR_RANGE[0], FULL_BLUR_RANGE[1], w);
    if (this.mode === 'full') return { sharp: s2 >= 1 ? 0 : 1, soft: 0, full: s2 };
    const s1 = smoothstep(SOFT_BLUR_RANGE[0], SOFT_BLUR_RANGE[1], w);
    return { sharp: s1 >= 1 ? 0 : 1, soft: s2 >= 1 ? 0 : s1, full: s2 };
  }
}
