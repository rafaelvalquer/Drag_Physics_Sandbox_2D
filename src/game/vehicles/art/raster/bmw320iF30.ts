import type { CarConfig } from '../../../../data/schema';
import type { RasterBody, RasterFrames, RasterMeta } from './types';

/**
 * Painted (raster) side art of the BMW 320i F30.
 *
 * The geometry was measured on side photographs of a real F30 (outline, window graphic with the
 * C-pillar kink, door cuts, shoulder line, the stepped tail with the boot lip and the bumper below
 * the lamps) and is kept in "photo metres" (x from the rear bumper, y up from the ground). It is
 * mapped piecewise onto the car's own overhangs and wheelbase and scaled to its height, so the
 * art always sits on the physics geometry.
 */

// photo axle positions, length and roof height (m)
const P_XR = 0.969;
const P_XF = 3.934;
const P_LEN = 4.624;
const P_ROOF = 1.482;

type Cmd = ['M' | 'L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

function geometry(car: CarConfig, S: number) {
  const v = car.visual;
  const L = v.lengthM;
  const xF = L - v.frontOverhangM;
  const xR = xF - car.wheelbaseM;
  const r = car.tires.radiusM;
  const mx = (x: number): number => {
    if (x < P_XR) return xR - (P_XR - x) * (xR / P_XR);
    if (x < P_XF) return xR + (x - P_XR) * ((xF - xR) / (P_XF - P_XR));
    return xF + (x - P_XF) * ((L - xF) / (P_LEN - P_XF));
  };
  // same frame as bodyArt: 0.5 m margin behind, 0.42 m above the roof
  const top = v.heightM + 0.42;
  return { L, xR, xF, r, ra: r + 0.05, ky: v.heightM / P_ROOF, mx, X: (x: number): number => (x + 0.5) * S, Y: (y: number): number => (top - y) * S };
}

/** Pure metadata the raster art implies (lamps and exhaust), relative to the front-axle contact. */
export function bmw320iF30Meta(car: CarConfig): RasterMeta {
  const g = geometry(car, 1);
  const at = (x: number, y: number): { x: number; y: number } => ({ x: g.mx(x) - g.xF, y: y * g.ky });
  return { headlight: at(4.6, 0.64), taillight: at(0.0, 0.92), exhausts: [at(0.08, 0.33)] };
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

const TOP: Cmd[] = [
  ['M', 0.086, 0.29], ['C', 0.05, 0.3, 0.02, 0.33, -0.023, 0.371], ['C', -0.04, 0.41, -0.046, 0.44, -0.046, 0.47], ['C', -0.046, 0.53, -0.04, 0.57, -0.034, 0.584],
  ['C', -0.01, 0.63, 0.03, 0.66, 0.034, 0.693], ['C', 0.035, 0.72, 0.03, 0.74, 0.023, 0.756], ['C', 0.0, 0.8, -0.029, 0.86, -0.029, 0.898], ['C', -0.029, 0.94, -0.026, 0.97, -0.023, 0.984],
  ['C', 0.0, 1.03, 0.015, 1.06, 0.029, 1.069], ['C', 0.045, 1.085, 0.06, 1.105, 0.071, 1.109], ['C', 0.1, 1.103, 0.14, 1.1, 0.171, 1.098], ['C', 0.3, 1.12, 0.4, 1.14, 0.456, 1.155],
  ['C', 0.6, 1.19, 0.75, 1.245, 0.9, 1.31], ['C', 1.0, 1.36, 1.15, 1.42, 1.311, 1.445], ['C', 1.45, 1.47, 1.6, 1.482, 1.739, 1.482], ['C', 1.95, 1.482, 2.15, 1.475, 2.309, 1.463],
  ['C', 2.5, 1.43, 2.65, 1.39, 2.737, 1.368], ['C', 2.9, 1.25, 3.1, 1.1, 3.25, 1.026], ['C', 3.4, 1.02, 3.5, 1.015, 3.535, 1.012],
  ['C', 3.7, 1.0, 3.8, 0.995, 3.877, 0.984], ['C', 4.0, 0.96, 4.1, 0.935, 4.162, 0.912], ['C', 4.3, 0.85, 4.4, 0.79, 4.448, 0.755],
  ['C', 4.52, 0.72, 4.57, 0.69, 4.59, 0.67], ['C', 4.61, 0.62, 4.619, 0.57, 4.619, 0.527], ['L', 4.619, 0.385], ['C', 4.615, 0.25, 4.605, 0.18, 4.59, 0.143],
];
const DLO: Cmd[] = [
  ['M', 1.012, 1.026], ['C', 0.975, 1.07, 0.965, 1.13, 0.969, 1.183], ['C', 0.98, 1.24, 1.01, 1.28, 1.055, 1.297], ['C', 1.2, 1.35, 1.32, 1.375, 1.454, 1.383],
  ['C', 1.7, 1.4, 1.9, 1.41, 2.024, 1.411], ['C', 2.3, 1.41, 2.55, 1.385, 2.737, 1.354], ['C', 2.85, 1.24, 3.0, 1.06, 3.136, 0.941], ['L', 1.012, 1.026], ['Z'],
];
const belt = (x: number): number => 1.026 + ((x - 1.012) / (3.136 - 1.012)) * (0.941 - 1.026);

export const paintBmw320iF30: RasterBody = (car, S, frame, wheelSize, newCanvas) => {
  const g = geometry(car, S);
  const { X, Y, mx, ky, r, ra, xR, xF } = g;
  const SILL = 0.171 * ky;
  const pt = (x: number, y: number): [number, number] => [X(mx(x)), Y(y * ky)];
  const trace = (ctx: CanvasRenderingContext2D, cmds: readonly Cmd[]): void => {
    ctx.beginPath();
    for (const c of cmds) {
      if (c[0] === 'M') ctx.moveTo(...pt(c[1], c[2]));
      else if (c[0] === 'L') ctx.lineTo(...pt(c[1], c[2]));
      else if (c[0] === 'C') ctx.bezierCurveTo(...pt(c[1], c[2]), ...pt(c[3], c[4]), ...pt(c[5], c[6]));
      else ctx.closePath();
    }
  };
  const ta = Math.asin(Math.max(-1, Math.min(1, (SILL - r) / ra)));
  const bodyPath = (ctx: CanvasRenderingContext2D): void => {
    trace(ctx, TOP);
    for (const cx of [xF, xR]) {
      ctx.lineTo(X(cx + ra * Math.cos(ta)), Y(SILL));
      for (let i = 0; i <= 40; i++) {
        const t = ta + ((Math.PI - 2 * ta) * i) / 40;
        ctx.lineTo(X(cx + ra * Math.cos(t)), Y(r + ra * Math.sin(t)));
      }
    }
    ctx.lineTo(...pt(0.542, 0.242));
    ctx.bezierCurveTo(...pt(0.3, 0.255), ...pt(0.15, 0.275), ...pt(0.086, 0.29));
    ctx.closePath();
  };
  const grad = (ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]): CanvasGradient => {
    const gr = ctx.createLinearGradient(0, Y(y0 * ky), 0, Y(y1 * ky));
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  };
  const blurPx = (px: number): string => `blur(${Math.max(0.5, (px * S) / 420).toFixed(2)}px)`;
  const stroke = (ctx: CanvasRenderingContext2D, cmds: readonly Cmd[], w: number, col: string, blur = 0): void => {
    ctx.save();
    if (blur) ctx.filter = blurPx(blur);
    trace(ctx, cmds);
    ctx.lineWidth = w * S;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  };
  const fill = (ctx: CanvasRenderingContext2D, cmds: readonly Cmd[], col: string | CanvasGradient): void => {
    trace(ctx, cmds);
    ctx.fillStyle = col;
    ctx.fill();
  };

  // ------------------------------------------------------------ paint (grayscale)
  const [paint, p] = newCanvas(frame.w, frame.h);
  bodyPath(p);
  p.fillStyle = grad(p, 1.48, 0.17, [[0, '#f4f4f4'], [0.25, '#e4e4e4'], [0.42, '#f2f2f2'], [0.46, '#c2c2c2'], [0.6, '#d0d0d0'], [0.8, '#a8a8a8'], [1, '#6a6a6a']]);
  p.fill();
  p.globalCompositeOperation = 'source-atop';
  stroke(p, [['M', 1.4, 1.465], ['C', 1.7, 1.476, 2.1, 1.476, 2.4, 1.452]], 0.022, 'rgba(255,255,255,.9)', 5);
  stroke(p, [['M', 3.25, 0.99], ['C', 3.6, 0.95, 4.0, 0.87, 4.4, 0.75]], 0.03, 'rgba(255,255,255,.85)', 7);
  // shoulder line from the tail lamp falling to the front fender, lower line rising to the rear
  stroke(p, [['M', 0.314, 0.95], ['C', 1.5, 0.9, 3.0, 0.83, 4.305, 0.745]], 0.01, 'rgba(255,255,255,1)', 1.5);
  stroke(p, [['M', 0.314, 0.925], ['C', 1.5, 0.875, 3.0, 0.805, 4.305, 0.72]], 0.035, 'rgba(0,0,0,.28)', 8);
  stroke(p, [['M', 3.42, 0.3], ['C', 2.8, 0.33, 2.0, 0.38, 1.46, 0.44]], 0.05, 'rgba(0,0,0,.22)', 9);
  stroke(p, [['M', 3.42, 0.33], ['C', 2.8, 0.36, 2.0, 0.41, 1.46, 0.47]], 0.01, 'rgba(255,255,255,.45)', 2);
  // the stepped tail: tuck under the lamp, bumper shoulder, boot lip
  stroke(p, [['M', -0.03, 0.78], ['C', 0.1, 0.77, 0.3, 0.76, 0.5, 0.73]], 0.04, 'rgba(0,0,0,.3)', 7);
  stroke(p, [['M', -0.03, 0.6], ['C', 0.1, 0.6, 0.3, 0.6, 0.55, 0.58]], 0.01, 'rgba(255,255,255,.75)', 2);
  stroke(p, [['M', 0.03, 1.07], ['C', 0.06, 1.1, 0.1, 1.105, 0.171, 1.1]], 0.008, 'rgba(255,255,255,.9)', 1);
  for (const cx of [xF, xR]) {
    p.save();
    p.filter = blurPx(6);
    p.beginPath();
    p.arc(X(cx), Y(r), (ra + 0.045) * S, Math.PI * 1.05, Math.PI * 1.95);
    p.lineWidth = 0.04 * S;
    p.strokeStyle = 'rgba(255,255,255,.35)';
    p.stroke();
    p.restore();
  }
  const gx = p.createLinearGradient(X(0), 0, X(g.L), 0);
  gx.addColorStop(0, 'rgba(0,0,0,.4)');
  gx.addColorStop(0.045, 'rgba(0,0,0,0)');
  gx.addColorStop(0.94, 'rgba(0,0,0,0)');
  gx.addColorStop(1, 'rgba(0,0,0,.4)');
  p.fillStyle = gx;
  p.fillRect(0, 0, frame.w, frame.h);
  p.globalCompositeOperation = 'source-over';
  // mirror cap (body colour)
  fill(p, [['M', 2.822, 0.975], ['C', 2.83, 1.06, 2.9, 1.11, 2.99, 1.112], ['C', 3.03, 1.1, 3.03, 1.03, 3.022, 0.97], ['Z']], grad(p, 1.11, 0.98, [[0, '#f0f0f0'], [1, '#8a8a8a']]));

  // tint with the car colour: light and shade from the gray layer, extra sheen on dark paints
  const [cr, cg, cb] = hexRgb(car.visual.color);
  const dark = 1 - (0.3 * cr + 0.59 * cg + 0.11 * cb);
  const img = p.getImageData(0, 0, frame.w, frame.h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const Lm = d[i]! / 255;
    const base = Math.min(1, Lm * 1.08);
    const spec = Math.max(0, Lm - 0.9) * 2.5 + dark * Math.max(0, Lm - 0.62) * 0.55;
    d[i] = 255 * Math.min(1, cr * base + spec);
    d[i + 1] = 255 * Math.min(1, cg * base + spec);
    d[i + 2] = 255 * Math.min(1, cb * base + spec);
  }
  p.putImageData(img, 0, 0);

  // ------------------------------------------------------------ fixed details on the body
  const b = p;
  fill(b, DLO, grad(b, 1.4, 0.95, [[0, '#2a323c'], [0.5, '#12171d'], [1, '#090b0e']]));
  b.save();
  trace(b, DLO);
  b.clip();
  b.fillStyle = 'rgba(42,48,56,.9)';
  for (const hx of [2.3, 1.55]) {
    b.beginPath();
    b.ellipse(...pt(hx, 1.2), 0.065 * S, 0.095 * S, -0.2, 0, Math.PI * 2);
    b.fill();
  }
  b.globalAlpha = 0.16;
  b.fillStyle = '#cfe2ff';
  for (const [a, w] of [[2.5, 0.18], [2.1, 0.05], [1.65, 0.14]] as const) {
    b.beginPath();
    b.moveTo(...pt(a, 1.4));
    b.lineTo(...pt(a + w, 1.4));
    b.lineTo(...pt(a + w - 0.25, 0.95));
    b.lineTo(...pt(a - 0.25, 0.95));
    b.fill();
  }
  b.restore();
  stroke(b, DLO, 0.016, '#0b0c0e');
  fill(b, [['M', 1.939, belt(1.939)], ['L', 2.067, belt(2.067)], ['L', 2.04, 1.411], ['L', 1.925, 1.409], ['Z']], '#0b0c0e');
  fill(b, [['M', 1.34, belt(1.34)], ['L', 1.383, belt(1.383)], ['L', 1.37, 1.38], ['L', 1.33, 1.377], ['Z']], '#0b0c0e');
  fill(b, [['M', 2.84, 0.955], ['L', 3.0, 0.948], ['L', 2.99, 0.975], ['L', 2.85, 0.978], ['Z']], '#0b0c0e');
  const gap = (cmds: Cmd[]): void => stroke(b, cmds, 0.006, 'rgba(10,10,12,.85)');
  gap([['M', 3.179, 0.941], ['C', 3.25, 0.85, 3.29, 0.72, 3.293, 0.641], ['L', 3.264, 0.24]]);
  gap([['M', 1.996, belt(1.996)], ['L', 1.99, 0.22]]);
  gap([['M', 1.026, 1.012], ['L', 1.454, 0.356]]);
  gap([['M', 3.3, 1.0], ['C', 3.7, 0.975, 4.1, 0.9, 4.42, 0.75]]);
  gap([['M', 0.47, 1.14], ['C', 0.35, 1.12, 0.2, 1.1, 0.09, 1.075]]);
  for (const hx of [2.167, 1.155]) {
    const hy = hx > 2 ? 0.835 : 0.91;
    fill(b, [['M', hx, hy], ['C', hx + 0.05, hy + 0.014, hx + 0.2, hy + 0.01, hx + 0.245, hy - 0.002], ['C', hx + 0.22, hy - 0.022, hx + 0.04, hy - 0.02, hx, hy], ['Z']], grad(b, hy + 0.012, hy - 0.02, [[0, '#f4f6f8'], [1, '#7d838b']]));
  }
  // L-shaped tail lamp
  const TL: Cmd[] = [['M', 0.02, 0.83], ['L', 0.12, 0.828], ['C', 0.2, 0.86, 0.28, 0.92, 0.33, 0.955], ['L', 0.314, 0.99], ['L', 0.0, 1.0], ['C', -0.02, 0.97, -0.028, 0.92, -0.029, 0.9], ['C', -0.02, 0.86, 0.0, 0.84, 0.02, 0.83], ['Z']];
  fill(b, TL, grad(b, 1.0, 0.83, [[0, '#ff5a50'], [0.45, '#c0121c'], [1, '#55060a']]));
  b.save();
  trace(b, TL);
  b.clip();
  for (const yy of [0.97, 0.94]) stroke(b, [['M', 0.0, yy], ['C', 0.1, yy + 0.008, 0.2, yy + 0.008, 0.3, yy + 0.015]], 0.007, 'rgba(255,190,170,.9)', 1);
  b.restore();
  stroke(b, TL, 0.004, 'rgba(0,0,0,.6)');
  // headlamp with the corona ring
  const HL: Cmd[] = [['M', 4.29, 0.71], ['L', 4.56, 0.665], ['C', 4.6, 0.64, 4.605, 0.6, 4.6, 0.575], ['L', 4.4, 0.6], ['C', 4.33, 0.62, 4.29, 0.67, 4.29, 0.71], ['Z']];
  fill(b, HL, grad(b, 0.71, 0.57, [[0, '#eef2f7'], [0.5, '#8f99a6'], [1, '#2a3038']]));
  b.save();
  trace(b, HL);
  b.clip();
  b.strokeStyle = 'rgba(215,238,255,.95)';
  b.lineWidth = 0.008 * S;
  b.beginPath();
  b.ellipse(...pt(4.5, 0.625), 0.04 * S, 0.028 * S, 0, 0, Math.PI * 2);
  b.stroke();
  b.restore();
  stroke(b, HL, 0.005, 'rgba(0,0,0,.6)');
  // front bumper: fog pocket, lower lip; career part: intercooler behind the lower opening
  fill(b, [['M', 4.45, 0.27], ['L', 4.6, 0.28], ['C', 4.61, 0.32, 4.61, 0.37, 4.6, 0.39], ['L', 4.47, 0.37], ['Z']], car.visual.mods?.intercooler ? '#8e979f' : '#0d0e10');
  if (car.visual.mods?.intercooler) for (let i = 1; i < 6; i++) stroke(b, [['M', 4.45, 0.27 + i * 0.019], ['L', 4.61, 0.28 + i * 0.019]], 0.004, 'rgba(30,34,38,.85)');
  fill(b, [['M', 4.4, 0.215], ['L', 4.58, 0.24], ['L', 4.58, 0.26], ['L', 4.36, 0.24], ['Z']], '#131417');
  // rear: reflector and diffuser
  fill(b, [['M', -0.03, 0.495], ['L', 0.08, 0.495], ['L', 0.08, 0.515], ['L', -0.03, 0.515], ['Z']], '#8a0b12');
  fill(b, [['M', 0.03, 0.31], ['L', 0.6, 0.27], ['L', 0.62, 0.33], ['C', 0.4, 0.34, 0.2, 0.345, 0.04, 0.345], ['Z']], '#121316');
  // shark-fin antenna
  fill(b, [['M', 1.24, 1.44], ['C', 1.27, 1.48, 1.31, 1.495, 1.35, 1.495], ['L', 1.36, 1.46], ['Z']], '#0b0c0e');
  b.save();
  bodyPath(b);
  b.lineWidth = 0.004 * S;
  b.strokeStyle = 'rgba(0,0,0,.5)';
  b.stroke();
  b.restore();

  // ------------------------------------------------------------ under: wheel wells, exhaust tip
  const [under, u] = newCanvas(frame.w, frame.h);
  for (const cx of [xF, xR]) {
    const wg = u.createRadialGradient(X(cx), Y(r), 0, X(cx), Y(r), ra * S);
    wg.addColorStop(0, '#010101');
    wg.addColorStop(0.8, '#0a0c0e');
    wg.addColorStop(1, '#15181b');
    u.fillStyle = wg;
    u.beginPath();
    u.arc(X(cx), Y(r), (ra - 0.004) * S, 0, Math.PI * 2);
    u.fill();
  }
  const sport = !!car.visual.mods?.sportTip;
  const [ex, ey] = pt(0.14, 0.33);
  const tw = (sport ? 0.075 : 0.06) * S;
  const th = (sport ? 0.036 : 0.028) * S;
  const tg = u.createLinearGradient(0, ey - th, 0, ey + th);
  tg.addColorStop(0, '#e0e3e7');
  tg.addColorStop(1, '#5b6067');
  u.fillStyle = tg;
  u.beginPath();
  u.ellipse(ex, ey, tw, th, 0, 0, Math.PI * 2);
  u.fill();
  u.fillStyle = '#050505';
  u.beginPath();
  u.ellipse(ex - tw * 0.15, ey, tw * 0.7, th * 0.64, 0, 0, Math.PI * 2);
  u.fill();

  // ------------------------------------------------------------ lamps (additive glow layers)
  const glow = (cx: number, cy: number, rx: number, ry: number, col: string): HTMLCanvasElement => {
    const [c, x] = newCanvas(frame.w, frame.h);
    x.save();
    x.translate(cx, cy);
    x.scale(1, ry / rx);
    const gr = x.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.beginPath();
    x.arc(0, 0, rx, 0, Math.PI * 2);
    x.fill();
    x.restore();
    return c;
  };
  const [hx, hy] = pt(4.52, 0.64);
  const [tx, ty] = pt(0.12, 0.92);
  const lights = glow(hx, hy, 0.17 * S, 0.08 * S, 'rgba(225,240,255,.8)');
  lights.getContext('2d')!.drawImage(glow(tx, ty, 0.16 * S, 0.06 * S, 'rgba(255,40,30,.45)'), 0, 0);
  const brake = glow(tx, ty, 0.2 * S, 0.08 * S, 'rgba(255,30,20,.9)');

  // ------------------------------------------------------------ wheel: 17" ten-spoke in V pairs
  const [wheel, w] = newCanvas(wheelSize, wheelSize);
  const c0 = wheelSize / 2;
  const R = r * S;
  const rim = r * 0.718 * S;
  const tyreG = w.createRadialGradient(c0, c0, rim, c0, c0, R);
  tyreG.addColorStop(0, '#1d1d1f');
  tyreG.addColorStop(0.4, '#2b2b2e');
  tyreG.addColorStop(0.8, '#141416');
  tyreG.addColorStop(1, '#070707');
  w.fillStyle = tyreG;
  w.beginPath();
  w.arc(c0, c0, R, 0, Math.PI * 2);
  w.fill();
  if (car.visual.mods?.tyre && car.visual.mods.tyre !== 'stock') {
    w.save();
    w.translate(c0, c0);
    w.fillStyle = 'rgba(235,238,242,.9)';
    w.font = `700 ${(0.03 * S).toFixed(1)}px system-ui, sans-serif`;
    w.textAlign = 'center';
    for (const a of [0, Math.PI]) {
      w.save();
      w.rotate(a);
      w.fillText('PERFORMANCE', 0, -(rim + (R - rim) * 0.4));
      w.restore();
    }
    w.restore();
  }
  w.save();
  w.translate(c0, c0);
  w.fillStyle = '#17191c';
  w.beginPath();
  w.arc(0, 0, rim, 0, Math.PI * 2);
  w.fill();
  const dg = w.createRadialGradient(0, 0, 0.03 * S, 0, 0, 0.165 * S);
  dg.addColorStop(0, '#5d6268');
  dg.addColorStop(0.8, '#8d9399');
  dg.addColorStop(1, '#4a4f55');
  w.fillStyle = dg;
  w.beginPath();
  w.arc(0, 0, Math.min(rim * 0.95, 0.165 * S), 0, Math.PI * 2);
  w.fill();
  const rk = rim / (0.229 * S);
  for (let i = 0; i < 5; i++) {
    for (const s of [-1, 1]) {
      w.save();
      w.rotate((i * 2 * Math.PI) / 5);
      const sg = w.createLinearGradient(0, -0.02 * S, 0, 0.02 * S);
      sg.addColorStop(0, '#f3f5f7');
      sg.addColorStop(0.5, '#bfc4ca');
      sg.addColorStop(1, '#727880');
      w.fillStyle = sg;
      w.beginPath();
      w.moveTo(0.05 * S * rk, s * 0.004 * S * rk);
      w.lineTo(rim * 0.97, s * 0.07 * S * rk);
      w.lineTo(rim * 0.97, s * 0.035 * S * rk);
      w.lineTo(0.05 * S * rk, s * 0.024 * S * rk);
      w.closePath();
      w.fill();
      w.restore();
    }
  }
  const hg = w.createRadialGradient(-0.01 * S, -0.01 * S, 0, 0, 0, 0.065 * S * rk);
  hg.addColorStop(0, '#f5f7f9');
  hg.addColorStop(1, '#8a9097');
  w.fillStyle = hg;
  w.beginPath();
  w.arc(0, 0, 0.065 * S * rk, 0, Math.PI * 2);
  w.fill();
  w.fillStyle = '#3a3f45';
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 + Math.PI / 5;
    w.beginPath();
    w.arc(Math.cos(a) * 0.042 * S * rk, Math.sin(a) * 0.042 * S * rk, Math.max(0.5, 0.008 * S * rk), 0, Math.PI * 2);
    w.fill();
  }
  w.fillStyle = '#2b2f34';
  w.beginPath();
  w.arc(0, 0, 0.024 * S * rk, 0, Math.PI * 2);
  w.fill();
  w.strokeStyle = '#dfe3e7';
  w.lineWidth = Math.max(1, 0.008 * S);
  w.beginPath();
  w.arc(0, 0, rim, 0, Math.PI * 2);
  w.stroke();
  w.restore();

  const [gloss] = newCanvas(frame.w, frame.h);
  const out: RasterFrames = { body: paint, gloss, under, lights, brake, wheel };
  return out;
};
