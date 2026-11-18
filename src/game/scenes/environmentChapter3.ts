import { shade } from '../vehicles/art/svg';
import { building, wrapped } from './environmentArt';
import { cone, glow, lightTower, parkedCar, streetLamp, type Painter } from './environmentCampaign';
import { crowd, tower } from './environmentChapter2';
import { litFar } from './LightingController';
import type { Theme } from './trackArt';

/**
 * Parallax scenery of the Chapter 3 venues ("Elite da Madrugada"). Same layer contract as
 * environmentCampaign.ts (layer 0 far, 1 middle, 2 near; seamless horizontal tiling); original
 * procedural artwork: no photos, no brands, invented words only.
 *
 * - Marginal Alta: an elevated expressway between glass towers, cool white light, city glow below.
 * - Hangar Executivo: a closed private airfield: business jets on the apron, arched hangars with
 *   lit doors, blue taxiway edge lights and a control tower beacon.
 * - Pier Elite: a marina dock at night: yachts with masthead lights, a dark water strip with
 *   reflections, warm string lights, spectators and parked cars on the quay.
 */
export function chapter3Layer(theme: Theme, p: Painter): void {
  if (theme === 'marginalAlta') marginal(p);
  else if (theme === 'hangarExecutivo') hangar(p);
  else pier(p);
}

const WARM = '255,214,150';
const COOL = '205,225,255';
const BLUE = '120,170,255';

// ------------------------------------------------------------------------------- Marginal Alta

function marginal(p: Painter): void {
  const { ctx, W, H, rng, l, C, px, layer } = p;
  if (layer === 0) {
    // dense glass skyline, a city glow rising from below
    const glowG = ctx.createLinearGradient(0, H * 0.35, 0, H);
    glowG.addColorStop(0, 'rgba(120,150,210,0)');
    glowG.addColorStop(1, 'rgba(150,180,235,0.26)');
    ctx.fillStyle = glowG;
    ctx.fillRect(0, 0, W, H);
    let x = 0;
    while (x < W) {
      const w = px(36 + rng.next() * 54);
      const h = px(150 + rng.next() * 230);
      const crown = rng.next() < 0.45 ? (rng.next() < 0.5 ? WARM : COOL) : null;
      tower(p, x, H, w, h, C(['#1b2535', '#202c40', '#18202f'][Math.floor(rng.next() * 3)]!, 0.02), crown, 0.5);
      x += w + px(3 + rng.next() * 12);
    }
  } else if (layer === 1) {
    // elevated expressway: two deck slabs on piers, guard rail, distant headlights, mid-rise blocks
    let x = 0;
    while (x < W) {
      const w = px(100 + rng.next() * 100);
      const h = px(60 + rng.next() * 70);
      building(ctx, rng, x, H - px(30), w, h, C(['#2f3949', '#394357', '#2b3443'][Math.floor(rng.next() * 3)]!), l, 0.3);
      x += w + px(12 + rng.next() * 26);
    }
    const deckTop = H - px(110);
    ctx.fillStyle = C('#7c848d');
    ctx.fillRect(0, deckTop, W, px(12));
    ctx.fillStyle = C('#a1a8b0');
    ctx.fillRect(0, deckTop - px(8), W, px(6));
    ctx.fillStyle = C('#59616a');
    for (let k = 0; k < W; k += px(120)) ctx.fillRect(k, deckTop + px(12), px(14), H - deckTop - px(12));
    for (let k = px(20); k < W; k += px(90)) {
      ctx.fillStyle = `rgb(${COOL})`;
      ctx.fillRect(k, deckTop - px(46), px(2), px(38));
      ctx.fillRect(k, deckTop - px(46), px(14), px(2));
      glow(ctx, k + px(14), deckTop - px(44), px(28), COOL, 0.55);
    }
    // traffic far away: pairs of lamps on the deck
    for (let k = 0; k < W; k += px(150 + rng.next() * 120)) {
      const red = rng.next() < 0.5;
      ctx.fillStyle = red ? '#ff4a3a' : '#fff1c8';
      ctx.fillRect(k, deckTop - px(5), px(3), px(2));
      ctx.fillRect(k + px(7), deckTop - px(5), px(3), px(2));
      glow(ctx, k + px(5), deckTop - px(4), px(10), red ? '255,70,50' : WARM, 0.5);
    }
  } else {
    // near: concrete barrier with spectators and premium cars parked behind it
    const carCols = ['#f0f0f0', '#101216', '#8a1d22', '#2a3a58', '#a9adb3', '#c7a54a'];
    for (let i = 0; i < 6; i++) {
      const x0 = (i + 0.3) * (W / 6);
      wrapped(W, x0, px(120), (xx) => parkedCar(p, xx, H - px(30), carCols[i]!, i % 2 === 0, i % 3 === 0 ? 'hazard' : 'none'));
    }
    crowd(p, H - px(30), 2, 0.8);
    for (let k = 0; k < W; k += px(80)) {
      ctx.fillStyle = C('#c9ccd0');
      ctx.fillRect(k, H - px(28), px(76), px(28));
      ctx.fillStyle = C('#9da1a6');
      ctx.fillRect(k, H - px(28), px(76), px(4));
    }
    for (const fx of [0.12, 0.5, 0.88]) streetLamp(p, W * fx, H - px(28), H * 0.62, COOL, fx > 0.5);
  }
}

