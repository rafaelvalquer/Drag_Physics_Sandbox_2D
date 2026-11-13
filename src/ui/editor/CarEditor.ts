import { cloneCar } from '../../data/cars/index';
import { firingAngles } from '../../data/engines/builders';
import { exhaustPreset, type ExhaustPresetId } from '../../data/exhaustPresets';
import { validateCar, type Architecture, type CarConfig, type TrackConfig } from '../../data/schema';
import type { VehicleSimulation } from '../../physics/vehicle/VehicleSimulation';
import { clear, downloadText, h, pickTextFile, toast } from '../dom';
import { FIELD_GROUPS, getPath, setPath, type FieldDef } from './carFields';

export interface CarEditorOptions {
  /**
   * Called with a validated configuration. `physicsChanged` is false when only acoustic fields
   * (exhaust geometry, channel gains) changed, so the caller can update the sound without
   * restarting the run.
   */
  onApply(car: CarConfig, physicsChanged: boolean): void;
  /** Factory configuration for a car id ("Restaurar padrão"), or null for custom cars. */
  defaults?(id: string): CarConfig | null;
  /** Saves a copy of the (valid) draft as a new preset. */
  onDuplicate?(car: CarConfig): void;
  /** Running simulation for the live "Testes" tab. */
  live?(): { sim: VehicleSimulation; track: TrackConfig } | null;
}

type CrankType = CarConfig['engine']['crankType'];
/** Coherent cylinder layouts applied when the architecture is changed in the editor. */
const ARCH_TEMPLATES: Record<Architecture, { cylinders: number; bankAngleDeg: number; crankType: CrankType; firingOrder: number[]; bankOfCylinder: number[] }> = {
  I4: { cylinders: 4, bankAngleDeg: 0, crankType: 'inline', firingOrder: [1, 3, 4, 2], bankOfCylinder: [0, 0, 0, 0] },
  I6: { cylinders: 6, bankAngleDeg: 0, crankType: 'inline', firingOrder: [1, 5, 3, 6, 2, 4], bankOfCylinder: [0, 0, 0, 1, 1, 1] },
  V6: { cylinders: 6, bankAngleDeg: 60, crankType: 'even-fire', firingOrder: [1, 2, 3, 4, 5, 6], bankOfCylinder: [0, 1, 0, 1, 0, 1] },
  V8: { cylinders: 8, bankAngleDeg: 90, crankType: 'crossplane', firingOrder: [1, 8, 4, 3, 6, 5, 7, 2], bankOfCylinder: [0, 1, 0, 1, 0, 1, 0, 1] },
  V12: { cylinders: 12, bankAngleDeg: 60, crankType: 'even-fire', firingOrder: [1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10], bankOfCylinder: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1] },
};

const TESTS_TAB = { id: 'tests', label: 'Testes' };
const CLUTCH_LABELS: Record<string, string> = {
  OPEN: 'aberta',
  LAUNCH: 'largada (patinando)',
  SHIFT: 'troca de marcha',
  LOCKED: 'travada',
  ANTI_STALL: 'anti-apagamento',
  MANUAL_TEST: 'teste manual',
};
/** Everything except these parts changes the physics (Apply restarts the run). */
const stripNonPhysics = (c: CarConfig): string => JSON.stringify({ ...c, exhaust: null, acoustic: null, name: null, visual: null });

const LABELS = new Map<string, string>(FIELD_GROUPS.flatMap((g) => g.sections.flatMap((s) => s.fields.map((f) => [f.path, f.label] as [string, string]))));
const SECTION_LABELS: Record<string, string> = { engine: 'Motor', transmission: 'Câmbio', tires: 'Pneus', exhaust: 'Escapamento', acoustic: 'Som', visual: 'Visual', '(root)': 'Veículo' };

/** "transmission.finalDrive: msg" → "Diferencial: msg" (array indices map to the list field). */
function labelError(e: string): string {
  const i = e.indexOf(': ');
  if (i < 0) return e;
  const path = e.slice(0, i);
  const msg = e.slice(i + 2);
  const base = path.replace(/\.\d+$/, '');
  const label = LABELS.get(path) ?? LABELS.get(base) ?? SECTION_LABELS[path];
  return label ? `${label}: ${msg}` : e;
}

