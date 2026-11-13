import { VehicleSound, DEFAULT_MIX, type ChannelMix } from '../audio/core/VehicleSound';
import { CHANNELS as AUDIO_CHANNELS, carToAcousticConfig } from '../audio/dsp/AcousticConfig';
import { LAB_CARS, cloneCar } from '../data/cars/index';
import { validateCar, type CarConfig, type TrackConfig } from '../data/schema';
import { TRACKS, findTrack } from '../data/tracks/index';
import { DragAI } from '../game/ai/DragAI';
import { FT } from '../game/race/RaceController';
import type { CameraMode, RenderVehicle, TrackMarker } from '../game/scenes/RaceScene';
import { SimulationRunner, type RunnerVehicle } from '../game/SimulationRunner';
import type { ShiftRequestResult } from '../physics/drivetrain/ShiftController';
import type { AppContext, Mode } from '../app/Mode';
import type { AppSettings } from '../app/settings';
import { VehicleViews } from '../app/vehicleView';
import { DevLab } from '../ui/DevLab';
import { clear, fmt, h, toast } from '../ui/dom';
import { CarEditor } from '../ui/editor/CarEditor';
import { TrackEditor } from '../ui/editor/TrackEditor';
import { Hud } from '../ui/Hud';

interface SavedPreset {
  id: string;
  name: string;
  savedAt: string;
  car: CarConfig;
}

type CompareDriver = 'mirror' | 'ai';
const CAMERAS: CameraMode[] = ['follow', 'wide', 'start'];
/** Distance before the end of the track where the automatic shutdown braking starts. */
const SHUTDOWN_M = 260;

export const SHIFT_MESSAGES: Partial<Record<ShiftRequestResult, string>> = {
  'rejected-overrev': 'Redução recusada: a rotação passaria do limite seguro',
  'waiting-overrev': 'Redução aguardando rotação segura',
  'rejected-engine-off': 'Motor desligado',
};

/**
 * Sandbox: free driving on a test strip with the full vehicle editor, acoustic mixer, saved
 * presets, an optional second car (mirrored inputs or AI) and the Developer Lab.
 */
export class SandboxMode implements Mode {
  readonly id = 'sandbox';
  readonly label = 'Sandbox';
  readonly usesTrack = true;
  cameraMode: CameraMode = 'follow';

  private ctx!: AppContext;
  private runner!: SimulationRunner;
  private car: CarConfig = cloneCar(LAB_CARS[4] ?? LAB_CARS[0]!);
  private compareCar: CarConfig | null = null;
  private compareDriver: CompareDriver = 'mirror';
  private compareAi: DragAI | null = null;
  private compareGreenAt: number | null = null;
  private trackCfg: TrackConfig = structuredClone(findTrack('test-track'));
  private trackEditor: TrackEditor | null = null;
  private readonly views = new VehicleViews();
  private hud: Hud | null = null;
  private editor: CarEditor | null = null;
  private lab: DevLab | null = null;
  private mix: ChannelMix = { ...DEFAULT_MIX };
  private offs: (() => void)[] = [];
  private presetList: HTMLElement | null = null;
  private engineBtn: HTMLButtonElement | null = null;
  private message = '';
  private messageT = 0;
  private renderList: RenderVehicle[] = [];
  private markerList: TrackMarker[] = [];

  mount(ctx: AppContext): void {
    this.ctx = ctx;
    this.runner = new SimulationRunner(this.trackCfg);
    this.lab = new DevLab(
      () => this.runner,
      ctx.audio,
      () => ({ modo: 'sandbox', carro: this.car.name, pista: this.trackCfg.name }),
      () => this.ctx.settings.audioQuality,
    );
    this.runner.afterStep.push(() => {
      this.views.latch(this.runner.vehicles);
      this.lab?.afterStep();
    });
    this.buildVehicles();
    this.hud = new Hud(ctx.hud);
    this.buildPanel();
    const inp = ctx.input;
    this.offs.push(
      inp.on('upshift', () => this.shift(1)),
      inp.on('downshift', () => this.shift(-1)),
      inp.on('restart', () => this.restart()),
      inp.on('pause', () => this.lab?.togglePause()),
      inp.on('camera', () => (this.cameraMode = CAMERAS[(CAMERAS.indexOf(this.cameraMode) + 1) % CAMERAS.length]!)),
      inp.on('telemetry', () => this.lab?.el.classList.toggle('collapsed')),
    );
    this.rebuildMarkers();
  }

