import type { CarConfig } from '../../../../data/schema';
import type { RasterBody, RasterFrames, RasterMeta } from './types';

/**
 * Painted (raster) side art of the Chevrolet Chevette SL 1988 (two-door three-box saloon).
 *
 * Measured on a side photograph of a real Chevette SL (rear on the LEFT, front on the RIGHT, 890 px
 * wide; the 868 px car is mapped to "photo metres" at the scale of its height). The photo has a
 * little perspective, so its proportions are NOT used directly: photo metres are mapped
 * piecewise onto the car's own overhangs and wheelbase (rear overhang / wheelbase / front
 * overhang) and the height onto `visual.heightM`, exactly like the Gol GTS and Uno art. The axles
 * therefore always sit on the physics geometry, whatever the photo's angle.
 *
 * Layers: a grayscale paint layer (light and shade only) tinted with the car colour; fixed details
 * (glass, rubber bumpers, mouldings, lamps, steel wheels) that never change colour; and a separate
 * `gloss` layer with the reflections (roof, bonnet, flank, boot lid and a streak on each window),
 * masked to the body and the glass so the light never spills outside the car.
 */

// ---- photo landmarks (px) ------------------------------------------------------------------
const PX_REAR = 5;
const PX_FRONT = 873;
const PX_RW = 226; // rear wheel centre
const PX_FW = 743; // front wheel centre
const PX_ROOF = 411;
const PX_GROUND = 698;
const PX_SILL = 645;
const K = 1.324 / (PX_GROUND - PX_ROOF); // photo metres per photo pixel (both axes)
// photo axle positions and overhangs (photo m)
const P_XR = (PX_RW - PX_REAR) * K;
const P_XF = (PX_FW - PX_REAR) * K;
const P_LEN = (PX_FRONT - PX_REAR) * K;
const P_ROOF = (PX_GROUND - PX_ROOF) * K;

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
  return { S, L, xR, xF, r, ra: r + 0.052, ky: v.heightM / P_ROOF, mx, X, Y };
}

/** Photo-metre position of a photo pixel (x from the rear bumper, y up from the ground). */
const pm = (px: number, py: number): [number, number] => [(px - PX_REAR) * K, (PX_GROUND - py) * K];

