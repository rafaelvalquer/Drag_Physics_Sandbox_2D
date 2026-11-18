import { h } from '../../dom';
import type { FreeEventOffer } from '../../../game/career/FreeEvents';
import { badge, icon, primaryButton, secondaryButton, sectionHeader, nf } from '../design/CareerComponents';

export interface FreeEventsDeps {
  chapterTitle: string;
  offers: readonly FreeEventOffer[];
  makePreview(offer: FreeEventOffer, width: number, height: number): HTMLCanvasElement;
  onPick(offer: FreeEventOffer): void;
  onRefresh(): void;
  onBack(): void;
}

const TIER: Record<string, { title: string; desc: string }> = {
  bairro: { title: 'Racha de bairro', desc: 'Original ou preparação leve · 201 metros' },
  preparado: { title: 'Duelo preparado', desc: 'Carro com upgrades variados · 402 metros' },
  elite: { title: 'Desafio de elite', desc: 'Preparação avançada e piloto experiente' },
};
const DISTANCE: Record<string, string> = { eighth: '201 m', quarter: '402 m', km: '1.000 m' };

/** Pure view: the save/controller owns the offers, physics and rewards. */
export function buildFreeEvents(d: FreeEventsDeps): HTMLElement {
  const cards = d.offers.map((o) => {
    const tier = TIER[o.tier]!;
    const preview = d.makePreview(o, 420, 180);
    preview.setAttribute('aria-label', 'Vista lateral do carro adversário');
    const count = o.rival.parts.length;
    return h('article', { class: 'fe-card', 'data-testid': 'free-offer-' + o.tier },
      h('div', { class: 'fe-top' },
        badge(tier.title, o.tier === 'elite' ? 'amber' : 'neutral', 'flag'),
        h('span', { class: 'fe-distance' }, DISTANCE[o.event.distance])),
      h('div', { class: 'fe-preview' }, preview),
      h('div', { class: 'fe-pilot' },
        h('span', { class: 'fe-paint', style: 'background:' + o.rival.paint.color, title: 'Pintura sorteada' }),
        h('div', {}, h('strong', {}, o.rival.name + ' "' + o.rival.nickname + '"'),
          h('small', {}, o.rival.baseCarId.replace(/-/g, ' ')))),
      h('div', { class: 'fe-stats' },
        h('div', {}, h('small', {}, 'Potência física'), h('strong', {}, Math.round(o.powerCv) + ' cv')),
        h('div', {}, h('small', {}, 'Peças'), h('strong', {}, String(count))),
        h('div', {}, h('small', {}, 'Prêmio'), h('strong', { class: 'fe-prize' }, '+' + nf(o.event.rewardCr) + ' CR'))),
      h('p', { class: 'fe-description' }, tier.desc),
      h('p', { class: 'fe-components' }, count
        ? count + ' upgrades reais instalados; conheça os detalhes antes de correr.'
        : 'Carro original, sem modificações.'),
      primaryButton('Conhecer adversário', 'free-pick-' + o.tier, () => d.onPick(o), { ico: 'flag' }),
    );
  });
  return h('div', { class: 'fe-screen' },
    h('div', { class: 'fe-intro' },
      sectionHeader('Pistas abertas · ' + d.chapterTitle),
      h('p', {}, 'Rachas repetíveis com carros deste capítulo, pinturas e peças diferentes. Sem taxa de inscrição.'),
      h('p', {}, 'A oferta é estável até você disputar ou pedir novos rivais. Os prêmios não avançam a história.')),
    h('div', { class: 'fe-grid' }, cards),
    h('div', { class: 'fe-actions' },
      secondaryButton('Gerar novos adversários', 'free-refresh', d.onRefresh, { ico: 'arrow' }),
      secondaryButton('Voltar à garagem', 'free-back', d.onBack, { ico: 'back' })),
    h('p', { class: 'fe-hint' }, icon('lock'), ' Carros e peças seguem a mesma física e o mesmo som procedural da Oficina.'),
  );
}
