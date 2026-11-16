import { Prng } from '../../core/prng';
import { mix, shade } from '../vehicles/art/svg';
import { litFar, type LightingState } from './LightingController';
import { canvas, type Theme } from './trackArt';

/**
 * Scenery behind the track: sky, stars, clouds and three parallax layers per theme (distant
 * relief, middle ground, near vegetation and structures). Every layer tiles horizontally without
 * a seam: relief uses periodic functions and objects near an edge are drawn on both sides.
 * Distance is conveyed by haze (contrast and saturation fall towards the horizon), by scale and
 * by the parallax speed. Original procedural artwork, deterministic.
 */
export const LAYER_W = 2048;
export const LAYER_H = [400, 330, 270] as const;

type Ctx = CanvasRenderingContext2D;

/** Sum of sines with integer frequencies: periodic over the texture width. */
function periodic(rng: Prng, terms: [number, number][], W: number): (x: number) => number {
  const ph = terms.map(() => rng.next() * Math.PI * 2);
  return (x) => terms.reduce((acc, [k, a], i) => acc + Math.sin((x / W) * Math.PI * 2 * k + ph[i]!) * a, 0);
}

/** Draws at x and at x ± W so nothing is cut at the tile seam. */
function wrapped(W: number, x: number, halfWidth: number, draw: (x: number) => void): void {
  draw(x);
  if (x < halfWidth) draw(x + W);
  if (x > W - halfWidth) draw(x - W);
}

/** Relief with slope shading: faces turned to the light are brighter, the foot fades into `foot`. */
function ridge(ctx: Ctx, W: number, H: number, top: (x: number) => number, light: string, dark: string, foot: string, sunRight: boolean, step = 2): void {
  for (let x = 0; x < W; x += step) {
    const y = top(x);
    const slope = (top(x + step * 2) - top(x - step * 2)) / (step * 4);
    const t = Math.max(0, Math.min(1, 0.5 + (sunRight ? slope : -slope) * 1.1));
    const g = ctx.createLinearGradient(0, y, 0, H);
    g.addColorStop(0, mix(dark, light, t));
    g.addColorStop(1, foot);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, step + 0.5, H - y);
  }
}

function crown(ctx: Ctx, rng: Prng, x: number, baseY: number, size: number, dark: string, light: string, sunRight: boolean): void {
  const n = 5 + Math.floor(rng.next() * 4);
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) blobs.push([x + (rng.next() - 0.5) * size * 1.1, baseY - size * (0.5 + rng.next() * 0.75), size * (0.32 + rng.next() * 0.3)]);
  ctx.fillStyle = dark;
  for (const [bx, by, br] of blobs) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(x - size * 0.06, baseY - size * 0.5, size * 0.12, size * 0.5);
  ctx.fillStyle = light;
  for (const [bx, by, br] of blobs) {
    ctx.beginPath();
    ctx.arc(bx + (sunRight ? 1 : -1) * br * 0.28, by - br * 0.3, br * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
}

function conifer(ctx: Ctx, x: number, baseY: number, h: number, dark: string, light: string, sunRight: boolean): void {
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const y0 = baseY - h * (0.18 + (i / tiers) * 0.82);
    const w = h * 0.24 * (1 - i / (tiers + 1));
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x - w, y0 + h * 0.26);
    ctx.lineTo(x, y0 - h * 0.05);
    ctx.lineTo(x + w, y0 + h * 0.26);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(x, y0 - h * 0.05);
    ctx.lineTo(x + (sunRight ? w : -w), y0 + h * 0.26);
    ctx.lineTo(x, y0 + h * 0.26);
    ctx.fill();
  }
}

function building(ctx: Ctx, rng: Prng, x: number, baseY: number, w: number, h: number, wall: string, l: LightingState, lightsOn: number): void {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(wall, 0.08));
  g.addColorStop(1, shade(wall, -0.18));
  ctx.fillStyle = g;
  ctx.fillRect(x, baseY - h, w, h);
  ctx.fillStyle = shade(wall, -0.3);
  ctx.fillRect(x, baseY - h, w, Math.max(2, h * 0.02));
  const cols = Math.max(2, Math.floor(w / 13));
  const rows = Math.max(2, Math.floor(h / 15));
  const cw = w / cols;
  const rh = h / rows;
  for (let r = 0; r < rows - 0; r++) {
    for (let c = 0; c < cols; c++) {
      const on = rng.next() < lightsOn;
      ctx.fillStyle = on ? (rng.next() < 0.6 ? '#f0cf7e' : '#b9d6ea') : l.time === 'night' ? shade(wall, -0.35) : mix(wall, '#1c2a36', 0.6);
      ctx.fillRect(x + c * cw + cw * 0.25, baseY - h + r * rh + rh * 0.28, cw * 0.5, rh * 0.42);
    }
  }
}

