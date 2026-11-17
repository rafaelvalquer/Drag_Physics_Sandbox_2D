import { h } from '../../dom';
import { badge, emptyState, icon, nf, panel, secondaryButton, stat, type Tone } from '../design/CareerComponents';

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
}

export interface HistoryDeps {
  rows: HistoryRow[];
  chapters: { id: string; label: string }[];
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
  if (!d.rows.length) {
    return h(
      'div',
      { class: 'hx' },
      emptyState({ title: 'Nenhuma corrida ainda', text: 'Seus resultados aparecem aqui assim que você disputar a primeira prova da carreira.', ico: 'history', cta: { label: 'Ir para os eventos', testid: 'history-events', on: d.onEvents }, testid: 'history-empty' }),
      h('div', { class: 'evx-foot' }, secondaryButton('Voltar', 'history-back', d.onBack, { ico: 'back' })),
    );
  }
  let chapter = 'all';
  let outcome: 'all' | OutcomeId = 'all';
  let open: string | null = null;
  const sumEl = h('div', { class: 'hx-summary' });
  const list = h('div', { class: 'hx-list' });
  const filters = h('div', { class: 'hx-filters' });
  const filtered = (): HistoryRow[] => d.rows.filter((r) => (chapter === 'all' || r.chapter === chapter) && (outcome === 'all' || r.outcome === outcome));

  const render = (): void => {
    const rows = filtered();
    const s = summarize(rows);
    sumEl.replaceChildren(
      panel('hx-sum', stat('Corridas', String(s.total), { size: 'lg', testid: 'history-total' })),
      panel('hx-sum', stat('Vitórias', String(s.wins), { size: 'lg', testid: 'history-wins' })),
      panel('hx-sum', stat('Derrotas', String(s.losses), { size: 'lg' })),
      panel('hx-sum', stat('Melhor ET', s.bestEt === null ? '—' : n3(s.bestEt), { size: 'lg', unit: s.bestEt === null ? undefined : 's' })),
      panel('hx-sum', stat('Créditos', nf(s.credits), { size: 'lg', unit: 'CR' })),
      panel('hx-sum', stat('Reputação', `+${nf(s.reputation)}`, { size: 'lg' })),
    );
    const chOpts: [string, string][] = [['all', 'Todos os capítulos'], ...d.chapters.map((c) => [c.id, c.label] as [string, string])];
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
                    stat('Reputação', `+${r.reputation}`, { size: 'sm' }),
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
    h('p', { class: 'hint hx-note' }, `Mostrando as ${d.rows.length} corridas mais recentes guardadas no save; os totais abaixo valem para esta lista.`),
    sumEl,
    filters,
    list,
    h('div', { class: 'evx-foot' }, secondaryButton('Voltar', 'history-back', d.onBack, { ico: 'back' })),
  );
}
