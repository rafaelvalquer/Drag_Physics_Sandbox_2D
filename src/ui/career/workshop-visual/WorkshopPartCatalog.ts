import { findCampaignCar } from '../../../data/cars/campaign';
import { buildVersionFor } from '../../../game/career/CareerController';
import { partChapter, stockStatus, type PartStatus } from '../../../game/career/CareerProgression';
import type { CareerSave, OwnedCar } from '../../../game/career/CareerState';
import { familyOf, incompatibility } from '../../../game/career/tuning/BuildResolverV2';
import { ALL_PARTS, CATEGORY_LABEL, CATEGORY_ORDER_V1, WORKSHOP_TABS, findPart, type PartCategory, type PartDef } from '../../../game/career/tuning/parts';
import { progressionOf, type PartProgression } from '../../../game/career/tuning/partProgression';
import { assetCanvas } from '../../../game/vehicles/art/parts/PartIllustrations';
import { resolvePartVisual } from '../../../game/vehicles/art/parts/PartVisualResolver';
import { clear, h } from '../../dom';
import { workshopPartHeading } from '../../workshop/WorkshopPartHeading';
import { CATEGORY_HELP, L, TAB_COPY, type FilterId } from './WorkshopCopy';
import { matchesFilter, matchesQuery } from './WorkshopSearchFilters';
import { resolveOwned, STOCK_PREFIX } from './WorkshopPreviewModel';

const cr = (v: number): string => `${v.toLocaleString('pt-BR')} CR`;

export interface CatalogPart {
  part: PartDef;
  status: PartStatus;
  progression: PartProgression | undefined;
  position: number;
  searchText: string;
}
export interface CatalogGroup {
  category: PartCategory;
  label: string;
  /** The car runs the factory part of this slot. */
  stockInUse: boolean;
  stockStatus: PartStatus;
  parts: CatalogPart[];
}
export interface CatalogTab {
  id: string;
  label: string;
  help: string;
  icon: string;
  /** Installed upgrades in the tab. */
  installed: number;
  groups: CatalogGroup[];
}
export interface Catalog {
  tabs: CatalogTab[];
  byId: Map<string, CatalogPart>;
  tabOf(category: PartCategory): string | undefined;
}

/** Hardware that fits this car even before its event or chapter unlock. */
export function visiblePartsOf(car: OwnedCar): PartDef[] {
  const base = findCampaignCar(car.baseCarId)!;
  const v2 = buildVersionFor(car, car.installedParts) === 2;
  return ALL_PARTS.filter((p) => {
    if (car.installedParts.includes(p.id)) return true;
    // version 2 compatibility rules apply to the cars resolved by version 2 and to v2 parts
    if ((v2 || p.since === 2 || p.compat?.cars) && incompatibility(base, p)) return false;
    return true;
  });
}

/** Tabs, groups and parts of a car: the same grouping as the classic workshop, plus search text. */
export function buildCatalog(save: CareerSave, car: OwnedCar, statusOf: (p: PartDef) => PartStatus): Catalog {
  const base = findCampaignCar(car.baseCarId)!;
  const family = familyOf(base);
  const visible = visiblePartsOf(car);
  // a category is shown when it has parts for this car; a car of resolver version 1 keeps every
  // chapter 1 slot (its factory part), exactly as the chapter 1 workshop showed it
  const legacy = buildVersionFor(car, car.installedParts) === 1;
  const catVisible = (c: PartCategory): boolean => visible.some((p) => p.category === c) || (legacy && CATEGORY_ORDER_V1.includes(c));
  const byId = new Map<string, CatalogPart>();
  const tabs: CatalogTab[] = [];
  for (const t of WORKSHOP_TABS) {
    const cats = t.categories.filter(catVisible);
    if (!cats.length) continue;
    const copy = TAB_COPY[t.id];
    const groups: CatalogGroup[] = cats.map((cat, index) => {
      const positionByGroup = new Map<string, number>();
      const parts = visible
        .filter((p) => p.category === cat)
        .map((p, i) => {
          const progression = progressionOf(p, family, car.baseCarId);
          const group = progression?.group ?? p.id;
          const position = positionByGroup.get(group) ?? i;
          positionByGroup.set(group, position);
          const status = statusOf(p);
          const text = [p.name, CATEGORY_LABEL[cat], CATEGORY_HELP[cat], copy?.label ?? t.label, progression ? `stage ${progression.tier} ${progression.specialization}` : '', p.id].join(' ');
          const cp: CatalogPart = { part: p, status, progression, position, searchText: text };
          if (!byId.has(p.id)) byId.set(p.id, cp);
          return cp;
        })
        .sort((a, b) => a.position - b.position || (a.progression?.tier ?? 0) - (b.progression?.tier ?? 0));
      const inSlot = car.installedParts.some((id) => findPart(id)?.category === cat);
      void index;
      return { category: cat, label: CATEGORY_LABEL[cat], stockInUse: !inSlot, stockStatus: stockStatus(car, cat, (id) => findPart(id)?.category), parts };
    });
    tabs.push({
      id: t.id,
      label: copy?.label ?? t.label,
      help: copy?.help ?? t.description,
      icon: t.icon,
      installed: car.installedParts.filter((id) => t.categories.includes(findPart(id)?.category as PartCategory)).length,
      groups,
    });
  }
  void save;
  return { tabs, byId, tabOf: (c) => tabs.find((t) => t.groups.some((g) => g.category === c))?.id };
}

