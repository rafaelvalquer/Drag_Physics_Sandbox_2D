import type { CarConfig } from '../../../../data/schema';
import { drawFrame, type VehicleSpriteSet } from '../../VehicleSpriteAssembler';
import { centreOf, techAnchorsOf, type Box, type Pt, type TechAnchors, type VisualZone } from './PartVisualAnchors';
import { drawEngineSide, engineSpecOf } from './EngineDrawings';
import { techStateOf, type TechState } from './PartVisualResolver';

/**
 * Draws the workshop scene: the REAL art of the car (the same atlas frames of the track and the
 * garage) and, in technical view, an illustrative layer positioned by the anchors of its layout.
 * The two canvases of a comparison use the very same geometry (camera, scale, light).
 */
export interface SceneGeometry {
  /** Screen x of the front-axle ground contact. */
  x0: number;
  /** Screen y of the ground line. */
  gy: number;
  /** Atlas pixels -> screen pixels. */
  k: number;
  /** Screen pixels per metre. */
  ppm: number;
}

/** Fits the whole car (body, wheels, shadow) in a W x H canvas; `fill` is the fraction of the width. */
export function fitScene(set: VehicleSpriteSet, w: number, h: number, fill = 0.92): SceneGeometry {
  const m = set.meta;
  const ppm = m.pxPerM;
  const halfWheel = set.frames.wheel.w / (2 * ppm);
  const shadow = set.frames.shadow;
  const shadowMid = (m.rearX + m.noseX) / 2;
  const left = Math.min(-m.bodyOriginPx.x / ppm, m.wheelCentres.rear.x - halfWheel, shadowMid - shadow.w / (2 * ppm));
  const right = Math.max((set.frames.body.w - m.bodyOriginPx.x) / ppm, m.wheelCentres.front.x + halfWheel, shadowMid + shadow.w / (2 * ppm));
  const widthM = Math.max(0.1, right - left);
  const k = Math.min((w * fill) / (widthM * ppm), (h * 0.74) / (m.heightM * ppm));
  const px = ppm * k;
  return { x0: w / 2 - ((left + right) / 2) * px, gy: h * 0.83, k, ppm: px };
}

export interface SceneOptions {
  /** Technical view: ghost body and the illustrative layer. */
  technical?: { car: CarConfig; highlight: VisualZone | null };
  lights?: boolean;
}

const STROKE = '#9aa6b6';
const GOLD = '#c9a24d';
const BLUE = '#6ab4ff';

export function composeScene(ctx: CanvasRenderingContext2D, set: VehicleSpriteSet, g: SceneGeometry, o: SceneOptions = {}): void {
  const m = set.meta;
  const { x0, gy, k, ppm } = g;
  const ox = x0 - m.bodyOriginPx.x * k;
  const oy = gy - m.bodyOriginPx.y * k;
  const tech = o.technical;
  const sh = set.frames.shadow;
  const midX = x0 + ((m.rearX + m.noseX) / 2) * ppm;
  drawFrame(ctx, set, 'shadow', midX - (sh.w * k) / 2, gy - (sh.h * k) / 2 - 0.06 * ppm, k);
  drawFrame(ctx, set, 'under', ox, oy, k);
  const wf = set.frames.wheel;
  ctx.save();
  ctx.globalAlpha = tech ? 0.5 : 1;
  for (const [c, hub] of [[m.wheelCentres.rear, 'hubRear'], [m.wheelCentres.front, 'hub']] as const) {
    const cx = x0 + c.x * ppm;
    const cy = gy - c.y * ppm;
    drawFrame(ctx, set, hub, cx - (wf.w * k) / 2, cy - (wf.h * k) / 2, k);
    drawFrame(ctx, set, 'wheel', cx - (wf.w * k) / 2, cy - (wf.h * k) / 2, k);
  }
  ctx.restore();
  if (tech) drawTechnicalLayer(ctx, g, set, tech.car, tech.highlight);
  ctx.save();
  ctx.globalAlpha = tech ? 0.24 : 1;
  drawFrame(ctx, set, 'body', ox, oy, k);
  drawFrame(ctx, set, 'gloss', ox, oy, k);
  ctx.restore();
  if (o.lights && !tech) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    drawFrame(ctx, set, 'lights', ox, oy, k);
    ctx.restore();
  }
}

/** Screen position of a point in metres. */
export const toScreen = (g: SceneGeometry, p: Pt): [number, number] => [g.x0 + p.x * g.ppm, g.gy - p.y * g.ppm];

/** Hotspot of a zone as a percentage of the canvas (for the DOM marker). */
export function hotspotPercent(g: SceneGeometry, car: CarConfig, set: VehicleSpriteSet, zone: VisualZone, w: number, h: number): { left: number; top: number } {
  const a = techAnchorsOf(car, set.meta);
  const [x, y] = toScreen(g, a.zones[zone]);
  return { left: (x / w) * 100, top: (y / h) * 100 };
}

