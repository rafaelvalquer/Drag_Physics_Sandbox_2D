import type { CarConfig } from '../../../data/schema';
import { DESIGNS, outlineV } from './designs';
import { f1, f2, luminance, mix, polyPath, shade, smoothPath, svgDoc, type P } from './svg';

/**
 * Body artwork of one car as stacked SVG layers that share one frame:
 *   under  – wheel wells, floor, exhaust tips (drawn behind the wheels)
 *   body   – paint, panels, glass, lamps, trim (drawn over the wheels)
 *   gloss  – white highlights only, tinted at run time with the colour of the sky
 *   lights – head and tail lamps switched on (additive)
 *   brake  – brake lamps (additive)
 * plus a soft ground shadow in its own frame. Geometry comes from the car's real dimensions.
 */
export interface BodyArt {
  w: number;
  h: number;
  under: string;
  body: string;
  gloss: string;
  lights: string;
  brake: string;
  shadow: { svg: string; w: number; h: number };
  /** Pixel of the front-axle ground contact inside the body frame. */
  originX: number;
  originY: number;
  /** Metres relative to the front-axle ground contact (x forward, y up). */
  exhausts: { x: number; y: number }[];
  headlight: { x: number; y: number };
  taillight: { x: number; y: number };
  roofY: number;
  /** Rear end and nose (m, relative to the front axle). */
  rearX: number;
  noseX: number;
}

function centroid(pts: readonly P[]): [number, number] {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

function scaleAbout(pts: readonly P[], c: readonly [number, number], k: number): P[] {
  return pts.map((p) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k] as P);
}

