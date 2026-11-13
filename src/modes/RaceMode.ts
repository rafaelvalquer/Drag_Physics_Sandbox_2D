import { VehicleSound } from '../audio/core/VehicleSound';
import { carToAcousticConfig } from '../audio/dsp/AcousticConfig';
import { CARS, LAB_CARS, cloneCar } from '../data/cars/index';
import type { CarConfig, TrackConfig } from '../data/schema';
import { TRACKS, findTrack } from '../data/tracks/index';
import { DragAI, type AiLevel } from '../game/ai/DragAI';
import { RACE_DISTANCES, RaceController, type LaneResult, type RaceDistanceId, type RaceLane, type TreeType } from '../game/race/RaceController';
import type { CameraMode, RenderVehicle, TrackMarker, TreeLights } from '../game/scenes/RaceScene';
import { PHYSICS_DT, SimulationRunner } from '../game/SimulationRunner';
import { TelemetryRecorder } from '../telemetry/TelemetryRecorder';
import type { AppContext, Mode } from '../app/Mode';
import type { AppSettings } from '../app/settings';
import { VehicleViews } from '../app/vehicleView';
import { clear, downloadText, fmt, h, speedUnit, toast } from '../ui/dom';
import { Hud } from '../ui/Hud';
import { SHIFT_MESSAGES } from './SandboxMode';

const CAMERAS: CameraMode[] = ['follow', 'wide', 'start'];
const AI_LABELS: Record<AiLevel, string> = { beginner: 'iniciante', intermediate: 'intermediário', advanced: 'avançado' };

export interface RunRecord {
  id?: number;
  date: string;
  carId: string;
  carName: string;
  trackId: string;
  distance: RaceDistanceId;
  tree: TreeType;
  opponent: string | null;
  result: LaneResult;
  won: boolean | null;
}

export interface BestRecord {
  key: string;
  carName: string;
  et: number;
  trapMs: number | null;
  rt: number | null;
  date: string;
}

export function recordKey(carId: string, distance: RaceDistanceId, trackId: string): string {
  return `${carId}|${distance}|${trackId}`;
}

/** Drag race: christmas tree, reaction time, splits, trap speeds, AI opponent, records. */
export class RaceMode implements Mode {
  readonly id = 'race';
  readonly label = 'Corrida';
  readonly usesTrack = true;
  cameraMode: CameraMode = 'follow';

  private ctx!: AppContext;
  private runner!: SimulationRunner;
  private race: RaceController | null = null;
  private readonly views = new VehicleViews();
  private hud: Hud | null = null;
  private playerCar: CarConfig = cloneCar(CARS[2] ?? CARS[0]!);
  private opponentCar: CarConfig | null = cloneCar(CARS[3] ?? CARS[0]!);
  private aiLevel: AiLevel = 'intermediate';
  private distance: RaceDistanceId = 'quarter';
  private treeType: TreeType = 'pro';
  private trackCfg: TrackConfig = findTrack('test-track');
  private seed = 1;
  private offs: (() => void)[] = [];
  private renderList: RenderVehicle[] = [];
  private markerList: TrackMarker[] = [];
  private resultCard: HTMLElement | null = null;
  private banner: HTMLElement | null = null;
  private resultsHost: HTMLElement | null = null;
  private recordsHost: HTMLElement | null = null;
  private saved = false;
  private message = '';
  private messageT = 0;
  readonly recorder = new TelemetryRecorder();

  mount(ctx: AppContext): void {
    this.ctx = ctx;
    this.runner = new SimulationRunner(this.trackCfg);
    this.hud = new Hud(ctx.hud);
    this.banner = h('div', { class: 'banner', 'data-testid': 'race-status' }, '');
    ctx.overlay.append(this.banner);
    this.buildPanel();
    const inp = ctx.input;
    this.offs.push(
      inp.on('upshift', () => this.shift(1)),
      inp.on('downshift', () => this.shift(-1)),
      inp.on('restart', () => this.newRace()),
      inp.on('pause', () => (this.runner.paused = !this.runner.paused)),
      inp.on('camera', () => (this.cameraMode = CAMERAS[(CAMERAS.indexOf(this.cameraMode) + 1) % CAMERAS.length]!)),
    );
    this.newRace();
  }

