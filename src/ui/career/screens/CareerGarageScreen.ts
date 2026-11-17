import type { CarConfig } from '../../../data/schema';
import { h } from '../../dom';
import { actionCard, badge, chip, icon, nf, panel, progress, sectionHeader, stat } from '../design/CareerComponents';

/** Functional group of a workshop category (installed parts are shown grouped by system). */
export const SYSTEMS = ['Motor', 'Admissão', 'Escape', 'Turbo', 'Transmissão', 'Pneus', 'Eletrônica', 'Chassi e arrefecimento'] as const;
export type SystemName = (typeof SYSTEMS)[number];

export function systemOf(category: string): SystemName {
  if (category.startsWith('intake')) return 'Admissão';
  if (category.startsWith('exhaust')) return 'Escape';
  if (category.startsWith('turbo')) return 'Turbo';
  if (category.startsWith('electronics') || category === 'ecu') return 'Eletrônica';
  if (category.startsWith('tires')) return 'Pneus';
  if (category === 'clutch' || category === 'differential' || category.startsWith('transmission')) return 'Transmissão';
  if (category.startsWith('cooling') || category.startsWith('chassis')) return 'Chassi e arrefecimento';
  return 'Motor';
}

export interface GarageStats {
  powerCv: number;
  torqueNm: number;
  massKg: number;
  aspiration: string;
  revLimit: number;
  drive: string;
  gearbox: string;
  clutch: string;
  finalDrive: string;
  grip: string;
  stock: { powerCv: number; torqueNm: number } | null;
}

export interface GarageDeps {
  car: { nickname: string; baseName: string; year: string | null };
  cfg: CarConfig;
  stats: GarageStats | null;
  buildError: string | null;
  installed: { id: string; name: string; category: string }[];
  next: { order: number; total: number; title: string; rival: string; nickname: string; distance: string; region: string; reward: number; word: string } | null;
  chapterDone: number;
  chapterTotal: number;
  others: { id: string; nickname: string; cfg: CarConfig | null }[];
  flags: { workshopOpen: boolean; chapter2: boolean; chapterComplete: boolean; canSell: boolean; sellLabel: string };
  makePreview(car: CarConfig, w: number, h: number, studio: boolean): HTMLCanvasElement;
  on: {
    events(): void;
    workshop(): void;
    dyno(): void;
    market(): void;
    history(): void;
    chapters(): void;
    ending(): void;
    menu(): void;
    sell(): void;
    pick(id: string): void;
  };
}

