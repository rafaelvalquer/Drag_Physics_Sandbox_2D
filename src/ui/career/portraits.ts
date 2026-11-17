import type { PortraitId } from '../../game/career/CareerEvents';

/**
 * Semi-realistic character portraits, drawn as layered SVG (no photos, no third-party art).
 * Every portrait is built by the same painter from a few anatomical parameters: face width and jaw,
 * skin tone with a light/shadow ramp, eye shape and iris, brows, nose, mouth, hair style, facial
 * hair, clothing and a night-lit backdrop. Light comes from the upper left (sodium street light)
 * with a cool rim light on the right, which is what gives the volume.
 */
interface PortraitParams {
  skin: string;
  skinShadow: string;
  skinLight: string;
  hair: string;
  hairLight: string;
  iris: string;
  lips: string;
  /** Face half-width at the cheekbones (px, of a 200×240 canvas). */
  faceW: number;
  /** Jaw half-width (px). */
  jawW: number;
  /** Chin y (px). */
  chinY: number;
  /** 0 feminine … 1 masculine (brow thickness, nose width, jaw angle). */
  masc: number;
  hairStyle: 'ponytail' | 'bob' | 'curly' | 'short' | 'undercut' | 'slick-grey' | 'cap' | 'bun';
  facial?: 'stubble' | 'beard' | 'mustache' | 'goatee';
  facialColor?: string;
  glasses?: boolean;
  earrings?: boolean;
  age: number;
  cloth: string;
  clothLight: string;
  clothStyle: 'overall' | 'hoodie' | 'tee' | 'jacket' | 'leather' | 'shirt';
  accent: string;
  bg: [string, string];
  /** Small head tilt (deg) and gaze offset (px) for character. */
  tilt: number;
  gaze: number;
  expression: 'smirk' | 'neutral' | 'smile' | 'serious';
}

