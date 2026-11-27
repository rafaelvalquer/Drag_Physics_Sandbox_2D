import type { InstallPlan } from '../../game/career/tuning/ProjectRequirements';
import { familyOf } from '../../game/career/tuning/BuildResolverV2';
import { progressionOf } from '../../game/career/tuning/partProgression';
import { findPart } from '../../game/career/tuning/parts';
import { h } from '../dom';
import type { WorkshopSnapshot } from './WorkshopAdapter';
import type { PartPreview } from './WorkshopPreviewModel';
import { workshopTorqueBand } from './WorkshopComparisonPanel';

export const workshopCredits = (n: number): string => `${n.toLocaleString('pt-BR')} CR`;
const number = (n: number, decimals = 0): string => n.toLocaleString('pt-BR', { maximumFractionDigits: decimals });
const metric = (name: string, value: string): HTMLElement => h('div', { class: 'ws-metric' }, h('small', {}, name), h('b', {}, value));

function stageLabel(s: WorkshopSnapshot): string {
  if (!s.installedParts.length) return 'Original';
  const family = familyOf(s.baseCar);
  const tier = s.installedParts.reduce((top, id) => {
    const part = findPart(id);
    return Math.max(top, part ? progressionOf(part, family, s.baseCar.id)?.tier ?? 0 : 0);
  }, 0);
  return tier ? `Stage ${tier}` : 'Preparado';
}

export function paintWorkshopHeader(root: HTMLElement, s: WorkshopSnapshot, turbo: boolean): void {
  root.replaceChildren(
    h('div', { class: 'uw-title' }, h('h2', {}, s.nickname), h('small', {}, s.nickname !== s.baseCar.name ? s.baseCar.name : ''),
      h('span', { class: 'uw-stage-label' }, `${stageLabel(s)} · ${turbo ? 'Turbo' : 'Aspirado'}`)),
    h('div', { class: 'uw-header-numbers' }, metric('Saldo', workshopCredits(s.credits)), ...(s.progression.mode === 'career'
      ? [metric('Capítulo', String(s.progression.chapter)), metric('Reputação', number(s.progression.reputation))]
      : [metric('RP', number(s.progression.rp)), metric('PP do veículo', number(s.progression.ppBalance))])),
  );
}

export function paintWorkshopPerformance(root: HTMLElement, p: PartPreview): void {
  if (!p.before.ok) { root.replaceChildren(); return; }
  const before = p.before;
  const after = p.after.ok && p.state !== 'original' ? p.after : before;
  const c = after.car;
  const slot = p.category;
  const rows: [string, number, number, string, number][] = [
    ['Potência', before.peakPowerCv, after.peakPowerCv, 'cv', 1],
    ['Torque', before.peakTorqueNm, after.peakTorqueNm, 'N·m', 1],
    ['Peso', before.car.massKg, c.massKg, 'kg', 0],
  ];
  if (c.engine.turbo || before.car.engine.turbo) rows.push(['Pressão máxima', before.car.engine.turbo?.maxBoostBar ?? 0, c.engine.turbo?.maxBoostBar ?? 0, 'bar', 2]);
  const labels: HTMLElement[] = [];
  if (slot.startsWith('turbo') && c.engine.turbo && before.car.engine.turbo)
    rows.push(['Enchimento', before.car.engine.turbo.spoolTimeS * 1000, c.engine.turbo.spoolTimeS * 1000, 'ms', 0]);
  if (slot.startsWith('tires')) {
    rows.push(['Aderência', before.car.tires.muPeak, c.tires.muPeak, '', 2]);
    const compound = { stock: 'Original', sport: 'Esportivo', semiSlick: 'Semi-slick', slick: 'Slick' };
    labels.push(metric('Composto', compound[c.visual.mods?.tyre ?? 'stock']));
  }
  if (['clutch', 'differential', 'gearbox', 'transmission-gearbox', 'awd'].includes(slot)) {
    rows.push(['Capacidade', before.car.transmission.clutch.maxTorqueNm, c.transmission.clutch.maxTorqueNm, 'N·m', 0],
      ['Relação final', before.car.transmission.finalDrive, c.transmission.finalDrive, '', 2]);
    if (before.car.transmission.powershift && c.transmission.powershift)
      rows.push(['Fase de torque da troca', before.car.transmission.powershift.torquePhaseS * 1000, c.transmission.powershift.torquePhaseS * 1000, 'ms', 0]);
  }
  if (slot === 'camshaft' || slot.startsWith('engine-') || slot === 'cylinder-head' || slot === 'pistons') {
    rows.push(['Corte', before.car.engine.revLimitRpm, c.engine.revLimitRpm, 'rpm', 0]);
    const [lo, hi] = workshopTorqueBand(after);
    labels.push(metric('Faixa útil', `${number(lo)}–${number(hi)} rpm`));
  }
  if ((slot.startsWith('cooling') || slot.includes('intercooler')) &&
    before.chargeTemperatureAtTargetK !== undefined && after.chargeTemperatureAtTargetK !== undefined)
    rows.push(['Temp. calculada da carga', before.chargeTemperatureAtTargetK - 273.15, after.chargeTemperatureAtTargetK - 273.15, '°C', 1]);
  root.replaceChildren(...rows.map(([name, a, b, unit, decimals]) => {
    const value = (n: number) => `${number(n, decimals)}${unit ? ` ${unit}` : ''}`;
    return metric(name, Math.round(a * 10 ** decimals) === Math.round(b * 10 ** decimals) ? value(a) : `${value(a)} → ${value(b)}`);
  }), ...labels);
}

export function showWorkshopConfirmation(title: string, lines: HTMLElement[], confirm: () => void, bundle = false): HTMLDialogElement {
  const modal = h('dialog', { class: 'uw-dialog', 'aria-label': title, 'data-testid': bundle ? 'ws-bundle-modal' : 'ws-confirm-modal' });
  const close = () => modal.close();
  modal.append(h('h3', {}, title), ...lines, h('div', { class: 'row' },
    h('button', { type: 'button', autofocus: true, 'data-testid': bundle ? 'ws-bundle-cancel' : 'ws-confirm-cancel', onclick: close }, 'Cancelar'),
    h('button', { type: 'button', class: 'primary', 'data-testid': bundle ? 'ws-bundle-confirm' : 'ws-confirm-accept',
      onclick: () => { close(); confirm(); } }, 'Confirmar')));
  modal.addEventListener('close', () => modal.remove(), { once: true });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });
  document.body.append(modal);
  modal.showModal();
  return modal;
}

export function showBundleConfirmation(plan: InstallPlan, credits: number, accept: () => void): HTMLDialogElement {
  return showWorkshopConfirmation('Instalar com requisitos', [
    h('ul', {}, ...plan.steps.map((step) => h('li', {}, step.name, ' · ', step.source === 'stock' ? 'do estoque' : workshopCredits(step.price)))),
    h('p', {}, `Total ${workshopCredits(plan.cost)} · Saldo após a instalação ${workshopCredits(credits - plan.cost)}`),
  ], accept, true);
}
