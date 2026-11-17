import { shade } from '../vehicles/art/svg';
import { building, wrapped } from './environmentArt';
import { glow, cone, lightTower, parkedCar, person, streetLamp, type Painter } from './environmentCampaign';
import { litFar } from './LightingController';
import type { Theme } from './trackArt';

/**
 * Parallax scenery of the Chapter 2 venues ("Liga da Madrugada"). Same layer contract as
 * environmentCampaign.ts; original procedural artwork (no photos, no brands, invented words only).
 *
 * - Pátio das Torres: office blocks around a car park, blue-white LED light, spectators' cars.
 * - Distrito Financeiro: glass skyscrapers with architectural light, an elevated road, reflections.
 * - Corredor da Liga: an isolated closed road between large industrial structures, flood lights,
 *   crowd behind barriers and an event gantry at the start.
 */
export function chapter2Layer(theme: Theme, p: Painter): void {
  if (theme === 'patioDasTorres') patio(p);
  else if (theme === 'distritoFinanceiro') financeiro(p);
  else corredor(p);
}

const LED = '200,225,255';

/** Office tower with a regular glass grid and a lit crown. */
function tower(p: Painter, x: number, foot: number, w: number, h: number, wall: string, crown: string | null, lit: number): void {
  const { ctx, rng, px, l } = p;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(wall, 0.1));
  g.addColorStop(1, shade(wall, -0.25));
  ctx.fillStyle = g;
  ctx.fillRect(x, foot - h, w, h);
  const cols = Math.max(3, Math.floor(w / px(9)));
  const rows = Math.max(4, Math.floor(h / px(8)));
  const cw = w / cols;
  const rh = h / rows;
  for (let r = 1; r < rows; r++) {
    const floorLit = rng.next() < lit;
    for (let c = 0; c < cols; c++) {
      const on = floorLit ? rng.next() < 0.8 : rng.next() < lit * 0.25;
      ctx.fillStyle = on ? litFar(rng.next() < 0.7 ? '#cfe3ff' : '#f3e2b0', l, 0.15) : shade(wall, -0.35);
      ctx.fillRect(x + c * cw + cw * 0.15, foot - h + r * rh + rh * 0.2, cw * 0.7, rh * 0.55);
    }
  }
  if (crown) {
    ctx.fillStyle = `rgb(${crown})`;
    ctx.fillRect(x, foot - h - px(3), w, px(3));
    glow(ctx, x + w / 2, foot - h, w * 0.7, crown, 0.35);
  }
}

/** Car park lighting column with a twin LED head. */
function parkLamp(p: Painter, x: number, foot: number, h: number): void {
  const { ctx, px, C } = p;
  ctx.fillStyle = C('#6b7280');
  ctx.fillRect(x - px(2), foot - h, px(4), h);
  ctx.fillRect(x - px(22), foot - h, px(44), px(3));
  for (const d of [-1, 1]) {
    ctx.fillStyle = `rgb(${LED})`;
    ctx.fillRect(x + d * px(18) - px(6), foot - h + px(3), px(12), px(3));
    cone(ctx, x + d * px(18), foot - h + px(6), px(120), h - px(6), LED, 0.1);
    glow(ctx, x + d * px(18), foot - h + px(4), px(30), LED, 0.5);
  }
}

function crowd(p: Painter, foot: number, rows: number, density: number): void {
  const { ctx, rng, px, l, W } = p;
  const clothes = ['#3f6f9a', '#d9d4c7', '#1f2226', '#a3a7ad', '#5b5f66', '#2c4f7a', '#8a3c3c', '#c9a23f'];
  const skins = ['#e0b896', '#b9845c', '#8a5a3c', '#f0cdb0', '#6e4630'];
  for (let row = 0; row < rows; row++) {
    const s = px(1.1 - row * 0.12);
    const y = foot - row * px(9);
    const dim = 0.28 + row * 0.12;
    for (let x = rng.next() * px(8); x < W; x += px(12 + rng.next() * 12) / density) {
      if (rng.next() < 0.1) {
        x += px(36);
        continue;
      }
      person(ctx, x, y, s, litFar(clothes[Math.floor(rng.next() * clothes.length)]!, l, dim), litFar(skins[Math.floor(rng.next() * skins.length)]!, l, dim), rng.next() < 0.14);
    }
  }
}

// ------------------------------------------------------------------------------- Pátio das Torres