const P: Record<PortraitId, PortraitParams> = {
  nina: {
    skin: '#b97f5a', skinShadow: '#8a5638', skinLight: '#d9a27c', hair: '#1d1512', hairLight: '#4a352a', iris: '#4a2f1b', lips: '#9a5546',
    faceW: 44, jawW: 31, chinY: 170, masc: 0.15, hairStyle: 'bun', age: 34, earrings: true,
    cloth: '#2f4a5e', clothLight: '#4c6d85', clothStyle: 'overall', accent: '#f2b705', bg: ['#2a2016', '#0c0d10'], tilt: -2, gaze: 1, expression: 'smirk',
  },
  lara: {
    skin: '#e8b99a', skinShadow: '#c08868', skinLight: '#f6d3bb', hair: '#8e2a16', hairLight: '#c8502c', iris: '#3f6b3a', lips: '#b4505a',
    faceW: 41, jawW: 28, chinY: 168, masc: 0, hairStyle: 'ponytail', age: 22, earrings: true,
    cloth: '#1d1f24', clothLight: '#3a3e47', clothStyle: 'hoodie', accent: '#c8322b', bg: ['#3a1612', '#0c0b0e'], tilt: 3, gaze: -2, expression: 'smirk',
  },
  eduardo: {
    skin: '#7a4a2e', skinShadow: '#55301c', skinLight: '#9c6845', hair: '#120d0a', hairLight: '#3a2a20', iris: '#2a1a10', lips: '#6a3a2c',
    faceW: 45, jawW: 33, chinY: 172, masc: 0.75, hairStyle: 'curly', age: 25,
    cloth: '#e7e4da', clothLight: '#ffffff', clothStyle: 'tee', accent: '#2f6b3a', bg: ['#1c2a22', '#0b0d0c'], tilt: -1, gaze: 0, expression: 'smile',
  },
  roberto: {
    skin: '#d7a684', skinShadow: '#a8765a', skinLight: '#ecc4a6', hair: '#5b5048', hairLight: '#8d8279', iris: '#4b3a2a', lips: '#9c6458',
    faceW: 46, jawW: 35, chinY: 174, masc: 0.9, hairStyle: 'short', facial: 'mustache', facialColor: '#4d433c', glasses: true, age: 52,
    cloth: '#2f5d8a', clothLight: '#4e7fb0', clothStyle: 'shirt', accent: '#c9c9c9', bg: ['#16202e', '#0a0c10'], tilt: 0, gaze: 0, expression: 'neutral',
  },
  fernando: {
    skin: '#c48e68', skinShadow: '#946144', skinLight: '#dfae88', hair: '#2a1d14', hairLight: '#54402f', iris: '#3b2616', lips: '#8e5646',
    faceW: 48, jawW: 37, chinY: 176, masc: 1, hairStyle: 'cap', facial: 'beard', facialColor: '#2b1e15', age: 41,
    cloth: '#7a5a2e', clothLight: '#a07a44', clothStyle: 'jacket', accent: '#e0c27a', bg: ['#2a1f12', '#0d0b09'], tilt: 2, gaze: 1, expression: 'smile',
  },
  leonardo: {
    skin: '#e2b08e', skinShadow: '#b5805f', skinLight: '#f2cdb0', hair: '#14110f', hairLight: '#3a332c', iris: '#26384a', lips: '#a46658',
    faceW: 43, jawW: 33, chinY: 172, masc: 0.85, hairStyle: 'undercut', facial: 'stubble', facialColor: '#3a2e26', age: 27,
    cloth: '#101215', clothLight: '#2a2e35', clothStyle: 'jacket', accent: '#c9a227', bg: ['#1e1a0e', '#09090b'], tilt: -3, gaze: -1, expression: 'smirk',
  },
  paula: {
    skin: '#9a6444', skinShadow: '#6e4129', skinLight: '#bb8462', hair: '#0f0b09', hairLight: '#3b2c24', iris: '#3a2312', lips: '#7d3c36',
    faceW: 42, jawW: 29, chinY: 169, masc: 0.1, hairStyle: 'bob', earrings: true, age: 31,
    cloth: '#d8d9d6', clothLight: '#f4f4f2', clothStyle: 'jacket', accent: '#b0182a', bg: ['#2b1016', '#0b0a0c'], tilt: 1, gaze: 2, expression: 'serious',
  },
  marcos: {
    skin: '#c99777', skinShadow: '#976646', skinLight: '#e2b597', hair: '#9b9894', hairLight: '#d0cdc8', iris: '#2c2a26', lips: '#8a5a4c',
    faceW: 47, jawW: 37, chinY: 176, masc: 1, hairStyle: 'slick-grey', facial: 'stubble', facialColor: '#8d8a86', age: 54,
    cloth: '#0d0f12', clothLight: '#2d3138', clothStyle: 'leather', accent: '#8f1c1c', bg: ['#2a0c0c', '#070708'], tilt: 0, gaze: 0, expression: 'serious',
  },
  // ---- chapter 2 (blue-white LED backdrops of the league)
  caio: {
    skin: '#a8714e', skinShadow: '#7a4b30', skinLight: '#c78f6a', hair: '#15100c', hairLight: '#3e2f24', iris: '#3a2414', lips: '#85503f',
    faceW: 44, jawW: 32, chinY: 171, masc: 0.8, hairStyle: 'short', facial: 'goatee', facialColor: '#1b1410', glasses: true, age: 29,
    cloth: '#1b2430', clothLight: '#334457', clothStyle: 'hoodie', accent: '#3fa8ff', bg: ['#0f1e30', '#07090d'], tilt: -2, gaze: 1, expression: 'smile',
  },
  guga: {
    skin: '#dcaa86', skinShadow: '#ab7a5a', skinLight: '#efc6a6', hair: '#3a2a1c', hairLight: '#6a5038', iris: '#3d2b1a', lips: '#98604f',
    faceW: 46, jawW: 35, chinY: 174, masc: 0.9, hairStyle: 'short', facial: 'stubble', facialColor: '#3a2a1c', age: 30,
    cloth: '#20324f', clothLight: '#38507a', clothStyle: 'tee', accent: '#e0b43a', bg: ['#162238', '#08090d'], tilt: 1, gaze: 0, expression: 'smile',
  },
  camila: {
    skin: '#f0c7a8', skinShadow: '#c79473', skinLight: '#fbdcc4', hair: '#d9b77a', hairLight: '#f2d89e', iris: '#4c6a86', lips: '#c0606a',
    faceW: 41, jawW: 28, chinY: 168, masc: 0, hairStyle: 'ponytail', earrings: true, age: 26,
    cloth: '#e9e9e6', clothLight: '#ffffff', clothStyle: 'jacket', accent: '#1c1f24', bg: ['#1c2436', '#0a0b0e'], tilt: -3, gaze: 2, expression: 'smirk',
  },
  ricardo: {
    skin: '#d39f7c', skinShadow: '#a26f50', skinLight: '#e8bc9a', hair: '#4a4038', hairLight: '#7a6e64', iris: '#2f3f2a', lips: '#93604f',
    faceW: 47, jawW: 36, chinY: 175, masc: 0.95, hairStyle: 'short', facial: 'beard', facialColor: '#5b5048', age: 45,
    cloth: '#b0182a', clothLight: '#d43a4a', clothStyle: 'jacket', accent: '#1a1a1a', bg: ['#2a1216', '#09080a'], tilt: 0, gaze: -1, expression: 'neutral',
  },
  andre: {
    skin: '#8a5636', skinShadow: '#5f3720', skinLight: '#a87252', hair: '#0f0b08', hairLight: '#33261d', iris: '#2a1a0e', lips: '#6f3e2e',
    faceW: 45, jawW: 33, chinY: 172, masc: 0.85, hairStyle: 'undercut', age: 33,
    cloth: '#2a2e35', clothLight: '#474d57', clothStyle: 'shirt', accent: '#8f969e', bg: ['#1a2030', '#08090c'], tilt: 2, gaze: 0, expression: 'serious',
  },
  helena: {
    skin: '#e6b897', skinShadow: '#b98767', skinLight: '#f5d2b8', hair: '#1a1411', hairLight: '#4a3a30', iris: '#3a2a1c', lips: '#a24f55',
    faceW: 42, jawW: 29, chinY: 169, masc: 0.05, hairStyle: 'bob', earrings: true, age: 38,
    cloth: '#121417', clothLight: '#2c3036', clothStyle: 'jacket', accent: '#c9ccd0', bg: ['#141a26', '#07080b'], tilt: 0, gaze: 1, expression: 'serious',
  },
  daniel: {
    skin: '#c8926c', skinShadow: '#976448', skinLight: '#e0b08c', hair: '#21170f', hairLight: '#4c3a2b', iris: '#26384a', lips: '#8c5848',
    faceW: 45, jawW: 34, chinY: 173, masc: 0.9, hairStyle: 'cap', facial: 'stubble', facialColor: '#2a1e15', age: 28,
    cloth: '#1f4e8c', clothLight: '#3a6fb0', clothStyle: 'hoodie', accent: '#e8e8e8', bg: ['#10203a', '#07080c'], tilt: -2, gaze: -2, expression: 'smirk',
  },
  lucas: {
    skin: '#e9c09f', skinShadow: '#bb8d6c', skinLight: '#f7d8be', hair: '#0e0c0b', hairLight: '#2f2a26', iris: '#2b1c12', lips: '#a3675a',
    faceW: 42, jawW: 31, chinY: 170, masc: 0.75, hairStyle: 'undercut', age: 23,
    cloth: '#d4d6d8', clothLight: '#f2f3f4', clothStyle: 'tee', accent: '#b0182a', bg: ['#251418', '#09080a'], tilt: 3, gaze: 1, expression: 'smile',
  },
  felipe: {
    skin: '#b47c58', skinShadow: '#85523a', skinLight: '#d09a76', hair: '#2c2018', hairLight: '#5a4636', iris: '#2c1d12', lips: '#8a5040',
    faceW: 44, jawW: 33, chinY: 172, masc: 0.85, hairStyle: 'short', glasses: true, age: 35,
    cloth: '#e7e8e6', clothLight: '#ffffff', clothStyle: 'shirt', accent: '#20242a', bg: ['#16202e', '#08090c'], tilt: 0, gaze: 0, expression: 'neutral',
  },
  bianca: {
    skin: '#6f4329', skinShadow: '#4b2a18', skinLight: '#8f5d3f', hair: '#0c0907', hairLight: '#30241c', iris: '#26170c', lips: '#6a3328',
    faceW: 42, jawW: 29, chinY: 169, masc: 0.05, hairStyle: 'curly', earrings: true, age: 29,
    cloth: '#16181b', clothLight: '#30343a', clothStyle: 'leather', accent: '#c8322b', bg: ['#2a1014', '#08070a'], tilt: -1, gaze: -1, expression: 'smirk',
  },
  victor: {
    skin: '#d6a483', skinShadow: '#a57352', skinLight: '#ebc2a3', hair: '#2a2622', hairLight: '#6a645e', iris: '#2a3442', lips: '#8e5c4e',
    faceW: 47, jawW: 37, chinY: 176, masc: 1, hairStyle: 'slick-grey', facial: 'beard', facialColor: '#3a3632', age: 47,
    cloth: '#0d0f12', clothLight: '#2a2f37', clothStyle: 'jacket', accent: '#3a6fb0', bg: ['#0e1a2e', '#060709'], tilt: 0, gaze: 0, expression: 'serious',
  },
};

