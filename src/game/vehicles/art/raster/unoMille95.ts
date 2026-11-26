import type { CarConfig } from '../../../../data/schema';
import type { RasterBody, RasterFrames, RasterMeta } from './types';

/**
 * Painted (raster) side art of the Fiat Uno Mille Electronic 1995 (two-door hatch).
 *
 * Drawn from side photographs of the real car. The artwork coordinates are the pixels of that
 * photo (front on the LEFT, ground at y = 273, 437 px for the 3.644 m body); they are converted to
 * "photo metres" (x from the rear bumper, y up from the ground) and then mapped piecewise onto the
 * car's own overhangs and wheelbase and scaled to its height, so the art always sits on the
 * physics geometry (axles, length, roof). Same construction as the Gol GTS art.
 *
 * Layers: a grayscale paint layer (light and shade only) tinted with the car colour at build time
 * and fixed details (glass, rubber bumpers, steel wheels, lamps) that never change colour.
 */

const K = 3.644 / 437; // metres per photo pixel
const PX_REAR = 481;
const PX_GROUND = 273;
// photo axle positions and overhangs (m)
const P_XR = (PX_REAR - 417) * K;
const P_XF = (PX_REAR - 128) * K;
const P_LEN = 3.644;
const P_ROOF = (PX_GROUND - 100) * K;

interface Geo {
  S: number;
  L: number;
  xR: number;
  xF: number;
  r: number;
  ra: number;
  ky: number;
  mx: (x: number) => number;
  X: (x: number) => number;
  Y: (y: number) => number;
}

function geometry(car: CarConfig, S: number): Geo {
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
  const X = (x: number): number => (x + 0.5) * S;
  const top = v.heightM + 0.42;
  const Y = (y: number): number => (top - y) * S;
  return { S, L, xR, xF, r, ra: r + 0.061, ky: v.heightM / P_ROOF, mx, X, Y };
}

/** Photo-metre position of a photo pixel. */
const pm = (px: number, py: number): [number, number] => [(PX_REAR - px) * K, (PX_GROUND - py) * K];

