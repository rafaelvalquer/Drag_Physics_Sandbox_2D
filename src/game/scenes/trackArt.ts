import type { TrackConfig } from '../../data/schema';
import { Prng } from '../../core/prng';
import { mix, shade } from '../vehicles/art/svg';
import { lit, litFar, type LightingState } from './LightingController';
import { FAR_LANE_SCALE, FAR_TYRE_OFFSET_M, LANE_EDGE_M, LANE_GAP_M } from './worldScale';

/**
 * Procedural track artwork (canvas textures): road surface, launch pad, wall, shoulders and the
 * trackside structures. Original artwork, deterministic per theme and lighting; every texture is
 * built once and cached by the renderer – nothing here runs per frame.
 */
export type Theme = TrackConfig['theme'];

/** Daylight colours of each theme's surfaces (the lighting darkens and tints them). */
export interface Surface {
  asphalt: string;
  concrete: string;
  line: string;
  centre: string;
  shoulder: string;
  ground: string;
  /** Dust lifted by passing cars, or null on clean surfaces. */
  dust: string | null;
  /** What grows / lies beside the track. */
  cover: 'grass' | 'sand' | 'apron';
}

export const SURFACES: Record<Theme, Surface> = {
  testTrack: { asphalt: '#4b4e52', concrete: '#a09e97', line: '#ecece4', centre: '#e2b93a', shoulder: '#77756c', ground: '#587c3d', dust: null, cover: 'grass' },
  desert: { asphalt: '#59524c', concrete: '#aaa192', line: '#f2efe2', centre: '#e6c04a', shoulder: '#b2946a', ground: '#c8a46d', dust: '#d2a874', cover: 'sand' },
  nightIndustrial: { asphalt: '#484b50', concrete: '#929394', line: '#e2dfc8', centre: '#dab23c', shoulder: '#64676d', ground: '#55595f', dust: null, cover: 'apron' },
  airfield: { asphalt: '#54575b', concrete: '#aaaba5', line: '#f4f4ee', centre: '#e8c040', shoulder: '#8b8c84', ground: '#7a8c60', dust: null, cover: 'grass' },
  // campaign street scenes: worn asphalt, faded paint
  distritoIndustrial: { asphalt: '#4a4744', concrete: '#8f8b84', line: '#d9d2b8', centre: '#c9a238', shoulder: '#5f5b55', ground: '#4f4b45', dust: null, cover: 'apron' },
  baixada: { asphalt: '#43474d', concrete: '#8e9297', line: '#dfe3e6', centre: '#d0ae40', shoulder: '#5a5f66', ground: '#3f5a3c', dust: null, cover: 'grass' },
  patioDasTorres: { asphalt: '#3c3f44', concrete: '#9a9da2', line: '#eef0f2', centre: '#e0b43a', shoulder: '#62656b', ground: '#53565c', dust: null, cover: 'apron' },
  distritoFinanceiro: { asphalt: '#34373d', concrete: '#a3a6ab', line: '#f2f3f5', centre: '#e8c04a', shoulder: '#5d6066', ground: '#4c4f55', dust: null, cover: 'apron' },
  corredorDaLiga: { asphalt: '#303236', concrete: '#a6a8ab', line: '#f6f6f2', centre: '#f0c43c', shoulder: '#5a5c60', ground: '#4a4c50', dust: null, cover: 'apron' },
  avenidaNorte: { asphalt: '#3f4246', concrete: '#9a9a97', line: '#eeeee6', centre: '#e0b43a', shoulder: '#66686c', ground: '#55585c', dust: null, cover: 'apron' },
};

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

const BAND_M = LANE_GAP_M + 2 * LANE_EDGE_M;
/** Texture y (0..1) of a screen-metre offset from the near lane's ground line. */
const bandV = (yM: number): number => (yM + LANE_GAP_M + LANE_EDGE_M) / BAND_M;

function grain(ctx: CanvasRenderingContext2D, rng: Prng, w: number, h: number, count: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const light = rng.next() < 0.5;
    ctx.fillStyle = light ? `rgba(255,255,255,${(alpha * (0.4 + rng.next() * 0.6)).toFixed(3)})` : `rgba(0,0,0,${(alpha * 1.6 * (0.4 + rng.next() * 0.6)).toFixed(3)})`;
    // viewed at a shallow angle the aggregate reads as short horizontal dashes
    ctx.fillRect(rng.next() * w, rng.next() * h, 1.5 + rng.next() * 4, 1);
  }
}