// ------------------------------------------------------------------------------- Hangar Executivo

/** A business jet seen from the side (nose to the right when `right`). */
function jet(p: Painter, x: number, foot: number, len: number, body: string, stripe: string, right: boolean): void {
  const { ctx, px, C } = p;
  const d = right ? 1 : -1;
  const h = len * 0.17;
  const cy = foot - len * 0.1 - h / 2;
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(d, 1);
  ctx.fillStyle = C(body);
  ctx.beginPath();
  ctx.ellipse(len / 2, cy, len / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // tail fin and stabiliser
  ctx.beginPath();
  ctx.moveTo(len * 0.06, cy);
  ctx.lineTo(len * 0.02, cy - h * 1.6);
  ctx.lineTo(len * 0.17, cy - h * 1.5);
  ctx.lineTo(len * 0.26, cy);
  ctx.closePath();
  ctx.fill();
  // wing and engine
  ctx.fillStyle = C(shade(body, -0.18));
  ctx.beginPath();
  ctx.moveTo(len * 0.46, cy + h * 0.2);
  ctx.lineTo(len * 0.62, cy + h * 0.2);
  ctx.lineTo(len * 0.52, cy + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(len * 0.1, cy - h * 0.08, len * 0.14, h * 0.28);
  ctx.fillStyle = C(stripe);
  ctx.fillRect(len * 0.1, cy + h * 0.1, len * 0.78, px(2));
  ctx.fillStyle = litFar('#bcd6f0', p.l, 0.2);
  for (let k = 0; k < 7; k++) ctx.fillRect(len * (0.52 + k * 0.05), cy - h * 0.22, len * 0.03, h * 0.18);
  // landing gear
  ctx.fillStyle = C('#202428');
  for (const gx of [0.22, 0.68]) ctx.fillRect(len * gx, cy + h * 0.5, px(4), foot - cy - h * 0.5);
  ctx.restore();
}

function hangar(p: Painter): void {
  const { ctx, W, H, rng, l, C, px, layer } = p;
  if (layer === 0) {
    // control tower with a rotating beacon, hangar silhouettes, runway edge lights
    const haze = ctx.createLinearGradient(0, H * 0.4, 0, H);
    haze.addColorStop(0, 'rgba(110,140,200,0)');
    haze.addColorStop(1, 'rgba(130,160,215,0.2)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.25 + rng.next() * 0.3) * (W / 4);
      const w = px(80 + rng.next() * 90);
      ctx.fillStyle = C('#1e2736', 0.02);
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x, H - px(40));
      ctx.quadraticCurveTo(x + w / 2, H - px(78), x + w, H - px(40));
      ctx.lineTo(x + w, H);
      ctx.closePath();
      ctx.fill();
    }
    const tx = W * 0.62;
    ctx.fillStyle = C('#2c3546', 0.02);
    ctx.fillRect(tx, H - px(150), px(10), px(150));
    ctx.fillRect(tx - px(16), H - px(176), px(42), px(26));
    ctx.fillStyle = litFar('#bfe0ff', l, 0.1);
    ctx.fillRect(tx - px(12), H - px(172), px(34), px(14));
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(tx + px(3), H - px(184), px(4), px(4));
    glow(ctx, tx + px(5), H - px(182), px(26), '255,60,50', 0.7);
    for (let k = 0; k < W; k += px(34)) {
      ctx.fillStyle = `rgb(${BLUE})`;
      ctx.fillRect(k, H - px(5), px(3), px(3));
      glow(ctx, k + px(1), H - px(4), px(9), BLUE, 0.55);
    }
  } else if (layer === 1) {
    // arched hangars with lit doors and a business jet in front of one of them
    let x = px(6);
    while (x < W) {
      const w = px(190 + rng.next() * 90);
      const h = px(70 + rng.next() * 22);
      const wall = C(['#46505e', '#3d4757', '#4c5666'][Math.floor(rng.next() * 3)]!);
      ctx.fillStyle = wall;
      ctx.beginPath();
      ctx.moveTo(x, H - px(20));
      ctx.lineTo(x, H - px(20) - h * 0.6);
      ctx.quadraticCurveTo(x + w / 2, H - px(20) - h * 1.5, x + w, H - px(20) - h * 0.6);
      ctx.lineTo(x + w, H - px(20));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = x + px(10); k < x + w; k += px(14)) ctx.fillRect(k, H - px(20) - h * 0.55, px(2), h * 0.55);
      // lit doors
      ctx.fillStyle = litFar('#e6eefc', l, 0.15);
      ctx.fillRect(x + w * 0.14, H - px(20) - h * 0.52, w * 0.72, h * 0.52);
      glow(ctx, x + w / 2, H - px(24), w * 0.5, WARM, 0.2);
      x += w + px(30 + rng.next() * 60);
    }
    wrapped(W, W * 0.3, px(140), (xx) => jet(p, xx, H - px(14), px(120), '#e8ebef', '#27406a', true));
    wrapped(W, W * 0.78, px(140), (xx) => jet(p, xx, H - px(14), px(105), '#d6dae0', '#8a1d22', false));
  } else {
    // near: apron fence, cones, floodlight towers, a few people and parked service cars
    for (const fx of [0.15, 0.55, 0.9]) lightTower(p, W * fx, H - px(8), H * 0.95);
    ctx.strokeStyle = C('#8b939c');
    ctx.lineWidth = px(1.5);
    for (let k = 0; k < W; k += px(12)) {
      ctx.beginPath();
      ctx.moveTo(k, H - px(30));
      ctx.lineTo(k + px(12), H - px(8));
      ctx.stroke();
    }
    ctx.fillStyle = C('#a1a8b0');
    ctx.fillRect(0, H - px(30), W, px(2));
    ctx.fillRect(0, H - px(8), W, px(2));
    for (let k = px(30); k < W; k += px(150 + rng.next() * 60)) {
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.moveTo(k, H - px(8));
      ctx.lineTo(k + px(5), H - px(8) - px(16));
      ctx.lineTo(k + px(10), H - px(8));
      ctx.fill();
    }
    crowd(p, H - px(6), 1, 0.4);
    for (let k = 0; k < W; k += px(34)) {
      ctx.fillStyle = `rgb(${BLUE})`;
      ctx.fillRect(k, H - px(3), px(3), px(2));
      glow(ctx, k + px(1), H - px(2), px(8), BLUE, 0.5);
    }
  }
}

