import { findCampaignCar } from '../../data/cars/campaign';
import { buildVersionFor, CareerController } from '../../game/career/CareerController';
import { partRequirements, partStatus, unlocksOf } from '../../game/career/CareerProgression';
import type { CareerSave, OwnedCar } from '../../game/career/CareerState';
import { familyOf, incompatibility } from '../../game/career/tuning/BuildResolverV2';
import { resolveBuild, type BuildResult } from '../../game/career/tuning/BuildResolver';
import { planInstall, withPartId } from '../../game/career/tuning/ProjectRequirements';
import { ALL_PARTS, findPart, UNLOCK_LABEL, type PartDef } from '../../game/career/tuning/parts';
import type { WorkshopAction, WorkshopActionResult, WorkshopAdapter, WorkshopPreviewPolicy, WorkshopSnapshot } from './WorkshopAdapter';
import { partInSlot, previewWorkshop, type PartPreview } from './WorkshopPreviewModel';

export function campaignSnapshot(save: CareerSave, car: OwnedCar, chapter: number, revision = 0): WorkshopSnapshot {
  const inventory = new Map<string, number>();
  for (const entry of save.inventoryPartIds) {
    const [partId, baseCarId] = entry.split('@');
    if (partId && baseCarId === car.baseCarId) inventory.set(partId, (inventory.get(partId) ?? 0) + 1);
  }
  return {
    carId: car.id, baseCar: findCampaignCar(car.baseCarId)!, nickname: car.nickname, paint: car.paint,
    installedParts: car.installedParts, inventory, credits: save.credits, tune: car.tune ?? {},
    buildVersion: buildVersionFor(car, car.installedParts), buildRevision: revision,
    progression: { mode: 'career', chapter, reputation: save.reputation },
  };
}

export function campaignParts(car: OwnedCar): PartDef[] {
  return ALL_PARTS.filter((p) => !campaignIncompatibility(car, p));
}

function campaignIncompatibility(car: OwnedCar, part: PartDef): string | null {
  if (car.installedParts.includes(part.id)) return null;
  return buildVersionFor(car, car.installedParts) === 2 || part.since === 2 || part.compat?.cars
    ? incompatibility(findCampaignCar(car.baseCarId)!, part) : null;
}

export function campaignEligibility(save: CareerSave, car: OwnedCar, part: PartDef) {
  const family = familyOf(findCampaignCar(car.baseCarId)!);
  const unlocked = unlocksOf(save);
  return {
    ...partStatus(save, car, part, family),
    requirements: partRequirements(part, family).map((u) => `${UNLOCK_LABEL[u]}${unlocked.has(u) ? ' ✓' : ''}`),
  };
}

export function campaignPreviewPolicy(save: CareerSave, car: OwnedCar): WorkshopPreviewPolicy {
  const versionOf = (ids: readonly string[]) => buildVersionFor(car, ids);
  return {
    versionOf,
    replace: (ids, id) => withPartId(ids, id).parts,
    plan: (id) => planInstall({ base: findCampaignCar(car.baseCarId)!, car, save, partId: id, versionOf }),
  };
}

export class CareerWorkshopAdapter implements WorkshopAdapter {
  readonly mode = 'career' as const;
  private readonly listeners = new Set<() => void>();
  private readonly previews = new Map<string, PartPreview>();
  private revision = 0;
  private current: BuildResult | undefined;

  constructor(private readonly controller: CareerController, private readonly chapter: () => number) {}

  getSnapshot(): WorkshopSnapshot | null {
    const { save, activeCar } = this.controller;
    return save && activeCar ? campaignSnapshot(save, activeCar, this.chapter(), this.revision) : null;
  }

  getCatalog(includeIncompatible = false): readonly PartDef[] {
    return this.controller.activeCar ? (includeIncompatible ? ALL_PARTS : campaignParts(this.controller.activeCar)) : [];
  }

  getEligibility(part: PartDef): import('./WorkshopAdapter').WorkshopEligibility {
    const car = this.controller.activeCar!;
    const detail = campaignIncompatibility(car, part);
    return detail ? { state: 'incompatible', label: 'Incompatível', detail } : campaignEligibility(this.controller.save!, car, part);
  }

  preview(selection: string): PartPreview {
    const cached = this.previews.get(selection);
    if (cached) return cached;
    const s = this.getSnapshot()!;
    const p = findPart(selection);
    this.current ??= resolveBuild(s.baseCar, s.installedParts, s.tune, s.buildVersion);
    const state = p && this.getEligibility(p).state;
    const result = previewWorkshop(s, campaignPreviewPolicy(this.controller.save!, this.controller.activeCar!),
      selection, state !== 'locked' && state !== 'incompatible', this.current);
    this.previews.set(selection, result);
    return result;
  }

  async execute(action: WorkshopAction): Promise<WorkshopActionResult> {
    const ctl = this.controller;
    let result;
    switch (action.kind) {
      case 'buyAndInstall': result = await ctl.buyPart(action.partId); break;
      case 'install': result = await ctl.installFromInventory(action.partId); break;
      case 'remove': result = await ctl.removePart(action.partId); break;
      case 'installBundle': result = await ctl.installBundle(action.partIds); break;
      case 'restoreStock': {
        const slot = action.slot;
        const car = ctl.activeCar;
        const part = slot && car && partInSlot(car.installedParts, slot);
        if (slot && !part) return { ok: false, error: 'O componente original já está em uso.' };
        result = await ctl.restoreStock(part ? part.category : undefined);
        break;
      }
      default: return { ok: false, error: 'Operação indisponível na campanha.' };
    }
    if (!result.ok) return { ok: false, error: result.error };
    await this.refresh();
    return { ok: true, notice: result.notice };
  }

  async refresh(): Promise<void> {
    this.revision++;
    this.current = undefined;
    this.previews.clear();
    for (const notify of this.listeners) notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
    this.previews.clear();
    this.current = undefined;
  }
}
