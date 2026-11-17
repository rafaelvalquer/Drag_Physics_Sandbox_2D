import { h } from '../../dom';
import { badge, icon, nf, progress, secondaryButton } from '../design/CareerComponents';

export type EventState = 'locked' | 'available' | 'completed' | 'final';

export interface EventCardData {
  id: string;
  order: number;
  title: string;
  state: EventState;
  rival: string;
  nickname: string;
  carName: string;
  distance: string;
  reward: number;
  portrait: HTMLElement;
}

export interface RegionData {
  id: string;
  label: string;
  blurb: string;
  events: EventCardData[];
}

export interface EventsDeps {
  regions: RegionData[];
  nextId: string | null;
  unit: string;
  done: number;
  total: number;
  onPick(id: string): void;
  onBack(): void;
}

const STATE: Record<EventState, { text: string; tone: 'neutral' | 'amber' | 'ok' | 'bad'; ico: string }> = {
  locked: { text: 'Bloqueado', tone: 'neutral', ico: 'lock' },
  available: { text: 'Disponível', tone: 'amber', ico: 'play' },
  completed: { text: 'Concluído', tone: 'ok', ico: 'check' },
  final: { text: 'Desafio final', tone: 'bad', ico: 'trophy' },
};

/** Competitive progression: one column per region, events chained on a lit line. */
export function buildEvents(d: EventsDeps): HTMLElement {
  const regions = d.regions.map((r, i) => {
    const done = r.events.filter((e) => e.state === 'completed').length;
    return h(
      'section',
      { class: `ev-region r${i % 4} ${r.id}`, 'data-reveal': '' },
      h('header', {}, h('div', {}, h('h2', {}, r.label), h('p', {}, r.blurb)), badge(`${done}/${r.events.length}`, done === r.events.length && done > 0 ? 'ok' : 'neutral', done === r.events.length && done > 0 ? 'check' : undefined)),
      h(
        'ol',
        { class: 'ev-line' },
        r.events.map((e) => {
          const st = STATE[e.state];
          const isNext = e.id === d.nextId;
          return h(
            'li',
            { class: `ev-node ${e.state} ${isNext ? 'next' : ''}` },
            h(
              'button',
              {
                class: `ev-card ${e.state}`,
                'data-testid': `event-${e.id}`,
                'data-status': e.state,
                disabled: e.state === 'locked',
                'aria-label': `${e.order}. ${e.title}, ${st.text}${isNext ? ', próximo desafio' : ''}`,
                onclick: () => d.onPick(e.id),
              },
              h('div', { class: 'ev-portrait' }, e.portrait),
              h(
                'div',
                { class: 'ev-body' },
                h('div', { class: 'ev-head' }, h('b', {}, `${e.order}. ${e.title}`), isNext ? badge('Próximo', 'amber', 'arrow') : badge(st.text, st.tone, st.ico)),
                h('small', {}, `${e.rival} "${e.nickname}" · ${e.carName}`),
                h('div', { class: 'ev-meta' }, h('span', {}, e.distance), h('span', { class: 'gold' }, `${nf(e.reward)} CR`)),
              ),
            ),
          );
        }),
      ),
    );
  });
  return h(
    'div',
    { class: 'evx' },
    h('div', { class: 'evx-summary', 'data-reveal': '' }, icon('events'), h('span', {}, `${d.done} de ${d.total} ${d.unit} concluídas`), progress((d.done / d.total) * 100)),
    h('div', { class: 'ev-regions' }, regions),
    h('div', { class: 'evx-foot' }, secondaryButton('Voltar à garagem', 'events-back', d.onBack, { ico: 'back' })),
  );
}