// ------------------------------------------------------------------------------- Pier Elite

/** A moored yacht: hull, cabin decks and a mast with a light. */
function yacht(p: Painter, x: number, waterY: number, len: number, hull: string, tall: number): void {
  const { ctx, px, C, l } = p;
  ctx.fillStyle = C(hull);
  ctx.beginPath();
  ctx.moveTo(x, waterY - len * 0.07);
  ctx.lineTo(x + len, waterY - len * 0.1);
  ctx.quadraticCurveTo(x + len * 0.96, waterY, x + len * 0.84, waterY);
  ctx.lineTo(x + len * 0.06, waterY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C('#e6e9ee');
  ctx.fillRect(x + len * 0.12, waterY - len * 0.07 - len * 0.1, len * 0.62, len * 0.1);
  ctx.fillRect(x + len * 0.24, waterY - len * 0.07 - len * 0.1 - len * 0.08, len * 0.38, len * 0.08);
  ctx.fillStyle = litFar('#ffe8b8', l, 0.18);
  for (let k = 0; k < 8; k++) ctx.fillRect(x + len * (0.15 + k * 0.07), waterY - len * 0.07 - len * 0.075, len * 0.04, len * 0.04);
  ctx.strokeStyle = C('#b9bec6');
  ctx.lineWidth = px(1.5);
  ctx.beginPath();
  ctx.moveTo(x + len * 0.46, waterY - len * 0.25);
  ctx.lineTo(x + len * 0.46, waterY - len * 0.25 - tall);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + len * 0.46 - px(1.5), waterY - len * 0.25 - tall - px(3), px(3), px(3));
  glow(ctx, x + len * 0.46, waterY - len * 0.25 - tall - px(1), px(14), WARM, 0.6);
}

