import type { AssetId } from './PartVisualRegistry';
import { drawEngineEndView, type EngineSpec } from './EngineDrawings';

/**
 * Procedural illustrations of the parts (Canvas 2D, no external assets): the four illustrated
 * families (wheels, tyres, exhaust, turbo) plus a drawing for every other family. All of them are
 * REPRESENTATIVE: the proportions are generic, never a real measurement of the part.
 */
const AMBER = '#ffcf8a';
const STEEL = '#8a94a2';
const DARK = '#1b1d21';
const GOLD = '#c9a24d';
const BLUE = '#6ab4ff';

export interface AssetOptions {
  engine?: EngineSpec;
  /** Highlight (glow) of the drawing. */
  glow?: boolean;
}

const circle = (c: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
};

function wheel(c: CanvasRenderingContext2D, r: number, sport: boolean): void {
  c.fillStyle = '#121316';
  c.strokeStyle = '#2c2e33';
  c.lineWidth = r * 0.05;
  circle(c, 0, 0, r);
  c.fill();
  c.stroke();
  c.fillStyle = sport ? '#d2d8df' : '#aab1ba';
  circle(c, 0, 0, r * 0.72);
  c.fill();
  c.fillStyle = '#2a2d33';
  const spokes = sport ? 6 : 5;
  for (let i = 0; i < spokes; i++) {
    c.save();
    c.rotate((i * Math.PI * 2) / spokes);
    c.beginPath();
    c.roundRect(-r * 0.07, -r * 0.68, r * 0.14, r * 0.42, r * 0.03);
    c.fill();
    c.restore();
  }
  c.fillStyle = '#383b42';
  circle(c, 0, 0, r * 0.16);
  c.fill();
}

