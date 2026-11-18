import type { CarConfig } from '../../../data/schema';
import type { PortraitId } from '../../../game/career/CareerEvents';
import { h } from '../../dom';
import type { MenuViewModel } from './CareerMenuProgress';

/** Operations are delegated to CareerMode / CareerController; the menu only builds the DOM. */
export interface MenuCallbacks {
  continueCareer(): void;
  newCampaign(): void;
  garage(): void;
  chapters(): void;
  history(): void;
  freeEvents(): void;
  exportSave(): void;
  importSave(): void;
  back(): void;
}

export interface MenuDeps {
  vm: MenuViewModel;
  /** Car shown in the hero: the active car of the save, or a demonstration car without a save. */
  heroCar: CarConfig;
  callbacks: MenuCallbacks;
  makePreview(car: CarConfig, w: number, h: number): HTMLCanvasElement;
  portrait(id: PortraitId): HTMLElement;
  persistent: boolean;
}

const ICON: Record<string, string> = {
  garage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-6 9 6v9h-3v-7H6v7H3z"/><path d="M8 20v-4h8v4"/></svg>',
  chapters: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/></svg>',
  history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7L4 9"/><path d="M4 4v5h5M12 8v4l3 2"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 5h13l-2 4 2 4H5"/></svg>',
};

const icon = (name: string): HTMLElement => h('span', { class: 'cm-ico', html: ICON[name] ?? '' });
const nf = (v: number): string => v.toLocaleString('pt-BR');

function action(cls: string, testid: string, title: string, desc: string | null, ico: string, on: () => void): HTMLElement {
  return h('button', { class: cls, 'data-testid': testid, onclick: on }, icon(ico), h('span', { class: 'cm-txt' }, h('b', {}, title), desc ? h('small', {}, desc) : null));
}

