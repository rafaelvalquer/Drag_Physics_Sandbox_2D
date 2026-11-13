import { ACTION_LABELS, DEFAULT_BINDINGS, DRIVE_ACTIONS, META_ACTIONS, keyLabel, validateBindings, type ActionId, type Bindings, type InputManager } from '../game/input/InputManager';
import { PEDAL_RISE_RANGE, ZOOM_RANGE, type AppSettings } from '../app/settings';
import { h } from './dom';

export interface SettingsDialogDeps {
  settings: AppSettings;
  input: InputManager;
  update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
}

/** Modal settings: key remapping (with conflict validation), volume, units, audio quality. */
export function openSettingsDialog(deps: SettingsDialogDeps): void {
  document.querySelector('.modal-backdrop')?.remove();
  let bindings: Bindings = structuredClone(deps.settings.bindings);
  const errors = h('div', { class: 'errors' });
  const table = h('div');

  const renderBindings = (): void => {
    table.replaceChildren(
      ...([...DRIVE_ACTIONS, ...META_ACTIONS] as ActionId[]).map((a) => {
        const keys = bindings[a];
        return h(
          'div',
          { class: 'row' },
          h('label', {}, ACTION_LABELS[a]),
          ...keys.map((k, i) =>
            h(
              'button',
              {
                class: 'keycap',
                title: 'Clique e pressione a nova tecla',
                'data-action': a,
                onclick: (ev: Event) => {
                  const btn = ev.currentTarget as HTMLButtonElement;
                  btn.textContent = '…';
                  deps.input.captureNextKey((code) => {
                    if (code === 'Escape') {
                      renderBindings();
                      return;
                    }
                    const next = structuredClone(bindings);
                    next[a][i] = code;
                    commit(next);
                  });
                },
              },
              keyLabel(k),
            ),
          ),
          keys.length < 2
            ? h(
                'button',
                {
                  title: 'Adicionar tecla alternativa',
                  onclick: () => {
                    deps.input.captureNextKey((code) => {
                      if (code === 'Escape') return;
                      const next = structuredClone(bindings);
                      next[a].push(code);
                      commit(next);
                    });
                  },
                },
                '+',
              )
            : null,
          keys.length > 1
            ? h(
                'button',
                {
                  title: 'Remover a tecla alternativa',
                  onclick: () => {
                    const next = structuredClone(bindings);
                    next[a] = next[a].slice(0, 1);
                    commit(next);
                  },
                },
                '−',
              )
            : null,
        );
      }),
    );
  };

  const commit = (next: Bindings): void => {
    const errs = validateBindings(next);
    if (errs.length > 0) {
      errors.textContent = errs.join('\n');
      renderBindings();
      return;
    }
    errors.textContent = '';
    bindings = next;
    deps.input.setBindings(next);
    deps.update('bindings', next);
    renderBindings();
  };

  const vol = h('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.01,
    value: String(deps.settings.masterVolume),
    'data-testid': 'volume',
    oninput: (e: Event) => deps.update('masterVolume', Number((e.target as HTMLInputElement).value)),
  });
  const units = h(
    'select',
    { onchange: (e: Event) => deps.update('units', (e.target as HTMLSelectElement).value as AppSettings['units']) },
    h('option', { value: 'kmh', selected: deps.settings.units === 'kmh' }, 'km/h'),
    h('option', { value: 'mph', selected: deps.settings.units === 'mph' }, 'mph'),
  );
  const quality = h(
    'select',
    { onchange: (e: Event) => deps.update('audioQuality', (e.target as HTMLSelectElement).value as AppSettings['audioQuality']) },
    h('option', { value: 'high', selected: deps.settings.audioQuality === 'high' }, 'alta'),
    h('option', { value: 'low', selected: deps.settings.audioQuality === 'low' }, 'baixa (menos CPU)'),
  );
  const opp = h('input', {
    type: 'checkbox',
    checked: deps.settings.opponentLowQuality,
    onchange: (e: Event) => deps.update('opponentLowQuality', (e.target as HTMLInputElement).checked),
  });

  const slider = (key: 'cameraZoom' | 'pedalRiseS', range: readonly [number, number], step: number, fmt: (v: number) => string): HTMLElement => {
    const out = h('span', { class: 'value' }, fmt(deps.settings[key]));
    const input = h('input', {
      type: 'range',
      min: range[0],
      max: range[1],
      step,
      value: String(deps.settings[key]),
      'data-testid': key,
      oninput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        out.textContent = fmt(v);
        deps.update(key, v);
      },
    });
    return h('div', { class: 'slider-pair' }, input, out);
  };
  const zoom = slider('cameraZoom', ZOOM_RANGE, 0.05, (v) => `${v.toFixed(2)}×`);
  const rise = slider('pedalRiseS', PEDAL_RISE_RANGE, 0.01, (v) => `${Math.round(v * 1000)} ms`);

  const touch = h(
    'select',
    { 'data-testid': 'touch-setting', onchange: (e: Event) => deps.update('touchControls', (e.target as HTMLSelectElement).value as AppSettings['touchControls']) },
    h('option', { value: 'auto', selected: deps.settings.touchControls === 'auto' }, 'automático (telas de toque)'),
    h('option', { value: 'on', selected: deps.settings.touchControls === 'on' }, 'sempre'),
    h('option', { value: 'off', selected: deps.settings.touchControls === 'off' }, 'nunca'),
  );

  const close = (): void => backdrop.remove();
  const backdrop: HTMLDivElement = h(
    'div',
    { class: 'modal-backdrop', onclick: (e: Event) => e.target === backdrop && close() },
    h(
      'div',
      { class: 'modal', role: 'dialog', 'aria-label': 'Configurações' },
      h('h2', {}, 'Configurações'),
      h('h3', {}, 'Teclas'),
      h('div', { class: 'hint' }, 'Condução: apenas acelerador, subir e descer marcha. Não há tecla de embreagem nem de freio.'),
      table,
      errors,
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            onclick: () => commit(structuredClone(DEFAULT_BINDINGS)),
          },
          'Restaurar padrão',
        ),
      ),
      h('h3', {}, 'Áudio'),
      h('div', { class: 'row' }, h('label', {}, 'Volume geral'), vol),
      h('div', { class: 'row' }, h('label', {}, 'Qualidade do modelo acústico'), quality),
      h('div', { class: 'row' }, h('label', {}, 'Adversários em qualidade baixa'), opp),
      h('h3', {}, 'Condução e câmera'),
      h('div', { class: 'row' }, h('label', { title: 'Tempo para o acelerador ir de 0 a 100 % com a tecla pressionada' }, 'Resposta do acelerador (0→100 %)'), rise),
      h('div', { class: 'row' }, h('label', {}, 'Zoom da câmera'), zoom),
      h('div', { class: 'row' }, h('label', {}, 'Botões de condução na tela'), touch),
      h('h3', {}, 'Unidades'),
      h('div', { class: 'row' }, h('label', {}, 'Velocidade'), units),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: close }, 'Fechar')),
    ),
  );
  renderBindings();
  document.body.append(backdrop);
}
