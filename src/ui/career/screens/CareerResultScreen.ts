import { h } from '../../dom';
import { icon, nf, panel, primaryButton, secondaryButton, sectionHeader } from '../design/CareerComponents';

export type ResultOutcome = 'win' | 'loss' | 'red-light' | 'dnf';

export interface ResultRow {
  label: string;
  player: number | null;
  rival: number | null;
  /** 'low' = lower is better. */
  better: 'low' | 'high';
  format(v: number | null): string;
}

export interface ResultDeps {
  outcome: ResultOutcome;
  winnerLine: string;
  rivalName: string;
  rivalNick: string;
  rows: ResultRow[];
  credits: number;
  reputation: number;
  applied: boolean;
  unlocks: string[];
  rivalQuote: string | null;
  rivalPortrait: HTMLElement;
  ninaPortrait: HTMLElement;
  ninaComments: { id: string; text: string }[];
  next: string;
  chapterEvents: string;
  won: boolean;
  onRetry(): void;
  onGarage(): void;
  onEvents(): void;
}

const TITLE: Record<ResultOutcome, string> = { win: 'VITÓRIA', loss: 'DERROTA', 'red-light': 'QUEIMA DE LARGADA', dnf: 'NÃO COMPLETOU' };
const SUB: Record<ResultOutcome, string> = { win: 'Você cruzou a linha na frente.', loss: 'O rival foi mais rápido desta vez.', 'red-light': 'Largada antes do verde: prova desclassificada.', dnf: 'A prova não foi concluída.' };

/** Which side wins a comparison row (null when it can not be told). */
export function betterSide(row: Pick<ResultRow, 'player' | 'rival' | 'better'>): 'player' | 'rival' | null {
  const { player: a, rival: b } = row;
  if (a === null || b === null || a === b) return null;
  const playerLower = a < b;
  return (row.better === 'low') === playerLower ? 'player' : 'rival';
}

export function buildResult(d: ResultDeps): HTMLElement {
  const banner = h(
    'div',
    { class: `rs-banner ${d.outcome}`, 'data-reveal': '' },
    icon(d.won ? 'trophy' : 'flag'),
    h('div', {}, h('h2', { 'data-testid': 'result-winner', 'data-outcome': d.outcome }, d.winnerLine), h('p', {}, `${TITLE[d.outcome]} · ${SUB[d.outcome]}`)),
  );
  const cmp = panel(
    'rs-compare',
    sectionHeader('Comparação'),
    h(
      'div',
      { class: 'rs-table', role: 'table' },
      h('div', { class: 'rs-row head', role: 'row' }, h('span', {}), h('span', { class: d.won ? 'win' : '' }, 'Você'), h('span', { class: d.won ? '' : 'win' }, d.rivalNick)),
      d.rows.map((r) => {
        const w = betterSide(r);
        return h(
          'div',
          { class: 'rs-row', role: 'row' },
          h('span', { class: 'k' }, r.label),
          h('span', { class: w === 'player' ? 'best' : '' }, r.format(r.player), w === 'player' ? h('i', {}, ' ✓ melhor') : null),
          h('span', { class: w === 'rival' ? 'best' : '' }, r.format(r.rival), w === 'rival' ? h('i', {}, ' ✓ melhor') : null),
        );
      }),
    ),
  );
  const rewards = panel(
    'rs-rewards',
    sectionHeader('Recompensas'),
    h('div', { class: 'rs-award', 'data-testid': 'result-award' }, `+${nf(d.credits)} CR · +${d.reputation} de reputação${d.applied ? '' : ' (já registrado)'}`),
    d.unlocks.length ? h('div', { class: 'rs-unlocks', 'data-testid': 'result-unlocks' }, icon('lock'), `Liberado: ${d.unlocks.join(', ')}`) : null,
    h('p', { class: 'hint' }, d.next),
  );
  const voices = panel(
    'rs-voices',
    d.rivalQuote ? h('div', { class: 'quote' }, h('div', { class: 'ev-portrait' }, d.rivalPortrait), h('blockquote', {}, `“${d.rivalQuote}”`)) : null,
    h(
      'div',
      { class: 'quote' },
      h('div', { class: 'ev-portrait' }, d.ninaPortrait),
      h('ul', { class: 'nina-comments', 'data-testid': 'nina-comments' }, d.ninaComments.map((c) => h('li', { 'data-comment': c.id }, c.text))),
    ),
  );
  const actions = h(
    'div',
    { class: 'rs-actions', 'data-reveal': '' },
    d.won ? null : primaryButton('Revanche', 'result-retry', d.onRetry, { ico: 'flag' }),
    d.won ? primaryButton('Garagem', 'result-garage', d.onGarage, { ico: 'garage' }) : secondaryButton('Garagem', 'result-garage', d.onGarage, { ico: 'garage' }),
    secondaryButton(d.chapterEvents, 'result-events', d.onEvents, { ico: 'events' }),
  );
  // the retry button is part of the flow on a win as well (kept for the existing tests/flows)
  if (d.won) actions.append(secondaryButton('Revanche', 'result-retry', d.onRetry, { ico: 'flag' }));
  return h('div', { class: `rsx ${d.outcome}` }, banner, h('div', { class: 'rs-grid' }, h('div', { class: 'rs-col', 'data-reveal': '' }, cmp, rewards), h('div', { class: 'rs-col', 'data-reveal': '' }, voices)), actions);
}