function blotches(ctx: CanvasRenderingContext2D, rng: Prng, w: number, h: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    const rx = w * (0.04 + rng.next() * 0.14);
    const ry = h * (0.03 + rng.next() * 0.1);
    ctx.fillStyle = rng.next() < 0.55 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.035)';
    for (const dx of [-w, 0, w]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Rubber laid in the tyre tracks of both lanes. */
function grooves(ctx: CanvasRenderingContext2D, rng: Prng, w: number, h: number, strength: number): void {
  for (const lane of [0, 1] as const) {
    const base = lane === 1 ? -LANE_GAP_M : 0;
    const sc = lane === 1 ? FAR_LANE_SCALE : 1;
    for (const [off, width] of [
      [0.02, 0.3],
      [-FAR_TYRE_OFFSET_M * sc, 0.22],
    ] as const) {
      const cy = bandV(base + off) * h;
      const half = ((width * sc) / BAND_M) * h * 0.5;
      const g = ctx.createLinearGradient(0, cy - half * 1.5, 0, cy + half * 1.5);
      g.addColorStop(0, 'rgba(6,6,7,0)');
      g.addColorStop(0.35, `rgba(6,6,7,${(0.5 * strength).toFixed(3)})`);
      g.addColorStop(0.65, `rgba(6,6,7,${(0.5 * strength).toFixed(3)})`);
      g.addColorStop(1, 'rgba(6,6,7,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, cy - half * 1.5, w, half * 3);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(0,0,0,${(0.07 * strength * rng.next()).toFixed(3)})`;
        ctx.fillRect(rng.next() * w, cy + (rng.next() - 0.5) * half * 2, 30 + rng.next() * 160, 1);
      }
    }
  }
}

function paintedLine(ctx: CanvasRenderingContext2D, rng: Prng, w: number, y: number, t: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, y - t / 2, w, t);
  // wear: chips of bare surface
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(0,0,0,${(0.25 + rng.next() * 0.5).toFixed(2)})`;
    ctx.fillRect(rng.next() * w, y - t / 2 + rng.next() * t, 2 + rng.next() * 9, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Road band (both lanes, 16 m long, tileable): asphalt with grain and wear, rubber in the tyre
 * tracks, edge lines and the centre line. The painted lines are drawn on a separate transparent
 * pass so their wear shows the asphalt underneath.
 */
export function buildRoad(theme: Theme, l: LightingState, scale: number, kind: 'asphalt' | 'concrete' = 'asphalt'): HTMLCanvasElement {
  const s = SURFACES[theme];
  const W = Math.round((kind === 'asphalt' ? 1024 : 512) * scale);
  const H = Math.round(256 * scale);
  const [c, ctx] = canvas(W, H);
  const rng = new Prng(kind === 'asphalt' ? 99 : 177);
  const base = lit(kind === 'asphalt' ? s.asphalt : s.concrete, l);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  blotches(ctx, rng, W, H, kind === 'asphalt' ? 34 : 16);
  grain(ctx, rng, W, H, Math.round((kind === 'asphalt' ? 9000 : 3500) * scale * scale), kind === 'asphalt' ? 0.09 : 0.06);
  if (kind === 'concrete') {
    // expansion joints every 4 m and a longitudinal joint in each lane
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 0; x < W; x += W / 2) ctx.fillRect(x, 0, Math.max(1, 2 * scale), H);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, bandV(-LANE_GAP_M - 0.45) * H, W, 1);
    ctx.fillRect(0, bandV(0.45) * H, W, 1);
  } else {
    // cracks and a repair patch
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = Math.max(1, scale);
    for (let i = 0; i < 5; i++) {
      let x = rng.next() * W;
      let y = rng.next() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        x += 10 + rng.next() * 40;
        y += (rng.next() - 0.5) * 9;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(W * 0.62, bandV(-0.6) * H, W * 0.11, H * 0.16);
  }
  grooves(ctx, rng, W, H, kind === 'asphalt' ? 0.36 : 0.62);
  // edges collect dirt
  for (const [y0, y1] of [
    [0, H * 0.07],
    [H, H * 0.93],
  ] as const) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
  }
  // painted lines on their own layer
  const [lc, lctx] = canvas(W, H);
  const t = Math.max(2, (0.075 / BAND_M) * H);
  paintedLine(lctx, rng, W, bandV(-LANE_GAP_M - LANE_EDGE_M + 0.1) * H, t, lit(s.line, l));
  paintedLine(lctx, rng, W, bandV(LANE_EDGE_M - 0.1) * H, t, lit(s.line, l));
  paintedLine(lctx, rng, W, bandV(-LANE_GAP_M / 2) * H, t * 0.9, lit(s.centre, l));
  ctx.drawImage(lc, 0, 0);
  return c;
}

/** Jersey barrier with a catch fence, 8 m long and `heightM` tall (tileable). */
export function buildWall(theme: Theme, l: LightingState, ppm: number, heightM: number): HTMLCanvasElement {
  const W = Math.round(8 * ppm);
  const H = Math.round(heightM * ppm);
  const [c, ctx] = canvas(W, H);
  const rng = new Prng(51);
  const m = (v: number): number => v * ppm;
  const wallTop = H - m(0.86);
  // fence: posts, cables and mesh
  ctx.strokeStyle = lit('#b9c0c6', l, 0.9);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, ppm * 0.012);
  const step = m(0.11);
  ctx.beginPath();
  for (let x = -H; x < W + H; x += step) {
    ctx.moveTo(x, wallTop);
    ctx.lineTo(x + wallTop, 0);
    ctx.moveTo(x, 0);
    ctx.lineTo(x + wallTop, wallTop);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = lit('#6d757c', l);
  for (let x = 0; x < W; x += m(2)) ctx.fillRect(x, 0, Math.max(2, m(0.07)), wallTop);
  ctx.fillRect(0, 0, W, Math.max(2, m(0.05)));
  ctx.fillStyle = lit('#8a9299', l);
  for (const y of [0.33, 0.66]) ctx.fillRect(0, wallTop * y, W, Math.max(1, m(0.025)));
  // concrete barrier
  const g = ctx.createLinearGradient(0, wallTop, 0, H);
  g.addColorStop(0, lit('#d2d0c8', l));
  g.addColorStop(0.5, lit('#bdbbb3', l));
  g.addColorStop(1, lit('#8f8d86', l));
  ctx.fillStyle = g;
  ctx.fillRect(0, wallTop, W, H - wallTop);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, wallTop, W, Math.max(1, m(0.03)));
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, H - m(0.24), W, m(0.24));
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(0,0,0,${(0.05 + rng.next() * 0.1).toFixed(3)})`;
    ctx.fillRect(rng.next() * W, wallTop + m(0.05), 1 + rng.next() * 3, m(0.2 + rng.next() * 0.5));
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let x = 0; x < W; x += m(4)) ctx.fillRect(x, wallTop, Math.max(1, m(0.025)), H - wallTop);
  // painted band
  const band = theme === 'desert' ? '#c0392b' : theme === 'nightIndustrial' ? '#e0a100' : theme === 'airfield' ? '#1f6fb2' : '#c62828';
  for (let x = 0; x < W; x += m(2)) {
    ctx.fillStyle = lit((x / m(2)) % 2 ? '#f1f1ec' : band, l);
    ctx.fillRect(x, wallTop + m(0.1), m(2), m(0.16));
  }
  return c;
}

