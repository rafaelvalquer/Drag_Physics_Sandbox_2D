import Phaser from 'phaser';
import { audioEngine } from '../audio/core/AudioEngine';
import { InputManager } from '../game/input/InputManager';
import { RaceScene, type CameraMode, type SceneBridge } from '../game/scenes/RaceScene';
import { openStore, type Store } from '../storage/db';
import { SandboxMode } from '../modes/SandboxMode';
import { RaceMode } from '../modes/RaceMode';
import { DynoMode } from '../modes/DynoMode';
import { CareerMode } from '../modes/CareerMode';
import { clear, h, toast } from '../ui/dom';
import { openSettingsDialog } from '../ui/SettingsDialog';
import { openGarage } from '../ui/garage/GarageDialog';
import { CAR_GROUPS } from '../data/cars/index';
import { TouchControls } from '../ui/TouchControls';
import { VehicleSound } from '../audio/core/VehicleSound';
import type { AppContext, Mode } from './Mode';
import { loadSettings, saveSetting, type AppSettings } from './settings';

/**
 * Application shell: top bar, mode switching, audio unlock gate, one Phaser game whose scene
 * renders whatever the active mode exposes through the bridge.
 */
export class App {
  private store!: Store;
  private settings!: AppSettings;
  private input!: InputManager;
  private game: Phaser.Game | null = null;
  private mode: Mode | null = null;
  private readonly modes: Record<string, () => Mode> = {
    sandbox: () => new SandboxMode(),
    race: () => new RaceMode(),
    dyno: () => new DynoMode(),
    career: () => new CareerMode(),
  };
  private readonly el = {
    app: document.getElementById('app')!,
    topbar: document.getElementById('topbar')!,
    stage: document.getElementById('stage')!,
    game: document.getElementById('game')!,
    hud: document.getElementById('hud')!,
    overlay: document.getElementById('overlay')!,
    panel: document.getElementById('panel')!,
  };
  private audioLabel!: HTMLElement;
  private muteBtn!: HTMLButtonElement;
  private gate: HTMLElement | null = null;
  private touch: TouchControls | null = null;
  private ctx!: AppContext;

