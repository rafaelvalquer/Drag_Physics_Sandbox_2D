import { h } from '../../dom';

/** Reusable DOM builders of the campaign UI. They only build elements; they never touch the save. */

const svg = (d: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

export const ICONS: Record<string, string> = {
  overview: svg('<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>'),
  garage: svg('<path d="M3 11l9-6 9 6v9h-3v-7H6v7H3z"/><path d="M8 20v-4h8v4"/>'),
  events: svg('<path d="M5 21V4M5 5h13l-2 4 2 4H5"/>'),
  workshop: svg('<path d="M14.5 4a4.5 4.5 0 00-4 6.4L3.5 17.4a1.8 1.8 0 002.6 2.6l7-7A4.5 4.5 0 0019 8.5l-2.7 2.7-2.5-.6-.6-2.5L16 5.4A4.5 4.5 0 0014.5 4z"/>'),
  dyno: svg('<path d="M4 17a8 8 0 1116 0"/><path d="M12 17l4-6M7 17h.01M17 17h.01M12 9v.01"/>'),
  market: svg('<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="16" cy="8" r="1.4"/>'),
  history: svg('<path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7L4 9"/><path d="M4 4v5h5M12 8v4l3 2"/>'),
  chapters: svg('<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/>'),
  play: svg('<path d="M7 4l13 8-13 8z"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  trophy: svg('<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 14v4M8 20h8"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  car: svg('<path d="M3 15l2-5a2 2 0 011.9-1.3h10.2A2 2 0 0119 10l2 5v3h-2.5M3 15v3h2.5M3 15h18"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/>'),
  coin: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.6-1 1.4-2.5 1.8-2.5.8-2.5 1.8 1 1.6 2.5 1.6 2.5-.5 2.5-1.5"/>'),
  flag: svg('<path d="M5 21V4M5 5h13l-2 4 2 4H5"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
};

export function icon(name: string): HTMLElement {
  return h('span', { class: 'cs-ico', html: ICONS[name] ?? '' });
}

export const nf = (v: number): string => v.toLocaleString('pt-BR');

export type Tone = 'neutral' | 'amber' | 'blue' | 'ok' | 'bad';

/** Small label; the state is always carried by text (and optionally an icon), never by colour alone. */
export function badge(text: string, tone: Tone = 'neutral', ico?: string): HTMLElement {
  return h('span', { class: `cs-badge ${tone}` }, ico ? icon(ico) : null, text);
}

/** Telemetry figure: small caption over a large monospaced value. */
export function stat(label: string, value: string, opts: { testid?: string; size?: 'lg' | 'md' | 'sm'; unit?: string } = {}): HTMLElement {
  return h(
    'div',
    { class: `cs-stat ${opts.size ?? 'md'}` },
    h('small', {}, label),
    h('b', { 'data-testid': opts.testid }, value, opts.unit ? h('i', {}, ` ${opts.unit}`) : null),
  );
}

export function progress(pct: number, label?: string, testid?: string): HTMLElement {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return h(
    'div',
    { class: 'cs-progress', 'data-testid': testid },
    h('div', { class: 'cs-bar', role: 'progressbar', 'aria-valuenow': String(p), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { 'data-percent': String(p), style: `width:${p}%` })),
    label ? h('span', {}, label) : null,
  );
}

export function sectionHeader(title: string, right?: HTMLElement | string | null): HTMLElement {
  return h('div', { class: 'cs-section-header' }, h('h2', {}, title), h('i', {}), right ?? null);
}

export function panel(cls: string, ...children: (HTMLElement | string | null)[]): HTMLElement {
  return h('section', { class: `cs-panel ${cls}` }, ...children);
}

export function primaryButton(label: string, testid: string, on: () => void, opts: { ico?: string; disabled?: boolean } = {}): HTMLElement {
  return h('button', { class: 'cs-btn primary', 'data-testid': testid, disabled: opts.disabled, onclick: on }, opts.ico ? icon(opts.ico) : null, h('span', {}, label));
}

export function secondaryButton(label: string, testid: string, on: () => void, opts: { ico?: string; disabled?: boolean } = {}): HTMLElement {
  return h('button', { class: 'cs-btn', 'data-testid': testid, disabled: opts.disabled, onclick: on }, opts.ico ? icon(opts.ico) : null, h('span', {}, label));
}

/** Large action tile (title, one-line description, icon). */
export function actionCard(title: string, desc: string | null, ico: string, testid: string, on: () => void, opts: { primary?: boolean; disabled?: boolean } = {}): HTMLElement {
  return h(
    'button',
    { class: `cs-action ${opts.primary ? 'primary' : ''}`, 'data-testid': testid, disabled: opts.disabled, onclick: on },
    icon(ico),
    h('span', { class: 'cs-txt' }, h('b', {}, title), desc ? h('small', {}, desc) : null),
  );
}

export interface EmptyStateOpts {
  title: string;
  text: string;
  ico?: string;
  cta?: { label: string; testid: string; on: () => void };
  testid?: string;
}

export function emptyState(o: EmptyStateOpts): HTMLElement {
  return h(
    'div',
    { class: 'cs-empty', 'data-testid': o.testid },
    icon(o.ico ?? 'history'),
    h('h3', {}, o.title),
    h('p', {}, o.text),
    o.cta ? primaryButton(o.cta.label, o.cta.testid, o.cta.on, { ico: 'arrow' }) : null,
  );
}

/** Compact chip list ("chips por função") used for installed systems. */
export function chip(text: string, tone: Tone = 'neutral', title?: string): HTMLElement {
  return h('span', { class: `cs-chip ${tone}`, title }, text);
}