/** Ground in front of the near lane (8 m × 4 m, tileable): paved edge, then the theme's cover. */
export function buildShoulder(theme: Theme, l: LightingState, scale: number): HTMLCanvasElement {
  const s = SURFACES[theme];
  const W = Math.round(512 * scale);
  const H = Math.round(256 * scale);
  const [c, ctx] = canvas(W, H);
  const rng = new Prng(303);
  const edge = H * 0.08;
  const g = ctx.createLinearGradient(0, edge, 0, H);
  g.addColorStop(0, lit(s.ground, l));
  g.addColorStop(1, lit(shade(s.ground, -0.4), l));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (s.cover === 'grass') {
    for (let i = 0; i < 2600 * scale; i++) {
      const x = rng.next() * W;
      const y = edge + rng.next() * (H - edge);
      const k = y / H;
      const len = (3 + rng.next() * 7) * (0.5 + k) * scale;
      ctx.strokeStyle = lit(mix(s.ground, rng.next() < 0.5 ? '#2f4f1f' : '#9fb85a', 0.25 + rng.next() * 0.35), l, 1 - k * 0.3);
      ctx.lineWidth = Math.max(1, scale);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng.next() - 0.5) * 4 * scale, y - len);
      ctx.stroke();
    }
  } else if (s.cover === 'sand') {
    for (let i = 0; i < 60; i++) {
      const y = edge + rng.next() * (H - edge);
      ctx.strokeStyle = `rgba(0,0,0,${(0.04 + rng.next() * 0.06).toFixed(3)})`;
      ctx.lineWidth = 1 + rng.next() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.3, y - 5, W * 0.6, y + 5, W, y);
      ctx.stroke();
    }
    for (let i = 0; i < 220 * scale; i++) {
      ctx.fillStyle = lit(rng.next() < 0.5 ? '#8f7650' : '#e6cc9c', l);
      ctx.fillRect(rng.next() * W, edge + rng.next() * (H - edge), 1 + rng.next() * 2.5, 1 + rng.next() * 1.5);
    }
  } else {
    // concrete apron: slabs, stains
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = Math.max(1, scale);
    for (let x = 0; x <= W; x += W / 2) {
      ctx.beginPath();
      ctx.moveTo(x, edge);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, H * 0.5);
    ctx.lineTo(W, H * 0.5);
    ctx.stroke();
    grain(ctx, rng, W, H, 1800 * scale * scale, 0.06);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(0,0,0,${(0.05 + rng.next() * 0.08).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(rng.next() * W, edge + rng.next() * (H - edge), 10 + rng.next() * 40, 3 + rng.next() * 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // paved edge with gravel
  ctx.fillStyle = lit(s.shoulder, l);
  ctx.fillRect(0, 0, W, edge);
  for (let i = 0; i < 500 * scale; i++) {
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.16)';
    ctx.fillRect(rng.next() * W, rng.next() * edge * 1.25, 1 + rng.next() * 2, 1);
  }
  const sg = ctx.createLinearGradient(0, 0, 0, edge * 0.5);
  sg.addColorStop(0, 'rgba(0,0,0,0.35)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, edge * 0.5);
  return c;
}

/** Ground between the far wall and the horizon (stretched; fades into the haze with distance). */
export function buildField(theme: Theme, l: LightingState): HTMLCanvasElement {
  const s = SURFACES[theme];
  const [c, ctx] = canvas(256, 128);
  const rng = new Prng(77);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, litFar(s.ground, l, 0.85));
  g.addColorStop(1, litFar(s.ground, l, 0.15));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 70; i++) {
    const y = rng.next() * 128;
    ctx.fillStyle = rng.next() < 0.5 ? `rgba(0,0,0,${(0.03 + 0.05 * (y / 128)).toFixed(3)})` : `rgba(255,255,255,${(0.02 + 0.03 * (y / 128)).toFixed(3)})`;
    ctx.fillRect(0, y, 256, 1 + (y / 128) * 2);
  }
  return c;
}

/** Out-of-focus foreground strip in front of the camera (tileable). */
export function buildForeground(theme: Theme, l: LightingState, scale: number): HTMLCanvasElement {
  const s = SURFACES[theme];
  const W = Math.round(2048 * scale);
  const H = Math.round(200 * scale);
  const [c, ctx] = canvas(W, H);
  const rng = new Prng(808);
  const [tmp, t] = canvas(W, H);
  const dark = lit(shade(s.ground, -0.62), l);
  t.fillStyle = dark;
  // uneven ground line
  t.beginPath();
  t.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) t.lineTo(x, H * (0.72 + 0.08 * Math.sin((x / W) * Math.PI * 6) + 0.05 * Math.sin((x / W) * Math.PI * 14)));
  t.lineTo(W, H);
  t.fill();
  const items = Math.round(26 * scale + 10);
  for (let i = 0; i < items; i++) {
    const x = W * 0.05 + rng.next() * W * 0.9;
    const base = H * 0.8;
    if (s.cover === 'grass') {
      // clump of tall grass
      t.strokeStyle = dark;
      for (let k = 0; k < 16; k++) {
        t.lineWidth = (2 + rng.next() * 3) * scale;
        t.beginPath();
        t.moveTo(x + (rng.next() - 0.5) * 60 * scale, base + 20);
        t.quadraticCurveTo(x + (rng.next() - 0.5) * 50 * scale, base - 40 * scale, x + (rng.next() - 0.5) * 90 * scale, base - (50 + rng.next() * 90) * scale);
        t.stroke();
      }
    } else if (s.cover === 'sand') {
      t.fillStyle = dark;
      t.beginPath();
      t.ellipse(x, base + 10, (30 + rng.next() * 60) * scale, (14 + rng.next() * 26) * scale, 0, Math.PI, 0);
      t.fill();
      if (rng.next() < 0.5) {
        t.strokeStyle = dark;
        t.lineWidth = 3 * scale;
        for (let k = 0; k < 7; k++) {
          t.beginPath();
          t.moveTo(x, base);
          t.lineTo(x + (rng.next() - 0.5) * 70 * scale, base - (30 + rng.next() * 60) * scale);
          t.stroke();
        }
      }
    } else {
      // bollards and low barriers
      t.fillStyle = dark;
      const w = (14 + rng.next() * 12) * scale;
      t.fillRect(x, base - 70 * scale, w, 90 * scale);
      if (rng.next() < 0.5) t.fillRect(x - 60 * scale, base - 22 * scale, 150 * scale, 12 * scale);
    }
  }
  // the lens is focused on the cars: blur whatever is this close
  if ('filter' in ctx) ctx.filter = `blur(${Math.max(1, Math.round(3 * scale))}px)`;
  ctx.drawImage(tmp, 0, 0);
  ctx.filter = 'none';
  return c;
}

