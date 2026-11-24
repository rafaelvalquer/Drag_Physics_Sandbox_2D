import { findCampaignCar } from '../../../data/cars/campaign';
import { findCareerTrack } from '../../../data/tracks/career';
import type { BuildResult } from '../../../game/career/tuning/BuildResolver';
import { compareTorqueBands } from '../../../game/career/tuning/breathingModel';
import { factoryFuelSupply } from '../../../game/career/tuning/fuelDelivery';
import { runAccelerationTest } from '../../../game/race/accelerationTest';
import { clear, h } from '../../dom';
import { COMPARE_FRIENDLY, L } from './WorkshopCopy';
import { friendlyIssue } from './WorkshopCopy';

type Ok = Extract<BuildResult, { ok: true }>;

const fmt = (v: number, d: number): string => v.toFixed(d).replace('.', ',');
const f1 = (v: number): string => fmt(v, 1);
const f2 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : fmt(v, 2));
const f3 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : fmt(v, 3));

/** Estimated times of a build (simulated with an ideal driver; never presented as measured). */
export interface Estimate {
  t100: number | null;
  t201: number | null;
  t402: number | null;
  t1000: number | null;
}
const estimates = new Map<string, Estimate>();
export const peekEstimate = (b: BuildResult): Estimate | null => (b.ok ? estimates.get(b.key) ?? null : null);

/** Runs (once per build) the acceleration test used by the comparison. */
export function computeEstimate(b: BuildResult): Estimate | null {
  if (!b.ok) return null;
  const hit = estimates.get(b.key);
  if (hit) return hit;
  const track = findCareerTrack('avenida-norte');
  const r = runAccelerationTest(b.car, track, { speedsKmh: [100], distancesM: [201, 402, 1000], maxS: 45 });
  const e: Estimate = { t100: r.speedTimes.get(100) ?? null, t201: r.distanceTimes.get(201) ?? null, t402: r.distanceTimes.get(402) ?? null, t1000: r.distanceTimes.get(1000) ?? null };
  if (estimates.size > 200) estimates.clear();
  estimates.set(b.key, e);
  return e;
}

export type Better = 'higher' | 'lower' | 'neutral';
export interface CmpRow {
  key: string;
  label: string;
  /** Technical label (advanced list). */
  technical: string;
  before: string;
  after: string;
  kind: 'up' | 'down' | 'neutral' | null;
  /** Numeric values (null when the row is not numeric). */
  a: number | null;
  b: number | null;
  /** 'calculated' = from the physics model, 'estimate' = simulated run. */
  source: 'calculated' | 'estimate';
}

function mark(a: number | undefined, b: number | undefined, better: Better, eps: number): CmpRow['kind'] {
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b - a) <= eps) return null;
  return better === 'neutral' ? 'neutral' : (b > a) === (better === 'higher') ? 'up' : 'down';
}

function row(label: string, before: string, after: string, a?: number, b?: number, better: Better = 'higher', eps = 1e-6, source: CmpRow['source'] = 'calculated'): CmpRow {
  return { key: label, label: COMPARE_FRIENDLY[label] ?? label, technical: label, before, after, kind: mark(a, b, better, eps), a: a ?? null, b: b ?? null, source };
}

const band = (x: Ok): [number, number] => {
  const c = x.car.engine.torqueCurve;
  const peak = Math.max(...c.torqueNm);
  const r = c.rpm.filter((_, i) => c.torqueNm[i]! >= peak * 0.9);
  return [r[0]!, r[r.length - 1]!];
};

/**
 * Rows of the before/after comparison. `summary` is what the player reads first (friendly names,
 * real numbers); `advanced` keeps the technical rows of the classic workshop verbatim.
 */
