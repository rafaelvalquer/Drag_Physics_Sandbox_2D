import type { BodyStyle, CarConfig } from '../../../../data/schema';
import { golGts88Meta, paintGolGts88 } from './golGts88';
import type { RasterBody, RasterMeta } from './types';

/**
 * Body styles drawn as painted raster art instead of the procedural vector outline. Their
 * geometry was measured on reference photographs; the vector design stays as the fallback
 * (and for the pure layer builder used by tests and `npm run assets`).
 */
const RASTER: Partial<Record<BodyStyle, { paint: RasterBody; meta: (car: CarConfig) => RasterMeta }>> = {
  golGts88: { paint: paintGolGts88, meta: golGts88Meta },
};

export function rasterBodyFor(style: BodyStyle): RasterBody | undefined {
  return RASTER[style]?.paint;
}

export function rasterMetaFor(car: CarConfig): RasterMeta | undefined {
  return RASTER[car.visual.bodyStyle]?.meta(car);
}

export type { RasterBody, RasterFrames, RasterMeta } from './types';
