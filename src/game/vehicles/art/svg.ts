/**
 * Small vector helpers for the vehicle art pipeline. Pure string/number code (no DOM), so the
 * same builders run in the browser and in the Node asset export.
 */

/** A point; the optional third value 1 marks a sharp corner (no tangent continuity). */
export type P = readonly [number, number, (0 | 1)?];

export const f1 = (n: number): string => n.toFixed(1);
export const f2 = (n: number): string => n.toFixed(2);

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function parseHex(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(r: number, g: number, b: number): string {
  return `#${((clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).padStart(6, '0')}`;
}

/** Mixes two colours (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Lightens (f > 0, towards white) or darkens (f < 0, towards black). */
export function shade(hex: string, f: number): string {
  return f >= 0 ? mix(hex, '#ffffff', f) : mix(hex, '#000000', -f);
}

/** Perceived luminance 0..1 (used to adapt highlights to dark and light paints). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Smooth path through points (centripetal-style tangents limited to a third of each segment, so
 * unevenly spaced points never overshoot). Points flagged as corners break the tangent.
 * Returns only the drawing commands after the initial move (`M x y` is included when `move`).
 */
export function smoothPath(pts: readonly P[], closed = false, move = true): string {
  const n = pts.length;
  if (n === 0) return '';
  const at = (i: number): P => (closed ? pts[((i % n) + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  const dir = (i: number): [number, number] => {
    const p = at(i);
    if (p[2] === 1) return [0, 0];
    const a = at(i - 1);
    const b = at(i + 1);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    return len < 1e-9 ? [0, 0] : [dx / len, dy / len];
  };
  let d = move ? `M${f1(pts[0]![0])} ${f1(pts[0]![1])}` : '';
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i);
    const p1 = at(i + 1);
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 3;
    const d0 = dir(i);
    const d1 = dir(i + 1);
    d += `C${f1(p0[0] + d0[0] * len)} ${f1(p0[1] + d0[1] * len)} ${f1(p1[0] - d1[0] * len)} ${f1(p1[1] - d1[1] * len)} ${f1(p1[0])} ${f1(p1[1])}`;
  }
  if (closed) d += 'Z';
  return d;
}

/** Straight polygon path. */
export function polyPath(pts: readonly (readonly [number, number])[], closed = true): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${f1(p[0])} ${f1(p[1])}`).join('') + (closed ? 'Z' : '');
}

/** Point on a circle (angle in radians, screen coordinates: y down). */
export function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

/** Annular sector path between radii r0..r1 and angles a0..a1. */
export function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r0, a0);
  const [x1, y1] = polar(cx, cy, r1, a0);
  const [x2, y2] = polar(cx, cy, r1, a1);
  const [x3, y3] = polar(cx, cy, r0, a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}A${f1(r1)} ${f1(r1)} 0 ${large} 1 ${f1(x2)} ${f1(y2)}L${f1(x3)} ${f1(y3)}A${f1(r0)} ${f1(r0)} 0 ${large} 0 ${f1(x0)} ${f1(y0)}Z`;
}

export function svgDoc(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
