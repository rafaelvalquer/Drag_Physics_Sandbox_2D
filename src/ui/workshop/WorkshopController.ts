import type { AudioEngine } from '../../audio/core/AudioEngine';
import { playWorkshopSound, type WorkshopSound } from '../../audio/core/workshopUiSound';
import type { InstallPlan } from '../../game/career/tuning/ProjectRequirements';
import { physicalSlotOf } from '../../game/career/tuning/partProgression';
import { findPart, type PartCategory } from '../../game/career/tuning/parts';
import { engineMountOf } from '../../game/vehicles/art/parts/PartVisualAnchors';
import { CATEGORY_VISUAL } from '../../game/vehicles/art/parts/PartVisualRegistry';
import { EXTERNAL_CHANGE_LABEL, resolvePartVisual, stockAsset } from '../../game/vehicles/art/parts/PartVisualResolver';
import { h } from '../dom';
import type { WorkshopAction, WorkshopAdapter } from './WorkshopAdapter';
import type { WorkshopAnimationController } from './WorkshopAnimationController';
import { makeWorkshopCatalog, type Catalog, type CatalogGroup } from './WorkshopCatalogModel';
import { buildWorkshopCatalogView } from './WorkshopCatalogView';
import { friendlyOpError, L, layoutNote } from './WorkshopCopy';
import { buildPartInspector } from './WorkshopPartInspector';
import { isStockId, partInSlot, stockCategory, STOCK_PREFIX, type PartPreview } from './WorkshopPreviewModel';
import { buildSearchFilters } from './WorkshopSearchFilters';
import { paintWorkshopHeader, paintWorkshopPerformance, showBundleConfirmation, showWorkshopConfirmation, workshopCredits } from './WorkshopScreen';
import { workshopLocation } from './WorkshopSlotMapping';
import { buildStage, type StageInput } from './WorkshopVisualPreview';
import { WorkshopVisualState } from './WorkshopVisualState';
import './workshop.css';

export interface WorkshopHost {
  audio: AudioEngine | null;
  guard(): boolean;
  openDyno(): void;
  back(): void;
  openNode?(id: string): void;
  changed(): void;
  toast(message: string, kind?: 'error'): void;
}

export interface WorkshopVisualView {
  root: HTMLElement;
  state: WorkshopVisualState;
  attach(animation: WorkshopAnimationController): void;
  select(id: string | null): void;
  refresh(): void;
  dispose(): void;
}

const visual = (id: string) => {
  const part = findPart(id);
  if (part) return resolvePartVisual(part as unknown as { category: PartCategory } & Record<string, unknown>);
  const stock = CATEGORY_VISUAL[stockCategory(id)];
  return { mode: stock?.defaultMode ?? 'external' as const, zone: stock?.anchorId ?? null, asset: stockAsset(stockCategory(id)) };
};