const cache = new Map<PortraitId, string>();

export function portraitSvg(id: PortraitId): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const s = paint(id, P[id]);
  cache.set(id, s);
  return s;
}

export const PORTRAIT_IDS = Object.keys(P) as PortraitId[];

function paint(id: string, p: PortraitParams): string {
  const u = `pt-${id}`;
  const cx = 100;
  const eyeY = 112;
  const fw = p.faceW;
  const jw = p.jawW;
  const cy = p.chinY;
  const m = p.masc;
  // head outline: temples → cheekbones → jaw angle → chin
  const head = `M${cx - fw + 3} 86 C${cx - fw - 2} 104 ${cx - fw} 124 ${cx - jw - 2} ${148 - m * 4} C${cx - jw + 6 - m * 4} ${160 + m * 2} ${cx - 14} ${cy - 2} ${cx} ${cy} C${cx + 14} ${cy - 2} ${cx + jw - 6 + m * 4} ${160 + m * 2} ${cx + jw + 2} ${148 - m * 4} C${cx + fw} 124 ${cx + fw + 2} 104 ${cx + fw - 3} 86 C${cx + fw - 8} 52 ${cx - fw + 8} 52 ${cx - fw + 3} 86 Z`;
  const neckW = 17 + m * 6;
  const defs = `
  <defs>
    <radialGradient id="${u}-bg" cx="0.3" cy="0.25" r="0.95">
      <stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/>
    </radialGradient>
    <radialGradient id="${u}-skin" cx="0.36" cy="0.36" r="0.75">
      <stop offset="0" stop-color="${p.skinLight}"/><stop offset="0.55" stop-color="${p.skin}"/><stop offset="1" stop-color="${p.skinShadow}"/>
    </radialGradient>
    <linearGradient id="${u}-neck" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.skin}"/><stop offset="0.7" stop-color="${p.skinShadow}"/><stop offset="1" stop-color="${p.skinShadow}"/>
    </linearGradient>
    <linearGradient id="${u}-hair" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${p.hairLight}"/><stop offset="0.45" stop-color="${p.hair}"/><stop offset="1" stop-color="${p.hair}"/>
    </linearGradient>
    <linearGradient id="${u}-cloth" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="${p.clothLight}"/><stop offset="0.6" stop-color="${p.cloth}"/><stop offset="1" stop-color="${shade(p.cloth, -0.35)}"/>
    </linearGradient>
    <radialGradient id="${u}-iris" cx="0.4" cy="0.4" r="0.6">
      <stop offset="0" stop-color="${shade(p.iris, 0.5)}"/><stop offset="0.7" stop-color="${p.iris}"/><stop offset="1" stop-color="${shade(p.iris, -0.5)}"/>
    </radialGradient>
    <linearGradient id="${u}-rim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.75" stop-color="#7fb8ff" stop-opacity="0"/><stop offset="1" stop-color="#9cc8ff" stop-opacity="0.32"/>
    </linearGradient>
    <linearGradient id="${u}-lips" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(p.lips, -0.15)}"/><stop offset="1" stop-color="${shade(p.lips, 0.12)}"/>
    </linearGradient>
    <filter id="${u}-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="${u}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
    <clipPath id="${u}-face"><path d="${head}"/></clipPath>
  </defs>`;

  const bg = `<rect width="200" height="240" fill="url(#${u}-bg)"/>
  <circle cx="34" cy="30" r="26" fill="${p.accent}" opacity="0.10" filter="url(#${u}-blur)"/>
  <circle cx="176" cy="70" r="14" fill="#9cc8ff" opacity="0.08" filter="url(#${u}-blur)"/>`;

  const backHair = hairBack(p, u, cx);
  const body = clothing(p, u, cx, neckW);
  const neck = `<path d="M${cx - neckW} 150 L${cx - neckW + 1} 196 Q${cx} 206 ${cx + neckW - 1} 196 L${cx + neckW} 150 Z" fill="url(#${u}-neck)"/>
  <path d="M${cx - neckW + 2} 176 Q${cx} ${186 + m * 3} ${cx + neckW - 2} 176" fill="none" stroke="${p.skinShadow}" stroke-width="3" opacity="0.35" filter="url(#${u}-soft)"/>`;
  const ears = `<path d="M${cx - fw + 2} 108 C${cx - fw - 9} 104 ${cx - fw - 10} 128 ${cx - fw + 1} 134 Z" fill="${p.skin}" stroke="${p.skinShadow}" stroke-width="1"/>
  <path d="M${cx + fw - 2} 108 C${cx + fw + 9} 104 ${cx + fw + 10} 128 ${cx + fw - 1} 134 Z" fill="${p.skinShadow}" stroke="${shade(p.skinShadow, -0.2)}" stroke-width="1"/>
  ${p.earrings ? `<circle cx="${cx - fw - 3}" cy="137" r="2.6" fill="#e8d28a"/><circle cx="${cx + fw + 3}" cy="137" r="2.6" fill="#b49a52"/>` : ''}`;

  // face volume: base gradient + shadow on the right side and under the cheekbones + highlights
  const face = `<path d="${head}" fill="url(#${u}-skin)"/>
  <g clip-path="url(#${u}-face)">
    <ellipse cx="${cx + fw * 0.85}" cy="128" rx="${fw * 0.55}" ry="58" fill="${p.skinShadow}" opacity="0.5" filter="url(#${u}-blur)"/>
    <ellipse cx="${cx - 26}" cy="140" rx="10" ry="7" fill="${p.skinShadow}" opacity="${0.18 + m * 0.12}" filter="url(#${u}-blur)"/>
    <ellipse cx="${cx + 26}" cy="140" rx="10" ry="7" fill="${p.skinShadow}" opacity="${0.25 + m * 0.12}" filter="url(#${u}-blur)"/>
    <ellipse cx="${cx - 18}" cy="88" rx="16" ry="9" fill="${p.skinLight}" opacity="0.45" filter="url(#${u}-blur)"/>
    <ellipse cx="${cx - 24}" cy="128" rx="9" ry="6" fill="${m < 0.5 ? shade(p.lips, 0.2) : p.skinLight}" opacity="${m < 0.5 ? 0.22 : 0.25}" filter="url(#${u}-blur)"/>
    <rect x="0" y="0" width="200" height="240" fill="url(#${u}-rim)"/>
    ${p.age > 45 ? wrinkles(p, cx, eyeY) : ''}
    ${facialHair(p, u, cx, cy)}
  </g>`;

  const g = p.gaze;
  const eye = (x: number, side: -1 | 1): string => {
    const w = 11 - m * 0.8;
    const hgt = 4.6 - m * 0.6;
    const lid = side === 1 ? 0.25 : 0;
    return `<g>
      <path d="M${x - w} ${eyeY} Q${x} ${eyeY - hgt * 1.7} ${x + w} ${eyeY - 0.6} Q${x} ${eyeY + hgt * 1.2} ${x - w} ${eyeY} Z" fill="#efe9e2"/>
      <circle cx="${x + g}" cy="${eyeY - 0.4}" r="${4.3}" fill="url(#${u}-iris)"/>
      <circle cx="${x + g}" cy="${eyeY - 0.4}" r="1.9" fill="#0b0908"/>
      <circle cx="${x + g - 1.4}" cy="${eyeY - 1.9}" r="1.05" fill="#fff" opacity="0.9"/>
      <path d="M${x - w} ${eyeY} Q${x} ${eyeY - hgt * 1.7} ${x + w} ${eyeY - 0.6}" fill="none" stroke="${shade(p.skinShadow, -0.55)}" stroke-width="${m < 0.5 ? 2.2 : 1.6}" stroke-linecap="round"/>
      ${m < 0.5 ? `<path d="M${x + side * (w - 1)} ${eyeY - 1.5} l${side * 3} -2.2" stroke="${shade(p.skinShadow, -0.6)}" stroke-width="1.4" stroke-linecap="round"/>` : ''}
      <path d="M${x - w + 1} ${eyeY - hgt * 1.7 - 2.5} Q${x} ${eyeY - hgt * 2.6 - 2} ${x + w - 1} ${eyeY - hgt * 1.3 - 2}" fill="none" stroke="${p.skinShadow}" stroke-width="1" opacity="${0.45 + lid}"/>
      <path d="M${x - w + 3} ${eyeY + hgt + 2} Q${x} ${eyeY + hgt + 4} ${x + w - 2} ${eyeY + hgt + 1}" fill="none" stroke="${p.skinShadow}" stroke-width="0.9" opacity="${p.age > 40 ? 0.6 : 0.3}"/>
    </g>`;
  };
  const browY = eyeY - 13 - (p.expression === 'serious' ? -1.5 : 0);
  const bw = 2.2 + m * 2.4;
  const brow = (x: number, side: -1 | 1): string => {
    const inner = p.expression === 'serious' ? 2.5 : p.expression === 'smirk' && side === 1 ? -2 : 0;
    return `<path d="M${x - side * 12} ${browY + inner + 1} Q${x - side * 2} ${browY - 3.5} ${x + side * 13} ${browY + 1.5}" fill="none" stroke="${shade(p.hair, p.hairStyle === 'slick-grey' ? -0.35 : 0.05)}" stroke-width="${bw}" stroke-linecap="round"/>`;
  };
  const nW = 7 + m * 2.5;
  const noseY = 142;
  const nose = `<path d="M${cx - 3} ${eyeY + 4} Q${cx - 6} ${noseY - 12} ${cx - nW} ${noseY - 2}" fill="none" stroke="${p.skinShadow}" stroke-width="1.6" opacity="0.55" filter="url(#${u}-soft)"/>
  <path d="M${cx + 4} ${eyeY + 2} Q${cx + 8} ${noseY - 14} ${cx + nW + 1} ${noseY - 3}" fill="none" stroke="${p.skinShadow}" stroke-width="4" opacity="0.45" filter="url(#${u}-soft)"/>
  <ellipse cx="${cx - 1}" cy="${noseY - 6}" rx="4" ry="3" fill="${p.skinLight}" opacity="0.55" filter="url(#${u}-soft)"/>
  <path d="M${cx - nW} ${noseY - 1} Q${cx - nW - 2} ${noseY + 4} ${cx - 3} ${noseY + 3} Q${cx} ${noseY + 5} ${cx + 3} ${noseY + 3} Q${cx + nW + 2} ${noseY + 4} ${cx + nW} ${noseY - 1}" fill="none" stroke="${shade(p.skinShadow, -0.25)}" stroke-width="1.5" stroke-linecap="round"/>
  <ellipse cx="${cx - 4}" cy="${noseY + 1.5}" rx="2" ry="1.1" fill="${shade(p.skinShadow, -0.45)}"/><ellipse cx="${cx + 4}" cy="${noseY + 1.5}" rx="2" ry="1.1" fill="${shade(p.skinShadow, -0.45)}"/>`;
  const mY = 157 + m * 1.5;
  const mw = 13 + m * 1.5;
  const curve = p.expression === 'smile' ? 3.2 : p.expression === 'smirk' ? 1 : p.expression === 'serious' ? -0.8 : 0.3;
  const rightUp = p.expression === 'smirk' ? -2.2 : 0;
  const upperT = m < 0.5 ? 3.6 : 2.4;
  const lowerT = m < 0.5 ? 4.6 : 3.4;
  const mouth = `<path d="M${cx - mw} ${mY - curve * 0.3} Q${cx - 6} ${mY - upperT - 1} ${cx} ${mY - upperT + 1} Q${cx + 6} ${mY - upperT - 1} ${cx + mw} ${mY - curve * 0.3 + rightUp} Q${cx} ${mY + curve} ${cx - mw} ${mY - curve * 0.3} Z" fill="url(#${u}-lips)"/>
  <path d="M${cx - mw} ${mY - curve * 0.3} Q${cx} ${mY + curve + lowerT * 1.6} ${cx + mw} ${mY - curve * 0.3 + rightUp} Q${cx} ${mY + curve} ${cx - mw} ${mY - curve * 0.3} Z" fill="url(#${u}-lips)" opacity="0.92"/>
  <path d="M${cx - mw + 0.5} ${mY - curve * 0.3} Q${cx} ${mY + curve} ${cx + mw - 0.5} ${mY - curve * 0.3 + rightUp}" fill="none" stroke="${shade(p.lips, -0.55)}" stroke-width="1.4" stroke-linecap="round"/>
  <ellipse cx="${cx - 2}" cy="${mY + lowerT * 0.7 + curve * 0.5}" rx="5" ry="1.4" fill="#fff" opacity="0.18"/>
  ${p.expression === 'smile' ? `<path d="M${cx - mw - 3} ${mY - 4} q-2 4 1 7" fill="none" stroke="${p.skinShadow}" stroke-width="1.2" opacity="0.6"/><path d="M${cx + mw + 3} ${mY - 4} q2 4 -1 7" fill="none" stroke="${p.skinShadow}" stroke-width="1.2" opacity="0.6"/>` : ''}
  <ellipse cx="${cx}" cy="${mY + lowerT + 7}" rx="7" ry="2.6" fill="${p.skinShadow}" opacity="0.35" filter="url(#${u}-soft)"/>`;
  const glasses = p.glasses
    ? `<g fill="none" stroke="#2a2a2a" stroke-width="2.2"><rect x="${cx - 37}" y="${eyeY - 10}" width="28" height="19" rx="5"/><rect x="${cx + 9}" y="${eyeY - 10}" width="28" height="19" rx="5"/><path d="M${cx - 9} ${eyeY - 3} q9 -4 18 0"/><path d="M${cx - 37} ${eyeY - 4} l-9 -2"/><path d="M${cx + 37} ${eyeY - 4} l9 -2"/></g>
       <path d="M${cx - 34} ${eyeY - 7} l8 0" stroke="#fff" stroke-width="1.4" opacity="0.35"/><path d="M${cx + 12} ${eyeY - 7} l8 0" stroke="#fff" stroke-width="1.4" opacity="0.25"/>`
    : '';
  const frontHair = hairFront(p, u, cx);
  const grain = `<rect width="200" height="240" fill="none" stroke="#000" stroke-width="6" opacity="0.35"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img" aria-label="retrato">${defs}${bg}
  <g transform="rotate(${p.tilt} 100 140)">${backHair}${body}${neck}${ears}${face}
    <g>${brow(cx - 20, -1)}${brow(cx + 20, 1)}</g>${eye(cx - 20, -1)}${eye(cx + 20, 1)}${nose}${mouth}${glasses}${frontHair}
  </g>${grain}</svg>`;
}

