import type { CarConfig } from '../../data/schema';
import { painted } from '../../game/career/RivalBuildFactory';
import { resolveBuild, type BuildResult } from '../../game/career/tuning/BuildResolver';
import type { InstallPlan } from '../../game/career/tuning/ProjectRequirements';
import { reconcileTune } from '../../game/career/tuning/TuningCapabilities';
import { physicalSlotOf } from '../../game/career/tuning/partProgression';
import { findPart, type PartCategory, type PartDef } from '../../game/career/tuning/parts';
import { externalChanges, type ExternalChange, type PreviewState } from '../../game/vehicles/art/parts/PartVisualResolver';
import type { WorkshopPreviewPolicy, WorkshopSnapshot } from './WorkshopAdapter';

export const STOCK_PREFIX = 'stock:';
export const isStockId = (id: string | null): boolean => !!id && id.startsWith(STOCK_PREFIX);
export const stockCategory = (id: string): PartCategory => id.slice(STOCK_PREFIX.length) as PartCategory;

export function partInSlot(ids: readonly string[], slot: PartCategory): PartDef | undefined {
  return ids.map(findPart).find((p) => p && physicalSlotOf(p) === slot);
}

export interface PartPreview {
  selected: string;
  kind: 'part' | 'stock';
  part: PartDef | null;
  category: PartCategory;
  installed: boolean;
  owned: boolean;
  unlocked: boolean;
  before: BuildResult;
  after: BuildResult;
  nextParts: string[];
  plan: InstallPlan | null;
  state: PreviewState;
  beforeCar: CarConfig | null;
  afterCar: CarConfig | null;
  external: ExternalChange[];
}

/** Resolves the current and hypothetical builds with the same source of physics for both modes. */
export function previewWorkshop(s: WorkshopSnapshot, policy: WorkshopPreviewPolicy, selected: string, unlocked: boolean, current?: BuildResult): PartPreview {
  const part = findPart(selected) ?? null;
  const category = part?.category ?? stockCategory(selected);
  const before = current ?? resolveBuild(s.baseCar, s.installedParts, s.tune, s.buildVersion);
  const resolve = (ids: string[]): BuildResult => {
    const version = policy.versionOf(ids);
    const tune = reconcileTune(s.baseCar, ids, version, s.tune).tune;
    return resolveBuild(s.baseCar, ids, tune, version);
  };
  const installed = part ? s.installedParts.includes(part.id) : !partInSlot(s.installedParts, category);
  let nextParts = part && !installed
    ? policy.replace(s.installedParts, part.id)
    : s.installedParts.filter((id) => {
      const existing = findPart(id);
      return part ? id !== selected : !existing || physicalSlotOf(existing) !== category;
    });
  let after = !part && installed ? before : resolve(nextParts);
  let state: PreviewState = installed ? (part ? 'equipped' : 'original') : after.ok ? 'preview' : 'unavailable';
  const plan = part && !installed && !after.ok ? policy.plan(part.id) : null;
  if (plan && (plan.steps.length > 1 || plan.substitutes)) {
    const planned = resolve(plan.parts);
    if (planned.ok) {
      after = planned;
      nextParts = plan.parts;
      state = 'preview-pending';
    }
  }
  const beforeCar = before.ok ? painted(before.car, s.paint) : null;
  const afterCar = after.ok ? painted(after.car, s.paint) : null;
  return {
    selected, kind: part ? 'part' : 'stock', part, category, installed, owned: (s.inventory.get(selected) ?? 0) > 0,
    unlocked, before, after, nextParts, plan, state, beforeCar, afterCar,
    external: beforeCar && afterCar ? externalChanges(beforeCar, afterCar) : [],
  };
}
