import type { CarConfig } from '../../../data/schema';
import { h } from '../../dom';
import { badge, icon, nf, panel, sectionHeader, secondaryButton, stat } from '../design/CareerComponents';

export interface Offer {
  id: string;
  name: string;
  price: number;
  /** 'street' = classifieds of the region, 'league' = chapter 2 dealer. */
  source: 'street' | 'league';
  ok: boolean;
  reason: string | null;
  owned: boolean;
  affordable: boolean;
  cfg: CarConfig;
  cv: number;
  nm: number;
  massKg: number;
  drive: string;
  gearbox: string;
  aspiration: string;
}

export interface FleetCar {
  id: string;
  nickname: string;
  value: number;
  paid: number | null;
  parts: number;
  active: boolean;
  cfg: CarConfig | null;
}

export interface MarketDeps {
  offers: Offer[];
  fleet: FleetCar[];
  credits: number;
  leagueOpen: boolean;
  makePreview(car: CarConfig, w: number, h: number): HTMLCanvasElement;
  buy(o: Offer): void;
  sell(id: string): void;
  onBack(): void;
}

type Filter = 'all' | 'street' | 'league' | 'available' | 'owned';
const FILTERS: [Filter, string][] = [
  ['all', 'Todos'],
  ['street', 'Populares'],
  ['league', 'Liga'],
  ['available', 'Disponíveis'],
  ['owned', 'Na garagem'],
];

const buyTestId = (o: Offer): string => (o.source === 'street' ? `market-buy-${o.id}` : `dealer-buy-${o.id}`);