/** Parts that resolve on this car by themselves (cached by the installed parts), for the "Compatíveis" filter. */
const compatCache = new Map<string, boolean>();
export function fitsCar(car: OwnedCar, p: PartDef): boolean {
  const key = `${car.id}|${car.installedParts.join(',')}|${p.id}`;
  const hit = compatCache.get(key);
  if (hit !== undefined) return hit;
  const parts = car.installedParts.includes(p.id) ? car.installedParts : [...car.installedParts.filter((id) => findPart(id)?.category !== p.category), p.id];
  const ok = resolveOwned(car, parts).ok;
  if (compatCache.size > 4000) compatCache.clear();
  compatCache.set(key, ok);
  return ok;
}

const iconCache = new Map<string, string>();
function iconSrc(p: PartDef): string {
  const asset = resolvePartVisual(p as unknown as { category: PartCategory } & Record<string, unknown>).asset;
  let url = iconCache.get(asset);
  if (!url) {
    try {
      url = assetCanvas(asset, 54, 40).toDataURL();
    } catch {
      url = '';
    }
    iconCache.set(asset, url);
  }
  return url;
}

export interface CatalogView {
  root: HTMLElement;
  /** Re-renders the list (tabs, groups, cards) from a catalog and the filter state. */
  render(c: Catalog, s: { tab: string | null; query: string; filter: FilterId; selected: string | null }, car: OwnedCar, save: CareerSave): { visible: number; total: number; tab: string };
  /** Moves the selection mark without rebuilding the list. */
  select(id: string | null): void;
}