  unmount(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.runner.dispose();
    this.hud?.dispose();
    this.hud = null;
    clear(this.ctx.panel);
  }

  // ---------------------------------------------------------------- vehicles

  private buildVehicles(playerSound: VehicleSound | null = null): void {
    if (!playerSound) {
      const old = this.runner.player;
      if (old?.sound) {
        playerSound = old.sound;
        old.sound = null;
      }
    }
    for (const v of [...this.runner.vehicles]) this.runner.remove(v.id);
    this.runner.simTime = 0;
    const p = this.runner.add(cloneCar(this.car), { id: 'player', lane: 0, isPlayer: true, sound: playerSound });
    if (playerSound) {
      playerSound.setConfig(carToAcousticConfig(p.sim.car, this.ctx.settings.audioQuality, 11));
      playerSound.reset();
    }
    p.sim.controls.autoStart = this.engineOn; // ignition is automatic on entering the track
    p.control = (h) => {
      const pedal = this.ctx.input.updatePedal(h);
      const c = p.sim.controls;
      const shutdown = p.sim.x > this.trackCfg.lengthM - SHUTDOWN_M;
      c.autoBrake = shutdown;
      c.pedal = shutdown ? 0 : pedal;
      // run timer: from the first movement until the car comes to rest again (per physics step)
      const t = this.runner.simTime;
      if (this.runT0 === null && p.sim.speed > 0.05) this.runT0 = t;
      if (this.runT0 !== null && this.runT1 === null && p.sim.x > 2 && Math.abs(p.sim.speed) < 0.05) this.runT1 = t;
    };
    if (this.compareCar) {
      const b = this.runner.add(cloneCar(this.compareCar), { id: 'compare', lane: 1, isPlayer: false });
      b.sim.controls.autoStart = this.engineOn;
      this.compareAi = this.compareDriver === 'ai' ? new DragAI(b.sim.car, 'advanced', 77) : null;
      this.views.names.set('compare', `${b.sim.car.name} (${this.compareDriver === 'ai' ? 'IA' : 'espelho'})`);
      this.compareGreenAt = null;
      b.control = (h) => this.controlCompare(h, b, p);
    }
    this.runT0 = null;
    this.runT1 = null;
    this.createVoices();
    this.lab?.clear();
  }

  private controlCompare(h: number, b: RunnerVehicle, p: RunnerVehicle): void {
    const c = b.sim.controls;
    const shutdown = b.sim.x > this.trackCfg.lengthM - SHUTDOWN_M;
    c.autoBrake = shutdown;
    if (shutdown) {
      c.pedal = 0;
      return;
    }
    if (this.compareAi) {
      // "green" = the moment the player first applies throttle in gear
      if (this.compareGreenAt === null && p.sim.gear >= 1 && p.sim.controls.pedal > 0.3) this.compareGreenAt = this.runner.simTime;
      this.compareAi.update(h, b.sim, {
        timeSinceGreen: this.compareGreenAt === null ? null : this.runner.simTime - this.compareGreenAt,
        staged: true,
        finished: false,
      });
    } else {
      c.pedal = p.sim.controls.pedal;
    }
  }

  private shift(dir: 1 | -1): void {
    const p = this.runner.player;
    if (!p) return;
    const r = p.sim.requestShift(dir);
    const msg = SHIFT_MESSAGES[r];
    if (msg) this.flash(msg);
    if (this.compareCar && this.compareDriver === 'mirror') this.runner.vehicles.find((v) => v.id === 'compare')?.sim.requestShift(dir);
  }

  private restart(): void {
    this.runner.resetAll();
    for (const v of this.runner.vehicles) v.sim.controls.autoStart = this.engineOn;
    this.compareAi?.newRace();
    this.compareGreenAt = null;
    this.runT0 = null;
    this.runT1 = null;
    this.lab?.clear();
    this.flash('Simulação reiniciada');
  }

  private engineOn = true;
  /** Run timer start/stop (simulation time, s). */
  private runT0: number | null = null;
  private runT1: number | null = null;

  private toggleEngine(): void {
    this.engineOn = !this.engineOn;
    for (const v of this.runner.vehicles) {
      const c = v.sim.controls;
      c.autoStart = this.engineOn;
      c.ignition = false;
      c.starter = false;
    }
    if (this.engineBtn) this.engineBtn.textContent = this.engineOn ? 'Desligar motor' : 'Ligar motor';
  }

