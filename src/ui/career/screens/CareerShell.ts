import { h } from '../../dom';
import { icon } from '../design/CareerComponents';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  on: () => void;
  locked?: string | null;
}

export interface ShellProps {
  screen: string;
  title: string;
  testid: string;
  chapterLabel: string;
  status: { credits: string; reputation: string; progress: string } | null;
  carName: string | null;
  nav: NavItem[] | null;
  children: (HTMLElement | string)[];
}

/** Which navigation entry stays highlighted on each screen. */
const ACTIVE: Record<string, string> = {
  menu: 'overview',
  garage: 'garage',
  events: 'events',
  rival: 'events',
  result: 'events',
  ending: 'overview',
  workshop: 'workshop',
  dyno: 'dyno',
  market: 'market',
  history: 'history',
  chapters: 'chapters',
};

export function activeNavId(screen: string): string {
  return ACTIVE[screen] ?? 'overview';
}

/** Screen frame: compact header (chapter, title, status, active car) + career navigation + body. */
export function buildShell(p: ShellProps): HTMLElement {
  const st = p.status;
  const active = activeNavId(p.screen);
  const nav = p.nav
    ? h(
        'nav',
        { class: 'cs-nav', 'aria-label': 'Navegação da carreira', 'data-testid': 'career-nav' },
        p.nav.map((n) =>
          h(
            'button',
            {
              'data-testid': `nav-${n.id}`,
              title: n.locked ?? n.label,
              disabled: !!n.locked,
              'aria-current': n.id === active ? 'page' : null,
              onclick: () => n.on(),
            },
            icon(n.locked ? 'lock' : n.icon),
            h('span', { class: 'lbl' }, n.label),
          ),
        ),
      )
    : null;
  return h(
    'div',
    { class: 'career-screen cs-shell', 'data-testid': p.testid },
    h(
      'header',
      { class: 'cs-top', 'data-reveal': '' },
      h('div', {}, h('small', { class: 'cs-crumb', 'data-testid': 'career-chapter' }, p.chapterLabel), h('h1', {}, p.title)),
      st
        ? h(
            'div',
            { class: 'cs-status' },
            h('span', { 'data-testid': 'career-credits' }, st.credits),
            h('span', { 'data-testid': 'career-reputation' }, st.reputation),
            h('span', { 'data-testid': 'career-chapter-progress' }, st.progress),
            p.carName ? h('span', { class: 'cs-carchip', title: 'Carro ativo' }, icon('car'), p.carName) : null,
          )
        : null,
    ),
    nav,
    h('div', { class: 'career-body' }, ...p.children),
  );
}