export function comparisonRows(before: Ok, after: Ok, eb: Estimate | null, ea: Estimate | null): { summary: CmpRow[]; advanced: CmpRow[] } {
  const torque = (n: number): string => `${f1(n)} N·m`;
  const ms = (n: number): string => `${f1(n * 1000)} ms`;
  const rpm = (n: number): string => n.toLocaleString('pt-BR');
  const t0 = before.car.transmission;
  const t1 = after.car.transmission;
  const turbo0 = before.car.engine.turbo;
  const turbo1 = after.car.engine.turbo;
  const fuel0 = before.car.engine.fueling;
  const fuel1 = after.car.engine.fueling;
  const fuelBase = fuel0 || fuel1 ? findCampaignCar(before.car.id) : undefined;
  const originalFuelRate = fuelBase ? factoryFuelSupply(fuelBase.engine).maxFuelKgS : undefined;
  const changed = (label: string, a: number | undefined, b: number | undefined, format: (n: number) => string, better: Better): CmpRow | null =>
    a === undefined || b === undefined || Math.abs(b - a) < 1e-6 ? null : row(label, format(a), format(b), a, b, better);
  const shown = (e: Estimate | null, v: number | null | undefined): string => (!e ? '…' : v === null || v === undefined ? '—' : `${f2(v)} s`);
  const time = (label: string, k: keyof Estimate): CmpRow => row(label, shown(eb, eb?.[k]), shown(ea, ea?.[k]), eb?.[k] ?? undefined, ea?.[k] ?? undefined, 'lower', 0.005, 'estimate');
  const lo = band(before);
  const lo2 = band(after);
  const bandRows = compareTorqueBands(before.car.engine, after.car.engine)
    .filter(({ beforeNm, afterNm }) => Math.abs(afterNm - beforeNm) >= 0.1)
    .map(({ fromRpm, toRpm, beforeNm, afterNm }) => row(`Torque médio, ${rpm(fromRpm)}–${rpm(toRpm)} rpm`, torque(beforeNm), torque(afterNm), beforeNm, afterNm));
  const power = row('Potência', `${f1(before.peakPowerCv)} cv`, `${f1(after.peakPowerCv)} cv`, before.peakPowerCv, after.peakPowerCv, 'higher', 0.05);
  const nm = row('Torque', torque(before.peakTorqueNm), torque(after.peakTorqueNm), before.peakTorqueNm, after.peakTorqueNm, 'higher', 0.05);
  const mass = row('Massa', `${f1(before.car.massKg)} kg`, `${f1(after.car.massKg)} kg`, before.car.massKg, after.car.massKg, 'lower', 0.05);
  const grip = row('Aderência (μ pico)', f2(before.car.tires.muPeak), f2(after.car.tires.muPeak), before.car.tires.muPeak, after.car.tires.muPeak, 'higher', 0.005);
  const t100 = time('0–100 km/h (estimativa)', 't100');
  const t201 = time('201 m (estimativa)', 't201');
  const t402 = time('402 m (estimativa)', 't402');
  const t1000 = time('1 km (estimativa)', 't1000');
  const spool = changed('Constante de enchimento do turbo', turbo0?.spoolTimeS, turbo1?.spoolTimeS, ms, 'lower');
  const summary: CmpRow[] = [power, nm, mass, ...(spool ? [spool] : []), ...(grip.kind ? [grip] : []), t201, t402, t1000];
  const advanced: CmpRow[] = [
    power,
    nm,
    ...bandRows,
    row('Faixa útil (90 % do torque)', `${lo[0]}–${lo[1]} rpm`, `${lo2[0]}–${lo2[1]} rpm`, lo[1] - lo[0], lo2[1] - lo2[0], 'higher'),
    row(t0.powershift ? 'Capacidade do câmbio' : 'Embreagem', torque(t0.clutch.maxTorqueNm), torque(t1.clutch.maxTorqueNm), t0.clutch.maxTorqueNm, t1.clutch.maxTorqueNm),
    ...[
      changed('Capacidade dos internos', before.internalTorqueLimitNm, after.internalTorqueLimitNm, torque, 'higher'),
      changed('Taxa de compressão', before.car.engine.compressionRatio, after.car.engine.compressionRatio, (n) => `${f2(n)}:1`, 'neutral'),
      changed('Rotação de largada', t0.clutch.launchRpm, t1.clutch.launchRpm, (n) => `${n} rpm`, 'neutral'),
      spool,
      changed('Temperatura da carga na pressão-alvo', before.chargeTemperatureAtTargetK, after.chargeTemperatureAtTargetK, (n) => `${f1(n - 273.15)} °C`, 'lower'),
      changed('Pressão sem atraso por detonação', before.knockFreeBoostBar, after.knockFreeBoostBar, (n) => `${f2(n)} bar`, 'higher'),
      changed('Fase de torque da troca', t0.powershift?.torquePhaseS, t1.powershift?.torquePhaseS, ms, 'lower'),
      changed('Travamento do conversor', t0.torqueConverter?.lockup.maxTorqueNm, t1.torqueConverter?.lockup.maxTorqueNm, torque, 'higher'),
      changed('Acoplamento central AWD', before.car.awd?.centerCouplingNm, after.car.awd?.centerCouplingNm, torque, 'higher'),
      changed('Eficiência da transmissão', t0.efficiency, t1.efficiency, (n) => `${f1(n * 100)} %`, 'higher'),
      changed('Vazão de combustível', fuel0?.maxFuelKgS ?? originalFuelRate, fuel1?.maxFuelKgS ?? originalFuelRate, (n) => `${f1(n * 1000)} g/s`, 'higher'),
      changed('Corte', before.car.engine.revLimitRpm, after.car.engine.revLimitRpm, (n) => `${n} rpm`, 'neutral'),
      changed('Massa', before.car.massKg, after.car.massKg, (n) => `${f1(n)} kg`, 'lower'),
    ].filter((r): r is CmpRow => r !== null),
    grip,
    row('Relação final', f3(before.car.transmission.finalDrive), f3(after.car.transmission.finalDrive), before.car.transmission.finalDrive, after.car.transmission.finalDrive, 'neutral', 0.0005),
    t100,
    t201,
    t402,
    t1000,
  ];
  return { summary, advanced };
}