  async boot(): Promise<void> {
    this.store = await openStore();
    this.settings = await loadSettings(this.store);
    this.input = new InputManager(this.settings.bindings);
    this.input.pedalRiseS = this.settings.pedalRiseS;
    audioEngine.setMasterVolume(this.settings.masterVolume);
    audioEngine.setMuted(this.settings.muted);
    this.ctx = {
      panel: this.el.panel,
      hud: this.el.hud,
      overlay: this.el.overlay,
      input: this.input,
      audio: audioEngine,
      store: this.store,
      settings: this.settings,
      updateSetting: (k, v) => this.updateSetting(k, v),
      switchMode: (id) => this.switchMode(id),
    };
    this.buildTopbar();
    this.touch = new TouchControls(this.el.stage, this.input);
    this.input.on('mute', () => this.updateSetting('muted', !this.settings.muted));
    this.showAudioGate();
    // any first gesture also unlocks audio
    const unlock = (): void => void this.startAudio();
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });
    if (!this.store.persistent) toast('IndexedDB indisponível: presets e recordes valem só nesta sessão.', 'error');
    this.switchMode('sandbox');
    this.createGame();
  }

  private bridge(): SceneBridge {
    const app = this; // the bridge outlives mode switches: always delegate to the current mode
    return {
      tick: (dt) => app.mode?.tick(dt),
      vehicles: () => app.mode?.vehicles() ?? [],
      track: () => app.mode!.track(),
      markers: () => app.mode?.markers() ?? [],
      tree: () => app.mode?.tree() ?? null,
      finishM: () => app.mode?.finishM() ?? null,
      zoom: () => app.settings.cameraZoom,
      visible: () => app.mode?.usesTrack ?? false,
      focusM: () => app.mode?.focusM?.() ?? null,
      graphics: () => app.settings.graphics,
      timeOfDay: () => app.settings.timeOfDay,
      get cameraMode(): CameraMode {
        return app.mode?.cameraMode ?? 'follow';
      },
      set cameraMode(m: CameraMode) {
        if (app.mode) app.mode.cameraMode = m;
      },
    };
  }

  private createGame(): void {
    const bridge = this.bridge();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.el.game,
      backgroundColor: '#0f1216',
      banner: false,
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      render: { antialias: true, pixelArt: false },
      scene: [],
    });
    this.game.events.once('ready', () => {
      this.game!.scene.add('race', RaceScene, true, { bridge });
    });
  }

  private buildTopbar(): void {
    const tb = this.el.topbar;
    clear(tb);
    this.audioLabel = h('span', { class: 'audio-state', 'data-testid': 'audio-state' }, 'áudio: desligado');
    this.muteBtn = h('button', { 'data-testid': 'mute', onclick: () => this.updateSetting('muted', !this.settings.muted) }, this.settings.muted ? 'Som: mudo' : 'Som: ligado') as HTMLButtonElement;
    tb.append(
      h('span', { class: 'brand', title: 'Drag Physics Sandbox 2D' }, h('span', { class: 'long' }, 'DRAG PHYSICS SANDBOX 2D'), h('span', { class: 'short' }, 'DPS·2D')),
      ...Object.keys(this.modes).map((id) =>
        h('button', { class: 'tab', 'data-mode': id, onclick: () => this.switchMode(id) }, { sandbox: 'Sandbox', race: 'Corrida', dyno: 'Dinamômetro', career: 'Campanha' }[id] ?? id),
      ),
      h('button', { class: 'tab garage-btn', 'data-testid': 'garage-open', title: 'Ver os carros em detalhe e escolher um', onclick: () => this.openGarage() }, 'Garagem'),
      h('span', { class: 'spacer' }),
      this.audioLabel,
      this.muteBtn,
      h(
        'button',
        {
          'data-testid': 'panel-toggle',
          title: 'Mostrar/ocultar o painel lateral',
          onclick: () => this.el.app.classList.toggle('no-panel'),
        },
        'Painel',
      ),
      h(
        'button',
        {
          'data-testid': 'settings',
          onclick: () => openSettingsDialog({ settings: this.settings, input: this.input, update: (k, v) => this.updateSetting(k, v) }),
        },
        'Configurações',
      ),
    );
  }

  switchMode(id: string): void {
    const make = this.modes[id];
    if (!make) return;
    if (this.mode?.id === id) return;
    this.mode?.unmount();
    clear(this.el.hud);
    for (const c of [...this.el.overlay.children]) if (c !== this.gate) c.remove();
    const m = make();
    this.mode = m;
    m.mount(this.ctx);
    this.el.game.style.visibility = m.usesTrack ? 'visible' : 'hidden';
    this.touch?.setVisible(m.usesTrack && TouchControls.wanted(this.settings.touchControls));
    for (const b of this.el.topbar.querySelectorAll<HTMLButtonElement>('button.tab[data-mode]')) b.classList.toggle('active', b.dataset.mode === id);
    if (audioEngine.running) m.onAudioReady();
  }

  private openGarage(): void {
    const m = this.mode;
    if (!m) return;
    const label: Record<string, string> = { sandbox: 'Usar no Sandbox', race: 'Usar na corrida', dyno: 'Levar ao dinamômetro' };
    openGarage({
      cars: CAR_GROUPS.flatMap((group) => group.cars),
      current: m.currentCar?.() ?? null,
      useLabel: label[m.id] ?? 'Usar este carro',
      onUse: (id, paint) => {
        if (!m.selectCar?.(id, paint ?? undefined)) toast('Este modo não permite trocar de carro agora.', 'error');
      },
    });
  }

  private showAudioGate(): void {
    this.gate = h(
      'div',
      { class: 'audio-gate', 'data-testid': 'audio-gate' },
      h(
        'div',
        { class: 'gate-box' },
        h('button', { class: 'primary', onclick: () => void this.startAudio() }, 'Ativar som e começar'),
        h('div', { class: 'hint' }, 'O navegador só libera o áudio após uma interação. Todo o som é sintetizado em tempo real a partir da física.'),
      ),
    );
    this.el.overlay.append(this.gate);
  }

  private async startAudio(): Promise<void> {
    if (audioEngine.running) return;
    this.audioLabel.textContent = 'áudio: iniciando…';
    try {
      await audioEngine.start();
      this.gate?.remove();
      this.gate = null;
      this.audioLabel.textContent = `áudio: ${audioEngine.sampleRate} Hz`;
      this.mode?.onAudioReady();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.audioLabel.textContent = 'áudio: falhou';
      toast(`Falha ao iniciar o áudio: ${msg}`, 'error');
      this.gate?.remove();
      this.gate = null;
    }
  }

  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value;
    if (key === 'masterVolume') audioEngine.setMasterVolume(value as number);
    if (key === 'pedalRiseS') this.input.pedalRiseS = value as number;
    if (key === 'touchControls') this.touch?.setVisible(!!this.mode?.usesTrack && TouchControls.wanted(value as AppSettings['touchControls']));
    if (key === 'muted') {
      audioEngine.setMuted(value as boolean);
      this.muteBtn.textContent = value ? 'Som: mudo' : 'Som: ligado';
    }
    saveSetting(this.store, key, value).catch((e: unknown) => console.warn('setting not saved', e));
    this.mode?.onSettingsChanged?.(key);
  }

  /** Read-only view used by the end-to-end tests. */
  get debug(): { mode: string | null; audio: string; sampleRate: number; game: Phaser.Game | null; current: Mode | null; liveVoices: number } {
    return { mode: this.mode?.id ?? null, audio: audioEngine.state, sampleRate: audioEngine.sampleRate, game: this.game, current: this.mode, liveVoices: VehicleSound.live };
  }
}