// ---------------------------------------------------------------------------------- props

export type PropKind = 'grandstand' | 'pit' | 'tower' | 'lamp' | 'sign' | 'board' | 'tree' | 'cactus' | 'windsock' | 'tyrewall' | 'banner' | 'timing' | 'hangar';

export interface PropOptions {
  variant?: number;
  label?: string;
}

const SIGN_TEXTS = ['DRAG STRIP', 'PIT LANE', 'ÁGUA 2 KM', 'COMBUSTÍVEL', 'SAÍDA'];
const SIGN_COLORS = ['#b8322a', '#1f6fb2', '#2e7d32', '#d09400', '#6a1b9a'];

/** Atmospheric perspective for structures behind the wall. */
function hazeOver(ctx: CanvasRenderingContext2D, w: number, h: number, l: LightingState, amount: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = amount * l.hazeAmount;
  ctx.fillStyle = l.haze;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

/** Trackside structure at `ppm` px per metre. The bottom centre of the texture stands on the ground. */
export function buildProp(kind: PropKind, _theme: Theme, l: LightingState, ppm: number, opt: PropOptions = {}): HTMLCanvasElement {
  const variant = opt.variant ?? 0;
  const rng = new Prng(31 + variant * 17 + kind.length * 7);
  const m = (v: number): number => v * ppm;
  const night = l.time === 'night';
  // structures near the floodlights stay readable at night
  const k = night ? 1.25 : 1;
  const L = (color: string, extra = 1): string => lit(color, l, k * extra);
  switch (kind) {
    case 'grandstand': {
      const W = m(30);
      const H = m(7.6);
      const [c, ctx] = canvas(W, H);
      const top = m(2.2);
      const rows = 7;
      const rowH = (H - top - m(0.5)) / rows;
      // back wall and side frames
      ctx.fillStyle = vgrad(ctx, m(1), H, L('#59626b'), L('#3b434b'));
      ctx.fillRect(m(0.4), m(1.2), W - m(0.8), H - m(1.2));
      // terraces with seats and spectators
      const seatColors = ['#2f6fb2', '#b8322a', '#2f6fb2', '#d0a020'];
      const clothes = ['#b5544a', '#3f6f9a', '#d9d4c7', '#4f7a4a', '#c9a23f', '#5b5f66', '#8c5b8f', '#e08a3c'];
      const skin = ['#e0b896', '#b9845c', '#8a5a3c', '#f0cdb0'];
      for (let row = 0; row < rows; row++) {
        const y = top + row * rowH;
        ctx.fillStyle = L(row % 2 ? '#8a9299' : '#959da4');
        ctx.fillRect(m(0.6), y, W - m(1.2), rowH + 1);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(m(0.6), y + rowH - m(0.06), W - m(1.2), m(0.06));
        const baseY = y + rowH - m(0.06);
        for (let x = m(0.9); x < W - m(0.9); x += m(0.5)) {
          // aisle stairs
          const aisle = Math.abs(((x / m(1)) % 7.5) - 3.75) < 0.35;
          if (aisle) continue;
          ctx.fillStyle = L(seatColors[Math.floor(x / m(7.5)) % seatColors.length]!, 0.9);
          ctx.fillRect(x, baseY - m(0.34), m(0.4), m(0.3));
          if (rng.next() < 0.58) {
            ctx.fillStyle = L(clothes[Math.floor(rng.next() * clothes.length)]!);
            ctx.beginPath();
            ctx.ellipse(x + m(0.2), baseY - m(0.24), m(0.19), m(0.25), 0, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(x + m(0.01), baseY - m(0.24), m(0.38), m(0.22));
            ctx.fillStyle = L(skin[Math.floor(rng.next() * skin.length)]!);
            ctx.beginPath();
            ctx.arc(x + m(0.2), baseY - m(0.56), m(0.105), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // front parapet with a banner
      ctx.fillStyle = L('#d9dcdf');
      ctx.fillRect(m(0.4), H - m(0.95), W - m(0.8), m(0.95));
      ctx.fillStyle = L(SIGN_COLORS[variant % SIGN_COLORS.length]!);
      ctx.fillRect(m(2), H - m(0.8), W - m(4), m(0.55));
      ctx.fillStyle = L('#ffffff');
      ctx.font = `bold ${m(0.36)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      for (let x = m(5); x < W - m(3); x += m(10)) ctx.fillText('DRAG PHYSICS', x, H - m(0.4));
      // roof with truss on columns
      ctx.fillStyle = L('#e6e9ec');
      ctx.fillRect(0, m(0.55), W, m(0.3));
      ctx.fillStyle = L('#b9c0c6');
      ctx.fillRect(0, m(0.85), W, m(0.12));
      ctx.strokeStyle = L('#8d959c');
      ctx.lineWidth = Math.max(1, m(0.05));
      ctx.beginPath();
      for (let x = 0; x < W; x += m(1.5)) {
        ctx.moveTo(x, m(0.97));
        ctx.lineTo(x + m(0.75), m(1.5));
        ctx.lineTo(x + m(1.5), m(0.97));
      }
      ctx.moveTo(0, m(1.5));
      ctx.lineTo(W, m(1.5));
      ctx.stroke();
      ctx.fillStyle = L('#9aa2a8');
      for (let x = m(1.2); x < W; x += m(7.5)) ctx.fillRect(x, m(0.95), m(0.16), H - m(0.95));
      if (l.trackLamps) {
        for (let x = m(2); x < W; x += m(5)) {
          const g = ctx.createRadialGradient(x, m(1.55), 1, x, m(1.55), m(1.6));
          g.addColorStop(0, 'rgba(255,240,190,0.85)');
          g.addColorStop(1, 'rgba(255,240,190,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - m(1.6), 0, m(3.2), m(3.2));
        }
      }
      hazeOver(ctx, W, H, l, 0.3);
      return c;
    }
    case 'pit': {
      const W = m(28);
      const H = m(7);
      const [c, ctx] = canvas(W, H);
      ctx.fillStyle = vgrad(ctx, 0, H, L('#c7ccd0'), L('#a3a9ae'));
      ctx.fillRect(0, m(0.9), W, H - m(0.9));
      // upper floor: glazed control room with a balcony
      ctx.fillStyle = vgrad(ctx, m(1.3), m(3.1), night || l.trackLamps ? '#f2d58a' : L('#3d5566'), night || l.trackLamps ? '#b98a3c' : L('#22323d'));
      ctx.fillRect(m(0.5), m(1.3), W - m(1), m(1.75));
      ctx.fillStyle = L('#e9ecee');
      for (let x = m(0.5); x < W - m(0.5); x += m(1.85)) ctx.fillRect(x, m(1.3), m(0.1), m(1.75));
      ctx.fillStyle = L('#7d858c');
      ctx.fillRect(0, m(3.15), W, m(0.14));
      for (let x = 0; x < W; x += m(0.45)) ctx.fillRect(x, m(2.75), m(0.04), m(0.4));
      ctx.fillRect(0, m(2.72), W, m(0.05));
      // garages
      for (let i = 0; i < 5; i++) {
        const x = m(0.8) + i * m(5.4);
        ctx.fillStyle = vgrad(ctx, m(3.7), H, L('#20262c'), L('#0e1114'));
        ctx.fillRect(x, m(3.7), m(4.5), H - m(3.7));
        // half-raised shutter, tool chest and a jack stand inside
        ctx.fillStyle = L('#aeb5bb');
        for (let y = m(3.7); y < m(4.5); y += m(0.14)) ctx.fillRect(x, y, m(4.5), m(0.1));
        ctx.fillStyle = L('#b8322a', 0.8);
        ctx.fillRect(x + m(0.5), H - m(1.1), m(1), m(1.1));
        ctx.fillStyle = L('#d9dcdf', 0.6);
        ctx.fillRect(x + m(2.4), H - m(0.7), m(1.4), m(0.7));
        if (night || l.trackLamps) {
          ctx.fillStyle = 'rgba(255,225,150,0.2)';
          ctx.fillRect(x, m(4.5), m(4.5), H - m(4.5));
        }
        ctx.fillStyle = L('#f2b705');
        ctx.font = `bold ${m(0.6)}px system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(String(i + 1), x + m(0.25), m(3.62));
      }
      // roof edge and equipment
      ctx.fillStyle = L('#eef0f2');
      ctx.fillRect(0, m(0.75), W, m(0.35));
      ctx.fillStyle = L('#8d959c');
      ctx.fillRect(m(3), m(0.2), m(1.6), m(0.55));
      ctx.fillRect(m(19), m(0.3), m(2.2), m(0.45));
      ctx.fillRect(m(12), 0, m(0.08), m(0.75));
      hazeOver(ctx, W, H, l, 0.24);
      return c;
    }
    case 'hangar': {
      const W = m(34);
      const H = m(11);
      const [c, ctx] = canvas(W, H);
      ctx.fillStyle = vgrad(ctx, 0, H, L('#c3c9cd'), L('#8d959b'));
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, m(5));
      ctx.quadraticCurveTo(W / 2, -m(3.4), W, m(5));
      ctx.lineTo(W, H);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.13)';
      ctx.lineWidth = Math.max(1, m(0.04));
      for (let x = m(1); x < W; x += m(1.1)) {
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x, m(5) - Math.sin((x / W) * Math.PI) * m(4));
        ctx.stroke();
      }
      ctx.fillStyle = vgrad(ctx, m(4.4), H, L('#27313a'), L('#12171c'));
      ctx.fillRect(m(6), m(4.4), W - m(12), H - m(4.4));
      ctx.fillStyle = L('#aab1b7');
      for (let x = m(6); x < W - m(6); x += m(5.5)) ctx.fillRect(x, m(4.4), m(0.12), H - m(4.4));
      hazeOver(ctx, W, H, l, 0.34);
      return c;
    }
    case 'tower': {
      const W = m(9);
      const H = m(24);
      const [c, ctx] = canvas(W, H);
      const cx = W / 2;
      ctx.fillStyle = vgrad(ctx, m(5), H, L('#b4bbc1'), L('#8c949a'));
      ctx.fillRect(cx - m(1.3), m(5.5), m(2.6), H - m(5.5));
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(cx + m(0.5), m(5.5), m(0.8), H - m(5.5));
      ctx.fillStyle = L('#2b3a46');
      for (let y = m(8); y < H - m(2); y += m(3)) ctx.fillRect(cx - m(0.45), y, m(0.9), m(1.2));
      // cab with slanted glass
      ctx.fillStyle = L('#9aa3a9');
      ctx.beginPath();
      ctx.moveTo(cx - m(3.1), m(5.6));
      ctx.lineTo(cx + m(3.1), m(5.6));
      ctx.lineTo(cx + m(3.9), m(2.9));
      ctx.lineTo(cx - m(3.9), m(2.9));
      ctx.fill();
      ctx.fillStyle = vgrad(ctx, m(3.1), m(4.7), l.trackLamps ? '#e9cf8c' : L('#7fa5bd'), l.trackLamps ? '#9a7a3a' : L('#2d4756'));
      ctx.beginPath();
      ctx.moveTo(cx - m(3.2), m(4.8));
      ctx.lineTo(cx + m(3.2), m(4.8));
      ctx.lineTo(cx + m(3.7), m(3.1));
      ctx.lineTo(cx - m(3.7), m(3.1));
      ctx.fill();
      ctx.fillStyle = L('#dfe3e6');
      for (let x = -3; x <= 3; x++) ctx.fillRect(cx + m(x * 1.05) - m(0.05), m(3.1), m(0.1), m(1.7));
      ctx.fillRect(cx - m(4.1), m(2.6), m(8.2), m(0.35));
      ctx.fillStyle = L('#c0392b');
      ctx.fillRect(cx - m(0.06), 0, m(0.12), m(2.6));
      ctx.fillStyle = l.trackLamps ? '#ff4b3a' : L('#c0392b');
      ctx.beginPath();
      ctx.arc(cx, m(0.2), m(0.18), 0, Math.PI * 2);
      ctx.fill();
      hazeOver(ctx, W, H, l, 0.24);
      return c;
    }
    case 'lamp': {
      const W = m(4);
      const H = m(12);
      const [c, ctx] = canvas(W, H);
      const cx = W / 2;
      ctx.fillStyle = vgrad(ctx, 0, H, L('#59616b'), L('#3a414a'));
      ctx.beginPath();
      ctx.moveTo(cx - m(0.07), m(1));
      ctx.lineTo(cx + m(0.07), m(1));
      ctx.lineTo(cx + m(0.14), H);
      ctx.lineTo(cx - m(0.14), H);
      ctx.fill();
      ctx.fillStyle = L('#3a414a');
      ctx.fillRect(cx - m(1.15), m(0.85), m(2.3), m(0.12));
      for (const dx of [-0.95, -0.35, 0.35, 0.95]) {
        ctx.fillStyle = L('#2c323a');
        ctx.fillRect(cx + m(dx) - m(0.24), m(0.45), m(0.48), m(0.4));
        ctx.fillStyle = l.trackLamps ? '#fff6d8' : L('#d7dadd');
        ctx.fillRect(cx + m(dx) - m(0.2), m(0.62), m(0.4), m(0.2));
      }
      if (l.trackLamps) {
        const g = ctx.createRadialGradient(cx, m(0.75), 1, cx, m(0.75), m(1.9));
        g.addColorStop(0, 'rgba(255,240,185,0.75)');
        g.addColorStop(1, 'rgba(255,240,185,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, m(2.8));
      }
      return c;
    }
    case 'sign': {
      const W = m(7);
      const H = m(6);
      const [c, ctx] = canvas(W, H);
      ctx.fillStyle = L('#5b6068');
      ctx.fillRect(m(1.2), m(2.6), m(0.2), H);
      ctx.fillRect(W - m(1.4), m(2.6), m(0.2), H);
      ctx.strokeStyle = L('#5b6068');
      ctx.lineWidth = Math.max(1, m(0.05));
      ctx.beginPath();
      ctx.moveTo(m(1.3), m(3.2));
      ctx.lineTo(W - m(1.3), m(4.6));
      ctx.moveTo(W - m(1.3), m(3.2));
      ctx.lineTo(m(1.3), m(4.6));
      ctx.stroke();
      ctx.fillStyle = vgrad(ctx, 0, m(2.8), L(SIGN_COLORS[variant % SIGN_COLORS.length]!, night ? 1.3 : 1), L(shade(SIGN_COLORS[variant % SIGN_COLORS.length]!, -0.25), night ? 1.3 : 1));
      ctx.fillRect(0, 0, W, m(2.8));
      ctx.strokeStyle = L('#f4f4f0');
      ctx.lineWidth = Math.max(1, m(0.07));
      ctx.strokeRect(m(0.15), m(0.15), W - m(0.3), m(2.5));
      ctx.fillStyle = L('#ffffff', night ? 1.4 : 1);
      ctx.font = `bold ${m(0.8)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(SIGN_TEXTS[variant % SIGN_TEXTS.length]!, W / 2, m(1.7));
      return c;
    }
    case 'board': {
      // distance marker: board on a post with the split's label
      const W = m(2.6);
      const H = m(3.3);
      const [c, ctx] = canvas(W, H);
      ctx.fillStyle = L('#6b7178');
      ctx.fillRect(W / 2 - m(0.05), m(0.9), m(0.1), H);
      ctx.fillStyle = L('#14181c', night ? 1.5 : 1);
      ctx.beginPath();
      ctx.roundRect(0, 0, W, m(0.95), m(0.08));
      ctx.fill();
      ctx.strokeStyle = L('#f2b705', night ? 1.5 : 1);
      ctx.lineWidth = Math.max(1, m(0.05));
      ctx.beginPath();
      ctx.roundRect(m(0.06), m(0.06), W - m(0.12), m(0.83), m(0.06));
      ctx.stroke();
      ctx.fillStyle = L('#ffffff', night ? 1.6 : 1);
      ctx.font = `bold ${m(0.48)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opt.label ?? '', W / 2, m(0.5), W - m(0.3));
      return c;
    }
    case 'tree': {
      // starting-line "Christmas tree": pole and housing with dark lenses (the lit bulbs are drawn live)
      const W = m(1.5);
      const H = m(5.2);
      const [c, ctx] = canvas(W, H);
      const cx = W / 2;
      ctx.fillStyle = vgrad(ctx, m(3.4), H, L('#4a5058', 1.2), L('#2b3036', 1.2));
      ctx.fillRect(cx - m(0.07), m(3.3), m(0.14), H - m(3.3));
      ctx.fillStyle = L('#3a4047', 1.2);
      ctx.fillRect(cx - m(0.35), H - m(0.12), m(0.7), m(0.12));
      ctx.fillStyle = L('#16191d', 1.3);
      ctx.beginPath();
      ctx.roundRect(cx - m(0.55), m(0.05), m(1.1), m(3.35), m(0.1));
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(cx - m(0.55), m(0.05), m(0.08), m(3.35));
      for (const side of [-1, 1]) {
        for (let row = 0; row < 7; row++) {
          const bx = cx + side * m(0.27);
          const by = m(0.36) + row * m(0.44);
          const r = row < 2 ? m(0.1) : m(0.15);
          ctx.fillStyle = '#0a0b0d';
          ctx.beginPath();
          ctx.arc(bx, by, r * 1.18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#22262b';
          ctx.beginPath();
          ctx.arc(bx, by, r, 0, Math.PI * 2);
          ctx.fill();
          // sun shield
          ctx.fillStyle = '#0a0b0d';
          ctx.beginPath();
          ctx.ellipse(bx, by - r * 0.95, r * 1.25, r * 0.5, 0, Math.PI, 0);
          ctx.fill();
        }
      }
      return c;
    }
    case 'cactus': {
      const W = m(2.2);
      const H = m(3.4);
      const [c, ctx] = canvas(W, H);
      const arm = (x: number, y: number, w: number, h: number): void => {
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, L('#6f8f4f'));
        g.addColorStop(0.5, L('#4f6b3a'));
        g.addColorStop(1, L('#2f4526'));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, w / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x + (w * i) / 4, y + w / 2);
          ctx.lineTo(x + (w * i) / 4, y + h);
          ctx.stroke();
        }
      };
      arm(m(0.85), m(0.2 + (variant % 3) * 0.2), m(0.45), H);
      arm(m(0.25), m(1.1), m(0.32), m(1.2));
      ctx.fillStyle = L('#4f6b3a');
      ctx.fillRect(m(0.4), m(2.05), m(0.6), m(0.26));
      if (variant !== 1) {
        arm(m(1.55), m(0.8), m(0.32), m(1.1));
        ctx.fillStyle = L('#4f6b3a');
        ctx.fillRect(m(1.2), m(1.65), m(0.55), m(0.26));
      }
      return c;
    }
    case 'windsock': {
      const [c, ctx] = canvas(m(4.4), m(7));
      ctx.fillStyle = L('#aab2b8');
      ctx.fillRect(m(0.3), m(0.4), m(0.12), m(6.6));
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = L(i % 2 ? '#ffffff' : '#e8590c');
        ctx.beginPath();
        ctx.moveTo(m(0.42) + i * m(0.72), m(0.5) + i * m(0.07));
        ctx.lineTo(m(0.42) + (i + 1) * m(0.72), m(0.57) + i * m(0.07));
        ctx.lineTo(m(0.42) + (i + 1) * m(0.72), m(1.13) - i * m(0.05));
        ctx.lineTo(m(0.42) + i * m(0.72), m(1.2) - i * m(0.05));
        ctx.fill();
      }
      return c;
    }
    case 'tyrewall': {
      // stacked tyres protecting the catch wall at the end of the track
      const W = m(1.4);
      const H = m(4.2);
      const [c, ctx] = canvas(W, H);
      for (let row = 0; row < 12; row++) {
        const y = H - (row + 1) * m(0.34);
        ctx.fillStyle = L(row % 3 === 1 ? '#f1f1ec' : '#17181a', 1.2);
        ctx.beginPath();
        ctx.roundRect(m(0.1) + (row % 2) * m(0.12), y, m(1.05), m(0.32), m(0.14));
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(m(0.2) + (row % 2) * m(0.12), y + m(0.05), m(0.85), m(0.04));
      }
      return c;
    }
    case 'banner': {
      // finish-line banner fixed to the wall
      const W = m(9);
      const H = m(3.4);
      const [c, ctx] = canvas(W, H);
      ctx.fillStyle = L('#5b6068');
      ctx.fillRect(m(0.3), 0, m(0.14), H);
      ctx.fillRect(W - m(0.44), 0, m(0.14), H);
      const sq = m(0.3);
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < W / sq; i++) {
          ctx.fillStyle = L((row + i) % 2 ? '#111316' : '#f4f4f0', night ? 1.4 : 1);
          ctx.fillRect(i * sq, m(0.1) + row * sq, sq, sq);
        }
      }
      ctx.fillStyle = L('#14181c', night ? 1.4 : 1);
      ctx.fillRect(0, m(0.1) + 2 * sq, W, m(1.15));
      ctx.fillStyle = L('#ffffff', night ? 1.6 : 1);
      ctx.font = `bold ${m(0.8)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opt.label ?? 'CHEGADA', W / 2, m(0.1) + 2 * sq + m(0.6));
      return c;
    }
    case 'timing': {
      // timing beam emitter: a small weatherproof box on a short stand
      const [c, ctx] = canvas(m(0.34), m(0.4));
      ctx.fillStyle = L('#3a3f45', 1.3);
      ctx.fillRect(m(0.14), m(0.2), m(0.06), m(0.2));
      ctx.fillRect(m(0.07), m(0.36), m(0.2), m(0.04));
      ctx.fillStyle = L('#23272b', 1.3);
      ctx.beginPath();
      ctx.roundRect(m(0.04), m(0.02), m(0.26), m(0.2), m(0.03));
      ctx.fill();
      ctx.fillStyle = L('#f2b705', 1.3);
      ctx.fillRect(m(0.04), m(0.02), m(0.26), m(0.035));
      ctx.fillStyle = '#7a1414';
      ctx.beginPath();
      ctx.arc(m(0.17), m(0.13), m(0.04), 0, Math.PI * 2);
      ctx.fill();
      return c;
    }
  }
}
