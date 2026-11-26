import { findCampaignCar } from '../../../data/cars/campaign';
import type { AudioEngine } from '../../../audio/core/AudioEngine';
import { playWorkshopSound, type WorkshopSound } from '../../../audio/core/workshopUiSound';
import type { CareerController, OpResult } from '../../../game/career/CareerController';
import { ownedCarLook } from '../../../game/career/RivalBuildFactory';
import type { InstallPlan } from '../../../game/career/tuning/ProjectRequirements';
import { CATEGORY_LABEL, findPart, type PartCategory } from '../../../game/career/tuning/parts';
import { engineMountOf } from '../../../game/vehicles/art/parts/PartVisualAnchors';
import { CATEGORY_VISUAL, type ViewMode } from '../../../game/vehicles/art/parts/PartVisualRegistry';
import { EXTERNAL_CHANGE_LABEL, resolvePartVisual, stockAsset } from '../../../game/vehicles/art/parts/PartVisualResolver';
import { h } from '../../dom';
import { friendlyOpError, L, layoutNote } from './WorkshopCopy';
import { WorkshopAnimationController } from './WorkshopAnimationController';
import { buildCatalog, buildCatalogView, type Catalog, type CatalogView } from './WorkshopPartCatalog';
import { buildPartInspector, type InspectorView } from './WorkshopPartInspector';
import { previewSelection, isStockId, statusOf, stockCategory, type PartPreview } from './WorkshopPreviewModel';
import { buildSearchFilters, type SearchFiltersView } from './WorkshopSearchFilters';
import { buildStage, type StageInput, type StageView } from './WorkshopVisualPreview';
import { buildOverview, buildWorkshopNav, confirmBundle, type OverviewView } from './WorkshopVisualScreen';
import { WorkshopVisualState, type WorkshopViewState } from './WorkshopVisualState';

/** What the workshop needs from the campaign mode (no CareerMode import: the screen is self-contained). */
export interface WorkshopHost {
  readonly controller: CareerController;
  guard(): boolean;
  audio: AudioEngine | null;
  chapterNumber(): number;
  openDyno(): void;
  back(): void;
  /** Updates the status of the shell (credits, reputation) after the save changed. */
  saveChanged(): void;
  toast(message: string, kind?: 'error'): void;
  confirm(message: string): boolean;
}

export interface WorkshopVisualView {
  root: HTMLElement;
  state: WorkshopVisualState;
  /** Receives the GSAP controller created by the CareerTransitionManager. */
  attach(anim: WorkshopAnimationController): void;
  /** Selects a part (and its tab) programmatically. */
  select(id: string | null): void;
  /** Re-reads the save and repaints everything (after a change that came from outside). */
  refresh(): void;
  dispose(): void;
}

/**
 * Orchestrates the visual workshop: it owns the components, turns the player's choices into view
 * state, previews every part with the resolver (nothing is saved) and sends every purchase,
 * install and removal to the CareerController; the screen only animates a success after the
 * controller confirmed it.
 */
