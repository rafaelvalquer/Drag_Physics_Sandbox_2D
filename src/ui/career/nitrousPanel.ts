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

/** Nitrous settings of the Workshop: kit data, mode, flow and ramp of each stage, with a live preview. */
export function buildNitrousPanel(d: NitrousPanelDeps): HTMLElement {
  const kit = d.kit;
  const lim = nitrousLimits(kit);
  const own = (t: BuildTune): BuildTune => {
    const o: BuildTune = {};
    for (const f of NITROUS_TUNE_FIELDS) if (t[f] !== undefined) (o as Record<string, unknown>)[f] = t[f];
    return o;
  };
  const rest = (t: BuildTune): BuildTune => {
    const o: BuildTune = { ...t };
    for (const f of NITROUS_TUNE_FIELDS) delete o[f];
    return o;
  };
  let draft: BuildTune = own(d.saved);
  const savedOwn = JSON.stringify(own(d.saved));
  const values = () => nitrousTuneOf(kit, draft);

  const root = h('div', { class: 'nitro-panel', 'data-testid': 'nitro-panel' });
  const info = h(
    'div',
    { class: 'nitro-info', 'data-testid': 'nitro-info' },
    h('b', {}, `${kit.name} · nível ${kit.kit.level}`),
    h('span', {}, `Potência nominal: até +${kit.kit.maxPowerCvRef} cv · cilindro ${pt(kit.kit.capacityKg * 1000, 0)} g de N₂O · ${kit.kit.massKg} kg a mais · vazão máx. ${pt(kit.kit.maxFlowKgS * 1000, 1)} g/s`),
    h('span', {}, 'Compatível com este carro · instalado'),
  );
  const modeSel = h(
    'select',
    { 'data-testid': 'nitro-mode', 'aria-label': 'Modo de acionamento' },
    h('option', { value: 'single' }, 'Descarga única'),
    h('option', { value: 'dual' }, 'Dois estágios'),
  );
  const dirtyTag = h('span', { class: 'nitro-dirty', 'data-testid': 'nitro-dirty' });
  const preview1 = h('div', { class: 'nitro-prev', 'data-testid': 'nitro-prev-1' });
  const preview2 = h('div', { class: 'nitro-prev', 'data-testid': 'nitro-prev-2' });
  const risk = h('div', { class: 'nitro-risk', 'data-testid': 'nitro-risk' });
  const grip = h('div', { class: 'nitro-grip', 'data-testid': 'nitro-grip' });
  const msg = h('p', { class: 'nitro-msg', 'data-testid': 'nitro-msg', role: 'status' });

  const row = (label: string, id: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string): { el: HTMLElement; sync(): void } => {
    const out = h('output', { 'data-testid': `${id}-out` });
    const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), 'data-testid': id, 'aria-label': label }) as HTMLInputElement;
    const sync = (): void => {
      input.value = String(get());
      out.textContent = fmt(get());
    };
    input.addEventListener('input', () => {
      set(Number(input.value));
      out.textContent = fmt(get());
      update();
    });
    sync();
    return { el: h('label', { class: 'nitro-row' }, h('span', {}, label), input, out), sync };
  };
  const flow1 = row('Vazão do estágio 1', 'nitro-flow1', lim.flowMin, lim.flowMax, 0.05, () => values().flow1, (v) => (draft = { ...draft, nitrousFlow1: v }), (v) => `${Math.round(v * 100)} %`);
  const ramp1 = row('Entrada progressiva do estágio 1', 'nitro-ramp1', 0, lim.rampMax, 0.1, () => values().ramp1, (v) => (draft = { ...draft, nitrousRamp1: v }), (v) => `${pt(v)} s`);
  const share = row('Divisão da carga (estágio 1)', 'nitro-share', lim.shareMin, lim.shareMax, NITROUS_SHARE_STEP, () => values().share, (v) => (draft = { ...draft, nitrousShare: v }), (v) => `${Math.round(v * 100)} / ${Math.round((1 - v) * 100)}`);
  const flow2 = row('Vazão do estágio 2', 'nitro-flow2', lim.flowMin, lim.flowMax, 0.05, () => values().flow2, (v) => (draft = { ...draft, nitrousFlow2: v }), (v) => `${Math.round(v * 100)} %`);
  const ramp2 = row('Entrada progressiva do estágio 2', 'nitro-ramp2', 0, lim.rampMax, 0.1, () => values().ramp2, (v) => (draft = { ...draft, nitrousRamp2: v }), (v) => `${pt(v)} s`);
  const dualOnly = [share.el, flow2.el, ramp2.el, preview2];

  const resolved = (): { car: CarConfig; setup: NitrousSetup } | string => {
    const r = d.resolve({ ...rest(d.saved), ...draft });
    if (!r.ok) return r.errors.join('; ');
    if (!r.car.nitrous) return 'o kit não está instalado';
    return { car: r.car, setup: r.car.nitrous };
  };

  const stageText = (setup: NitrousSetup, stage: 1 | 2, rpm: number): string => {
    const p = nitrousStagePreview(setup, stage, rpm);
    return `Estágio ${stage}: +${pt(p.powerCv, 0)} cv · +${pt(p.torqueNm, 0)} N·m a ${Math.round(rpm).toLocaleString('pt-BR')} rpm · ${pt(p.durationS)} s · ${Math.round((p.reserveKg / setup.capacityKg) * 100)} % do cilindro`;
  };

  function update(): void {
    const dual = values().mode === 'dual';
    for (const el of dualOnly) el.style.display = dual ? '' : 'none';
    modeSel.value = values().mode;
    const dirty = JSON.stringify(own(draft)) !== savedOwn;
    dirtyTag.textContent = dirty ? 'Alterações não salvas' : 'Salvo';
    dirtyTag.classList.toggle('on', dirty);
    const res = resolved();
    if (typeof res === 'string') {
      preview1.textContent = res;
      preview2.textContent = '';
      risk.textContent = '';
      grip.textContent = '';
      return;
    }
    const { car, setup } = res;
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
    draft = { ...draft, nitrousMode: (modeSel as HTMLSelectElement).value as 'single' | 'dual' };
    update();
  });
  const setMsg = (t: string, bad = false): void => {
    msg.textContent = t;
    msg.classList.toggle('bad', bad);
  };
  const save = h('button', { class: 'primary', 'data-testid': 'nitro-save', onclick: () => void (async () => {
    const r = await d.save({ ...rest(d.saved), ...draft });
    if (!r.ok) setMsg(r.error ?? 'não foi possível salvar', true);
    else {
      setMsg('Regulagem do nitro salva.');
      d.done();
    }
  })() }, 'Salvar regulagem');
  const restore = h('button', { 'data-testid': 'nitro-restore', onclick: () => {
    draft = {};
    for (const r of [flow1, ramp1, share, flow2, ramp2]) r.sync();
    update();
  } }, 'Restaurar padrão');
  const cancel = h('button', { 'data-testid': 'nitro-cancel', onclick: () => {
    draft = own(d.saved);
    for (const r of [flow1, ramp1, share, flow2, ramp2]) r.sync();
    update();
    setMsg('');
  } }, 'Cancelar');

  root.append(
    h('div', { class: 'nitro-title' }, 'Regulagem do nitro (N₂O)'),
    info,
    h('label', { class: 'nitro-row' }, h('span', {}, 'Modo de acionamento'), modeSel),
    flow1.el,
    ramp1.el,
    share.el,
    flow2.el,
    ramp2.el,
    preview1,
    preview2,
    risk,
    grip,
    h('p', { class: 'nitro-hint' }, 'Shift aciona o estágio seguinte. A descarga corre sozinha até acabar e o cilindro volta a 100 % a cada corrida, sem custo.'),
    dirtyTag,
    msg,
    h('div', { class: 'row' }, save, restore, cancel),
  );
  update();
  return root;
}