function pier(p: Painter): void {
  const { ctx, W, H, rng, l, C, px, layer } = p;
  if (layer === 0) {
    // far shore: low hills with a lit promenade, its reflection in the water below
    const shore = H - px(46);
    ctx.fillStyle = C('#1c2434', 0.02);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let k = 0; k <= W; k += px(30)) ctx.lineTo(k, shore - px(30) - Math.sin(k / px(180)) * px(26) - rng.next() * px(10));
    ctx.lineTo(W, H);
    ctx.fill();
    for (let k = 0; k < W; k += px(18 + rng.next() * 18)) {
      ctx.fillStyle = litFar(rng.next() < 0.7 ? '#ffe2a8' : '#cfe3ff', l, 0.12);
      ctx.fillRect(k, shore - px(4) - rng.next() * px(28), px(2), px(2));
    }
    const water = ctx.createLinearGradient(0, shore, 0, H);
    water.addColorStop(0, 'rgba(70,95,150,0.35)');
    water.addColorStop(1, 'rgba(15,22,40,0.7)');
    ctx.fillStyle = water;
    ctx.fillRect(0, shore, W, H - shore);
  } else if (layer === 1) {
    // yachts along the dock, water strip with the reflection of their lights
    const waterY = H - px(28);
    const water = ctx.createLinearGradient(0, waterY, 0, H);
    water.addColorStop(0, 'rgba(40,60,100,0.85)');
    water.addColorStop(1, 'rgba(10,15,28,0.95)');
    ctx.fillStyle = water;
    ctx.fillRect(0, waterY, W, H - waterY);
    const hulls = ['#f2f3f5', '#1f2733', '#b8bcc4', '#27406a', '#e7e1d3'];
    let x = px(8);
    let i = 0;
    while (x < W) {
      const len = px(90 + rng.next() * 80);
      yacht(p, x, waterY, len, hulls[i++ % hulls.length]!, px(40 + rng.next() * 40));
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = `rgba(${WARM},0.18)`;
        ctx.fillRect(x + len * (0.2 + k * 0.12), waterY + px(2 + k * 2), px(5), px(2));
      }
      x += len + px(14 + rng.next() * 26);
    }
  } else {
    // near: the quay: railing, bollards, string lights, spectators and parked cars
    const carCols = ['#f0f0f0', '#101216', '#b01212', '#2a3a58', '#c7a54a', '#7d838b'];
    for (let i = 0; i < 6; i++) {
      const x0 = (i + 0.3) * (W / 6);
      wrapped(W, x0, px(120), (xx) => parkedCar(p, xx, H - px(14), carCols[i]!, i % 2 === 1, i % 3 === 1 ? 'tail' : 'none'));
    }
    crowd(p, H - px(14), 2, 0.7);
    ctx.fillStyle = C('#8b939c');
    ctx.fillRect(0, H - px(46), W, px(2));
    for (let k = 0; k < W; k += px(26)) ctx.fillRect(k, H - px(46), px(2), px(32));
    for (let k = 0; k < W; k += px(48)) {
      ctx.fillStyle = C('#202428');
      ctx.fillRect(k + px(10), H - px(20), px(8), px(10));
    }
    // string lights between the lamp posts
    for (const fx of [0.08, 0.36, 0.64, 0.92]) streetLamp(p, W * fx, H - px(10), H * 0.6, WARM, fx > 0.5);
    ctx.strokeStyle = C('#3a3f46');
    ctx.lineWidth = px(1);
    for (let s = 0; s < 3; s++) {
      const x0 = W * (0.08 + s * 0.28) + px(28);
      const x1 = W * (0.36 + s * 0.28) + px(28);
      ctx.beginPath();
      ctx.moveTo(x0, H - H * 0.6 + px(6));
      ctx.quadraticCurveTo((x0 + x1) / 2, H - H * 0.6 + px(34), x1, H - H * 0.6 + px(6));
      ctx.stroke();
      for (let t = 0.1; t < 1; t += 0.1) {
        const xx = x0 + (x1 - x0) * t;
        const yy = H - H * 0.6 + px(6) + Math.sin(t * Math.PI) * px(22);
        ctx.fillStyle = `rgb(${WARM})`;
        ctx.fillRect(xx - px(1), yy, px(2), px(2));
        glow(ctx, xx, yy + px(1), px(9), WARM, 0.5);
      }
    }
    void cone;
  }
}
