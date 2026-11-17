import type { CarConfig } from '../../../data/schema';
import { h } from '../../dom';
import { icon, nf, panel, progress, secondaryButton, sectionHeader } from '../design/CareerComponents';

export interface DynoPointLite {
  rpm: number;
  torqueNm: number;
  powerCv: number;
}

export interface DynoDeps {
  carName: string;
  cfg: CarConfig | null;
  makePreview(car: CarConfig, w: number, h: number): HTMLCanvasElement;
  /** Chart canvas and status line created by CareerMode (the run draws on them). */
  canvas: HTMLCanvasElement;
  info: HTMLElement;
  /** Boost adjustment row, when the build allows it. */
  tuneRow: HTMLElement | null;
  turbo: boolean;
  onRun(): void;
  onBack(): void;
}

export interface DynoView {
  el: HTMLElement;
  /** Called with the points really measured so far (never interpolated). */
  live(pts: DynoPointLite[], currentRpm: number, fraction: number, done: boolean, boostBar: number | null): void;
}

/** Test-bench layout: car on the bench, main chart, measurement panel and tuning. */
export function buildDyno(d: DynoDeps): DynoView {
  const state = h('span', { class: 'dx-state', 'data-testid': 'dyno-state' }, 'Medindo…');
  const leds = h('div', { class: 'dx-leds running', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {}));
  const rpmNow = h('b', { 'data-testid': 'dyno-rpm' }, '—');
  const bar = progress(0);
  const peakP = h('b', { 'data-testid': 'dyno-peak-power' }, '—');
  const peakT = h('b', { 'data-testid': 'dyno-peak-torque' }, '—');
  const peakPr = h('small', {}, '');
  const peakTr = h('small', {}, '');
  const boost = h('b', { 'data-testid': 'dyno-boost' }, '—');
  const kv = (label: string, v: HTMLElement, sub?: HTMLElement): HTMLElement => h('div', { class: 'cs-stat lg' }, h('small', {}, label), v, sub ?? null);

  const run = h('button', { class: 'cs-btn', 'data-testid': 'dyno-run', onclick: d.onRun }, icon('dyno'), h('span', {}, 'Medir novamente'));
  const el = h(
    'div',
    { class: 'dx' },
    h(
      'div',
      { class: 'dx-top' },
      panel(
        'dx-bench',
        h('div', { class: 'dx-bench-head' }, h('small', { class: 'cs-crumb' }, 'BANCADA'), state, leds),
        d.cfg ? h('div', { class: 'dx-car' }, d.makePreview(d.cfg, 520, 220)) : null,
        h('div', { class: 'dx-rpm' }, h('small', {}, 'ROTAÇÃO DA MEDIÇÃO'), h('div', { class: 'dx-rpm-val' }, rpmNow, h('i', {}, ' rpm')), bar),
      ),
      panel('dx-chart-panel', sectionHeader(`${d.carName}`), d.canvas, h('div', { class: 'dx-legend' }, h('span', { class: 't' }, 'Torque (N·m)'), h('span', { class: 'p' }, 'Potência (cv)'))),
      panel(
        'dx-meter',
        sectionHeader('Medição'),
        h('div', { class: 'dx-meter-grid' }, kv('Potência máx.', peakP, peakPr), kv('Torque máx.', peakT, peakTr), d.turbo ? kv('Pressão máx.', boost) : null),
        d.info,
        h('div', { class: 'dx-actions' }, run, secondaryButton('Voltar à garagem', 'dyno-back', d.onBack, { ico: 'back' })),
      ),
    ),
    d.tuneRow ? panel('dx-tune', sectionHeader('Ajuste do turbo'), d.tuneRow) : null,
  );

  return {
    el,
    live(pts, currentRpm, fraction, done, boostBar) {
      rpmNow.textContent = nf(Math.round(currentRpm));
      const bar0 = bar.querySelector<HTMLElement>('.cs-bar > i');
      if (bar0) bar0.style.width = `${Math.round(fraction * 100)}%`;
      if (pts.length) {
        const t = pts.reduce((a, p) => (p.torqueNm > a.torqueNm ? p : a));
        const p = pts.reduce((a, q) => (q.powerCv > a.powerCv ? q : a));
        peakP.textContent = `${p.powerCv.toFixed(1).replace('.', ',')} cv`;
        peakPr.textContent = `a ${nf(Math.round(p.rpm))} rpm`;
        peakT.textContent = `${t.torqueNm.toFixed(1).replace('.', ',')} N·m`;
        peakTr.textContent = `a ${nf(Math.round(t.rpm))} rpm`;
      }
      if (boostBar !== null) boost.textContent = `${boostBar.toFixed(2).replace('.', ',')} bar`;
      state.textContent = done ? 'Medição concluída' : 'Medindo…';
      leds.classList.toggle('running', !done);
      leds.classList.toggle('done', done);
    },
  };
}