export function buildWorkshop(adapter: WorkshopAdapter, host: WorkshopHost, state = new WorkshopVisualState()): WorkshopVisualView {
  let snapshot = adapter.getSnapshot();
  let catalog: Catalog | null = null;
  let preview: PartPreview | null = null;
  let animation: WorkshopAnimationController | undefined;
  let modal: HTMLDialogElement | undefined;
  let disposed = false;
  let previewToken = 0;
  const compatibility = new Map<string, boolean>();

  const sound = (kind: WorkshopSound) => { if (host.audio) playWorkshopSound(host.audio, kind); };
  const header = h('header', { class: 'uw-header ws-overview', 'data-testid': 'ws-overview' });
  const performance = h('div', { class: 'uw-performance', 'data-testid': 'ws-performance', 'aria-label': 'Desempenho calculado' });
  const actions = h('div', { class: 'uw-selection-actions wv-actions', 'data-testid': 'ws-actions' });
  const message = h('p', { class: 'uw-status', role: 'status', 'data-testid': 'ws-status' });
  const stage = buildStage({
    mode: (mode) => state.patch({ mode, modePinned: true }),
    version: (version) => state.patch({ version }),
    cut: (cut) => state.patch({ cut }),
  });
  const catalogView = buildWorkshopCatalogView(state, {
    category: (id) => {
      const tab = catalog?.tabs.find((t) => t.id === id);
      const slot = tab?.groups.find((g) => g.category === state.lastSlot.get(id)) ?? tab?.groups[0];
      if (slot) chooseGroup(id, slot);
    },
    slot: (id) => {
      const tab = catalog?.tabs.find((t) => t.id === state.value.tab);
      const group = tab?.groups.find((g) => g.category === id);
      if (tab && group) chooseGroup(tab.id, group);
    },
    select,
    compatible(part) {
      const cached = compatibility.get(part.id);
      if (cached !== undefined) return cached;
      const result = adapter.preview(part.id);
      const valid = !(result instanceof Promise) && (result.state === 'preview' || result.state === 'equipped');
      compatibility.set(part.id, valid);
      return valid;
    },
  });
  const inspector = buildPartInspector({ goToPart: select, openDyno: host.openDyno });
  const details = h('dialog', { class: 'uw-details', 'aria-label': 'Detalhes da peça', 'data-testid': 'ws-details-drawer' },
    h('button', { type: 'button', class: 'uw-close-details', 'aria-label': 'Fechar detalhes', onclick: () => details.close() }, '×'),
    inspector.root);
  details.addEventListener('close', () => {
    inspector.update(null);
    state.patch({ detailsOpen: false });
  });
  const search = buildSearchFilters(state.value, {
    query: (query) => state.patch({ query }),
    filter: (filter) => state.patch({ filter }),
  });
  const searchPane = h('details', { class: 'uw-search-pane', 'data-testid': 'ws-search-panel' },
    h('summary', { 'aria-label': 'Buscar e filtrar peças' }, h('span', { 'aria-hidden': 'true' }, '⌕'), ' Buscar'), search.root);
  const detailsButton = h('button', { type: 'button', 'data-testid': 'ws-details-toggle', onclick: () => openDetails() }, 'Detalhes');
  const restore = h('button', { type: 'button', 'data-testid': 'ws-restore-all', onclick: () => confirmAction({ kind: 'restoreStock' }, 'Restaurar veículo original', 'Os componentes removidos voltam para o estoque.') }, 'Restaurar veículo');
  const rail = h('aside', { class: 'wv-left', 'data-testid': 'ws-left' }, catalogView.rail);
  const grid = h('div', { class: 'uw-grid wv-grid', 'data-testid': 'ws-grid' }, rail,
    h('div', { class: 'uw-content' }, stage.root, performance, catalogView.root));
  const root = h('div', { class: 'wv uw-workshop', 'data-testid': 'ws-visual', 'data-mode': adapter.mode },
    header, searchPane, grid, message,
    h('footer', { class: 'uw-action-bar' },
      h('button', { type: 'button', 'data-testid': 'ws-back', onclick: host.back }, 'Voltar'),
      detailsButton,
      h('button', { type: 'button', 'data-testid': 'ws-dyno', onclick: host.openDyno }, L.dyno),
      restore, actions),
    details);
  root.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey ||
        (e.target instanceof HTMLElement && (e.target.matches('input, select, textarea') || e.target.isContentEditable))) return;
    if (e.key.toLowerCase() === 'd' && !details.open) { e.preventDefault(); host.openDyno(); }
    if (e.key.toLowerCase() === 'i' && !details.open) { e.preventDefault(); openDetails(); }
    if (e.key === 'Escape' && !modal?.open) {
      e.preventDefault();
      if (details.open) details.close();
      else if (searchPane.open) searchPane.open = false;
      else host.back();
    }
  });

  const groupFor = (id: string) => {
    const p = findPart(id);
    const slot = p ? workshopLocation(p).slot : isStockId(id) ? stockCategory(id) : null;
    return catalog?.tabs.find((tab) => tab.groups.some((group) => group.category === slot))?.groups.find((group) => group.category === slot);
  };

  function preferred(g: CatalogGroup): string {
    const saved = state.lastSelection.get(g.category);
    if (saved && (saved === STOCK_PREFIX + g.category || g.parts.some((p) => p.part.id === saved))) return saved;
    return g.parts.find((p) => p.status.state === 'installed')?.part.id ?? STOCK_PREFIX + g.category;
  }

  function chooseGroup(tab: string, group: CatalogGroup): void {
    sound('category');
    state.lastSlot.set(tab, group.category);
    const id = preferred(group);
    state.patch({ tab, subcategory: group.category, selected: id, query: '', version: 'now',
      mode: state.value.modePinned ? state.value.mode : visual(id).mode });
  }

  function select(id: string | null): void {
    if (!id) { state.patch({ selected: null }); return; }
    const group = groupFor(id);
    if (!group) return;
    const tab = catalog?.tabOf(group.category) ?? state.value.tab;
    if (tab) state.lastSlot.set(tab, group.category);
    state.lastSelection.set(group.category, id);
    sound('select');
    state.patch({ tab, subcategory: group.category, selected: id, query: '', version: 'now',
      mode: state.value.modePinned ? state.value.mode : visual(id).mode });
    catalogView.select(id);
  }

  function openDetails() {
    if (!preview || details.open) return;
    paintDetails();
    details.showModal();
    state.patch({ detailsOpen: true });
  }

  function paintDetails() {
    if (!preview || !snapshot) { inspector.update(null); return; }
    inspector.update({ preview, snapshot, carConfig: preview.beforeCar, stockLabel: groupFor(preview.selected)?.stockLabel,
      eligibility: preview.part ? catalog?.byId.get(preview.part.id)?.status : undefined });
  }

  function paintStage() {
    if (!preview || !snapshot) return;
    const p = preview;
    const s = state.value;
    const chosen = visual(p.selected);
    const mount = p.beforeCar && engineMountOf(p.beforeCar);
    let note = '';
    if (s.mode === 'technical' && p.beforeCar && mount) note = layoutNote(snapshot.baseCar.name, mount, p.beforeCar.drivenAxle);
    else if (s.mode === 'external' && p.external.length) note = `${L.externalChanges} ${p.external.map((e) => EXTERNAL_CHANGE_LABEL[e]).join(', ')}.`;
    else if (s.mode === 'external' && p.state !== 'original') note = L.noExternal;
    else if (s.mode === 'detail') note = L.illustrative;
    const slot = p.part ? physicalSlotOf(p.part) : p.category;
    const installed = partInSlot(snapshot.installedParts, slot);
    const factory = stockAsset(slot);
    const detail = { before: installed ? visual(installed.id).asset : factory, after: p.installed && p.part ? factory : chosen.asset };
    const kind: StageInput['previewKind'] = p.state === 'original' ? 'none'
      : p.state === 'equipped' ? 'equipped' : p.state === 'preview-pending' ? 'pending'
      : p.state === 'unavailable' ? 'unavailable' : 'part';
    stage.show({ beforeCar: p.beforeCar, afterCar: p.afterCar, mode: s.mode, version: kind === 'none' ? 'now' : s.version,
      cut: s.cut, zone: chosen.zone, detail, note, previewKind: kind, afterLabel: p.part && p.installed ? 'Sem a peça' : L.versionWith });
  }

  function paintActions() {
    const p = preview;
    const busy = state.value.busy;
    detailsButton.disabled = !p;
    restore.hidden = !snapshot?.installedParts.length;
    restore.disabled = busy;
    const focus = actions.contains(document.activeElement) && document.activeElement instanceof HTMLElement ? document.activeElement.dataset.testid : undefined;
    const buttons: HTMLElement[] = [];
    function button(id: string, label: string, click: () => void, disabled = false, primary = false) {
      buttons.push(h('button', { type: 'button', 'data-testid': id, class: primary ? 'primary' : undefined,
        disabled: busy || disabled, onclick: click }, busy ? 'Processando…' : label));
    }
    if (!busy && adapter.hasPendingOperation?.() && adapter.recoverOperation) {
      button('ws-recover-operation', 'Conferir operação pendente', () => void run(), false, true);
    } else if (p && snapshot) {
      const part = p.part;
      const unlock = part && catalog?.byId.get(part.id)?.status.unlock;
      if (unlock) {
        button('ws-unlock', `Desbloquear por ${unlock.cost} PP`, () => confirmAction({ kind: 'unlock', nodeId: unlock.id },
          `Desbloquear ${unlock.name}`, `Custo ${unlock.cost} PP. Depois do desbloqueio sobram ${unlock.available - unlock.cost} PP neste veículo.`), !unlock.canUnlock, true);
        if (host.openNode) button('ws-open-preparation', 'Ver preparação', () => host.openNode?.(unlock.id));
      }
      if (p.plan && (p.plan.steps.length > 1 || p.plan.substitutes)) {
        const plan = p.plan;
        button('ws-install-bundle', `${L.installBundle} · ${workshopCredits(plan.cost)}`, () => askBundle(plan), !plan.ok, true);
      }
      if (!part && !p.installed) button('ws-install-stock', L.installStock, () => confirmAction({ kind: 'restoreStock', slot: p.category },
        'Restaurar componente original', 'A peça removida volta para o estoque.'), !p.after.ok, true);
      if (!part && !p.installed && !p.after.ok && adapter.restoreSet) button('ws-install-stock-set', 'Restaurar com dependências', () => {
        const slots = [...adapter.restoreSet!(p.category)];
        if (slots.length < 2 || !snapshot || modal?.open) return;
        const names = slots.map((slot) => partInSlot(snapshot!.installedParts, slot)?.name).filter(Boolean).join(', ');
        confirmAction({ kind: 'restoreStock', slots }, 'Restaurar componentes originais', `Voltam para o estoque: ${names}.`);
      });
      else if (part && p.installed) button('ws-remove', L.remove, () => void run({ kind: 'remove', partId: part.id }), false);
      else if (part && p.owned) button('ws-install', L.installOwned, () => void run({ kind: 'install', partId: part.id }), !p.unlocked || p.state !== 'preview', true);
      else if (part && !unlock) button('ws-buy', `${L.buy} · ${workshopCredits(part.price)}`, () => confirmAction({ kind: 'buyAndInstall', partId: part.id },
        L.buy, `${part.name} · ${workshopCredits(part.price)}`), !p.unlocked || p.state !== 'preview' || snapshot!.credits < part.price, true);
      if (part && adapter.mode === 'online' && !p.installed && p.unlocked && !p.owned) button('ws-buy-stock', 'Comprar para o estoque', () => confirmAction({ kind: 'buyPart', partId: part.id },
        'Comprar para o estoque', `${part.name} · ${workshopCredits(part.price)}`), snapshot.credits < part.price);
    }
    actions.replaceChildren(...buttons);
    if (focus) actions.querySelector<HTMLElement>(`[data-testid="${CSS.escape(focus)}"]:not(:disabled)`)?.focus({ preventScroll: true });
  }

  function confirmAction(action: WorkshopAction, title: string, line: string) {
    if (state.value.busy || modal?.open) return;
    modal = showWorkshopConfirmation(title, [h('p', {}, line)], () => void run(action));
  }

  function askBundle(plan: InstallPlan) {
    if (!snapshot || !plan.ok || state.value.busy || modal?.open) return;
    modal = showBundleConfirmation(plan, snapshot.credits, () => void run({ kind: 'installBundle', partIds: plan.steps.map((s) => s.partId), maxCost: plan.cost }));
  }

  async function run(action?: WorkshopAction): Promise<void> {
    if (!host.guard() || state.value.busy || disposed) return;
    state.patch({ busy: true });
    message.textContent = 'Processando operação…';
    try {
      const result = action ? await adapter.execute(action) : await adapter.recoverOperation!();
      if (disposed) return;
      if (!result.ok) throw new Error(result.error);
      message.textContent = result.notice ?? 'Operação confirmada.';
      host.toast(message.textContent);
      host.changed();
      sound('installed');
      animation?.installed(stage.frames.wrap);
    } catch (error) {
      if (disposed) return;
      message.textContent = friendlyOpError(error instanceof Error ? error.message : String(error));
      host.toast(message.textContent, 'error');
      sound('denied');
    } finally {
      if (!disposed) state.patch({ busy: false });
    }
  }

  function renderCatalog() {
    if (!catalog) return;
    const counts = catalogView.render(catalog);
    search.setFilter(state.value.filter);
    search.setCount(counts.visible, counts.total);
    search.input.value = state.value.query;
  }

  function renderPreview() {
    const sel = state.value.selected;
    const token = ++previewToken;
    preview = null;
    if (!sel || !snapshot) { paintActions(); return; }
    function apply(p: PartPreview) {
      if (disposed || token !== previewToken) return;
      preview = p;
      paintStage();
      paintWorkshopPerformance(performance, p);
      paintActions();
      if (details.open) paintDetails();
    }
    try {
      const result = adapter.preview(sel);
      if (result instanceof Promise) {
        paintActions();
        void result.then(apply).catch((e: unknown) => {
          if (!disposed && token === previewToken) message.textContent = friendlyOpError(String(e));
        });
      } else apply(result);
    } catch (error) { message.textContent = friendlyOpError(String(error)); }
  }

  let repainting = false;
  function refresh() {
    snapshot = adapter.getSnapshot();
    if (!snapshot || disposed) return;
    const s = state.value;
    compatibility.clear();
    catalog = makeWorkshopCatalog(snapshot, adapter.getCatalog(s.filter === 'incompatible'), (part) => adapter.getEligibility(part));
    const group = s.selected ? groupFor(s.selected) : undefined;
    const tab = (group ? catalog.tabs.find((t) => t.groups.includes(group)) : undefined) ??
      catalog.tabs.find((t) => t.id === s.tab) ?? catalog.tabs[0];
    const target = group || tab?.groups.find((g) => g.category === s.subcategory) || tab?.groups[0];
    repainting = true;
    state.patch({ tab: tab?.id ?? null, subcategory: target?.category ?? null,
      selected: group && s.selected ? s.selected : target ? preferred(target) : null });
    repainting = false;
    renderCatalog();
    renderPreview();
    paintWorkshopHeader(header, snapshot, preview?.beforeCar?.engine.induction === 'turbo' ||
      (!preview?.beforeCar && snapshot.baseCar.engine.induction === 'turbo'));
  }

  const unsubscribe = state.subscribe((s, changed) => {
    if (disposed || repainting) return;
    if (changed.has('filter') && (s.filter === 'incompatible' || catalog?.byId.size !== adapter.getCatalog().length)) {
      refresh();
      return;
    }
    if (changed.has('tab') || changed.has('subcategory') || changed.has('query') || changed.has('filter')) {
      renderCatalog();
      if (changed.has('tab') || changed.has('subcategory')) animation?.category(catalogView.root);
    }
    if (changed.has('selected')) {
      catalogView.select(s.selected);
      renderPreview();
      animation?.select(inspector.root, root.querySelector<HTMLElement>(`[data-select="${CSS.escape(s.selected ?? '')}"]`));
    } else if (changed.has('mode') || changed.has('version') || changed.has('cut')) {
      paintStage();
      if (changed.has('version')) animation?.compare(stage.frames.wrap, []);
    }
    if (changed.has('busy')) paintActions();
  });
  const removeListener = adapter.subscribe(refresh);
  refresh();

  return {
    root, state, select, refresh,
    attach(a) { animation = a; },
    dispose() {
      disposed = true;
      ++previewToken;
      unsubscribe();
      removeListener();
      if (details.open) details.close();
      if (modal?.open) modal.close();
      state.patch({ detailsOpen: false, busy: false });
      adapter.dispose();
      search.dispose();
      stage.dispose();
      inspector.dispose();
      animation?.dispose();
    },
  };
}