function wrinkles(p: PortraitParams, cx: number, eyeY: number): string {
  const c = p.skinShadow;
  return `<g fill="none" stroke="${c}" stroke-width="1" opacity="0.5">
    <path d="M${cx - 18} 78 q18 -4 36 0"/><path d="M${cx - 14} 72 q14 -3 28 0"/>
    <path d="M${cx - 34} ${eyeY + 2} q-4 3 -3 7"/><path d="M${cx + 34} ${eyeY + 2} q4 3 3 7"/>
    <path d="M${cx - 16} 146 q-4 8 -2 16"/><path d="M${cx + 16} 146 q4 8 2 16"/>
  </g>`;
}

function facialHair(p: PortraitParams, u: string, cx: number, cy: number): string {
  if (!p.facial) return '';
  const c = p.facialColor ?? p.hair;
  if (p.facial === 'stubble')
    return `<path d="M${cx - p.jawW - 2} 140 C${cx - p.jawW + 2} 162 ${cx - 14} ${cy} ${cx} ${cy} C${cx + 14} ${cy} ${cx + p.jawW - 2} 162 ${cx + p.jawW + 2} 140 L${cx + 20} 150 Q${cx} 146 ${cx - 20} 150 Z" fill="${c}" opacity="0.28" filter="url(#${u}-soft)"/>
      <path d="M${cx - 16} 151 Q${cx} 146 ${cx + 16} 151" fill="none" stroke="${c}" stroke-width="4" opacity="0.3" filter="url(#${u}-soft)"/>`;
  if (p.facial === 'mustache')
    return `<path d="M${cx - 17} 155 Q${cx - 9} 145 ${cx} 149 Q${cx + 9} 145 ${cx + 17} 155 Q${cx + 8} 152 ${cx} 153 Q${cx - 8} 152 ${cx - 17} 155 Z" fill="${c}"/>
      <path d="M${cx - 12} 150 l2 3 M${cx - 6} 149 l1 3 M${cx + 6} 149 l-1 3 M${cx + 12} 150 l-2 3" stroke="${shade(c, 0.35)}" stroke-width="0.8" opacity="0.6"/>`;
  return `<path d="M${cx - p.jawW - 3} 136 C${cx - p.jawW} 168 ${cx - 16} ${cy + 6} ${cx} ${cy + 7} C${cx + 16} ${cy + 6} ${cx + p.jawW} 168 ${cx + p.jawW + 3} 136 L${cx + p.jawW - 4} 134 C${cx + 24} 156 ${cx + 16} 150 ${cx} 149 C${cx - 16} 150 ${cx - 24} 156 ${cx - p.jawW + 4} 134 Z" fill="${c}" opacity="0.9"/>
    <path d="M${cx - 17} 155 Q${cx} 146 ${cx + 17} 155 Q${cx} 151 ${cx - 17} 155 Z" fill="${c}"/>
    <path d="M${cx - 20} 168 q4 6 2 10 M${cx - 8} 172 q2 5 0 8 M${cx + 8} 172 q-2 5 0 8 M${cx + 20} 168 q-4 6 -2 10" stroke="${shade(c, 0.4)}" stroke-width="0.9" fill="none" opacity="0.5"/>`;
}