/** Firing intervals (deg) between consecutive events of the current table, in firing order. */
function intervalsOf(angles: readonly number[], order: readonly number[]): number[] | null {
  const n = order.length;
  if (angles.length !== n) return null;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = angles[order[k]! - 1];
    const b = k + 1 < n ? angles[order[k + 1]! - 1] : (angles[order[0]! - 1] ?? 0) + 720;
    if (a === undefined || b === undefined) return null;
    out.push((((b - a) % 720) + 720) % 720 || 720 / n);
  }
  return out;
}

/** Sandbox vehicle editor: every field validated by the zod schema before it can be applied. */
export class CarEditor {
  readonly el: HTMLElement;
  private base: CarConfig;
  private draft: CarConfig;
  private group = FIELD_GROUPS[0]!.id;
  private readonly body: HTMLElement;
  private readonly errors: HTMLElement;
  private readonly applyBtn: HTMLButtonElement;
  private readonly status: HTMLElement;
  private valid = true;
  private readonly displacement: HTMLElement;
  private liveTimer: ReturnType<typeof setTimeout> | null = null;
  private liveAcc = 0;
  private liveBody: HTMLElement | null = null;

  constructor(
    base: CarConfig,
    private readonly opts: CarEditorOptions,
  ) {
    this.base = base;
    this.draft = cloneCar(base);
    this.body = h('div');
    this.errors = h('div', { class: 'errors', 'data-testid': 'editor-errors' });
    this.status = h('span', { class: 'hint' });
    this.applyBtn = h('button', { class: 'primary', 'data-testid': 'editor-apply', onclick: () => this.apply() }, 'Aplicar') as HTMLButtonElement;
    this.displacement = h('div', { class: 'hint', 'data-testid': 'displacement' });
    const tabs = h(
      'div',
      { class: 'tabs' },
      [...FIELD_GROUPS, TESTS_TAB].map((g) =>
        h(
          'button',
          {
            class: g.id === this.group ? 'active' : '',
            'data-group': g.id,
            onclick: (ev: Event) => {
              this.group = g.id;
              for (const b of tabs.querySelectorAll('button')) b.classList.toggle('active', b === ev.currentTarget);
              this.render();
            },
          },
          g.label,
        ),
      ),
    );
    this.el = h(
      'div',
      { class: 'car-editor' },
      tabs,
      this.body,
      this.errors,
      h(
        'div',
        { class: 'row' },
        this.applyBtn,
        h('button', { onclick: () => this.revert() }, 'Descartar'),
        h('button', { 'data-testid': 'editor-defaults', title: 'Volta aos valores de fábrica deste carro (não aplica sozinho)', onclick: () => this.restoreDefaults() }, 'Restaurar padrão'),
        h('button', { 'data-testid': 'editor-duplicate', title: 'Salva uma cópia desta configuração como novo preset', onclick: () => this.duplicate() }, 'Duplicar preset'),
      ),
      h('div', { class: 'row' }, h('button', { onclick: () => this.exportJson() }, 'Exportar JSON'), h('button', { onclick: () => void this.importJson() }, 'Importar JSON')),
      this.status,
      h('div', { class: 'hint warn' }, 'Aplicar reinicia a simulação. Escapamento, canais de som, nome e visual entram ao vivo, sem reiniciar.'),
    );
    this.render();
    this.validate();
  }

  /** Replaces the edited car (vehicle selection changed or an external apply). */
  setBase(car: CarConfig): void {
    this.base = car;
    this.draft = cloneCar(car);
    this.render();
    this.validate();
  }

  get current(): CarConfig {
    return this.draft;
  }