// ------------------------------------------------------------------------------- sky

export function buildSky(l: LightingState): HTMLCanvasElement {
  const [c, ctx] = canvas(8, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, l.sky[0]);
  g.addColorStop(0.55, l.sky[1]);
  g.addColorStop(1, l.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 512);
  return c;
}

export function buildStars(): HTMLCanvasElement {
  const [c, ctx] = canvas(512, 512);
  const rng = new Prng(2024);
  for (let i = 0; i < 420; i++) {
    const a = 0.25 + rng.next() * 0.75;
    const s = rng.next() < 0.08 ? 2 : 1;
    ctx.fillStyle = `rgba(${220 + Math.floor(rng.next() * 35)},${225 + Math.floor(rng.next() * 30)},255,${a.toFixed(2)})`;
    ctx.fillRect(rng.next() * 512, rng.next() * 512, s, s);
  }
  return c;
}

export function buildClouds(l: LightingState, scale: number): HTMLCanvasElement {
  const W = Math.round(LAYER_W * scale);
  const H = Math.round(300 * scale);
  const [c, ctx] = canvas(W, H);
  const rng = new Prng(555);
  for (let i = 0; i < 11; i++) {
    const cx = rng.next() * W;
    const cy = H * (0.15 + rng.next() * 0.6);
    const size = (50 + rng.next() * 90) * scale;
    const puffs: [number, number, number][] = [];
    const n = 7 + Math.floor(rng.next() * 6);
    for (let k = 0; k < n; k++) puffs.push([(rng.next() - 0.5) * size * 3.4, (rng.next() - 0.5) * size * 0.5, size * (0.35 + rng.next() * 0.5)]);
    wrapped(W, cx, size * 3, (x) => {
      for (const [dx, dy, r] of puffs) {
        const g = ctx.createRadialGradient(x + dx, cy + dy + r * 0.25, 0, x + dx, cy + dy + r * 0.25, r);
        g.addColorStop(0, l.cloud.shade);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = l.cloud.alpha * 0.55;
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, cy + dy - r, r * 2, r * 2.5);
      }
      for (const [dx, dy, r] of puffs) {
        const g = ctx.createRadialGradient(x + dx, cy + dy - r * 0.2, 0, x + dx, cy + dy - r * 0.2, r * 0.9);
        g.addColorStop(0, l.cloud.lit);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = l.cloud.alpha * 0.6;
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, cy + dy - r * 1.2, r * 2, r * 2);
      }
    });
  }
  ctx.globalAlpha = 1;
  return c;
}

// ------------------------------------------------------------------------------- layers

/**
 * Parallax layer 0 (far), 1 (middle) or 2 (near). The bottom edge of the texture is the layer's
 * foot (the horizon for the far layers); everything above the relief is transparent.
 */
