import type { TrackConfig } from '../../data/schema';
import { Prng } from '../../core/prng';

/** Procedural track scenery (canvas textures). Original artwork, deterministic per theme. */
export interface ThemePalette {
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  near: string;
  ground: string;
  asphalt: string;
  line: string;
  night: boolean;
}

export const THEMES: Record<TrackConfig['theme'], ThemePalette> = {
  testTrack: { skyTop: '#5f9fd8', skyBottom: '#cfe6f5', far: '#93a9b8', mid: '#6f8a62', near: '#4e6b43', ground: '#5d7a45', asphalt: '#3a3d40', line: '#e8e8e0', night: false },
  desert: { skyTop: '#e9a25b', skyBottom: '#f8dfb2', far: '#c58b5c', mid: '#d6a26b', near: '#c08752', ground: '#d9b07a', asphalt: '#4a4440', line: '#f2efe2', night: false },
  nightIndustrial: { skyTop: '#05070d', skyBottom: '#1b2333', far: '#141a26', mid: '#1d2533', near: '#232c3b', ground: '#1a1e24', asphalt: '#2a2d31', line: '#d6d3b8', night: true },
  airfield: { skyTop: '#7fb2e0', skyBottom: '#e3eef5', far: '#a7b6bf', mid: '#8c9a7d', near: '#6e8061', ground: '#7b8c62', asphalt: '#45484b', line: '#f4f4ee', night: false },
};

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

