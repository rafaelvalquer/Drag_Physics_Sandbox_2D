import type { CarConfig } from '../../../../data/schema';
import type { PartCategory, PartDef } from '../../../career/tuning/parts';
import type { AssetId, PartVisualEntry, ViewMode } from './PartVisualRegistry';
import { visualEntryOf } from './PartVisualRegistry';
import type { VisualZone } from './PartVisualAnchors';

/** What really changes in the car's outside view between two resolved builds (the game's own art). */
export type ExternalChange = 'tyre' | 'exhaust-tip' | 'intercooler';

export const EXTERNAL_CHANGE_LABEL: Record<ExternalChange, string> = {
  tyre: 'Escrita e aparência do pneu',
  'exhaust-tip': 'Ponteira do escapamento',
  intercooler: 'Intercooler visível na frente',
};

/** Compares the visual mods of two resolved cars: nothing else is called an external change. */
export function externalChanges(before: CarConfig, after: CarConfig): ExternalChange[] {
  const a = before.visual.mods;
  const b = after.visual.mods;
  const out: ExternalChange[] = [];
  if ((a?.tyre ?? 'stock') !== (b?.tyre ?? 'stock')) out.push('tyre');
  if (!!a?.sportTip !== !!b?.sportTip) out.push('exhaust-tip');
  if (!!a?.intercooler !== !!b?.intercooler) out.push('intercooler');
  return out;
}

/** Technical drawing state of a resolved car (what the technical view draws as installed). */
export interface TechState {
  turbo: 'none' | 'single' | 'twin';
  intercooler: boolean;
  nitrous: boolean;
  sportExhaust: boolean;
  tyre: 'stock' | 'sport' | 'semiSlick' | 'slick';
  awd: boolean;
  cylinders: number;
  architecture: string;
  bankAngleDeg: number;
}

export function techStateOf(car: CarConfig): TechState {
  const t = car.engine.turbo;
  return {
    turbo: car.engine.induction !== 'turbo' || !t ? 'none' : t.layout === 'parallel-twin' ? 'twin' : 'single',
    intercooler: !!car.visual.mods?.intercooler,
    nitrous: !!car.nitrous,
    sportExhaust: !!car.visual.mods?.sportTip,
    tyre: car.visual.mods?.tyre ?? 'stock',
    awd: car.drivenAxle === 'awd',
    cylinders: car.engine.cylinders,
    architecture: car.engine.architecture,
    bankAngleDeg: car.engine.bankAngleDeg,
  };
}

/** Preview states of a part (original, equipped, preview available/pending, unavailable, loading, failed). */
export type PreviewState = 'original' | 'equipped' | 'preview' | 'preview-pending' | 'unavailable' | 'loading' | 'failed';

export interface ResolvedPartVisual extends PartVisualEntry {
  /** Illustration to draw, refined by the part's own data (tyre grade, exhaust preset, turbo layout). */
  asset: AssetId;
  mode: ViewMode;
  zone: VisualZone;
}

/** Refines the category illustration with what the part itself says (no catalogue data is copied). */
export function resolvePartVisual(p: { category: PartCategory } & Record<string, unknown>): ResolvedPartVisual {
  const entry = visualEntryOf(p as Pick<PartDef, 'category'>);
  let asset = entry.assetId;
  if (p.category === 'tires') {
    const g = p.grade as string | undefined;
    asset = g === 'slick' ? 'tire-slick' : g === 'semiSlick' ? 'tire-semislick' : 'tire-sport';
  } else if ((p.category === 'turbo' || p.category === 'turbo-turbine') && (p.turbo as { layout?: string } | undefined)?.layout === 'parallel-twin') {
    asset = 'turbo-twin';
  }
  return { ...entry, asset, mode: entry.defaultMode, zone: entry.anchorId };
}

/** Drawing of the factory part of a slot (the original tyre and the original exhaust tip have their own). */
export function stockAsset(c: PartCategory): AssetId {
  return c === 'tires' ? 'tire-stock' : c === 'exhaust' ? 'exhaust-free' : visualEntryOf({ category: c }).assetId;
}

export function categoryZone(c: PartCategory): VisualZone {
  return visualEntryOf({ category: c }).anchorId;
}
