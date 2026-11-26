import type { BodyStyle, CarConfig } from '../../../../data/schema';
import { bmw320iF30Meta, paintBmw320iF30 } from './bmw320iF30';
import { chevetteSl88Meta, paintChevetteSl88 } from './chevetteSl88';
import { golGts88Meta, paintGolGts88 } from './golGts88';
import { paintUnoMille95, unoMille95Meta } from './unoMille95';
import type { RasterBody, RasterMeta } from './types';

/**
 * Body styles drawn as painted raster art instead of the procedural vector outline. Their
 * geometry was measured on reference photographs; the vector design stays as the fallback
 * (and for the pure layer builder used by tests and `npm run assets`).
 */
const RASTER: Partial<Record<BodyStyle, { paint: RasterBody; meta: (car: CarConfig) => RasterMeta }>> = {
  golGts88: { paint: paintGolGts88, meta: golGts88Meta },
  bmw320iF30: { paint: paintBmw320iF30, meta: bmw320iF30Meta },
  chevetteSl88: { paint: paintChevetteSl88, meta: chevetteSl88Meta },
  unoMille95: { paint: paintUnoMille95, meta: unoMille95Meta },
};

export function rasterBodyFor(style: BodyStyle): RasterBody | undefined {
  return RASTER[style]?.paint;
}

export function rasterMetaFor(car: CarConfig): RasterMeta | undefined {
  return RASTER[car.visual.bodyStyle]?.meta(car);
}

export type { RasterBody, RasterFrames, RasterMeta } from './types';
