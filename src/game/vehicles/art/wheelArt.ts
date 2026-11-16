import type { WheelDesign } from './designs';
import { f1, f2, polar, sector, shade, svgDoc } from './svg';

/**
 * Wheel artwork: a rotating layer (tyre + rim, transparent between the spokes) and a static hub
 * layer behind it (brake disc and caliper on a dark backing), so the caliper stays put while the
 * wheel turns. Sizes derive from the physical tyre radius.
 */
export interface WheelArt {
  /** Square frame size (px). */
  size: number;
  wheelSvg: string;
  hubSvg: string;
  rimRadiusPx: number;
}

const FINISH = {
  silver: { hi: '#f4f6f8', mid: '#b4bbc2', lo: '#646b72', barrel: '#30353a' },
  gunmetal: { hi: '#949ba3', mid: '#4f555c', lo: '#202327', barrel: '#121416' },
  black: { hi: '#5d6268', mid: '#222426', lo: '#0b0c0d', barrel: '#050506' },
  polished: { hi: '#ffffff', mid: '#d3d8dd', lo: '#7b828a', barrel: '#454a50' },
} as const;

function ring(c: number, r0: number, r1: number): string {
  const circ = (r: number): string => `M${f1(c - r)} ${f1(c)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;
  return circ(r1) + circ(r0);
}

/** Tapered bar between two points (half-widths t0, t1). */
function bar(x0: number, y0: number, x1: number, y1: number, t0: number, t1: number): string {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return `M${f2(x0 + nx * t0)} ${f2(y0 + ny * t0)}L${f2(x1 + nx * t1)} ${f2(y1 + ny * t1)}L${f2(x1 - nx * t1)} ${f2(y1 - ny * t1)}L${f2(x0 - nx * t0)} ${f2(y0 - ny * t0)}Z`;
}

function spokePaths(d: WheelDesign, q: number): string[] {
  const r0 = 0.15 * q;
  const r1 = 0.915 * q;
  switch (d.style) {
    case 'five': {
      const w0 = 0.21 * q;
      const wm = 0.075 * q;
      const w1 = 0.17 * q;
      const m = 0.52 * q;
      return [`M${f2(r0)} ${f2(-w0)}Q${f2(m)} ${f2(-wm)} ${f2(r1)} ${f2(-w1)}L${f2(r1)} ${f2(w1)}Q${f2(m)} ${f2(wm)} ${f2(r0)} ${f2(w0)}Z`];
    }
    case 'twin': {
      const out: string[] = [];
      for (const s of [-1, 1]) {
        const [x0, y0] = polar(0, 0, r0 * 1.3, s * 0.42);
        const [x1, y1] = polar(0, 0, r1, s * 0.2);
        out.push(bar(x0, y0, x1, y1, 0.05 * q, 0.04 * q));
      }
      return out;
    }
    case 'multi': {
      const t0 = q * Math.min(0.085, 0.6 / d.count);
      return [bar(r0, 0, r1, 0, t0, t0 * 0.66)];
    }
    case 'split': {
      const out = [bar(r0, 0, 0.5 * q, 0, 0.085 * q, 0.07 * q)];
      for (const s of [-1, 1]) {
        const [x1, y1] = polar(0, 0, r1, s * 0.23);
        out.push(bar(0.42 * q, 0, x1, y1, 0.05 * q, 0.042 * q));
      }
      return out;
    }
    case 'turbine': {
      const a = polar(0, 0, r0, -0.2);
      const b = polar(0, 0, 0.55 * q, 0.05);
      const c = polar(0, 0, r1, 0.36);
      const e = polar(0, 0, r1, 0.56);
      const g = polar(0, 0, 0.55 * q, 0.32);
      const k = polar(0, 0, r0, 0.3);
      return [`M${f2(a[0])} ${f2(a[1])}Q${f2(b[0])} ${f2(b[1])} ${f2(c[0])} ${f2(c[1])}L${f2(e[0])} ${f2(e[1])}Q${f2(g[0])} ${f2(g[1])} ${f2(k[0])} ${f2(k[1])}Z`];
    }
  }
}

export function buildWheelArt(d: WheelDesign, tyreRadiusM: number, pxPerM: number, caliperColor: string, capColor: string): WheelArt {
  const R = tyreRadiusM * pxPerM;
  const size = Math.ceil(2 * R) + 6;
  const c = size / 2;
  const q = R * d.rim;
  const fin = FINISH[d.finish];
  const side = R - q;

  // ---------------------------------------------------------------- rotating layer
  const w: string[] = [];
  w.push(`<defs>
    <radialGradient id="ty" gradientUnits="userSpaceOnUse" cx="${f1(c)}" cy="${f1(c)}" r="${f1(R)}">
      <stop offset="${f2(d.rim)}" stop-color="#070708"/>
      <stop offset="${f2(d.rim + (1 - d.rim) * 0.22)}" stop-color="#222325"/>
      <stop offset="${f2(d.rim + (1 - d.rim) * 0.7)}" stop-color="#17181a"/>
      <stop offset="0.975" stop-color="#101112"/>
      <stop offset="1" stop-color="#030303"/>
    </radialGradient>
    <linearGradient id="lip" gradientUnits="userSpaceOnUse" x1="${f1(c - q)}" y1="${f1(c - q)}" x2="${f1(c + q)}" y2="${f1(c + q)}">
      <stop offset="0" stop-color="${fin.hi}"/>
      <stop offset="0.3" stop-color="${fin.lo}"/>
      <stop offset="0.52" stop-color="${fin.hi}"/>
      <stop offset="0.78" stop-color="${fin.mid}"/>
      <stop offset="1" stop-color="${fin.lo}"/>
    </linearGradient>
    <radialGradient id="brl" gradientUnits="userSpaceOnUse" cx="${f1(c)}" cy="${f1(c)}" r="${f1(q)}">
      <stop offset="0.78" stop-color="#000000"/>
      <stop offset="0.9" stop-color="${fin.barrel}"/>
      <stop offset="1" stop-color="${shade(fin.barrel, 0.25)}"/>
    </radialGradient>
    <linearGradient id="sp" gradientUnits="userSpaceOnUse" x1="0" y1="${f2(-0.2 * q)}" x2="0" y2="${f2(0.2 * q)}">
      <stop offset="0" stop-color="${fin.hi}"/>
      <stop offset="0.45" stop-color="${fin.mid}"/>
      <stop offset="1" stop-color="${fin.lo}"/>
    </linearGradient>
    <radialGradient id="cap" gradientUnits="userSpaceOnUse" cx="${f1(c - q * 0.05)}" cy="${f1(c - q * 0.05)}" r="${f1(q * 0.24)}">
      <stop offset="0" stop-color="${fin.hi}"/>
      <stop offset="1" stop-color="${fin.lo}"/>
    </radialGradient>
    <path id="tp" fill="none" d="M${f1(c - q - side * 0.3)} ${f1(c)}A${f1(q + side * 0.3)} ${f1(q + side * 0.3)} 0 1 1 ${f1(c + q + side * 0.3)} ${f1(c)}A${f1(q + side * 0.3)} ${f1(q + side * 0.3)} 0 1 1 ${f1(c - q - side * 0.3)} ${f1(c)}"/>
  </defs>`);
  // tyre
  w.push(`<path fill-rule="evenodd" fill="url(#ty)" d="${ring(c, q * 0.985, R)}"/>`);
  w.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1((q + R) / 2)}" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="${f1(side * 0.5)}"/>`);
  w.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(R * 0.972)}" fill="none" stroke="#000000" stroke-opacity="0.6" stroke-width="${f1(R * 0.045)}" stroke-dasharray="${f1(R * 0.04)} ${f1(R * 0.028)}"/>`);
  w.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(R * 0.94)}" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="${f1(Math.max(1, R * 0.01))}"/>`);
  w.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(q + side * 0.12)}" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="${f1(Math.max(1, R * 0.012))}"/>`);
  const letter = d.lettering === 'white' ? { fill: '#e6e6de', op: 0.8 } : { fill: '#45484c', op: 0.9 };
  const fs = side * (d.lettering === 'white' ? 0.3 : 0.4);
  for (const off of ['6%', '56%']) {
    w.push(
      `<text font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${f1(fs)}" letter-spacing="${f1(fs * 0.12)}" fill="${letter.fill}" fill-opacity="${letter.op}"><textPath href="#tp" startOffset="${off}">SPORT RADIAL</textPath></text>`,
    );
  }
  // rim barrel and lip
  w.push(`<path fill-rule="evenodd" fill="url(#brl)" d="${ring(c, q * 0.78, q * 0.985)}"/>`);
  w.push(`<path fill-rule="evenodd" fill="url(#lip)" d="${ring(c, q * 0.905, q)}"/>`);
  w.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(q)}" fill="none" stroke="#000000" stroke-opacity="0.75" stroke-width="${f1(Math.max(1, q * 0.02))}"/>`);
  w.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(q * 0.905)}" fill="none" stroke="#000000" stroke-opacity="0.45" stroke-width="${f1(Math.max(0.8, q * 0.012))}"/>`);
  // spokes
  const paths = spokePaths(d, q);
  for (let i = 0; i < d.count; i++) {
    const deg = (i / d.count) * 360 - 90;
    w.push(`<g transform="translate(${f1(c)} ${f1(c)}) rotate(${f2(deg)})">`);
    for (const p of paths) w.push(`<path d="${p}" fill="url(#sp)" stroke="${fin.lo}" stroke-opacity="0.7" stroke-width="${f1(Math.max(0.6, q * 0.012))}" stroke-linejoin="round"/>`);
    w.push('</g>');
  }
  // hub, nuts, cap
  w.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(q * 0.235)}" fill="url(#cap)" stroke="${fin.lo}" stroke-width="${f1(Math.max(0.6, q * 0.012))}"/>`);
  if (d.centreLock) {
    const hexPts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const [x, y] = polar(c, c, q * 0.15, (i / 6) * Math.PI * 2);
      hexPts.push(`${f1(x)},${f1(y)}`);
    }
    w.push(`<polygon points="${hexPts.join(' ')}" fill="${capColor}" stroke="#000000" stroke-opacity="0.5" stroke-width="${f1(Math.max(0.6, q * 0.01))}"/>`);
    w.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(q * 0.06)}" fill="${shade(capColor, -0.5)}"/>`);
  } else {
    for (let i = 0; i < 5; i++) {
      const [x, y] = polar(c, c, q * 0.155, (i / 5) * Math.PI * 2 - Math.PI / 2 + Math.PI / 5);
      w.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(q * 0.034)}" fill="#1b1d1f" stroke="${fin.hi}" stroke-opacity="0.5" stroke-width="${f1(Math.max(0.5, q * 0.008))}"/>`);
    }
    w.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(q * 0.085)}" fill="${shade(capColor, -0.15)}" stroke="${fin.hi}" stroke-opacity="0.6" stroke-width="${f1(Math.max(0.5, q * 0.01))}"/>`);
  }
  // valve stem
  {
    const [x, y] = polar(c, c, q * 0.86, 0.9);
    w.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.max(0.8, q * 0.018))}" fill="#0c0c0c"/>`);
  }

  // ---------------------------------------------------------------- static hub layer
  const h: string[] = [];
  const rd = 0.74 * q;
  h.push(`<defs>
    <radialGradient id="disc" gradientUnits="userSpaceOnUse" cx="${f1(c)}" cy="${f1(c)}" r="${f1(rd)}">
      <stop offset="0.4" stop-color="#4f5459"/>
      <stop offset="0.62" stop-color="#a4aab0"/>
      <stop offset="0.86" stop-color="#7f858b"/>
      <stop offset="1" stop-color="#4b4f54"/>
    </radialGradient>
    <linearGradient id="cal" gradientUnits="userSpaceOnUse" x1="${f1(c - q)}" y1="${f1(c - q)}" x2="${f1(c)}" y2="${f1(c)}">
      <stop offset="0" stop-color="${shade(caliperColor, 0.3)}"/>
      <stop offset="1" stop-color="${shade(caliperColor, -0.35)}"/>
    </linearGradient>
  </defs>`);
  h.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(q * 0.975)}" fill="#07080a"/>`);
  h.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(rd)}" fill="url(#disc)"/>`);
  for (const k of [0.56, 0.68, 0.8, 0.92]) {
    h.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(rd * k)}" fill="none" stroke="#000000" stroke-opacity="0.16" stroke-width="${f1(Math.max(0.5, rd * 0.012))}"/>`);
  }
  for (const [rr, n, ph] of [
    [0.62, 14, 0],
    [0.82, 14, 0.22],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const [x, y] = polar(c, c, rd * rr, (i / n) * Math.PI * 2 + ph);
      h.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.max(0.7, rd * 0.028))}" fill="#25282b"/>`);
    }
  }
  h.push(`<circle cx="${f1(c)}" cy="${f1(c)}" r="${f1(rd * 0.42)}" fill="#1c1f22"/>`);
  const a0 = (200 * Math.PI) / 180;
  const a1 = (262 * Math.PI) / 180;
  h.push(`<path d="${sector(c, c, rd * 0.56, rd * 1.1, a0, a1)}" fill="url(#cal)" stroke="#000000" stroke-opacity="0.6" stroke-width="${f1(Math.max(0.6, q * 0.012))}" stroke-linejoin="round"/>`);
  for (const a of [a0 + 0.14, a1 - 0.14]) {
    const [x, y] = polar(c, c, rd * 0.98, a);
    h.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.max(0.7, rd * 0.04))}" fill="#15171a"/>`);
  }

  return { size, wheelSvg: svgDoc(size, size, w.join('')), hubSvg: svgDoc(size, size, h.join('')), rimRadiusPx: q };
}