  unmount(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.runner.dispose();
    this.hud?.dispose();
    this.banner?.remove();
    this.resultCard?.remove();
    clear(this.ctx.panel);
  }

  private shift(dir: 1 | -1): void {
    const p = this.runner.player;
    if (!p || this.race?.phase === 'finished') return;
    const msg = SHIFT_MESSAGES[p.sim.requestShift(dir)];
    if (msg) {
      this.message = msg;
      this.messageT = 2;
    }
  }

  /** Builds a fresh race: new simulations at the line, new tree, new AI reaction draw. */
  newRace(): void {
    this.resultCard?.remove();
    this.resultCard = null;
    this.saved = false;
    const sounds = new Map(this.runner.vehicles.map((v) => [v.id, v.sound] as const));
    for (const v of this.runner.vehicles) v.sound = null;
    for (const v of [...this.runner.vehicles]) this.runner.remove(v.id);
    for (const [id, s] of sounds) if (id !== 'player' && id !== 'opponent') s?.dispose();
    this.runner.afterStep.length = 0;
    this.runner.resetAll();
    this.runner.setTrack(this.trackCfg);
    this.ctx.input.pedal = 0;

    const p = this.runner.add(cloneCar(this.playerCar), { id: 'player', lane: 0, isPlayer: true, sound: sounds.get('player') ?? null });
    // the player's pedal advances exactly once per physics step (frame-rate independent)
    const lanes: RaceLane[] = [{ sim: p.sim, ai: null, pedal: () => this.ctx.input.updatePedal(PHYSICS_DT), name: 'Você' }];
    if (this.opponentCar) {
      const opp = this.runner.add(cloneCar(this.opponentCar), { id: 'opponent', lane: 1, isPlayer: false, sound: sounds.get('opponent') ?? null });
      lanes.push({ sim: opp.sim, ai: new DragAI(opp.sim.car, this.aiLevel, 1000 + this.seed), name: `IA ${AI_LABELS[this.aiLevel]}` });
      this.views.names.set('opponent', `${opp.sim.car.name} (IA ${AI_LABELS[this.aiLevel]})`);
    } else sounds.get('opponent')?.dispose();
    this.seed++;
    const race = new RaceController(lanes, this.distance, this.treeType, this.seed);
    this.race = race;
    p.control = (hh) => race.beforeStep(hh);
    this.runner.afterStep.push((hh) => {
      race.afterStep(hh);
      this.views.latch(this.runner.vehicles);
      if (this.recorder.recording) this.recorder.sample(p.sim);
    });
    // voices: reconfigure kept ones, create missing ones
    for (const v of this.runner.vehicles) {
      if (v.sound) {
        v.sound.setConfig(carToAcousticConfig(v.sim.car, this.quality(v.isPlayer), v.isPlayer ? 11 : 23));
        v.sound.setAmbient(this.trackCfg.ambientTempC + 273.15);
        v.sound.reset();
      }
    }
    this.onAudioReady();
    this.recorder.start({ modo: 'corrida', carro: this.playerCar.name, pista: this.trackCfg.name, distancia: RACE_DISTANCES[this.distance].label, arvore: this.treeType });
    this.rebuildMarkers();
    this.renderResults();
  }

  private quality(player: boolean): AppSettings['audioQuality'] {
    return player || !this.ctx.settings.opponentLowQuality ? this.ctx.settings.audioQuality : 'low';
  }

  onAudioReady(): void {
    const a = this.ctx?.audio;
    if (!a || !a.running) return;
    for (const v of this.runner.vehicles) {
      if (v.sound) continue;
      try {
        v.sound = new VehicleSound(a, carToAcousticConfig(v.sim.car, this.quality(v.isPlayer), v.isPlayer ? 11 : 23), v.id, 0.05, this.trackCfg.ambientTempC + 273.15);
      } catch (e) {
        toast(`Falha ao criar voz de áudio: ${e instanceof Error ? e.message : String(e)}`, 'error');
      }
    }
  }

