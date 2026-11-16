import type { CarConfig } from '../../data/schema';
import { buildBodyArt } from './art/bodyArt';
import { DESIGNS } from './art/designs';
import { buildWheelArt } from './art/wheelArt';

/**
 * Vehicle asset pipeline.
 *
 *   car configuration ─► layered SVG artwork (pure, also used by `npm run assets`)
 *                      ─► rasterised once per car/resolution into ONE texture atlas
 *                      ─► frames + visual metadata shared by the track scene, the garage and
 *                         the dyno bay (the same artwork everywhere).
 *
 * Nothing here runs per frame: sprite sets are cached by a signature of the visual inputs.
 */
export type FrameName = 'under' | 'body' | 'gloss' | 'lights' | 'brake' | 'shadow' | 'hub' | 'wheel' | 'wheelSoft' | 'wheelFull';

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Visual metadata in metres, relative to the front-axle ground contact (x forward, y up). */
export interface VehicleVisualMeta {
  pxPerM: number;
  lengthM: number;
  heightM: number;
  wheelbaseM: number;
  /** Visual tyre radius = physical tyre radius. */
  tyreRadiusM: number;
  /** Pixel of the front-axle ground contact inside the body frames. */
  bodyOriginPx: { x: number; y: number };
  wheelCentres: { rear: { x: number; y: number }; front: { x: number; y: number } };
  /** Ground contact height of the tyres (always 0: the wheels rest on the track). */
  groundY: number;
  exhausts: { x: number; y: number }[];
  headlight: { x: number; y: number };
  taillight: { x: number; y: number };
  /** Tyre contact patches, where smoke and marks are emitted. */
  contact: { rear: { x: number; y: number }; front: { x: number; y: number } };
  /** Approximate visual centre of mass (pivot of the body motion). */
  centre: { x: number; y: number };
  rearX: number;
  noseX: number;
  roofY: number;
}

export interface LayerSvg {
  name: FrameName;
  svg: string;
  w: number;
  h: number;
}

export interface VehicleLayers {
  layers: LayerSvg[];
  meta: VehicleVisualMeta;
}

export interface VehicleSpriteSet {
  key: string;
  atlas: HTMLCanvasElement;
  frames: Record<FrameName, AtlasFrame>;
  meta: VehicleVisualMeta;
}

/** Signature of everything the artwork depends on. */
export function artSignature(car: CarConfig): string {
  return JSON.stringify([car.visual, car.wheelbaseM, car.tires.radiusM, car.exhaust.layout]);
}

/** Pure: the SVG layers and metadata of a car at `pxPerM` pixels per metre. */
export function buildVehicleLayers(car: CarConfig, pxPerM: number): VehicleLayers {
  const d = DESIGNS[car.visual.bodyStyle];
  const body = buildBodyArt(car, pxPerM);
  const caliper = d.wheel.caliper === 'paint' ? car.visual.color : d.wheel.caliper === 'accent' ? car.visual.accent : '#5a6068';
  const wheel = buildWheelArt(d.wheel, car.tires.radiusM, pxPerM, caliper, d.wheel.caliper === 'grey' ? car.visual.accent : caliper);
  const r = car.tires.radiusM;
  const wb = car.wheelbaseM;
  const frame = { w: body.w, h: body.h };
  return {
    layers: [
      { name: 'under', svg: body.under, ...frame },
      { name: 'body', svg: body.body, ...frame },
      { name: 'gloss', svg: body.gloss, ...frame },
      { name: 'lights', svg: body.lights, ...frame },
      { name: 'brake', svg: body.brake, ...frame },
      { name: 'shadow', svg: body.shadow.svg, w: body.shadow.w, h: body.shadow.h },
      { name: 'hub', svg: wheel.hubSvg, w: wheel.size, h: wheel.size },
      { name: 'wheel', svg: wheel.wheelSvg, w: wheel.size, h: wheel.size },
    ],
    meta: {
      pxPerM,
      lengthM: car.visual.lengthM,
      heightM: car.visual.heightM,
      wheelbaseM: wb,
      tyreRadiusM: r,
      bodyOriginPx: { x: body.originX, y: body.originY },
      wheelCentres: { rear: { x: -wb, y: r }, front: { x: 0, y: r } },
      groundY: 0,
      exhausts: body.exhausts,
      headlight: body.headlight,
      taillight: body.taillight,
      contact: { rear: { x: -wb, y: 0 }, front: { x: 0, y: 0 } },
      centre: { x: -wb / 2, y: r + 0.22 },
      rearX: body.rearX,
      noseX: body.noseX,
      roofY: body.roofY,
    },
  };
}

function newCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

async function rasterise(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const [c, ctx] = newCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

/**
 * Rotational motion blur of a wheel: the average of `steps` copies rotated over `spreadRad`
 * (premultiplied accumulation in floating point, so dark rubber does not band).
 */
export function spinBlur(wheel: HTMLCanvasElement, spreadRad: number, steps: number): HTMLCanvasElement {
  const size = wheel.width;
  const [, tctx] = newCanvas(size, size);
  const acc = new Float32Array(size * size * 4);
  for (let i = 0; i < steps; i++) {
    const a = steps === 1 ? 0 : -spreadRad / 2 + (spreadRad * i) / (steps - 1);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, size, size);
    tctx.translate(size / 2, size / 2);
    tctx.rotate(a);
    tctx.drawImage(wheel, -size / 2, -size / 2);
    const data = tctx.getImageData(0, 0, size, size).data;
    for (let k = 0; k < data.length; k += 4) {
      const al = data[k + 3]! / 255;
      acc[k] = acc[k]! + data[k]! * al;
      acc[k + 1] = acc[k + 1]! + data[k + 1]! * al;
      acc[k + 2] = acc[k + 2]! + data[k + 2]! * al;
      acc[k + 3] = acc[k + 3]! + al;
    }
  }
  const [outC, octx] = newCanvas(size, size);
  const img = octx.createImageData(size, size);
  for (let k = 0; k < acc.length; k += 4) {
    const al = acc[k + 3]!;
    if (al <= 1e-6) continue;
    img.data[k] = acc[k]! / al;
    img.data[k + 1] = acc[k + 1]! / al;
    img.data[k + 2] = acc[k + 2]! / al;
    img.data[k + 3] = (al / steps) * 255;
  }
  octx.putImageData(img, 0, 0);
  return outC;
}

const cache = new Map<string, Promise<VehicleSpriteSet>>();
const MAX_CACHED = 12;

/** Builds (or returns the cached) sprite set of a car at the given resolution. */
export function assembleVehicleSprites(car: CarConfig, pxPerM: number): Promise<VehicleSpriteSet> {
  const key = `${pxPerM}|${artSignature(car)}`;
  const hit = cache.get(key);
  if (hit) {
    // refresh the LRU order
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const job = (async (): Promise<VehicleSpriteSet> => {
    const { layers, meta } = buildVehicleLayers(car, pxPerM);
    const rasters = await Promise.all(layers.map((l) => rasterise(l.svg, l.w, l.h)));
    const byName = new Map<FrameName, HTMLCanvasElement>();
    layers.forEach((l, i) => byName.set(l.name, rasters[i]!));
    const wheel = byName.get('wheel')!;
    byName.set('wheelSoft', spinBlur(wheel, 0.55, 14));
    byName.set('wheelFull', spinBlur(wheel, Math.PI * 2, 72));
    // pack: tall frames stacked, wheels on one row
    const PAD = 2;
    const order: FrameName[] = ['under', 'body', 'gloss', 'lights', 'brake', 'shadow'];
    const row: FrameName[] = ['hub', 'wheel', 'wheelSoft', 'wheelFull'];
    let width = 0;
    let y = PAD;
    const frames = {} as Record<FrameName, AtlasFrame>;
    for (const n of order) {
      const c = byName.get(n)!;
      frames[n] = { x: PAD, y, w: c.width, h: c.height };
      y += c.height + PAD;
      width = Math.max(width, c.width + PAD * 2);
    }
    let x = PAD;
    let rowH = 0;
    for (const n of row) {
      const c = byName.get(n)!;
      frames[n] = { x, y, w: c.width, h: c.height };
      x += c.width + PAD;
      rowH = Math.max(rowH, c.height);
    }
    width = Math.max(width, x);
    const [atlas, ctx] = newCanvas(width, y + rowH + PAD);
    for (const [n, c] of byName) {
      const f = frames[n];
      ctx.drawImage(c, f.x, f.y);
    }
    return { key, atlas, frames, meta };
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  while (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return job;
}

/** Draws one atlas frame on a 2D canvas (garage and dyno previews). */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  set: VehicleSpriteSet,
  name: FrameName,
  dx: number,
  dy: number,
  scale = 1,
): void {
  const f = set.frames[name];
  ctx.drawImage(set.atlas, f.x, f.y, f.w, f.h, dx, dy, f.w * scale, f.h * scale);
}
