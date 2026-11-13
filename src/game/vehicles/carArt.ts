import type { BodyStyle, CarConfig } from '../../data/schema';

/**
 * Procedural side-view car art (SVG). All shapes derive from the car's real dimensions (length,
 * height, wheelbase, overhang, ride height, tyre radius), so the sprite always matches the physics
 * geometry; style and colours come from `car.visual`. Original artwork – no third-party assets.
 * The car faces +x (right). Coordinates: metres, y up from the ground, converted to px.
 */
export interface CarArt {
  bodySvg: string;
  wheelSvg: string;
  /** Texture sizes in px. */
  bodyW: number;
  bodyH: number;
  wheelD: number;
  /** Anchors in body texture px (origin top-left). */
  rearAxleX: number;
  frontAxleX: number;
  axleY: number;
  exhaustX: number;
  exhaustY: number;
  /** px per metre of the textures. */
  scale: number;
}

interface Profile {
  /** [x/L, y/h] silhouette points from the rear bumper bottom, over the roof, to the nose bottom. */
  top: [number, number][];
  /** Greenhouse window polygon in the same units. */
  window: [number, number][];
  bPillar: number;
  spoiler?: 'roof' | 'wing' | 'lip';
  scoop?: boolean;
}

const PROFILES: Record<BodyStyle, Profile> = {
  hatch: {
    top: [
      [0.0, 0.25],
      [0.01, 0.58],
      [0.05, 0.66],
      [0.14, 0.97],
      [0.2, 1.0],
      [0.58, 0.99],
      [0.74, 0.66],
      [0.9, 0.6],
      [0.99, 0.5],
      [1.0, 0.25],
    ],
    window: [
      [0.08, 0.68],
      [0.16, 0.93],
      [0.56, 0.93],
      [0.69, 0.68],
    ],
    bPillar: 0.42,
  },
  hotHatch: {
    top: [
      [0.0, 0.24],
      [0.01, 0.56],
      [0.05, 0.64],
      [0.13, 0.96],
      [0.2, 1.0],
      [0.57, 0.99],
      [0.73, 0.65],
      [0.9, 0.58],
      [0.99, 0.46],
      [1.0, 0.22],
    ],
    window: [
      [0.08, 0.66],
      [0.15, 0.92],
      [0.55, 0.92],
      [0.68, 0.67],
    ],
    bPillar: 0.41,
    spoiler: 'roof',
  },
  coupe: {
    top: [
      [0.0, 0.26],
      [0.01, 0.55],
      [0.12, 0.62],
      [0.3, 0.88],
      [0.42, 1.0],
      [0.58, 0.99],
      [0.72, 0.64],
      [0.9, 0.55],
      [0.99, 0.45],
      [1.0, 0.24],
    ],
    window: [
      [0.2, 0.66],
      [0.38, 0.93],
      [0.57, 0.93],
      [0.68, 0.66],
    ],
    bPillar: 0.47,
    spoiler: 'lip',
  },
  sedan: {
    top: [
      [0.0, 0.27],
      [0.01, 0.6],
      [0.19, 0.64],
      [0.3, 0.97],
      [0.36, 1.0],
      [0.62, 0.99],
      [0.74, 0.66],
      [0.9, 0.6],
      [0.99, 0.5],
      [1.0, 0.26],
    ],
    window: [
      [0.24, 0.68],
      [0.33, 0.93],
      [0.61, 0.93],
      [0.71, 0.68],
    ],
    bPillar: 0.48,
  },
  muscle: {
    top: [
      [0.0, 0.28],
      [0.01, 0.6],
      [0.16, 0.65],
      [0.28, 0.95],
      [0.34, 1.0],
      [0.55, 0.99],
      [0.66, 0.67],
      [0.92, 0.62],
      [0.99, 0.55],
      [1.0, 0.28],
    ],
    window: [
      [0.22, 0.69],
      [0.31, 0.93],
      [0.54, 0.93],
      [0.63, 0.69],
    ],
    bPillar: 0.44,
    spoiler: 'lip',
    scoop: true,
  },
  supercar: {
    top: [
      [0.0, 0.3],
      [0.01, 0.58],
      [0.1, 0.62],
      [0.33, 0.9],
      [0.42, 1.0],
      [0.55, 0.98],
      [0.72, 0.55],
      [0.9, 0.42],
      [0.99, 0.33],
      [1.0, 0.2],
    ],
    window: [
      [0.36, 0.66],
      [0.44, 0.93],
      [0.55, 0.92],
      [0.68, 0.6],
    ],
    bPillar: 0.5,
    spoiler: 'wing',
  },
};