  onSettingsChanged(key: keyof AppSettings): void {
    if (key === 'audioQuality' || key === 'opponentLowQuality') for (const v of this.runner.vehicles) v.sound?.setQuality(this.quality(v.isPlayer));
    if (key === 'units') this.renderResults();
  }

  // ---------------------------------------------------------------- panel

  private buildPanel(): void {
    const panel = this.ctx.panel;
    clear(panel);
    const sel = <T extends string>(testid: string, opts: [T, string][], value: T, on: (v: T) => void): HTMLSelectElement =>
      h(
        'select',
        { 'data-testid': testid, onchange: (e: Event) => on((e.target as HTMLSelectElement).value as T) },
        opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l)),
      ) as HTMLSelectElement;
    const cars = LAB_CARS.map((c) => [c.id, c.name] as [string, string]);
    this.resultsHost = h('div', { 'data-testid': 'results' });
    this.recordsHost = h('div', { 'data-testid': 'records' });
    panel.append(
      h('h2', {}, 'Corrida de arrancada'),
      h('div', { class: 'row' }, h('label', {}, 'Seu carro'), sel('race-car', cars, this.playerCar.id, (v) => this.setCar(v, false))),
      h('div', { class: 'row' }, h('label', {}, 'Adversário'), sel('race-opponent', [['', '— corrida solo —'], ...cars], this.opponentCar?.id ?? '', (v) => this.setCar(v, true))),
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Nível da IA'),
        sel('race-ai', Object.entries(AI_LABELS) as [AiLevel, string][], this.aiLevel, (v) => {
          this.aiLevel = v;
          this.newRace();
        }),
      ),
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Distância'),
        sel('race-distance', Object.entries(RACE_DISTANCES).map(([k, d]) => [k as RaceDistanceId, d.label]), this.distance, (v) => {
          this.distance = v;
          this.newRace();
        }),
      ),
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Árvore'),
        sel<TreeType>('race-tree', [['pro', 'Pro (0,4 s)'], ['sportsman', 'Sportsman (0,5 s por âmbar)']], this.treeType, (v) => {
          this.treeType = v;
          this.newRace();
        }),
      ),
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Pista'),
        sel('race-track', TRACKS.map((t) => [t.id, t.name] as [string, string]), this.trackCfg.id, (v) => {
          this.trackCfg = findTrack(v);
          this.newRace();
        }),
      ),
      h('div', { class: 'row' }, h('button', { class: 'primary', 'data-testid': 'new-race', onclick: () => this.newRace() }, 'Nova corrida (R)'), h('button', { onclick: () => this.exportCsv() }, 'Exportar telemetria CSV')),
      h(
        'div',
        { class: 'hint' },
        'Pressione ',
        h('span', { class: 'keycap' }, 'E'),
        ' para engatar a 1ª e estagiar. Na luz verde acelere com ',
        h('span', { class: 'keycap' }, 'W'),
        '/',
        h('span', { class: 'keycap' }, '↑'),
        ' e troque com ',
        h('span', { class: 'keycap' }, 'E'),
        '/',
        h('span', { class: 'keycap' }, 'Q'),
        '. Acelerar antes do verde tira o carro do estágio (queima a largada). Após a chegada o carro freia sozinho.',
      ),
      h('h3', {}, 'Resultado'),
      this.resultsHost,
      h('h3', {}, 'Recordes (melhor ET por carro, distância e pista)'),
      this.recordsHost,
    );
    void this.renderRecords();
  }

  private setCar(id: string, opponent: boolean): void {
    const c = LAB_CARS.find((x) => x.id === id);
    if (opponent) this.opponentCar = c ? cloneCar(c) : null;
    else if (c) this.playerCar = cloneCar(c);
    this.newRace();
  }

  private exportCsv(): void {
    if (this.recorder.count === 0) {
      toast('Nada gravado ainda.', 'error');
      return;
    }
    const r = this.race;
    const res = r?.results[0];
    const notes = [
      `tempo real não simulado (quadros > 0.25 s): ${this.runner.stats.droppedRealTimeS.toFixed(3)} s`,
      `verde em t = ${r?.greenAt?.toFixed(4) ?? '—'} s (tempo da corrida)`,
      `RT ${fmt(res?.rt, 3)} s, ET ${fmt(res?.et, 3)} s`,
      `marchas usadas ${res?.gearsUsed?.join('-') ?? '—'}, rotação máx. ${fmt(res?.maxRpm, 0)} rpm, patinagem acumulada ${fmt(res?.slipM, 2)} m`,
    ];
    downloadText(`corrida-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`, this.recorder.toCsv(notes), 'text/csv');
  }

  private resultTable(): HTMLElement {
    const race = this.race;
    if (!race) return h('div');
    const su = speedUnit(this.ctx.settings.units);
    const lanes = race.raceLanes;
    const res = race.results;
    const head = h('tr', {}, h('th', {}, ''), lanes.map((l, i) => h('th', { class: race.winner === i ? 'win' : '' }, l.name)));
    const row = (label: string, f: (r: LaneResult) => string): HTMLElement => h('tr', {}, h('td', {}, label), res.map((r) => h('td', {}, f(r))));
    const rows: HTMLElement[] = [
      row('Reação (RT)', (r) => (r.rt === null ? '—' : `${r.rt.toFixed(3)}${r.redLight ? ' ✖' : ''}`)),
    ];
    for (const s of race.splits) {
      rows.push(row(s.label, (r) => fmt(r.splits[s.id], 3)));
      if (s.trap) rows.push(row(`  velocidade ${s.label}`, (r) => (r.traps[s.id] === undefined ? '—' : `${(r.traps[s.id]! * su.k).toFixed(1)} ${su.label}`)));
    }
    rows.push(row('ET', (r) => (r.dnf ? 'DNF' : fmt(r.et, 3))));
    rows.push(row('Vel. máx.', (r) => `${(r.maxSpeedMs * su.k).toFixed(1)} ${su.label}`));
    rows.push(row('Marchas usadas', (r) => (r.gearsUsed && r.gearsUsed.length > 0 ? r.gearsUsed.join('·') : '—')));
    rows.push(row('Rotação máx.', (r) => (r.maxRpm === undefined ? '—' : `${r.maxRpm.toFixed(0)} rpm`)));
    rows.push(row('Patinagem acumulada', (r) => (r.slipM === undefined ? '—' : `${r.slipM.toFixed(1)} m`)));
    return h('table', { class: 'results' }, h('thead', {}, head), h('tbody', {}, rows));
  }

  private renderResults(): void {
    if (!this.resultsHost) return;
    clear(this.resultsHost);
    this.resultsHost.append(this.resultTable());
  }

  private async renderRecords(): Promise<void> {
    const host = this.recordsHost;
    if (!host) return;
    let recs: BestRecord[] = [];
    let runs: RunRecord[] = [];
    try {
      recs = await this.ctx.store.getAll<BestRecord>('records');
      runs = await this.ctx.store.getAll<RunRecord>('runs');
    } catch {
      /* store unavailable */
    }
    clear(host);
    const prefix = `|${this.distance}|${this.trackCfg.id}`;
    const mine = recs.filter((r) => r.key.endsWith(prefix)).sort((a, b) => a.et - b.et);
    if (mine.length === 0) host.append(h('div', { class: 'hint' }, 'Nenhum recorde nesta distância e pista.'));
    else
      host.append(
        h(
          'table',
          { class: 'results' },
          h('tr', {}, h('th', {}, 'Carro'), h('th', {}, 'ET'), h('th', {}, 'RT'), h('th', {}, 'Data')),
          mine.map((r) => h('tr', {}, h('td', {}, r.carName), h('td', {}, r.et.toFixed(3)), h('td', {}, fmt(r.rt, 3)), h('td', {}, r.date.slice(0, 10)))),
        ),
      );
    host.append(h('div', { class: 'hint' }, `${runs.length} corrida(s) registradas no histórico.`));
  }

  private async saveRun(): Promise<void> {
    const race = this.race;
    if (!race || this.saved) return;
    this.saved = true;
    const r = race.results[0]!;
    const run: RunRecord = {
      date: new Date().toISOString(),
      carId: this.playerCar.id,
      carName: this.playerCar.name,
      trackId: this.trackCfg.id,
      distance: this.distance,
      tree: this.treeType,
      opponent: this.opponentCar ? `${this.opponentCar.name} (${AI_LABELS[this.aiLevel]})` : null,
      result: structuredClone(r),
      won: race.raceLanes.length > 1 ? race.winner === 0 : null,
    };
    try {
      await this.ctx.store.put('runs', run);
      if (r.finished && !r.redLight && r.et !== null) {
        const key = recordKey(this.playerCar.id, this.distance, this.trackCfg.id);
        const prev = await this.ctx.store.get<BestRecord>('records', key);
        if (!prev || r.et < prev.et) {
          await this.ctx.store.put('records', { key, carName: this.playerCar.name, et: r.et, trapMs: r.trapMs, rt: r.rt, date: run.date } satisfies BestRecord);
          toast(prev ? `Novo recorde: ${r.et.toFixed(3)} s (anterior ${prev.et.toFixed(3)} s)` : `Primeiro recorde: ${r.et.toFixed(3)} s`);
        }
      }
    } catch (e) {
      toast(`Falha ao salvar a corrida: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
    await this.renderRecords();
  }

  private showResultCard(): void {
    const race = this.race;
    if (!race || this.resultCard) return;
    this.resultCard = h(
      'div',
      { class: 'resultcard', 'data-testid': 'result-card' },
      h('h2', {}, race.status),
      this.resultTable(),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => this.newRace() }, 'Correr de novo (R)')),
    );
    this.ctx.overlay.append(this.resultCard);
  }

  // ---------------------------------------------------------------- per frame

  private rebuildMarkers(): void {
    const race = this.race;
    this.markerList = race ? race.splits.map((s) => ({ xM: s.m, label: s.label, major: s.trap })) : [];
  }

  private lastRendered = '';

  tick(dtS: number): void {
    this.runner.advance(dtS);
    this.renderList = this.views.render(this.runner.vehicles, dtS);
    this.views.spatialize(this.runner.vehicles, dtS);
    const race = this.race;
    const p = this.runner.player;
    if (this.messageT > 0) this.messageT -= dtS;
    if (race && p) {
      const opp = this.runner.vehicles.find((v) => v.id === 'opponent');
      const done = race.results[0]?.et != null;
      this.hud?.update(p.sim, this.ctx.settings.units, this.messageT > 0 ? this.message : this.runner.paused ? 'PAUSADO' : '', {
        distanceM: p.sim.x,
        timeS: race.elapsed(0),
        timeLabel: done ? 'ET' : 'tempo',
        gapM: opp ? opp.sim.x - p.sim.x : null,
      });
      if (this.banner) {
        this.banner.textContent = race.status;
        this.banner.style.display = this.resultCard ? 'none' : '';
      }
      // refresh the panel table at most when something changed
      const sig = JSON.stringify(race.results.map((r) => [r.rt, Object.keys(r.splits).length, r.et, r.dnf]));
      if (sig !== this.lastRendered) {
        this.lastRendered = sig;
        this.renderResults();
      }
      if (race.phase === 'finished') {
        if (this.recorder.recording && p.sim.speed < 1) this.recorder.stop();
        this.showResultCard();
        void this.saveRun();
      }
    }
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
  tree(): TreeLights | null {
    return this.race ? this.race.lights() : null;
  }
  finishM(): number | null {
    return this.race?.distanceM ?? null;
  }
}
