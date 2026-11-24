import type { CarConfig } from '../../../data/schema';
import type { BuildResult, BuildTune, FinalDrivePreset, ThrottlePreset, TuneField } from '../../../game/career/tuning/buildCommon';
import type { LabMeasurement } from '../../../game/career/tuning/dynoLab';
import { RELIABILITY_LABEL, type ReliabilityLevel } from '../../../game/career/tuning/EngineReliability';
import type { PresetControl, RangeControl, TuningCapabilities } from '../../../game/career/tuning/TuningCapabilities';
import { drawLineChart, drawMessage, type Series } from '../../charts';
import { h } from '../../dom';
import type { NitrousKitPart } from '../../../game/career/tuning/parts';
import { buildNitrousTab } from '../nitrousPanel';
import { DynoTuningController } from '../dyno/DynoTuningController';
import { icon, nf, panel, primaryButton, progress, secondaryButton, sectionHeader } from '../design/CareerComponents';

/**
 * Dyno Lab 3.0: the car on the bench, the measured curves of the SAVED settings (A, solid) and of
 * the DRAFT (B, dashed) with the recommended / risk bands and the cut, the real figures of both
 * (0–100, 201 m, 402 m, settled top speed, wheelspin) and the settings in three tabs. Editing never
 * rebuilds the screen and never writes the save: "Aplicar" writes the draft (validated again by the
 * controller), "Descartar" goes back to the saved settings.
 */
export interface DynoLabDeps {
  carName: string;
  cfg: CarConfig | null;
  makePreview(car: CarConfig, w: number, h: number): HTMLCanvasElement;
  caps: TuningCapabilities;
  saved: BuildTune;
  turbo: boolean;
  /** The installed N₂O kit (adds the Nitro tab) and the resolver the tab reads the physical setup from. */
  nitro?: { kit: NitrousKitPart; resolve(tune: BuildTune): BuildResult };
  measure(tune: BuildTune, isStale: () => boolean, progress: (f: number) => void): Promise<LabMeasurement | { error: string } | null>;
  reliabilityOf(tune: BuildTune): ReliabilityLevel;
  apply(tune: BuildTune): Promise<{ ok: true; notice?: string } | { ok: false; error: string }>;
  onBack(): void;
  /** Debounce of the draft measurement (ms). */
  debounceMs?: number;
}

export interface DynoLabView {
  el: HTMLElement;
  controller: DynoTuningController<LabMeasurement | { error: string }>;
  dispose(): void;
}

type Result = LabMeasurement | { error: string };
const isErr = (r: Result | null): r is { error: string } => !!r && 'error' in r;

const f1 = (v: number): string => v.toFixed(1).replace('.', ',');
const f2 = (v: number): string => v.toFixed(2).replace('.', ',');
const f3 = (v: number | null): string => (v === null ? '—' : `${v.toFixed(2).replace('.', ',')} s`);

/** Chart markers of the recommended upshifts: gears sharing a speed get one label ("1-2/2-3"). */
function uniqueShifts(rpms: readonly number[], cut: number): { rpm: number; label: string }[] {
  const out: { rpm: number; label: string }[] = [];
  rpms.forEach((r, i) => {
    if (r >= cut - 25) return; // at the cut: the cut marker already says it
    const same = out.find((o) => Math.abs(o.rpm - r) < 60);
    const g = `${i + 1}-${i + 2}`;
    if (same) same.label += `/${g}`;
    else out.push({ rpm: r, label: `troca ${g}` });
  });
  return out;
}

const LEVEL_SYMBOL: Record<ReliabilityLevel, string> = { safe: '●', sport: '▲', aggressive: '▲▲', critical: '⚠' };

type Tab = 'motor' | 'arrancada' | 'transmissao' | 'nitro';

