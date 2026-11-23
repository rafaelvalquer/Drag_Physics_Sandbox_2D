import { findCareerTrack } from '../../../data/tracks/career';
import type { FreeOffer, FreeTier } from '../../../game/career/freeEvents/FreeEventTypes';
import { FREE_DISTANCE_LABEL, FREE_TIERS, FREE_TIER_LABEL } from '../../../game/career/freeEvents/FreeEventTypes';
import { h } from '../../dom';
import { badge, primaryButton, secondaryButton, sectionHeader, nf } from '../design/CareerComponents';

interface Card {
  offer: FreeOffer;
  powerCv: number;
  eligibility: string | null;
}

export interface FreeEventsDeps {
  chapterTitle: string;
  offers: readonly Card[];
  unlocked: readonly FreeTier[];
  gateLabels: Record<FreeTier, string>;
  filter: FreeTier | null;
  makePreview(offer: FreeOffer, width: number, height: number): HTMLCanvasElement;
  onFilter(tier: FreeTier | null): void;
  onPick(offer: FreeOffer): void;
  onRefresh(): void;
  onReplace(id: string): void;
  onHistory(): void;
  onBack(): void;
}

export function buildFreeEvents(d: FreeEventsDeps): HTMLElement {
  const cards = d.offers.map(({ offer: o, powerCv, eligibility }) => {
    const preview = d.makePreview(o, 420, 180);
    preview.setAttribute('aria-label', `Vista lateral de ${o.carName}, pintura ${o.paintName}`);
    const status = eligibility ? 'Carro inelegível' : o.attemptsStarted ? 'Revanche disponível' : 'Inscrição aberta';
    return h('article', { class: 'fe-card', 'data-testid': 'free-offer', 'data-offer-id': o.id, 'data-tier': o.tier },
      h('div', { class: 'fe-top' },
        badge(FREE_TIER_LABEL[o.tier], o.tier === 'competicao' ? 'amber' : 'neutral', 'flag'),
        h('span', { class: 'fe-distance' }, FREE_DISTANCE_LABEL[o.distance])),
      h('h3', { class: 'fe-event-title' }, `Desafio · ${findCareerTrack(o.trackId).name}`),
      h('div', { class: 'fe-preview' }, preview),
      h('div', { class: 'fe-pilot' },
        h('span', { class: 'fe-paint', style: `background:${o.paint.color};border-color:${o.paint.accent}`, 'aria-hidden': 'true' }),
        h('div', {}, h('strong', {}, `${o.opponent.driverName} “${o.opponent.driverNickname}”`), h('small', {}, o.carName))),
      h('div', { class: 'fe-stats' },
        h('div', {}, h('small', {}, 'Potência'), h('strong', {}, `${Math.round(powerCv)} cv`)),
        h('div', {}, h('small', {}, 'Peças'), h('strong', {}, String(o.opponent.installedParts.length))),
        h('div', {}, h('small', {}, 'Prêmio'), h('strong', { class: 'fe-prize' }, `${nf(o.rewardCr)} CR`))),
      h('p', { class: 'fe-description' }, `${o.paintName} · ${o.preparation}`),
      h('p', { class: 'fe-description', 'data-testid': 'free-offer-status' }, eligibility ?? status),
      primaryButton(o.attemptsStarted ? 'Ver revanche' : 'Ver adversário', 'free-pick', () => d.onPick(o), { ico: 'flag' }),
      o.attemptsStarted ? secondaryButton('Trocar oferta', 'free-replace', () => d.onReplace(o.id), { ico: 'arrow' }) : null,
    );
  });
  const filters = [null, ...FREE_TIERS].map((tier) => {
    const locked = tier !== null && !d.unlocked.includes(tier);
    const label = tier ? FREE_TIER_LABEL[tier] : 'Todas';
    return h('button', {
      class: `mk-filter ${d.filter === tier ? 'on' : ''}`,
      type: 'button', disabled: locked, 'aria-pressed': String(d.filter === tier),
      title: locked && tier ? d.gateLabels[tier] : label,
      'data-testid': `free-filter-${tier ?? 'all'}`,
      onclick: () => d.onFilter(tier),
    }, label, locked && tier ? h('small', { class: 'fe-gate' }, d.gateLabels[tier]) : null);
  });
  return h('div', { class: 'fe-screen' },
    h('div', { class: 'fe-intro' },
      sectionHeader(d.chapterTitle),
      h('p', {}, 'Escolha um desafio. A inscrição é gratuita e a vitória rende créditos.')),
    h('div', { class: 'mk-filters', role: 'group', 'aria-label': 'Classes dos Eventos Livres' }, filters),
    h('div', { class: 'fe-grid' }, cards.length ? cards : h('p', { class: 'hint' }, 'Nenhuma oferta disponível.')),
    h('div', { class: 'fe-actions' },
      secondaryButton('Renovar ofertas abertas', 'free-refresh', d.onRefresh, { ico: 'arrow', disabled: !d.offers.some(({ offer }) => !offer.attemptsStarted) }),
      secondaryButton('Histórico livre', 'free-history', d.onHistory, { ico: 'history' }),
      secondaryButton('Voltar à garagem', 'free-back', d.onBack, { ico: 'back' })),
  );
}