  private flash(msg: string): void {
    this.message = msg;
    this.messageT = 2.2;
  }

  // ---------------------------------------------------------------- audio

  onAudioReady(): void {
    this.createVoices();
  }

  private createVoices(): void {
    const a = this.ctx?.audio;
    if (!a || !a.running) return;
    const ambientK = this.trackCfg.ambientTempC + 273.15;
    for (const v of this.runner.vehicles) {
      if (v.sound) continue;
      const q = v.isPlayer || !this.ctx.settings.opponentLowQuality ? this.ctx.settings.audioQuality : 'low';
      try {
        v.sound = new VehicleSound(a, carToAcousticConfig(v.sim.car, q, v.isPlayer ? 11 : 23), v.id, 0.05, ambientK);
        v.sound.setMix(this.mix);
      } catch (e) {
        toast(`Falha ao criar voz de áudio: ${e instanceof Error ? e.message : String(e)}`, 'error');
      }
    }
    this.lab?.applySolo();
  }

  onSettingsChanged(key: keyof AppSettings): void {
    if (key === 'audioQuality' || key === 'opponentLowQuality') {
      for (const v of this.runner.vehicles) {
        const q = v.isPlayer || !this.ctx.settings.opponentLowQuality ? this.ctx.settings.audioQuality : 'low';
        v.sound?.setQuality(q);
      }
    }
  }

  // ---------------------------------------------------------------- panel

  private buildPanel(): void {
    const panel = this.ctx.panel;
    clear(panel);
    const carSel = h(
      'select',
      { 'data-testid': 'car-select', onchange: (e: Event) => this.selectCar((e.target as HTMLSelectElement).value) },
      LAB_CARS.map((c) => h('option', { value: c.id, selected: c.id === this.car.id }, c.name)),
    );
    const trackSel = h(
      'select',
      {
        'data-testid': 'track-select',
        onchange: (e: Event) => {
          this.trackCfg = structuredClone(findTrack((e.target as HTMLSelectElement).value));
          this.runner.setTrack(this.trackCfg);
          this.trackEditor?.setBase(this.trackCfg);
          for (const v of this.runner.vehicles) v.sound?.setAmbient(this.trackCfg.ambientTempC + 273.15);
          this.rebuildMarkers();
          this.restart();
        },
      },
      TRACKS.map((t) => h('option', { value: t.id, selected: t.id === this.trackCfg.id }, t.name)),
    );
    this.engineBtn = h('button', { 'data-testid': 'engine-toggle', onclick: () => this.toggleEngine() }, this.engineOn ? 'Desligar motor' : 'Ligar motor') as HTMLButtonElement;

    const cmpSel = h(
      'select',
      {
        'data-testid': 'compare-select',
        onchange: (e: Event) => {
          const id = (e.target as HTMLSelectElement).value;
          const c = LAB_CARS.find((x) => x.id === id);
          this.compareCar = c ? cloneCar(c) : null;
          this.buildVehicles();
        },
      },
      h('option', { value: '' }, '— nenhum —'),
      LAB_CARS.map((c) => h('option', { value: c.id }, c.name)),
    );
    const cmpDrv = h(
      'select',
      {
        onchange: (e: Event) => {
          this.compareDriver = (e.target as HTMLSelectElement).value as CompareDriver;
          if (this.compareCar) this.buildVehicles();
        },
      },
      h('option', { value: 'mirror' }, 'espelhar meus comandos'),
      h('option', { value: 'ai' }, 'IA avançada (larga quando você acelera)'),
    );

    this.editor = new CarEditor(this.car, {
      onApply: (car, physics) => this.applyCar(car, physics),
      // presets keep the factory car id behind a "user-" prefix
      defaults: (id) => {
        const c = LAB_CARS.find((x) => x.id === id.replace(/^(user-)+/, ""));
        return c ? cloneCar(c) : null;
      },
      onDuplicate: (car) => void this.savePreset(`${car.name} (cópia)`, car),
      live: () => {
        const p = this.runner.player;
        return p ? { sim: p.sim, track: this.trackCfg } : null;
      },
    });
    this.trackEditor = new TrackEditor(this.trackCfg, {
      onApply: (t) => {
        this.trackCfg = t;
        this.runner.setTrack(t, true);
        for (const v of this.runner.vehicles) v.sound?.setAmbient(t.ambientTempC + 273.15);
      },
    });
    this.presetList = h('div');
    const presetName = h('input', { type: 'text', placeholder: 'nome do preset', maxlength: 64, 'data-testid': 'preset-name' }) as HTMLInputElement;

    panel.append(
      h('h2', {}, 'Sandbox'),
      h('div', { class: 'row' }, h('label', {}, 'Veículo'), carSel),
      h('div', { class: 'row' }, h('label', {}, 'Pista'), trackSel),
      h('div', { class: 'row' }, this.engineBtn, h('button', { 'data-testid': 'restart', onclick: () => this.restart() }, 'Reiniciar (R)')),
      h(
        'div',
        { class: 'hint' },
        'Comandos: ',
        h('span', { class: 'keycap' }, 'W'),
        '/',
        h('span', { class: 'keycap' }, '↑'),
        ' acelerar · ',
        h('span', { class: 'keycap' }, 'E'),
        ' subir · ',
        h('span', { class: 'keycap' }, 'Q'),
        ' descer marcha. Embreagem automática; sem freio – no fim da pista o carro freia sozinho.',
      ),
      h('details', { class: 'fold' }, h('summary', {}, 'Condições da pista'), this.trackEditor.el),
      h('h3', {}, 'Comparação'),
      h('div', { class: 'row' }, h('label', {}, 'Segundo carro'), cmpSel),
      h('div', { class: 'row' }, h('label', {}, 'Piloto'), cmpDrv),
      h('h3', {}, 'Editor do veículo'),
      this.editor.el,
      h('h3', {}, 'Presets salvos'),
      h('div', { class: 'row' }, presetName, h('button', { 'data-testid': 'preset-save', onclick: () => void this.savePreset(presetName.value) }, 'Salvar')),
      this.presetList,
      h('h3', {}, 'Mixer de áudio'),
      this.mixerUi(),
      this.lab!.el,
    );
    void this.refreshPresets();
  }