export function buildBodyArt(car: CarConfig, S: number): BodyArt {
  const v = car.visual;
  const d = DESIGNS[v.bodyStyle];
  const L = v.lengthM;
  const H = v.heightM;
  const r = car.tires.radiusM;
  const yb = v.rideHeightM + 0.03;
  const Hb = H - yb;
  const mr = 0.5;
  const mf = 0.3;
  const mt = 0.42;
  const mb = 0.06;
  const W = Math.ceil((L + mr + mf) * S);
  const Hp = Math.ceil((H + mt + mb) * S);
  const X = (x: number): number => (x + mr) * S;
  const Y = (y: number): number => (H + mt - y) * S;
  const U = (u: number): number => X(u * L);
  const V = (vv: number): number => Y(yb + vv * Hb);
  const m = (len: number): number => len * S;
  const px = (pts: readonly P[]): P[] => pts.map(([u, vv, c]) => [U(u), V(vv), c] as P);
  const sw = (len: number, min = 0.8): string => f1(Math.max(min, m(len)));

  const paint = v.color;
  const accent = v.accent;
  const lum = luminance(paint);
  const xF = L - v.frontOverhangM;
  const xR = xF - car.wheelbaseM;
  const ra = r + d.archGap;
  const ay = r + 0.005;
  const dxA = Math.sqrt(Math.max(0.0004, ra * ra - (ay - yb) ** 2));
  const out = px(d.outline);
  const first = out[0]!;
  const archCut = (cx: number): string => `L${f1(X(cx + dxA))} ${f1(Y(yb))}A${f1(m(ra))} ${f1(m(ra))} 0 1 0 ${f1(X(cx - dxA))} ${f1(Y(yb))}`;
  const bodyPath = `${smoothPath(out)}${archCut(xF)}${archCut(xR)}L${f1(first[0])} ${f1(first[1])}Z`;
  const glassPaths = d.glass.map((g) => smoothPath(px(g), true));
  const blur = (id: string, sigma: number): string =>
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${Hp}"><feGaussianBlur stdDeviation="${f2(Math.max(0.3, sigma))}"/></filter>`;
  const clips = `<clipPath id="cb"><path d="${bodyPath}"/></clipPath><clipPath id="cg">${glassPaths.map((g) => `<path d="${g}"/>`).join('')}</clipPath>`;
  const archArc = (cx: number, rad: number, a0deg: number, a1deg: number): string => {
    const a0 = (a0deg * Math.PI) / 180;
    const a1 = (a1deg * Math.PI) / 180;
    const x0 = X(cx) + Math.cos(a0) * m(rad);
    const y0 = Y(ay) + Math.sin(a0) * m(rad);
    const x1 = X(cx) + Math.cos(a1) * m(rad);
    const y1 = Y(ay) + Math.sin(a1) * m(rad);
    return `M${f1(x0)} ${f1(y0)}A${f1(m(rad))} ${f1(m(rad))} 0 ${Math.abs(a1deg - a0deg) > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`;
  };
  // angles (screen, clockwise from +x) where the arch meets the sill line
  const archA = (Math.asin(Math.min(1, (ay - yb) / ra)) * 180) / Math.PI;
  const a0deg = 180 - archA;
  const a1deg = 360 + archA;

  // ------------------------------------------------------------------ BODY
  const b: string[] = [];
  const top = mix(paint, '#ffffff', lum < 0.2 ? 0.34 : 0.45);
  b.push(`<defs>${clips}
    ${blur('b1', m(0.012))}${blur('b2', m(0.03))}${blur('b3', m(0.055))}
    <linearGradient id="pg" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(Y(H))}" x2="0" y2="${f1(Y(yb))}">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="0.22" stop-color="${mix(paint, '#ffffff', 0.16)}"/>
      <stop offset="0.42" stop-color="${paint}"/>
      <stop offset="0.72" stop-color="${shade(paint, -0.2)}"/>
      <stop offset="1" stop-color="${shade(paint, -0.48)}"/>
    </linearGradient>
    <linearGradient id="ends" gradientUnits="userSpaceOnUse" x1="${f1(U(0))}" y1="0" x2="${f1(U(1))}" y2="0">
      <stop offset="0" stop-color="#000000" stop-opacity="0.42"/>
      <stop offset="0.07" stop-color="#000000" stop-opacity="0"/>
      <stop offset="0.92" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.36"/>
    </linearGradient>
    <linearGradient id="gl" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(V(0.97))}" x2="0" y2="${f1(V(d.beltV))}">
      <stop offset="0" stop-color="#a9c9db" stop-opacity="0.5"/>
      <stop offset="0.4" stop-color="#35505f" stop-opacity="0.64"/>
      <stop offset="1" stop-color="#0b1216" stop-opacity="0.8"/>
    </linearGradient>
    <linearGradient id="hl" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f9fc"/>
      <stop offset="0.55" stop-color="#b9c8d2"/>
      <stop offset="1" stop-color="#6d7c87"/>
    </linearGradient>
    <linearGradient id="tl" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d0222a"/>
      <stop offset="0.6" stop-color="#8f0f15"/>
      <stop offset="1" stop-color="#4c0609"/>
    </linearGradient>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fafbfc"/>
      <stop offset="0.38" stop-color="#8b9299"/>
      <stop offset="0.55" stop-color="#e3e7ea"/>
      <stop offset="1" stop-color="#4a4f55"/>
    </linearGradient>
    <linearGradient id="vsh" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.85"/>
      <stop offset="0.55" stop-color="#000000" stop-opacity="0.15"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <pattern id="mesh" width="${f1(Math.max(3, m(0.03)))}" height="${f1(Math.max(3, m(0.03)))}" patternUnits="userSpaceOnUse">
      <rect width="100%" height="100%" fill="#08090a"/>
      <path d="M0 ${f1(Math.max(3, m(0.03)))}L${f1(Math.max(3, m(0.03)))} 0" stroke="#30343a" stroke-width="${f1(Math.max(0.6, m(0.005)))}"/>
    </pattern>
  </defs>`);
  b.push('<g clip-path="url(#cb)">');
  b.push(`<path d="${bodyPath}" fill="url(#pg)"/>`);
  // horizon reflection: the lower body mirrors the ground and is darker below a soft line
  {
    const sh = d.shoulder;
    const hz: P[] = [[-0.06, sh[0]![1] - 0.2], ...sh.map(([u, vv]) => [u, vv - 0.2] as P), [1.06, sh[sh.length - 1]![1] - 0.2]];
    b.push(`<path d="${smoothPath(px(hz))}L${W} ${Hp}L0 ${Hp}Z" fill="#000000" opacity="${lum > 0.6 ? 0.2 : 0.3}" filter="url(#b1)"/>`);
    const lo: P[] = hz.map(([u, vv]) => [u, vv - 0.23] as P);
    b.push(`<path d="${smoothPath(px(lo))}" fill="none" stroke="#ffffff" stroke-opacity="${lum > 0.6 ? 0.14 : 0.1}" stroke-width="${f1(m(0.05))}" filter="url(#b2)"/>`);
  }
  b.push(`<rect x="0" y="0" width="${W}" height="${Hp}" fill="url(#ends)"/>`);
  for (const cx of [xR, xF]) {
    b.push(
      `<ellipse cx="${f1(X(cx))}" cy="${f1(Y(ay + ra + 0.07))}" rx="${f1(m(ra * 1.05))}" ry="${f1(m(0.075))}" fill="#ffffff" opacity="${lum < 0.3 ? 0.13 : 0.2}" filter="url(#b3)"/>`,
    );
  }
  if (d.stripe === 'rally') {
    const x0 = X(xR + ra + 0.05);
    const x1 = X(xF - ra - 0.05);
    b.push(`<rect x="${f1(x0)}" y="${f1(V(0.3))}" width="${f1(x1 - x0)}" height="${f1(m(0.1))}" fill="${accent}" opacity="0.95"/>`);
    b.push(`<rect x="${f1(x0)}" y="${f1(V(0.3) + m(0.125))}" width="${f1(x1 - x0)}" height="${f1(m(0.022))}" fill="${accent}" opacity="0.95"/>`);
  } else if (d.stripe === 'pin') {
    const pin: P[] = d.shoulder.map(([u, vv]) => [u, vv - 0.075] as P);
    b.push(`<path d="${smoothPath(px(pin))}" fill="none" stroke="${accent}" stroke-opacity="0.9" stroke-width="${sw(0.014)}"/>`);
  }
  if (d.cladding > 0) {
    b.push(`<rect x="0" y="${f1(V(d.cladding))}" width="${W}" height="${f1(Hp - V(d.cladding))}" fill="#121416"/>`);
    b.push(`<rect x="0" y="${f1(V(d.cladding))}" width="${W}" height="${sw(0.008)}" fill="#3d4247"/>`);
    if (d.stripe === 'sill') {
      const x0 = X(xR + ra + 0.06);
      const x1 = X(xF - ra - 0.06);
      b.push(`<rect x="${f1(x0)}" y="${f1(V(d.cladding) - m(0.05))}" width="${f1(x1 - x0)}" height="${f1(m(0.028))}" fill="${accent}" opacity="0.95"/>`);
    }
  }
  if (d.louvres) {
    const [u0, u1] = d.louvres;
    for (let i = 0; i <= 5; i++) {
      const u = u0 + ((u1 - u0) * i) / 5;
      b.push(
        `<line x1="${f1(U(u))}" y1="${f1(V(outlineV(d, u) - 0.02))}" x2="${f1(U(u + 0.016))}" y2="${f1(V(outlineV(d, u + 0.016) - 0.085))}" stroke="#08090a" stroke-width="${sw(0.016)}" stroke-linecap="round"/>`,
      );
    }
  }
  if (d.lowerTrim) {
    const t = d.lowerTrim;
    const trim = t.color;
    const block = (u0: number, u1: number, vv: number): string =>
      `<rect x="${f1(U(u0))}" y="${f1(V(vv))}" width="${f1(U(u1) - U(u0))}" height="${f1(Hp - V(vv))}" fill="${trim}"/>`;
    // wrap-around bumpers (drawn to the frame edge; the body clip shapes them)
    b.push(block(-0.05, t.rearU, t.bumperTop), block(t.frontU, 1.05, t.bumperTop));
    // side protection panel between the arches (the arch cut-outs lie outside the clip)
    const sx0 = X(xR);
    const sx1 = X(xF);
    b.push(`<rect x="${f1(sx0)}" y="${f1(V(t.sideTop))}" width="${f1(sx1 - sx0)}" height="${f1(V(t.sideBottom) - V(t.sideTop))}" fill="${trim}"/>`);
    // moulded ribs, so the plastic reads as textured rather than painted
    for (const k of [0.33, 0.62]) {
      const vv = t.sideBottom + (t.sideTop - t.sideBottom) * k;
      b.push(`<rect x="${f1(sx0)}" y="${f1(V(vv))}" width="${f1(sx1 - sx0)}" height="${sw(0.006, 0.6)}" fill="#000000" fill-opacity="0.32"/>`);
      b.push(`<rect x="${f1(sx0)}" y="${f1(V(vv) + m(0.006))}" width="${f1(sx1 - sx0)}" height="${sw(0.004, 0.5)}" fill="#ffffff" fill-opacity="0.08"/>`);
    }
    // top edges: highlight, shadow line and the accent pinstripe
    for (const [x0, x1, vv] of [
      [U(-0.05), U(t.rearU), t.bumperTop],
      [sx0, sx1, t.sideTop],
      [U(t.frontU), U(1.05), t.bumperTop],
    ] as const) {
      b.push(`<rect x="${f1(x0)}" y="${f1(V(vv))}" width="${f1(x1 - x0)}" height="${sw(0.012)}" fill="#ffffff" fill-opacity="0.16"/>`);
      b.push(`<rect x="${f1(x0)}" y="${f1(V(vv) + m(0.012))}" width="${f1(x1 - x0)}" height="${sw(0.008)}" fill="#000000" fill-opacity="0.35"/>`);
      if (t.pinstripe) b.push(`<rect x="${f1(x0)}" y="${f1(V(vv) + m(0.034))}" width="${f1(x1 - x0)}" height="${sw(0.009)}" fill="${accent}" fill-opacity="0.95"/>`);
    }
  }
  b.push('</g>');
  // wheel-arch lips
  const lipColor = d.cladding >= 0.09 ? '#15171a' : mix(paint, '#000000', 0.32);
  for (const cx of [xR, xF]) {
    b.push(`<path d="${archArc(cx, ra + d.flare / 2, a0deg, a1deg)}" fill="none" stroke="${lipColor}" stroke-width="${sw(d.flare, 1)}"/>`);
    b.push(`<path d="${archArc(cx, ra + 0.003, a0deg, a1deg)}" fill="none" stroke="#000000" stroke-opacity="0.6" stroke-width="${sw(0.008)}"/>`);
  }
  // character lines and panel gaps
  for (const c of d.creases) {
    const p = smoothPath(px(c));
    b.push(`<path d="${p}" fill="none" stroke="#000000" stroke-opacity="0.3" stroke-width="${sw(0.009)}" stroke-linecap="round"/>`);
    b.push(`<path d="${p}" transform="translate(0 ${f1(m(0.009))})" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="${sw(0.006, 0.6)}" stroke-linecap="round"/>`);
  }
  for (const c of d.cuts) {
    const p = smoothPath(px(c));
    b.push(`<path d="${p}" fill="none" stroke="#000000" stroke-opacity="0.6" stroke-width="${sw(0.009)}" stroke-linecap="round"/>`);
    b.push(`<path d="${p}" transform="translate(${f1(m(0.007))} 0)" fill="none" stroke="#ffffff" stroke-opacity="0.13" stroke-width="${sw(0.004, 0.6)}" stroke-linecap="round"/>`);
  }
  for (const vent of d.vents) {
    const vp = smoothPath(px(vent), true);
    b.push(`<path d="${vp}" fill="#050607" stroke="${shade(paint, -0.62)}" stroke-width="${sw(0.016)}" stroke-linejoin="round"/>`);
    b.push(`<path d="${vp}" fill="url(#mesh)" fill-opacity="0.75"/>`);
    b.push(`<path d="${vp}" fill="url(#vsh)"/>`);
  }
  if (d.scoop) {
    const [u0, u1] = d.scoop;
    const base0 = outlineV(d, u0);
    const base1 = outlineV(d, u1);
    const hump: P[] = [
      [U(u0), V(base0 - 0.006), 1],
      [U(u0 + 0.035), V(base0 + 0.03)],
      [U((u0 + u1) / 2), V((base0 + base1) / 2 + 0.046)],
      [U(u1 - 0.012), V(base1 + 0.046), 1],
      [U(u1), V(base1 - 0.006), 1],
    ];
    b.push(`<path d="${smoothPath(hump, true)}" fill="${mix(paint, '#ffffff', lum < 0.2 ? 0.13 : 0.04)}" stroke="${shade(paint, -0.7)}" stroke-width="${sw(0.008)}" stroke-linejoin="round"/>`);
    b.push(`<path d="${polyPath([[U(u1 - 0.012), V(base1 + 0.042)], [U(u1), V(base1)], [U(u1 - 0.02), V(base1 + 0.002)], [U(u1 - 0.026), V(base1 + 0.036)]])}" fill="#040405"/>`);
  }
  // glass with interior
  glassPaths.forEach((g) => b.push(`<path d="${g}" fill="url(#gl)"/>`));
  b.push('<g clip-path="url(#cg)">');
  for (const su of d.seats) {
    const sx = U(su);
    const by = V(d.beltV - 0.12);
    const ty = V(d.beltV + 0.105);
    b.push(`<path d="${polyPath([[sx - m(0.06), by], [sx + m(0.07), by], [sx - m(0.01), ty], [sx - m(0.13), ty]])}" fill="#05070a" fill-opacity="0.9"/>`);
    b.push(`<rect x="${f1(sx - m(0.13))}" y="${f1(ty - m(0.15))}" width="${f1(m(0.11))}" height="${f1(m(0.14))}" rx="${f1(m(0.035))}" fill="#05070a" fill-opacity="0.9"/>`);
  }
  {
    const cx = U(d.wheelU);
    const cy = V(d.beltV + 0.01);
    b.push(`<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(m(0.035))}" ry="${f1(m(0.12))}" transform="rotate(-24 ${f1(cx)} ${f1(cy)})" fill="none" stroke="#05070a" stroke-opacity="0.9" stroke-width="${sw(0.024)}"/>`);
    // dashboard top
    b.push(`<path d="${polyPath([[cx + m(0.06), V(d.beltV - 0.02)], [U(1), V(d.beltV - 0.02)], [U(1), V(d.beltV + 0.045)], [cx + m(0.12), V(d.beltV + 0.05)]])}" fill="#05070a" fill-opacity="0.85"/>`);
  }
  for (const pl of d.pillars) {
    const x0 = U(pl.u);
    const x1 = U(pl.u + pl.lean);
    const hw = m(pl.w) / 2;
    b.push(`<path d="${polyPath([[x0 - hw, V(d.beltV - 0.03)], [x0 + hw, V(d.beltV - 0.03)], [x1 + hw, V(1)], [x1 - hw, V(1)]])}" fill="#090a0c"/>`);
  }
  b.push('</g>');
  glassPaths.forEach((g) => {
    b.push(`<path d="${g}" fill="none" stroke="#07080a" stroke-width="${sw(0.024)}" stroke-linejoin="round"/>`);
    b.push(`<path d="${g}" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="${sw(0.005, 0.5)}" stroke-linejoin="round"/>`);
  });
  for (const s of d.screens) {
    b.push(`<path d="${smoothPath(px(s))}" clip-path="url(#cb)" fill="none" stroke="#0c1519" stroke-opacity="0.9" stroke-width="${sw(0.034)}" stroke-linecap="round"/>`);
  }
  // lamps (unlit)
  const hlPx = px(d.headlight);
  const tlPx = px(d.taillight);
  const hlC = centroid(hlPx);
  const tlC = centroid(tlPx);
  const hlPath = smoothPath(hlPx, true);
  const tlPath = smoothPath(tlPx, true);
  b.push(`<path d="${hlPath}" fill="url(#hl)" stroke="#16181b" stroke-width="${sw(0.01)}" stroke-linejoin="round"/>`);
  b.push(`<path d="${smoothPath(scaleAbout(hlPx, hlC, 0.62), true)}" fill="#ffffff" fill-opacity="0.4"/>`);
  b.push(`<circle cx="${f1(hlC[0])}" cy="${f1(hlC[1])}" r="${f1(m(0.032))}" fill="#e9f2f7" stroke="#55606a" stroke-width="${sw(0.008, 0.6)}"/>`);
  b.push(`<circle cx="${f1(hlC[0])}" cy="${f1(hlC[1])}" r="${f1(m(0.014))}" fill="#8fa2b0"/>`);
  b.push(`<path d="${tlPath}" fill="url(#tl)" stroke="#23080a" stroke-width="${sw(0.01)}" stroke-linejoin="round"/>`);
  b.push(`<path d="${smoothPath(scaleAbout(tlPx, tlC, 0.55), true)}" fill="#ff6a60" fill-opacity="0.55"/>`);
  if (d.tailRibs) {
    const xs = tlPx.map((q) => q[0]);
    const ys = tlPx.map((q) => q[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    b.push(`<clipPath id="tlc"><path d="${tlPath}"/></clipPath><g clip-path="url(#tlc)">`);
    for (let i = 1; i <= d.tailRibs; i++) {
      const y = y0 + ((y1 - y0) * i) / (d.tailRibs + 1);
      b.push(`<rect x="${f1(x0)}" y="${f1(y)}" width="${f1(Math.max(...xs) - x0)}" height="${sw(0.008, 0.6)}" fill="#3a0306" fill-opacity="0.75"/>`);
    }
    b.push('</g>');
  }
  if (d.cornerLamp) {
    const cp = px(d.cornerLamp);
    b.push(`<path d="${smoothPath(cp, true)}" fill="#f0a12a" stroke="#3d2608" stroke-width="${sw(0.008, 0.6)}" stroke-linejoin="round"/>`);
    b.push(`<path d="${smoothPath(scaleAbout(cp, centroid(cp), 0.6), true)}" fill="#ffd27a" fill-opacity="0.55"/>`);
  }
  // side repeater, fuel door, handles
  if (d.marker) {
    const [mu, mv] = d.marker;
    b.push(`<rect x="${f1(U(mu) - m(0.035))}" y="${f1(V(mv) - m(0.011))}" width="${f1(m(0.07))}" height="${f1(m(0.022))}" rx="${f1(m(0.008))}" fill="#f2a52e" stroke="#5a3a10" stroke-width="${sw(0.004, 0.5)}"/>`);
  }
  if (d.fuelDoor) {
    const [fu, fv] = d.fuelDoor;
    b.push(`<rect x="${f1(U(fu) - m(0.065))}" y="${f1(V(fv) - m(0.065))}" width="${f1(m(0.13))}" height="${f1(m(0.13))}" rx="${f1(m(0.03))}" fill="none" stroke="#000000" stroke-opacity="0.42" stroke-width="${sw(0.007, 0.6)}"/>`);
  }
  for (const [hu, hv] of d.handles) {
    const hx = U(hu) - m(0.07);
    const hy = V(hv) - m(0.013);
    b.push(`<rect x="${f1(hx)}" y="${f1(hy + m(0.012))}" width="${f1(m(0.14))}" height="${f1(m(0.026))}" rx="${f1(m(0.012))}" fill="#000000" fill-opacity="0.35"/>`);
    b.push(`<rect x="${f1(hx)}" y="${f1(hy)}" width="${f1(m(0.14))}" height="${f1(m(0.026))}" rx="${f1(m(0.012))}" fill="${lum > 0.55 ? shade(paint, -0.28) : mix(paint, '#ffffff', 0.32)}"/>`);
  }
  for (const bd of d.badges ?? []) {
    const fs = m(bd.size);
    const attrs = `x="${f1(U(bd.u))}" y="${f1(V(bd.v))}" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-style="italic" font-size="${f1(fs)}" letter-spacing="${f1(fs * 0.06)}"`;
    b.push(`<text ${attrs} fill="#000000" fill-opacity="0.55" transform="translate(${f1(m(0.004))} ${f1(m(0.004))})">${bd.text}</text>`);
    b.push(`<text ${attrs} fill="${bd.color}">${bd.text}</text>`);
  }
  // door mirror
  {
    const [mu, mv] = d.mirror;
    const cx = U(mu);
    const cy = V(mv);
    b.push(`<path d="${polyPath([[cx - m(0.04), cy + m(0.075)], [cx + m(0.06), cy + m(0.075)], [cx + m(0.03), cy + m(0.02)], [cx - m(0.02), cy + m(0.02)]])}" fill="#0b0c0e"/>`);
    b.push(
      `<rect x="${f1(cx - m(0.1))}" y="${f1(cy - m(0.058))}" width="${f1(m(0.21))}" height="${f1(m(0.115))}" rx="${f1(m(0.045))}" transform="rotate(-5 ${f1(cx)} ${f1(cy)})" fill="url(#pg)" stroke="${shade(paint, -0.7)}" stroke-width="${sw(0.008)}"/>`,
    );
    b.push(`<rect x="${f1(cx - m(0.1))}" y="${f1(cy + m(0.02))}" width="${f1(m(0.21))}" height="${f1(m(0.037))}" rx="${f1(m(0.018))}" transform="rotate(-5 ${f1(cx)} ${f1(cy)})" fill="#000000" fill-opacity="0.35"/>`);
  }
  // aero
  {
    const bx = U(d.spoilerAt[0]);
    const by = V(d.spoilerAt[1]);
    const rel = (pts: [number, number][]): string => polyPath(pts.map(([dx, dy]) => [bx + m(dx), by - m(dy)] as [number, number]));
    const dark = shade(paint, -0.72);
    switch (d.spoiler) {
      case 'roof':
        b.push(`<path d="${rel([[0.06, 0.012], [-0.07, -0.05], [-0.085, -0.03], [0.0, 0.045]])}" fill="${d.spoilerColor === 'black' ? '#141618' : shade(paint, -0.18)}" stroke="${dark}" stroke-width="${sw(0.008)}" stroke-linejoin="round"/>`);
        break;
      case 'hatchLip':
        // slim lip that carries the roof line a few centimetres past the top of the hatch glass
        b.push(`<path d="${rel([[0.07, 0.006], [-0.02, 0.008], [-0.09, -0.006], [-0.095, -0.024], [-0.02, -0.03], [0.04, -0.02]])}" fill="${d.spoilerColor === 'black' ? '#141618' : shade(paint, -0.18)}" stroke="${dark}" stroke-width="${sw(0.007)}" stroke-linejoin="round"/>`);
        b.push(`<path d="${rel([[0.05, 0.003], [-0.02, 0.005], [-0.08, -0.006]])}" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="${sw(0.006)}" stroke-linecap="round"/>`);
        break;
      case 'roofBig':
        b.push(`<path d="${rel([[0.08, 0.018], [-0.13, -0.075], [-0.165, -0.06], [-0.15, -0.02], [0.0, 0.055]])}" fill="${shade(paint, -0.1)}" stroke="${dark}" stroke-width="${sw(0.008)}" stroke-linejoin="round"/>`);
        b.push(`<path d="${rel([[-0.07, -0.05], [-0.165, -0.085], [-0.17, -0.015], [-0.09, 0.012]])}" fill="#0f1113" stroke="#000000" stroke-width="${sw(0.006)}" stroke-linejoin="round"/>`);
        break;
      case 'lip':
        b.push(`<path d="${rel([[0.11, 0.002], [0.0, -0.004], [-0.012, 0.03], [0.018, 0.034], [0.12, 0.012]])}" fill="${shade(paint, -0.08)}" stroke="${dark}" stroke-width="${sw(0.007)}" stroke-linejoin="round"/>`);
        break;
      case 'ducktail':
        b.push(`<path d="${rel([[0.17, 0.002], [0.0, -0.004], [-0.022, 0.055], [0.012, 0.058], [0.18, 0.014]])}" fill="${shade(paint, -0.2)}" stroke="${dark}" stroke-width="${sw(0.007)}" stroke-linejoin="round"/>`);
        break;
      case 'wing':
        b.push(`<path d="${rel([[0.07, -0.01], [0.15, -0.01], [0.1, 0.13], [0.02, 0.19], [0.0, 0.17], [0.07, 0.11]])}" fill="#0c0d0f" stroke="#000000" stroke-width="${sw(0.006)}" stroke-linejoin="round"/>`);
        b.push(`<path d="${rel([[-0.17, 0.155], [0.17, 0.185], [0.2, 0.215], [0.16, 0.235], [-0.18, 0.2]])}" fill="${shade(paint, -0.12)}" stroke="${dark}" stroke-width="${sw(0.006)}" stroke-linejoin="round"/>`);
        b.push(`<path d="${rel([[-0.19, 0.12], [-0.06, 0.13], [-0.03, 0.245], [-0.2, 0.235]])}" fill="${mix(accent, '#000000', 0.1)}" stroke="#000000" stroke-width="${sw(0.007)}" stroke-linejoin="round"/>`);
        b.push(`<path d="${rel([[-0.165, 0.19], [0.16, 0.222], [0.165, 0.23], [-0.17, 0.198]])}" fill="#ffffff" fill-opacity="0.3"/>`);
        break;
      case 'none':
        break;
    }
  }
  b.push(`<path d="${bodyPath}" fill="none" stroke="${shade(paint, -0.75)}" stroke-opacity="0.9" stroke-width="${sw(0.011, 1)}" stroke-linejoin="round"/>`);

  // ------------------------------------------------------------------ exhaust tips
  const tips: string[] = [];
  const exhausts: { x: number; y: number }[] = [];
  const dual = car.exhaust.layout === 'dual';
  if (d.exhaust.side) {
    const xe = U(d.exhaust.u);
    const ye = V(d.exhaust.v);
    for (let i = dual ? 1 : 0; i >= 0; i--) {
      const oy = -i * m(0.05);
      const ox = i * m(0.05);
      tips.push(`<path d="${polyPath([[xe + ox - m(0.02), ye - m(0.022) + oy], [xe + ox + m(0.42), ye - m(0.022) + oy], [xe + ox + m(0.42), ye + m(0.024) + oy], [xe + ox + m(0.012), ye + m(0.024) + oy]])}" fill="url(#chrome)" stroke="#1b1d20" stroke-width="${sw(0.005, 0.6)}" stroke-linejoin="round"/>`);
      tips.push(`<ellipse cx="${f1(xe + ox - m(0.003))}" cy="${f1(ye + oy)}" rx="${f1(m(0.014))}" ry="${f1(m(0.023))}" fill="#060606" stroke="#c9ced3" stroke-width="${sw(0.005, 0.6)}"/>`);
    }
    exhausts.push({ x: d.exhaust.u * L - xF - 0.02, y: yb + d.exhaust.v * Hb });
  } else {
    const xe = U(d.exhaust.u) - m(0.05);
    const ye = V(d.exhaust.v);
    for (let i = dual ? 1 : 0; i >= 0; i--) {
      const ox = i * m(0.03);
      const oy = -i * m(0.082);
      tips.push(`<rect x="${f1(xe + ox)}" y="${f1(ye - m(0.034) + oy)}" width="${f1(m(0.16))}" height="${f1(m(0.068))}" rx="${f1(m(0.016))}" fill="url(#chrome)" stroke="#1b1d20" stroke-width="${sw(0.006, 0.6)}"/>`);
      tips.push(`<ellipse cx="${f1(xe + ox + m(0.006))}" cy="${f1(ye + oy)}" rx="${f1(m(0.012))}" ry="${f1(m(0.028))}" fill="#060606" stroke="#c9ced3" stroke-width="${sw(0.005, 0.5)}"/>`);
    }
    exhausts.push({ x: d.exhaust.u * L - xF - 0.05, y: yb + d.exhaust.v * Hb });
  }

  // ------------------------------------------------------------------ UNDER
  const un: string[] = [];
  un.push(`<defs>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fafbfc"/>
      <stop offset="0.38" stop-color="#8b9299"/>
      <stop offset="0.55" stop-color="#e3e7ea"/>
      <stop offset="1" stop-color="#4a4f55"/>
    </linearGradient>
    <radialGradient id="well" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#010101"/>
      <stop offset="0.8" stop-color="#0a0c0e"/>
      <stop offset="1" stop-color="#15181b"/>
    </radialGradient>
  </defs>`);
  for (const cx of [xR, xF]) un.push(`<circle cx="${f1(X(cx))}" cy="${f1(Y(ay))}" r="${f1(m(ra - 0.004))}" fill="url(#well)"/>`);
  un.push(`<rect x="${f1(X(xR - 0.25))}" y="${f1(Y(yb + 0.14))}" width="${f1(m(xF - xR + 0.5))}" height="${f1(m(0.16))}" rx="${f1(m(0.02))}" fill="#07080a"/>`);
  un.push(...tips);

  // ------------------------------------------------------------------ GLOSS (white only)
  const g: string[] = [];
  g.push(`<defs>${clips}${blur('b1', m(0.014))}${blur('b0', m(0.005))}
    <linearGradient id="gt" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(V(0.97))}" x2="0" y2="${f1(V(d.beltV + 0.06))}">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>`);
  g.push('<g clip-path="url(#cb)">');
  const shPath = smoothPath(px(d.shoulder));
  g.push(`<path d="${shPath}" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="${f1(m(0.055))}" stroke-linecap="round" filter="url(#b1)"/>`);
  g.push(`<path d="${shPath}" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="${sw(0.009)}" stroke-linecap="round"/>`);
  g.push(`<path d="${smoothPath(out)}" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="${f1(m(0.05))}" filter="url(#b1)"/>`);
  for (const cx of [xR, xF]) {
    g.push(`<path d="${archArc(cx, ra + d.flare + 0.014, 205, 335)}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="${sw(0.014)}" stroke-linecap="round" filter="url(#b0)"/>`);
  }
  g.push('</g>');
  g.push('<g clip-path="url(#cg)">');
  d.glass.forEach((gs) => {
    const p = px(gs);
    const x0 = Math.min(...p.map((q) => q[0]));
    const x1 = Math.max(...p.map((q) => q[0]));
    const y0 = Math.min(...p.map((q) => q[1]));
    const y1 = Math.max(...p.map((q) => q[1]));
    const gw = x1 - x0;
    const gh = y1 - y0;
    g.push(`<rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(gw)}" height="${f1(gh)}" fill="url(#gt)"/>`);
    for (const [s, wd, op] of [
      [0.3, 0.1, 0.17],
      [0.46, 0.035, 0.11],
    ] as const) {
      const sx = x0 + gw * s;
      g.push(`<path d="${polyPath([[sx, y1], [sx + gw * wd, y1], [sx + gw * wd + gh * 0.7, y0], [sx + gh * 0.7, y0]])}" fill="#ffffff" fill-opacity="${op}"/>`);
    }
  });
  g.push('</g>');
  g.push(`<ellipse cx="${f1(hlC[0] - m(0.02))}" cy="${f1(hlC[1] - m(0.015))}" rx="${f1(m(0.03))}" ry="${f1(m(0.012))}" fill="#ffffff" fill-opacity="0.75"/>`);

  // ------------------------------------------------------------------ LIGHTS and BRAKE (additive)
  const lampDefs = `<defs>${blur('h1', m(0.07))}${blur('h2', m(0.05))}${blur('h3', m(0.1))}
    <radialGradient id="hg"><stop offset="0" stop-color="#fff3c4" stop-opacity="0.5"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient>
    <radialGradient id="tg"><stop offset="0" stop-color="#ff2414" stop-opacity="0.3"/><stop offset="1" stop-color="#ff2414" stop-opacity="0"/></radialGradient>
  </defs>`;
  const li = [
    lampDefs,
    `<circle cx="${f1(hlC[0])}" cy="${f1(hlC[1])}" r="${f1(m(0.3))}" fill="url(#hg)"/>`,
    `<path d="${hlPath}" fill="#ffeeb0" filter="url(#h1)"/>`,
    `<path d="${hlPath}" fill="#fffaea"/>`,
    `<circle cx="${f1(tlC[0])}" cy="${f1(tlC[1])}" r="${f1(m(0.2))}" fill="url(#tg)"/>`,
    `<path d="${tlPath}" fill="#ff2a1c" fill-opacity="0.85" filter="url(#h2)"/>`,
    `<path d="${tlPath}" fill="#ff4a3c" fill-opacity="0.9"/>`,
  ];
  const br = [
    lampDefs,
    `<circle cx="${f1(tlC[0])}" cy="${f1(tlC[1])}" r="${f1(m(0.26))}" fill="url(#tg)"/>`,
    `<path d="${tlPath}" fill="#ff2a10" fill-opacity="0.7" filter="url(#h2)"/>`,
    `<path d="${tlPath}" fill="#ff8a70"/>`,
  ];

  // ------------------------------------------------------------------ SHADOW
  const shW = Math.ceil((L + 1.4) * S);
  const shH = Math.ceil(1.1 * S);
  const shadow = svgDoc(
    shW,
    shH,
    `<defs><filter id="s1" filterUnits="userSpaceOnUse" x="0" y="0" width="${shW}" height="${shH}"><feGaussianBlur stdDeviation="${f2(m(0.085))}"/></filter>
     <filter id="s2" filterUnits="userSpaceOnUse" x="0" y="0" width="${shW}" height="${shH}"><feGaussianBlur stdDeviation="${f2(m(0.03))}"/></filter></defs>
     <ellipse cx="${f1(shW / 2)}" cy="${f1(shH / 2)}" rx="${f1(m(L / 2 + 0.1))}" ry="${f1(m(0.22))}" fill="#000000" fill-opacity="0.62" filter="url(#s1)"/>
     <ellipse cx="${f1(shW / 2)}" cy="${f1(shH / 2 + m(0.04))}" rx="${f1(m(L / 2 - 0.12))}" ry="${f1(m(0.1))}" fill="#000000" fill-opacity="0.8" filter="url(#s2)"/>`,
  );

  const toM = (p: readonly [number, number]): { x: number; y: number } => ({ x: p[0] / S - mr - xF, y: H + mt - p[1] / S });
  return {
    w: W,
    h: Hp,
    under: svgDoc(W, Hp, un.join('')),
    body: svgDoc(W, Hp, b.join('')),
    gloss: svgDoc(W, Hp, g.join('')),
    lights: svgDoc(W, Hp, li.join('')),
    brake: svgDoc(W, Hp, br.join('')),
    shadow: { svg: shadow, w: shW, h: shH },
    originX: X(xF),
    originY: Y(0),
    exhausts,
    headlight: toM(hlC),
    taillight: toM(tlC),
    roofY: H,
    rearX: -xF,
    noseX: L - xF,
  };
}
