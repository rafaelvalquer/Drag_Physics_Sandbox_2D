import type { CarConfig } from '../../data/schema';
import { NITROUS_SHARE_STEP } from '../../game/career/tuning/nitrousParts';
import { nitrousLimits, nitrousTuneOf } from '../../game/career/tuning/nitrousOverlay';
import type { BuildResult, BuildTune } from '../../game/career/tuning/buildCommon';
import { NITROUS_TUNE_FIELDS } from '../../game/career/tuning/buildCommon';
import type { NitrousKitPart } from '../../game/career/tuning/parts';
import { nitrousStagePreview, type NitrousSetup } from '../../physics/engine/NitrousController';
import { h } from '../dom';

export interface NitrousPanelDeps {
  kit: NitrousKitPart;
  /** The tune saved on the car (all its settings, nitrous ones included). */
  saved: BuildTune;
  /** Resolves the car with the kit and a tune (the preview reads the physical setup from it). */
  resolve(tune: BuildTune): BuildResult;
  /** Saves the whole tune (validated again by the controller). */
  save(tune: BuildTune): Promise<{ ok: boolean; error?: string }>;
  /** Called after a successful save or when the player leaves the draft. */
  done(): void;
}

export type NitrousRisk = 'safe' | 'sport' | 'aggressive' | 'critical';
export const NITROUS_RISK_LABEL: Record<NitrousRisk, string> = { safe: 'Seguro', sport: 'Esportivo', aggressive: 'Agressivo', critical: 'Crítico' };

const pt = (v: number, d = 1): string => v.toFixed(d).replace('.', ',');

/** Strain of the internals while a stage runs: engine torque + nitrous torque against what the internals carry. */
export function nitrousRisk(car: CarConfig, addNm: number): { risk: NitrousRisk; ratio: number } {
  const limit = car.nitrous?.torqueLimitNm ?? 0;
  const peak = Math.max(...car.engine.torqueCurve.torqueNm);
  const ratio = limit > 0 ? (peak + addNm) / limit : 0;
  const risk: NitrousRisk = ratio < 0.8 ? 'safe' : ratio < 1 ? 'sport' : ratio < 1.15 ? 'aggressive' : 'critical';
  return { risk, ratio };
}

/** Wheel force of 2nd gear with the nitro against the grip of the driven tyres: > 1 means wheelspin. */
export function nitrousGripRatio(car: CarConfig, addNm: number): number {
  const t = car.transmission;
  const gear = t.gearRatios[Math.min(1, t.gearRatios.length - 1)]!;
  const peak = Math.max(...car.engine.torqueCurve.torqueNm);
  const force = ((peak + addNm) * gear * t.finalDrive * t.efficiency) / car.tires.radiusM;
  const share = car.drivenAxle === 'awd' ? 0.95 : car.drivenAxle === 'rear' ? 1 - car.frontWeightFraction + 0.08 : car.frontWeightFraction;
  const grip = car.tires.muPeak * car.massKg * 9.81 * Math.min(1, share);
  return grip > 0 ? force / grip : 0;
}

export interface NitrousTabDeps {
  kit: NitrousKitPart;
  /** The draft tune of the Dyno Lab (all settings; the nitrous ones are read from it). */
  draft(): BuildTune;
  /** Writes one nitrous setting into the draft (undefined = back to the default). */
  set(field: NitrousField, value: BuildTune[NitrousField] | undefined): void;
  /** Resolves the car with the kit and a tune (the preview reads the physical setup from it). */
  resolve(tune: BuildTune): BuildResult;
  /** The draft changed: the Dyno Lab measures it again. */
  changed(): void;
}
type NitrousField = (typeof NITROUS_TUNE_FIELDS)[number];

/**
 * "Nitro" tab of the Dyno Lab: mode, flow and ramp of each stage, with a live preview of power, torque, duration, risk and
 * traction. The settings live in the Dyno Lab draft, so the A/B comparison, "Aplicar" and "Descartar" are the Dyno's own.
 */