function patio(p: Painter): void {
  const { ctx, W, H, rng, l, C, px, layer } = p;
  if (layer === 0) {
    // ring of mid-rise office towers, blue-white crowns, a few red aviation lights
    let x = 0;
    while (x < W) {
      const w = px(50 + rng.next() * 70);
      const h = px(120 + rng.next() * 190);
      tower(p, x, H, w, h, C(['#283246', '#2e384c', '#242c3c'][Math.floor(rng.next() * 3)]!, 0.02), rng.next() < 0.4 ? LED : null, 0.35);
      if (rng.next() < 0.3) {
        ctx.fillStyle = '#ff3b30';
        ctx.fillRect(x + w / 2 - px(2), H - h - px(7), px(4), px(4));
        glow(ctx, x + w / 2, H - h - px(5), px(10), '255,60,50', 0.6);
      }
      x += w + px(8 + rng.next() * 30);
    }
  } else if (layer === 1) {
    // low office blocks with lobbies and a multi-storey car park deck
    let x = 0;
    while (x < W) {
      const w = px(140 + rng.next() * 120);
      const h = px(90 + rng.next() * 80);
      building(ctx, rng, x, H - px(34), w, h, C(['#3c4658', '#465064', '#384152'][Math.floor(rng.next() * 3)]!), l, 0.3);
      // glass lobby
      ctx.fillStyle = litFar('#9fc3e8', l, 0.25);
      ctx.fillRect(x + w * 0.2, H - px(34), w * 0.6, px(34));
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = x + w * 0.2; k < x + w * 0.8; k += px(14)) ctx.fillRect(k, H - px(34), px(2), px(34));
      glow(ctx, x + w / 2, H - px(16), w * 0.45, LED, 0.18);
      x += w + px(10 + rng.next() * 20);
    }
    // parking deck: two slabs on columns
    const dx = W * 0.55;
    const dw = px(420);
    for (const top of [H - px(120), H - px(70)]) {
      ctx.fillStyle = C('#8c939b');
      ctx.fillRect(dx, top, dw, px(10));
      ctx.fillStyle = `rgb(${LED})`;
      for (let k = dx + px(20); k < dx + dw; k += px(70)) {
        ctx.fillRect(k, top + px(10), px(14), px(2));
        glow(ctx, k + px(7), top + px(14), px(24), LED, 0.35);
      }
    }
    ctx.fillStyle = C('#6c737b');
    for (let k = dx; k <= dx + dw; k += px(84)) ctx.fillRect(k, H - px(120), px(8), px(120));
  } else {
    // near: car park with spectators' cars, lamp columns and people standing by the cars
    for (let i = 0; i < 4; i++) parkLamp(p, (i + 0.5) * (W / 4), H, H * 0.9);
    const carCols = ['#e9e9e6', '#1c1f24', '#8a1d22', '#2f4f7a', '#9aa0a6', '#d4a020'];
    for (let i = 0; i < 6; i++) {
      const x0 = (i + 0.3) * (W / 6);
      wrapped(W, x0, px(120), (xx) => parkedCar(p, xx, H - px(6), carCols[i]!, i % 2 === 0, i % 3 === 0 ? 'tail' : 'none'));
    }
    crowd(p, H - px(4), 1, 0.45);
    // painted bay lines
    ctx.fillStyle = C('#d8dce0');
    for (let k = 0; k < W; k += px(110)) ctx.fillRect(k, H - px(4), px(60), px(2));
  }
}

// ------------------------------------------------------------------------------- Distrito Financeiro

