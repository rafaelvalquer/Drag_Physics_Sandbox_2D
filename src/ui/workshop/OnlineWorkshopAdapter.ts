import { findCampaignCar } from '../../data/cars/campaign';
import type { PartStatus } from '../../game/career/CareerProgression';
import { resolveBuild, type BuildResult } from '../../game/career/tuning/BuildResolver';
import { planWithPolicy } from '../../game/career/tuning/ProjectRequirements';
import { careerResolverVersion } from '../../game/career/tuning/resolverVersion';
import { reconcileTune } from '../../game/career/tuning/TuningCapabilities';
import { physicalSlotOf } from '../../game/career/tuning/partProgression';
import { ALL_PARTS, findPart, type PartCategory, type PartDef } from '../../game/career/tuning/parts';
import type { Garage, OnlineClient } from '../../game/online/OnlineClient';
import type { GarageRequest } from '../../game/online/contracts';
import { onlineWorkshopTree, replaceOnlinePart, restoreOnlineSlots } from '../../game/online/workshopBuild';
import type { WorkshopAction, WorkshopActionResult, WorkshopAdapter, WorkshopEligibility, WorkshopPreviewPolicy, WorkshopSnapshot } from './WorkshopAdapter';
import { previewWorkshop, type PartPreview } from './WorkshopPreviewModel';

export interface PendingWorkshopOperation { action: string; request: GarageRequest; confirmed: boolean }

const isDefiniteRejection = (error: unknown): boolean =>
  error instanceof Error && 'status' in error && typeof error.status === 'number' && error.status < 500 && error.status !== 429;

export class OnlineWorkshopAdapter implements WorkshopAdapter {
  readonly mode = 'online' as const;
  private readonly listeners = new Set<() => void>();
  private readonly previews = new Map<string, PartPreview>();
  private snapshot: WorkshopSnapshot | null;
  private eligibility = new Map<string, WorkshopEligibility>();
  private current: BuildResult | undefined;
  private disposed = false;
  private busy = false;

  constructor(private garage: Garage, private readonly carId: string,
    private readonly api: Pick<OnlineClient, 'change' | 'garage'>,
    private readonly pending: Map<string, PendingWorkshopOperation>,
    private readonly onGarage: (garage: Garage | null) => void,
  ) {
    this.snapshot = this.readSnapshot();
  }

  private readSnapshot(): WorkshopSnapshot | null {
    const car = this.garage.cars.find((entry) => entry.id === this.carId);
    const baseCar = car && findCampaignCar(car.base_car_id);
    if (!car || !baseCar) return null;
    return {
      carId: car.id, baseCar, nickname: car.config.name,
      paint: { color: car.paint ?? car.config.visual.color, accent: car.config.visual.accent },
      installedParts: car.parts, credits: this.garage.profile.cr_balance, tune: car.tune,
      buildRevision: car.build_revision, buildVersion: car.build_version,
      inventory: new Map(this.garage.inventory.filter((entry) => entry.base_car_id === car.base_car_id).map((entry) => [entry.part_id, entry.quantity])),
      progression: {
        mode: 'online', rp: this.garage.profile.rp, ppBalance: car.pp_balance, unlockedNodes: car.unlocks, treeVersion: car.tree_version,
      },
    };
  }

  getSnapshot() { return this.snapshot; }

  getCatalog(includeIncompatible = false): readonly PartDef[] {
    const s = this.snapshot;
    if (!s || s.progression.mode !== 'online') return [];
    if (includeIncompatible) return ALL_PARTS;
    const tree = onlineWorkshopTree(s.baseCar.id, s.progression.treeVersion);
    const ids = new Set([...(tree?.nodes.flatMap((node) => node.unlocksPartIds) ?? []), ...s.installedParts]);
    return [...ids].map(findPart).filter((part): part is PartDef => !!part);
  }

  getEligibility(part: PartDef): WorkshopEligibility {
    const cached = this.eligibility.get(part.id);
    if (cached) return cached;
    const s = this.snapshot;
    if (!s || s.progression.mode !== 'online') return { state: 'incompatible', label: 'Indisponível', detail: 'Projeto indisponível.' };
    const progress = s.progression;
    const tree = onlineWorkshopTree(s.baseCar.id, progress.treeVersion);
    const node = tree?.nodes.find((n) => n.unlocksPartIds.includes(part.id));
    const quantity = s.inventory.get(part.id) ?? 0;
    let result: WorkshopEligibility;
    if (s.installedParts.includes(part.id)) result = { state: 'installed', label: 'Instalada', detail: 'Em uso neste veículo.' };
    else if (!node) result = { state: 'incompatible', label: 'Incompatível', detail: 'Peça indisponível para este projeto.' };
    else if (!progress.unlockedNodes.includes(node.id)) {
      const missing = node.prerequisites.filter((id) => !progress.unlockedNodes.includes(id));
      const requirements = missing.map((id) => tree?.nodes.find((n) => n.id === id)?.name ?? id);
      result = { state: 'locked', label: 'Bloqueada por PP', detail: `Requer ${node.name}`,
        requirements, unlock: {
          id: node.id, name: node.name, cost: node.costPP, available: progress.ppBalance, requirements,
          canUnlock: missing.length === 0 && progress.ppBalance >= node.costPP,
        } };
    } else if (quantity) result = { state: 'owned', label: `No estoque ×${quantity}`, detail: 'Disponível no estoque deste modelo.' };
    else if (s.credits < part.price) result = { state: 'unaffordable', label: 'CR insuficientes', detail: 'Créditos insuficientes para esta peça.' };
    else result = { state: 'available', label: 'Disponível', detail: 'Preparação liberada neste veículo.' };
    this.eligibility.set(part.id, result);
    return result;
  }

