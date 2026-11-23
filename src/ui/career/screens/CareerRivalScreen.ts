import type { CarConfig } from '../../../data/schema';
import { h } from '../../dom';
import { badge, nf, primaryButton, secondaryButton, stat } from '../design/CareerComponents';

export interface Contender {
  name: string;
  car: string;
  cfg: CarConfig;
  cv: number;
  nm: number;
  massKg: number;
  drive: string;
  note?: string;
}

export interface RivalDeps {
  player: Contender;
  rival: Contender & { nickname: string; portrait: HTMLElement; line: string; parts: string; skill: string };
  event: { title: string; distance: string; region: string; prize: string; finale: boolean };
  makePreview(car: CarConfig, w: number, h: number): HTMLCanvasElement;
  onStart(): void;
  onBack(): void;
  startBlocked?: string | null;
}

function side(c: Contender, d: RivalDeps, kind: 'left' | 'right', head: HTMLElement): HTMLElement {
  return h(
    'section',
    { class: `rv-side ${kind}`, 'data-slide': kind },
    head,
    h('div', { class: 'rv-car' }, d.makePreview(c.cfg, 520, 220)),
    h('div', { class: 'rv-car-name' }, c.car),
    h('div', { class: 'rv-stats' }, stat('Potência', nf(Math.round(c.cv)), { unit: 'cv', size: 'md' }), stat('Torque', nf(Math.round(c.nm)), { unit: 'N·m', size: 'md' }), stat('Peso', nf(c.massKg), { unit: 'kg', size: 'md' }), stat('Tração', c.drive, { size: 'md' })),
    c.note ? h('small', { class: 'rv-note' }, c.note) : null,
  );
}

/** Pre-race confrontation: player on the left, rival on the right, VS between them. */
export function buildRival(d: RivalDeps): HTMLElement {
  const r = d.rival;
  return h(
    'div',
    { class: 'rvx' },
    h(
      'div',
      { class: 'rv-stage' },
      side(d.player, d, 'left', h('div', { class: 'rv-head' }, h('div', { class: 'rv-id' }, h('small', {}, 'VOCÊ'), h('h2', {}, d.player.name)))),
      h('div', { class: 'rv-vs', 'data-slide': 'center', 'aria-hidden': 'true' }, h('b', {}, 'VS')),
      side(
        r,
        d,
        'right',
        h('div', { class: 'rv-head' }, h('div', { class: 'rv-portrait' }, r.portrait), h('div', { class: 'rv-id' }, h('small', {}, 'ADVERSÁRIO'), h('h2', { 'data-testid': 'rival-name' }, `${r.name} "${r.nickname}"`))),
      ),
    ),
    h('blockquote', { class: 'rv-line', 'data-testid': 'rival-line', 'data-reveal': '' }, `“${r.line}”`),
    h(
      'div',
      { class: 'rv-info', 'data-reveal': '' },
      h('div', {}, stat('Evento', d.event.title, { size: 'md' })),
      h('div', {}, stat('Distância', d.event.distance, { size: 'md' })),
      h('div', {}, stat('Região', d.event.region, { size: 'md' })),
      h('div', {}, h('div', { class: 'cs-stat md' }, h('small', {}, 'Prêmio'), h('b', { 'data-testid': 'rival-reward' }, d.event.prize))),
      h('div', {}, stat('Piloto', r.skill, { size: 'sm' })),
      r.parts ? h('div', {}, stat('Peças do rival', r.parts, { size: 'sm' })) : null,
    ),
    h(
      'div',
      { class: 'rv-actions', 'data-reveal': '' },
      d.event.finale ? badge('Desafio final', 'bad', 'trophy') : null,
      d.startBlocked ? h('p', { class: 'hint', 'data-testid': 'rival-ineligible' }, d.startBlocked) : null,
      primaryButton('Iniciar corrida', 'rival-start', d.onStart, { ico: 'play', disabled: !!d.startBlocked }),
      secondaryButton('Voltar', 'rival-back', d.onBack, { ico: 'back' }),
    ),
  );
}