/** Builds the premium main menu of the campaign. */
export function buildMainMenu(d: MenuDeps): HTMLElement {
  const { vm, callbacks: cb } = d;
  const ch = vm.chapter;
  const hasSave = vm.hasSave;
  const stat = (label: string, value: string, extra: Record<string, string> = {}): HTMLElement => h('div', { class: 'cm-stat' }, h('small', {}, label), h('b', { ...extra }, value));

  // ------------------------------------------------------------------ header
  const status = hasSave
    ? h(
        'div',
        { class: 'cm-status' },
        h('span', { class: 'cm-chip gold', 'data-testid': 'career-credits', 'data-count': String(vm.credits), 'data-fmt': 'cr' }, `${nf(vm.credits!)} CR`),
        h('span', { class: 'cm-chip', 'data-testid': 'career-reputation', 'data-count': String(vm.reputation), 'data-fmt': 'rep' }, `Reputação ${vm.reputation}`),
        h('span', { class: 'cm-chip', 'data-testid': 'career-chapter-progress' }, `${vm.progress.done}/${vm.progress.total} ${vm.progress.unit}`),
        h('span', { class: `cm-chip save ${d.persistent ? 'ok' : 'warn'}`, title: d.persistent ? 'Campanha salva neste navegador' : 'Armazenamento indisponível' }, d.persistent ? 'Campanha salva' : 'Sem salvar'),
      )
    : null;
  const header = h(
    'header',
    { class: 'cm-header', 'data-anim': 'title' },
    h(
      'div',
      { class: 'cm-title' },
      h('small', { class: 'cm-kicker' }, h('span', {}, 'CARREIRA'), ' / ', h('span', { 'data-testid': 'career-chapter' }, `Capítulo ${ch.number} · ${ch.title}`)),
      h('h1', {}, ch.title.toUpperCase()),
      h('p', { class: 'cm-tagline' }, ch.tagline),
      h('i', { class: 'cm-rule' }),
    ),
    status,
  );

  // ------------------------------------------------------------------ hero
  const car = vm.car;
  const hero = h(
    'section',
    { class: 'cm-hero', 'data-anim': 'hero', 'aria-label': 'Veículo atual' },
    h('i', { class: 'cm-spot s1', 'data-layer': '1' }),
    h('i', { class: 'cm-spot s2', 'data-layer': '2' }),
    h('i', { class: 'cm-haze' }),
    h('div', { class: 'cm-car', 'data-anim': 'car' }, d.makePreview(d.heroCar, 900, 360), h('i', { class: 'cm-sheen' })),
    car
      ? h(
          'div',
          { class: 'cm-specs', 'data-anim': 'spec' },
          h('h2', { class: 'cm-car-name', 'data-testid': 'menu-car-name' }, car.name),
          h(
            'div',
            { class: 'cm-stats' },
            stat('Potência', `${car.powerCv} cv`, { 'data-testid': 'menu-power', 'data-count': String(car.powerCv), 'data-fmt': 'cv' }),
            stat('Torque', `${car.torqueNm} N·m`, { 'data-testid': 'menu-torque', 'data-count': String(car.torqueNm), 'data-fmt': 'nm' }),
            stat('Aspiração', car.aspiration),
            stat('Tração', car.drive),
            stat('Preparação', car.stage),
          ),
        )
      : h('div', { class: 'cm-specs demo', 'data-anim': 'spec' }, h('h2', { class: 'cm-car-name' }, d.heroCar.name), h('small', { class: 'cm-demo-tag' }, 'Carro de demonstração')),
  );

  // ------------------------------------------------------------------ next challenge
  let challenge: HTMLElement;
  if (!hasSave) {
    challenge = h('section', { class: 'cm-card cm-next', 'data-anim': 'next' }, h('small', { class: 'cm-label' }, 'SUA CARREIRA'), h('h3', {}, 'Nenhuma campanha salva'), h('p', {}, 'Escolha um carro de rua e encare uma noite de cada vez até virar lenda.'));
  } else if (vm.next) {
    const n = vm.next;
    challenge = h(
      'section',
      { class: 'cm-card cm-next', 'data-anim': 'next', 'data-testid': 'menu-next-event' },
      h('small', { class: 'cm-label' }, 'PRÓXIMO DESAFIO'),
      h(
        'div',
        { class: 'cm-rival' },
        h('div', { class: 'cm-rival-portrait' }, d.portrait(n.rivalPortrait)),
        h('div', {}, h('h3', {}, n.title.toUpperCase()), h('p', { class: 'cm-rival-name' }, `${n.rivalName} "${n.rivalNickname}"`), h('p', { class: 'cm-rival-car' }, n.rivalCarName)),
      ),
      h('p', { class: 'cm-meta' }, `${n.distanceLabel} | ${n.region}`),
      h('div', { class: 'cm-meta2' }, h('span', {}, `Etapa ${String(n.order).padStart(2, '0')} de ${String(n.total).padStart(2, '0')}`), h('span', { class: 'gold' }, `Prêmio ${nf(n.rewardCr)} CR`)),
      h('div', { class: 'cm-bar', role: 'progressbar', 'aria-valuenow': String(vm.progress.percent), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { 'data-percent': String(vm.progress.percent), style: `width:${vm.progress.percent}%` })),
    );
  } else {
    challenge = h(
      'section',
      { class: 'cm-card cm-next done', 'data-anim': 'next', 'data-testid': 'menu-chapter-done' },
      h('small', { class: 'cm-label' }, ch.id === 'chapter-3' ? 'CAMPEÃO DA ELITE' : ch.id === 'chapter-2' ? 'CAMPEÃO DA LIGA' : 'CAPÍTULO CONCLUÍDO'),
      h('h3', {}, 'Capítulo concluído'),
      h('p', {}, `${vm.progress.done} de ${vm.progress.total} ${vm.progress.unit} vencidas. Continue pela garagem, pelos capítulos ou pelo histórico.`),
      h('div', { class: 'cm-bar' }, h('i', { 'data-percent': '100', style: 'width:100%' })),
    );
  }

  // ------------------------------------------------------------------ actions
  const primary = hasSave
    ? action('cm-primary', 'career-continue', 'CONTINUAR CARREIRA', null, 'play', cb.continueCareer)
    : action('cm-primary', 'career-new', 'INICIAR CAMPANHA', null, 'flag', cb.newCampaign);
  const secondary = hasSave
    ? h(
        'div',
        { class: 'cm-secondary', 'data-anim': 'secondary' },
        action('cm-card-btn', 'career-garage', 'MINHA GARAGEM', 'Prepare e personalize seu carro.', 'garage', cb.garage),
        action('cm-card-btn', 'career-free-events', 'EVENTOS LIVRES', 'Rivais diferentes a cada disputa.', 'flag', cb.freeEvents),
        vm.chapter2Open ? action('cm-card-btn', 'career-chapters', 'CAPÍTULOS', 'Explore a sua trajetória.', 'chapters', cb.chapters) : null,
        action('cm-card-btn', 'career-history', 'HISTÓRICO', 'Reviva corridas e recordes.', 'history', cb.history),
      )
    : null;
  const tbtn = (label: string, testid: string, on: () => void): HTMLElement => h('button', { class: 'cm-link', 'data-testid': testid, onclick: on }, label);
  const tertiary = h(
    'div',
    { class: 'cm-tertiary', 'data-anim': 'tertiary' },
    hasSave ? tbtn('Nova campanha', 'career-new', cb.newCampaign) : null,
    hasSave ? tbtn('Exportar save', 'career-export', cb.exportSave) : null,
    tbtn('Importar save', 'career-import', cb.importSave),
    tbtn('Voltar ao Sandbox', 'career-back', cb.back),
  );

  return h(
    'div',
    { class: `career-screen cm cm-${ch.theme} ${hasSave ? '' : 'cm-nosave'}`, 'data-testid': 'career-menu', 'data-chapter': ch.id },
    h('div', { class: 'cm-bg', 'data-anim': 'bg' }, h('i', { class: 'cm-bg-glow', 'data-layer': '1' }), h('i', { class: 'cm-bg-lines', 'data-layer': '2' })),
    header,
    h('div', { class: 'cm-grid' }, hero, h('aside', { class: 'cm-side' }, challenge, h('div', { class: 'cm-primary-wrap', 'data-anim': 'primary' }, primary), secondary, tertiary)),
  );
}