function hairBack(p: PortraitParams, u: string, cx: number): string {
  const f = `url(#${u}-hair)`;
  const w = p.faceW;
  switch (p.hairStyle) {
    case 'ponytail':
      return `<path d="M${cx + w - 6} 72 C${cx + w + 30} 70 ${cx + w + 34} 130 ${cx + w + 18} 186 C${cx + w + 10} 160 ${cx + w + 6} 120 ${cx + w - 10} 96 Z" fill="${f}"/>`;
    case 'bob':
      return `<path d="M${cx - w - 10} 84 C${cx - w - 14} 120 ${cx - w - 10} 150 ${cx - w + 2} 162 L${cx + w - 2} 162 C${cx + w + 10} 150 ${cx + w + 14} 120 ${cx + w + 10} 84 Z" fill="${f}"/>`;
    case 'curly':
      return `<g fill="${p.hair}">${[...Array(9)].map((_, i) => `<circle cx="${cx - w + 2 + i * ((2 * w - 4) / 8)}" cy="${66 + Math.abs(i - 4) * 4}" r="${15 - Math.abs(i - 4)}"/>`).join('')}</g>`;
    case 'bun':
      return `<circle cx="${cx + 8}" cy="46" r="17" fill="${f}"/><circle cx="${cx + 2}" cy="40" r="6" fill="${p.hairLight}" opacity="0.35"/>`;
    default:
      return '';
  }
}