export function buildMarket(d: MarketDeps): HTMLElement {
  let filter: Filter = 'all';
  let selected: string | null = null;
  const grid = h('div', { class: 'mk-grid' });
  const detail = h('div', { class: 'mk-detail' });
  const chips = h('div', { class: 'mk-filters', role: 'tablist' });

  const visible = (): Offer[] =>
    d.offers.filter((o) => (filter === 'street' ? o.source === 'street' : filter === 'league' ? o.source === 'league' : filter === 'available' ? o.ok && !o.owned && o.affordable : filter === 'owned' ? o.owned : true));

  const buyButton = (o: Offer, testid: string): HTMLElement =>
    h('button', { class: 'cs-btn primary', 'data-testid': testid, disabled: !o.ok || o.owned || !o.affordable, onclick: () => d.buy(o) }, icon(o.owned ? 'check' : 'coin'), h('span', {}, o.owned ? 'Na garagem' : 'Comprar'));

  const card = (o: Offer): HTMLElement =>
    h(
      'article',
      { class: `mk-card ${o.ok ? '' : 'locked'} ${selected === o.id ? 'selected' : ''}`, 'data-testid': o.source === 'league' ? `dealer-${o.id}` : `market-card-${o.id}` },
      h('button', { class: 'mk-view', 'aria-label': `Ver detalhes de ${o.name}`, onclick: () => ((selected = o.id), render()) }, d.makePreview(o.cfg, 320, 150)),
      h(
        'div',
        { class: 'mk-info' },
        h('div', { class: 'mk-name' }, h('h3', {}, o.name), o.owned ? badge('Na garagem', 'ok', 'check') : !o.ok ? badge('Bloqueado', 'neutral', 'lock') : o.source === 'league' ? badge('Liga', 'blue') : badge('Popular', 'amber')),
        h('div', { class: 'mk-spec' }, `${nf(o.cv)} cv · ${nf(o.nm)} N·m · ${nf(o.massKg)} kg · ${o.drive}`),
        h('div', { class: 'mk-buy' }, h('span', { class: 'price' }, `${nf(o.price)} CR`), buyButton(o, buyTestId(o))),
        !o.ok && o.reason ? h('div', { class: 'hint', 'data-testid': `dealer-reason-${o.id}` }, o.reason) : null,
      ),
    );

  const renderDetail = (): void => {
    detail.replaceChildren();
    const o = d.offers.find((x) => x.id === selected);
    if (!o) {
      detail.classList.remove('open');
      return;
    }
    detail.classList.add('open');
    detail.append(
      panel(
        'mk-detail-panel',
        h('div', { class: 'mk-detail-car' }, d.makePreview(o.cfg, 760, 300)),
        h(
          'div',
          { class: 'mk-detail-info' },
          h('h2', {}, o.name),
          h('div', { class: 'mk-detail-stats' }, stat('Potência', nf(o.cv), { unit: 'cv', size: 'lg' }), stat('Torque', nf(o.nm), { unit: 'N·m', size: 'lg' }), stat('Peso', nf(o.massKg), { unit: 'kg' }), stat('Aspiração', o.aspiration), stat('Tração', o.drive), stat('Câmbio', o.gearbox)),
          o.ok ? null : h('p', { class: 'hint' }, o.reason ?? 'Indisponível.'),
          h(
            'div',
            { class: 'mk-detail-buy' },
            h('span', { class: 'price' }, `${nf(o.price)} CR`),
            buyButton(o, `market-detail-buy-${o.id}`),
            secondaryButton('Fechar', 'market-detail-close', () => ((selected = null), render())),
          ),
          !o.affordable && o.ok && !o.owned ? h('p', { class: 'hint' }, `Faltam ${nf(o.price - d.credits)} CR.`) : null,
        ),
      ),
    );
  };

  const render = (): void => {
    chips.replaceChildren(...FILTERS.filter(([f]) => f !== 'league' || d.leagueOpen).map(([f, label]) => h('button', { class: `mk-filter ${f === filter ? 'on' : ''}`, role: 'tab', 'aria-selected': String(f === filter), 'data-testid': `market-filter-${f}`, onclick: () => ((filter = f), render()) }, label)));
    const list = visible();
    grid.replaceChildren(...(list.length ? list.map(card) : [h('p', { class: 'hint' }, 'Nenhum carro neste filtro.')]));
    renderDetail();
  };
  render();

  // ------------------------------------------------------------ resale
  const resale = panel(
    'mk-resale',
    sectionHeader('Revenda'),
    h('p', { class: 'hint' }, 'Vender é definitivo: o valor entra em créditos e as peças instaladas voltam ao estoque deste modelo. O último carro da garagem não pode ser vendido.'),
    h(
      'div',
      { class: 'mk-fleet', 'data-testid': 'market-resale' },
      d.fleet.map((c) =>
        h(
          'div',
          { class: 'mk-fleet-row' },
          c.cfg ? d.makePreview(c.cfg, 150, 66) : icon('car'),
          h('div', { class: 'mk-fleet-info' }, h('b', {}, c.nickname), h('small', {}, `${c.parts} ${c.parts === 1 ? 'peça instalada' : 'peças instaladas'}${c.paid !== null ? ` · comprado por ${nf(c.paid)} CR` : ''}`)),
          h('span', { class: 'price' }, `${nf(c.value)} CR`),
          h('button', { class: 'cs-btn', 'data-testid': `market-sell-${c.id}`, disabled: d.fleet.length < 2, title: d.fleet.length < 2 ? 'O último carro não pode ser vendido' : 'Vender (pede confirmação)', onclick: () => d.sell(c.id) }, icon('coin'), h('span', {}, 'Vender')),
        ),
      ),
    ),
  );

  return h(
    'div',
    { class: 'mkx' },
    h('p', { class: 'mk-lead', 'data-reveal': '' }, 'Carros de rua à venda na região, originais. As peças compradas ficam com o carro para o qual foram compradas.'),
    chips,
    detail,
    h('section', { class: 'mk-section', 'data-testid': d.leagueOpen ? 'career-dealer' : undefined }, grid),
    resale,
    h('div', { class: 'evx-foot' }, secondaryButton('Voltar à garagem', 'market-back', d.onBack, { ico: 'back' })),
  );
}