  private render(): void {
    clear(this.body);
    this.liveBody = null;
    if (this.group === TESTS_TAB.id) {
      this.liveBody = h('div', { class: 'kv live-tests', 'data-testid': 'editor-tests' });
      this.body.append(h('div', { class: 'hint' }, 'Leituras ao vivo do carro em pista (configuração aplicada). Acelere para ver carga, embreagem e patinagem.'), this.liveBody);
      this.liveAcc = Infinity;
      this.updateLive(0);
      return;
    }
    const g = FIELD_GROUPS.find((x) => x.id === this.group)!;
    if (g.id === 'acoustic') {
      this.body.append(
        h('h3', {}, 'Presets de escapamento'),
        h(
          'div',
          { class: 'row' },
          (['stock', 'sport', 'straight'] as ExhaustPresetId[]).map((id) =>
            h('button', { 'data-preset': id, onclick: () => this.applyExhaustPreset(id) }, { stock: 'Original', sport: 'Esportivo', straight: 'Direto' }[id]),
          ),
        ),
        h('div', { class: 'hint' }, 'Os presets mudam a geometria (comprimentos → atrasos de propagação, diâmetros → reflexões) e o abafador, não apenas o volume.'),
      );
    }
    for (const sec of g.sections) {
      const fields = sec.fields.filter((f) => !f.when || f.when(this.draft));
      if (fields.length === 0) continue;
      this.body.append(h('h3', {}, sec.title));
      for (const f of fields) this.body.append(this.fieldRow(f));
      if (sec.fields.some((f) => f.path === 'engine.boreMm')) this.body.append(this.displacement);
      if (sec.fields.some((f) => f.path === 'engine.firingOrder')) {
        this.body.append(h('div', { class: 'hint', 'data-testid': 'firing-angles' }, `Ângulos de ignição: ${this.draft.engine.firingAnglesDeg.map((a) => a.toFixed(0)).join(', ')}°`));
      }
    }
  }

  private fieldRow(f: FieldDef): HTMLElement {
    const value = getPath(this.draft, f.path);
    let input: HTMLInputElement | HTMLSelectElement;
    const onChange = (raw: string | boolean): void => {
      const ok = this.setField(f, raw);
      input.classList.toggle('invalid', !ok);
      this.validate();
      if (f.path === 'engine.induction' || f.path === 'engine.firingOrder' || f.path === 'engine.cylinders' || f.path === 'engine.architecture') this.render();
      this.scheduleLiveApply();
    };
    if (f.kind === 'select') {
      const sel = h('select', { 'data-path': f.path }, (f.options ?? []).map(([v, l]) => h('option', { value: v, selected: v === value }, l))) as HTMLSelectElement;
      sel.addEventListener('change', () => onChange(sel.value));
      input = sel;
    } else if (f.kind === 'bool') {
      const cb = h('input', { type: 'checkbox', 'data-path': f.path, checked: value === true }) as HTMLInputElement;
      cb.addEventListener('change', () => onChange(cb.checked));
      input = cb;
    } else if (f.kind === 'list') {
      const arr = Array.isArray(value) ? (value as number[]) : [];
      const txt = h('input', { type: 'text', 'data-path': f.path, value: arr.map((v) => (f.digits === 0 ? String(v) : v.toFixed(f.digits ?? 3))).join(', ') }) as HTMLInputElement;
      txt.style.width = '100%';
      txt.addEventListener('change', () => onChange(txt.value));
      input = txt;
    } else if (f.kind === 'text') {
      const txt = h('input', { type: 'text', 'data-path': f.path, value: String(value ?? ''), maxlength: 64 }) as HTMLInputElement;
      txt.addEventListener('input', () => onChange(txt.value));
      input = txt;
    } else if (f.kind === 'color') {
      const c = h('input', { type: 'color', 'data-path': f.path, value: String(value ?? '#888888') }) as HTMLInputElement;
      c.addEventListener('input', () => onChange(c.value));
      input = c;
    } else {
      const num = h('input', {
        type: 'number',
        'data-path': f.path,
        value: typeof value === 'number' ? String(value) : '',
        min: f.min,
        max: f.max,
        step: f.step ?? (f.kind === 'int' ? 1 : 'any'),
      }) as HTMLInputElement;
      num.addEventListener('input', () => onChange(num.value));
      input = num;
    }
    const row = h('div', { class: 'row' }, h('label', { title: f.hint ?? '' }, f.label), input, f.unit ? h('span', { class: 'unit' }, f.unit) : null);
    if (f.kind === 'list') {
      return h('div', {}, h('div', { class: 'row' }, h('label', {}, f.label + (f.unit ? ` (${f.unit})` : ''))), input, f.hint ? h('div', { class: 'hint' }, f.hint) : null);
    }
    return row;
  }