function hairFront(p: PortraitParams, u: string, cx: number): string {
  const f = `url(#${u}-hair)`;
  const w = p.faceW;
  const strands = (n: number, y0: number, y1: number, op = 0.35): string =>
    `<g fill="none" stroke="${p.hairLight}" stroke-width="0.9" opacity="${op}">${[...Array(n)].map((_, i) => {
      const x = cx - w + 8 + (i * (2 * w - 16)) / (n - 1);
      return `<path d="M${x} ${y0} q${(i % 3) - 1 + 4} ${(y1 - y0) / 2} ${(i % 2 ? 2 : -2) + 3} ${y1 - y0}"/>`;
    }).join('')}</g>`;
  switch (p.hairStyle) {
    case 'ponytail':
      return `<path d="M${cx - w - 2} 98 C${cx - w - 6} 60 ${cx - 10} 46 ${cx + 8} 48 C${cx + w + 6} 50 ${cx + w + 6} 78 ${cx + w} 98 C${cx + w - 6} 80 ${cx + 10} 70 ${cx - 6} 74 C${cx - 22} 78 ${cx - w + 4} 84 ${cx - w - 2} 98 Z" fill="${f}"/>${strands(9, 52, 76)}
        <path d="M${cx + w - 8} 76 l10 -4" stroke="#c8322b" stroke-width="5" stroke-linecap="round"/>`;
    case 'bob':
      return `<path d="M${cx - w - 8} 110 C${cx - w - 12} 60 ${cx - 6} 44 ${cx + 6} 46 C${cx + w + 12} 48 ${cx + w + 12} 70 ${cx + w + 8} 110 C${cx + w} 92 ${cx + w - 6} 80 ${cx + 6} 78 C${cx - 14} 82 ${cx - 22} 74 ${cx - 26} 80 C${cx - w + 2} 86 ${cx - w - 2} 98 ${cx - w - 8} 110 Z" fill="${f}"/>${strands(10, 50, 80, 0.3)}`;
    case 'curly':
      return `<path d="M${cx - w} 84 C${cx - w - 2} 52 ${cx + w + 2} 52 ${cx + w} 84 Z" fill="${p.hair}"/><g>${[...Array(7)].map((_, i) => `<circle cx="${cx - 30 + i * 10}" cy="${56 + Math.abs(i - 3) * 2}" r="8" fill="${shade(p.hair, 0.1)}"/><circle cx="${cx - 32 + i * 10}" cy="${53 + Math.abs(i - 3) * 2}" r="2.4" fill="${p.hairLight}" opacity="0.4"/>`).join('')}</g><g>${[...Array(12)].map((_, i) => {
        const x = cx - w + 2 + (i * (2 * w - 4)) / 11;
        const y = 70 + Math.sin(i * 1.7) * 3 + (i === 0 || i === 11 ? 12 : 0);
        return `<circle cx="${x}" cy="${y}" r="${8 + (i % 3)}" fill="${i % 2 ? p.hair : shade(p.hair, 0.15)}"/><circle cx="${x - 2}" cy="${y - 3}" r="2.6" fill="${p.hairLight}" opacity="0.4"/>`;
      }).join('')}</g>`;
    case 'short':
      return `<path d="M${cx - w - 2} 102 C${cx - w - 4} 62 ${cx - 14} 50 ${cx + 4} 50 C${cx + w + 4} 50 ${cx + w + 4} 70 ${cx + w + 2} 102 C${cx + w - 4} 84 ${cx + w - 8} 76 ${cx + 10} 74 C${cx - 10} 72 ${cx - w + 4} 80 ${cx - w - 2} 102 Z" fill="${f}"/>
        <path d="M${cx - 6} 52 C${cx + 8} 50 ${cx + 22} 54 ${cx + 30} 62" fill="none" stroke="${p.hairLight}" stroke-width="2" opacity="0.4"/>${strands(8, 54, 72, 0.25)}`;
    case 'undercut':
      return `<path d="M${cx - w} 100 C${cx - w - 2} 84 ${cx - w + 2} 78 ${cx - w + 4} 74 L${cx + w - 4} 74 C${cx + w - 2} 78 ${cx + w + 2} 84 ${cx + w} 100 C${cx + w - 3} 92 ${cx + w - 6} 86 ${cx + w - 8} 82 L${cx - w + 8} 82 C${cx - w + 6} 86 ${cx - w + 3} 92 ${cx - w} 100 Z" fill="${p.hair}" opacity="0.8"/>
        <path d="M${cx - w + 1} 88 C${cx - w - 2} 50 ${cx - 6} 30 ${cx + 18} 36 C${cx + w + 8} 42 ${cx + w + 6} 66 ${cx + w - 1} 88 C${cx + w - 8} 74 ${cx + 20} 68 ${cx - 2} 70 C${cx - 20} 72 ${cx - w + 8} 76 ${cx - w + 1} 88 Z" fill="${f}"/>
        <g fill="none" stroke="${p.hairLight}" stroke-width="1.1" opacity="0.45"><path d="M${cx - 24} 66 C${cx - 10} 44 ${cx + 10} 38 ${cx + 30} 44"/><path d="M${cx - 14} 68 C${cx} 50 ${cx + 16} 46 ${cx + 34} 52"/><path d="M${cx - 30} 72 C${cx - 18} 52 ${cx} 44 ${cx + 22} 42"/></g>`;
    case 'slick-grey':
      return `<path d="M${cx - w - 2} 104 C${cx - w - 6} 60 ${cx - 16} 44 ${cx + 6} 46 C${cx + w + 6} 48 ${cx + w + 6} 74 ${cx + w + 2} 104 C${cx + w - 2} 86 ${cx + w - 6} 74 ${cx + 22} 70 C${cx} 64 ${cx - w + 6} 70 ${cx - w - 2} 104 Z" fill="${f}"/>
        <g fill="none" stroke="#f2f0ec" stroke-width="1" opacity="0.5">${[...Array(8)].map((_, i) => `<path d="M${cx - w + 6 + i * 4} ${68 - i} C${cx - 10 + i * 4} ${54 - i} ${cx + 10 + i * 3} ${50} ${cx + w - 4} ${62 + i * 2}"/>`).join('')}</g>`;
    case 'cap':
      return `<path d="M${cx - w - 4} 94 C${cx - w - 6} 54 ${cx - 14} 40 ${cx + 2} 40 C${cx + w + 8} 40 ${cx + w + 8} 60 ${cx + w + 4} 94 Z" fill="${p.accent}"/>
        <path d="M${cx - w - 4} 94 C${cx - w - 6} 54 ${cx - 14} 40 ${cx + 2} 40 C${cx + w + 8} 40 ${cx + w + 8} 60 ${cx + w + 4} 94 Z" fill="url(#${u}-rim)"/>
        <path d="M${cx + 24} 44 C${cx + 10} 42 ${cx - 6} 48 ${cx - 14} 58" fill="none" stroke="#fff" stroke-width="2" opacity="0.25"/>
        <path d="M${cx - w - 8} 92 C${cx - 30} 84 ${cx + 30} 84 ${cx + w + 8} 92 C${cx + w + 14} 96 ${cx + w + 12} 102 ${cx + w} 101 C${cx + 20} 95 ${cx - 20} 95 ${cx - w} 101 C${cx - w - 12} 102 ${cx - w - 14} 96 ${cx - w - 8} 92 Z" fill="${shade(p.accent, -0.35)}"/>
        <rect x="${cx - 9}" y="62" width="18" height="12" rx="2" fill="${shade(p.accent, -0.2)}"/>
        <path d="M${cx - w - 2} 100 L${cx - w + 2} 118 L${cx - w + 6} 100 Z M${cx + w + 2} 100 L${cx + w - 2} 118 L${cx + w - 6} 100 Z" fill="${p.hair}"/>`;
    case 'bun':
      return `<path d="M${cx - w - 2} 100 C${cx - w - 4} 60 ${cx - 12} 50 ${cx + 4} 52 C${cx + w + 4} 54 ${cx + w + 4} 74 ${cx + w + 1} 100 C${cx + w - 6} 82 ${cx + 18} 68 ${cx - 2} 70 C${cx - 22} 72 ${cx - w + 4} 84 ${cx - w - 2} 100 Z" fill="${f}"/>${strands(9, 56, 72, 0.3)}
        <path d="M${cx - w + 2} 100 q-6 14 -2 28" fill="none" stroke="${p.hair}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M${cx - w + 1} 90 C${cx - w + 4} 70 ${cx + w - 4} 68 ${cx + w - 1} 90" fill="none" stroke="${p.accent}" stroke-width="6" stroke-linecap="round"/><path d="M${cx - w + 6} 82 C${cx - 10} 70 ${cx + 10} 70 ${cx + 20} 72" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.35"/>`;
  }
}

