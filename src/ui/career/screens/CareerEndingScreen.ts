import type { CarConfig } from '../../../data/schema';
import { h } from '../../dom';
import { icon, nf, primaryButton, secondaryButton, stat } from '../design/CareerComponents';
import { chapterArt } from './CareerChaptersScreen';

export interface EndingDeps {
  chapterNumber: number;
  chapterTitle: string;
  title: string;
  cfg: CarConfig;
  carLine: string;
  /** Car won from the loser of the final, in the garage. */
  prizeLine: string | null;
  powerCv: number | null;
  torqueNm: number | null;
  credits: number;
  reputation: number;
  races: number;
  wins: number;
  bestEt: number | null;
  completedAt: string | null;
  /** The chapter this ending opens (already unlocked), if any. */
  nextChapter: { number: number; title: string } | null;
  makePreview(car: CarConfig, w: number, h: number): HTMLCanvasElement;
  onChapters(): void;
  onGarage(): void;
  onMenu(): void;
}

/** Chapter ending: title reveal over the chapter scenery, the car and the final numbers. */
export function buildEnding(d: EndingDeps): HTMLElement {
  return h(
    'div',
    { class: `enx c${d.chapterNumber}` },
    h(
      'section',
      { class: 'en-hero' },
      h('div', { class: 'en-art', html: chapterArt(d.chapterNumber), 'aria-hidden': 'true' }),
      h('div', { class: 'en-glow' }),
      h('div', { class: 'en-title', 'data-slide': 'center' }, icon('trophy'), h('small', {}, `CAPÍTULO ${d.chapterNumber} CONCLUÍDO · ${d.chapterTitle.toUpperCase()}`), h('h2', { 'data-testid': 'ending-title' }, d.title)),
      h('div', { class: 'en-car', 'data-reveal': '' }, d.makePreview(d.cfg, 760, 300)),
    ),
    h(
      'section',
      { class: 'en-stats cs-panel', 'data-reveal': '' },
      stat('Carro', d.carLine, { size: 'md' }),
      d.prizeLine ? stat('Prêmio da final', d.prizeLine, { size: 'md' }) : null,
      d.powerCv !== null ? stat('Potência', nf(Math.round(d.powerCv)), { unit: 'cv', size: 'lg' }) : null,
      d.torqueNm !== null ? stat('Torque', nf(Math.round(d.torqueNm)), { unit: 'N·m', size: 'lg' }) : null,
      stat('Corridas registradas', `${d.races} (${d.wins} vitórias)`, { size: 'md' }),
      stat('Melhor ET na final', d.bestEt === null ? '—' : `${d.bestEt.toFixed(3).replace('.', ',')} s`, { size: 'md' }),
      stat('Reputação', String(d.reputation), { size: 'md' }),
      stat('Créditos', `${nf(d.credits)} CR`, { size: 'md' }),
      stat('Concluído em', d.completedAt ?? '—', { size: 'md' }),
    ),
    h(
      'div',
      { class: 'rs-actions', 'data-reveal': '' },
      d.nextChapter ? primaryButton(`Capítulo ${d.nextChapter.number}: ${d.nextChapter.title}`, `ending-chapter${d.nextChapter.number}`, d.onChapters, { ico: 'chapters' }) : null,
      d.nextChapter ? secondaryButton('Garagem', 'ending-garage', d.onGarage, { ico: 'garage' }) : primaryButton('Garagem', 'ending-garage', d.onGarage, { ico: 'garage' }),
      secondaryButton('Menu', 'ending-menu', d.onMenu, { ico: 'overview' }),
    ),
  );
}