export function buildWorkshopVisual(host: WorkshopHost, state: WorkshopVisualState = new WorkshopVisualState()): WorkshopVisualView {
  const ctl = host.controller;
  let anim: WorkshopAnimationController | null = null;
  let catalog: Catalog | null = null;
  let preview: PartPreview | null = null;
  let busy = false;
  let disposed = false;

  const overview: OverviewView = buildOverview();
  const search: SearchFiltersView = buildSearchFilters(state.value, {
    query: (q) => state.patch({ query: q }),
    filter: (f) => state.patch({ filter: f }),
  });
  const catalogView: CatalogView = buildCatalogView({
    select: (id) => select(id),
    tab: (id) => {
      sound('category');
      state.patch({ tab: id });
    },
  });
  const inspector: InspectorView = buildPartInspector({
    buy: (id) => void act(() => ctl.buyPart(id), `${findPart(id)!.name} comprada e instalada.`),
    installOwned: (id) => void act(() => ctl.installFromInventory(id), `${findPart(id)!.name} instalada.`),
    remove: (id) => void act(() => ctl.removePart(id), `${findPart(id)!.name} removida (vai para o estoque).`),
    installBundle: (plan) => askBundle(plan),
    installStock: (cat) => void installStock(cat),
    goToPart: (id) => select(id),
    openDyno: () => host.openDyno(),
  });
  const stage: StageView = buildStage({
    mode: (m) => state.patch({ mode: m, modePinned: true }),
    version: (v) => {
      sound('select');
      state.patch({ version: v });
    },
    cut: (n) => state.patch({ cut: n }),
  });
  const nav = buildWorkshopNav({ dyno: () => host.openDyno(), restore: () => void restoreAll(), back: () => host.back() });
  catalogView.root.insertBefore(search.root, catalogView.root.lastElementChild);
  const collapse = h('button', { type: 'button', class: 'wv-collapse', 'aria-expanded': 'true', onclick: () => {
    const c = left.dataset.collapsed !== 'true';
    left.dataset.collapsed = String(c);
    collapse.setAttribute('aria-expanded', String(!c));
  } }, L.available);
  const left = h('aside', { class: 'wv-left ws-left', 'data-testid': 'ws-left' }, collapse, catalogView.root);
  const grid = h('div', { class: 'ws wv-grid', 'data-testid': 'ws-grid' }, left, stage.root, inspector.root);
  const root = h('div', { class: 'wv wv-root', 'data-testid': 'ws-visual' }, overview.root, grid, nav.root);

  function sound(kind: WorkshopSound): void {
    if (host.audio) playWorkshopSound(host.audio, kind);
  }

  // ---------------------------------------------------------------- reading

  const live = (): { save: NonNullable<CareerController['save']>; car: NonNullable<CareerController['activeCar']> } | null => {
    const save = ctl.save;
    const car = ctl.activeCar;
    return save && car ? { save, car } : null;
  };

  function visualOf(id: string | null): { mode: ViewMode; zone: ReturnType<typeof resolvePartVisual>['zone'] | null } {
    if (!id) return { mode: 'external', zone: null };
    if (isStockId(id)) {
      const v = CATEGORY_VISUAL[stockCategory(id)];
      return { mode: v.defaultMode, zone: v.anchorId };
    }
    const p = findPart(id);
    if (!p) return { mode: 'external', zone: null };
    const v = resolvePartVisual(p as unknown as { category: PartCategory } & Record<string, unknown>);
    return { mode: v.mode, zone: v.zone };
  }

  // ---------------------------------------------------------------- painting

  function stageInput(l: NonNullable<ReturnType<typeof live>>): StageInput {
    const s = state.value;
    const look = ownedCarLook(l.car);
    const p = preview;
    const beforeCar = p?.beforeCar ?? look;
    const afterCar = p ? p.afterCar : null;
    const { zone } = visualOf(s.selected);
    const mount = beforeCar ? engineMountOf(beforeCar) : null;
    let note = '';
    if (s.mode === 'technical' && beforeCar && mount) note = layoutNote(findCampaignCar(l.car.baseCarId)?.name ?? l.car.nickname, mount, beforeCar.drivenAxle);
    else if (s.mode === 'external' && p && !p.external.length && p.state !== 'original') note = L.noExternal;
    else if (s.mode === 'external' && p?.external.length) note = `${L.externalChanges} ${p.external.map((e) => EXTERNAL_CHANGE_LABEL[e]).join(', ')}.`;
    else if (s.mode === 'detail') note = L.illustrative;
    let detail: StageInput['detail'] = null;
    if (p) {
      const slotPart = l.car.installedParts.map((id) => findPart(id)).find((x) => x?.category === p.category);
      const before = slotPart ? resolvePartVisual(slotPart as unknown as { category: PartCategory } & Record<string, unknown>).asset : stockAsset(p.category);
      const after = p.part ? resolvePartVisual(p.part as unknown as { category: PartCategory } & Record<string, unknown>).asset : stockAsset(p.category);
      detail = { before, after };
    }
    const kind: StageInput['previewKind'] = !p ? 'none' : p.state === 'equipped' ? 'equipped' : p.state === 'preview-pending' ? 'pending' : p.state === 'unavailable' ? 'unavailable' : p.state === 'original' ? 'none' : 'part';
    return { beforeCar, afterCar, mode: s.mode, version: kind === 'none' || (!afterCar && s.mode !== 'detail') ? 'now' : s.version, cut: s.cut, zone, detail, note, afterLabel: kind === 'equipped' ? 'Sem a peça' : L.versionWith, previewKind: kind };
  }

  function paintStage(): void {
    const l = live();
    if (l) stage.show(stageInput(l));
  }

  function paintInspector(): void {
    const l = live();
    if (!l) return;
    inspector.update(preview ? { preview, car: l.car, save: l.save, carConfig: preview.beforeCar } : null);
  }

  function paintCatalog(): void {
    const l = live();
    if (!l) return;
    catalog = buildCatalog(l.save, l.car, (p) => statusOf(l.save, l.car, p));
    const s = state.value;
    const r = catalogView.render(catalog, { tab: s.tab, query: s.query, filter: s.filter, selected: s.selected }, l.car, l.save);
    if (!s.tab) state.patch({ tab: r.tab });
    search.setCount(r.visible, r.total);
  }

  function recomputePreview(): void {
    const l = live();
    const sel = state.value.selected;
    preview = l && sel && (isStockId(sel) || findPart(sel)) ? previewSelection(l.save, l.car, sel) : null;
  }

  function paintAll(): void {
    const l = live();
    if (!l) return;
    overview.update(l.save, l.car, host.chapterNumber());
    nav.setRestoreVisible(l.car.installedParts.length > 0);
    recomputePreview();
    paintCatalog();
    paintInspector();
    paintStage();
  }

  // ---------------------------------------------------------------- state -> screen

  const unsubscribe = state.subscribe((s, changed) => {
    if (disposed) return;
    if (changed.has('tab') || changed.has('query') || changed.has('filter')) {
      search.setFilter(s.filter);
      paintCatalog();
      if (changed.has('tab') && anim) anim.category(catalogView.root.lastElementChild as HTMLElement);
    }
    if (changed.has('selected')) {
      recomputePreview();
      catalogView.select(s.selected);
      paintInspector();
      if (anim) anim.select(inspector.root, root.querySelector<HTMLElement>(`[data-select="${CSS.escape(s.selected ?? '')}"]`));
    }
    if (changed.has('selected') || changed.has('mode') || changed.has('version') || changed.has('cut')) {
      paintStage();
      if (changed.has('version') && anim) anim.compare(stage.frames.wrap, [...inspector.root.querySelectorAll<HTMLElement>('.delta')]);
    }
  });

  function select(id: string | null): void {
    const l = live();
    if (!l) return;
    if (id) sound('select');
    const patch: Partial<WorkshopViewState> = { selected: id, version: 'now' };
    if (id) {
      const v = visualOf(id);
      if (!state.value.modePinned) patch.mode = v.mode;
      // a part found by search or by a requirement link opens its own tab
      const cat = isStockId(id) ? stockCategory(id) : findPart(id)?.category;
      const cur = catalog?.tabs.find((x) => x.id === state.value.tab);
      const target = cat ? catalog?.tabOf(cat) : undefined;
      if (cat && target && !cur?.groups.some((g) => g.category === cat)) patch.tab = target;
    }
    state.patch(patch);
  }

  // ---------------------------------------------------------------- actions (CareerController only)

  async function act(fn: () => Promise<OpResult>, okMsg: string): Promise<void> {
    if (busy || !host.guard()) return;
    busy = true;
    try {
      const r = await fn();
      if (disposed) return;
      if (!r.ok) {
        host.toast(friendlyOpError(r.error ?? 'falhou'), 'error');
        sound('denied');
        const btn = root.querySelector<HTMLElement>('.wv-actions button.primary, .wv-actions button');
        if (btn && anim) anim.denied(btn);
        return;
      }
      host.toast(okMsg);
      if (r.notice) host.toast(r.notice, 'error');
      confirmed();
    } finally {
      busy = false;
    }
  }

  /** The controller confirmed a change: repaint from the save and celebrate (never before the confirmation). */
  function confirmed(): void {
    host.saveChanged();
    state.patch({ version: 'now' });
    paintAll();
    sound('installed');
    anim?.installed(stage.frames.wrap);
  }

  async function installStock(cat: PartCategory): Promise<void> {
    if (busy || !host.guard()) return;
    busy = true;
    try {
      const l = live();
      const names = l ? l.car.installedParts.map((id) => findPart(id)).filter((p) => p?.category === cat).map((p) => p!.name) : [];
      const r = await ctl.restoreStock(cat);
      if (disposed) return;
      if (!r.ok) {
        host.toast(friendlyOpError(r.error), 'error');
        sound('denied');
        return;
      }
      if (r.notice) host.toast(r.notice, 'error');
      host.toast(`${CATEGORY_LABEL[cat]} original instalado. ${names.join(', ')} foi para o estoque.`);
      confirmed();
    } finally {
      busy = false;
    }
  }

  function askBundle(plan: InstallPlan): void {
    const l = live();
    if (!l || !host.guard()) return;
    const ids = plan.steps.map((s) => s.partId);
    confirmBundle(plan, l.save, () => void act(() => ctl.installBundle(ids), `${ids.length} peças instaladas.`));
  }

  async function restoreAll(): Promise<void> {
    const l = live();
    if (!l || busy || !host.guard()) return;
    const n = l.car.installedParts.length;
    if (!host.confirm(`Voltar o carro ao original? ${n === 1 ? 'A peça vai' : `As ${n} peças vão`} para o estoque e pode${n === 1 ? '' : 'm'} ser reinstalada${n === 1 ? '' : 's'} depois.`)) return;
    busy = true;
    try {
      const r = await ctl.restoreStock();
      if (disposed) return;
      if (!r.ok) {
        host.toast(friendlyOpError(r.error), 'error');
        return;
      }
      host.toast(r.notice ? `Carro de volta ao original. As peças estão no estoque. ${r.notice}` : 'Carro de volta ao original. As peças estão no estoque.');
      state.patch({ selected: null });
      confirmed();
    } finally {
      busy = false;
    }
  }

  // ---------------------------------------------------------------- start

  paintAll();
  search.setFilter(state.value.filter);
  catalogView.select(state.value.selected);

  return {
    root,
    state,
    attach(a) {
      anim = a;
    },
    select,
    refresh: paintAll,
    dispose() {
      disposed = true;
      unsubscribe();
      stage.dispose();
      inspector.dispose();
      anim = null;
    },
  };
}
