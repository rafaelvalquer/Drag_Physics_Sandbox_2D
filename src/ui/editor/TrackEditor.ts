import { validateTrack, type TrackConfig } from '../../data/schema';
import { h } from '../dom';

type NumericKey = 'surfaceGrip' | 'rollingResistanceFactor' | 'surfaceTempC' | 'ambientTempC' | 'ambientPressurePa' | 'windMs' | 'gradePercent';

interface TrackField {
  key: NumericKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Displayed value = stored value / scale (e.g. Pa shown as kPa). */
  scale?: number;
  hint: string;
}

/** Editable track conditions; ranges mirror TrackSchema (validated again on apply). */
export const TRACK_FIELDS: readonly TrackField[] = [
  { key: 'surfaceGrip', label: 'Aderência da superfície', unit: '×', min: 0.5, max: 1.3, step: 0.01, hint: 'Multiplica o atrito de pico dos pneus (1 = asfalto preparado de referência).' },
  { key: 'rollingResistanceFactor', label: 'Resistência ao rolamento', unit: '×', min: 0.5, max: 2, step: 0.05, hint: 'Multiplica o coeficiente de rolamento dos pneus.' },
  { key: 'surfaceTempC', label: 'Temperatura do asfalto', unit: '°C', min: -10, max: 70, step: 1, hint: 'Temperatura inicial dos pneus e alvo de resfriamento.' },
  { key: 'ambientTempC', label: 'Temperatura do ar', unit: '°C', min: -20, max: 50, step: 1, hint: 'Densidade do ar (admissão e arrasto) e velocidade do som.' },
  { key: 'ambientPressurePa', label: 'Pressão atmosférica', unit: 'kPa', min: 70, max: 108, step: 0.1, scale: 1000, hint: 'Altitude: menos pressão = menos ar no motor e menos arrasto.' },
  { key: 'windMs', label: 'Vento (+ a favor)', unit: 'm/s', min: -20, max: 20, step: 0.5, hint: 'Positivo = vento de cauda; negativo = vento contra.' },
  { key: 'gradePercent', label: 'Inclinação (+ subida)', unit: '%', min: -5, max: 5, step: 0.1, hint: 'Positivo = subida.' },
];

export interface TrackEditorDeps {
  /** Called with a validated configuration; `live` = applied mid-run without a restart. */
  onApply(track: TrackConfig): void;
}

/**
 * Track conditions editor. Values are validated with the same zod schema used everywhere
 * (validateTrack); valid edits apply immediately to the running simulation.
 */
export class TrackEditor {
  readonly el: HTMLElement;
  private base!: TrackConfig;
  private draft!: TrackConfig;
  private readonly fields: HTMLElement;
  private readonly errors: HTMLElement;

  constructor(base: TrackConfig, private readonly deps: TrackEditorDeps) {
    this.fields = h('div', { class: 'track-fields' });
    this.errors = h('div', { class: 'errors', 'data-testid': 'track-errors' });
    this.el = h(
      'div',
      { class: 'track-editor', 'data-testid': 'track-editor' },
      this.fields,
      this.errors,
      h(
        'div',
        { class: 'row' },
        h('button', { 'data-testid': 'track-reset', onclick: () => this.reset() }, 'Restaurar condições da pista'),
      ),
      h('div', { class: 'hint' }, 'As alterações valem na hora, sem reiniciar (os pneus mantêm a temperatura atual).'),
    );
    this.setBase(base);
  }

  /** A different track was selected: edit its conditions from the stored values. */
  setBase(track: TrackConfig): void {
    this.base = structuredClone(track);
    this.draft = structuredClone(track);
    this.render();
  }

  get current(): TrackConfig {
    return this.draft;
  }

  private reset(): void {
    this.draft = structuredClone(this.base);
    this.render();
    this.deps.onApply(structuredClone(this.draft));
  }

  private render(): void {
    this.errors.textContent = '';
    this.fields.replaceChildren(
      ...TRACK_FIELDS.map((f) => {
        const scale = f.scale ?? 1;
        const input = h('input', {
          type: 'number',
          min: f.min,
          max: f.max,
          step: f.step,
          value: String(round(this.draft[f.key] / scale, f.step)),
          'data-track': f.key,
          onchange: (e: Event) => this.edit(f, e.target as HTMLInputElement),
        }) as HTMLInputElement;
        return h('div', { class: 'row', title: f.hint }, h('label', {}, f.label), input, h('span', { class: 'unit' }, f.unit));
      }),
    );
  }

  private edit(f: TrackField, input: HTMLInputElement): void {
    const v = Number(input.value.replace(',', '.'));
    const candidate = { ...this.draft, [f.key]: v * (f.scale ?? 1) };
    const r = validateTrack(candidate);
    const outOfRange = !Number.isFinite(v) || v < f.min || v > f.max;
    if (!r.ok || outOfRange) {
      input.classList.add('invalid');
      this.errors.textContent = `${f.label}: valor inválido (faixa ${f.min} a ${f.max} ${f.unit}).`;
      return;
    }
    input.classList.remove('invalid');
    this.errors.textContent = '';
    this.draft = r.value!;
    this.deps.onApply(structuredClone(this.draft));
  }
}

function round(v: number, step: number): number {
  const d = Math.max(0, -Math.floor(Math.log10(step)));
  return Number(v.toFixed(d));
}
