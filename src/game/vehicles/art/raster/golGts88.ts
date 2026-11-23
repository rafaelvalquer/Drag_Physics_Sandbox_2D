import type { CarConfig } from '../../../../data/schema';
import type { RasterBody, RasterFrames, RasterMeta } from './types';

/**
 * Painted (raster) side art of the square Gol GTS 1988.
 *
 * The geometry was measured on a side photograph of a real Gol GTS and is kept in "photo metres"
 * (x from the rear bumper, y up from the ground). It is mapped piecewise onto the car's own
 * overhangs and wheelbase, and scaled to its height, so the art always sits on the physics
 * geometry (axles, length, roof) even if the editor changes the dimensions.
 *
 * Layers: a grayscale paint layer (light and shade only) tinted with the car colour at build
 * time, plus fixed details (glass, rubber, the silver GTS lower body, lamps) that never change
 * colour.
 */

// photo axle positions and overhangs (m)
const P_XR = 0.653;
const P_XF = 3.084;
const P_LEN = 3.858;
const P_ROOF = 1.37;

type Cmd = ['M' | 'L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

interface Geo {
  S: number;
  L: number;
  xR: number;
  xF: number;
  r: number;
  ra: number;
  ky: number;
  /** Photo x → game x (m from the rear bumper). */
  mx: (x: number) => number;
  /** Game metres → frame pixels. */
  X: (x: number) => number;
  Y: (y: number) => number;
}

function geometry(car: CarConfig, S: number, frameH: number): Geo {
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
  const X = (x: number): number => (x + 0.5) * S;
  const top = v.heightM + 0.42;
  const Y = (y: number): number => (top - y) * S;
  void frameH;
  return { S, L, xR, xF, r, ra: r + 0.061, ky: v.heightM / P_ROOF, mx, X, Y };
}

/** Pure metadata the raster art implies (lamps and exhaust), relative to the front-axle contact. */
export function golGts88Meta(car: CarConfig): RasterMeta {
  const g = geometry(car, 1, 0);
  const at = (x: number, y: number): { x: number; y: number } => ({ x: g.mx(x) - g.xF, y: y * g.ky });
  return {
    headlight: at(3.845, 0.68),
    taillight: at(0.06, 0.7),
    exhausts: [at(0.19, 0.272)],
  };
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

export const paintGolGts88: RasterBody = (car, S, frame, wheelSize, newCanvas) => {
  const g = geometry(car, S, frame.h);
  const { X, Y, mx, ky, r, ra, xR, xF } = g;
  const SILL = 0.262 * ky;
  const pt = (x: number, y: number): [number, number] => [X(mx(x)), Y(y * ky)];

  function trace(ctx: CanvasRenderingContext2D, cmds: readonly Cmd[]): void {
    ctx.beginPath();
    for (const c of cmds) {
      if (c[0] === 'M') ctx.moveTo(...pt(c[1], c[2]));
      else if (c[0] === 'L') ctx.lineTo(...pt(c[1], c[2]));
      else if (c[0] === 'C') ctx.bezierCurveTo(...pt(c[1], c[2]), ...pt(c[3], c[4]), ...pt(c[5], c[6]));
      else ctx.closePath();
    }
  }
  // arches are drawn in game metres around the real axles
  const arch = (ctx: CanvasRenderingContext2D, cx: number, R: number, t0: number, t1: number): void => {
    for (let i = 0; i <= 40; i++) {
      const t = t0 + ((t1 - t0) * i) / 40;
      ctx.lineTo(X(cx + R * Math.cos(t)), Y(r + R * Math.sin(t)));
    }
  };
  const ta = Math.asin(Math.max(-1, Math.min(1, (SILL - r) / ra)));
  const bodyPath = (ctx: CanvasRenderingContext2D): void => {
    trace(ctx, [
      ['M', 0.033, 0.37], ['C', 0.005, 0.45, 0.0, 0.52, 0.0, 0.593], ['C', 0.0, 0.72, 0.008, 0.84, 0.02, 0.918],
      ['C', 0.03, 0.99, 0.06, 1.02, 0.1, 1.04], ['C', 0.3, 1.13, 0.55, 1.28, 0.72, 1.345], ['C', 0.78, 1.365, 0.85, 1.368, 0.95, 1.368],
      ['L', 2.05, 1.37], ['C', 2.12, 1.37, 2.16, 1.36, 2.2, 1.33], ['L', 2.66, 0.96], ['C', 2.7, 0.945, 2.73, 0.94, 2.76, 0.939],
      ['C', 3.1, 0.89, 3.45, 0.82, 3.7, 0.775], ['C', 3.78, 0.76, 3.82, 0.74, 3.835, 0.71], ['L', 3.848, 0.65],
      ['L', 3.858, 0.51], ['C', 3.855, 0.42, 3.84, 0.34, 3.81, 0.3], ['C', 3.78, 0.27, 3.72, 0.258, 3.64, 0.258],
    ]);
    ctx.lineTo(X(xF + ra * Math.cos(ta)), Y(SILL));
    arch(ctx, xF, ra, ta, Math.PI - ta);
    ctx.lineTo(X(xR + ra * Math.cos(ta)), Y(SILL));
    arch(ctx, xR, ra, ta, Math.PI - ta);
    ctx.lineTo(...pt(0.2, 0.3));
    ctx.bezierCurveTo(...pt(0.1, 0.32), ...pt(0.05, 0.34), ...pt(0.033, 0.37));
    ctx.closePath();
  };
  const DLO: Cmd[] = [
    ['M', 0.45, 1.035], ['C', 0.5, 1.07, 0.62, 1.2, 0.76, 1.3], ['C', 0.8, 1.32, 0.85, 1.325, 0.92, 1.325], ['L', 2.06, 1.328],
    ['C', 2.1, 1.328, 2.13, 1.32, 2.16, 1.3], ['L', 2.6, 0.955], ['L', 0.49, 1.03], ['C', 0.47, 1.03, 0.455, 1.032, 0.45, 1.035], ['Z'],
  ];
  const belt = (x: number): number => 1.032 - ((x - 0.45) / (2.6 - 0.45)) * (1.032 - 0.955);
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
  p.fillStyle = grad(p, 1.37, 0.26, [[0, '#f2f2f2'], [0.33, '#d6d6d6'], [0.36, '#f6f6f6'], [0.39, '#a0a0a0'], [0.5, '#c8c8c8'], [0.53, '#909090'], [0.75, '#7a7a7a'], [1, '#585858']]);
  p.fill();
  p.globalCompositeOperation = 'source-atop';
  stroke(p, [['M', 0.95, 1.36], ['L', 2.05, 1.362]], 0.018, 'rgba(255,255,255,.95)', 4);
  stroke(p, [['M', 2.8, 0.93], ['C', 3.1, 0.885, 3.45, 0.82, 3.68, 0.78]], 0.025, 'rgba(255,255,255,.85)', 6);
  stroke(p, [['M', 0.1, 1.0], ['L', 3.75, 0.775]], 0.008, 'rgba(255,255,255,.95)', 1);
  stroke(p, [['M', 0.02, 0.83], ['L', 3.84, 0.74]], 0.007, 'rgba(255,255,255,.75)', 1);
  stroke(p, [['M', 0.02, 0.815], ['L', 3.84, 0.725]], 0.02, 'rgba(0,0,0,.28)', 4);
  fill(p, [['M', 0.0, 0.94], ['C', 0.06, 1.02, 0.3, 1.13, 0.72, 1.345], ['L', 0.76, 1.3], ['C', 0.62, 1.2, 0.5, 1.07, 0.45, 1.035], ['L', 0.0, 0.92], ['Z']], 'rgba(255,255,255,.12)');
  const gx = p.createLinearGradient(X(0), 0, X(g.L), 0);
  gx.addColorStop(0, 'rgba(0,0,0,.35)');
  gx.addColorStop(0.04, 'rgba(0,0,0,0)');
  gx.addColorStop(0.96, 'rgba(0,0,0,0)');
  gx.addColorStop(1, 'rgba(0,0,0,.3)');
  p.fillStyle = gx;
  p.fillRect(0, 0, frame.w, frame.h);

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
  b.globalCompositeOperation = 'source-over';
  fill(b, DLO, grad(b, 1.33, 0.95, [[0, '#2c3a3c'], [0.5, '#16201f'], [1, '#0b0f0f']]));
  b.save();
  trace(b, DLO);
  b.clip();
  b.fillStyle = 'rgba(48,56,58,.9)';
  b.beginPath();
  b.ellipse(...pt(1.9, 1.11), 0.06 * S, 0.09 * S, -0.15, 0, Math.PI * 2);
  b.fill();
  b.globalAlpha = 0.2;
  b.fillStyle = '#d8ecf0';
  for (const [a, w] of [[1.6, 0.22], [1.95, 0.05], [0.95, 0.16]] as const) {
    b.beginPath();
    b.moveTo(...pt(a, 1.33));
    b.lineTo(...pt(a + w, 1.33));
    b.lineTo(...pt(a + w - 0.25, 0.95));
    b.lineTo(...pt(a - 0.25, 0.95));
    b.fill();
  }
  b.restore();
  stroke(b, DLO, 0.014, '#0a0b0c');
  fill(b, [['M', 1.37, belt(1.37)], ['L', 1.48, belt(1.48)], ['L', 1.48, 1.328], ['L', 1.37, 1.326], ['Z']], '#0a0b0c');
  fill(b, [['M', 2.3, belt(2.3)], ['L', 2.33, belt(2.33)], ['L', 2.36, 1.17], ['L', 2.33, 1.17], ['Z']], '#0a0b0c');
  fill(b, [['M', 2.4, 0.95], ['L', 2.52, 0.945], ['C', 2.53, 0.99, 2.52, 1.03, 2.49, 1.045], ['L', 2.41, 1.04], ['Z']], grad(b, 1.05, 0.94, [[0, '#2c2e32'], [1, '#08090a']]));
  const gap = (cmds: Cmd[]): void => stroke(b, cmds, 0.006, 'rgba(10,10,12,.9)');
  gap([['M', 2.66, 0.958], ['L', 2.66, 0.56]]);
  gap([['M', 1.42, belt(1.42)], ['L', 1.42, 0.56]]);
  gap([['M', 2.78, 0.925], ['C', 3.1, 0.875, 3.45, 0.81, 3.7, 0.765]]);
  gap([['M', 0.08, 1.02], ['C', 0.3, 1.11, 0.5, 1.24, 0.7, 1.33]]);
  fill(b, [['M', 1.53, 0.86], ['L', 1.72, 0.86], ['L', 1.71, 0.885], ['L', 1.54, 0.885], ['Z']], grad(b, 0.885, 0.86, [[0, '#f0f2f4'], [1, '#6c7178']]));
  fill(b, [['M', 1.58, 0.845], ['L', 1.66, 0.845], ['L', 1.66, 0.86], ['L', 1.58, 0.86], ['Z']], '#101113');
  b.fillStyle = grad(b, 0.8, 0.7, [[0, '#2a2c30'], [1, '#050506']]);
  b.beginPath();
  b.arc(...pt(0.31, 0.752), 0.05 * S, 0, Math.PI * 2);
  b.fill();
  fill(b, [['M', 0.0, 0.655], ['L', 0.135, 0.66], ['L', 0.135, 0.735], ['L', 0.003, 0.74], ['Z']], grad(b, 0.74, 0.655, [[0, '#ff4a40'], [0.5, '#9e0e14'], [1, '#3a0406']]));
  fill(b, [['M', 3.7, 0.6], ['L', 3.85, 0.6], ['L', 3.848, 0.705], ['L', 3.71, 0.71], ['Z']], grad(b, 0.71, 0.6, [[0, '#ffc15a'], [1, '#c96b10']]));
  fill(b, [['M', 3.835, 0.71], ['L', 3.85, 0.705], ['L', 3.856, 0.6], ['L', 3.85, 0.6], ['Z']], '#e9eef3');
  // the silver GTS lower body, its red pinstripe and dark rubbing strip
  b.save();
  bodyPath(b);
  b.clip();
  fill(b, [['M', -0.05, 0.56], ['L', 3.9, 0.56], ['L', 3.9, 0.2], ['L', -0.05, 0.2], ['Z']], grad(b, 0.56, 0.26, [[0, '#d6d6d0'], [0.25, '#bdbcb5'], [0.8, '#9c9b94'], [1, '#6f6e69']]));
  stroke(b, [['M', -0.05, 0.556], ['L', 3.9, 0.556]], 0.012, '#2a2b2e');
  stroke(b, [['M', -0.05, 0.537], ['L', 3.9, 0.537]], 0.006, '#b51c22');
  for (const sx of [0.35, 3.33]) stroke(b, [['M', sx, 0.53], ['L', sx, 0.27]], 0.005, 'rgba(0,0,0,.5)');
  stroke(b, [['M', -0.05, 0.4], ['L', 0.31, 0.4]], 0.004, 'rgba(0,0,0,.35)');
  stroke(b, [['M', 3.38, 0.4], ['L', 3.9, 0.4]], 0.004, 'rgba(0,0,0,.35)');
  // career part: front-mounted intercooler seen through the bumper opening
  if (car.visual.mods?.intercooler) {
    fill(b, [['M', 3.5, 0.3], ['L', 3.86, 0.3], ['L', 3.86, 0.385], ['L', 3.5, 0.385], ['Z']], '#8e979f');
    for (let i = 1; i < 6; i++) stroke(b, [['M', 3.5, 0.3 + i * 0.014], ['L', 3.86, 0.3 + i * 0.014]], 0.004, 'rgba(30,34,38,.85)');
  }
  b.restore();
  fill(b, [['M', 0.055, 1.155], ['L', 0.34, 1.165], ['L', 0.36, 1.135], ['L', 0.14, 1.07], ['L', 0.07, 1.08], ['Z']], grad(b, 1.17, 1.07, [[0, '#2e3034'], [1, '#08090a']]));
  stroke(b, [['M', 0.93, 1.368], ['L', 0.74, 1.6]], 0.006, '#0b0c0e');
  b.save();
  b.font = `italic 700 ${(0.04 * S).toFixed(1)}px system-ui, sans-serif`;
  b.fillStyle = '#c9ccd1';
  b.fillText('GTS', ...pt(1.2, 0.985));
  b.restore();
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
  const [ex, ey] = pt(0.25, 0.272);
  const tw = (sport ? 0.065 : 0.05) * S;
  const th = (sport ? 0.03 : 0.02) * S;
  const tg = u.createLinearGradient(0, ey - th, 0, ey + th);
  tg.addColorStop(0, '#f2f4f6');
  tg.addColorStop(0.45, '#8b9299');
  tg.addColorStop(1, '#4a4f55');
  u.fillStyle = tg;
  u.fillRect(ex - tw * 1.6, ey - th, tw * 1.8, th * 2);
  u.fillStyle = '#050505';
  u.beginPath();
  u.ellipse(ex - tw * 1.6, ey, th * 0.45, th * 0.85, 0, 0, Math.PI * 2);
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
  const [hx, hy] = pt(3.8, 0.66);
  const [tx, ty] = pt(0.07, 0.7);
  const lights = glow(hx, hy, 0.16 * S, 0.09 * S, 'rgba(255,200,120,.75)');
  lights.getContext('2d')!.drawImage(glow(tx, ty, 0.12 * S, 0.07 * S, 'rgba(255,40,30,.45)'), 0, 0);
  const brake = glow(tx, ty, 0.16 * S, 0.09 * S, 'rgba(255,30,20,.9)');

  // ------------------------------------------------------------ wheel: BBS-style cross lace
  const [wheel, w] = newCanvas(wheelSize, wheelSize);
  const c0 = wheelSize / 2;
  const R = r * S;
  const rim = r * 0.73 * S;
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
  w.fillStyle = '#1a1c1f';
  w.beginPath();
  w.arc(0, 0, rim, 0, Math.PI * 2);
  w.fill();
  w.lineCap = 'round';
  for (const dir of [1, -1]) {
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      w.beginPath();
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const rr = rim * (0.24 + t * 0.7);
        const aa = a + dir * t * 0.75;
        if (k === 0) w.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
        else w.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      }
      w.strokeStyle = '#c9cdd2';
      w.lineWidth = Math.max(1, 0.009 * S);
      w.stroke();
      w.strokeStyle = 'rgba(255,255,255,.55)';
      w.lineWidth = Math.max(0.5, 0.003 * S);
      w.stroke();
    }
  }
  w.strokeStyle = '#eef0f2';
  w.lineWidth = 0.022 * S;
  w.beginPath();
  w.arc(0, 0, rim - 0.011 * S, 0, Math.PI * 2);
  w.stroke();
  w.fillStyle = '#7a8087';
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    w.beginPath();
    w.arc(Math.cos(a) * (rim - 0.03 * S), Math.sin(a) * (rim - 0.03 * S), Math.max(0.5, 0.003 * S), 0, Math.PI * 2);
    w.fill();
  }
  const hg = w.createRadialGradient(-0.01 * S, -0.01 * S, 0, 0, 0, 0.055 * S);
  hg.addColorStop(0, '#f6f7f9');
  hg.addColorStop(1, '#8a9097');
  w.fillStyle = hg;
  w.beginPath();
  w.arc(0, 0, 0.055 * S, 0, Math.PI * 2);
  w.fill();
  w.strokeStyle = '#3a3f45';
  w.lineWidth = Math.max(0.5, 0.004 * S);
  w.beginPath();
  w.arc(0, 0, 0.03 * S, 0, Math.PI * 2);
  w.stroke();
  w.restore();

  const [gloss] = newCanvas(frame.w, frame.h);
  const out: RasterFrames = { body: paint, gloss, under, lights, brake, wheel };
  return out;
};
