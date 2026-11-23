import type { CarConfig } from '../../../../data/schema';

/** Lamp and exhaust positions the raster art implies (m, relative to the front-axle contact). */
export interface RasterMeta {
  headlight: { x: number; y: number };
  taillight: { x: number; y: number };
  exhausts: { x: number; y: number }[];
}

/** Frames a raster painter replaces; the shadow and the brake hubs stay with the vector art. */
export interface RasterFrames {
  body: HTMLCanvasElement;
  gloss: HTMLCanvasElement;
  under: HTMLCanvasElement;
  lights: HTMLCanvasElement;
  brake: HTMLCanvasElement;
  wheel: HTMLCanvasElement;
}

/**
 * Paints the body frames of one body style at `pxPerM` into canvases the size of the vector
 * frames, with the same origin (bodyArt's frame: 0.5 m behind the tail, 0.42 m above the roof).
 */
export type RasterBody = (
  car: CarConfig,
  pxPerM: number,
  frame: { w: number; h: number },
  wheelSize: number,
  newCanvas: (w: number, h: number) => [HTMLCanvasElement, CanvasRenderingContext2D],
) => RasterFrames;