  private mixerUi(): HTMLElement {
    const labels: Record<string, string> = {
      intake: 'Admissão',
      block: 'Bloco/mecânico',
      exhaust: 'Escape',
      turbo: 'Turbo',
      tire: 'Pneus',
      transmission: 'Transmissão',
      environment: 'Ambiente',
    };
    return h(
      'div',
      {},
      AUDIO_CHANNELS.map((ch) => {
        const val = h('span', { class: 'unit' }, fmt(this.mix[ch], 2));
        const r = h('input', {
          type: 'range',
          min: 0,
          max: 1.5,
          step: 0.01,
          value: String(this.mix[ch]),
          'data-mix': ch,
          oninput: (e: Event) => {
            const v = Number((e.target as HTMLInputElement).value);
            this.mix = { ...this.mix, [ch]: v };
            val.textContent = fmt(v, 2);
            for (const rv of this.runner.vehicles) rv.sound?.setMix(this.mix);
            this.lab?.applySolo();
          },
        });
        return h('div', { class: 'row' }, h('label', {}, labels[ch] ?? ch), r, val);
      }),
    );
  }

  private selectCar(id: string): void {
    const c = LAB_CARS.find((x) => x.id === id);
    if (!c) return;
    this.car = cloneCar(c);
    this.editor?.setBase(this.car);
    this.replacePlayer();
  }

  private applyCar(car: CarConfig, physicsChanged: boolean): void {
    this.car = car;
    const p = this.runner.player;
    if (!physicsChanged && p) {
      // acoustic / visual only: keep the run going, rebuild the sound model (cross-faded)
      Object.assign(p.sim.car, { exhaust: car.exhaust, acoustic: car.acoustic, visual: car.visual, name: car.name });
      const q = this.ctx.settings.audioQuality;
      p.sound?.setConfig(carToAcousticConfig(p.sim.car, q, 11));
      this.flash('Som atualizado');
      return;
    }
    this.replacePlayer();
    this.flash('Configuração aplicada – simulação reiniciada');
  }

  /**
   * Rebuilds the simulations with the current car (both cars restart together). The player's
   * audio voice is kept and receives the new acoustic configuration (cross-faded in the worklet).
   */
  private replacePlayer(): void {
    const old = this.runner.player;
    const sound = old?.sound ?? null;
    if (old) old.sound = null; // detach so runner.remove() does not dispose it
    this.runner.resetAll();
    this.buildVehicles(sound);
  }