function shade(hex: string, f: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (s: number): number => {
    const v = (n >> s) & 255;
    const o = f >= 0 ? v + (255 - v) * f : v * (1 + f);
    return Math.max(0, Math.min(255, Math.round(o)));
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export function buildCarArt(car: CarConfig, scale = 90): CarArt {
  const v = car.visual;
  const L = v.lengthM;
  const r = car.tires.radiusM;
  const ride = v.rideHeightM;
  const bodyBottom = ride + 0.04;
  const h = v.heightM - bodyBottom; // body height above its bottom
  const margin = 0.35; // room for the wing / exhaust flames
  const W = Math.ceil((L + margin * 2) * scale);
  const Hpx = Math.ceil((v.heightM + 0.35) * scale);
  const X = (x: number): number => (x + margin) * scale;
  const Y = (y: number): number => Hpx - y * scale;
  const prof = PROFILES[v.bodyStyle];
  const pt = ([fx, fy]: [number, number]): string => `${X(fx * L).toFixed(1)},${Y(bodyBottom + fy * h).toFixed(1)}`;
  const xFront = L - v.frontOverhangM;
  const xRear = xFront - car.wheelbaseM;
  const archR = r * 1.1;

  // body outline: bottom edge with wheel arches, then the silhouette
  const top = prof.top;
  let d = `M ${pt(top[0]!)} `;
  for (let i = 1; i < top.length; i++) {
    const p0 = top[i - 1]!;
    const p1 = top[i]!;
    const mx = ((p0[0] + p1[0]) / 2) * L;
    const my = bodyBottom + ((p0[1] + p1[1]) / 2) * h;
    d += `Q ${pt(p0)} ${X(mx).toFixed(1)},${Y(my).toFixed(1)} `;
  }
  d += `L ${pt(top[top.length - 1]!)} `;
  // bottom from the nose back to the rear, cutting the arches
  const archTop = (cx: number): string =>
    `L ${X(cx + archR).toFixed(1)},${Y(bodyBottom).toFixed(1)} A ${(archR * scale).toFixed(1)} ${(archR * scale).toFixed(1)} 0 0 0 ${X(cx - archR).toFixed(1)},${Y(bodyBottom).toFixed(1)} `;
  d += archTop(xFront);
  d += archTop(xRear);
  d += `L ${X(0).toFixed(1)},${Y(bodyBottom + 0.25 * h).toFixed(1)} Z`;

  const color = v.color;
  const accent = v.accent;
  const dark = shade(color, -0.45);
  const light = shade(color, 0.35);
  const win = prof.window.map(pt).join(' ');
  const bx = X(prof.bPillar * L);
  const beltY = Y(bodyBottom + 0.66 * h);
  const sillY = Y(bodyBottom + 0.12 * h);
  const doorFront = X((prof.window[3]![0] - 0.02) * L);
  const doorRear = X((prof.window[0]![0] + 0.04) * L);

  const parts: string[] = [];
  parts.push(`<defs>
    <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.45" stop-color="${color}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9fc3d9" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#2a3b48" stop-opacity="0.95"/>
    </linearGradient>
  </defs>`);
  // arch shadows (inner wheel wells)
  for (const cx of [xRear, xFront]) {
    parts.push(`<circle cx="${X(cx).toFixed(1)}" cy="${Y(r).toFixed(1)}" r="${(archR * 0.98 * scale).toFixed(1)}" fill="#0b0d10"/>`);
  }
  parts.push(`<path d="${d}" fill="url(#paint)" stroke="${shade(color, -0.6)}" stroke-width="${(0.02 * scale).toFixed(1)}" stroke-linejoin="round"/>`);
  parts.push(`<polygon points="${win}" fill="url(#glass)" stroke="#111" stroke-width="${(0.015 * scale).toFixed(1)}"/>`);
  parts.push(`<rect x="${(bx - 0.03 * scale).toFixed(1)}" y="${Y(bodyBottom + 0.95 * h).toFixed(1)}" width="${(0.06 * scale).toFixed(1)}" height="${(0.3 * h * scale).toFixed(1)}" fill="#14171b"/>`);
  // belt line, door shut lines, sill and accent stripe
  parts.push(`<line x1="${X(0.03 * L).toFixed(1)}" y1="${beltY.toFixed(1)}" x2="${X(0.97 * L).toFixed(1)}" y2="${beltY.toFixed(1)}" stroke="${shade(color, -0.3)}" stroke-width="${(0.012 * scale).toFixed(1)}"/>`);
  for (const x of [doorRear, bx, doorFront]) {
    parts.push(`<line x1="${x.toFixed(1)}" y1="${(beltY - 0.02 * scale).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(sillY + 0.02 * scale).toFixed(1)}" stroke="${shade(color, -0.4)}" stroke-width="${(0.01 * scale).toFixed(1)}"/>`);
  }
  parts.push(`<rect x="${X(xRear + archR).toFixed(1)}" y="${(sillY - 0.03 * scale).toFixed(1)}" width="${((xFront - xRear - 2 * archR) * scale).toFixed(1)}" height="${(0.07 * scale).toFixed(1)}" fill="${shade(color, -0.55)}"/>`);
  parts.push(`<rect x="${X(0.04 * L).toFixed(1)}" y="${(Y(bodyBottom + 0.42 * h)).toFixed(1)}" width="${(0.92 * L * scale).toFixed(1)}" height="${(0.035 * scale).toFixed(1)}" fill="${accent}" opacity="0.9"/>`);
  // lights
  const tail = top[1]!;
  parts.push(`<rect x="${X(0).toFixed(1)}" y="${Y(bodyBottom + (tail[1] - 0.12) * h).toFixed(1)}" width="${(0.06 * scale).toFixed(1)}" height="${(0.09 * h * scale).toFixed(1)}" rx="${(0.01 * scale).toFixed(1)}" fill="#c4161c"/>`);
  const nose = top[top.length - 2]!;
  parts.push(`<rect x="${(X(L) - 0.11 * scale).toFixed(1)}" y="${Y(bodyBottom + (nose[1] - 0.06) * h).toFixed(1)}" width="${(0.1 * scale).toFixed(1)}" height="${(0.06 * h * scale + 2).toFixed(1)}" rx="${(0.015 * scale).toFixed(1)}" fill="#f4f1d6"/>`);
  // mirror
  const mw = prof.window[3]!;
  parts.push(`<rect x="${(X(mw[0] * L) - 0.08 * scale).toFixed(1)}" y="${Y(bodyBottom + mw[1] * h + 0.05).toFixed(1)}" width="${(0.1 * scale).toFixed(1)}" height="${(0.06 * scale).toFixed(1)}" rx="${(0.02 * scale).toFixed(1)}" fill="${shade(color, -0.2)}"/>`);
  // aero
  if (prof.spoiler === 'roof') {
    const p = top[3]!;
    parts.push(`<path d="M ${X(p[0] * L - 0.05).toFixed(1)},${Y(bodyBottom + p[1] * h).toFixed(1)} l ${(-0.12 * scale).toFixed(1)},${(0.03 * scale).toFixed(1)} l ${(0.03 * scale).toFixed(1)},${(-0.07 * scale).toFixed(1)} z" fill="${accent}"/>`);
  } else if (prof.spoiler === 'lip') {
    const p = top[2]!;
    parts.push(`<path d="M ${X(p[0] * L - 0.1).toFixed(1)},${Y(bodyBottom + p[1] * h).toFixed(1)} l ${(-0.1 * scale).toFixed(1)},${(-0.05 * scale).toFixed(1)} l ${(0.02 * scale).toFixed(1)},${(0.05 * scale).toFixed(1)} z" fill="${shade(color, -0.5)}"/>`);
  } else if (prof.spoiler === 'wing') {
    const x0 = X(0.02 * L);
    const y0 = Y(bodyBottom + 0.62 * h);
    parts.push(`<rect x="${(x0 + 0.1 * scale).toFixed(1)}" y="${(y0 - 0.2 * scale).toFixed(1)}" width="${(0.04 * scale).toFixed(1)}" height="${(0.2 * scale).toFixed(1)}" fill="#1a1a1a"/>`);
    parts.push(`<path d="M ${(x0 - 0.05 * scale).toFixed(1)},${(y0 - 0.2 * scale).toFixed(1)} l ${(0.42 * scale).toFixed(1)},${(-0.03 * scale).toFixed(1)} l 0,${(0.05 * scale).toFixed(1)} l ${(-0.42 * scale).toFixed(1)},${(0.04 * scale).toFixed(1)} z" fill="${accent}" stroke="#111" stroke-width="1"/>`);
  }
  if (prof.scoop) {
    const x0 = X(0.78 * L);
    const y0 = Y(bodyBottom + 0.635 * h);
    parts.push(`<path d="M ${x0.toFixed(1)},${y0.toFixed(1)} l ${(0.1 * scale).toFixed(1)},${(-0.07 * scale).toFixed(1)} l ${(0.14 * scale).toFixed(1)},0 l 0,${(0.07 * scale).toFixed(1)} z" fill="${shade(color, -0.35)}"/>`);
  }
  // exhaust tip(s)
  const exX = X(0.02);
  const exY = Y(bodyBottom + 0.06);
  const tips = car.exhaust.layout === 'dual' ? 2 : 1;
  for (let i = 0; i < tips; i++) {
    parts.push(`<rect x="${(exX - 0.1 * scale).toFixed(1)}" y="${(exY - (0.03 + i * 0.075) * scale).toFixed(1)}" width="${(0.16 * scale).toFixed(1)}" height="${(0.06 * scale).toFixed(1)}" rx="${(0.025 * scale).toFixed(1)}" fill="#8d9297" stroke="#2b2e31" stroke-width="1"/>`);
  }

  const bodySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hpx}" viewBox="0 0 ${W} ${Hpx}">${parts.join('')}</svg>`;

  // wheel: tyre, sidewall lettering ring, rim with spokes (rotation is visible), brake disc
  const D = Math.ceil(2 * r * scale) + 2;
  const c = D / 2;
  const R = r * scale;
  const rimR = R * 0.64;
  const spokes = v.bodyStyle === 'muscle' ? 5 : v.bodyStyle === 'supercar' ? 10 : v.bodyStyle === 'sedan' ? 7 : 6;
  const sp: string[] = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const x1 = c + Math.cos(a) * rimR * 0.25;
    const y1 = c + Math.sin(a) * rimR * 0.25;
    const x2 = c + Math.cos(a) * rimR * 0.93;
    const y2 = c + Math.sin(a) * rimR * 0.93;
    sp.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#c9ced3" stroke-width="${(rimR * 0.16).toFixed(1)}" stroke-linecap="round"/>`);
  }
  const wheelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}" viewBox="0 0 ${D} ${D}">
    <circle cx="${c}" cy="${c}" r="${R.toFixed(1)}" fill="#141516"/>
    <circle cx="${c}" cy="${c}" r="${(R * 0.86).toFixed(1)}" fill="none" stroke="#2a2c2e" stroke-width="${(R * 0.05).toFixed(1)}" stroke-dasharray="${(R * 0.25).toFixed(1)} ${(R * 0.12).toFixed(1)}"/>
    <circle cx="${c}" cy="${c}" r="${rimR.toFixed(1)}" fill="#3a3f45"/>
    <circle cx="${c}" cy="${c}" r="${(rimR * 0.78).toFixed(1)}" fill="#6b4a3a" opacity="0.7"/>
    ${sp.join('')}
    <circle cx="${c}" cy="${c}" r="${rimR.toFixed(1)}" fill="none" stroke="#d9dde1" stroke-width="${(rimR * 0.1).toFixed(1)}"/>
    <circle cx="${c}" cy="${c}" r="${(rimR * 0.18).toFixed(1)}" fill="${accent}"/>
  </svg>`;

  return {
    bodySvg,
    wheelSvg,
    bodyW: W,
    bodyH: Hpx,
    wheelD: D,
    rearAxleX: X(xRear),
    frontAxleX: X(xFront),
    axleY: Y(r),
    exhaustX: exX - 0.1 * scale,
    exhaustY: exY,
    scale,
  };
}

/** Rasterizes an SVG string to a canvas (browser only). */
export async function svgToCanvas(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}
