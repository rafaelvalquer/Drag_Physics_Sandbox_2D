import { Prng } from '../../core/prng';
import { mix, shade } from '../vehicles/art/svg';
import { building, periodic, ridge, wrapped, type Ctx } from './environmentArt';
import { litFar, type LightingState } from './LightingController';
import { canvas, type Theme } from './trackArt';
import { LAYER_H, LAYER_W } from './environmentArt';
import { chapter2Layer } from './environmentChapter2';

/**
 * Parallax scenery of the campaign's three night street venues. Same contract as the other
 * themes (see buildLayer): layer 0 far, 1 middle, 2 near; the bottom edge is the layer's foot;
 * the texture tiles horizontally without a seam. Original procedural artwork: no photos, no
 * brands; graffiti is abstract lettering made of strokes, signs are blank or carry made-up words.
 *
 * - Distrito Industrial: sodium-lit warehouses, loading docks, parked cars, tagged brick walls.
 * - Baixada: residential towers on the hills, an elevated viaduct with traffic, concrete piers
 *   with graffiti, cold LED light.
 * - Avenida Norte: a closed avenue with light towers, shuttered shops and a crowd behind barriers.
 */
export const CAMPAIGN_LAYER_THEMES: ReadonlySet<Theme> = new Set<Theme>(['distritoIndustrial', 'baixada', 'avenidaNorte', 'patioDasTorres', 'distritoFinanceiro', 'corredorDaLiga']);

export interface Painter {
  ctx: Ctx;
  W: number;
  H: number;
  rng: Prng;
  l: LightingState;
  /** Colour seen through the haze of this layer. */
  C: (color: string, extra?: number) => string;
  px: (v: number) => number;
  layer: 0 | 1 | 2;
}

export function buildCampaignLayer(theme: Theme, layer: 0 | 1 | 2, l: LightingState, scale: number): HTMLCanvasElement {
  const W = Math.round(LAYER_W * scale);
  const H = Math.round(LAYER_H[layer] * scale);
  const [c, ctx] = canvas(W, H);
  const dist = [0.95, 0.6, 0.22][layer]!;
  const p: Painter = {
    ctx,
    W,
    H,
    rng: new Prng(911 + layer * 131 + theme.length * 17),
    l,
    C: (color, extra = 0) => litFar(color, l, Math.min(1, dist + extra)),
    px: (v) => v * scale,
    layer,
  };
  if (theme === 'distritoIndustrial') distrito(p);
  else if (theme === 'baixada') baixada(p);
  else if (theme === 'avenidaNorte') avenida(p);
  else chapter2Layer(theme, p);
  return c;
}

// ------------------------------------------------------------------------------- shared pieces

/** Radial light glow (additive look on a dark scene). */
export function glow(ctx: Ctx, x: number, y: number, r: number, rgb: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Light cone from a lamp head down to the ground. */
export function cone(ctx: Ctx, x: number, y: number, w: number, h: number, rgb: string, a: number): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.08, y);
  ctx.lineTo(x + w * 0.08, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x - w / 2, y + h);
  ctx.closePath();
  ctx.fill();
}

/** Street lamp: pole, arm and head, with its glow and cone. */
export function streetLamp(p: Painter, x: number, foot: number, h: number, rgb: string, armLeft = false): void {
  const { ctx, px, C } = p;
  ctx.fillStyle = C('#4b5058');
  ctx.fillRect(x, foot - h, px(4), h);
  const dir = armLeft ? -1 : 1;
  ctx.fillRect(Math.min(x, x + dir * px(30)), foot - h, px(30), px(3));
  const hx = x + dir * px(28);
  ctx.fillStyle = `rgb(${rgb})`;
  ctx.fillRect(hx - px(6), foot - h + px(2), px(12), px(4));
  cone(ctx, hx, foot - h + px(6), px(110), h - px(6), rgb, 0.12);
  glow(ctx, hx, foot - h + px(4), px(38), rgb, 0.55);
}

