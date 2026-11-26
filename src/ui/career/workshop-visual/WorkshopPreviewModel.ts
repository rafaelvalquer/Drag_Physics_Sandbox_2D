import { findCampaignCar } from '../../../data/cars/campaign';
import type { CarConfig } from '../../../data/schema';
import { buildVersionFor, CareerController } from '../../../game/career/CareerController';
import { isPartUnlocked, partStatus } from '../../../game/career/CareerProgression';
import type { CareerSave, OwnedCar } from '../../../game/career/CareerState';
import { painted } from '../../../game/career/RivalBuildFactory';
import { resolveBuild, type BuildResult } from '../../../game/career/tuning/BuildResolver';
import { familyOf } from '../../../game/career/tuning/BuildResolverV2';
import type { BuildTune } from '../../../game/career/tuning/buildCommon';
import { planInstall, type InstallPlan } from '../../../game/career/tuning/ProjectRequirements';
import { findPart, type PartCategory, type PartDef } from '../../../game/career/tuning/parts';
import { reconcileTune } from '../../../game/career/tuning/TuningCapabilities';
import { externalChanges, type ExternalChange, type PreviewState } from '../../../game/vehicles/art/parts/PartVisualResolver';

/**
 * Hypothetical builds of the workshop: what the car WOULD be with a part (or without it), computed
 * by the same code that installs it (CareerController.withPart, BuildResolver/V2 and
 * ProjectRequirements.planInstall). Nothing here reads or writes the save beyond reading it.
 */

/** Settings that survive a part change (the hardware still allows them and they are in range). */
export function keptTune(car: OwnedCar, parts: readonly string[]): BuildTune {
  if (!car.tune) return {};
  return reconcileTune(findCampaignCar(car.baseCarId)!, parts, buildVersionFor(car, parts), car.tune).tune;
}

/** Resolves a hypothetical part list of an owned car with the resolver version it would use. */
export function resolveOwned(car: OwnedCar, parts: readonly string[], tune = keptTune(car, parts)): BuildResult {
  return resolveBuild(findCampaignCar(car.baseCarId)!, parts, tune, buildVersionFor(car, parts));
}

export const STOCK_PREFIX = 'stock:';
export const isStockId = (id: string | null): id is string => !!id && id.startsWith(STOCK_PREFIX);
export const stockCategory = (id: string): PartCategory => id.slice(STOCK_PREFIX.length) as PartCategory;

export interface PartPreview {
  /** The selection: a part, or the factory part of a slot. */
  selected: string;
  kind: 'part' | 'stock';
  part: PartDef | null;
  category: PartCategory;
  installed: boolean;
  owned: boolean;
  unlocked: boolean;
  /** The car as it is. */
  before: BuildResult;
  /** The car with the part (or without it, for an installed part / the factory part). */
  after: BuildResult;
  /** Part list of the hypothetical build (the plan's list when the part needs other parts). */
  nextParts: string[];
  /** Install plan, only when the part alone does not make a valid build. */
  plan: InstallPlan | null;
  state: PreviewState;
  /** The painted cars the preview draws (null when the build is not valid). */
  beforeCar: CarConfig | null;
  afterCar: CarConfig | null;
  /** What really differs on the outside between the two cars. */
  external: ExternalChange[];
}

const paintOf = (car: OwnedCar, b: BuildResult): CarConfig | null => (b.ok ? painted(b.car, car.paint) : null);

/** Preview of a selection on the owned car. Pure: the save and the car are only read. */
export function previewSelection(save: CareerSave, car: OwnedCar, selected: string): PartPreview {
  const base = findCampaignCar(car.baseCarId)!;
  const before = resolveBuild(base, car.installedParts, car.tune ?? {}, buildVersionFor(car, car.installedParts));
  const fam = familyOf(base);
  if (isStockId(selected)) {
    const cat = stockCategory(selected);
    const inSlot = car.installedParts.filter((id) => findPart(id)?.category === cat);
    const nextParts = car.installedParts.filter((id) => !inSlot.includes(id));
    const after = resolveOwned(car, nextParts);
    const beforeCar = paintOf(car, before);
    const afterCar = paintOf(car, after);
    return {
      selected, kind: 'stock', part: null, category: cat, installed: inSlot.length === 0, owned: false, unlocked: true, before, after, nextParts, plan: null,
      state: inSlot.length === 0 ? 'original' : after.ok ? 'preview' : 'unavailable', beforeCar, afterCar,
      external: beforeCar && afterCar ? externalChanges(beforeCar, afterCar) : [],
    };
  }
  const part = findPart(selected)!;
  const installed = car.installedParts.includes(part.id);
  const owned = save.inventoryPartIds.includes(`${part.id}@${car.baseCarId}`);
  const unlocked = isPartUnlocked(save, part, fam);
  let nextParts = installed ? car.installedParts.filter((x) => x !== part.id) : CareerController.withPart(car.installedParts, part.id).parts;
  let after = resolveOwned(car, nextParts);
  let plan: InstallPlan | null = null;
  let state: PreviewState = installed ? 'equipped' : 'preview';
  if (!installed && !after.ok) {
    plan = planInstall({ base, car, save, partId: part.id, versionOf: (parts) => buildVersionFor(car, parts) });
    const planned = resolveOwned(car, plan.parts);
    if (planned.ok && plan.steps.length > 1) {
      // the part needs other parts: the preview shows the build the plan would install
      after = planned;
      nextParts = plan.parts;
      state = 'preview-pending';
    } else state = 'unavailable';
  }
  const beforeCar = paintOf(car, before);
  const afterCar = paintOf(car, after);
  return {
    selected, kind: 'part', part, category: part.category, installed, owned, unlocked, before, after, nextParts, plan, state, beforeCar, afterCar,
    external: beforeCar && afterCar ? externalChanges(beforeCar, afterCar) : [],
  };
}

/** Status of a part for this car (state, label, detail), as the catalogue and the pills show it. */
export function statusOf(save: CareerSave, car: OwnedCar, p: PartDef) {
  return partStatus(save, car, p, familyOf(findCampaignCar(car.baseCarId)!));
}