export function buildCatalogView(on: { select: (id: string) => void; tab: (id: string) => void }): CatalogView {
  const tabsEl = h('nav', { class: 'wv-tabs ws-tabs', 'aria-label': L.chooseTitle, 'data-testid': 'ws-tabs' });
  const list = h('div', { class: 'wv-list ws-center', 'data-testid': 'ws-center' });
  const root = h('div', { class: 'wv-catalog' }, tabsEl, list);
  const mark = (id: string | null): void => {
    for (const el of list.querySelectorAll<HTMLElement>('[data-select]')) {
      const sel = el.dataset.select === id;
      el.classList.toggle('sel', sel);
      el.setAttribute('aria-pressed', String(sel));
    }
  };
  const pick = (id: string) => (e: Event): void => {
    if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
    if (e instanceof KeyboardEvent) e.preventDefault();
    on.select(id);
  };
  return {
    root,
    select: mark,
    render(cat, s, car, save) {
      const tab = cat.tabs.find((t) => t.id === s.tab) ?? cat.tabs[0]!;
      clear(tabsEl);
      for (const t of cat.tabs)
        tabsEl.append(
          h('button', { type: 'button', class: t.id === tab.id ? 'tab active' : 'tab', 'data-testid': `ws-tab-${t.id}`, 'aria-pressed': String(t.id === tab.id), title: t.help, onclick: () => on.tab(t.id) },
            h('span', { class: 'ws-tab-icon', 'aria-hidden': 'true' }, t.icon),
            h('span', { class: 'ws-tab-copy' }, h('b', {}, t.label)),
            t.installed ? h('span', { class: 'ws-tab-count' }, String(t.installed)) : null),
        );
      clear(list);
      const searching = !!s.query.trim() || s.filter !== 'all';
      // a search looks at every tab, so a part is found wherever it lives
      const scope = s.query.trim() ? cat.tabs : [tab];
      let visible = 0;
      let total = 0;
      for (const t of scope) for (const g of t.groups) total += g.parts.length;
      const keep = (p: CatalogPart): boolean => matchesQuery(p.searchText, s.query) && matchesFilter(s.filter, p.status.state, () => fitsCar(car, p.part));
      let selectedShown = false;
      for (const t of scope) {
        for (const g of t.groups) {
          const parts = g.parts.filter(keep);
          const stockShown = s.filter === 'all' && matchesQuery(`${g.label} original de fabrica`, s.query);
          if (searching && !parts.length && !stockShown) continue;
          visible += parts.length;
          const stockId = `${STOCK_PREFIX}${g.category}`;
          if (s.selected === stockId && stockShown) selectedShown = true;
          const stockCard = stockShown
            ? h('li', { class: `stock ws-part-card wv-card ${s.selected === stockId ? 'sel' : ''} ${g.stockStatus.state}`, 'data-testid': `ws-stock-${g.category}`, 'data-state': g.stockStatus.state, 'data-select': stockId, title: g.stockStatus.detail, tabindex: '0', role: 'button', 'aria-pressed': String(s.selected === stockId), onclick: pick(stockId), onkeydown: pick(stockId) },
                workshopPartHeading(h('span', { class: 'ws-part-name' }, `${g.label} original`), g.stockStatus.state, g.stockStatus.label, `ws-stock-pill-${g.category}`),
                h('small', { class: 'ws-part-meta' }, 'De fábrica · grátis'))
            : null;
          const cards = parts.map((p) => {
            if (s.selected === p.part.id) selectedShown = true;
            return partCard(p, s.selected === p.part.id, pick(p.part.id));
          });
          list.append(
            h('section', { class: 'ws-group wv-group', 'data-testid': `ws-group-${g.category}`, 'aria-label': g.label },
              h('div', { class: 'ws-group-header wv-group-head' },
                h('div', {}, h('h3', {}, g.label), h('p', {}, CATEGORY_HELP[g.category])),
                h('span', { class: 'ws-installed-slot' }, g.stockInUse ? 'ORIGINAL' : 'EQUIPADO')),
              h('ul', { class: 'ws-parts wv-parts' }, stockCard, ...cards)),
          );
        }
      }
      if (!visible && !list.querySelector('.wv-group')) list.append(h('div', { class: 'hint wv-empty', 'data-testid': 'ws-empty' }, L.noResults));
      // never hide the selected part silently: pin it on top with a note
      if (s.selected && !selectedShown && searching) {
        const sp = s.selected.startsWith(STOCK_PREFIX) ? null : cat.byId.get(s.selected);
        if (sp)
          list.prepend(
            h('section', { class: 'wv-pinned', 'data-testid': 'ws-pinned' },
              h('p', { class: 'hint' }, L.hiddenSelected),
              h('ul', { class: 'ws-parts wv-parts' }, partCard(sp, true, pick(sp.part.id)))),
          );
      }
      void save;
      return { visible, total, tab: tab.id };
    },
  };
}

function partCard(p: CatalogPart, selected: boolean, onPick: (e: Event) => void): HTMLElement {
  const { part, status: st, progression } = p;
  const pill = st.label;
  return h(
    'li',
    {
      class: `ws-part-card wv-card ${selected ? 'sel' : ''} ${st.state}`,
      'data-testid': `ws-part-${part.id}`,
      'data-state': st.state,
      'data-tier': progression?.tier,
      'data-select': part.id,
      title: st.detail,
      tabindex: '0',
      role: 'button',
      'aria-pressed': String(selected),
      onclick: onPick,
      onkeydown: onPick,
    },
    h('img', { class: 'wv-ico', alt: '', src: iconSrc(part), width: 54, height: 40, 'aria-hidden': 'true' }),
    h('div', { class: 'wv-card-body' },
      workshopPartHeading(h('span', { class: 'ws-part-name' }, part.name), st.state, pill, `ws-pill-${part.id}`),
      h('small', { class: 'ws-part-meta' },
        `CAP. ${partChapter(part)} · ${cr(part.price)} · `,
        progression ? `Stage ${progression.tier} · ${progression.specialization} · ` : null,
        st.state === 'locked' ? st.detail : part.description)),
  );
}