  /** Writes one field into the draft. Returns false if the raw text is not a valid value. */
  private setField(f: FieldDef, raw: string | boolean): boolean {
    const e = this.draft.engine;
    switch (f.kind) {
      case 'bool':
        setPath(this.draft, f.path, raw === true);
        return true;
      case 'select':
      case 'text':
      case 'color':
        setPath(this.draft, f.path, String(raw));
        if (f.path === 'engine.induction' && raw === 'turbo' && !e.turbo) {
          e.turbo = { maxBoostBar: 0.8, spoolTimeS: 0.9, fullBoostFlowFraction: 0.55, maxShaftRpm: 180000, compressorBlades: 11, bovEnabled: true, bovVentTimeS: 0.25 };
        }
        if (f.path === 'engine.induction' && raw === 'NA') delete e.turbo;
        if (f.path === 'engine.architecture') {
          const t = ARCH_TEMPLATES[raw as Architecture];
          if (t) {
            e.cylinders = t.cylinders;
            e.bankAngleDeg = t.bankAngleDeg;
            e.crankType = t.crankType;
            e.firingOrder = [...t.firingOrder];
            e.bankOfCylinder = [...t.bankOfCylinder];
            e.firingAnglesDeg = firingAngles(t.firingOrder, 720 / t.cylinders);
          }
        }
        if (f.path.startsWith('exhaust.')) this.draft.exhaust.presetId = 'custom';
        return true;
      case 'list': {
        const parts = String(raw)
          .split(/[,;\s]+/)
          .filter((s) => s.length > 0)
          .map((s) => Number(s.replace(',', '.')));
        if (parts.some((v) => !Number.isFinite(v))) return false;
        if (f.path === 'engine.firingOrder') {
          const old = intervalsOf(e.firingAnglesDeg, e.firingOrder);
          e.firingOrder = parts;
          // keep the existing (possibly uneven) interval pattern when the cylinder count matches
          const n = parts.length;
          const intervals = old && old.length === n ? old : 720 / n;
          if (n === e.cylinders && parts.every((c) => Number.isInteger(c) && c >= 1 && c <= n)) e.firingAnglesDeg = firingAngles(parts, intervals);
          return true;
        }
        setPath(this.draft, f.path, parts);
        if (f.path.startsWith('exhaust.')) this.draft.exhaust.presetId = 'custom';
        return true;
      }
      default: {
        const v = Number(String(raw).replace(',', '.'));
        if (String(raw).trim() === '' || !Number.isFinite(v)) return false;
        if (f.kind === 'int' && !Number.isInteger(v)) return false;
        setPath(this.draft, f.path, v);
        if (f.path === 'engine.cylinders' && e.firingOrder.length === v) e.firingAnglesDeg = firingAngles(e.firingOrder, 720 / v);
        if (f.path.startsWith('exhaust.')) this.draft.exhaust.presetId = 'custom';
        return (f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max);
      }
    }
  }

  private applyExhaustPreset(id: ExhaustPresetId): void {
    const x = this.draft.exhaust;
    this.draft.exhaust = exhaustPreset(id, { layout: x.layout, headerPrimaryLengthM: x.headerPrimaryLengthM, headerDiameterMm: x.headerDiameterMm });
    this.render();
    this.validate();
  }

  private validate(): boolean {
    const e = this.draft.engine;
    const cc = (Math.PI / 4) * (e.boreMm / 10) ** 2 * (e.strokeMm / 10) * e.cylinders;
    this.displacement.textContent = Number.isFinite(cc) ? `Cilindrada calculada: ${cc.toFixed(0)} cm³ (${(cc / 1000).toFixed(2)} L) = π/4 · diâmetro² · curso · cilindros` : '';
    const r = validateCar(this.draft);
    this.valid = r.ok;
    this.errors.textContent = r.ok ? '' : r.errors.slice(0, 12).map(labelError).join('\n');
    const dirty = JSON.stringify(this.draft) !== JSON.stringify(this.base);
    this.applyBtn.disabled = !r.ok || !dirty;
    this.status.textContent = !r.ok ? 'Configuração inválida – corrija os campos acima.' : dirty ? 'Alterações não aplicadas.' : 'Sem alterações.';
    return r.ok;
  }

  private apply(): void {
    const r = validateCar(this.draft);
    if (!r.ok || !r.value) {
      this.validate();
      return;
    }
    const physicsChanged = stripNonPhysics(r.value) !== stripNonPhysics(this.base);
    this.base = cloneCar(r.value);
    this.draft = cloneCar(r.value);
    this.validate();
    this.opts.onApply(cloneCar(r.value), physicsChanged);
  }

  /** Non-physics edits (sound, exhaust, name, visual) are applied live after a short pause. */
  private scheduleLiveApply(): void {
    if (this.liveTimer) clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(() => {
      this.liveTimer = null;
      const dirty = JSON.stringify(this.draft) !== JSON.stringify(this.base);
      if (dirty && this.valid && stripNonPhysics(this.draft) === stripNonPhysics(this.base)) this.apply();
    }, 300);
  }