function clothing(p: PortraitParams, u: string, cx: number, neckW: number): string {
  const f = `url(#${u}-cloth)`;
  const base = `<path d="M8 240 C10 214 30 196 ${cx - neckW - 8} 190 Q${cx} 204 ${cx + neckW + 8} 190 C170 196 190 214 192 240 Z" fill="${f}"/>`;
  const dark = shade(p.cloth, -0.4);
  switch (p.clothStyle) {
    case 'overall':
      return `<path d="M8 240 C10 214 30 196 ${cx - neckW - 8} 190 Q${cx} 204 ${cx + neckW + 8} 190 C170 196 190 214 192 240 Z" fill="#d9d4c8"/>
        <path d="M${cx - neckW - 6} 192 Q${cx} 208 ${cx + neckW + 6} 192 L${cx + neckW} 202 Q${cx} 214 ${cx - neckW} 202 Z" fill="#bdb6a8"/>
        <path d="M36 240 L52 204 L74 200 L86 240 Z M164 240 L148 204 L126 200 L114 240 Z" fill="${f}"/>
        <path d="M58 240 L${cx - 30} 218 L${cx + 30} 218 L142 240 Z" fill="${f}"/>
        <circle cx="62" cy="214" r="4" fill="${p.accent}"/><circle cx="138" cy="214" r="4" fill="${shade(p.accent, -0.3)}"/>
        <path d="M70 228 l14 -3" stroke="#000" stroke-width="2" opacity="0.25"/><path d="M118 230 l9 -6" stroke="#2a1d10" stroke-width="3" opacity="0.35" stroke-linecap="round"/>`;
    case 'hoodie':
      return `${base}<path d="M${cx - neckW - 16} 190 C${cx - 30} 210 ${cx + 30} 210 ${cx + neckW + 16} 190 C${cx + 24} 200 ${cx - 24} 200 ${cx - neckW - 16} 190 Z" fill="${dark}"/>
        <path d="M${cx - 8} 204 l-2 26 M${cx + 8} 204 l2 26" stroke="#d6d6d6" stroke-width="2" stroke-linecap="round"/><circle cx="${cx - 10}" cy="231" r="2" fill="#d6d6d6"/><circle cx="${cx + 10}" cy="231" r="2" fill="#d6d6d6"/>
        <path d="M30 240 L40 222" stroke="${p.accent}" stroke-width="3" opacity="0.8"/>`;
    case 'tee':
      return `${base}<path d="M${cx - neckW - 6} 191 Q${cx} 210 ${cx + neckW + 6} 191" fill="none" stroke="${shade(p.cloth, -0.2)}" stroke-width="4"/>
        <path d="M${cx - 30} 226 h60" stroke="${p.accent}" stroke-width="5" opacity="0.8"/><path d="M${cx - 22} 234 h44" stroke="${p.accent}" stroke-width="3" opacity="0.6"/>`;
    case 'shirt':
      return `${base}<path d="M${cx - neckW - 6} 188 L${cx - 4} 214 L${cx - 18} 222 L${cx - neckW - 12} 196 Z M${cx + neckW + 6} 188 L${cx + 4} 214 L${cx + 18} 222 L${cx + neckW + 12} 196 Z" fill="${p.clothLight}"/>
        <path d="M${cx} 212 L${cx} 240" stroke="${dark}" stroke-width="1.4"/><circle cx="${cx + 3}" cy="222" r="1.6" fill="#e9e9e9"/><circle cx="${cx + 3}" cy="234" r="1.6" fill="#e9e9e9"/>
        <path d="M34 240 C38 228 46 218 58 214" stroke="${dark}" stroke-width="1" fill="none" opacity="0.6"/><rect x="128" y="218" width="20" height="14" rx="1" fill="none" stroke="${dark}" stroke-width="1.2"/><path d="M134 214 v8" stroke="#d6b84a" stroke-width="2"/>`;
    case 'jacket':
      return `<path d="M8 240 C10 214 30 196 ${cx - neckW - 8} 190 Q${cx} 204 ${cx + neckW + 8} 190 C170 196 190 214 192 240 Z" fill="#1c1d20"/>
        <path d="M8 240 C10 214 30 196 ${cx - neckW - 10} 188 L${cx - 10} 240 Z M192 240 C190 214 170 196 ${cx + neckW + 10} 188 L${cx + 10} 240 Z" fill="${f}"/>
        <path d="M${cx - neckW - 10} 188 L${cx - neckW + 2} 208 L${cx - 10} 240" fill="none" stroke="${p.accent}" stroke-width="2.5"/><path d="M${cx + neckW + 10} 188 L${cx + neckW - 2} 208 L${cx + 10} 240" fill="none" stroke="${p.accent}" stroke-width="2.5"/>
        <path d="M30 226 l20 -6" stroke="${p.accent}" stroke-width="3" opacity="0.7"/>`;
    case 'leather':
      return `<path d="M8 240 C10 214 30 196 ${cx - neckW - 8} 190 Q${cx} 204 ${cx + neckW + 8} 190 C170 196 190 214 192 240 Z" fill="#26282c"/>
        <path d="M8 240 C10 214 30 196 ${cx - neckW - 12} 186 L${cx - neckW + 6} 214 L${cx - 6} 240 Z M192 240 C190 214 170 196 ${cx + neckW + 12} 186 L${cx + neckW - 6} 214 L${cx + 6} 240 Z" fill="${f}"/>
        <path d="M${cx - neckW - 12} 186 L${cx - neckW + 6} 214 L${cx - neckW - 16} 224 L${cx - 52} 198 Z M${cx + neckW + 12} 186 L${cx + neckW - 6} 214 L${cx + neckW + 16} 224 L${cx + 52} 198 Z" fill="${p.clothLight}"/>
        <path d="M40 216 C60 206 70 210 76 222" fill="none" stroke="#fff" stroke-width="2" opacity="0.18"/><path d="M150 214 C140 210 132 214 128 224" fill="none" stroke="#9cc8ff" stroke-width="2" opacity="0.2"/>
        <circle cx="${cx - neckW - 4}" cy="226" r="2.4" fill="#b8b8b8"/><circle cx="${cx + neckW + 4}" cy="226" r="2.4" fill="#8a8a8a"/>
        <path d="M${cx - 4} 220 l8 0" stroke="${p.accent}" stroke-width="3"/>`;
  }
}

/** Lightens (k > 0) or darkens (k < 0) a #rrggbb colour. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): number => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
