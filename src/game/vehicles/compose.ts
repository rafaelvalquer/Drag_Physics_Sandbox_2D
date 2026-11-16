import { drawFrame, type VehicleSpriteSet } from './VehicleSpriteAssembler';

/**
 * Draws a complete vehicle on a 2D canvas from its atlas frames, in the same layer order as the
 * track scene (shadow, wheel wells, hub, wheel, body, gloss, lamps). Used by the garage, the
 * dyno bay and the art contact sheet, so every screen shows the very same artwork.
 */
export interface ComposeOptions {
  /** Head and tail lamps on. */
  lights?: boolean;
  brake?: boolean;
  /** Wheel rotation (rad) of the rear and front wheels. */
  rearAngle?: number;
  frontAngle?: number;
  /** Which wheel sprite to draw: sharp, softly blurred or fully blurred. */
  rearFrame?: 'wheel' | 'wheelSoft' | 'wheelFull';
  frontFrame?: 'wheel' | 'wheelSoft' | 'wheelFull';
  shadow?: boolean;
  /** Body offset on its suspension (px, positive = down) – wheels stay on the ground. */
  bodyDy?: number;
}

/**
 * @param x       screen x of the front-axle ground contact
 * @param groundY screen y of the ground
 * @param scale   screen pixels per atlas pixel
 */
export function composeVehicle(ctx: CanvasRenderingContext2D, set: VehicleSpriteSet, x: number, groundY: number, scale: number, o: ComposeOptions = {}): void {
  const m = set.meta;
  const k = scale;
  const px = m.pxPerM * k;
  const ox = x - m.bodyOriginPx.x * k;
  const oy = groundY - m.bodyOriginPx.y * k + (o.bodyDy ?? 0);
  if (o.shadow !== false) {
    const sh = set.frames.shadow;
    const midX = x + ((m.rearX + m.noseX) / 2) * px;
    drawFrame(ctx, set, 'shadow', midX - (sh.w * k) / 2, groundY - (sh.h * k) / 2 - 0.06 * px, k);
  }
  drawFrame(ctx, set, 'under', ox, oy, k);
  const wheels: [typeof m.wheelCentres.rear, number, 'wheel' | 'wheelSoft' | 'wheelFull'][] = [
    [m.wheelCentres.rear, o.rearAngle ?? 0, o.rearFrame ?? 'wheel'],
    [m.wheelCentres.front, o.frontAngle ?? 0, o.frontFrame ?? 'wheel'],
  ];
  for (const [c, angle, frame] of wheels) {
    const wf = set.frames.wheel;
    const cx = x + c.x * px;
    const cy = groundY - c.y * px;
    drawFrame(ctx, set, 'hub', cx - (wf.w * k) / 2, cy - (wf.h * k) / 2, k);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    drawFrame(ctx, set, frame, (-wf.w * k) / 2, (-wf.h * k) / 2, k);
    ctx.restore();
  }
  drawFrame(ctx, set, 'body', ox, oy, k);
  drawFrame(ctx, set, 'gloss', ox, oy, k);
  if (o.lights || o.brake) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (o.lights) drawFrame(ctx, set, 'lights', ox, oy, k);
    if (o.brake) drawFrame(ctx, set, 'brake', ox, oy, k);
    ctx.restore();
  }
}