export function buildDynoLab(d: DynoLabDeps): DynoLabView {
  const caps = d.caps;
  const lim = caps.limits;
  let a: LabMeasurement | null = null;
  let b: LabMeasurement | null = null;
  let tab: Tab = 'motor';

  // ---------- bench / chart / meter ----------
  const state = h('span', { class: 'dx-state', 'data-testid': 'dyno-state' }, 'Medindo…');
  const leds = h('div', { class: 'dx-leds running', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {}));
  const rpmNow = h('b', { 'data-testid': 'dyno-rpm' }, '—');
  const bar = progress(0);
  const canvas = h('canvas', { class: 'career-dyno-chart', 'data-testid': 'career-dyno-chart' }) as HTMLCanvasElement;
  const info = h('div', { class: 'hint', 'data-testid': 'career-dyno-info', 'aria-live': 'polite' }, 'Medindo no dinamômetro…');
  const peakP = h('b', { 'data-testid': 'dyno-peak-power' }, '—');
  const peakT = h('b', { 'data-testid': 'dyno-peak-torque' }, '—');
  const peakPr = h('small', {}, '');
  const peakTr = h('small', {}, '');
  const boost = h('b', { 'data-testid': 'dyno-boost' }, '—');
  const kv = (label: string, v: HTMLElement, sub?: HTMLElement): HTMLElement => h('div', { class: 'cs-stat lg' }, h('small', {}, label), v, sub ?? null);

  const metricDefs: { id: string; label: string; get(m: LabMeasurement): number | null; fmt(v: number | null): string; better: 'low' | 'high' }[] = [
    { id: 't100', label: '0–100 km/h', get: (m) => m.t100, fmt: f3, better: 'low' },
    { id: 't201', label: '201 m', get: (m) => m.t201, fmt: f3, better: 'low' },
    { id: 't402', label: '402 m', get: (m) => m.t402, fmt: f3, better: 'low' },
    { id: 'vmax', label: 'Maior velocidade no teste', get: (m) => m.vmaxKmh, fmt: (v) => (v === null ? '—' : `${f1(v)} km/h`), better: 'high' },
    { id: 'spin', label: 'Patinação', get: (m) => m.wheelspinS, fmt: (v) => (v === null ? '—' : `${f2(v)} s`), better: 'low' },
  ];
  const metricCells = metricDefs.map((m) => ({
    def: m,
    a: h('span', { class: 'dx-m-a', 'data-testid': `dyno-metric-${m.id}-a` }, '—'),
    b: h('span', { class: 'dx-m-b', 'data-testid': `dyno-metric-${m.id}` }, '—'),
    delta: h('span', { class: 'dx-m-d', 'data-testid': `dyno-metric-${m.id}-delta` }, ''),
  }));
  const metrics = h(
    'div',
    { class: 'dx-metrics', role: 'table', 'aria-label': 'Indicadores medidos' },
    h('div', { class: 'dx-m-row head', role: 'row' }, h('span', {}, ''), h('span', {}, 'A · salvo'), h('span', {}, 'B · rascunho'), h('span', {}, '')),
    metricCells.map((c) => h('div', { class: 'dx-m-row', role: 'row' }, h('span', { class: 'dx-m-l' }, c.def.label), c.a, c.b, c.delta)),
  );

  const run = h('button', { class: 'cs-btn', 'data-testid': 'dyno-run', onclick: () => remeasure() }, icon('dyno'), h('span', {}, 'Medir novamente'));

  // ---------- controls ----------
  const applyBtn = primaryButton('Aplicar', 'dyno-apply', () => void apply(), { ico: 'check', disabled: true });
  const discardBtn = secondaryButton('Descartar', 'dyno-discard', () => discard(), { ico: 'back', disabled: true });
  const dirtyTag = h('span', { class: 'dx-dirty', 'data-testid': 'dyno-dirty' }, 'Sem alterações');
  const relBadge = h('span', { class: 'dx-rel-badge', 'data-testid': 'dyno-reliability', 'data-level': 'safe' }, '');
  const relDetail = h('div', { class: 'dx-rel-detail' });
  const relGauge = h('div', { class: 'dx-rel-gauge', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {}), h('i', {}));
  const tabBody = h('div', { class: 'dx-tab-body', role: 'tabpanel' });
  const tabs: Record<Tab, HTMLElement> = {
    motor: h('button', { class: 'dx-tab', role: 'tab', 'data-testid': 'dyno-tab-motor', onclick: () => selectTab('motor') }, 'Motor'),
    arrancada: h('button', { class: 'dx-tab', role: 'tab', 'data-testid': 'dyno-tab-arrancada', onclick: () => selectTab('arrancada') }, 'Arrancada'),
    transmissao: h('button', { class: 'dx-tab', role: 'tab', 'data-testid': 'dyno-tab-transmissao', onclick: () => selectTab('transmissao') }, 'Transmissão'),
    nitro: h('button', { class: 'dx-tab', role: 'tab', 'data-testid': 'dyno-tab-nitro', onclick: () => selectTab('nitro') }, 'Nitro'),
  };

  const ctl = new DynoTuningController<Result>({
    saved: d.saved,
    debounceMs: d.debounceMs ?? 350,
    compute: (tune, stale) =>
      d.measure(tune, stale, (f) => {
        const i = bar.querySelector<HTMLElement>('.cs-bar > i');
        if (i) i.style.width = `${Math.round(f * 100)}%`;
      }),
    onBusy: (busy) => {
      state.textContent = busy ? 'Medindo…' : 'Medição concluída';
      leds.classList.toggle('running', busy);
      leds.classList.toggle('done', !busy);
      if (busy) info.removeAttribute('data-done');
    },
    onResult: (r, _tune, which) => {
      if (isErr(r)) {
        if (which === 'saved') a = null;
        b = null;
        drawMessage(canvas, r.error);
        info.textContent = r.error;
        info.dataset.done = '1';
        state.textContent = 'Medição concluída';
        render();
        return;
      }
      if (which === 'saved') {
        a = r;
        if (!ctl.dirty) b = r;
      } else b = r;
      state.textContent = 'Medição concluída';
      leds.classList.remove('running');
      leds.classList.add('done');
      const m = ctl.dirty ? b! : a!;
      info.textContent = `Medido: ${f1(m.peakNm)} N·m a ${nf(Math.round(m.peakNmRpm))} rpm · ${f1(m.peakCv)} cv a ${nf(Math.round(m.peakCvRpm))} rpm${m.boostMaxBar !== null ? ` · pressão máx. ${f2(m.boostMaxBar)} bar` : ''}`;
      info.dataset.done = '1';
      render();
    },
  });

  function rangeControl(field: TuneField, label: string, c: RangeControl, fmt: (v: number) => string, hint: string): HTMLElement {
    const cur = (ctl.draft[field] as number | undefined) ?? c.default;
    const out = h('output', { class: 'dx-ctl-val', 'data-testid': `dyno-val-${field}` }, fmt(cur));
    if (!c.enabled)
      return h(
        'div',
        { class: 'dx-ctl locked', 'data-field': field },
        h('div', { class: 'dx-ctl-head' }, h('span', { class: 'dx-ctl-l' }, label), h('span', { class: 'dx-lock' }, icon('lock'), 'Bloqueado')),
        h('p', { class: 'dx-reason', 'data-testid': `dyno-reason-${field}` }, c.reason ?? ''),
      );
    const input = h('input', {
      type: 'range',
      min: String(c.min),
      max: String(c.max),
      step: String(c.step),
      value: String(cur),
      'aria-label': label,
      'data-testid': field === 'boostBar' ? 'career-boost' : `dyno-ctl-${field}`,
      oninput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        out.textContent = fmt(v);
        ctl.set(field, (Math.abs(v - c.default) < c.step / 2 ? undefined : v) as never);
        render();
      },
    }) as HTMLInputElement;
    const reset = h(
      'button',
      {
        class: 'dx-reset',
        type: 'button',
        'data-testid': `dyno-reset-${field}`,
        title: 'Voltar ao padrão do hardware',
        onclick: () => {
          input.value = String(c.default);
          out.textContent = fmt(c.default);
          ctl.set(field, undefined as never);
          render();
        },
      },
      'padrão',
    );
    return h(
      'div',
      { class: 'dx-ctl', 'data-field': field },
      h('div', { class: 'dx-ctl-head' }, h('span', { class: 'dx-ctl-l' }, label), out, reset),
      input,
      h('div', { class: 'dx-ctl-scale' }, h('span', {}, fmt(c.min)), h('span', {}, `padrão ${fmt(c.default)}`), h('span', {}, fmt(c.max))),
      h('p', { class: 'dx-hint' }, hint),
    );
  }

  function presetControl<T extends string>(field: TuneField, label: string, c: PresetControl<T>, hint: string): HTMLElement {
    if (!c.enabled)
      return h(
        'div',
        { class: 'dx-ctl locked', 'data-field': field },
        h('div', { class: 'dx-ctl-head' }, h('span', { class: 'dx-ctl-l' }, label), h('span', { class: 'dx-lock' }, icon('lock'), 'Bloqueado')),
        h('p', { class: 'dx-reason', 'data-testid': `dyno-reason-${field}` }, c.reason ?? ''),
      );
    const cur = (ctl.draft[field] as T | undefined) ?? c.default;
    const seg = h('div', { class: 'dx-seg', role: 'group', 'aria-label': label });
    for (const o of c.options) {
      seg.append(
        h(
          'button',
          {
            type: 'button',
            class: `dx-seg-b${o.value === cur ? ' on' : ''}`,
            'aria-pressed': o.value === cur ? 'true' : 'false',
            'data-testid': `dyno-ctl-${field}-${o.value}`,
            onclick: () => {
              ctl.set(field, (o.value === c.default ? undefined : o.value) as never);
              for (const btn of Array.from(seg.children) as HTMLElement[]) {
                const on = btn.dataset.testid === `dyno-ctl-${field}-${o.value}`;
                btn.classList.toggle('on', on);
                btn.setAttribute('aria-pressed', on ? 'true' : 'false');
              }
              render();
            },
          },
          o.label,
        ),
      );
    }
    return h('div', { class: 'dx-ctl', 'data-field': field }, h('div', { class: 'dx-ctl-head' }, h('span', { class: 'dx-ctl-l' }, label)), seg, h('p', { class: 'dx-hint' }, hint));
  }

  const rpm = (v: number): string => `${nf(Math.round(v))} rpm`;
  function fillTab(): void {
    tabBody.replaceChildren();
    for (const [k, el] of Object.entries(tabs)) {
      el.classList.toggle('on', k === tab);
      el.setAttribute('aria-selected', k === tab ? 'true' : 'false');
    }
    if (tab === 'motor') {
      tabBody.append(
        rangeControl('boostBar', 'Pressão do turbo', caps.boost, (v) => `${f2(v)} bar`, 'Alvo da wastegate / ECU. Mais pressão = mais carga nas peças acima do giro recomendado.'),
        rangeControl('revLimitRpm', 'Corte de giro', caps.revLimit, rpm, 'Onde a ECU corta a ignição. Não aumenta a resistência do motor: acima da rotação recomendada o esforço acumula.'),
        presetControl<ThrottlePreset>('throttleResponse', 'Resposta do acelerador', caps.throttle, 'Tempo do atuador e progressão do pedal (mapa da borboleta).'),
      );
    } else if (tab === 'arrancada') {
      tabBody.append(
        rangeControl('launchRpm', 'Rotação de largada', caps.launch, rpm, 'Rotação em que a embreagem morde na largada. Alta demais patina; baixa demais afoga.'),
        rangeControl('tirePressureKpa', 'Pressão dos pneus', caps.tirePressure, (v) => `${Math.round(v)} kPa`, 'Pressão baixa: mais área de contato e aderência, mais resistência ao rolamento.'),
      );
    } else if (tab === 'nitro' && d.nitro) {
      const nz = d.nitro;
      tabBody.append(
        buildNitrousTab({
          kit: nz.kit,
          draft: () => ctl.draft,
          set: (field, value) => ctl.set(field, value as never),
          resolve: nz.resolve,
          changed: () => render(),
        }),
      );
    } else {
      tabBody.append(
        presetControl<FinalDrivePreset>('finalDrive', 'Relação final', caps.finalDrive, 'Coroa e pinhão do diferencial preparado: curta acelera mais, longa chega mais longe.'),
        rangeControl('shiftRpm', 'Ponto de troca (D)', caps.shift, rpm, 'Rotação de troca em aceleração total na estratégia do câmbio automático.'),
      );
    }
  }
  function selectTab(t: Tab): void {
    tab = t;
    fillTab();
  }

  // ---------- rendering ----------
  function draw(): void {
    if (!a && !b) return;
    const series: Series[] = [];
    const showB = ctl.dirty && b && b !== a;
    if (a) {
      series.push({ label: 'A torque N·m', color: '#f2b705', x: a.points.map((p) => p.rpm), y: a.points.map((p) => p.torqueNm) });
      series.push({ label: 'A potência cv', color: '#2bb3ff', x: a.points.map((p) => p.rpm), y: a.points.map((p) => p.powerCv), right: true });
    }
    if (showB) {
      series.push({ label: 'B torque', color: '#ffd76a', x: b!.points.map((p) => p.rpm), y: b!.points.map((p) => p.torqueNm), dashed: true });
      series.push({ label: 'B potência', color: '#8fd8ff', x: b!.points.map((p) => p.rpm), y: b!.points.map((p) => p.powerCv), right: true, dashed: true });
    }
    const cut = ctl.draft.revLimitRpm ?? caps.revLimit.default;
    const xMax = Math.max(cut, lim?.maxSafeRpm ?? cut) + 300;
    drawLineChart(canvas, series, {
      xLabel: 'rpm',
      title: d.carName,
      xMin: 1000,
      xMax,
      yMin: 0,
      bands: lim
        ? [
            { from: 1000, to: lim.recommendedSafeRpm, color: 'rgba(90, 203, 147, 0.07)', label: 'recomendada' },
            { from: lim.recommendedSafeRpm, to: lim.maxSafeRpm, color: 'rgba(255, 138, 61, 0.16)', label: 'risco' },
            { from: lim.maxSafeRpm, to: xMax, color: 'rgba(217, 90, 94, 0.22)' },
          ]
        : [],
      markers: [
        { x: cut, color: '#ff5a5f', label: `corte ${nf(cut)}`, dashed: true },
        // recommended upshift points of the measured build (B while editing, else A)
        ...uniqueShifts(((ctl.dirty ? b : a) ?? null)?.shiftRpms ?? [], cut).map((s) => ({ x: s.rpm, color: '#8fd8ff', label: s.label, dashed: true })),
      ],
    });
  }

  function render(): void {
    const dirty = ctl.dirty;
    (applyBtn as HTMLButtonElement).disabled = !dirty;
    (discardBtn as HTMLButtonElement).disabled = !dirty;
    dirtyTag.textContent = dirty ? 'Rascunho com alterações (não salvo)' : 'Sem alterações';
    dirtyTag.classList.toggle('on', dirty);
    const cur = dirty ? b : a;
    if (cur) {
      peakP.textContent = `${f1(cur.peakCv)} cv`;
      peakPr.textContent = `a ${nf(Math.round(cur.peakCvRpm))} rpm`;
      peakT.textContent = `${f1(cur.peakNm)} N·m`;
      peakTr.textContent = `a ${nf(Math.round(cur.peakNmRpm))} rpm`;
      if (cur.boostMaxBar !== null) boost.textContent = `${f2(cur.boostMaxBar)} bar`;
      rpmNow.textContent = nf(Math.round(cur.revLimitRpm));
    }
    for (const c of metricCells) {
      const va = a ? c.def.get(a) : null;
      const vb = cur ? c.def.get(cur) : null;
      c.a.textContent = c.def.fmt(va);
      c.b.textContent = c.def.fmt(vb);
      c.delta.textContent = '';
      c.delta.className = 'dx-m-d';
      if (dirty && va !== null && vb !== null && Math.abs(vb - va) > 1e-3) {
        const better = c.def.better === 'low' ? vb < va : vb > va;
        c.delta.textContent = `${vb > va ? '▲' : '▼'} ${c.def.id === 'vmax' ? f1(Math.abs(vb - va)) : f2(Math.abs(vb - va))}`;
        c.delta.classList.add(better ? 'up' : 'down');
        c.delta.setAttribute('aria-label', better ? 'melhor' : 'pior');
      }
    }
    // reliability of the draft
    const lvl = d.reliabilityOf(ctl.draft);
    relBadge.dataset.level = lvl;
    relBadge.textContent = `${LEVEL_SYMBOL[lvl]} ${RELIABILITY_LABEL[lvl]}`;
    relGauge.dataset.level = lvl;
    const cut = ctl.draft.revLimitRpm ?? caps.revLimit.default;
    const shifts = (cur && !isErr(cur) ? cur.shiftRpms : []) ?? [];
    relDetail.replaceChildren(
      ...(lim
        ? [
            h('div', {}, h('small', {}, 'Corte original'), h('b', { 'data-testid': 'dyno-orig-rpm' }, rpm(caps.revLimit.default))),
            h('div', {}, h('small', {}, 'Corte configurado'), h('b', { 'data-testid': 'dyno-cut-rpm' }, rpm(cut))),
            h('div', {}, h('small', {}, 'Rotação recomendada'), h('b', { 'data-testid': 'dyno-rec-rpm' }, rpm(lim.recommendedSafeRpm))),
            h('div', {}, h('small', {}, 'Limite mecânico'), h('b', { 'data-testid': 'dyno-max-rpm' }, rpm(lim.maxSafeRpm))),
            ...(lvl !== 'safe'
              ? [h('p', { class: 'dx-rel-warn', 'data-testid': 'dyno-rel-warning', role: 'note' }, 'Este ajuste permite rotações acima da faixa recomendada. Sustentar o motor nessa região durante a corrida aumenta o risco de quebra.')]
              : []),
            ...(shifts.length
              ? [h('p', { class: 'dx-rel-note', 'data-testid': 'dyno-shift-points' }, `Troca recomendada: ${shifts.map((s, i) => `${i + 1}ª→${i + 2}ª ${nf(s)}`).join(' · ')} rpm.`)]
              : []),
            h('p', { class: 'dx-rel-note' }, `${lim.label}. ${lim.estimated ? 'Limites estimados para este motor (sem dado de fábrica de falha).' : ''}`),
          ]
        : [h('p', {}, 'Build inválido.')]),
    );
    draw();
  }

  async function apply(): Promise<void> {
    const tune = { ...ctl.draft };
    (applyBtn as HTMLButtonElement).disabled = true;
    const r = await d.apply(tune);
    if (!r.ok) {
      info.textContent = `Não aplicado: ${r.error}`;
      (applyBtn as HTMLButtonElement).disabled = false;
      return;
    }
    ctl.commit(tune);
    if (b) a = b;
    info.textContent = r.notice ?? 'Ajustes aplicados: o carro corre com esta configuração.';
    render();
  }

  function discard(): void {
    ctl.discard();
    b = a;
    fillTab();
    render();
  }

  function remeasure(): void {
    a = null;
    b = null;
    void ctl.measureSaved();
  }

  const el = h(
    'div',
    { class: 'dx dx3' },
    h(
      'div',
      { class: 'dx-top' },
      panel(
        'dx-bench',
        h('div', { class: 'dx-bench-head' }, h('small', { class: 'cs-crumb' }, 'BANCADA'), state, leds),
        d.cfg ? h('div', { class: 'dx-car' }, d.makePreview(d.cfg, 520, 220)) : null,
        h('div', { class: 'dx-rpm' }, h('small', {}, 'CORTE MEDIDO'), h('div', { class: 'dx-rpm-val' }, rpmNow, h('i', {}, ' rpm')), bar),
      ),
      panel(
        'dx-chart-panel',
        sectionHeader(d.carName),
        canvas,
        h('div', { class: 'dx-legend' }, h('span', { class: 't' }, 'Torque (N·m)'), h('span', { class: 'p' }, 'Potência (cv)'), h('span', { class: 'ab' }, 'A salvo · B rascunho (tracejado)')),
      ),
      panel(
        'dx-meter',
        sectionHeader('Medição'),
        h('div', { class: 'dx-meter-grid' }, kv('Potência máx.', peakP, peakPr), kv('Torque máx.', peakT, peakTr), d.turbo ? kv('Pressão máx.', boost) : null),
        metrics,
        info,
        h('div', { class: 'dx-actions' }, run, secondaryButton('Voltar à garagem', 'dyno-back', d.onBack, { ico: 'back' })),
      ),
    ),
    h(
      'div',
      { class: 'dx-lab' },
      panel('dx-tune', sectionHeader('Ajustes do Dyno Lab', dirtyTag), h('div', { class: 'dx-tabs', role: 'tablist' }, tabs.motor, tabs.arrancada, tabs.transmissao, ...(d.nitro ? [tabs.nitro] : [])), tabBody, h('div', { class: 'dx-apply' }, applyBtn, discardBtn)),
      panel('dx-rel', sectionHeader('CONFIABILIDADE DA PREPARAÇÃO'), h('div', { class: 'dx-rel-head' }, relBadge, relGauge), relDetail),
    ),
  );
  fillTab();
  render();
  setTimeout(() => void ctl.measureSaved(), 20);
  return { el, controller: ctl, dispose: () => ctl.dispose() };
}
