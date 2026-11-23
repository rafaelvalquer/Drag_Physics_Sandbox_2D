import { h } from '../../dom';
import { badge, emptyState, icon, nf, panel, secondaryButton, stat, type Tone } from '../design/CareerComponents';
import { FREE_DISTANCES, FREE_DISTANCE_LABEL, FREE_TIERS, FREE_TIER_LABEL, type FreeStats } from '../../../game/career/freeEvents/FreeEventTypes';
import type { ChapterId } from '../../../game/career/chapters';

export type OutcomeId = 'win' | 'loss' | 'red-light' | 'dnf';

export interface HistoryRow {
  id: string;
  date: string;
  chapter: string;
  event: string;
  rival: string;
  outcome: OutcomeId;
  rt: number | null;
  et: number | null;
  total: number | null;
  trapKmh: number | null;
  rivalEt: number | null;
  credits: number;
  reputation: number;
  launchRpm: number | null;
  maxSlip: number | null;
  freeDetails?: { car: string; paint: string; preparation: string; track: string; distance: string; chapterTitle: string };
}

export interface HistoryDeps {
  rows: HistoryRow[];
  chapters: { id: string; label: string }[];
  freeStats?: Record<ChapterId, FreeStats>;
  activeChapter?: ChapterId;
  onEvents(): void;
  onBack(): void;
}

const OUTCOME: Record<OutcomeId, { text: string; tone: Tone; ico: string }> = {
  win: { text: 'Vitória', tone: 'ok', ico: 'trophy' },
  loss: { text: 'Derrota', tone: 'bad', ico: 'flag' },
  'red-light': { text: 'Queima de largada', tone: 'bad', ico: 'flag' },
  dnf: { text: 'DNF', tone: 'neutral', ico: 'flag' },
};

const n3 = (v: number | null): string => (v === null ? '—' : v.toFixed(3).replace('.', ','));
const n1 = (v: number | null): string => (v === null ? '—' : v.toFixed(1).replace('.', ','));

/** Pure aggregation of the stored results (the save keeps only the most recent runs). */
export function summarize(rows: HistoryRow[]): { total: number; wins: number; losses: number; bestEt: number | null; credits: number; reputation: number } {
  const ets = rows.filter((r) => r.outcome === 'win' && r.et !== null).map((r) => r.et!);
  return {
    total: rows.length,
    wins: rows.filter((r) => r.outcome === 'win').length,
    losses: rows.filter((r) => r.outcome !== 'win').length,
    bestEt: ets.length ? Math.min(...ets) : null,
    credits: rows.reduce((a, r) => a + r.credits, 0),
    reputation: rows.reduce((a, r) => a + r.reputation, 0),
  };
}