  private policy(s: WorkshopSnapshot): WorkshopPreviewPolicy {
    const versionOf = (ids: readonly string[]) => careerResolverVersion(s.baseCar.id, ids, s.buildVersion);
    return {
      versionOf, replace: (ids, partId) => replaceOnlinePart(ids, partId).parts,
      plan: (partId) => planWithPolicy({ base: s.baseCar, car: { baseCarId: s.baseCar.id, installedParts: s.installedParts, tune: s.tune }, partId, versionOf }, {
        credits: s.credits, catalog: this.getCatalog(), replace: replaceOnlinePart, slotOf: physicalSlotOf,
        status: (part): PartStatus => {
          const { state, label, detail } = this.getEligibility(part);
          return { state: state === 'incompatible' ? 'locked' : state, label, detail };
        },
        unlocked: (part) => this.getEligibility(part).state !== 'locked',
        inStock: (id) => (s.inventory.get(id) ?? 0) > 0,
      }),
    };
  }

  preview(selection: string): PartPreview {
    const cached = this.previews.get(selection);
    if (cached) return cached;
    const s = this.snapshot;
    if (!s) throw new Error('Projeto indisponível.');
    const part = findPart(selection);
    this.current ??= resolveBuild(s.baseCar, s.installedParts, s.tune, s.buildVersion);
    const state = part && this.getEligibility(part).state;
    const result = previewWorkshop(s, this.policy(s), selection, state !== 'locked' && state !== 'incompatible', this.current);
    this.previews.set(selection, result);
    return result;
  }

  restoreSet(slot: PartCategory): readonly PartCategory[] {
    const s = this.snapshot;
    if (!s) return [];
    const slots = s.installedParts.map((id) => physicalSlotOf(findPart(id)!));
    for (const other of slots) {
      if (other === slot) continue;
      const { parts } = restoreOnlineSlots(s.installedParts, [slot, other]);
      const version = careerResolverVersion(s.baseCar.id, parts, s.buildVersion);
      const tune = reconcileTune(s.baseCar, parts, version, s.tune, { tunersUnlocked: true }).tune;
      if (resolveBuild(s.baseCar, parts, tune, version).ok) return [slot, other];
    }
    return slots;
  }

  async execute(action: WorkshopAction): Promise<WorkshopActionResult> {
    const s = this.snapshot;
    if (!s || this.disposed || this.busy) return { ok: false, error: 'Operação indisponível.' };
    const key = JSON.stringify(action);
    let pending = this.pending.get(this.carId);
    if (pending && pending.action !== key) return { ok: false, error: 'A operação anterior está pendente. Repita a mesma ação para conferir o resultado.' };
    if (!pending) {
      const { carId, buildRevision } = s;
      const operation: GarageRequest['operation'] = action.kind === 'restoreStock'
        ? { kind: action.kind, carId, buildRevision, scope: action.slots ? 'slots' : action.slot ? 'slot' : 'all', slotId: action.slot, slotIds: action.slots }
        : { ...action, carId, buildRevision };
      pending = { action: key, request: { operationId: crypto.randomUUID(), operation }, confirmed: false };
      this.pending.set(carId, pending);
    }
    return this.submit(pending);
  }

  hasPendingOperation(): boolean { return this.pending.has(this.carId); }

  async recoverOperation(): Promise<WorkshopActionResult> {
    const pending = this.pending.get(this.carId);
    if (!pending || this.disposed || this.busy) return { ok: false, error: 'Nenhuma operação pendente para conferir.' };
    return this.submit(pending);
  }

  private async submit(pending: PendingWorkshopOperation): Promise<WorkshopActionResult> {
    const clear = () => {
      if (this.pending.get(this.carId) === pending) this.pending.delete(this.carId);
    };
    this.busy = true;
    try {
      if (!pending.confirmed) {
        try {
          await this.api.change(pending.request);
        } catch (error) {
          if (isDefiniteRejection(error) || this.disposed) throw error;
          await this.api.change(pending.request);
        }
        pending.confirmed = true;
      }
      if (!this.disposed) await this.refresh();
      clear();
      return { ok: true };
    } catch (error) {
      if (isDefiniteRejection(error)) {
        clear();
        if (!this.disposed) await this.refresh().catch(() => undefined);
      }
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      this.busy = false;
    }
  }

  async refresh(): Promise<void> {
    const next = await this.api.garage();
    if (this.disposed) return;
    this.updateGarage(next);
    this.onGarage(next);
  }

  updateGarage(next: Garage | null): void {
    if (this.disposed) return;
    if (next) this.garage = next;
    this.snapshot = next ? this.readSnapshot() : null;
    this.current = undefined;
    this.previews.clear();
    this.eligibility.clear();
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
    this.previews.clear();
    this.eligibility.clear();
    this.current = undefined;
  }
}