/** Pure metadata the raster art implies (lamps and exhaust), relative to the front-axle contact. */
export function chevetteSl88Meta(car: CarConfig): RasterMeta {
  const g = geometry(car, 1);
  const at = (px: number, py: number): { x: number; y: number } => {
    const [x, y] = pm(px, py);
    return { x: g.mx(x) - g.xF, y: y * g.ky };
  };
  return { headlight: at(860, 566), taillight: at(28, 546), exhausts: [at(40, 641)] };
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

type Pt = readonly [number, number];

export const paintChevetteSl88: RasterBody = (car, S, frame, wheelSize, newCanvas) => {
  const g = geometry(car, S);
  const { X, Y, mx, ky, r, ra, xR, xF } = g;
  const pt = (px: number, py: number): [number, number] => {
    const [x, y] = pm(px, py);
    return [X(mx(x)), Y(y * ky)];
  };
  const PXM = K * S; // one photo pixel, in sprite pixels (for stroke widths)
  const SILL = (PX_GROUND - PX_SILL) * K * ky;
  const ta = Math.asin(Math.max(-1, Math.min(1, (SILL - r) / ra)));
  const arch = (ctx: CanvasRenderingContext2D, cx: number, R: number, t0: number, t1: number): void => {
    for (let i = 0; i <= 40; i++) {
      const t = t0 + ((t1 - t0) * i) / 40;
      ctx.lineTo(X(cx + R * Math.cos(t)), Y(r + R * Math.sin(t)));
    }
  };
  const poly = (ctx: CanvasRenderingContext2D, pts: readonly Pt[]): void => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(...pt(x, y)) : ctx.moveTo(...pt(x, y))));
    ctx.closePath();
  };
  const fillPoly = (ctx: CanvasRenderingContext2D, pts: readonly Pt[], style: string | CanvasGradient): void => {
    poly(ctx, pts);
    ctx.fillStyle = style;
    ctx.fill();
  };
  const vgrad = (ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]): CanvasGradient => {
    const gr = ctx.createLinearGradient(0, pt(0, y0)[1], 0, pt(0, y1)[1]);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  };
  /** Polyline; `w` in photo pixels. */
  const line = (ctx: CanvasRenderingContext2D, pts: readonly Pt[], w: number, col: string): void => {
    ctx.save();
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(...pt(x, y)) : ctx.moveTo(...pt(x, y))));
    ctx.lineWidth = Math.max(0.6, w * PXM);
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  };

  // body outline: rear face, boot lid, C pillar, roof, A pillar, bonnet, nose; then the sill with the real arches
  const bodyPath = (ctx: CanvasRenderingContext2D): void => {
    ctx.beginPath();
    ctx.moveTo(...pt(30, 630));
    for (const [x, y] of [[25, 600], [24, 575], [26, 530], [31, 514]] as const) ctx.lineTo(...pt(x, y));
    ctx.bezierCurveTo(...pt(70, 509), ...pt(120, 499), ...pt(160, 489));
    ctx.bezierCurveTo(...pt(190, 468), ...pt(228, 440), ...pt(262, 421));
    ctx.bezierCurveTo(...pt(296, 411.5), ...pt(335, 410.5), ...pt(380, 410.5));
    ctx.bezierCurveTo(...pt(450, 411), ...pt(495, 413), ...pt(519, 428));
    ctx.lineTo(...pt(577, 478));
    ctx.lineTo(...pt(611, 500));
    ctx.bezierCurveTo(...pt(650, 504), ...pt(740, 516), ...pt(815, 536));
    ctx.bezierCurveTo(...pt(830, 541), ...pt(843, 548), ...pt(849, 560));
    for (const [x, y] of [[852, 588], [856, 622], [852, 640]] as const) ctx.lineTo(...pt(x, y));
    ctx.lineTo(X(xF + ra * Math.cos(ta)), Y(SILL));
    arch(ctx, xF, ra, ta, Math.PI - ta);
    ctx.lineTo(X(xR + ra * Math.cos(ta)), Y(SILL));
    arch(ctx, xR, ra, ta, Math.PI - ta);
    ctx.lineTo(...pt(34, 640));
    ctx.closePath();
  };

  // shared window shapes
  const DOOR: Pt[] = [[398, 431], [513, 431], [516, 505], [398, 505]];
  const VENT: Pt[] = [[521, 441], [572, 483], [572, 505], [521, 505]];
  const QUARTER: Pt[] = [[236, 501], [305, 430], [384, 431], [384, 501]];

  // ------------------------------------------------------------ paint (grayscale)
  const [paint, p] = newCanvas(frame.w, frame.h);
  bodyPath(p);
  p.fillStyle = vgrad(p, PX_ROOF - 4, PX_SILL, [[0, '#f0f0f0'], [0.14, '#e2e2e2'], [0.4, '#d0d0d0'], [0.72, '#a9a9a9'], [1, '#7b7b7b']]);
  p.fill();
  p.globalCompositeOperation = 'source-atop';
  // shading only: the white reflections live in the gloss layer
  line(p, [[26, 543], [160, 525], [300, 527], [440, 525], [600, 529], [760, 527], [852, 565]], 2, 'rgba(0,0,0,.13)');
  fillPoly(p, [[5, 632], [873, 632], [873, 660], [5, 660]], 'rgba(0,0,0,.12)');
  fillPoly(p, [[5, 560], [873, 560], [873, 640], [5, 640]], 'rgba(0,0,0,.05)');
  const gx = p.createLinearGradient(pt(PX_REAR, 0)[0], 0, pt(PX_FRONT, 0)[0], 0);
  gx.addColorStop(0, 'rgba(0,0,0,.25)');
  gx.addColorStop(0.06, 'rgba(0,0,0,0)');
  gx.addColorStop(0.94, 'rgba(0,0,0,0)');
  gx.addColorStop(1, 'rgba(0,0,0,.28)');
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
  // door cuts
  line(b, [[630, 508], [628, 560], [626, 610], [623, 651]], 0.9, 'rgba(8,9,11,.7)');
  line(b, [[390, 507], [390, 626], [392, 634], [398, 637], [623, 651]], 0.9, 'rgba(8,9,11,.6)');
  // A pillar and the windscreen edge
  fillPoly(b, [[519, 428], [577, 478], [611, 500], [594, 502], [570, 486], [514, 436]], '#0f1114');
  line(b, [[522, 432], [578, 476], [606, 497]], 0.55, 'rgba(255,255,255,.28)');
  // glass with a dark, deep interior
  const glass = vgrad(b, 430, 505, [[0, '#6f808b'], [0.45, '#2c3841'], [1, '#11181d']]);
  for (const win of [QUARTER, DOOR, VENT]) {
    fillPoly(b, win, glass);
    poly(b, win);
    b.lineWidth = Math.max(0.6, 1.8 * PXM);
    b.strokeStyle = '#0b0c0e';
    b.lineJoin = 'round';
    b.stroke();
    b.lineWidth = Math.max(0.5, 0.6 * PXM);
    b.strokeStyle = '#c9cdd2';
    b.stroke();
  }
  fillPoly(b, [[420, 432], [500, 432], [470, 504], [400, 504]], 'rgba(255,255,255,.08)');
  fillPoly(b, [[262, 432], [330, 432], [300, 500], [250, 500]], 'rgba(255,255,255,.06)');
  // seat back with head rest, steering wheel
  b.fillStyle = '#12171c';
  b.beginPath();
  b.moveTo(...pt(350, 501));
  b.lineTo(...pt(352, 474));
  b.quadraticCurveTo(...pt(353, 466), ...pt(362, 466));
  b.quadraticCurveTo(...pt(372, 466), ...pt(374, 474));
  b.lineTo(...pt(380, 501));
  b.closePath();
  b.fill();
  b.beginPath();
  b.ellipse(...pt(364, 458), 6.9 * PXM, 5.6 * PXM, 0, 0, Math.PI * 2);
  b.fill();
  b.beginPath();
  b.ellipse(...pt(424, 487), 13.4 * PXM, 6.5 * PXM, (-38 * Math.PI) / 180, 0, Math.PI * 2);
  b.strokeStyle = '#10151a';
  b.lineWidth = Math.max(0.6, 2 * PXM);
  b.stroke();
  fillPoly(b, [[513, 431], [521, 441], [521, 505], [516, 505]], '#0b0c0e');
  // rear glass edge and the louvres of the C pillar
  fillPoly(b, [[160, 490], [262, 421], [256, 432], [172, 491]], '#0b0d10');
  const LOUVRE: Pt[] = [[181, 493], [227, 451], [252, 452], [208, 492]];
  fillPoly(b, LOUVRE, '#17191d');
  poly(b, LOUVRE);
  b.lineWidth = Math.max(0.5, 0.9 * PXM);
  b.strokeStyle = '#0a0b0d';
  b.stroke();
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    const x0 = 181 + 27 * t + 3;
    const x1 = 227 + 25 * t + 1;
    line(b, [[x0, 491], [x1, 453]], 1.84, '#0a0b0d');
    line(b, [[x0 + 2.2, 491], [x1 + 2.2, 453]], 0.65, 'rgba(255,255,255,.1)');
  }
  // black side mouldings with a silver edge and the model lettering
  const mouldings: Pt[][] = [
    [[302, 584], [386, 586], [386, 598], [302, 596]],
    [[392, 588], [628, 590], [628, 603], [392, 601]],
    [[634, 592], [677, 593], [677, 605], [634, 604]],
  ];
  for (const m of mouldings) {
    fillPoly(b, m, '#17181b');
    line(b, [m[0]!, m[1]!], 0.6, 'rgba(230,234,238,.75)');
  }
  fillPoly(b, [[556, 591], [622, 592], [622, 601], [556, 600]], '#2a2c30');
  b.save();
  b.font = `700 ${(0.026 * S).toFixed(1)}px system-ui, sans-serif`;
  b.fillStyle = '#e3e6e9';
  b.textAlign = 'center';
  b.textBaseline = 'middle';
  const [lx, ly] = pt(589, 596.6);
  b.fillText('CHEVETTE SL', lx, ly);
  b.restore();
  // mirror, handle, lock
  fillPoly(b, [[561, 489], [585, 484], [593, 492], [591, 505], [578, 512], [563, 512]], '#121417');
  fillPoly(b, [[563, 490], [583, 486], [588, 491], [566, 494]], 'rgba(255,255,255,.18)');
  fillPoly(b, [[406, 521], [431, 521], [431, 525.5], [406, 525.5]], '#141518');
  b.fillStyle = '#2a2c30';
  b.beginPath();
  b.arc(...pt(444, 526), Math.max(0.6, 0.76 * PXM), 0, Math.PI * 2);
  b.fill();
  // bumpers: black with a thin chrome line
  fillPoly(b, [[5, 572], [168, 584], [172, 592], [160, 608], [10, 603], [5, 590]], '#141518');
  line(b, [[6, 571], [168, 583]], 0.76, 'rgba(225,229,233,.8)');
  line(b, [[8, 576], [166, 588]], 0.9, 'rgba(255,255,255,.12)');
  fillPoly(b, [[803, 590], [868, 585], [873, 592], [873, 614], [866, 619], [806, 618]], '#141518');
  line(b, [[806, 589], [868, 584.5]], 0.76, 'rgba(225,229,233,.8)');
  // career part: intercooler seen under the front bumper
  if (car.visual.mods?.intercooler) {
    fillPoly(b, [[816, 622], [852, 622], [852, 634], [816, 634]], '#8e979f');
    for (let i = 1; i < 5; i++) line(b, [[816, 622 + i * 2.4], [852, 622 + i * 2.4]], 0.5, 'rgba(30,34,38,.85)');
  }
  // lamps: tail (amber over red) and the front turn signal
  fillPoly(b, [[21, 528], [34, 528], [35, 546], [22, 546]], '#d97a1c');
  fillPoly(b, [[22, 546], [35, 546], [35, 564], [23, 564]], '#b8302a');
  fillPoly(b, [[22, 528], [26, 528], [27, 564], [23, 564]], 'rgba(255,255,255,.35)');
  fillPoly(b, [[849, 560], [857, 566], [857, 586], [851, 586]], '#e69a22');
  fillPoly(b, [[849, 560], [852, 563], [852, 580], [850, 582]], 'rgba(255,255,255,.45)');
  // outline
  b.save();
  bodyPath(b);
  b.lineWidth = Math.max(0.5, 0.6 * PXM);
  b.strokeStyle = 'rgba(0,0,0,.4)';
  b.stroke();
  b.restore();

  // ------------------------------------------------------------ gloss: reflections, masked to body and glass
  const [gloss, gl] = newCanvas(frame.w, frame.h);
  line(gl, [[26, 538], [160, 520], [300, 522], [440, 520], [600, 524], [760, 522], [852, 560]], 1.5, 'rgba(255,255,255,.5)');
  line(gl, [[612, 502], [700, 512], [790, 531], [840, 545]], 2, 'rgba(255,255,255,.5)');
  line(gl, [[40, 511], [100, 503], [150, 494]], 1.5, 'rgba(255,255,255,.45)');
  line(gl, [[260, 412], [330, 410.5], [440, 410.5], [500, 414]], 1.3, 'rgba(255,255,255,.6)');
  line(gl, [[170, 575], [300, 585]], 1, 'rgba(255,255,255,.12)');
  gl.globalCompositeOperation = 'destination-in';
  bodyPath(gl);
  gl.fillStyle = '#000';
  gl.fill();
  gl.globalCompositeOperation = 'source-over';
  // a soft streak on each pane, clipped to the glass
  for (const win of [QUARTER, DOOR, VENT]) {
    gl.save();
    poly(gl, win);
    gl.clip();
    const streak: Pt[] =
      win === QUARTER ? [[262, 432], [300, 432], [276, 500], [246, 500]] : win === DOOR ? [[420, 432], [455, 432], [425, 504], [400, 504]] : [[528, 444], [545, 458], [535, 505], [524, 505]];
    fillPoly(gl, streak, 'rgba(255,255,255,.10)');
    gl.restore();
  }

  // ------------------------------------------------------------ under: wheel wells, underbody, exhaust tip
  const [under, u] = newCanvas(frame.w, frame.h);
  u.fillStyle = '#0a0b0d';
  u.fillRect(X(xR), Y(SILL + 0.03), X(xF) - X(xR), 0.06 * S);
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
  const [ex, ey] = pt(44, 641);
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
  const [hx, hy] = pt(860, 566);
  const [tx, ty] = pt(28, 546);
  const lights = glow(hx, hy, 0.16 * S, 0.09 * S, 'rgba(255,200,120,.75)');
  lights.getContext('2d')!.drawImage(glow(tx, ty, 0.12 * S, 0.07 * S, 'rgba(255,90,30,.4)'), 0, 0);
  const brake = glow(tx, ty, 0.16 * S, 0.09 * S, 'rgba(255,30,20,.9)');

  // ------------------------------------------------------------ wheel: silver steel wheel with eight slots
  const [wheel, w] = newCanvas(wheelSize, wheelSize);
  const c0 = wheelSize / 2;
  const R = r * S;
  const rim = R * 0.7;
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
  w.lineWidth = Math.max(0.5, 0.03 * R);
  w.beginPath();
  w.arc(0, 0, R * 0.93, 0, Math.PI * 2);
  w.stroke();
  const steel = w.createLinearGradient(-rim, -rim, rim, rim);
  steel.addColorStop(0, '#e3e6e9');
  steel.addColorStop(0.5, '#aab0b7');
  steel.addColorStop(1, '#777d85');
  w.fillStyle = steel;
  w.beginPath();
  w.arc(0, 0, rim, 0, Math.PI * 2);
  w.fill();
  w.strokeStyle = '#e8ebee';
  w.lineWidth = Math.max(0.5, 0.035 * R);
  w.stroke();
  w.strokeStyle = '#6b7178';
  w.lineWidth = Math.max(0.4, 0.012 * R);
  w.beginPath();
  w.arc(0, 0, rim * 0.9, 0, Math.PI * 2);
  w.stroke();
  w.fillStyle = '#15171a';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    w.save();
    w.translate(Math.cos(a) * rim * 0.66, Math.sin(a) * rim * 0.66);
    w.rotate(a + Math.PI / 2);
    w.beginPath();
    w.roundRect(-rim * 0.075, -rim * 0.17, rim * 0.15, rim * 0.34, rim * 0.07);
    w.fill();
    w.restore();
  }
  const cap = w.createRadialGradient(-rim * 0.08, -rim * 0.1, 0, 0, 0, rim * 0.34);
  cap.addColorStop(0, '#e4e7ea');
  cap.addColorStop(1, '#8a9097');
  w.fillStyle = cap;
  w.strokeStyle = '#555b62';
  w.lineWidth = Math.max(0.4, 0.012 * R);
  w.beginPath();
  w.arc(0, 0, rim * 0.34, 0, Math.PI * 2);
  w.fill();
  w.stroke();
  w.fillStyle = '#4d535a';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    w.beginPath();
    w.arc(Math.cos(a) * rim * 0.2, Math.sin(a) * rim * 0.2, Math.max(0.5, rim * 0.04), 0, Math.PI * 2);
    w.fill();
  }
  w.fillStyle = '#e6e9ec';
  w.beginPath();
  w.arc(0, 0, rim * 0.075, 0, Math.PI * 2);
  w.fill();
  w.restore();

  const out: RasterFrames = { body: paint, gloss, under, lights, brake, wheel };
  return out;
};