  private restoreDefaults(): void {
    const d = this.opts.defaults?.(this.draft.id);
    if (!d) {
      toast('Este carro não tem configuração de fábrica (preset personalizado).', 'error');
      return;
    }
    this.draft = cloneCar(d);
    this.render();
    this.validate();
    toast('Valores de fábrica carregados – clique em Aplicar.');
  }

  private duplicate(): void {
    if (!this.validate()) {
      toast('Corrija a configuração antes de duplicar.', 'error');
      return;
    }
    this.opts.onDuplicate?.(cloneCar(this.draft));
  }

  /** Refreshes the "Testes" tab (called every frame by the mode; updates at ~5 Hz). */
  updateLive(dtS: number): void {
    if (!this.liveBody) return;
    this.liveAcc += dtS;
    if (this.liveAcc < 0.2) return;
    this.liveAcc = 0;
    const live = this.opts.live?.();
    if (!live) {
      this.liveBody.textContent = 'Sem carro em pista.';
      return;
    }
    const { sim, track } = live;
    const t = sim.telemetry;
    const en = t.engine;
    const rows: [string, string][] = [
      ['rotação', `${en.rpm.toFixed(0)} rpm`],
      ['carga (ar retido / ref.)', `${(en.load * 100).toFixed(0)} %`],
      ['torque líquido', `${en.torqueNet.toFixed(0)} N·m`],
      ['marcha', sim.gearbox.engaged && sim.gearbox.gear > 0 ? String(sim.gearbox.gear) : 'N'],
      ['embreagem', `${CLUTCH_LABELS[t.clutchMode] ?? t.clutchMode} · acoplamento ${(sim.clutchCtl.engagement * 100).toFixed(0)} %`],
      ['escorregamento da embreagem', `${((t.clutchSlip * 60) / (2 * Math.PI)).toFixed(0)} rpm`],
      ['estado da troca', String(t.shiftState)],
      ['velocidade', `${(t.speed * 3.6).toFixed(1)} km/h`],
      ['aceleração', `${(t.acceleration / 9.80665).toFixed(2)} g`],
      ['patinagem dos pneus', `${(t.slipRatio * 100).toFixed(0)} %`],
      ['força do pneu / pico', `${t.tireForce.toFixed(0)} / ${t.tireForceMax.toFixed(0)} N`],
      ['temperatura do pneu', `${sim.tire.temperatureC.toFixed(1)} °C`],
      ['pressão no coletor (absoluta)', `${(en.manifoldPressurePa / 1000).toFixed(0)} kPa`],
      ['pista: aderência', `${track.surfaceGrip.toFixed(2)}×`],
      ['pista: asfalto / ar', `${track.surfaceTempC.toFixed(0)} / ${track.ambientTempC.toFixed(0)} °C`],
      ['pista: pressão', `${(track.ambientPressurePa / 1000).toFixed(1)} kPa`],
      ['pista: vento / inclinação', `${track.windMs.toFixed(1)} m/s / ${track.gradePercent.toFixed(1)} %`],
    ];
    this.liveBody.replaceChildren(...rows.flatMap(([k, v]) => [h('span', { class: 'k' }, k), h('span', {}, v)]));
  }

  private revert(): void {
    this.draft = cloneCar(this.base);
    this.render();
    this.validate();
  }

  private exportJson(): void {
    if (!this.validate()) {
      toast('Corrija a configuração antes de exportar.', 'error');
      return;
    }
    downloadText(`${this.draft.id}.json`, JSON.stringify(this.draft, null, 2), 'application/json');
  }

  private async importJson(): Promise<void> {
    const text = await pickTextFile();
    if (text === null) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      toast(`JSON inválido: ${e instanceof Error ? e.message : String(e)}`, 'error');
      return;
    }
    const r = validateCar(parsed);
    if (!r.ok || !r.value) {
      this.errors.textContent = `Arquivo rejeitado:\n${r.errors.slice(0, 12).join('\n')}`;
      toast('Configuração importada é inválida (nada foi alterado).', 'error');
      return;
    }
    this.draft = r.value;
    this.render();
    this.validate();
    toast('Configuração importada – revise e clique em Aplicar.');
  }

  isValid(): boolean {
    return this.valid;
  }
}
