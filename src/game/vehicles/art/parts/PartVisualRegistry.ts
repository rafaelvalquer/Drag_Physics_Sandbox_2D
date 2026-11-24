import type { PartCategory, PartDef } from '../../../career/tuning/parts';
import type { VisualZone } from './PartVisualAnchors';

/**
 * Visual registry of the workshop: how every part is SHOWN. It is independent of the physical
 * catalogue (`parts.ts`): it holds no price, requirement or physics, only where the part belongs on
 * the car, which view explains it best and which illustration represents it. What a part really
 * changes on the car is never declared here: the external preview compares the resolved cars
 * (`PartVisualResolver`), so a modification that is only internal never shows up as external.
 */
export type ViewMode = 'external' | 'technical' | 'detail';

/** Illustrated families (wheels, tyres, exhaust and turbo have dedicated drawings; the rest use a technical or generic one). */
export type AssetId =
  | 'wheel-original' | 'wheel-sport'
  | 'tire-sport' | 'tire-semislick' | 'tire-slick' | 'tire-stock'
  | 'exhaust-free' | 'exhaust-sport' | 'exhaust-section'
  | 'turbo-single' | 'turbo-twin' | 'turbo-control'
  | 'intercooler' | 'nitrous' | 'engine-internals' | 'intake' | 'clutch' | 'gearbox' | 'diff'
  | 'cooling' | 'ecu' | 'suspension' | 'weight' | 'generic';

export interface PartVisualEntry {
  /** Illustration used in the detail view and in the list. */
  assetId: AssetId;
  /** Anchor of the car where the part goes (hotspot and highlight of the technical view). */
  anchorId: VisualZone;
  /** View that explains the part best (when it is picked). */
  defaultMode: ViewMode;
  layer: 'body' | 'under' | 'technical';
  scale: number;
  /** The part can be previewed before buying (every catalogue part can: the preview is the resolver). */
  supportsPreview: boolean;
  /** The installed part shows in the car's view (technical drawing or external art). */
  supportsInstalledView: boolean;
  /** Has a dedicated illustration (otherwise the generic family drawing). */
  illustrated: boolean;
}

const e = (assetId: AssetId, anchorId: VisualZone, defaultMode: ViewMode, illustrated = false, layer: PartVisualEntry['layer'] = 'technical'): PartVisualEntry => ({
  assetId, anchorId, defaultMode, layer, scale: 1, supportsPreview: true, supportsInstalledView: true, illustrated,
});

/** Category -> visual entry. Every PartCategory is covered (a unit test keeps it so). */
export const CATEGORY_VISUAL: Record<PartCategory, PartVisualEntry> = {
  'intake-filter': e('intake', 'intake', 'technical'),
  'intake-manifold': e('intake', 'intake', 'technical'),
  'intake-throttle': e('intake', 'intake', 'technical'),
  'intake-airbox': e('intake', 'intake', 'technical'),
  camshaft: e('engine-internals', 'engine', 'technical'),
  'engine-head': e('engine-internals', 'engine', 'technical'),
  'cylinder-head': e('engine-internals', 'engine', 'technical'),
  'engine-compression': e('engine-internals', 'engine', 'technical'),
  'engine-internals': e('engine-internals', 'engine', 'technical'),
  pistons: e('engine-internals', 'engine', 'technical'),
  'engine-flywheel': e('clutch', 'clutch', 'technical'),
  flywheel: e('clutch', 'clutch', 'technical'),
  'engine-valvetrain': e('engine-internals', 'engine', 'technical'),
  exhaust: e('exhaust-sport', 'exhaust', 'external', true, 'body'),
  'exhaust-header': e('exhaust-section', 'exhaust', 'technical'),
  'exhaust-downpipe': e('exhaust-section', 'exhaust', 'technical'),
  'exhaust-pipe': e('exhaust-section', 'exhaust', 'technical'),
  'exhaust-muffler': e('exhaust-section', 'exhaust', 'technical'),
  clutch: e('clutch', 'clutch', 'technical'),
  differential: e('diff', 'diff', 'technical'),
  'transmission-gearbox': e('gearbox', 'transmission', 'technical'),
  gearbox: e('gearbox', 'transmission', 'technical'),
  awd: e('diff', 'diff', 'technical'),
  tires: e('tire-sport', 'tire', 'external', true, 'body'),
  'tires-width': e('tire-stock', 'tire', 'detail', true, 'body'),
  'tires-pressure': e('tire-stock', 'tire', 'detail', true, 'body'),
  turbo: e('turbo-single', 'turbo', 'technical', true),
  'turbo-turbine': e('turbo-single', 'turbo', 'technical', true),
  'turbo-intercooler': e('intercooler', 'intercooler', 'technical'),
  intercooler: e('intercooler', 'intercooler', 'technical'),
  'turbo-wastegate': e('turbo-control', 'turbo', 'technical'),
  'turbo-boost': e('turbo-control', 'turbo', 'technical'),
  'boost-control': e('turbo-control', 'turbo', 'technical'),
  'electronics-ecu': e('ecu', 'ecu', 'technical'),
  ecu: e('ecu', 'ecu', 'technical'),
  'electronics-fuel': e('ecu', 'ecu', 'technical'),
  'electronics-ignition': e('ecu', 'ecu', 'technical'),
  'electronics-launch': e('ecu', 'ecu', 'technical'),
  'cooling-radiator': e('cooling', 'cooling', 'technical'),
  'cooling-oil': e('cooling', 'cooling', 'technical'),
  'cooling-fan': e('cooling', 'cooling', 'technical'),
  'chassis-weight': e('weight', 'weight', 'detail'),
  'chassis-suspension': e('suspension', 'suspension', 'detail'),
  suspension: e('suspension', 'suspension', 'detail'),
  nitrous: e('nitrous', 'nitro', 'technical'),
};

/** Wheels (rims) are a reserved family: the catalogue has no rim part yet, so none is invented. */
export const RESERVED_FAMILIES: readonly AssetId[] = ['wheel-original', 'wheel-sport'];

export function visualEntryOf(p: Pick<PartDef, 'category'>): PartVisualEntry {
  return CATEGORY_VISUAL[p.category];
}