function tire(c: CanvasRenderingContext2D, r: number, grade: 'stock' | 'sport' | 'semislick' | 'slick'): void {
  c.fillStyle = '#0d0d0f';
  c.strokeStyle = grade === 'slick' ? '#ff6a4d' : '#e9edf2';
  c.lineWidth = r * 0.04;
  c.setLineDash(grade === 'slick' ? [] : [r * 0.04, r * 0.1]);
  circle(c, 0, 0, r);
  c.fill();
  c.stroke();
  c.setLineDash([]);
  // tread: grooves for street/sport, nothing for a slick
  if (grade !== 'slick') {
    c.strokeStyle = '#26282d';
    c.lineWidth = r * 0.03;
    const n = grade === 'semislick' ? 18 : 32;
    for (let i = 0; i < n; i++) {
      c.save();
      c.rotate((i * Math.PI * 2) / n);
      c.beginPath();
      c.moveTo(0, -r * 0.92);
      c.lineTo(0, -r * (grade === 'semislick' ? 0.8 : 0.72));
      c.stroke();
      c.restore();
    }
  }
  c.strokeStyle = '#2c2e33';
  c.lineWidth = r * 0.12;
  circle(c, 0, 0, r * 0.66);
  c.stroke();
  c.fillStyle = '#8d949e';
  circle(c, 0, 0, r * 0.5);
  c.fill();
  c.fillStyle = '#d8dde5';
  c.font = `700 ${r * 0.16}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.fillText(grade === 'stock' ? 'ORIGINAL' : grade === 'sport' ? 'ESPORTIVO' : grade === 'slick' ? 'SLICK' : 'SEMISLICK', 0, -r * 0.78);
}

function exhaust(c: CanvasRenderingContext2D, s: number, sport: boolean, section: boolean): void {
  c.lineCap = 'round';
  c.strokeStyle = STEEL;
  c.lineWidth = s * 0.08;
  c.beginPath();
  c.moveTo(-s * 0.9, s * 0.12);
  c.quadraticCurveTo(-s * 0.4, s * 0.12, -s * 0.2, 0);
  c.lineTo(s * 0.5, 0);
  c.stroke();
  c.fillStyle = '#4a5360';
  c.beginPath();
  c.roundRect(-s * 0.4, -s * 0.12, s * 0.34, s * 0.24, s * 0.08);
  c.fill();
  if (section) return;
  c.fillStyle = sport ? '#e4e8ee' : '#707882';
  c.strokeStyle = DARK;
  c.lineWidth = 2;
  const w = sport ? s * 0.5 : s * 0.3;
  const h = sport ? s * 0.26 : s * 0.18;
  c.beginPath();
  c.roundRect(s * 0.5, -h / 2, w, h, sport ? h / 2 : 4);
  c.fill();
  c.stroke();
  if (sport) {
    c.fillStyle = '#9aa4b1';
    c.fillRect(s * 0.52, -s * 0.015, w - s * 0.04, s * 0.03);
  }
  c.fillStyle = '#060606';
  c.beginPath();
  c.ellipse(s * 0.5 + w, 0, h * 0.12, h * 0.4, 0, 0, Math.PI * 2);
  c.fill();
}

function turboDrawing(c: CanvasRenderingContext2D, s: number, twin: boolean): void {
  const one = (x: number, r: number): void => {
    c.strokeStyle = STEEL;
    c.lineWidth = r * 0.28;
    c.beginPath();
    c.moveTo(x - r * 2.1, 0);
    c.lineTo(x - r * 1.0, 0);
    c.moveTo(x + r * 1.0, 0);
    c.lineTo(x + r * 2.1, 0);
    c.stroke();
    c.fillStyle = '#3a2e18';
    c.strokeStyle = GOLD;
    c.lineWidth = r * 0.08;
    circle(c, x, 0, r);
    c.fill();
    c.stroke();
    c.fillStyle = '#2a2113';
    circle(c, x, 0, r * 0.7);
    c.fill();
    c.strokeStyle = '#e0b95a';
    c.lineWidth = r * 0.1;
    for (let i = 0; i < 8; i++) {
      c.save();
      c.translate(x, 0);
      c.rotate((i * Math.PI) / 4);
      c.beginPath();
      c.moveTo(0, -r * 0.2);
      c.lineTo(0, -r * 0.62);
      c.stroke();
      c.restore();
    }
    c.fillStyle = GOLD;
    circle(c, x, 0, r * 0.12);
    c.fill();
    c.strokeStyle = BLUE;
    c.lineWidth = r * 0.16;
    c.beginPath();
    c.moveTo(x, -r);
    c.lineTo(x, -r * 1.35);
    c.stroke();
  };
  if (twin) {
    c.save();
    c.translate(0, -s * 0.2);
    one(-s * 0.4, s * 0.2);
    c.restore();
    c.save();
    c.translate(0, s * 0.2);
    one(-s * 0.4, s * 0.2);
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.0)';
  } else one(0, s * 0.38);
}

function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke: string, r = 6): void {
  c.fillStyle = fill;
  c.strokeStyle = stroke;
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
  c.stroke();
}

/** Draws one illustration centred on (cx, cy) inside a square of `size` pixels. */
export function drawPartAsset(ctx: CanvasRenderingContext2D, asset: AssetId, cx: number, cy: number, size: number, o: AssetOptions = {}): void {
  const s = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (o.glow) {
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = size * 0.05;
  }
  switch (asset) {
    case 'wheel-original':
      wheel(ctx, s * 0.85, false);
      break;
    case 'wheel-sport':
      wheel(ctx, s * 0.85, true);
      break;
    case 'tire-stock':
      tire(ctx, s * 0.85, 'stock');
      break;
    case 'tire-sport':
      tire(ctx, s * 0.85, 'sport');
      break;
    case 'tire-semislick':
      tire(ctx, s * 0.85, 'semislick');
      break;
    case 'tire-slick':
      tire(ctx, s * 0.85, 'slick');
      break;
    case 'exhaust-free':
      exhaust(ctx, s, false, false);
      break;
    case 'exhaust-sport':
      exhaust(ctx, s, true, false);
      break;
    case 'exhaust-section':
      exhaust(ctx, s, false, true);
      break;
    case 'turbo-single':
      turboDrawing(ctx, s, false);
      break;
    case 'turbo-twin':
      turboDrawing(ctx, s, true);
      break;
    case 'turbo-control':
      turboDrawing(ctx, s * 0.7, false);
      box(ctx, s * 0.35, -s * 0.78, s * 0.42, s * 0.26, '#2d3340', STEEL, 5);
      break;
    case 'intercooler':
      box(ctx, -s * 0.75, -s * 0.4, s * 1.5, s * 0.8, '#2f4a63', BLUE, 6);
      ctx.strokeStyle = '#6ab4ff88';
      ctx.lineWidth = 2;
      for (let i = 1; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.75 + (s * 1.5 * i) / 9, -s * 0.4);
        ctx.lineTo(-s * 0.75 + (s * 1.5 * i) / 9, s * 0.4);
        ctx.stroke();
      }
      break;
    case 'nitrous':
      box(ctx, -s * 0.8, -s * 0.28, s * 1.2, s * 0.56, '#2f4a63', BLUE, s * 0.28);
      box(ctx, s * 0.4, -s * 0.1, s * 0.2, s * 0.2, '#9aa6b6', '#9aa6b6', 2);
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 4;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(s * 0.6, 0);
      ctx.lineTo(s * 0.95, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#cfe6ff';
      ctx.font = `700 ${s * 0.26}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('N₂O', -s * 0.2, s * 0.09);
      break;
    case 'engine-internals':
    case 'intake':
      if (o.engine) drawEngineEndView(ctx, 0, 0, size * 0.95, size * 0.95, o.engine, !!o.glow);
      else box(ctx, -s * 0.7, -s * 0.4, s * 1.4, s * 0.8, '#3a4350', STEEL, 8);
      break;
    case 'clutch':
      ctx.fillStyle = '#2d3340';
      ctx.strokeStyle = STEEL;
      ctx.lineWidth = 3;
      circle(ctx, 0, 0, s * 0.8);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = s * 0.12;
      circle(ctx, 0, 0, s * 0.55);
      ctx.stroke();
      ctx.fillStyle = '#8a929d';
      circle(ctx, 0, 0, s * 0.2);
      ctx.fill();
      break;
    case 'gearbox':
      box(ctx, -s * 0.8, -s * 0.35, s * 1.3, s * 0.7, '#3a4350', STEEL, 10);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        circle(ctx, -s * 0.5 + i * s * 0.4, 0, s * 0.12 + i * s * 0.04);
        ctx.stroke();
      }
      box(ctx, s * 0.5, -s * 0.08, s * 0.4, s * 0.16, '#7b8592', '#7b8592', 3);
      break;
    case 'diff':
      ctx.fillStyle = '#3a4350';
      ctx.strokeStyle = STEEL;
      ctx.lineWidth = 3;
      circle(ctx, 0, 0, s * 0.5);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#7b8592';
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(-s * 0.95, 0);
      ctx.lineTo(s * 0.95, 0);
      ctx.stroke();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      circle(ctx, 0, 0, s * 0.25);
      ctx.stroke();
      break;
    case 'cooling':
      box(ctx, -s * 0.5, -s * 0.7, s * 1.0, s * 1.4, '#2d3340', STEEL, 6);
      ctx.strokeStyle = '#6ab4ff77';
      ctx.lineWidth = 2;
      for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.7 + (s * 1.4 * i) / 10);
        ctx.lineTo(s * 0.5, -s * 0.7 + (s * 1.4 * i) / 10);
        ctx.stroke();
      }
      break;
    case 'ecu':
      box(ctx, -s * 0.7, -s * 0.45, s * 1.4, s * 0.9, '#173a2a', '#5fd08a', 6);
      ctx.fillStyle = '#0c1a13';
      ctx.fillRect(-s * 0.35, -s * 0.2, s * 0.5, s * 0.4);
      ctx.strokeStyle = '#5fd08a';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(s * 0.25, -s * 0.3 + i * s * 0.12);
        ctx.lineTo(s * 0.6, -s * 0.3 + i * s * 0.12);
        ctx.stroke();
      }
      break;
    case 'suspension':
      ctx.strokeStyle = STEEL;
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(0, s * 0.85);
      ctx.stroke();
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const y = -s * 0.7 + (i * s * 1.4) / 8;
        const x = (i % 2 ? 1 : -1) * s * 0.3;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    case 'weight':
      box(ctx, -s * 0.55, -s * 0.3, s * 1.1, s * 0.8, '#3a4350', STEEL, 8);
      ctx.strokeStyle = STEEL;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -s * 0.3, s * 0.3, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#cfd6df';
      ctx.font = `700 ${s * 0.3}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('kg', 0, s * 0.25);
      break;
    default:
      box(ctx, -s * 0.6, -s * 0.4, s * 1.2, s * 0.8, '#3a4350', STEEL, 8);
  }
  ctx.restore();
}

/** The same drawing as a small standalone canvas (list cards). */
export function assetCanvas(asset: AssetId, w: number, h: number, o: AssetOptions = {}): HTMLCanvasElement {
  const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  cv.setAttribute('aria-hidden', 'true');
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    drawPartAsset(ctx, asset, w / 2, h / 2, Math.min(w, h) * 0.92, o);
  }
  return cv;
}