/** Pros and cons of a change, built only from the real before/after numbers (nothing is invented). */
export function prosAndCons(before: Ok, after: Ok): { pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];
  const d = (a: number, b: number): number => b - a;
  const add = (delta: number, eps: number, up: string, down: string): void => {
    if (delta > eps) pros.push(up);
    else if (delta < -eps) cons.push(down);
  };
  const dp = d(before.peakPowerCv, after.peakPowerCv);
  add(dp, 0.05, `Mais potência: +${f1(dp)} cv`, `Menos potência: ${f1(dp)} cv`);
  const dt = d(before.peakTorqueNm, after.peakTorqueNm);
  add(dt, 0.05, `Mais força do motor: +${f1(dt)} N·m`, `Menos força do motor: ${f1(dt)} N·m`);
  const dm = d(before.car.massKg, after.car.massKg);
  add(-dm, 0.05, `Mais leve: ${f1(dm)} kg`, `Mais pesado: +${f1(dm)} kg`);
  const dg = d(before.car.tires.muPeak, after.car.tires.muPeak);
  add(dg, 0.005, `Mais aderência: ${f2(before.car.tires.muPeak)} → ${f2(after.car.tires.muPeak)}`, `Menos aderência: ${f2(before.car.tires.muPeak)} → ${f2(after.car.tires.muPeak)}`);
  const s0 = before.car.engine.turbo?.spoolTimeS;
  const s1 = after.car.engine.turbo?.spoolTimeS;
  if (s0 !== undefined && s1 !== undefined) add(s0 - s1, 1e-4, 'A turbina responde mais rápido', 'A turbina demora mais para responder');
  const dc = d(before.car.transmission.clutch.maxTorqueNm, after.car.transmission.clutch.maxTorqueNm);
  add(dc, 0.5, 'Embreagem aguenta mais força', 'Embreagem aguenta menos força');
  return { pros, cons };
}

export interface ComparisonView {
  root: HTMLElement;
  render(before: BuildResult, after: BuildResult, afterLabel: string, opts?: { removing?: boolean }): void;
  dispose(): void;
}

/** The comparison block (testid `ws-compare`): friendly summary + collapsible advanced details. */
export function buildComparison(): ComparisonView {
  const host = h('div', { class: 'ws-compare wv-compare', 'data-testid': 'ws-compare' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let openAdvanced = false;
  const cell = (r: CmpRow, text: string, isAfter: boolean): HTMLElement => {
    const td = h('td', {}, text);
    if (isAfter && r.kind) {
      const m = r.kind === 'up' ? '▲' : r.kind === 'down' ? '▼' : '◆';
      const aria = r.kind === 'up' ? 'melhora' : r.kind === 'down' ? 'piora' : 'muda';
      td.append(h('span', { class: `delta delta-${r.kind}`, 'data-testid': `delta-${r.kind}`, 'aria-label': aria, title: aria }, ` ${m}`));
    }
    return td;
  };
  const table = (rows: CmpRow[], afterLabel: string, technical: boolean): HTMLElement =>
    h('table', { class: 'results wv-table' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, L.versionNow), h('th', {}, afterLabel))),
      h('tbody', {}, rows.map((r) => h('tr', { 'data-source': r.source }, h('td', {}, technical ? r.technical : r.label), cell(r, r.before, false), cell(r, r.after, true)))));
  const paint = (before: BuildResult, after: BuildResult, afterLabel: string, removing: boolean): void => {
    clear(host);
    if (!before.ok) return;
    if (!after.ok) {
      const f = after.errors.map((e) => friendlyIssue(e));
      host.append(
        h('div', { class: 'error wv-error', 'data-testid': 'ws-incompatible' },
          removing ? 'Não dá para remover esta peça: outras peças dependem dela.' : L.needsAdjust + '.',
          h('ul', {}, f.map((x) => h('li', {}, x.friendly))),
          h('details', {}, h('summary', {}, L.technical), h('p', {}, `${removing ? '' : 'Incompatível: '}${after.errors.join('; ')}`))),
      );
      return;
    }
    const eb = peekEstimate(before);
    const ea = peekEstimate(after);
    const { summary, advanced } = comparisonRows(before, after, eb, ea);
    const details = h('details', { class: 'wv-advanced', 'data-testid': 'ws-advanced', open: openAdvanced }, h('summary', {}, L.advanced), table(advanced, afterLabel, true)) as HTMLDetailsElement;
    details.addEventListener('toggle', () => {
      openAdvanced = details.open;
    });
    host.append(
      h('div', { class: 'wv-sumtable' }, table(summary, afterLabel, false)),
      details,
      h('div', { class: 'hint wv-note' }, L.estimateNote),
    );
    if (!eb || !ea)
      timer = setTimeout(() => {
        computeEstimate(before);
        computeEstimate(after);
        if (!disposed && host.isConnected) paint(before, after, afterLabel, removing);
      }, 30);
  };
  return {
    root: host,
    render(before, after, afterLabel, opts) {
      if (timer) clearTimeout(timer);
      paint(before, after, afterLabel, !!opts?.removing);
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
    },
  };
}