export function buildLayer(theme: Theme, layer: 0 | 1 | 2, l: LightingState, scale: number): HTMLCanvasElement {
  const W = Math.round(LAYER_W * scale);
  const H = Math.round(LAYER_H[layer] * scale);
  const [c, ctx] = canvas(W, H);
  const rng = new Prng(17 + layer * 101 + theme.length * 7);
  const sunRight = l.orb.x > 0.5;
  const dist = [0.95, 0.6, 0.22][layer]!;
  const C = (color: string, extra = 0): string => litFar(color, l, Math.min(1, dist + extra));
  const px = (v: number): number => v * scale;
  const lightsOn = l.time === 'night' ? 0.32 : l.time === 'dusk' ? 0.14 : 0;

  if (theme === 'testTrack') {
    if (layer === 0) {
      const back = periodic(rng, [[1, 34], [2, 22], [5, 12], [11, 6], [23, 3]], W);
      ridge(ctx, W, H, (x) => H * 0.34 + px(back(x)), C('#8fa0b4', 0.05), C('#5c6b82', 0.05), C('#9fb0c2', 0.05), sunRight);
      const front = periodic(rng, [[1, 22], [3, 18], [7, 9], [15, 4]], W);
      ridge(ctx, W, H, (x) => H * 0.56 + px(front(x)), C('#74906f'), C('#465c4a'), C('#8ea588'), sunRight);
    } else if (layer === 1) {
      const hill = periodic(rng, [[1, 16], [2, 12], [5, 6]], W);
      const top = (x: number): number => H * 0.58 + px(hill(x));
      ridge(ctx, W, H, top, C('#6f9450'), C('#3f5c34'), C('#5f8246'), sunRight);
      for (let i = 0; i < 150; i++) {
        const x = rng.next() * W;
        const size = px(18 + rng.next() * 22);
        wrapped(W, x, size * 1.5, (xx) => crown(ctx, rng, xx, top(x) + px(6), size, C('#2f4a2a'), C('#5f8a44'), sunRight));
      }
    } else {
      // hedge, single trees and a white rail fence
      const hedge = periodic(rng, [[3, 5], [9, 4], [21, 2]], W);
      ridge(ctx, W, H, (x) => H * 0.7 + px(hedge(x)), C('#557a3a'), C('#2c4422'), C('#3d5c2c'), sunRight);
      for (let i = 0; i < 16; i++) {
        const x = rng.next() * W;
        const size = px(46 + rng.next() * 40);
        const pine = rng.next() < 0.35;
        wrapped(W, x, size * 1.5, (xx) => (pine ? conifer(ctx, xx, H * 0.78, size * 2.3, C('#243c22'), C('#42663a'), sunRight) : crown(ctx, rng, xx, H * 0.8, size, C('#274021'), C('#5b8a3e'), sunRight)));
      }
      ctx.fillStyle = C('#e8e8e2');
      for (let x = 0; x < W; x += px(46)) ctx.fillRect(x, H * 0.82, px(5), H * 0.18);
      ctx.fillRect(0, H * 0.84, W, px(4));
      ctx.fillRect(0, H * 0.91, W, px(4));
    }
  } else if (theme === 'desert') {
    if (layer === 0) {
      // mesas: flat tops, stepped flanks, strata
      const base = periodic(rng, [[1, 30], [2, 26], [4, 16], [9, 6]], W);
      const top = (x: number): number => {
        const v = base(x);
        return H * 0.52 - px(Math.max(-14, Math.min(46, v * 1.6))) + px(Math.sin(x * 0.07) * 1.2);
      };
      ridge(ctx, W, H, top, C('#d08a5c', 0.02), C('#8e5338', 0.02), C('#e0b088', 0.02), sunRight);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = C('#5a2f1c');
      for (let y = H * 0.36; y < H * 0.7; y += px(13)) ctx.fillRect(0, y, W, px(2.5));
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-in';
      const [mask, mctx] = canvas(W, H);
      mctx.fillStyle = '#000';
      mctx.beginPath();
      mctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) mctx.lineTo(x, top(x));
      mctx.lineTo(W, H);
      mctx.fill();
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    } else if (layer === 1) {
      const dune = periodic(rng, [[1, 18], [3, 12], [6, 7]], W);
      ridge(ctx, W, H, (x) => H * 0.62 + px(dune(x)), C('#e2be88'), C('#ad8554'), C('#d2ab76'), sunRight);
      const dune2 = periodic(rng, [[2, 10], [5, 8], [11, 3]], W);
      ridge(ctx, W, H, (x) => H * 0.78 + px(dune2(x)), C('#d9b47c'), C('#a07a4b'), C('#c8a26c'), sunRight);
      for (let i = 0; i < 26; i++) {
        const x = rng.next() * W;
        const w = px(20 + rng.next() * 50);
        const h = w * (0.35 + rng.next() * 0.3);
        wrapped(W, x, w, (xx) => {
          const g = ctx.createLinearGradient(xx - w / 2, 0, xx + w / 2, 0);
          g.addColorStop(sunRight ? 1 : 0, C('#b47a50'));
          g.addColorStop(sunRight ? 0 : 1, C('#6e4530'));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(xx - w / 2, H * 0.86);
          ctx.lineTo(xx - w * 0.3, H * 0.86 - h);
          ctx.lineTo(xx + w * 0.2, H * 0.86 - h * 1.1);
          ctx.lineTo(xx + w / 2, H * 0.86);
          ctx.fill();
        });
      }
    } else {
      const sand = periodic(rng, [[2, 5], [7, 3]], W);
      ridge(ctx, W, H, (x) => H * 0.8 + px(sand(x)), C('#d3ac74'), C('#a8834f'), C('#c49d66'), sunRight);
      for (let i = 0; i < 46; i++) {
        const x = rng.next() * W;
        const size = px(14 + rng.next() * 24);
        const y = H * (0.8 + rng.next() * 0.12);
        wrapped(W, x, size * 2, (xx) => {
          // dry scrub
          ctx.strokeStyle = C(rng.next() < 0.5 ? '#6f7a48' : '#8a7a4c');
          ctx.lineWidth = Math.max(1, px(1.6));
          for (let k = 0; k < 9; k++) {
            ctx.beginPath();
            ctx.moveTo(xx, y);
            ctx.lineTo(xx + (rng.next() - 0.5) * size * 2, y - size * (0.4 + rng.next() * 0.8));
            ctx.stroke();
          }
        });
      }
      // telegraph poles with sagging wires
      const gap = W / 6;
      ctx.strokeStyle = C('#4a3a2c');
      ctx.fillStyle = C('#4a3a2c');
      for (let i = 0; i < 6; i++) {
        const x = i * gap + gap * 0.3;
        ctx.fillRect(x, H * 0.3, px(6), H * 0.6);
        ctx.fillRect(x - px(20), H * 0.34, px(46), px(4));
        ctx.lineWidth = Math.max(1, px(1.2));
        for (const dx of [-18, 20]) {
          ctx.beginPath();
          ctx.moveTo(x + px(dx), H * 0.345);
          ctx.quadraticCurveTo(x + gap / 2 + px(dx), H * 0.43, x + gap + px(dx), H * 0.345);
          ctx.stroke();
        }
      }
    }
  } else if (theme === 'nightIndustrial') {
    const wallColors = ['#3d4654', '#4a4f5c', '#39424d', '#505563'];
    if (layer === 0) {
      // distant skyline
      let x = 0;
      while (x < W) {
        const w = px(34 + rng.next() * 70);
        const h = px(70 + rng.next() * 190);
        building(ctx, rng, x, H, w, h, C(wallColors[Math.floor(rng.next() * wallColors.length)]!, 0.03), l, lightsOn);
        if (rng.next() < 0.3) {
          ctx.fillStyle = C('#3d4654', 0.03);
          ctx.fillRect(x + w * 0.45, H - h - px(40), px(4), px(40));
          if (l.time !== 'day') {
            ctx.fillStyle = '#ff5040';
            ctx.fillRect(x + w * 0.45 - 1, H - h - px(42), px(6), px(5));
          }
        }
        x += w + px(rng.next() * 14);
      }
    } else if (layer === 1) {
      // factories: sheds with saw-tooth roofs, chimneys, tanks
      let x = 0;
      while (x < W) {
        const w = px(120 + rng.next() * 180);
        const h = px(60 + rng.next() * 70);
        const wall = C(wallColors[Math.floor(rng.next() * wallColors.length)]!);
        building(ctx, rng, x, H, w, h, wall, l, lightsOn * 0.8);
        ctx.fillStyle = shade(wall, -0.2);
        for (let k = 0; k < w - px(20); k += px(36)) {
          ctx.beginPath();
          ctx.moveTo(x + k, H - h);
          ctx.lineTo(x + k + px(26), H - h - px(18));
          ctx.lineTo(x + k + px(36), H - h);
          ctx.fill();
        }
        if (rng.next() < 0.6) {
          const cx = x + w * (0.2 + rng.next() * 0.6);
          const ch = px(90 + rng.next() * 80);
          const g = ctx.createLinearGradient(cx, 0, cx + px(16), 0);
          g.addColorStop(0, C('#6a707c'));
          g.addColorStop(1, C('#343a44'));
          ctx.fillStyle = g;
          ctx.fillRect(cx, H - h - ch, px(16), ch);
          ctx.fillStyle = C('#b8322a');
          ctx.fillRect(cx, H - h - ch + px(8), px(16), px(8));
          // plume
          for (let k = 0; k < 7; k++) {
            const r = px(10 + k * 5);
            const pg = ctx.createRadialGradient(cx + px(8 + k * 13), H - h - ch - px(6 + k * 9), 0, cx + px(8 + k * 13), H - h - ch - px(6 + k * 9), r);
            pg.addColorStop(0, `rgba(170,176,190,${(0.22 - k * 0.025).toFixed(3)})`);
            pg.addColorStop(1, 'rgba(170,176,190,0)');
            ctx.fillStyle = pg;
            ctx.fillRect(cx + px(8 + k * 13) - r, H - h - ch - px(6 + k * 9) - r, r * 2, r * 2);
          }
          if (l.time !== 'day') {
            ctx.fillStyle = '#ff5040';
            ctx.fillRect(cx + px(5), H - h - ch - px(4), px(6), px(5));
          }
        }
        x += w + px(10 + rng.next() * 60);
      }
      // storage tanks
      for (let i = 0; i < 5; i++) {
        const x0 = rng.next() * W;
        const w = px(60 + rng.next() * 40);
        const h = px(46 + rng.next() * 24);
        wrapped(W, x0, w, (xx) => {
          const g = ctx.createLinearGradient(xx, 0, xx + w, 0);
          g.addColorStop(0, C('#70767f'));
          g.addColorStop(0.45, C('#8d939c'));
          g.addColorStop(1, C('#3a3f48'));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(xx, H - h, w, h + 4, [w * 0.18, w * 0.18, 0, 0]);
          ctx.fill();
        });
      }
    } else {
      // containers, chain-link fence and street lights
      const cols = ['#a33b2e', '#2f6f9f', '#3f7a4a', '#c08a2a', '#5a5f68'];
      let x = 0;
      while (x < W) {
        const stack = 1 + Math.floor(rng.next() * 3);
        const w = px(118);
        for (let s = 0; s < stack; s++) {
          const col = C(cols[Math.floor(rng.next() * cols.length)]!);
          const y = H - px(26) - (s + 1) * px(50);
          const g = ctx.createLinearGradient(0, y, 0, y + px(50));
          g.addColorStop(0, shade(col, 0.1));
          g.addColorStop(1, shade(col, -0.25));
          ctx.fillStyle = g;
          ctx.fillRect(x, y, w, px(49));
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          for (let k = px(6); k < w; k += px(9)) ctx.fillRect(x + k, y + px(4), px(3), px(41));
        }
        x += w + px(rng.next() < 0.5 ? 6 : 90 + rng.next() * 160);
      }
      ctx.strokeStyle = C('#aab2ba');
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1, px(1));
      ctx.beginPath();
      for (let k = -H; k < W + H; k += px(9)) {
        ctx.moveTo(k, H);
        ctx.lineTo(k + px(70), H - px(70));
        ctx.moveTo(k, H - px(70));
        ctx.lineTo(k + px(70), H);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = C('#7d858e');
      for (let k = 0; k < W; k += px(128)) ctx.fillRect(k, H - px(74), px(4), px(74));
      ctx.fillRect(0, H - px(74), W, px(3));
      for (let i = 0; i < 8; i++) {
        const lx = (i + 0.5) * (W / 8);
        ctx.fillStyle = C('#59616b');
        ctx.fillRect(lx, H * 0.18, px(5), H * 0.82);
        ctx.fillRect(lx, H * 0.18, px(34), px(4));
        if (l.trackLamps) {
          const g = ctx.createRadialGradient(lx + px(30), H * 0.2, 1, lx + px(30), H * 0.2, px(60));
          g.addColorStop(0, 'rgba(255,225,150,0.8)');
          g.addColorStop(1, 'rgba(255,225,150,0)');
          ctx.fillStyle = g;
          ctx.fillRect(lx - px(30), H * 0.2 - px(60), px(120), px(120));
        }
      }
    }
  } else {
    // airfield
    if (layer === 0) {
      const back = periodic(rng, [[1, 16], [2, 12], [5, 7], [13, 3]], W);
      ridge(ctx, W, H, (x) => H * 0.6 + px(back(x)), C('#93a3b2', 0.04), C('#66768a', 0.04), C('#a8b6c2', 0.04), sunRight);
      const tree = periodic(rng, [[4, 4], [17, 3], [41, 2]], W);
      ridge(ctx, W, H, (x) => H * 0.8 + px(tree(x)), C('#6f8a68'), C('#4a6149'), C('#7d9675'), sunRight);
    } else if (layer === 1) {
      const grass = periodic(rng, [[1, 4], [3, 3]], W);
      ridge(ctx, W, H, (x) => H * 0.86 + px(grass(x)), C('#8a9a6a'), C('#6a7a52'), C('#7c8c5e'), sunRight);
      // hangars with curved roofs and a row of parked aircraft tails
      for (let i = 0; i < 4; i++) {
        const x = (i + 0.15) * (W / 4);
        const w = px(250);
        const h = px(86);
        const g = ctx.createLinearGradient(0, H * 0.88 - h, 0, H * 0.88);
        g.addColorStop(0, C('#d5dade'));
        g.addColorStop(1, C('#9aa3aa'));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.88);
        ctx.lineTo(x, H * 0.88 - h * 0.45);
        ctx.quadraticCurveTo(x + w / 2, H * 0.88 - h * 1.5, x + w, H * 0.88 - h * 0.45);
        ctx.lineTo(x + w, H * 0.88);
        ctx.fill();
        ctx.fillStyle = l.trackLamps ? '#caa860' : C('#34424d');
        ctx.fillRect(x + w * 0.2, H * 0.88 - h * 0.5, w * 0.6, h * 0.5);
        ctx.fillStyle = C('#aeb6bc');
        for (let k = 1; k < 5; k++) ctx.fillRect(x + w * 0.2 + (w * 0.6 * k) / 5, H * 0.88 - h * 0.5, px(3), h * 0.5);
      }
      for (let i = 0; i < 6; i++) {
        const x = rng.next() * W;
        wrapped(W, x, px(80), (xx) => {
          ctx.fillStyle = C('#eef1f3');
          ctx.beginPath();
          ctx.roundRect(xx - px(60), H * 0.86 - px(22), px(120), px(13), px(6));
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(xx - px(58), H * 0.86 - px(20));
          ctx.lineTo(xx - px(70), H * 0.86 - px(52));
          ctx.lineTo(xx - px(50), H * 0.86 - px(52));
          ctx.lineTo(xx - px(30), H * 0.86 - px(20));
          ctx.fill();
          ctx.fillStyle = C('#c0392b');
          ctx.fillRect(xx - px(69), H * 0.86 - px(52), px(18), px(7));
        });
      }
    } else {
      const grass = periodic(rng, [[2, 3], [9, 2]], W);
      ridge(ctx, W, H, (x) => H * 0.82 + px(grass(x)), C('#7f9160'), C('#5d6f46'), C('#6f8152'), sunRight);
      for (let i = 0; i < 20; i++) {
        const x = rng.next() * W;
        const size = px(20 + rng.next() * 18);
        wrapped(W, x, size * 1.5, (xx) => crown(ctx, rng, xx, H * 0.86, size, C('#3a5230'), C('#6a8a4c'), sunRight));
      }
      // perimeter fence with barbed top and edge lights
      ctx.strokeStyle = C('#b4bcc3');
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = Math.max(1, px(1));
      ctx.beginPath();
      for (let k = -H; k < W + H; k += px(10)) {
        ctx.moveTo(k, H);
        ctx.lineTo(k + px(64), H - px(64));
        ctx.moveTo(k, H - px(64));
        ctx.lineTo(k + px(64), H);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = C('#8d959c');
      for (let k = 0; k < W; k += px(128)) {
        ctx.fillRect(k, H - px(72), px(4), px(72));
        ctx.fillRect(k, H - px(72), px(12), px(3));
      }
      ctx.fillRect(0, H - px(66), W, px(2.5));
      for (let k = px(64); k < W; k += px(256)) {
        ctx.fillStyle = l.trackLamps ? '#8fd0ff' : C('#3f6f9a');
        ctx.fillRect(k, H - px(10), px(6), px(7));
        if (l.trackLamps) {
          const g = ctx.createRadialGradient(k + px(3), H - px(7), 0, k + px(3), H - px(7), px(18));
          g.addColorStop(0, 'rgba(140,205,255,0.7)');
          g.addColorStop(1, 'rgba(140,205,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(k - px(15), H - px(25), px(36), px(36));
        }
      }
    }
  }
  return c;
}