/** Far / mid / near parallax strips (tileable horizontally). */
export function buildParallax(theme: TrackConfig['theme'], layer: 0 | 1 | 2, width = 1024, height = 256): HTMLCanvasElement {
  const p = THEMES[theme];
  const [c, ctx] = canvas(width, height);
  const rng = new Prng(17 + layer * 101 + theme.length * 7);
  const col = [p.far, p.mid, p.near][layer]!;
  ctx.fillStyle = col;
  if (theme === 'testTrack' || theme === 'airfield') {
    // rolling hills / tree line
    ctx.beginPath();
    ctx.moveTo(0, height);
    const base = height * (0.45 + layer * 0.15);
    for (let x = 0; x <= width; x += 8) {
      const y = base - Math.sin((x / width) * Math.PI * 2 * (layer + 1)) * 18 - Math.sin((x / width) * Math.PI * 6) * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.fill();
    if (layer === 2) {
      for (let i = 0; i < 26; i++) {
        const x = rng.next() * width;
        const s = 10 + rng.next() * 18;
        ctx.fillStyle = theme === 'airfield' ? '#5d6b52' : '#3f5a36';
        ctx.beginPath();
        ctx.arc(x, base - s * 0.6, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (theme === 'airfield' && layer === 1) {
      // hangars
      ctx.fillStyle = '#8a949b';
      for (let i = 0; i < 3; i++) {
        const x = 120 + i * 330;
        ctx.beginPath();
        ctx.moveTo(x, base + 4);
        ctx.quadraticCurveTo(x + 80, base - 70, x + 160, base + 4);
        ctx.fill();
        ctx.fillStyle = '#6c757b';
        ctx.fillRect(x + 50, base - 22, 60, 26);
        ctx.fillStyle = '#8a949b';
      }
    }
  } else if (theme === 'desert') {
    ctx.beginPath();
    ctx.moveTo(0, height);
    const base = height * (0.5 + layer * 0.14);
    for (let x = 0; x <= width; x += 8) {
      const y = base - (layer === 0 ? Math.abs(Math.sin((x / width) * Math.PI * 3)) * 60 : Math.sin((x / width) * Math.PI * 4 + layer) * 14);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.fill();
    if (layer === 2) {
      ctx.fillStyle = '#4f6b3a';
      for (let i = 0; i < 8; i++) {
        const x = rng.next() * width;
        ctx.fillRect(x, base - 34, 6, 34);
        ctx.fillRect(x - 10, base - 24, 10, 5);
        ctx.fillRect(x - 10, base - 34, 5, 12);
        ctx.fillRect(x + 6, base - 20, 10, 5);
        ctx.fillRect(x + 11, base - 30, 5, 12);
      }
    }
  } else {
    // industrial skyline with lit windows
    const base = height * (0.4 + layer * 0.18);
    let x = 0;
    while (x < width) {
      const w = 40 + rng.next() * 90;
      const hgt = 40 + rng.next() * (layer === 0 ? 150 : 90);
      ctx.fillStyle = col;
      ctx.fillRect(x, base - hgt, w, height - base + hgt);
      if (layer < 2) {
        for (let wy = base - hgt + 8; wy < base - 6; wy += 12) {
          for (let wx = x + 6; wx < x + w - 6; wx += 10) {
            if (rng.next() < 0.28) {
              ctx.fillStyle = rng.next() < 0.5 ? '#e8c46a' : '#9fc8e8';
              ctx.fillRect(wx, wy, 4, 5);
            }
          }
        }
      }
      if (layer === 0 && rng.next() < 0.3) {
        ctx.fillStyle = col;
        ctx.fillRect(x + w * 0.4, base - hgt - 50, 8, 50);
      }
      x += w + rng.next() * 20;
    }
    if (layer === 2) {
      // light poles
      for (let i = 0; i < 4; i++) {
        const px = 60 + i * 250;
        ctx.fillStyle = '#3a414d';
        ctx.fillRect(px, base - 120, 5, 120 + height);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(px - 10, base - 124, 25, 6);
      }
    }
  }
  return c;
}

/** Asphalt strip with lane separation (tileable). Height covers both lanes. */
export function buildAsphalt(theme: TrackConfig['theme'], width = 512, height = 120): HTMLCanvasElement {
  const p = THEMES[theme];
  const [c, ctx] = canvas(width, height);
  ctx.fillStyle = p.asphalt;
  ctx.fillRect(0, 0, width, height);
  const rng = new Prng(99);
  for (let i = 0; i < 2600; i++) {
    const v = rng.next();
    ctx.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(rng.next() * width, rng.next() * height, 2, 2);
  }
  // rubber laid down in the launch area is drawn by the scene; here: edges and centre line
  ctx.fillStyle = p.line;
  ctx.fillRect(0, 0, width, 3);
  ctx.fillRect(0, height - 3, width, 3);
  ctx.globalAlpha = 0.8;
  for (let x = 0; x < width; x += 64) ctx.fillRect(x, height * 0.5 - 1.5, 36, 3);
  ctx.globalAlpha = 1;
  return c;
}

/** Trackside props placed in world space (pixels at `ppm` px per metre). Original artwork. */
export type PropKind = 'barrier' | 'grandstand' | 'pitbox' | 'lamp' | 'sign' | 'tower' | 'cactus' | 'windsock';

export function buildProp(kind: PropKind, theme: TrackConfig['theme'], ppm: number, variant = 0): HTMLCanvasElement {
  const p = THEMES[theme];
  const rng = new Prng(31 + variant * 17 + kind.length);
  const m = (v: number): number => Math.round(v * ppm);
  switch (kind) {
    case 'barrier': {
      // concrete jersey barrier with a debris fence – tileable, 8 m long
      const [c, ctx] = canvas(m(8), m(2.4));
      const wallTop = m(1.6);
      ctx.strokeStyle = p.night ? '#3a4150' : '#8a949c';
      ctx.lineWidth = 1;
      for (let x = 0; x <= m(8); x += m(2)) {
        ctx.fillStyle = p.night ? '#2d333d' : '#6f777e';
        ctx.fillRect(x, 0, 3, wallTop);
      }
      for (let y = 4; y < wallTop; y += 7) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(m(8), y);
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = p.night ? '#4a505a' : '#c9c6bd';
      ctx.fillRect(0, wallTop, m(8), m(0.8));
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, wallTop + m(0.55), m(8), m(0.25));
      for (let x = 0; x < m(8); x += m(4)) {
        ctx.fillStyle = theme === 'desert' ? '#c0392b' : '#d9d9d9';
        ctx.fillRect(x, wallTop + m(0.08), m(2), m(0.14));
      }
      return c;
    }
    case 'grandstand': {
      const W = m(30);
      const H = m(6.4);
      const [c, ctx] = canvas(W, H);
      // stepped concrete terraces
      const rows = 6;
      const top = m(1.6);
      const rowH = (H - top) / rows;
      for (let row = 0; row < rows; row++) {
        const y = top + row * rowH;
        ctx.fillStyle = p.night ? (row % 2 ? '#1d232c' : '#222833') : row % 2 ? '#7c858c' : '#868f96';
        ctx.fillRect(m(0.6), y, W - m(1.2), rowH + 1);
      }
      // roof on thin columns
      ctx.fillStyle = p.night ? '#2f3744' : '#e3e7ea';
      ctx.fillRect(0, m(0.6), W, m(0.35));
      ctx.fillStyle = p.night ? '#3a4250' : '#9aa2a8';
      for (let x = m(1.2); x < W; x += m(7)) ctx.fillRect(x, m(0.95), m(0.14), H - m(0.95));
      // spectators: head + shoulders, muted clothing colours, seated on each terrace
      const palette = p.night ? ['#3a3f4a', '#4a3c3c', '#2f3c4a', '#45463a'] : ['#b5544a', '#3f6f9a', '#d9d4c7', '#4f7a4a', '#c9a23f', '#5b5f66', '#8c5b8f'];
      const skin = p.night ? ['#5a4a40', '#4a3c34'] : ['#e0b896', '#b9845c', '#8a5a3c', '#f0cdb0'];
      for (let row = 0; row < rows; row++) {
        const baseY = top + (row + 1) * rowH - m(0.05);
        for (let x = m(1.2) + rng.next() * m(0.4); x < W - m(1.2); x += m(0.52) + rng.next() * m(0.25)) {
          if (rng.next() > 0.62) continue;
          ctx.fillStyle = palette[Math.floor(rng.next() * palette.length)]!;
          ctx.beginPath();
          ctx.ellipse(x, baseY - m(0.2), m(0.19), m(0.22), 0, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(x - m(0.19), baseY - m(0.2), m(0.38), m(0.2));
          ctx.fillStyle = skin[Math.floor(rng.next() * skin.length)]!;
          ctx.beginPath();
          ctx.arc(x, baseY - m(0.52), m(0.11), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      haze(ctx, W, H, p, 0.22);
      return c;
    }
    case 'pitbox': {
      const W = m(28);
      const H = m(6);
      const [c, ctx] = canvas(W, H);
      ctx.fillStyle = p.night ? '#262c36' : '#b9bfc4';
      ctx.fillRect(0, m(1), W, H - m(1));
      ctx.fillStyle = p.night ? '#3a4352' : '#e9ecee';
      ctx.fillRect(0, 0, W, m(1.1));
      for (let i = 0; i < 5; i++) {
        const x = m(0.8) + i * m(5.4);
        ctx.fillStyle = p.night ? '#141820' : '#4a525a';
        ctx.fillRect(x, m(2), m(4.4), H - m(2));
        ctx.fillStyle = p.night ? 'rgba(255,220,140,0.55)' : 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + m(0.3), m(2.3), m(3.8), m(0.4));
        ctx.fillStyle = '#f2b705';
        ctx.font = `bold ${m(0.6)}px system-ui, sans-serif`;
        ctx.fillText(String(i + 1), x + m(0.3), m(0.85));
      }
      haze(ctx, W, H, p, 0.18);
      return c;
    }
    case 'lamp': {
      const W = m(3);
      const H = m(11);
      const [c, ctx] = canvas(W, H);
      ctx.fillStyle = '#3a414d';
      ctx.fillRect(W / 2 - m(0.1), m(0.6), m(0.2), H);
      ctx.fillRect(W / 2 - m(0.9), m(0.5), m(1.8), m(0.18));
      ctx.fillStyle = p.night ? '#fff1c0' : '#d7dadd';
      ctx.fillRect(W / 2 - m(1), m(0.62), m(0.6), m(0.14));
      ctx.fillRect(W / 2 + m(0.4), m(0.62), m(0.6), m(0.14));
      if (p.night) {
        const g = ctx.createRadialGradient(W / 2, m(0.8), 1, W / 2, m(0.8), m(1.4));
        g.addColorStop(0, 'rgba(255,236,170,0.55)');
        g.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, m(2.4));
      }
      return c;
    }
    case 'sign': {
      const W = m(7);
      const H = m(6);
      const [c, ctx] = canvas(W, H);
      ctx.fillStyle = '#4b4f55';
      ctx.fillRect(m(1.2), m(2.6), m(0.25), H);
      ctx.fillRect(W - m(1.45), m(2.6), m(0.25), H);
      const texts = ['DRAG STRIP', 'PIT LANE', 'ÁGUA 2 KM', 'COMBUSTÍVEL', 'SAÍDA'];
      const colors = ['#c0392b', '#1f6fb2', '#2e7d32', '#e0a100', '#6a1b9a'];
      ctx.fillStyle = colors[variant % colors.length]!;
      ctx.fillRect(0, 0, W, m(2.8));
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${m(0.8)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(texts[variant % texts.length]!, W / 2, m(1.7));
      if (p.night) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(0, 0, W, m(2.8));
      }
      return c;
    }
    case 'tower': {
      const W = m(8);
      const H = m(24);
      const [c, ctx] = canvas(W, H);
      ctx.fillStyle = '#9aa3a9';
      ctx.fillRect(W / 2 - m(1.2), m(5), m(2.4), H);
      ctx.fillStyle = '#7d868c';
      ctx.fillRect(W / 2 - m(3.5), m(2.5), m(7), m(2.8));
      ctx.fillStyle = '#2b3a46';
      ctx.fillRect(W / 2 - m(3.2), m(2.9), m(6.4), m(1.6));
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(W / 2 - m(0.1), 0, m(0.2), m(2.5));
      haze(ctx, W, H, p, 0.18);
      return c;
    }
    case 'cactus': {
      const [c, ctx] = canvas(m(2), m(3.2));
      ctx.fillStyle = '#4f6b3a';
      ctx.fillRect(m(0.8), m(0.3), m(0.4), m(2.9));
      ctx.fillRect(m(0.25), m(1.0), m(0.3), m(1.2));
      ctx.fillRect(m(0.25), m(2.0), m(0.7), m(0.25));
      ctx.fillRect(m(1.45), m(0.7), m(0.3), m(1.1));
      ctx.fillRect(m(1.1), m(1.6), m(0.6), m(0.25));
      return c;
    }
    case 'windsock': {
      const [c, ctx] = canvas(m(4), m(7));
      ctx.fillStyle = '#9aa3a9';
      ctx.fillRect(m(0.3), m(0.4), m(0.15), m(6.6));
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#ffffff' : '#e8590c';
        ctx.fillRect(m(0.45) + i * m(0.8), m(0.5) + i * m(0.08), m(0.8), m(0.7) - i * m(0.12));
      }
      return c;
    }
  }
}

/** Atmospheric perspective: tints the opaque pixels of a background prop towards the sky colour. */
function haze(ctx: CanvasRenderingContext2D, w: number, h: number, p: ThemePalette, amount: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = amount;
  ctx.fillStyle = p.skyBottom;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Soft round particle (smoke). */
export function buildPuff(size = 64): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(235,235,235,0.9)');
  g.addColorStop(0.6, 'rgba(210,210,210,0.35)');
  g.addColorStop(1, 'rgba(200,200,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** Exhaust flame flash. */
export function buildFlame(w = 64, h = 32): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createRadialGradient(w * 0.8, h / 2, 1, w * 0.8, h / 2, w * 0.8);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.3, 'rgba(255,190,60,0.9)');
  g.addColorStop(0.7, 'rgba(255,90,20,0.5)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h / 2, w * 0.5, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