export function buildHistory(d: HistoryDeps): HTMLElement {
  if (!d.rows.length && !d.freeStats) {
    return h(
      'div',
      { class: 'hx' },
      emptyState({ title: 'Nenhuma corrida ainda', text: 'Seus resultados aparecem aqui assim que você disputar a primeira prova da carreira.', ico: 'history', cta: { label: 'Ir para os eventos', testid: 'history-events', on: d.onEvents }, testid: 'history-empty' }),
      h('div', { class: 'evx-foot' }, secondaryButton('Voltar', 'history-back', d.onBack, { ico: 'back' })),
    );
  }
  let chapter = d.freeStats ? (d.activeChapter ?? 'chapter-1') : 'all';
  let outcome: 'all' | OutcomeId = 'all';
  let open: string | null = null;
  const sumEl = h('div', { class: 'hx-summary' });
  const list = h('div', { class: 'hx-list' });
  const filters = h('div', { class: 'hx-filters' });
  const filtered = (): HistoryRow[] => d.rows.filter((r) => (chapter === 'all' || r.chapter === chapter) && (outcome === 'all' || r.outcome === outcome));

  const render = (): void => {
    const rows = filtered();
    const s = summarize(rows);
    const free = d.freeStats?.[chapter as ChapterId];
    const leadTier = free && [...FREE_TIERS].sort((a, b) => (free.tierRaces[b] ?? 0) - (free.tierRaces[a] ?? 0))[0];
    sumEl.replaceChildren(...(free ? [
      panel('hx-sum', stat('Corridas', nf(free.races), { size: 'lg', testid: 'history-total' })),
      panel('hx-sum', stat('Vitórias', nf(free.wins), { size: 'lg', testid: 'history-wins' })),
      panel('hx-sum', stat('Derrotas', nf(free.races - free.wins), { size: 'lg' })),
      panel('hx-sum', stat('Taxa de vitória', free.races ? `${Math.round(100 * free.wins / free.races)}%` : '—', { size: 'lg' })),
      panel('hx-sum', stat('Créditos', nf(free.creditsEarned), { size: 'lg', unit: 'CR' })),
      panel('hx-sum', stat('Classe mais disputada', leadTier && free.tierRaces[leadTier] ? FREE_TIER_LABEL[leadTier] : '—', { size: 'sm' })),
      ...FREE_DISTANCES.filter((distance) => distance !== 'km' || chapter === 'chapter-3').map((distance) =>
        panel('hx-sum', stat(`Melhor ET · ${FREE_DISTANCE_LABEL[distance]}`, n3(free.bestEt[distance] ?? null), { size: 'lg', unit: free.bestEt[distance] ? 's' : undefined }))),
    ] : [
      panel('hx-sum', stat('Corridas', String(s.total), { size: 'lg', testid: 'history-total' })),
      panel('hx-sum', stat('Vitórias', String(s.wins), { size: 'lg', testid: 'history-wins' })),
      panel('hx-sum', stat('Derrotas', String(s.losses), { size: 'lg' })),
      panel('hx-sum', stat('Melhor ET', s.bestEt === null ? '—' : n3(s.bestEt), { size: 'lg', unit: s.bestEt === null ? undefined : 's' })),
      panel('hx-sum', stat('Créditos', nf(s.credits), { size: 'lg', unit: 'CR' })),
      panel('hx-sum', stat('Reputação', `+${nf(s.reputation)}`, { size: 'lg' })),
    ]));
    const chOpts: [string, string][] = d.chapters.map((c) => [c.id, c.label]);
    if (!d.freeStats) chOpts.unshift(['all', 'Todos os capítulos']);
    const oOpts: ['all' | OutcomeId, string][] = [
      ['all', 'Todos'],
      ['win', 'Vitória'],
      ['loss', 'Derrota'],
      ['red-light', 'Queima'],
      ['dnf', 'DNF'],
    ];
    filters.replaceChildren(
      h('div', { class: 'mk-filters' }, chOpts.map(([id, label]) => h('button', { class: `mk-filter ${chapter === id ? 'on' : ''}`, 'data-testid': `history-chapter-${id}`, onclick: () => ((chapter = id), render()) }, label))),
      h('div', { class: 'mk-filters' }, oOpts.map(([id, label]) => h('button', { class: `mk-filter ${outcome === id ? 'on' : ''}`, 'data-testid': `history-outcome-${id}`, onclick: () => ((outcome = id), render()) }, label))),
    );
    list.replaceChildren(
      ...(rows.length
        ? rows.map((r) => {
            const o = OUTCOME[r.outcome];
            const isOpen = open === r.id;
            return h(
              'article',
              { class: `hx-row ${r.outcome} ${isOpen ? 'open' : ''}`, 'data-testid': 'history-row' },
              h(
                'button',
                { class: 'hx-head', 'aria-expanded': String(isOpen), onclick: () => ((open = isOpen ? null : r.id), render()) },
                badge(o.text, o.tone, o.ico),
                h('div', { class: 'hx-main' }, h('b', {}, r.event), h('small', {}, `${r.rival} · ${r.date}`)),
                h('div', { class: 'hx-nums' }, h('span', {}, `ET ${n3(r.et)} s`), h('span', {}, `RT ${n3(r.rt)} s`)),
                h('span', { class: 'hx-prize' }, `${nf(r.credits)} CR`),
                icon(isOpen ? 'back' : 'arrow'),
              ),
              isOpen
                ? h(
                    'div',
                    { class: 'hx-detail', 'data-testid': 'history-detail' },
                    stat('Tempo de reação', `${n3(r.rt)} s`, { size: 'sm' }),
                    stat('ET', `${n3(r.et)} s`, { size: 'sm' }),
                    stat('Tempo total', `${n3(r.total)} s`, { size: 'sm' }),
                    stat('Velocidade final', r.trapKmh === null ? '—' : `${n1(r.trapKmh)} km/h`, { size: 'sm' }),
                    stat('ET do rival', `${n3(r.rivalEt)} s`, { size: 'sm' }),
                    stat('Rotação na largada', r.launchRpm === null ? '—' : `${nf(Math.round(r.launchRpm))} rpm`, { size: 'sm' }),
                    stat('Patinagem máxima', r.maxSlip === null ? '—' : `${Math.round(r.maxSlip * 100)} %`, { size: 'sm' }),
                    !d.freeStats ? stat('Reputação', `+${r.reputation}`, { size: 'sm' }) : null,
                    r.freeDetails ? [
                      stat('Capítulo', r.freeDetails.chapterTitle, { size: 'sm' }),
                      stat('Veículo do rival', r.freeDetails.car, { size: 'sm' }),
                      stat('Pintura', r.freeDetails.paint, { size: 'sm' }),
                      stat('Preparação', r.freeDetails.preparation, { size: 'sm' }),
                      stat('Pista', r.freeDetails.track, { size: 'sm' }),
                      stat('Distância', r.freeDetails.distance, { size: 'sm' }),
                    ] : null,
                  )
                : null,
            );
          })
        : [h('p', { class: 'hint' }, 'Nenhuma corrida neste filtro.')]),
    );
  };
  render();
  return h(
    'div',
    { class: 'hx' },
    h('p', { class: 'hint hx-note' }, d.freeStats
      ? 'Os totais incluem todas as corridas do capítulo. A lista mostra os resultados recentes.'
      : `Mostrando as ${d.rows.length} corridas mais recentes guardadas no save. Os totais valem para esta lista.`),
    sumEl,
    filters,
    list,
    h('div', { class: 'evx-foot' }, secondaryButton('Voltar', 'history-back', d.onBack, { ico: 'back' })),
  );
}