/** Generic parked car silhouette (no make): body, glasshouse, wheels; optional lights. */
export function parkedCar(p: Painter, x: number, foot: number, color: string, facingRight: boolean, lights: 'none' | 'tail' | 'hazard'): void {
  const { ctx, px, C, rng } = p;
  const w = px(92 + rng.next() * 16);
  const hgt = px(22);
  const body = C(color);
  const g = ctx.createLinearGradient(0, foot - hgt - px(14), 0, foot);
  g.addColorStop(0, shade(body, 0.12));
  g.addColorStop(1, shade(body, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, foot - hgt - px(4), w, hgt, px(6));
  ctx.fill();
  // greenhouse
  const r0 = facingRight ? x + w * 0.18 : x + w * 0.3;
  ctx.beginPath();
  ctx.moveTo(r0, foot - hgt - px(3));
  ctx.lineTo(r0 + w * 0.1, foot - hgt - px(18));
  ctx.lineTo(r0 + w * 0.42, foot - hgt - px(18));
  ctx.lineTo(r0 + w * 0.52, foot - hgt - px(3));
  ctx.fill();
  ctx.fillStyle = mix(C('#1b2533'), '#6f87a3', 0.25);
  ctx.beginPath();
  ctx.moveTo(r0 + w * 0.03, foot - hgt - px(4));
  ctx.lineTo(r0 + w * 0.11, foot - hgt - px(15));
  ctx.lineTo(r0 + w * 0.41, foot - hgt - px(15));
  ctx.lineTo(r0 + w * 0.48, foot - hgt - px(4));
  ctx.fill();
  ctx.fillStyle = '#0d0e10';
  for (const wx of [x + w * 0.2, x + w * 0.8]) {
    ctx.beginPath();
    ctx.arc(wx, foot - px(5), px(8), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = C('#8a8f96');
  for (const wx of [x + w * 0.2, x + w * 0.8]) {
    ctx.beginPath();
    ctx.arc(wx, foot - px(5), px(3.5), 0, Math.PI * 2);
    ctx.fill();
  }
  if (lights !== 'none') {
    const tail = facingRight ? x + px(2) : x + w - px(6);
    const rgb = lights === 'hazard' ? '255,170,40' : '255,40,30';
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.fillRect(tail, foot - hgt + px(2), px(4), px(5));
    glow(ctx, tail + px(2), foot - hgt + px(4), px(16), rgb, 0.6);
  }
}

/** Abstract graffiti piece: outlined stroke letters (invented shapes), drips and a fill. */
export function graffiti(p: Painter, x: number, y: number, w: number, h: number, palette: string[]): void {
  const { ctx, rng, px } = p;
  const n = 3 + Math.floor(rng.next() * 3);
  const lw = w / n;
  const fill = palette[Math.floor(rng.next() * palette.length)]!;
  const out = palette[Math.floor(rng.next() * palette.length)]!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const lx = x + i * lw;
    const pts: [number, number][] = [];
    const k = 3 + Math.floor(rng.next() * 3);
    for (let j = 0; j < k; j++) pts.push([lx + rng.next() * lw * 0.9, y + rng.next() * h]);
    for (const [col, width] of [
      ['#0b0b0d', px(9)],
      [out, px(7)],
      [fill, px(4)],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = width;
      ctx.beginPath();
      pts.forEach(([a, b], j) => (j ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.stroke();
    }
    if (rng.next() < 0.5) {
      ctx.fillStyle = fill;
      ctx.fillRect(pts[0]![0], pts[0]![1], px(1.6), px(6 + rng.next() * 10));
    }
  }
  // highlight dots
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + rng.next() * w, y + rng.next() * h, px(2), px(2));
}

/** Corrugated metal wall: vertical ribs over a gradient. */
function corrugated(ctx: Ctx, x: number, top: number, w: number, h: number, color: string, rib: number): void {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(color, 0.1));
  g.addColorStop(1, shade(color, -0.2));
  ctx.fillStyle = g;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let k = 0; k < w; k += rib) ctx.fillRect(x + k, top, rib * 0.35, h);
}

/** Person silhouette (head, shoulders, torso) for crowds; optional phone screen. */
export function person(ctx: Ctx, x: number, foot: number, s: number, cloth: string, skin: string, phone: boolean): void {
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.roundRect(x - 7 * s, foot - 30 * s, 14 * s, 30 * s, [5 * s, 5 * s, 0, 0]);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, foot - 35 * s, 4.6 * s, 0, Math.PI * 2);
  ctx.fill();
  if (phone) {
    ctx.fillStyle = '#cfe6ff';
    ctx.fillRect(x + 3 * s, foot - 40 * s, 3 * s, 5 * s);
    const g = ctx.createRadialGradient(x + 4.5 * s, foot - 37.5 * s, 0, x + 4.5 * s, foot - 37.5 * s, 10 * s);
    g.addColorStop(0, 'rgba(190,220,255,0.45)');
    g.addColorStop(1, 'rgba(190,220,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 6 * s, foot - 48 * s, 21 * s, 21 * s);
  }
}

// ------------------------------------------------------------------------------- Distrito Industrial

function distrito(p: Painter): void {
  const { ctx, W, H, rng, l, C, px, layer } = p;
  const sodium = '255,190,95';
  if (layer === 0) {
    // sodium sky glow, low industrial skyline, a water tower and a chimney with an aviation light
    const sky = ctx.createLinearGradient(0, H * 0.4, 0, H);
    sky.addColorStop(0, 'rgba(120,80,40,0)');
    sky.addColorStop(1, 'rgba(150,100,50,0.28)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    let x = 0;
    while (x < W) {
      const w = px(60 + rng.next() * 110);
      const h = px(40 + rng.next() * 90);
      building(ctx, rng, x, H, w, h, C(['#3a352f', '#423b33', '#34302c'][Math.floor(rng.next() * 3)]!, 0.02), l, 0.12);
      x += w + px(rng.next() * 30);
    }
    for (const fx of [0.18, 0.66]) {
      const cx = W * fx;
      ctx.fillStyle = C('#4a4038', 0.02);
      ctx.fillRect(cx, H - px(230), px(14), px(230));
      ctx.fillStyle = '#ff4a35';
      ctx.fillRect(cx + px(3), H - px(236), px(8), px(6));
      glow(ctx, cx + px(7), H - px(233), px(16), '255,70,50', 0.6);
    }
    const tx = W * 0.42;
    ctx.fillStyle = C('#4d453d', 0.02);
    ctx.fillRect(tx - px(28), H - px(170), px(56), px(36));
    ctx.beginPath();
    ctx.moveTo(tx - px(32), H - px(170));
    ctx.lineTo(tx, H - px(190));
    ctx.lineTo(tx + px(32), H - px(170));
    ctx.fill();
    ctx.fillRect(tx - px(22), H - px(134), px(4), px(134));
    ctx.fillRect(tx + px(18), H - px(134), px(4), px(134));
    ctx.fillRect(tx - px(22), H - px(90), px(44), px(3));
  } else if (layer === 1) {
    // warehouses: corrugated walls, curved or pitched roofs, roll-up doors (some lit), blank signs
    let x = 0;
    const walls = ['#6b6156', '#5d6168', '#706354', '#5a5650', '#6e6a62'];
    while (x < W) {
      const w = px(200 + rng.next() * 160);
      const h = px(90 + rng.next() * 60);
      const wall = C(walls[Math.floor(rng.next() * walls.length)]!);
      corrugated(ctx, x, H - h, w, h, wall, px(7));
      ctx.fillStyle = shade(wall, -0.3);
      if (rng.next() < 0.5) {
        ctx.beginPath();
        ctx.moveTo(x - px(4), H - h);
        ctx.quadraticCurveTo(x + w / 2, H - h - px(46), x + w + px(4), H - h);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x - px(4), H - h);
        ctx.lineTo(x + w / 2, H - h - px(30));
        ctx.lineTo(x + w + px(4), H - h);
        ctx.fill();
      }
      // roll-up doors
      const doors = 1 + Math.floor(w / px(110));
      for (let d = 0; d < doors; d++) {
        const dx = x + (w / doors) * (d + 0.5) - px(28);
        const lit = rng.next() < 0.45;
        const dh = px(52);
        if (lit) {
          const g = ctx.createLinearGradient(0, H - dh, 0, H);
          g.addColorStop(0, '#5a4422');
          g.addColorStop(1, '#e0a650');
          ctx.fillStyle = g;
          ctx.fillRect(dx, H - dh, px(56), dh);
          ctx.fillStyle = C('#7a7064');
          ctx.fillRect(dx, H - dh, px(56), dh * 0.45);
          glow(ctx, dx + px(28), H - px(6), px(60), sodium, 0.35);
        } else {
          ctx.fillStyle = shade(wall, -0.2);
          ctx.fillRect(dx, H - dh, px(56), dh);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < dh * (lit ? 0.45 : 1); k += px(5)) ctx.fillRect(dx, H - dh + k, px(56), px(1.4));
      }
      // blank company sign and a wall lamp
      ctx.fillStyle = C('#2c2a28');
      ctx.fillRect(x + w * 0.1, H - h + px(10), w * 0.32, px(16));
      ctx.fillStyle = C('#bfb39c');
      ctx.fillRect(x + w * 0.12, H - h + px(15), w * 0.18, px(3));
      ctx.fillRect(x + w * 0.12, H - h + px(20), w * 0.1, px(2));
      const lx = x + w * 0.75;
      ctx.fillStyle = `rgb(${sodium})`;
      ctx.fillRect(lx, H - h + px(14), px(10), px(5));
      cone(ctx, lx + px(5), H - h + px(19), px(90), h - px(19), sodium, 0.14);
      glow(ctx, lx + px(5), H - h + px(16), px(24), sodium, 0.6);
      x += w + px(14 + rng.next() * 50);
    }
  } else {
    // brick wall with graffiti, parked cars, a gate and sodium street lamps
    const top = H - px(118);
    const brick = C('#7a4a36');
    ctx.fillStyle = brick;
    ctx.fillRect(0, top, W, H - top);
    ctx.fillStyle = shade(brick, -0.3);
    for (let y = top; y < H; y += px(9)) {
      ctx.fillRect(0, y, W, px(1.2));
      const off = Math.round((y - top) / px(9)) % 2 ? px(10) : 0;
      for (let k = off; k < W; k += px(20)) ctx.fillRect(k, y, px(1.2), px(9));
    }
    ctx.fillStyle = C('#8f8a82');
    ctx.fillRect(0, top - px(6), W, px(7));
    const pal = ['#f2b705', '#2bb3ff', '#e5484d', '#3ccf6e', '#c264ff', '#ff7a1a', '#f4f4f4'];
    for (let i = 0; i < 9; i++) {
      const gx = (i + rng.next() * 0.4) * (W / 9);
      graffiti(p, gx, top + px(18), px(110 + rng.next() * 40), px(56), pal.map((c) => litFar(c, l, 0.12)));
    }
    // gates
    for (const gx of [W * 0.31, W * 0.79]) {
      ctx.fillStyle = C('#2c2f33');
      ctx.fillRect(gx, top - px(12), px(120), H - top + px(12));
      ctx.strokeStyle = C('#5f656c');
      ctx.lineWidth = px(2);
      for (let k = px(8); k < px(120); k += px(10)) {
        ctx.beginPath();
        ctx.moveTo(gx + k, top - px(10));
        ctx.lineTo(gx + k, H);
        ctx.stroke();
      }
    }
    const carCols = ['#8b1d1d', '#d9d6cf', '#2a4b7c', '#3d3f43', '#7a6a3a', '#1f5a3c'];
    for (let i = 0; i < 6; i++) {
      const x0 = (i + 0.2 + rng.next() * 0.4) * (W / 6);
      wrapped(W, x0, px(120), (xx) => parkedCar(p, xx, H - px(2), carCols[i % carCols.length]!, rng.next() < 0.5, i === 2 ? 'hazard' : 'none'));
    }
    for (let i = 0; i < 4; i++) streetLamp(p, (i + 0.5) * (W / 4), H, H * 0.94, sodium, i % 2 === 1);
  }
}

// ------------------------------------------------------------------------------- Baixada

function baixada(p: Painter): void {
  const { ctx, W, H, rng, l, C, px, layer } = p;
  const cold = '190,220,255';
  if (layer === 0) {
    // hills packed with residential towers and houses, cold windows
    const hill = periodic(rng, [[1, 22], [3, 12], [7, 5]], W);
    ridge(ctx, W, H, (x) => H * 0.55 + px(hill(x)), C('#1e2a38', 0.03), C('#141c27', 0.03), C('#1a2430', 0.03), false);
    let x = 0;
    while (x < W) {
      const w = px(26 + rng.next() * 40);
      const h = px(60 + rng.next() * 170);
      building(ctx, rng, x, H, w, h, C(['#2a3442', '#323c4b', '#26303c'][Math.floor(rng.next() * 3)]!, 0.02), l, 0.35);
      if (rng.next() < 0.2) {
        ctx.fillStyle = '#ff4a35';
        ctx.fillRect(x + w / 2 - px(2), H - h - px(5), px(4), px(4));
      }
      x += w + px(4 + rng.next() * 12);
    }
    // small houses on the slope
    for (let i = 0; i < 140; i++) {
      const hx = rng.next() * W;
      const hy = H * 0.6 + px(hill(hx)) + rng.next() * H * 0.25;
      ctx.fillStyle = C(['#3c4552', '#4a4440', '#3a4048'][i % 3]!, 0.02);
      ctx.fillRect(hx, hy, px(10), px(7));
      if (rng.next() < 0.5) {
        ctx.fillStyle = rng.next() < 0.6 ? '#f0cf7e' : '#b9d6ea';
        ctx.fillRect(hx + px(3), hy + px(2), px(3), px(2.5));
      }
    }
  } else if (layer === 1) {
    // elevated viaduct across the whole layer: deck, parapet, piers, traffic lights on top
    const deckTop = H * 0.32;
    const deckH = px(34);
    for (let k = px(60); k < W; k += px(256)) {
      const g = ctx.createLinearGradient(k, 0, k + px(38), 0);
      g.addColorStop(0, C('#7c838b'));
      g.addColorStop(1, C('#4c5259'));
      ctx.fillStyle = g;
      ctx.fillRect(k, deckTop + deckH, px(38), H - deckTop - deckH);
      ctx.fillStyle = C('#5d646b');
      ctx.fillRect(k - px(12), deckTop + deckH, px(62), px(10));
      graffiti(p, k - px(4), H - px(80), px(46), px(40), ['#2bb3ff', '#e5484d', '#f2f2f2', '#c264ff'].map((c) => litFar(c, l, 0.3)));
    }
    const dg = ctx.createLinearGradient(0, deckTop, 0, deckTop + deckH);
    dg.addColorStop(0, C('#9aa1a8'));
    dg.addColorStop(1, C('#575d64'));
    ctx.fillStyle = dg;
    ctx.fillRect(0, deckTop, W, deckH);
    ctx.fillStyle = C('#3d4247');
    ctx.fillRect(0, deckTop + deckH, W, px(5));
    ctx.fillStyle = C('#b9bec3');
    ctx.fillRect(0, deckTop - px(10), W, px(10));
    for (let k = 0; k < W; k += px(16)) {
      ctx.fillStyle = C('#80868c');
      ctx.fillRect(k, deckTop - px(10), px(2), px(10));
    }
    // traffic on the deck: head and tail lights
    for (let i = 0; i < 26; i++) {
      const tx = rng.next() * W;
      const red = rng.next() < 0.5;
      const rgb = red ? '255,60,50' : '255,245,210';
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.fillRect(tx, deckTop - px(14), px(5), px(3));
      glow(ctx, tx + px(2.5), deckTop - px(13), px(12), rgb, 0.5);
    }
    // LED lamps on the parapet, light spilling under the deck
    for (let k = px(128); k < W; k += px(256)) {
      ctx.fillStyle = C('#6c737a');
      ctx.fillRect(k, deckTop - px(52), px(3), px(42));
      ctx.fillRect(k, deckTop - px(52), px(18), px(3));
      ctx.fillStyle = `rgb(${cold})`;
      ctx.fillRect(k + px(10), deckTop - px(50), px(10), px(3));
      glow(ctx, k + px(15), deckTop - px(49), px(30), cold, 0.55);
      glow(ctx, k, deckTop + deckH + px(30), px(90), cold, 0.1);
    }
  } else {
    // near: big concrete piers with graffiti, Jersey barriers, a hanging fluorescent fixture, cars
    const pal = ['#2bb3ff', '#e5484d', '#f2b705', '#3ccf6e', '#f4f4f4', '#ff4fa3'].map((c) => litFar(c, l, 0.12));
    // underside of the deck at the top of the layer
    ctx.fillStyle = C('#2c3238');
    ctx.fillRect(0, 0, W, px(26));
    ctx.fillStyle = C('#3a4148');
    for (let k = 0; k < W; k += px(64)) ctx.fillRect(k, px(26), px(40), px(8));
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.25) * (W / 4);
      const w = px(120);
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, C('#8a9096'));
      g.addColorStop(0.5, C('#a2a8ad'));
      g.addColorStop(1, C('#5b6167'));
      ctx.fillStyle = g;
      ctx.fillRect(x, px(30), w, H - px(30));
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let k = px(40); k < H; k += px(48)) ctx.fillRect(x, k, w, px(1.5));
      graffiti(p, x + px(8), H - px(120), w - px(16), px(70), pal);
      // fluorescent tube on the pier
      ctx.fillStyle = `rgb(${cold})`;
      ctx.fillRect(x + w * 0.3, px(44), w * 0.4, px(4));
      glow(ctx, x + w / 2, px(46), px(70), cold, 0.4);
    }
    // jersey barriers along the foot
    for (let k = 0; k < W; k += px(76)) {
      ctx.fillStyle = C('#b8bcbf');
      ctx.beginPath();
      ctx.moveTo(k + px(2), H);
      ctx.lineTo(k + px(10), H - px(16));
      ctx.lineTo(k + px(16), H - px(30));
      ctx.lineTo(k + px(58), H - px(30));
      ctx.lineTo(k + px(64), H - px(16));
      ctx.lineTo(k + px(72), H);
      ctx.fill();
      ctx.fillStyle = C('#d4a020');
      ctx.fillRect(k + px(18), H - px(24), px(38), px(4));
    }
    const carCols = ['#3d3f43', '#c9c5bb', '#1f3e66', '#6b1c1c'];
    for (let i = 0; i < 3; i++) {
      const x0 = (i + 0.62) * (W / 3);
      wrapped(W, x0, px(120), (xx) => parkedCar(p, xx, H - px(30), carCols[i]!, i % 2 === 0, i === 1 ? 'tail' : 'none'));
    }
  }
}