function drawTechnicalLayer(ctx: CanvasRenderingContext2D, g: SceneGeometry, set: VehicleSpriteSet, car: CarConfig, highlight: VisualZone | null): void {
  const a = techAnchorsOf(car, set.meta);
  const st = techStateOf(car);
  const spec = engineSpecOf(car);
  const P = (p: Pt): [number, number] => toScreen(g, p);
  const lit = (z: VisualZone): boolean => highlight === z;
  const glow = (z: VisualZone): void => {
    ctx.shadowColor = lit(z) ? '#ffcf8a' : 'transparent';
    ctx.shadowBlur = lit(z) ? 16 : 0;
    ctx.globalAlpha = lit(z) || !highlight ? 1 : 0.72;
  };
  const done = (): void => {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 1;
  };
  const rect = (b: Box, fill: string, stroke: string, r = 6, lw = 2): void => {
    const [x1, y1] = P({ x: b.x0, y: b.y1 });
    const [x2, y2] = P({ x: b.x1, y: b.y0 });
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(x1, y1, x2 - x1, y2 - y1, r);
    ctx.fill();
    ctx.stroke();
  };
  const line = (pts: Pt[], col: string, w: number, dash: number[] = []): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = P(p);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const pw = Math.max(3, g.ppm * 0.03);

  // exhaust line (manifold to tail) and muffler
  glow('exhaust');
  line(a.exhaust, lit('exhaust') ? '#ffcf8a' : st.sportExhaust ? '#d6dce4' : '#8a94a2', pw * (st.sportExhaust ? 2.4 : 2));
  rect(a.muffler, '#4a5360', lit('exhaust') ? '#ffcf8a' : STROKE, 8);
  done();
  // drive line: halfshaft / propshaft + differential
  glow('diff');
  if (a.frontDrive) line(a.frontDrive, '#7b8592', pw * 2);
  if (a.rearDrive) line(a.rearDrive, '#7b8592', pw * 2);
  if (a.frontDiff) rect(a.frontDiff, '#3a4350', lit('diff') ? '#ffcf8a' : STROKE, 6);
  if (a.rearDiff) rect(a.rearDiff, '#3a4350', lit('diff') ? '#ffcf8a' : STROKE, 6);
  done();
  // gearbox / clutch
  glow(lit('clutch') ? 'clutch' : 'transmission');
  rect(a.gearbox, '#2d3340', lit('clutch') || lit('transmission') ? '#ffcf8a' : STROKE, 8);
  done();
  // engine
  glow(lit('intake') ? 'intake' : 'engine');
  const [ex, ey] = P({ x: a.engine.x0, y: a.engine.y1 });
  const [ex2, ey2] = P({ x: a.engine.x1, y: a.engine.y0 });
  drawEngineSide(ctx, ex, ey, ex2 - ex, ey2 - ey, spec, lit('engine') || lit('intake') ? '#ffcf8a' : STROKE, lit('engine') || lit('intake'));
  done();
  // intake plenum
  glow('intake');
  rect(a.intake, '#2f4a63', lit('intake') ? '#ffcf8a' : BLUE, 4, 1.5);
  done();
  // radiator (always) and intercooler / turbo / nitrous (when installed)
  glow('cooling');
  rect(a.radiator, '#2d3340', lit('cooling') ? '#ffcf8a' : '#7b8592', 3, 1.5);
  done();
  if (st.intercooler) {
    glow('intercooler');
    rect(a.intercooler, '#2f4a63', lit('intercooler') ? '#ffcf8a' : BLUE, 4, 1.5);
    const c = centreOf(a.intercooler);
    line([{ x: c.x, y: a.intercooler.y1 }, { x: a.intake.x1 - 0.05, y: a.intake.y1 }], BLUE, pw, [4, 4]);
    done();
  }
  if (st.turbo !== 'none') {
    glow('turbo');
    const r = g.ppm * (st.turbo === 'twin' ? 0.07 : 0.1);
    for (const t of a.turbos) {
      const [tx, ty] = P(t);
      ctx.fillStyle = '#5b4a2a';
      ctx.strokeStyle = lit('turbo') ? '#ffcf8a' : GOLD;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a2113';
      ctx.beginPath();
      ctx.arc(tx, ty, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    line([a.turbos[0]!, { x: a.intake.x1 - 0.1, y: a.intake.y0 }], GOLD, pw);
    done();
  }
  if (st.nitrous) {
    glow('nitro');
    rect(a.nitroCylinder, lit('nitro') ? '#3a7bb5' : '#2f4a63', BLUE, 14, 2);
    line(a.nitroLine, BLUE, pw * 0.9, [4, 5]);
    done();
  }
  if (lit('ecu')) {
    const [x, y] = P(a.ecu);
    ctx.strokeStyle = '#ffcf8a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 10, y - 7, 20, 14);
  }
}

/** Anchors with the layout of a car (re-exported for the UI). */
export function anchorsFor(car: CarConfig, set: VehicleSpriteSet): TechAnchors {
  return techAnchorsOf(car, set.meta);
}

/** Tech state of a car (re-exported for the UI). */
export function stateFor(car: CarConfig): TechState {
  return techStateOf(car);
}
