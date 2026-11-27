import type { PartCategory, PartDef } from '../../game/career/tuning/parts';
import { assetCanvas } from '../../game/vehicles/art/parts/PartIllustrations';
import { resolvePartVisual, stockAsset } from '../../game/vehicles/art/parts/PartVisualResolver';
import { h } from '../dom';
import type { Catalog, CatalogGroup, CatalogPart } from './WorkshopCatalogModel';
import { L } from './WorkshopCopy';
import { STOCK_PREFIX } from './WorkshopPreviewModel';
import { matchesFilter, matchesQuery } from './WorkshopSearchFilters';
import type { WorkshopVisualState } from './WorkshopVisualState';
import { workshopPartHeading } from './WorkshopPartHeading';

const icons = new Map<string, string>();
function icon(asset: ReturnType<typeof resolvePartVisual>['asset']): string {
  const cached = icons.get(asset);
  if (cached !== undefined) return cached;
  let src = '';
  try { src = assetCanvas(asset, 94, 62).toDataURL(); } catch { /* decorative thumbnail */ }
  icons.set(asset, src);
  return src;
}

function keyboard(container: HTMLElement, vertical = false): void {
  container.addEventListener('keydown', (e) => {
    const keys = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    const dir = keys.indexOf(e.key);
    if (dir < 0 || !(e.target instanceof HTMLButtonElement)) return;
    const options = [...container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const next = options[options.indexOf(e.target) + (dir === 0 ? -1 : 1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
    next.click();
  });
}

export function buildWorkshopCatalogView(state: WorkshopVisualState, on: {
  category(id: string): void;
  slot(id: PartCategory): void;
  select(id: string): void;
  compatible(part: PartDef): boolean;
}) {
  const rail = h('nav', { class: 'wv-tabs ws-tabs', 'aria-label': 'Categorias da oficina', 'data-testid': 'ws-tabs' });
  const slots = h('nav', { class: 'uw-slots', 'aria-label': 'Subcategorias da oficina', 'data-testid': 'ws-subcategories' });
  const hiddenSelection = h('p', { class: 'hint uw-pin', 'data-testid': 'ws-pinned', hidden: true }, L.hiddenSelected);
  const track = h('div', { class: 'uw-track ws-parts', 'data-testid': 'ws-carousel', 'aria-label': 'Peças da subcategoria' });
  const arrow = (direction: number, label: string) => h('button', {
    type: 'button', class: 'uw-arrow', 'aria-label': label, onclick: () => track.scrollBy({ left: direction * track.clientWidth * .85 }),
  }, direction < 0 ? '‹' : '›');
  const root = h('section', { class: 'uw-catalogue wv-catalog', 'data-testid': 'ws-catalog' }, slots, hiddenSelection,
    h('div', { class: 'uw-carousel' }, arrow(-1, 'Peças anteriores'), track, arrow(1, 'Próximas peças')));
  keyboard(rail, true);
  keyboard(slots);
  keyboard(track);
  let active: PartCategory | null = null;
  track.addEventListener('scroll', () => {
    if (active && !state.value.query.trim()) state.carouselOffsets.set(active, track.scrollLeft);
  }, { passive: true });

  function card(g: CatalogGroup, part?: CatalogPart) {
    const id = part?.part.id ?? STOCK_PREFIX + g.category;
    const status = part?.status ?? { state: g.stockInUse ? 'installed' : 'stock', label: g.stockInUse ? 'Em uso' : 'Original', detail: g.stockLabel };
    const asset = part ? resolvePartVisual(part.part as unknown as { category: PartCategory } & Record<string, unknown>).asset : stockAsset(g.category);
    const selected = state.value.selected === id;
    const price = part ? `${part.part.price.toLocaleString('pt-BR')} CR` : 'Grátis';
    return h('button', {
      type: 'button', class: `wv-card ws-part-card ${!part ? 'stock' : ''} ${status.state} ${selected ? 'sel' : ''}`,
      'data-testid': part ? `ws-part-${id}` : `ws-stock-${g.category}`,
      'data-select': id, 'data-state': status.state, 'data-tier': part?.progression?.tier,
      'aria-pressed': String(selected), title: status.detail, onclick: () => on.select(id),
    }, h('small', { class: 'uw-tier' }, part?.progression ? `Stage ${part.progression.tier}` : ''),
    h('img', { class: 'wv-ico', src: icon(asset), alt: '', width: 94, height: 62 }),
    workshopPartHeading(h('span', { class: 'ws-part-name' }, part?.part.name ?? g.stockLabel), status.state, status.label,
      part ? `ws-pill-${id}` : `ws-stock-pill-${g.category}`),
    h('small', { class: 'uw-card-price' }, price === status.label ? '' : price));
  }

  function select(id: string | null, reveal = true): void {
    for (const element of track.querySelectorAll<HTMLElement>('[data-select]')) {
      const selected = element.dataset.select === id;
      element.classList.toggle('sel', selected);
      element.setAttribute('aria-pressed', String(selected));
      if (selected && reveal) {
        const bounds = track.getBoundingClientRect();
        const item = element.getBoundingClientRect();
        if (item.width && (item.left < bounds.left || item.right > bounds.right)) {
          track.scrollLeft += item.left - bounds.left - (bounds.width - item.width) / 2;
        }
      }
    }
  }

  function render(c: Catalog): { visible: number; total: number } {
    const s = state.value;
    const tab = c.tabs.find((t) => t.id === s.tab);
    const savedFocus = document.activeElement instanceof HTMLElement && (rail.contains(document.activeElement) || root.contains(document.activeElement))
      ? document.activeElement.dataset.testid : undefined;
    rail.replaceChildren(...c.tabs.map((t) => h('button', {
      type: 'button', class: `tab ${t.id === s.tab ? 'active' : ''}`, 'data-testid': `ws-tab-${t.id}`,
      'aria-pressed': String(t.id === s.tab), onclick: () => on.category(t.id),
    }, h('span', { class: 'ws-tab-icon', 'aria-hidden': 'true' }, t.icon), h('b', {}, t.label),
    t.installed ? h('small', { class: 'ws-tab-count', 'aria-label': `${t.installed} componentes instalados` }, t.installed) : null)));
    slots.replaceChildren(...(tab?.groups ?? []).map((g) => h('button', {
      type: 'button', 'data-testid': `ws-subtab-${g.category}`, 'aria-pressed': String(g.category === s.subcategory),
      onclick: () => on.slot(g.category),
    }, g.label)));
    const chosen = tab?.groups.find((g) => g.category === s.subcategory);
    const search = !!s.query.trim();
    const scope = search ? c.tabs.flatMap((t) => t.groups) : chosen ? [chosen] : [];
    let visible = 0;
    let total = 0;
    const cards: HTMLElement[] = [];
    for (const g of scope) {
      total += g.parts.length;
      if (s.filter === 'all' && matchesQuery(g.stockLabel, s.query)) cards.push(card(g));
      for (const p of g.parts) {
        if (!matchesQuery(p.searchText, s.query) || !matchesFilter(s.filter, p.status.state, () => on.compatible(p.part))) continue;
        cards.push(card(g, p));
        visible++;
      }
    }
    if (!visible && !cards.length) cards.push(h('p', { class: 'hint wv-empty', 'data-testid': 'ws-empty' }, L.noResults));
    hiddenSelection.hidden = true;
    if (s.selected && (s.filter !== 'all' || search) && !cards.some((element) => element.dataset.select === s.selected)) {
      const selectedPart = c.byId.get(s.selected);
      if (chosen && selectedPart) {
        hiddenSelection.hidden = false;
        cards.unshift(card(chosen, selectedPart));
      }
    }
    track.dataset.slot = chosen?.category ?? '';
    track.dataset.testid = 'ws-carousel';
    track.setAttribute('aria-label', chosen ? chosen.label : 'Peças');
    active = chosen?.category ?? null;
    track.replaceChildren(...cards);
    track.scrollLeft = active && !search ? state.carouselOffsets.get(active) ?? 0 : 0;
    select(s.selected, false);
    if (savedFocus) (rail.querySelector<HTMLElement>(`[data-testid="${CSS.escape(savedFocus)}"]`) ??
      root.querySelector<HTMLElement>(`[data-testid="${CSS.escape(savedFocus)}"]`))?.focus({ preventScroll: true });
    return { visible, total };
  }
  return { rail, root, render, select };
}