// ------------------------------------------------------------------------------- Avenida Norte

export function lightTower(p: Painter, x: number, foot: number, h: number): void {
  const { ctx, px, C } = p;
  const white = '235,240,255';
  ctx.strokeStyle = C('#6a7078');
  ctx.lineWidth = px(2);
  ctx.beginPath();
  ctx.moveTo(x - px(10), foot);
  ctx.lineTo(x - px(3), foot - h);
  ctx.moveTo(x + px(10), foot);
  ctx.lineTo(x + px(3), foot - h);
  for (let y = foot; y > foot - h; y -= px(22)) {
    const t = (foot - y) / h;
    const half = px(10) - t * px(7);
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half * 0.8, y - px(22));
  }
  ctx.stroke();
  // lamp bank 3 × 2
  ctx.fillStyle = C('#3b4047');
  ctx.fillRect(x - px(24), foot - h - px(26), px(48), px(28));
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = `rgb(${white})`;
      ctx.fillRect(x - px(20) + c * px(15), foot - h - px(22) + r * px(12), px(10), px(8));
    }
  glow(ctx, x, foot - h - px(12), px(110), white, 0.5);
  cone(ctx, x, foot - h, px(260), h, white, 0.08);
}

function avenida(p: Painter): void {
  const { ctx, W, H, rng, l, C, px, layer } = p;
  if (layer === 0) {
    // city glow on the horizon, distant skyline, an antenna mast with red lights
    const sky = ctx.createLinearGradient(0, H * 0.3, 0, H);
    sky.addColorStop(0, 'rgba(90,80,140,0)');
    sky.addColorStop(1, 'rgba(120,110,170,0.25)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    let x = 0;
    while (x < W) {
      const w = px(30 + rng.next() * 60);
      const h = px(50 + rng.next() * 200);
      building(ctx, rng, x, H, w, h, C(['#2b2d3d', '#33354a', '#282a38'][Math.floor(rng.next() * 3)]!, 0.02), l, 0.28);
      x += w + px(2 + rng.next() * 10);
    }
    const ax = W * 0.57;
    ctx.strokeStyle = C('#4a4d5c', 0.02);
    ctx.lineWidth = px(2);
    ctx.beginPath();
    ctx.moveTo(ax - px(12), H);
    ctx.lineTo(ax, H - px(330));
    ctx.lineTo(ax + px(12), H);
    ctx.stroke();
    for (const y of [330, 240, 150]) {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(ax - px(3), H - px(y) - px(3), px(6), px(5));
      glow(ctx, ax, H - px(y), px(14), '255,60,50', 0.7);
    }
  } else if (layer === 1) {
    // shuttered shops, a fuel station canopy (unbranded), avenue trees and light towers
    let x = 0;
    while (x < W) {
      const w = px(110 + rng.next() * 120);
      const h = px(70 + rng.next() * 60);
      const wall = C(['#5a5560', '#4e5560', '#625a52', '#4c4a55'][Math.floor(rng.next() * 4)]!);
      building(ctx, rng, x, H - px(46), w, h - px(46), wall, l, 0.2);
      // shutters at street level
      ctx.fillStyle = shade(wall, -0.15);
      ctx.fillRect(x, H - px(46), w, px(46));
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < px(46); k += px(4)) ctx.fillRect(x + px(4), H - px(46) + k, w - px(8), px(1.2));
      ctx.fillStyle = C('#2a2b30');
      ctx.fillRect(x + px(6), H - px(58), w - px(12), px(10));
      x += w + px(6);
    }
    const cx = W * 0.25;
    ctx.fillStyle = C('#d8dade');
    ctx.fillRect(cx, H - px(92), px(220), px(14));
    ctx.fillStyle = C('#9a9da3');
    ctx.fillRect(cx + px(20), H - px(78), px(8), px(78));
    ctx.fillRect(cx + px(190), H - px(78), px(8), px(78));
    glow(ctx, cx + px(110), H - px(70), px(120), '230,240,255', 0.3);
    for (let i = 0; i < 14; i++) {
      const tx = rng.next() * W;
      wrapped(W, tx, px(40), (xx) => {
        ctx.fillStyle = C('#20281f');
        ctx.fillRect(xx - px(2), H - px(60), px(4), px(60));
        ctx.beginPath();
        ctx.ellipse(xx, H - px(76), px(26), px(22), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C('#34432f');
        ctx.beginPath();
        ctx.ellipse(xx - px(6), H - px(84), px(14), px(10), 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    for (let i = 0; i < 3; i++) lightTower(p, (i + 0.5) * (W / 3), H, H * 0.82);
  } else {
    // near: crowd standing behind steel barriers, two light towers, parked cars with hazards
    const clothes = ['#b5544a', '#3f6f9a', '#d9d4c7', '#4f7a4a', '#c9a23f', '#5b5f66', '#8c5b8f', '#e08a3c', '#1f2226', '#a3a7ad'];
    const skins = ['#e0b896', '#b9845c', '#8a5a3c', '#f0cdb0', '#6e4630'];
    const crowdFoot = H - px(18);
    for (let row = 0; row < 3; row++) {
      const s = px(1.15 - row * 0.12);
      const y = crowdFoot - row * px(10);
      const dim = 0.25 + row * 0.12;
      for (let x = rng.next() * px(8); x < W; x += px(11 + rng.next() * 9)) {
        if (rng.next() < 0.08) {
          x += px(30);
          continue;
        }
        person(ctx, x, y, s, litFar(clothes[Math.floor(rng.next() * clothes.length)]!, l, dim), litFar(skins[Math.floor(rng.next() * skins.length)]!, l, dim), rng.next() < 0.1);
      }
    }
    // crowd-control barriers
    ctx.strokeStyle = C('#c3c7cc');
    ctx.lineWidth = px(2.5);
    for (let k = 0; k < W; k += px(96)) {
      ctx.strokeRect(k + px(3), H - px(44), px(90), px(34));
      ctx.beginPath();
      for (let v = px(12); v < px(90); v += px(9)) {
        ctx.moveTo(k + px(3) + v, H - px(44));
        ctx.lineTo(k + px(3) + v, H - px(10));
      }
      ctx.stroke();
      ctx.fillStyle = C('#9aa0a6');
      ctx.fillRect(k + px(6), H - px(10), px(4), px(10));
      ctx.fillRect(k + px(86), H - px(10), px(4), px(10));
    }
    for (const fx of [0.12, 0.62]) lightTower(p, W * fx, H, H * 0.96);
    const carCols = ['#101215', '#d8d9d6', '#7a1c1c'];
    for (let i = 0; i < 3; i++) {
      const x0 = (i + 0.35) * (W / 3) + px(60);
      wrapped(W, x0, px(120), (xx) => parkedCar(p, xx, H - px(46), carCols[i]!, i % 2 === 1, 'hazard'));
    }
  }
}