export function buildGarage(d: GarageDeps): HTMLElement {
  const s = d.stats;
  const stage = d.installed.length ? `${d.installed.length} ${d.installed.length === 1 ? 'peça instalada' : 'peças instaladas'}` : 'Original de fábrica';

  // ------------------------------------------------------------ showroom
  const hero = panel(
    'gx-hero',
    h('div', { class: 'gx-light', 'data-layer': '1' }),
    h(
      'div',
      { class: 'gx-title', 'data-reveal': '' },
      h('small', {}, d.car.year ? `${d.car.baseName} · ${d.car.year}` : d.car.baseName),
      h('h2', { 'data-testid': 'garage-car-name' }, d.car.nickname),
      badge(stage, d.installed.length ? 'amber' : 'neutral', d.installed.length ? 'workshop' : undefined),
    ),
    h('div', { class: 'gx-car', 'data-reveal': '' }, d.makePreview(d.cfg, 900, 380, true)),
    s
      ? h(
          'div',
          { class: 'gx-specs', 'data-reveal': '' },
          h(
            'div',
            { class: 'gx-key' },
            stat('Potência', `${nf(s.powerCv)}`, { testid: 'stat-power', size: 'lg', unit: 'cv' }),
            stat('Torque', `${nf(s.torqueNm)}`, { testid: 'stat-torque', size: 'lg', unit: 'N·m' }),
            stat('Peso', nf(s.massKg), { size: 'lg', unit: 'kg' }),
            stat('Aspiração', s.aspiration, { size: 'lg' }),
          ),
          h(
            'div',
            { class: 'gx-more' },
            stat('Limite de giro', `${nf(s.revLimit)} rpm`, { size: 'sm' }),
            stat('Tração', s.drive, { size: 'sm', testid: 'stat-drive' }),
            stat('Câmbio', s.gearbox, { size: 'sm', testid: 'stat-gearbox' }),
            stat('Capacidade', s.clutch, { size: 'sm' }),
            stat('Relação final', s.finalDrive, { size: 'sm' }),
            stat('Aderência (μ)', s.grip, { size: 'sm' }),
          ),
          s.stock && d.installed.length ? h('p', { class: 'gx-stock' }, `Original: ${nf(s.stock.powerCv)} cv / ${nf(s.stock.torqueNm)} N·m`) : null,
        )
      : h('div', { class: 'error' }, d.buildError ?? 'Build inválido'),
  );

  // ------------------------------------------------------------ preparation by system
  const groups = new Map<SystemName, string[]>();
  for (const p of d.installed) {
    const k = systemOf(p.category);
    groups.set(k, [...(groups.get(k) ?? []), p.name]);
  }
  const prep = panel(
    'gx-prep',
    sectionHeader('Preparação atual'),
    d.installed.length
      ? h(
          'div',
          { class: 'gx-systems', 'data-testid': 'garage-systems' },
          SYSTEMS.filter((k) => groups.has(k)).map((k) =>
            h(
              'button',
              { class: 'gx-system', title: d.flags.workshopOpen ? `Abrir a oficina (${k})` : k, disabled: !d.flags.workshopOpen, onclick: d.on.workshop },
              h('b', {}, k),
              h('span', {}, groups.get(k)!.map((n) => chip(n, 'amber'))),
            ),
          ),
        )
      : h('p', { class: 'hint' }, 'Original de fábrica, sem peças instaladas.'),
  );

  // ------------------------------------------------------------ next race
  const n = d.next;
  const next = panel(
    'gx-next',
    h('small', { class: 'cs-crumb' }, n ? `PRÓXIMA ${n.word.toUpperCase()}` : 'CAPÍTULO CONCLUÍDO'),
    n
      ? h(
          'div',
          { 'data-testid': 'garage-next-event', class: 'career-next' },
          h('h3', {}, `${n.order}. ${n.title}`),
          h('p', {}, `${n.rival} "${n.nickname}"`),
          h('p', { class: 'gx-meta' }, `${n.distance} · ${n.region}`),
          h('div', { class: 'gx-meta2' }, h('span', {}, `Prêmio ${nf(n.reward)} CR`), h('span', {}, `${n.order} de ${n.total}`)),
          progress((d.chapterDone / d.chapterTotal) * 100),
        )
      : h('div', { class: 'career-next' }, h('h3', {}, 'Capítulo concluído.'), progress(100)),
    actionCard('Ir para os eventos', 'Escolha a prova e encare o rival.', 'events', 'garage-events', d.on.events, { primary: true }),
  );

  // ------------------------------------------------------------ other cars
  const others = d.others.length
    ? panel(
        'gx-others',
        sectionHeader('Outros carros'),
        h(
          'div',
          { class: 'gx-fleet' },
          d.others.map((o, i) =>
            h(
              'button',
              { class: 'gx-fleet-car', 'data-testid': `garage-pick-${o.id}`, onclick: () => d.on.pick(o.id) },
              o.cfg && i < 6 ? d.makePreview(o.cfg, 150, 66, false) : icon('car'),
              h('span', {}, o.nickname),
            ),
          ),
        ),
      )
    : null;

  // ------------------------------------------------------------ actions
  const actions = h(
    'div',
    { class: 'cs-actions gx-actions', 'data-reveal': '' },
    actionCard('Oficina', 'Peças e acerto', 'workshop', 'garage-workshop', d.on.workshop, { disabled: !d.flags.workshopOpen }),
    actionCard('Dinamômetro', 'Curvas de potência', 'dyno', 'garage-dyno', d.on.dyno),
    actionCard(d.flags.chapter2 ? 'Classificados e revenda' : 'Classificados', 'Compre e venda carros', 'market', 'garage-market', d.on.market),
    actionCard('Histórico', 'Corridas registradas', 'history', 'garage-history', d.on.history),
    d.flags.chapter2 ? actionCard('Capítulos', 'Trocar de capítulo', 'chapters', 'garage-chapters', d.on.chapters) : null,
    d.flags.chapterComplete ? actionCard('Final do capítulo', 'Rever o encerramento', 'trophy', 'garage-ending', d.on.ending) : null,
    actionCard('Menu', 'Visão geral da carreira', 'overview', 'garage-menu', d.on.menu),
  );
  const sell = d.flags.canSell ? h('button', { class: 'cs-btn gx-sell', 'data-testid': 'garage-sell', onclick: d.on.sell }, icon('coin'), h('span', {}, d.flags.sellLabel)) : null;

  return h(
    'div',
    { class: 'gx', 'data-testid': 'garage-layout' },
    h('div', { class: 'gx-main' }, hero, prep),
    h('aside', { class: 'gx-side' }, next, others, actions, sell),
  );
}
