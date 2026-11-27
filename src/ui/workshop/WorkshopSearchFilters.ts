import { h } from '../dom';
import { FILTERS, L, SEARCH_ALIASES, type FilterId } from './WorkshopCopy';

/** Lower case without accents: "Pressão" and "pressao" match each other. */
export const normalize = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Instant search: every word of the query must appear in the part's search text (name, category,
 * family, common and technical terms). A word also matches its everyday synonym (turbina / turbo).
 */
export function matchesQuery(searchText: string, query: string): boolean {
  const q = normalize(query).trim();
  if (!q) return true;
  const hay = normalize(searchText);
  return q.split(/\s+/).every((w) => hay.includes(w) || (SEARCH_ALIASES[w] !== undefined && hay.includes(SEARCH_ALIASES[w]!)));
}

export interface FilterableStatus {
  state: 'installed' | 'owned' | 'available' | 'locked' | 'stock' | string;
}

/** Whether a part passes the chip filter. `compatible` is resolved by the caller (the resolver decides). */
export function matchesFilter(filter: FilterId, state: string, compatible: () => boolean): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'available':
      return state === 'available' || state === 'owned';
    case 'equipped':
      return state === 'installed';
    case 'stock':
      return state === 'owned';
    case 'locked':
      return state === 'locked';
    case 'compatible':
      return compatible();
    case 'incompatible':
      return state === 'incompatible';
  }
}

export interface SearchFiltersView {
  root: HTMLElement;
  input: HTMLInputElement;
  setFilter(f: FilterId): void;
  setCount(visible: number, total: number): void;
  dispose(): void;
}

export function buildSearchFilters(initial: { query: string; filter: FilterId }, on: { query: (q: string) => void; filter: (f: FilterId) => void }): SearchFiltersView {
  const input = h('input', { type: 'search', class: 'wv-search', placeholder: L.search, 'aria-label': L.searchLabel, 'data-testid': 'ws-search', autocomplete: 'off', value: initial.query }) as HTMLInputElement;
  input.value = initial.query;
  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => on.query(input.value), 120);
  });
  const chips = new Map<FilterId, HTMLButtonElement>();
  const row = h('div', { class: 'wv-chips', role: 'group', 'aria-label': 'Filtrar peças' });
  for (const f of FILTERS) {
    const b = h('button', { type: 'button', class: 'wv-chip', 'data-testid': `ws-filter-${f.id}`, 'aria-pressed': String(f.id === initial.filter), onclick: () => on.filter(f.id) }, f.label) as HTMLButtonElement;
    chips.set(f.id, b);
    row.append(b);
  }
  const count = h('div', { class: 'wv-count', 'data-testid': 'ws-count', 'aria-live': 'polite' });
  const root = h('div', { class: 'wv-searchbox' }, input, row, count);
  return {
    root,
    input,
    setFilter: (f) => chips.forEach((b, id) => b.setAttribute('aria-pressed', String(id === f))),
    setCount: (visible, total) => {
      count.textContent = visible === total ? `${total} peças` : `${visible} de ${total} peças`;
    },
    dispose: () => clearTimeout(timer),
  };
}