  private async savePreset(name: string, from?: CarConfig): Promise<void> {
    const car = from ?? this.editor?.current ?? this.car;
    const r = validateCar(car);
    if (!r.ok || !r.value) {
      toast('A configuração atual é inválida e não pode ser salva.', 'error');
      return;
    }
    const nm = name.trim() || r.value.name;
    const preset: SavedPreset = { id: `user-${Date.now().toString(36)}`, name: nm, savedAt: new Date().toISOString(), car: { ...r.value, id: `user-${r.value.id}`.slice(0, 64), name: nm.slice(0, 64) } };
    try {
      await this.ctx.store.put('presets', preset);
      toast(this.ctx.store.persistent ? 'Preset salvo.' : 'Preset salvo apenas nesta sessão (IndexedDB indisponível).');
    } catch (e) {
      toast(`Falha ao salvar: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
    await this.refreshPresets();
  }

  private async refreshPresets(): Promise<void> {
    const host = this.presetList;
    if (!host) return;
    let list: SavedPreset[] = [];
    try {
      list = await this.ctx.store.getAll<SavedPreset>('presets');
    } catch {
      list = [];
    }
    clear(host);
    if (list.length === 0) {
      host.append(h('div', { class: 'hint' }, 'Nenhum preset salvo.'));
      return;
    }
    for (const p of list.sort((a, b) => b.savedAt.localeCompare(a.savedAt))) {
      const valid = validateCar(p.car);
      host.append(
        h(
          'div',
          { class: 'row', 'data-testid': 'preset-row' },
          h('label', { title: valid.ok ? '' : valid.errors.join('\n') }, `${p.name}${valid.ok ? '' : ' (inválido)'}`),
          h(
            'button',
            {
              disabled: !valid.ok,
              onclick: () => {
                if (!valid.value) return;
                this.car = cloneCar(valid.value);
                this.editor?.setBase(this.car);
                this.replacePlayer();
              },
            },
            'Carregar',
          ),
          h(
            'button',
            {
              class: 'danger',
              onclick: async () => {
                await this.ctx.store.delete('presets', p.id);
                await this.refreshPresets();
              },
            },
            'Excluir',
          ),
        ),
      );
    }
  }

  // ---------------------------------------------------------------- per frame

  private rebuildMarkers(): void {
    const m: TrackMarker[] = [
      { xM: 60 * FT, label: '60 ft', major: false },
      { xM: 330 * FT, label: '330 ft', major: false },
      { xM: 660 * FT, label: '1/8', major: true },
      { xM: 1000 * FT, label: '1000 ft', major: false },
      { xM: 1320 * FT, label: '1/4', major: true },
      { xM: 1000, label: '1 km', major: true },
    ];
    for (let d = 100; d < this.trackCfg.lengthM; d += 100) if (d !== 1000) m.push({ xM: d, label: `${d} m`, major: false });
    this.markerList = m.sort((a, b) => a.xM - b.xM);
  }

  tick(dtS: number): void {
    this.runner.advance(dtS);
    this.renderList = this.views.render(this.runner.vehicles, dtS);
    this.views.spatialize(this.runner.vehicles, dtS);
    const p = this.runner.player;
    if (this.messageT > 0) this.messageT -= dtS;
    if (p && this.hud) {
      let msg = this.messageT > 0 ? this.message : '';
      if (!msg && p.sim.controls.autoBrake) msg = 'Fim da pista: frenagem automática (R reinicia)';
      if (!msg && this.runner.paused) msg = 'PAUSADO';
      const other = this.runner.vehicles.find((v) => v.id === 'compare');
      this.hud.update(p.sim, this.ctx.settings.units, msg, {
        distanceM: p.sim.x,
        timeS: this.runT0 === null ? null : (this.runT1 ?? this.runner.simTime) - this.runT0,
        timeLabel: 'tempo',
        gapM: other ? other.sim.x - p.sim.x : null,
      });
    }
    this.lab?.update(dtS);
    this.editor?.updateLive(dtS);
  }

  vehicles(): RenderVehicle[] {
    return this.renderList;
  }
  track(): TrackConfig {
    return this.trackCfg;
  }
  markers(): TrackMarker[] {
    return this.markerList;
  }
  tree(): null {
    return null;
  }
  finishM(): number | null {
    return null;
  }
}