export function buildNitrousTab(d: NitrousTabDeps): HTMLElement {
  const kit = d.kit;
  const lim = nitrousLimits(kit);
  const values = () => nitrousTuneOf(kit, d.draft());
  const root = h('div', { class: 'nitro-panel', 'data-testid': 'nitro-panel' });
  const info = h(
    'div',
    { class: 'nitro-info', 'data-testid': 'nitro-info' },
    h('b', {}, `${kit.name} · nível ${kit.kit.level}`),
    h('span', {}, `Potência nominal: até +${kit.kit.maxPowerCvRef} cv · cilindro ${pt(kit.kit.capacityKg * 1000, 0)} g de N₂O · ${kit.kit.massKg} kg a mais · vazão máx. ${pt(kit.kit.maxFlowKgS * 1000, 1)} g/s`),
  );
  const preview1 = h('div', { class: 'nitro-prev', 'data-testid': 'nitro-prev-1' });
  const preview2 = h('div', { class: 'nitro-prev', 'data-testid': 'nitro-prev-2' });
  const risk = h('div', { class: 'nitro-risk', 'data-testid': 'nitro-risk' });
  const grip = h('div', { class: 'nitro-grip', 'data-testid': 'nitro-grip' });

  const modeSel = h(
    'select',
    { 'data-testid': 'nitro-mode', 'aria-label': 'Modo de acionamento' },
    h('option', { value: 'single' }, 'Descarga única'),
    h('option', { value: 'dual' }, 'Dois estágios'),
  ) as HTMLSelectElement;
  modeSel.value = values().mode;

  const row = (label: string, id: string, field: NitrousField, min: number, max: number, step: number, get: () => number, fmt: (v: number) => string): HTMLElement => {
    const out = h('output', { 'data-testid': `${id}-out` }, fmt(get()));
    const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(get()), 'data-testid': id, 'aria-label': label }) as HTMLInputElement;
    input.addEventListener('input', () => {
      const v = Number(input.value);
      d.set(field, v as never);
      out.textContent = fmt(v);
      update();
      d.changed();
    });
    return h('label', { class: 'nitro-row' }, h('span', {}, label), input, out);
  };
  const flow1 = row('Vazão do estágio 1', 'nitro-flow1', 'nitrousFlow1', lim.flowMin, lim.flowMax, 0.05, () => values().flow1, (v) => `${Math.round(v * 100)} %`);
  const ramp1 = row('Entrada progressiva do estágio 1', 'nitro-ramp1', 'nitrousRamp1', 0, lim.rampMax, 0.1, () => values().ramp1, (v) => `${pt(v)} s`);
  const share = row('Divisão da carga (estágio 1)', 'nitro-share', 'nitrousShare', lim.shareMin, lim.shareMax, NITROUS_SHARE_STEP, () => values().share, (v) => `${Math.round(v * 100)} / ${Math.round((1 - v) * 100)} %`);
  const flow2 = row('Vazão do estágio 2', 'nitro-flow2', 'nitrousFlow2', lim.flowMin, lim.flowMax, 0.05, () => values().flow2, (v) => `${Math.round(v * 100)} %`);
  const ramp2 = row('Entrada progressiva do estágio 2', 'nitro-ramp2', 'nitrousRamp2', 0, lim.rampMax, 0.1, () => values().ramp2, (v) => `${pt(v)} s`);
  const dualOnly = [share, flow2, ramp2, preview2];

  const stageText = (setup: NitrousSetup, stage: 1 | 2, rpm: number): string => {
    const p = nitrousStagePreview(setup, stage, rpm);
    return `Estágio ${stage}: +${pt(p.powerCv, 0)} cv · +${pt(p.torqueNm, 0)} N·m a ${Math.round(rpm).toLocaleString('pt-BR')} rpm · ${pt(p.durationS)} s · ${Math.round((p.reserveKg / setup.capacityKg) * 100)} % do cilindro`;
  };

  function update(): void {
    const dual = values().mode === 'dual';
    for (const el of dualOnly) el.style.display = dual ? '' : 'none';
    const r0 = d.resolve(d.draft());
    if (!r0.ok || !r0.car.nitrous) {
      preview1.textContent = r0.ok ? 'o kit não está instalado' : r0.errors.join('; ');
      preview2.textContent = '';
      risk.textContent = '';
      grip.textContent = '';
      return;
    }
    const car = r0.car;
    const setup = car.nitrous!;
    const torqueRpm = car.engine.torqueCurve.rpm[car.engine.torqueCurve.torqueNm.indexOf(Math.max(...car.engine.torqueCurve.torqueNm))] ?? car.engine.redlineRpm * 0.6;
    const rpm = Math.max(setup.minRpm, torqueRpm);
    preview1.textContent = stageText(setup, 1, rpm);
    preview2.textContent = dual ? stageText(setup, 2, rpm) : '';
    const strongest = Math.max(nitrousStagePreview(setup, 1, rpm).torqueNm, dual ? nitrousStagePreview(setup, 2, rpm).torqueNm : 0);
    const r = nitrousRisk(car, strongest);
    risk.dataset.level = r.risk;
    risk.textContent = `Risco mecânico: ${NITROUS_RISK_LABEL[r.risk]}${r.risk === 'safe' || r.risk === 'sport' ? '' : ' — esta regulagem exige alimentação e internos mais resistentes.'}`;
    const g = nitrousGripRatio(car, strongest);
    grip.dataset.level = g < 0.9 ? 'good' : g < 1.1 ? 'limit' : 'spin';
    grip.textContent = `Tração em 2ª: ${g < 0.9 ? 'segura' : g < 1.1 ? 'no limite do pneu' : 'o pneu patina'}`;
  }

  modeSel.addEventListener('change', () => {
    d.set('nitrousMode', modeSel.value === 'dual' ? 'dual' : undefined);
    update();
    d.changed();
  });

  root.append(
    info,
    h('label', { class: 'nitro-row' }, h('span', {}, 'Modo de acionamento'), modeSel),
    flow1,
    ramp1,
    share,
    flow2,
    ramp2,
    preview1,
    preview2,
    risk,
    grip,
    h('p', { class: 'nitro-hint' }, 'Shift aciona o estágio seguinte. A descarga corre sozinha até acabar e o cilindro volta a 100 % a cada corrida, sem custo. O gráfico e os tempos acima medem este rascunho (use "Nitro no teste" para escolher o uso).'),
  );
  update();
  return root;
}
