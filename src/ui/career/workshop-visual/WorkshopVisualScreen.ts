import { CHAPTERS } from '../../../game/career/chapters';
import type { CareerSave, OwnedCar } from '../../../game/career/CareerState';
import { ownedCarBuild } from '../../../game/career/RivalBuildFactory';
import { findPart, type PartDef } from '../../../game/career/tuning/parts';
import type { InstallPlan } from '../../../game/career/tuning/ProjectRequirements';
import { clear, h } from '../../dom';
import { L } from './WorkshopCopy';

const f1 = (v: number): string => v.toFixed(1).replace('.', ',');
const cr = (v: number): string => `${v.toLocaleString('pt-BR')} CR`;

/** Stage label of the build (kept from the classic workshop: it is a naming of the installed parts). */
export function stageLabel(car: OwnedCar): string {
  const equipped = car.installedParts.map((id) => findPart(id)).filter((p): p is PartDef => !!p);
  const kit = equipped.find((p) => p.category === 'turbo');
  const highestTier = equipped.reduce((top, p) => Math.max(top, p.chapter ?? 1), 1);
  return kit ? (highestTier >= 3 ? 'Stage 6 • Turbo preparado' : highestTier === 2 ? 'Stage 5 • Turbo street' : 'Stage 4 • Turbo básico')
    : equipped.length >= 5 ? 'Stage 3 • Aspirado forte' : equipped.length >= 2 ? 'Stage 2 • Aspirado street' : equipped.length ? 'Stage 1 • Rua leve' : 'Original';
}

export interface OverviewView {
  root: HTMLElement;
  update(save: CareerSave, car: OwnedCar, chapterNumber: number): void;
}

/** Identity and key numbers of the car (testid `ws-overview`). */
export function buildOverview(): OverviewView {
  const root = h('div', { class: 'ws-overview wv-overview', 'data-testid': 'ws-overview', 'data-reveal': '' });
  return {
    root,
    update(s, car, chapterNumber) {
      clear(root);
      const b = ownedCarBuild(car);
      const metric = (label: string, value: string): HTMLElement => h('div', { class: 'ws-metric' }, h('small', {}, label), h('b', {}, value));
      root.append(
        h('div', { class: 'ws-overview-identity' },
          h('span', { class: 'ws-kicker' }, 'GARAGEM / PREPARAÇÃO'),
          h('h2', {}, car.nickname),
          h('div', { class: 'ws-stage' }, stageLabel(car))),
        h('div', { class: 'ws-metrics' },
          metric('POTÊNCIA', b.ok ? `${f1(b.peakPowerCv)} cv` : '—'),
          metric('TORQUE', b.ok ? `${f1(b.peakTorqueNm)} N·m` : '—'),
          metric('ASPIRAÇÃO', b.ok && b.car.engine.induction === 'turbo' ? 'Turbo' : 'Aspirado'),
          metric('SALDO', cr(s.credits)),
          metric('REPUTAÇÃO', String(s.reputation)),
          metric('CAPÍTULO', `${String(chapterNumber).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`)),
      );
    },
  };
}

/** Confirmation of a multi-part install: lists what comes from the stock and what is bought. */
export function confirmBundle(plan: InstallPlan, save: CareerSave, onConfirm: () => void): HTMLElement {
  const close = (): void => back.remove();
  const line = (st: InstallPlan['steps'][number]): HTMLElement =>
    h('li', {}, `${st.name} — ${st.source === 'stock' ? 'do estoque (grátis)' : cr(st.price)}${st.replaces ? ` · ${findPart(st.replaces)?.name ?? st.replaces} vai para o estoque` : ''}`);
  const back: HTMLElement = h('div', { class: 'modal-backdrop', 'data-testid': 'ws-bundle-modal', onclick: (e: Event) => { if (e.target === back) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Instalar com requisitos' },
      h('h3', {}, 'Instalar com requisitos'),
      h('ul', { class: 'ws-bundle-list' }, ...plan.steps.map(line)),
      h('p', {}, `Total: ${cr(plan.cost)} · saldo ${cr(save.credits)} → ${cr(save.credits - plan.cost)}. Tudo é instalado de uma vez; se algo falhar, nada é cobrado.`),
      h('div', { class: 'row' },
        h('button', { 'data-testid': 'ws-bundle-cancel', onclick: close }, 'Cancelar'),
        h('button', { class: 'primary', 'data-testid': 'ws-bundle-confirm', onclick: () => { close(); onConfirm(); } }, 'Confirmar'))));
  document.body.append(back);
  return back;
}

/** Bottom navigation of the workshop. */
export function buildWorkshopNav(on: { dyno: () => void; restore: () => void; back: () => void }): { root: HTMLElement; setRestoreVisible(v: boolean): void } {
  const restore = h('button', { 'data-testid': 'ws-restore-all', onclick: on.restore }, L.restoreAll);
  const back = h('button', { class: 'primary', 'data-testid': 'ws-back', onclick: on.back }, L.backToGarage);
  const root = h('nav', { class: 'career-nav wv-nav' }, h('button', { 'data-testid': 'ws-dyno', onclick: on.dyno }, L.dyno), back);
  // the way back to the original only exists while something is installed
  return { root, setRestoreVisible: (v) => { if (v && !restore.isConnected) root.insertBefore(restore, back); else if (!v) restore.remove(); } };
}