function financeiro(p: Painter): void {
  const { ctx, W, H, rng, l, C, px, layer } = p;
  if (layer === 0) {
    // tall glass skyscrapers, architectural uplight (warm and cold), one spire
    const sky = ctx.createLinearGradient(0, H * 0.2, 0, H);
    sky.addColorStop(0, 'rgba(80,110,170,0)');
    sky.addColorStop(1, 'rgba(110,140,200,0.22)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    let x = 0;
    while (x < W) {
      const w = px(40 + rng.next() * 60);
      const h = px(200 + rng.next() * 190);
      const crown = rng.next() < 0.5 ? (rng.next() < 0.5 ? '255,210,140' : LED) : null;
      tower(p, x, H, w, h, C(['#1d2738', '#222e42', '#1a2232'][Math.floor(rng.next() * 3)]!, 0.02), crown, 0.45);
      // uplight wash on the facade
      if (rng.next() < 0.5) {
        const g = ctx.createLinearGradient(0, H, 0, H - h);
        g.addColorStop(0, 'rgba(160,200,255,0.18)');
        g.addColorStop(1, 'rgba(160,200,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, H - h, w, h);
      }
      x += w + px(4 + rng.next() * 16);
    }
    const sx = W * 0.32;
    ctx.fillStyle = C('#3a4558', 0.02);
    ctx.beginPath();
    ctx.moveTo(sx - px(30), H);
    ctx.lineTo(sx - px(14), H - px(390));
    ctx.lineTo(sx, H - px(395) - px(60));
    ctx.lineTo(sx + px(14), H - px(390));
    ctx.lineTo(sx + px(30), H);
    ctx.fill();
    glow(ctx, sx, H - px(450), px(16), '255,60,50', 0.8);
  } else if (layer === 1) {
    // elevated road on slender columns with traffic, glass podiums underneath
    let x = 0;
    while (x < W) {
      const w = px(160 + rng.next() * 140);
      const h = px(60 + rng.next() * 50);
      ctx.fillStyle = litFar('#5f7fa6', l, 0.3);
      ctx.fillRect(x, H - h, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = x; k < x + w; k += px(16)) ctx.fillRect(k, H - h, px(2), h);
      for (let k = H - h; k < H; k += px(14)) ctx.fillRect(x, k, w, px(1.5));
      glow(ctx, x + w / 2, H - h / 2, w * 0.4, '255,220,160', 0.12);
      x += w + px(20 + rng.next() * 40);
    }
    const deck = H * 0.4;
    for (let k = px(80); k < W; k += px(220)) {
      ctx.fillStyle = C('#7b828a');
      ctx.fillRect(k, deck + px(18), px(18), H - deck - px(18));
    }
    const dg = ctx.createLinearGradient(0, deck, 0, deck + px(18));
    dg.addColorStop(0, C('#a7aeb5'));
    dg.addColorStop(1, C('#5d636a'));
    ctx.fillStyle = dg;
    ctx.fillRect(0, deck, W, px(18));
    ctx.fillStyle = C('#c4c9ce');
    ctx.fillRect(0, deck - px(6), W, px(6));
    for (let i = 0; i < 30; i++) {
      const tx = rng.next() * W;
      const rgb = rng.next() < 0.5 ? '255,60,50' : '255,245,210';
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.fillRect(tx, deck - px(10), px(5), px(3));
      glow(ctx, tx + px(2.5), deck - px(9), px(12), rgb, 0.5);
    }
    // strip of blue LED under the deck
    ctx.fillStyle = `rgb(${LED})`;
    ctx.fillRect(0, deck + px(18), W, px(2));
    for (let k = 0; k < W; k += px(110)) glow(ctx, k, deck + px(22), px(50), LED, 0.2);
  } else {
    // near: glass street front with lit lobbies, bollards, planters, wet-asphalt reflections
    let x = 0;
    while (x < W) {
      const w = px(180 + rng.next() * 80);
      ctx.fillStyle = C('#2b3443');
      ctx.fillRect(x, px(20), w, H - px(20));
      ctx.fillStyle = litFar('#b8d4f0', l, 0.18);
      ctx.fillRect(x + px(10), H - px(110), w - px(20), px(96));
      ctx.fillStyle = 'rgba(10,14,20,0.6)';
      for (let k = x + px(10); k < x + w - px(10); k += px(30)) ctx.fillRect(k, H - px(110), px(3), px(96));
      glow(ctx, x + w / 2, H - px(60), w * 0.5, '230,240,255', 0.2);
      x += w + px(8);
    }
    for (let k = px(20); k < W; k += px(60)) {
      ctx.fillStyle = C('#9aa1a8');
      ctx.fillRect(k, H - px(16), px(5), px(16));
      ctx.fillStyle = `rgb(${LED})`;
      ctx.fillRect(k, H - px(16), px(5), px(2));
    }
    for (let i = 0; i < 3; i++) {
      const x0 = (i + 0.5) * (W / 3);
      wrapped(W, x0, px(120), (xx) => parkedCar(p, xx, H - px(18), ['#101215', '#b7bcc2', '#22344f'][i]!, i % 2 === 0, 'tail'));
    }
    // reflections: soft vertical streaks at the foot under the light sources
    for (let k = 0; k < W; k += px(48)) {
      const g = ctx.createLinearGradient(0, H - px(6), 0, H);
      g.addColorStop(0, 'rgba(200,225,255,0.18)');
      g.addColorStop(1, 'rgba(200,225,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(k, H - px(6), px(10), px(6));
    }
  }
}

// ------------------------------------------------------------------------------- Corredor da Liga

function corredor(p: Painter): void {
  const { ctx, W, H, rng, l, C, px, layer } = p;
  const flood = '240,244,255';
  if (layer === 0) {
    // huge industrial structures: silos, a cooling tower, gantry cranes, all against a bright haze
    const sky = ctx.createLinearGradient(0, H * 0.3, 0, H);
    sky.addColorStop(0, 'rgba(150,160,190,0)');
    sky.addColorStop(1, 'rgba(170,180,210,0.25)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let x = px(30); x < W; x += px(180 + rng.next() * 120)) {
      const kind = Math.floor(rng.next() * 3);
      if (kind === 0) {
        for (let s = 0; s < 3; s++) {
          ctx.fillStyle = C(['#3b414c', '#434a56', '#363c46'][s]!, 0.02);
          ctx.fillRect(x + s * px(34), H - px(220), px(30), px(220));
          ctx.beginPath();
          ctx.ellipse(x + s * px(34) + px(15), H - px(220), px(15), px(6), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (kind === 1) {
        ctx.fillStyle = C('#454b55', 0.02);
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.quadraticCurveTo(x + px(30), H - px(130), x + px(14), H - px(250));
        ctx.lineTo(x + px(116), H - px(250));
        ctx.quadraticCurveTo(x + px(100), H - px(130), x + px(130), H);
        ctx.fill();
      } else {
        ctx.strokeStyle = C('#56606c', 0.02);
        ctx.lineWidth = px(3);
        ctx.strokeRect(x, H - px(260), px(16), px(260));
        ctx.strokeRect(x + px(150), H - px(260), px(16), px(260));
        ctx.fillStyle = C('#56606c', 0.02);
        ctx.fillRect(x - px(40), H - px(270), px(250), px(14));
        glow(ctx, x + px(80), H - px(262), px(14), '255,60,50', 0.7);
      }
    }
  } else if (layer === 1) {
    // warehouses and pipe racks, floodlight towers along the corridor
    let x = 0;
    while (x < W) {
      const w = px(200 + rng.next() * 160);
      const h = px(110 + rng.next() * 60);
      const wall = C(['#4f5660', '#5a6068', '#474d56'][Math.floor(rng.next() * 3)]!);
      ctx.fillStyle = wall;
      ctx.fillRect(x, H - h, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = x; k < x + w; k += px(8)) ctx.fillRect(k, H - h, px(3), h);
      ctx.fillStyle = shade(wall, -0.25);
      ctx.fillRect(x, H - h - px(8), w, px(8));
      x += w + px(14);
    }
    // pipe rack
    ctx.strokeStyle = C('#8b939c');
    ctx.lineWidth = px(5);
    for (const y of [H - px(60), H - px(70)]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) lightTower(p, (i + 0.5) * (W / 4), H, H * 0.85);
  } else {
    // near: grandstand-style crowd behind concrete barriers with event banners (invented words)
    crowd(p, H - px(36), 3, 1);
    for (let k = 0; k < W; k += px(80)) {
      ctx.fillStyle = C('#c3c6c9');
      ctx.fillRect(k, H - px(34), px(76), px(34));
      ctx.fillStyle = C('#9a9da1');
      ctx.fillRect(k, H - px(34), px(76), px(4));
    }
    // banners: alternating colour blocks with the league's invented name
    const cols = ['#1d3a8a', '#b71c2c', '#e8b007'];
    ctx.font = `bold ${px(13)}px sans-serif`;
    ctx.textBaseline = 'middle';
    for (let k = 0, i = 0; k < W; k += px(240), i++) {
      ctx.fillStyle = litFar(cols[i % 3]!, l, 0.12);
      ctx.fillRect(k + px(10), H - px(30), px(200), px(18));
      ctx.fillStyle = litFar('#f4f4f4', l, 0.1);
      ctx.fillText('LIGA DA MADRUGADA', k + px(30), H - px(21));
    }
    for (const fx of [0.2, 0.7]) lightTower(p, W * fx, H - px(34), H * 0.9);
    for (const fx of [0.05, 0.45, 0.85]) streetLamp(p, W * fx, H - px(34), H * 0.5, flood, fx > 0.5);
  }
}
