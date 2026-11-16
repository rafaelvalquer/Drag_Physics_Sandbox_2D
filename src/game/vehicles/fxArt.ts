import { Prng } from '../../core/prng';

/**
 * Effects atlas: every particle and light sprite on one texture (one draw batch).
 * Original procedural artwork, deterministic.
 */
export type FxFrame = 'smoke' | 'speck' | 'flame' | 'skid' | 'glow' | 'beam' | 'pool';

export interface FxAtlas {
  canvas: HTMLCanvasElement;
  frames: Record<FxFrame, { x: number; y: number; w: number; h: number }>;
}

export function buildFxAtlas(): FxAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const rng = new Prng(4711);
  const frames: FxAtlas['frames'] = {
    smoke: { x: 2, y: 2, w: 128, h: 128 },
    glow: { x: 134, y: 2, w: 128, h: 128 },
    beam: { x: 2, y: 134, w: 320, h: 128 },
    pool: { x: 2, y: 266, w: 320, h: 96 },
    flame: { x: 266, y: 2, w: 96, h: 48 },
    skid: { x: 266, y: 54, w: 128, h: 20 },
    speck: { x: 266, y: 78, w: 12, h: 12 },
  };

  // smoke: a lumpy soft puff (several overlapping soft blobs)
  {
    const f = frames.smoke;
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    for (let i = 0; i < 14; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = rng.next() * 22;
      const r = 26 + rng.next() * 20;
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.2)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.09)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.x, f.y, f.w, f.h);
    }
  }
  // glow: plain radial falloff
  {
    const f = frames.glow;
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, f.w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(f.x, f.y, f.w, f.h);
  }
  // beam: a cone opening to the right from its apex on the left edge
  {
    const f = frames.beam;
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.clip();
    const cy = f.y + f.h / 2;
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const spread = (f.h / 2) * (0.1 + 0.9 * t);
      const x0 = f.x + t * f.w * 0.94;
      const g = ctx.createLinearGradient(0, cy - spread, 0, cy + spread);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${(0.085 * (1 - t) ** 1.3).toFixed(4)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, cy - spread, f.w * 0.08, spread * 2);
    }
    ctx.restore();
  }
  // pool: elliptical light on the ground
  {
    const f = frames.pool;
    ctx.save();
    ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
    ctx.scale(1, f.h / f.w);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, f.w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.24)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, f.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // flame: hot core on the right (at the pipe), tongue trailing to the left
  {
    const f = frames.flame;
    const g = ctx.createRadialGradient(f.x + f.w * 0.8, f.y + f.h / 2, 1, f.x + f.w * 0.55, f.y + f.h / 2, f.w * 0.55);
    g.addColorStop(0, 'rgba(255,255,235,1)');
    g.addColorStop(0.25, 'rgba(255,214,110,0.95)');
    g.addColorStop(0.6, 'rgba(255,110,30,0.55)');
    g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(f.x + f.w * 0.52, f.y + f.h / 2, f.w * 0.48, f.h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // skid: soft-edged rubber streak with uneven density
  {
    const f = frames.skid;
    for (let x = 0; x < f.w; x += 2) {
      const dens = 0.55 + rng.next() * 0.45;
      const g = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
      g.addColorStop(0, 'rgba(8,8,8,0)');
      g.addColorStop(0.3, `rgba(8,8,8,${(0.85 * dens).toFixed(3)})`);
      g.addColorStop(0.7, `rgba(8,8,8,${(0.85 * dens).toFixed(3)})`);
      g.addColorStop(1, 'rgba(8,8,8,0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.x + x, f.y, 2, f.h);
    }
  }
  // speck: a small rubber crumb
  {
    const f = frames.speck;
    ctx.fillStyle = 'rgba(14,14,14,0.95)';
    ctx.beginPath();
    ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas, frames };
}
