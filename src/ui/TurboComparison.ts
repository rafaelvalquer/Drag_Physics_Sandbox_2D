import { TURBO_LAYER, TURBO_MODELS, type TurboAcousticModel, type TurboDiagnostics } from '../audio/dsp/turbo/TurboAcousticTypes';
import { h } from './dom';

export interface TurboComparison {
  model: TurboAcousticModel;
  layers: number;
  diagnostics: TurboDiagnostics;
  matchLevel: boolean;
}

function gainInput(key: string, label: string, initial: number, set: (gain: number) => void): HTMLElement {
  const level = h('output', {}, initial.toFixed(2));
  const enabled = h('input', {
    type: 'checkbox', checked: initial > 0, 'data-turbo-layer': key,
    onchange: () => {
      amount.value = enabled.checked ? '1' : '0';
      refresh();
      set(Number(amount.value));
    },
  });
  const amount = h('input', {
    type: 'range', min: 0, max: 2, step: .05, value: initial, 'data-turbo-gain': key, 'aria-label': label,
    oninput: () => refresh(), onchange: () => set(Number(amount.value)),
  });
  function refresh() {
    level.textContent = Number(amount.value).toFixed(2);
    enabled.checked = Number(amount.value) > 0;
  }
  return h('div', { class: 'row' }, h('label', {}, enabled, ' ', label), amount, level);
}

export function turboComparisonPanel(state: TurboComparison, apply: () => void): HTMLElement {
  const labels = ['A — Legado', 'B — Turbo 2.0', 'C — Harmônicos reduzidos', 'D — Rotor híbrido'];
  const controls = {
    order1: 'Rotor 1X', order2: 'Rotor 2X', order3: 'Rotor 3X', bladePass: 'Passagem das pás (BPF)',
    amplitude: 'Modulação de amplitude', exhaustPulse: 'Pulsação do escape', whoosh: 'Fluxo (whoosh)',
    narrowband: 'Textura de banda estreita (D)', coherent: 'Tom coerente (D)',
  };
  const layers = { rotor: 'Rotor completo', bov: 'Blow-off', flutter: 'Flutter', wastegate: 'Wastegate', resonance: 'Duto completo' };
  const advanced = h('fieldset', { disabled: state.model === 'legacy' },
    h('legend', {}, 'Isolamento e ganho (0 = desligado)'),
    ...(Object.keys(controls) as (keyof typeof controls)[]).map((key) =>
      gainInput(key, controls[key], state.diagnostics[key] ?? 1, (value) => {
        state.diagnostics = { ...state.diagnostics, [key]: value };
        apply();
      })),
    ...[0, 1].map((i) =>
      gainInput(`resonance-${i + 1}`, `Ressonância ${i + 1}`, state.diagnostics.resonances?.[i] ?? 1, (value) => {
          const resonances = [...(state.diagnostics.resonances ?? [1, 1])];
        resonances[i] = value;
        state.diagnostics = { ...state.diagnostics, resonances };
        apply();
      })),
    ...(Object.keys(layers) as (keyof typeof layers)[]).map((key) =>
      h('label', { class: 'row' }, h('input', {
        type: 'checkbox', checked: (state.layers & TURBO_LAYER[key]) !== 0, 'data-turbo-layer': key,
        onchange: (e: Event) => {
          state.layers = (e.target as HTMLInputElement).checked ? state.layers | TURBO_LAYER[key] : state.layers & ~TURBO_LAYER[key];
          apply();
        },
      }), ' ', layers[key])),
    h('p', { class: 'hint' }, 'O perfil do carro define as ressonâncias disponíveis. O 3X é omitido na qualidade baixa.'));
  const modelSelect = h('select', {
    'data-testid': 'turbo-model', 'aria-label': 'Modelo do turbo',
    onchange: () => {
      state.model = TURBO_MODELS.find((model) => model === modelSelect.value) ?? 'hybrid';
      advanced.disabled = state.model === 'legacy';
      apply();
    },
  }, ...TURBO_MODELS.map((model, i) => h('option', { value: model, selected: state.model === model }, labels[i]!)));
  return h('div', {},
    h('label', { class: 'row' }, 'Modelo do turbo', modelSelect),
    h('label', { class: 'row' }, h('input', {
      type: 'checkbox', checked: state.matchLevel, 'data-testid': 'turbo-match-level',
      onchange: (e: Event) => { state.matchLevel = (e.target as HTMLInputElement).checked; apply(); },
    }), ' Equalizar nível da comparação'),
    advanced);
}
