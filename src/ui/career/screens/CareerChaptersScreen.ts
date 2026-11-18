import { h } from '../../dom';
import { badge, icon, progress, secondaryButton } from '../design/CareerComponents';

export interface ChapterCardData {
  id: string;
  number: number;
  title: string;
  blurb: string;
  events: number;
  done: number;
  unit: string;
  open: boolean;
  active: boolean;
  lockedReason: string;
}

export interface ChaptersDeps {
  chapters: ChapterCardData[];
  onOpen(id: string): void;
  onBack(): void;
}

/** Procedural night scenery (no external images): chapter 1 warm and industrial, chapter 2 cool and urban. */
export function chapterArt(number: number): string {
  const blue = number >= 2;
  const bg = blue ? ['#0a1626', '#142a44'] : ['#140d08', '#2a1a0d'];
  const lit = blue ? '#9fc8f0' : '#f0b867';
  const rects: string[] = [];
  let seed = number * 97;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0, x = 0; x < 400; i++) {
    const w = 16 + rnd() * 26;
    const hgt = (blue ? 50 : 30) + rnd() * (blue ? 90 : 55);
    rects.push(`<rect x="${x}" y="${150 - hgt}" width="${w}" height="${hgt}" fill="${blue ? '#08111d' : '#0c0806'}" opacity="${0.55 + (i % 3) * 0.15}"/>`);
    for (let wy = 150 - hgt + 6; wy < 146; wy += 9) if (rnd() > 0.62) rects.push(`<rect x="${x + 3 + rnd() * (w - 8)}" y="${wy}" width="3" height="3" fill="${lit}" opacity="${0.35 + rnd() * 0.5}"/>`);
    x += w + 2;
  }
  const chimney = blue ? '' : '<rect x="300" y="40" width="9" height="110" fill="#0c0806"/><rect x="298" y="36" width="13" height="6" fill="#0c0806"/>';
  const lamp = `<circle cx="${blue ? 70 : 330}" cy="46" r="38" fill="${lit}" opacity="0.14"/><circle cx="${blue ? 70 : 330}" cy="46" r="3" fill="${lit}"/>`;
  return `<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="g${number}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[1]}"/><stop offset="1" stop-color="${bg[0]}"/></linearGradient></defs><rect width="400" height="150" fill="url(#g${number})"/>${lamp}${rects.join('')}${chimney}<rect y="146" width="400" height="4" fill="${lit}" opacity="0.25"/></svg>`;
}

export function buildChapters(d: ChaptersDeps): HTMLElement {
  return h(
    'div',
    { class: 'chx' },
    h(
      'div',
      { class: 'chx-grid' },
      d.chapters.map((c) => {
        const status = !c.open ? badge('Bloqueado', 'neutral', 'lock') : c.active ? badge('Capítulo atual', 'amber', 'play') : c.done >= c.events ? badge('Concluído', 'ok', 'check') : badge(c.done ? 'Em andamento' : 'Disponível', 'blue');
        return h(
          'article',
          { class: `chx-card ${c.number >= 2 ? 'c2' : 'c1'} ${c.open ? '' : 'locked'} ${c.active ? 'active' : ''}`, 'data-testid': `chapter-${c.id}`, 'data-open': c.open ? '1' : '0', 'data-reveal': '' },
          h('div', { class: 'chx-art', html: chapterArt(c.number) }, !c.open ? h('div', { class: 'chx-lock' }, icon('lock')) : null),
          h(
            'div',
            { class: 'chx-body' },
            h('div', { class: 'chx-row' }, h('small', {}, `CAPÍTULO ${c.number}`), status),
            h('h3', {}, c.title),
            h('p', { class: 'hint' }, c.blurb),
            h('div', { class: 'chx-meta' }, badge(`${c.events} ${c.unit === 'noites' ? 'noites' : 'etapas'}`)),
            progress((c.done / c.events) * 100, `${c.done}/${c.events} ${c.unit}`),
            c.open
              ? h('button', { class: `cs-btn ${c.active ? '' : 'primary'}`, 'data-testid': `chapter-open-${c.id}`, disabled: c.active, onclick: () => d.onOpen(c.id) }, c.active ? 'Capítulo atual' : c.done ? 'Voltar a este capítulo' : 'Começar capítulo')
              : h('div', { class: 'chx-reason' }, icon('lock'), h('span', {}, c.lockedReason)),
          ),
        );
      }),
    ),
    h('div', { class: 'evx-foot' }, secondaryButton('Voltar', 'chapters-back', d.onBack, { ico: 'back' })),
  );
}
