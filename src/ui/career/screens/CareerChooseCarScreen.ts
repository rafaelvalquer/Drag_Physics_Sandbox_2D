import type { CarConfig } from '../../../data/schema';
import { h } from '../../dom';
import { icon, nf, secondaryButton } from '../design/CareerComponents';

export interface StarterCard {
  id: string;
  name: string;
  description: string;
  price: number;
  cfg: CarConfig;
  cv: number;
  nm: number;
  massKg: number;
  drive: string;
}

export interface ChooseDeps {
  cards: StarterCard[];
  budget: number;
  makePreview(car: CarConfig, w: number, h: number): HTMLCanvasElement;
  onChoose(id: string): void;
  onBack(): void;
}

/** One comparison bar: the value relative to the best of the three (text always carries the number). */
function bar(label: string, value: number, max: number, text: string, lowerIsBetter = false): HTMLElement {
  const pct = Math.max(6, Math.round((value / max) * 100));
  return h('div', { class: `ch-bar ${lowerIsBetter ? 'low' : ''}` }, h('span', { class: 'k' }, label), h('div', { class: 'cs-bar' }, h('i', { style: `width:${pct}%` })), h('span', { class: 'v' }, text));
}

/** First car choice: three large showroom cards with a simple side-by-side comparison. */
export function buildChoose(d: ChooseDeps): HTMLElement {
  const maxCv = Math.max(...d.cards.map((c) => c.cv));
  const maxNm = Math.max(...d.cards.map((c) => c.nm));
  const maxKg = Math.max(...d.cards.map((c) => c.massKg));
  return h(
    'div',
    { class: 'chs' },
    h('p', { class: 'chs-lead', 'data-reveal': '' }, `Você tem ${nf(d.budget)} CR. O que sobrar vai para a oficina. Todos estão exatamente como saíram de fábrica.`),
    h(
      'div',
      { class: 'chs-grid' },
      d.cards.map((c) =>
        h(
          'article',
          { class: 'chs-card starter', 'data-testid': `starter-${c.id}`, 'data-reveal': '' },
          h('div', { class: 'chs-car' }, d.makePreview(c.cfg, 460, 200)),
          h(
            'div',
            { class: 'chs-body' },
            h('h3', {}, c.name),
            h('p', { class: 'hint' }, c.description),
            h('div', { class: 'chs-bars' }, bar('Potência', c.cv, maxCv, `${nf(Math.round(c.cv))} cv`), bar('Torque', c.nm, maxNm, `${nf(Math.round(c.nm))} N·m`), bar('Peso', c.massKg, maxKg, `${nf(c.massKg)} kg`, true)),
            h('div', { class: 'chs-drive' }, `Tração ${c.drive}`),
            h('div', { class: 'chs-buy' }, h('span', { class: 'price' }, `${nf(c.price)} CR`), h('button', { class: 'cs-btn primary', 'data-testid': `choose-${c.id}`, onclick: () => d.onChoose(c.id) }, icon('flag'), h('span', {}, 'Comprar este carro'))),
          ),
        ),
      ),
    ),
    h('div', { class: 'evx-foot' }, secondaryButton('Voltar', 'choose-back', d.onBack, { ico: 'back' })),
  );
}