/** Pure metadata the raster art implies (lamps and exhaust), relative to the front-axle contact. */
export function unoMille95Meta(car: CarConfig): RasterMeta {
  const g = geometry(car, 1);
  const at = (px: number, py: number): { x: number; y: number } => {
    const [x, y] = pm(px, py);
    return { x: g.mx(x) - g.xF, y: y * g.ky };
  };
  return { headlight: at(50, 191), taillight: at(469, 183), exhausts: [at(458, 236)] };
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

export const paintUnoMille95: RasterBody = (car, S, frame, wheelSize, newCanvas) => {
  const g = geometry(car, S);
  const { X, Y, mx, ky, r, ra, xR, xF } = g;
  const pt = (px: number, py: number): [number, number] => {
    const [x, y] = pm(px, py);
    return [X(mx(x)), Y(y * ky)];
  };
  const SILL = (PX_GROUND - 240) * K * ky;
  const ta = Math.asin(Math.max(-1, Math.min(1, (SILL - r) / ra)));
  const arch = (ctx: CanvasRenderingContext2D, cx: number, R: number, t0: number, t1: number): void => {
    for (let i = 0; i <= 40; i++) {
      const t = t0 + ((t1 - t0) * i) / 40;
      ctx.lineTo(X(cx + R * Math.cos(t)), Y(r + R * Math.sin(t)));
    }
  };
  const poly = (ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]): void => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(...pt(x, y)) : ctx.moveTo(...pt(x, y))));
    ctx.closePath();
  };
  const fillPoly = (ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], style: string | CanvasGradient): void => {
    poly(ctx, pts);
    ctx.fillStyle = style;
    ctx.fill();
  };
  const vgrad = (ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]): CanvasGradient => {
    const gr = ctx.createLinearGradient(0, pt(0, y0)[1], 0, pt(0, y1)[1]);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  };
  const line = (ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], w: number, col: string, blur = 0): void => {
    ctx.save();
    if (blur) ctx.filter = `blur(${Math.max(0.5, (blur * S) / 420).toFixed(2)}px)`;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(...pt(x, y)) : ctx.moveTo(...pt(x, y))));
    ctx.lineWidth = w * K * S;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  };

  // body outline: over the roof from the nose to the tail, then the sill with the real arches
  const bodyPath = (ctx: CanvasRenderingContext2D): void => {
    ctx.beginPath();
    ctx.moveTo(...pt(47, 240));
    for (const [x, y] of [[45, 232], [44.5, 209], [46, 197], [50, 185], [57, 180.5]] as const) ctx.lineTo(...pt(x, y));
    ctx.bezierCurveTo(...pt(90, 172), ...pt(130, 162), ...pt(170, 153));
    ctx.lineTo(...pt(236, 100.5));
    ctx.bezierCurveTo(...pt(300, 96.5), ...pt(400, 96.5), ...pt(434, 102));
    ctx.quadraticCurveTo(...pt(438, 102.6), ...pt(441, 107));
    for (const [x, y] of [[469, 151], [471.5, 160], [473, 200], [481, 204], [482, 214], [480, 236], [474, 240]] as const) ctx.lineTo(...pt(x, y));
    ctx.lineTo(X(xR - ra * Math.cos(ta)), Y(SILL));
    arch(ctx, xR, ra, Math.PI - ta, ta);
    ctx.lineTo(X(xF - ra * Math.cos(ta)), Y(SILL));
    arch(ctx, xF, ra, Math.PI - ta, ta);
    ctx.closePath();
  };

  // ------------------------------------------------------------ paint (grayscale)
  const [paint, p] = newCanvas(frame.w, frame.h);
  bodyPath(p);
  p.fillStyle = vgrad(p, 96, 240, [[0, '#ececec'], [0.16, '#e0e0e0'], [0.42, '#d6d6d6'], [0.7, '#b0b0b0'], [1, '#808080']]);
  p.fill();
  p.globalCompositeOperation = 'source-atop';
  line(p, [[44, 166], [150, 160], [330, 158], [484, 162]], 1.6, 'rgba(255,255,255,.55)');
  line(p, [[44, 168.5], [150, 163], [330, 161], [484, 165]], 2, 'rgba(0,0,0,.16)');
  line(p, [[60, 181], [100, 171], [140, 163], [170, 156], [226, 111]], 2, 'rgba(255,255,255,.45)');
  line(p, [[250, 98], [320, 96.6], [380, 96.6], [430, 101.2]], 1.4, 'rgba(255,255,255,.7)');
  fillPoly(p, [[44, 222], [484, 222], [484, 242], [44, 242]], 'rgba(0,0,0,.18)');
  const gx = p.createLinearGradient(pt(44, 0)[0], 0, pt(482, 0)[0], 0);
  gx.addColorStop(0, 'rgba(0,0,0,.3)');
  gx.addColorStop(0.05, 'rgba(0,0,0,0)');
  gx.addColorStop(0.95, 'rgba(0,0,0,0)');
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
  const door: [number, number][] = [[212, 160], [240, 110], [247, 107], [344, 105], [346, 157]];
  const quarter: [number, number][] = [[353, 106], [430, 107], [434, 110], [453, 142], [451, 151], [353, 154]];
  // dark lower sill between the wheels and the A-pillar
  fillPoly(b, [[170, 153], [236, 100.5], [241, 105], [178, 156]], '#101215');
  fillPoly(b, [[176, 152], [238, 103], [240, 108], [212, 161]], vgrad(b, 103, 161, [[0, 'rgba(93,109,120,.92)'], [1, 'rgba(16,23,28,.92)']]));
  const glass = vgrad(b, 105, 160, [[0, '#5d6d78'], [0.5, '#27323a'], [1, '#10171c']]);
  for (const win of [door, quarter]) {
    fillPoly(b, win, glass);
    poly(b, win);
    b.lineWidth = 2.4 * K * S;
    b.strokeStyle = '#0b0c0e';
    b.lineJoin = 'round';
    b.stroke();
  }
  fillPoly(b, [[250, 110], [286, 109], [262, 156], [230, 157]], 'rgba(255,255,255,.09)');
  fillPoly(b, [[360, 110], [392, 110], [372, 152], [360, 152]], 'rgba(255,255,255,.07)');
  // shut lines
  line(b, [[190, 168], [188, 200], [187, 236]], 1.1, 'rgba(8,9,11,.75)');
  line(b, [[349, 104], [350, 234]], 1.1, 'rgba(8,9,11,.75)');
  // lower sill moulding
  b.save();
  bodyPath(b);
  b.clip();
  line(b, [[168, 235], [376, 235]], 3.4, '#2a2d31');
  line(b, [[168, 233.2], [376, 233.2]], 1, 'rgba(255,255,255,.4)');
  b.restore();
  // mirror, handle, fuel cap
  fillPoly(b, [[196, 152], [208, 149.5], [214, 153], [213, 160], [199, 160.5]], '#14161a');
  fillPoly(b, [[326, 167], [339, 167], [339, 171], [326, 171]], '#16181b');
  b.save();
  b.fillStyle = 'rgba(0,0,0,.35)';
  b.strokeStyle = 'rgba(0,0,0,.55)';
  b.lineWidth = Math.max(0.5, 1 * K * S);
  b.beginPath();
  b.arc(...pt(419, 178), 4.2 * K * S, 0, Math.PI * 2);
  b.fill();
  b.stroke();
  b.restore();
  // bumpers
  const bf: [number, number][] = [[45, 207], [90, 213], [90, 240], [47, 240], [45, 232]];
  const br: [number, number][] = [[456, 203], [482, 205], [482, 214], [480, 236], [474, 240], [458, 240]];
  fillPoly(b, bf, '#121316');
  fillPoly(b, br, '#121316');
  line(b, [[46, 208], [60, 209], [78, 211.4], [89, 214]], 1.2, 'rgba(255,255,255,.28)');
  line(b, [[457, 204.5], [481, 206.2]], 1.1, 'rgba(255,255,255,.26)');
  // career part: front-mounted intercooler seen through the bumper opening
  if (car.visual.mods?.intercooler) {
    fillPoly(b, [[47, 220], [76, 222], [76, 232], [47, 231]], '#8e979f');
    for (let i = 1; i < 5; i++) line(b, [[47, 220 + i * 2.2], [76, 222 + i * 2.2]], 0.5, 'rgba(30,34,38,.85)');
  }
  // lamps
  fillPoly(b, [[47, 185], [57.5, 182.6], [58.5, 197], [47, 199.5]], '#e8eef2');
  poly(b, [[47, 185], [57.5, 182.6], [58.5, 197], [47, 199.5]]);
  b.strokeStyle = '#7d8790';
  b.lineWidth = Math.max(0.5, 0.8 * K * S);
  b.stroke();
  fillPoly(b, [[47.6, 186], [57, 184], [57.4, 191], [47.6, 192.4]], 'rgba(255,255,255,.7)');
  fillPoly(b, [[45.5, 200.5], [55, 200], [56, 207], [45.5, 206]], '#f0a21a');
  const tl = b.createLinearGradient(pt(467, 0)[0], 0, pt(474, 0)[0], 0);
  tl.addColorStop(0, '#8f1419');
  tl.addColorStop(1, '#e0393f');
  fillPoly(b, [[467, 164], [473, 166], [474.2, 201], [466, 200]], tl);
  fillPoly(b, [[467.6, 165.8], [472, 167], [472.4, 174], [467.6, 173]], 'rgba(255,255,255,.35)');
  fillPoly(b, [[466, 189], [474, 190], [474.2, 198], [466, 197]], 'rgba(244,244,242,.85)');
  // outline
  b.save();
  bodyPath(b);
  b.lineWidth = Math.max(0.5, 1 * K * S);
  b.strokeStyle = 'rgba(0,0,0,.42)';
  b.stroke();
  b.restore();

  // ------------------------------------------------------------ under: wheel wells, underbody, exhaust tip
  const [under, u] = newCanvas(frame.w, frame.h);
  fillPoly(u, [[86, 233], [375, 233], [375, 243], [86, 243]], '#0a0b0d');
  for (const cx of [xF, xR]) {
    const wg = u.createRadialGradient(X(cx), Y(r), 0, X(cx), Y(r), ra * S);
    wg.addColorStop(0, '#010101');
    wg.addColorStop(0.8, '#07080a');
    wg.addColorStop(1, '#101215');
    u.fillStyle = wg;
    u.beginPath();
    u.arc(X(cx), Y(r), (ra - 0.004) * S, 0, Math.PI * 2);
    u.fill();
  }
  const sport = !!car.visual.mods?.sportTip;
  const [ex, ey] = pt(462, 238);
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
  const [hx, hy] = pt(52, 191);
  const [tx, ty] = pt(469, 183);
  const lights = glow(hx, hy, 0.16 * S, 0.09 * S, 'rgba(255,200,120,.75)');
  lights.getContext('2d')!.drawImage(glow(tx, ty, 0.12 * S, 0.07 * S, 'rgba(255,40,30,.45)'), 0, 0);
  const brake = glow(tx, ty, 0.16 * S, 0.09 * S, 'rgba(255,30,20,.9)');

  // ------------------------------------------------------------ wheel: 13" steel wheel with the round hole ring
  const [wheel, w] = newCanvas(wheelSize, wheelSize);
  const c0 = wheelSize / 2;
  const R = r * S;
  const rim = r * 0.73 * S;
  const tyreG = w.createRadialGradient(c0, c0, rim, c0, c0, R);
  tyreG.addColorStop(0, '#1d1d1f');
  tyreG.addColorStop(0.4, '#26272a');
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
  w.strokeStyle = '#24272b';
  w.lineWidth = Math.max(0.5, 0.012 * R);
  w.beginPath();
  w.arc(0, 0, R * 0.925, 0, Math.PI * 2);
  w.stroke();
  const steel = w.createLinearGradient(-rim, -rim, rim, rim);
  steel.addColorStop(0, '#d4d8dc');
  steel.addColorStop(0.5, '#9aa0a7');
  steel.addColorStop(1, '#6d737a');
  w.fillStyle = steel;
  w.beginPath();
  w.arc(0, 0, rim, 0, Math.PI * 2);
  w.fill();
  w.strokeStyle = '#5d636a';
  w.lineWidth = Math.max(0.5, 0.03 * rim);
  w.stroke();
  w.strokeStyle = 'rgba(255,255,255,.35)';
  w.beginPath();
  w.arc(0, 0, rim * 0.81, 0, Math.PI * 2);
  w.stroke();
  w.fillStyle = '#15171a';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.35;
    w.beginPath();
    w.ellipse(Math.cos(a) * rim * 0.65, Math.sin(a) * rim * 0.65, rim * 0.112, rim * 0.146, a + Math.PI / 2, 0, Math.PI * 2);
    w.fill();
  }
  const cap = w.createRadialGradient(-rim * 0.08, -rim * 0.1, 0, 0, 0, rim * 0.33);
  cap.addColorStop(0, '#dfe3e6');
  cap.addColorStop(1, '#7c828a');
  w.fillStyle = cap;
  w.beginPath();
  w.arc(0, 0, rim * 0.33, 0, Math.PI * 2);
  w.fill();
  w.fillStyle = '#4a4f55';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    w.beginPath();
    w.arc(Math.cos(a) * rim * 0.19, Math.sin(a) * rim * 0.19, Math.max(0.5, rim * 0.048), 0, Math.PI * 2);
    w.fill();
  }
  w.restore();

  const [gloss] = newCanvas(frame.w, frame.h);
  const out: RasterFrames = { body: paint, gloss, under, lights, brake, wheel };
  return out;
};
