import { VehicleSound } from '../audio/core/VehicleSound';
import { carToAcousticConfig } from '../audio/dsp/AcousticConfig';
import { findCampaignCar } from '../data/cars/campaign';
import type { CarConfig, TrackConfig } from '../data/schema';
import { CAREER_TRACKS, findCareerTrack } from '../data/tracks/career';
import { AI_PROFILES, DragAI } from '../game/ai/DragAI';
import { CareerController, parseInventoryEntry } from '../game/career/CareerController';
import { CHAPTER_1_TITLE, EVENTS, REGIONS, findEvent, rivalOf, type CareerEventDef, type RivalDef } from '../game/career/CareerEvents';
import { eventStatus, isChapterComplete, isPartUnlocked, nextEvent, partStatus, stockStatus, canTuneBoost, partRequirements, unlocksOf } from '../game/career/CareerProgression';
import { CareerRepository, CareerTabLock } from '../game/career/CareerRepository';
import { evaluateRace, type Comment } from '../game/career/CareerResultEvaluator';
import { DEFAULT_SLOT, STARTER_CARS, type CareerRaceResult, type OutcomeSchema, type OwnedCar, type RunSummary } from '../game/career/CareerState';
import { SPEAKER_NAME, pendingScenes, type StoryScene, type StoryTrigger } from '../game/career/CareerStory';
import type { RaceRecord } from '../game/career/CareerController';
import { TelemetryProbe, runHeadlessRace } from '../game/career/headlessRace';
import { ownedCarBuild, ownedCarConfig, rivalBuild, rivalCar } from '../game/career/RivalBuildFactory';
import { BUILD_RESOLVER_VERSION, resolveBuild, type BuildResult } from '../game/career/tuning/BuildResolver';
import { CATEGORY_LABEL, CATEGORY_DESCRIPTION, PARTS, UNLOCK_LABEL, WORKSHOP_TABS, findPart, type PartCategory, type PartDef } from '../game/career/tuning/parts';
import { RACE_DISTANCES, RaceController, type LaneResult, type RaceLane } from '../game/race/RaceController';
import { runAccelerationTest } from '../game/race/accelerationTest';
import type { CameraMode, RenderVehicle, TrackMarker, TreeLights } from '../game/scenes/RaceScene';
import { TREE_X_M } from '../game/scenes/worldScale';
import { PHYSICS_DT, SimulationRunner } from '../game/SimulationRunner';
import { EngineDyno, type DynoPoint } from '../physics/engine/EngineDyno';
import type { AppContext, Mode } from '../app/Mode';
import type { AppSettings } from '../app/settings';
import { VehicleViews } from '../app/vehicleView';
import { drawLineChart, drawMessage } from '../ui/charts';
import { clear, downloadText, h, pickTextFile, toast } from '../ui/dom';
import { Hud } from '../ui/Hud';
import { GarageVehiclePreview } from '../ui/garage/GarageVehiclePreview';
import { portraitSvg } from '../ui/career/portraits';
import { SHIFT_MESSAGES } from './SandboxMode';
import '../ui/career/career.css';

type Screen = 'menu' | 'choose' | 'garage' | 'workshop' | 'dyno' | 'events' | 'rival' | 'race' | 'result' | 'ending' | 'history' | 'market';
type Outcome = (typeof OutcomeSchema)['options'][number];

const CAMERAS: CameraMode[] = ['follow', 'wide', 'start'];
const f1 = (v: number): string => v.toFixed(1).replace('.', ',');
const f2 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : v.toFixed(2).replace('.', ','));
const f3 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : v.toFixed(3).replace('.', ','));
const cr = (v: number): string => `${v.toLocaleString('pt-BR')} CR`;

interface Estimate {
  t100: number | null;
  t402: number | null;
}

/**
 * Campaign mode — chapter 1 "Madrugada Zero". Screens are DOM overlays over the night track; the
 * race reuses the RaceController, SimulationRunner, HUD and DragAI of the Race mode. Every change
 * of the career goes through CareerController (atomic, idempotent, validated).
 */
export class CareerMode implements Mode {
  readonly id = 'career';
  readonly label = 'Campanha';
  readonly usesTrack = true;
  cameraMode: CameraMode = 'follow';

  private ctx!: AppContext;
  private runner!: SimulationRunner;
  private readonly views = new VehicleViews();
  private hud: Hud | null = null;
  private race: RaceController | null = null;
  private trackCfg: TrackConfig = CAREER_TRACKS[0]!;
  controller!: CareerController;
  private readonly lock = new CareerTabLock();
  readOnly = false;
  private root!: HTMLElement;
  private banner: HTMLElement | null = null;
  private warn: HTMLElement | null = null;
  screen: Screen = 'menu';
  private offs: (() => void)[] = [];
  private renderList: RenderVehicle[] = [];
  private markerList: TrackMarker[] = [];
  private previews: GarageVehiclePreview[] = [];
  private workshopTab = WORKSHOP_TABS[0]!.id;
  private selectedPart: string | null = null;
  private readonly estimates = new Map<string, Estimate>();
  private seed = 1;
  /** Race in progress. */
  private current: {
    event: CareerEventDef;
    rival: RivalDef;
    attemptId: string;
    playerCar: CarConfig;
    rivalCarCfg: CarConfig;
    probes: [TelemetryProbe, TelemetryProbe];
    recorded: boolean;
    playerBuild: BuildResult;
  } | null = null;
  lastRecord: RaceRecord | null = null;
  private lastComments: Comment[] = [];
  /** Test hook: the player's lane is driven by the advanced AI profile. */
  autopilot = false;
  /** Ready promise for the tests. */
  ready: Promise<void> = Promise.resolve();

  mount(ctx: AppContext): void {
    this.ctx = ctx;
    this.runner = new SimulationRunner(this.trackCfg);
    this.root = h('div', { class: 'career', 'data-testid': 'career' });
    ctx.overlay.append(this.root);
    clear(ctx.panel);
    ctx.panel.append(h('h2', {}, 'Campanha'), h('div', { class: 'hint' }, 'Capítulo 1 — Madrugada Zero. Use a tela central para navegar.'));
    const inp = ctx.input;
    this.offs.push(
      inp.on('upshift', () => this.shift(1)),
      inp.on('downshift', () => this.shift(-1)),
      inp.on('pause', () => (this.runner.paused = !this.runner.paused)),
      inp.on('camera', () => (this.cameraMode = CAMERAS[(CAMERAS.indexOf(this.cameraMode) + 1) % CAMERAS.length]!)),
    );
    this.controller = new CareerController(new CareerRepository(ctx.store, DEFAULT_SLOT));
    this.ready = this.boot();
  }

  private async boot(): Promise<void> {
    const got = await this.lock.acquire(DEFAULT_SLOT);
    this.readOnly = !got;
    if (!this.ctx.store.persistent) this.showWarning('Armazenamento indisponível: NADA desta campanha será salvo ao fechar a página.');
    else if (this.readOnly) this.showWarning('Esta campanha já está aberta em outra aba. Aqui ela fica só para leitura.');
    try {
      await this.controller.load();
    } catch (e) {
      this.showWarning(`O save da campanha não pôde ser lido: ${(e as Error).message}`);
    }
    this.show('menu');
  }

  unmount(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.clearRace();
    this.runner.dispose();
    this.hud?.dispose();
    this.hud = null;
    this.banner?.remove();
    this.root.remove();
    this.warn?.remove();
    this.disposePreviews();
    this.lock.releaseLock();
    clear(this.ctx.panel);
  }

  private showWarning(text: string): void {
    this.warn?.remove();
    this.warn = h('div', { class: 'career-warning', 'data-testid': 'career-warning' }, text);
    this.ctx.overlay.append(this.warn);
  }

  private shift(dir: 1 | -1): void {
    if (this.screen !== 'race' || this.autopilot) return;
    const p = this.runner.player;
    if (!p || this.race?.phase === 'finished') return;
    const msg = SHIFT_MESSAGES[p.sim.requestShift(dir)];
    if (msg) toast(msg);
  }

  // ------------------------------------------------------------------ screens

  private disposePreviews(): void {
    this.previews = [];
  }

  private preview(car: CarConfig, w: number, hgt: number, backdrop: 'studio' | 'plain' = 'studio'): HTMLCanvasElement {
    const p = new GarageVehiclePreview(backdrop);
    this.previews.push(p);
    p.resize(w, hgt);
    void p.setCar(car);
    return p.canvas;
  }

  /** Renders a screen. Scenes for the trigger play first when they are pending. */
  show(screen: Screen): void {
    this.screen = screen;
    this.disposePreviews();
    clear(this.root);
    this.root.classList.toggle('hidden', screen === 'race');
    this.root.dataset.screen = screen;
    const s = this.controller.save;
    if (screen !== 'race' && screen !== 'menu' && screen !== 'choose' && !s) screen = 'menu';
    const body = this.renderScreen(screen);
    this.root.append(body);
  }

  private renderScreen(screen: Screen): HTMLElement {
    switch (screen) {
      case 'menu':
        return this.menuScreen();
      case 'choose':
        return this.chooseScreen();
      case 'garage':
        return this.garageScreen();
      case 'workshop':
        return this.workshopScreen();
      case 'dyno':
        return this.dynoScreen();
      case 'events':
        return this.eventsScreen();
      case 'rival':
        return this.rivalScreen();
      case 'result':
        return this.resultScreen();
      case 'ending':
        return this.endingScreen();
      case 'history':
        return this.historyScreen();
      case 'market':
        return this.marketScreen();
      default:
        return h('div');
    }
  }

  private frame(title: string, testid: string, ...children: (HTMLElement | string | null)[]): HTMLElement {
    const s = this.controller.save;
    const status = s
      ? h(
          'div',
          { class: 'career-status' },
          h('span', { 'data-testid': 'career-credits' }, cr(s.credits)),
          h('span', { 'data-testid': 'career-reputation' }, `Reputação ${s.reputation}`),
          h('span', {}, `${s.completedEventIds.length}/7 noites`),
        )
      : null;
    return h(
      'div',
      { class: 'career-screen', 'data-testid': testid },
      h('header', {}, h('div', { class: 'career-title' }, h('small', {}, `Capítulo 1 · ${CHAPTER_1_TITLE}`), h('h1', {}, title)), status),
      h('div', { class: 'career-body' }, ...children.filter((c): c is HTMLElement | string => c !== null)),
    );
  }

  private nav(...items: [string, string, () => void, boolean?][]): HTMLElement {
    return h(
      'nav',
      { class: 'career-nav' },
      items.map(([label, testid, on, primary]) => h('button', { class: primary ? 'primary' : '', 'data-testid': testid, onclick: on }, label)),
    );
  }

  private guard(): boolean {
    if (this.readOnly) {
      toast('Campanha aberta em outra aba: só leitura.', 'error');
      return false;
    }
    return true;
  }

  private menuScreen(): HTMLElement {
    const s = this.controller.save;
    const prog = s
      ? h(
          'div',
          { class: 'career-progress' },
          h('div', { class: 'bar' }, h('i', { style: `width:${(s.completedEventIds.length / 7) * 100}%` })),
          h('span', {}, isChapterComplete(s) ? 'Capítulo concluído' : `Próxima noite: ${nextEvent(s)?.title ?? '—'}`),
        )
      : h('div', { class: 'hint' }, 'Nenhuma campanha salva.');
    return this.frame(
      'Campanha',
      'career-menu',
      h(
        'div',
        { class: 'career-menu' },
        h('div', { class: 'career-portrait-lg' }, portraitEl('nina')),
        h(
          'div',
          { class: 'career-menu-main' },
          h('p', { class: 'lead' }, 'Sete noites. Três regiões. Um carro de rua e o que você souber fazer com ele.'),
          prog,
          this.nav(
            ['Nova campanha', 'career-new', () => this.confirmNew(), !s],
            ...(s
              ? ([
                  ['Continuar', 'career-continue', () => this.continueCareer(), true],
                  ['Garagem', 'career-garage', () => this.show('garage')],
                  ['Histórico', 'career-history', () => this.show('history')],
                  ['Exportar save', 'career-export', () => this.exportSave()],
                ] as [string, string, () => void, boolean?][])
              : []),
            ['Importar save', 'career-import', () => void this.importSave()],
            ['Voltar', 'career-back', () => this.ctx.switchMode?.('sandbox')],
          ),
        ),
      ),
    );
  }

  private confirmNew(): void {
    if (!this.guard()) return;
    if (this.controller.save && !confirm('Começar uma nova campanha apaga a atual. Continuar?')) return;
    this.show('choose');
  }

  private continueCareer(): void {
    const s = this.controller.save!;
    if (isChapterComplete(s) && s.seenStorySceneIds.includes('completion')) this.show('garage');
    else if (isChapterComplete(s)) this.show('ending');
    else this.show('garage');
  }

  private exportSave(): void {
    try {
      downloadText(`campanha-${new Date().toISOString().slice(0, 10)}.json`, this.controller.exportJson(), 'application/json');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  private async importSave(): Promise<void> {
    if (!this.guard()) return;
    const text = await pickTextFile();
    if (!text) return;
    if (this.controller.save && !confirm('Importar substitui a campanha atual. Continuar?')) return;
    const r = await this.controller.importJson(text);
    if (!r.ok) toast(r.error, 'error');
    else {
      toast('Campanha importada.');
      this.show('menu');
    }
  }

  private chooseScreen(): HTMLElement {
    const cards = STARTER_CARS.map((s) => {
      const car = findCampaignCar(s.baseCarId)!;
      return h(
        'div',
        { class: 'career-card starter', 'data-testid': `starter-${s.baseCarId}` },
        this.preview(car, 360, 170),
        h('h3', {}, car.name),
        h('div', { class: 'spec' }, `${car.engine.ratedPowerCv.toLocaleString('pt-BR')} cv · ${Math.max(...car.engine.torqueCurve.torqueNm).toFixed(0)} N·m · ${car.massKg} kg · tração ${car.drivenAxle === 'rear' ? 'traseira' : 'dianteira'}`),
        h('p', { class: 'hint' }, car.description),
        h('div', { class: 'price' }, cr(s.price)),
        h('button', { class: 'primary', 'data-testid': `choose-${s.baseCarId}`, onclick: () => void this.startCareer(s.baseCarId) }, 'Comprar este carro'),
      );
    });
    return this.frame(
      'Escolha o primeiro carro',
      'career-choose',
      h('p', { class: 'lead' }, 'Você tem 4.500 CR. O que sobrar vai para a oficina. Todos estão exatamente como saíram de fábrica.'),
      h('div', { class: 'career-grid three' }, cards),
      this.nav(['Voltar', 'choose-back', () => this.show('menu')]),
    );
  }

  private async startCareer(baseCarId: string): Promise<void> {
    if (!this.guard()) return;
    const r = await this.controller.newCareer(baseCarId, { overwrite: true });
    if (!r.ok) {
      toast(r.error, 'error');
      return;
    }
    this.estimates.clear();
    this.playScenes('start', undefined, () => this.show('garage'));
  }

  // ------------------------------------------------------------------ dialogue

  /** Plays the pending scenes of a trigger, marks them seen, then continues. */
  playScenes(trigger: StoryTrigger, eventId: string | undefined, then: () => void): void {
    const s = this.controller.save;
    const scenes = s ? pendingScenes(trigger, s.seenStorySceneIds, eventId) : [];
    if (!scenes.length) {
      then();
      return;
    }
    this.dialogue(scenes, then);
  }

  private dialogue(scenes: StoryScene[], then: () => void): void {
    const lines = scenes.flatMap((sc) => sc.lines);
    let i = 0;
    const host = h('div', { class: 'career-dialogue', 'data-testid': 'career-dialogue' });
    const finish = (): void => {
      host.remove();
      void this.controller.markScenesSeen(scenes.map((x) => x.id)).catch(() => undefined);
      then();
    };
    const render = (): void => {
      clear(host);
      const l = lines[i]!;
      host.append(
        h(
          'div',
          { class: 'dlg-box' },
          h('div', { class: 'dlg-portrait' }, portraitEl(l.speaker)),
          h(
            'div',
            { class: 'dlg-text' },
            h('div', { class: 'dlg-name' }, SPEAKER_NAME[l.speaker]),
            h('p', { 'data-testid': 'dialogue-line' }, l.text),
            h(
              'div',
              { class: 'row' },
              h('button', { class: 'primary', 'data-testid': 'dialogue-next', onclick: () => (++i < lines.length ? render() : finish()) }, i < lines.length - 1 ? 'Continuar' : 'Fechar'),
              h('button', { 'data-testid': 'dialogue-skip', onclick: finish }, 'Pular'),
            ),
          ),
        ),
      );
    };
    render();
    this.ctx.overlay.append(host);
  }

  // ------------------------------------------------------------------ garage

  private carStats(b: BuildResult): HTMLElement {
    if (!b.ok) return h('div', { class: 'error' }, b.errors.join('; '));
    const c = b.car;
    const e = c.engine;
    return h(
      'dl',
      { class: 'career-stats' },
      h('dt', {}, 'Potência'),
      h('dd', { 'data-testid': 'stat-power' }, `${b.peakPowerCv.toFixed(0)} cv`),
      h('dt', {}, 'Torque'),
      h('dd', { 'data-testid': 'stat-torque' }, `${b.peakTorqueNm.toFixed(0)} N·m`),
      h('dt', {}, 'Limite de giro'),
      h('dd', {}, `${e.revLimitRpm} rpm`),
      h('dt', {}, 'Alimentação'),
      h('dd', {}, e.induction === 'turbo' ? `turbo ${f2(e.turbo!.maxBoostBar)} bar` : 'aspirado'),
      h('dt', {}, 'Massa'),
      h('dd', {}, `${c.massKg} kg`),
      h('dt', {}, 'Tração'),
      h('dd', {}, c.drivenAxle === 'rear' ? 'traseira' : 'dianteira'),
      h('dt', {}, 'Embreagem'),
      h('dd', {}, `${c.transmission.clutch.maxTorqueNm} N·m`),
      h('dt', {}, 'Relação final'),
      h('dd', {}, c.transmission.finalDrive.toFixed(3).replace('.', ',')),
      h('dt', {}, 'Pneus (μ)'),
      h('dd', {}, c.tires.muPeak.toFixed(2).replace('.', ',')),
    );
  }

  private garageScreen(): HTMLElement {
    const s = this.controller.save!;
    const car = this.controller.activeCar!;
    const b = ownedCarBuild(car);
    const cfg = ownedCarConfig(car);
    const stock = resolveBuild(findCampaignCar(car.baseCarId)!, []);
    const nxt = nextEvent(s);
    const others = s.ownedCars.filter((c) => c.id !== car.id);
    const workshopOpen = unlocksOf(s).has('workshop-basic');
    return this.frame(
      'Garagem',
      'career-garage-screen',
      h(
        'div',
        { class: 'career-garage' },
        h(
          'div',
          { class: 'career-col wide' },
          this.preview(cfg, 620, 260),
          h('h2', { 'data-testid': 'garage-car-name' }, car.nickname === findCampaignCar(car.baseCarId)!.name ? car.nickname : `${car.nickname} — ${findCampaignCar(car.baseCarId)!.name}`),
          h('div', { class: 'hint' }, car.installedParts.length ? `Peças: ${car.installedParts.map((id) => findPart(id)?.name ?? id).join(', ')}` : 'Original de fábrica, sem peças instaladas.'),
          others.length
            ? h(
                'div',
                { class: 'row' },
                h('label', {}, 'Outros carros'),
                others.map((o) => h('button', { onclick: () => void this.controller.setActiveCar(o.id).then(() => this.show('garage')) }, o.nickname)),
              )
            : null,
        ),
        h(
          'div',
          { class: 'career-col' },
          h('h3', {}, 'Ficha'),
          this.carStats(b),
          stock.ok && b.ok && car.installedParts.length
            ? h('div', { class: 'hint' }, `Original: ${stock.peakPowerCv.toFixed(0)} cv / ${stock.peakTorqueNm.toFixed(0)} N·m`)
            : null,
          h('h3', {}, 'Próxima noite'),
          nxt
            ? h('div', { class: 'career-next', 'data-testid': 'garage-next-event' }, `${nxt.order}. ${nxt.title} — ${rivalOf(nxt).name} "${rivalOf(nxt).nickname}", ${RACE_DISTANCES[nxt.distance].label}, ${nxt.regionLabel}`)
            : h('div', { class: 'career-next' }, 'Capítulo concluído.'),
        ),
      ),
      this.nav(
        ['Eventos', 'garage-events', () => this.show('events'), true],
        ...((workshopOpen ? [['Oficina', 'garage-workshop', () => this.playScenes('workshop', undefined, () => this.show('workshop'))]] : []) as [string, string, () => void][]),
        ['Dinamômetro', 'garage-dyno', () => this.show('dyno')],
        ['Classificados', 'garage-market', () => this.show('market')],
        ['Histórico', 'garage-history', () => this.show('history')],
        ...((isChapterComplete(s) ? [['Final do capítulo', 'garage-ending', () => this.show('ending')]] : []) as [string, string, () => void][]),
        ['Menu', 'garage-menu', () => this.show('menu')],
      ),
    );
  }

  private marketScreen(): HTMLElement {
    const s = this.controller.save!;
    return this.frame(
      'Classificados',
      'career-market',
      h('p', { class: 'lead' }, 'Carros de rua à venda na região, originais. As peças compradas ficam com o carro para o qual foram compradas.'),
      h(
        'div',
        { class: 'career-grid three' },
        STARTER_CARS.map((o) => {
          const car = findCampaignCar(o.baseCarId)!;
          return h(
            'div',
            { class: 'career-card' },
            this.preview(car, 320, 150),
            h('h3', {}, car.name),
            h('div', { class: 'price' }, cr(o.price)),
            h(
              'button',
              {
                'data-testid': `market-buy-${o.baseCarId}`,
                disabled: s.credits < o.price,
                onclick: () =>
                  void (async () => {
                    if (!this.guard()) return;
                    const r = await this.controller.buyCar(o.baseCarId);
                    if (!r.ok) toast(r.error, 'error');
                    else toast(`${car.name} comprado. Selecione-o na garagem.`);
                    this.show('market');
                  })(),
              },
              'Comprar',
            ),
          );
        }),
      ),
      this.nav(['Voltar à garagem', 'market-back', () => this.show('garage')]),
    );
  }

  // ------------------------------------------------------------------ workshop

  private estimate(b: BuildResult): Estimate | null {
    if (!b.ok) return null;
    const hit = this.estimates.get(b.key);
    if (hit) return hit;
    return null;
  }

  private computeEstimate(b: BuildResult): Estimate | null {
    if (!b.ok) return null;
    const hit = this.estimates.get(b.key);
    if (hit) return hit;
    const track = findCareerTrack('avenida-norte');
    const r = runAccelerationTest(b.car, track, { speedsKmh: [100], distancesM: [402], maxS: 30 });
    const e = { t100: r.speedTimes.get(100) ?? null, t402: r.distanceTimes.get(402) ?? null };
    this.estimates.set(b.key, e);
    return e;
  }

  /**
   * Workshop layout: build identity / category rail / grouped subcategory cards / inspector.
   * All state comes from CareerSave; stock items represent an empty physical slot.
   */
  private workshopScreen(): HTMLElement {
    const s = this.controller.save!;
    const car = this.controller.activeCar!;
    const tab = WORKSHOP_TABS.find((t) => t.id === this.workshopTab) ?? WORKSHOP_TABS[0]!;
    const before = ownedCarBuild(car);
    const allInTab = PARTS.filter((p) => tab.categories.includes(p.category));
    const stockSel = this.selectedPart?.startsWith('stock:') ? this.selectedPart.slice(6) as PartCategory : null;
    const sel = stockSel ? undefined : (this.selectedPart ? findPart(this.selectedPart) : allInTab[0]);
    const equipped = car.installedParts.map((id) => findPart(id)).filter((p): p is PartDef => !!p);
    const kit = equipped.find((p) => p.category === 'turbo');
    const highestTier = equipped.reduce((top, p) => Math.max(top, 'chapter' in p ? p.chapter : 1), 1);
    const stage = kit ? (highestTier >= 3 ? 'Stage 6 • Turbo preparado' : highestTier === 2 ? 'Stage 5 • Turbo street' : 'Stage 4 • Turbo básico')
      : equipped.length >= 5 ? 'Stage 3 • Aspirado forte' : equipped.length >= 2 ? 'Stage 2 • Aspirado street' : equipped.length ? 'Stage 1 • Rua leve' : 'Original';
    const metric = (label: string, value: string): HTMLElement => h('div', { class: 'ws-metric' }, h('small', {}, label), h('b', {}, value));
    const overview = h(
      'div', { class: 'ws-overview', 'data-testid': 'ws-overview' },
      h('div', { class: 'ws-overview-identity' },
        h('span', { class: 'ws-kicker' }, 'GARAGEM / PREPARAÇÃO'),
        h('h2', {}, car.nickname),
        h('div', { class: 'ws-stage' }, stage)),
      h('div', { class: 'ws-metrics' },
        metric('POTÊNCIA', before.ok ? `${f1(before.peakPowerCv)} cv` : '—'),
        metric('TORQUE', before.ok ? `${f1(before.peakTorqueNm)} N·m` : '—'),
        metric('ASPIRAÇÃO', before.ok && before.car.engine.induction === 'turbo' ? 'Turbo' : 'Aspirado'),
        metric('SALDO', cr(s.credits)),
        metric('REPUTAÇÃO', String(s.reputation)),
        metric('CAPÍTULO', '01 / 03'),
      ),
    );
    const rail = h(
      'aside', { class: 'ws-left' },
      h('div', { class: 'ws-preview' }, this.preview(ownedCarConfig(car), 320, 168)),
      h('span', { class: 'ws-sidebar-title' }, 'SISTEMAS DO VEÍCULO'),
      h(
        'nav', { class: 'ws-tabs', 'aria-label': 'Sistemas da oficina' },
        WORKSHOP_TABS.map((t) => h('button', {
          class: t.id === tab.id ? 'tab active' : 'tab',
          'data-testid': `ws-tab-${t.id}`,
          'aria-pressed': String(t.id === tab.id),
          onclick: () => {
            this.workshopTab = t.id;
            this.selectedPart = null;
            this.show('workshop');
          },
        },
          h('span', { class: 'ws-tab-icon', 'aria-hidden': 'true' }, t.icon),
          h('span', { class: 'ws-tab-copy' }, h('b', {}, t.label), h('small', {}, t.description)),
          h('span', { class: 'ws-tab-count' }, String(car.installedParts.filter((id) => t.categories.includes(findPart(id)?.category as PartCategory)).length)),
        )),
      ),
      h('div', { class: 'ws-rail-footer' }, `${equipped.length} modificações instaladas · ${s.inventoryPartIds.filter((e) => parseInventoryEntry(e).baseCarId === car.baseCarId).length} no estoque`),
    );
    const groups = tab.categories.map((cat, index) => {
      const inSlot = equipped.find((p) => p.category === cat);
      const categoryParts = allInTab.filter((p) => p.category === cat);
      const entries = categoryParts.map((p) => {
        const st = partStatus(s, car, p);
        return h('li', {
          class: `ws-part-card ${sel?.id === p.id ? 'sel' : ''} ${st.state}`,
          'data-testid': `ws-part-${p.id}`,
          'data-state': st.state,
          title: st.detail,
          tabindex: '0', role: 'button',
          onclick: () => { this.selectedPart = p.id; this.show('workshop'); },
          onkeydown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.selectedPart = p.id; this.show('workshop'); }
          },
        },
          h('div', { class: 'ws-part-head' },
            h('span', { class: 'ws-part-name' }, p.name),
            h('span', { class: `pill ${st.state}`, 'data-testid': `ws-pill-${p.id}` }, st.label)),
          h('small', { class: 'ws-part-meta' },
            'chapter' in p ? `CAP. ${p.chapter} · ` : 'CAP. 1 · ',
            st.state === 'locked' ? st.detail : p.physics),
          ('chapter' in p && p.chapter === 1) ? h('span', { class: 'ws-new-tag' }, 'NOVO') : null,
        );
      });
      return h(
        'section', { class: 'ws-group', 'data-testid': `ws-group-${cat}`, 'aria-label': CATEGORY_LABEL[cat] },
        h('div', { class: 'ws-group-header' },
          h('span', { class: 'ws-group-index' }, String(index + 1).padStart(2, '0')),
          h('div', {}, h('h3', {}, CATEGORY_LABEL[cat]), h('p', {}, CATEGORY_DESCRIPTION[cat])),
          h('span', { class: 'ws-installed-slot' }, inSlot ? 'EQUIPADO' : 'ORIGINAL')),
        h('ul', { class: 'ws-parts' },
          this.stockItem(car, cat, stockSel === cat),
          ...entries,
        ),
      );
    });
    const catalog = h(
      'main', { class: 'ws-center' },
      h('div', { class: 'ws-section-title' },
        h('div', {}, h('span', { class: 'ws-kicker' }, 'CATÁLOGO DE COMPONENTES'),
          h('h2', {}, tab.label), h('p', {}, tab.description)),
        h('span', { class: 'ws-count' }, `${tab.categories.length} grupos · ${allInTab.length} upgrades`)),
      ...groups,
    );
    const detail = h(
      'aside', { class: 'ws-right' },
      h('div', { class: 'ws-inspector-head' },
        h('span', { class: 'ws-kicker' }, 'INSPEÇÃO DE HARDWARE'),
        h('span', { class: 'ws-inspector-indicator' }, '● SISTEMA ATIVO')),
      stockSel ? this.stockDetail(stockSel, car, before) :
      sel ? this.partDetail(sel, car, before) :
      h('div', { class: 'hint' }, 'Escolha uma peça para comparar e instalar.'),
    );
    return this.frame('Oficina', 'career-workshop',
      overview,
      h('div', { class: 'ws' }, rail, catalog, detail),
      this.nav(
        ['Dinamômetro', 'ws-dyno', () => this.show('dyno')],
        ...((car.installedParts.length ? [['Restaurar tudo ao original', 'ws-restore-all', () => void this.restoreAll(car.installedParts.length)]] : []) as [string, string, () => void][]),
        ['Voltar à garagem', 'ws-back', () => this.show('garage'), true],
      ),
    );
  }

  private async restoreAll(n: number): Promise<void> {
    if (!this.guard()) return;
    if (!confirm(`Voltar o carro ao original? ${n === 1 ? 'A peça vai' : `As ${n} peças vão`} para o estoque e pode${n === 1 ? '' : 'm'} ser reinstalada${n === 1 ? '' : 's'} depois.`)) return;
    const r = await this.controller.restoreStock();
    if (!r.ok) toast(r.error, 'error');
    else toast('Carro de volta ao original. As peças estão no estoque.');
    this.selectedPart = null;
    this.show('workshop');
  }

  /** List entry of the factory part of a slot. */
  private stockItem(car: OwnedCar, cat: PartCategory, selected: boolean): HTMLElement {
    const st = stockStatus(car, cat, (id) => findPart(id)?.category);
    return h(
      'li',
      {
        class: `stock ${selected ? 'sel' : ''} ${st.state}`,
        'data-testid': `ws-stock-${cat}`,
        'data-state': st.state,
        title: st.detail,
        onclick: () => {
          this.selectedPart = `stock:${cat}`;
          this.show('workshop');
        },
      },
      h('div', { class: 'ws-part-head' }, h('span', {}, `${CATEGORY_LABEL[cat]} original`), h('span', { class: `pill ${st.state}`, 'data-testid': `ws-stock-pill-${cat}` }, st.label)),
      h('small', {}, 'De fábrica · grátis'),
    );
  }

  /** Detail of the factory part of a slot: what the car had from the factory, and the way back. */
  private stockDetail(cat: PartCategory, car: OwnedCar, before: BuildResult): HTMLElement {
    const base = findCampaignCar(car.baseCarId)!;
    const inSlot = car.installedParts.filter((id) => findPart(id)?.category === cat);
    const nextParts = car.installedParts.filter((id) => !inSlot.includes(id));
    const after = resolveBuild(base, nextParts, nextParts.some((id) => findPart(id)?.category === 'turbo') ? (car.tune ?? {}) : {});
    const button = inSlot.length
      ? h(
          'button',
          {
            class: 'primary',
            'data-testid': 'ws-install-stock',
            disabled: !after.ok,
            onclick: () =>
              void (async () => {
                if (!this.guard()) return;
                const r = await this.controller.restoreStock(cat);
                if (!r.ok) toast(r.error, 'error');
                else toast(`${CATEGORY_LABEL[cat]} original instalado. ${inSlot.map((id) => findPart(id)!.name).join(', ')} foi para o estoque.`);
                this.show('workshop');
              })(),
          },
          'Instalar original (grátis)',
        )
      : h('div', { class: 'hint', 'data-testid': 'ws-stock-in-use' }, 'Em uso: o carro está com a peça de fábrica neste item.');
    return h(
      'div',
      { class: 'ws-detail', 'data-testid': 'ws-detail' },
      h('h3', {}, `${CATEGORY_LABEL[cat]} original`),
      h('div', { class: 'price' }, 'Grátis'),
      h('p', {}, stockSpec(base, cat)),
      h('p', { class: 'physics' }, h('b', {}, 'Efeito físico: '), 'nenhuma modificação neste item — o resolvedor devolve exatamente a física de fábrica dele. As peças retiradas ficam no estoque deste carro.'),
      inSlot.length ? this.compareTable(before, after, 'Original') : null,
      h('div', { class: 'row' }, button),
    );
  }

  /** Before/after table with simulated estimates (computed lazily and cached by build key). */
  private compareTable(before: BuildResult, after: BuildResult, afterLabel: string): HTMLElement {
    const cmpHost = h('div', { class: 'ws-compare', 'data-testid': 'ws-compare' });
    const renderCompare = (): void => {
      clear(cmpHost);
      if (!before.ok) return;
      if (!after.ok) {
        cmpHost.append(h('div', { class: 'error', 'data-testid': 'ws-incompatible' }, `Incompatível: ${after.errors.join('; ')}`));
        return;
      }
      const eb = this.estimate(before);
      const ea = this.estimate(after);
      const row = (label: string, a: string, b: string): HTMLElement => h('tr', {}, h('td', {}, label), h('td', {}, a), h('td', {}, b));
      const range = (x: Extract<BuildResult, { ok: true }>): string => {
        const c = x.car.engine.torqueCurve;
        const peak = Math.max(...c.torqueNm);
        const r = c.rpm.filter((_, i) => c.torqueNm[i]! >= peak * 0.9);
        return `${r[0]}–${r[r.length - 1]} rpm`;
      };
      cmpHost.append(
        h(
          'table',
          { class: 'results' },
          h('tr', {}, h('th', {}, ''), h('th', {}, 'Antes'), h('th', {}, afterLabel)),
          row('Potência', `${f1(before.peakPowerCv)} cv`, `${f1(after.peakPowerCv)} cv`),
          row('Torque', `${f1(before.peakTorqueNm)} N·m`, `${f1(after.peakTorqueNm)} N·m`),
          row('Faixa útil (90 % do torque)', range(before), range(after)),
          row('Embreagem', `${before.car.transmission.clutch.maxTorqueNm} N·m`, `${after.car.transmission.clutch.maxTorqueNm} N·m`),
          row('Aderência (μ pico)', f2(before.car.tires.muPeak), f2(after.car.tires.muPeak)),
          row('Relação final', f3(before.car.transmission.finalDrive), f3(after.car.transmission.finalDrive)),
          row('0–100 km/h (estimativa)', eb ? `${f2(eb.t100)} s` : '…', ea ? `${f2(ea.t100)} s` : '…'),
          row('402 m (estimativa)', eb ? `${f2(eb.t402)} s` : '…', ea ? `${f2(ea.t402)} s` : '…'),
        ),
        h('div', { class: 'hint' }, 'Estimativas simuladas com a física do jogo e piloto ideal na Avenida Norte; a corrida real depende da sua largada e das trocas.'),
      );
      if (!eb || !ea)
        setTimeout(() => {
          this.computeEstimate(before);
          this.computeEstimate(after);
          if (cmpHost.isConnected) renderCompare();
        }, 30);
    };
    renderCompare();
    return cmpHost;
  }

  private partDetail(p: PartDef, car: OwnedCar, before: BuildResult): HTMLElement {
    const s = this.controller.save!;
    const installed = car.installedParts.includes(p.id);
    const owned = s.inventoryPartIds.includes(`${p.id}@${car.baseCarId}`);
    const unlocked = isPartUnlocked(s, p);
    const nextParts = installed ? car.installedParts.filter((x) => x !== p.id) : CareerController.withPart(car.installedParts, p.id).parts;
    const tune = nextParts.some((id) => findPart(id)?.category === 'turbo') ? (car.tune ?? {}) : {};
    const after = resolveBuild(findCampaignCar(car.baseCarId)!, nextParts, tune);
    const reqs = partRequirements(p).map((u) => `${UNLOCK_LABEL[u]}${unlocksOf(s).has(u) ? ' ✓' : ''}`);
    const cmpHost = this.compareTable(before, after, installed ? 'Sem a peça' : 'Depois');
    const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string): Promise<void> => {
      if (!this.guard()) return;
      const r = await fn();
      if (!r.ok) toast(r.error ?? 'falhou', 'error');
      else toast(okMsg);
      this.show('workshop');
    };
    const buttons: HTMLElement[] = [];
    if (installed) buttons.push(h('button', { 'data-testid': 'ws-remove', onclick: () => void act(() => this.controller.removePart(p.id), `${p.name} removida (vai para o estoque).`) }, 'Remover'));
    else if (owned) buttons.push(h('button', { class: 'primary', 'data-testid': 'ws-install', onclick: () => void act(() => this.controller.installFromInventory(p.id), `${p.name} instalada.`) }, 'Instalar do estoque'));
    else
      buttons.push(
        h(
          'button',
          { class: 'primary', 'data-testid': 'ws-buy', disabled: !unlocked || s.credits < p.price || !after.ok, onclick: () => void act(() => this.controller.buyPart(p.id), `${p.name} comprada e instalada.`) },
          `Comprar e instalar (${cr(p.price)})`,
        ),
      );
    return h(
      'div',
      { class: 'ws-detail', 'data-testid': 'ws-detail' },
      h('h3', {}, p.name),
      h('div', { class: 'price' }, cr(p.price)),
      h('p', {}, p.description),
      h('p', { class: 'physics' }, h('b', {}, 'Efeito físico: '), p.physics),
      h('div', { class: 'hint' }, `Requisitos: ${reqs.join(' · ')}`),
      h('div', { class: 'hint' }, `Compatibilidade: ${after.ok ? 'compatível com este carro' : 'incompatível no estado atual'}`),
      cmpHost,
      h('div', { class: 'row' }, buttons),
    );
  }

  // ------------------------------------------------------------------ dyno

  private dynoScreen(): HTMLElement {
    const s = this.controller.save!;
    const car = this.controller.activeCar!;
    const b = ownedCarBuild(car);
    const canvas = h('canvas', { class: 'career-dyno-chart', 'data-testid': 'career-dyno-chart' }) as HTMLCanvasElement;
    const info = h('div', { class: 'hint', 'data-testid': 'career-dyno-info' }, 'Medindo no dinamômetro…');
    const tuneRow =
      canTuneBoost(s) && car.installedParts.includes('turbo-basic')
        ? h(
            'div',
            { class: 'row' },
            h('label', {}, 'Pressão do turbo (preparadores)'),
            h('input', {
              type: 'range',
              min: '0.4',
              max: '1.0',
              step: '0.05',
              value: String(car.tune?.boostBar ?? 0.6),
              'data-testid': 'career-boost',
              onchange: (e: Event) =>
                void (async () => {
                  if (!this.guard()) return;
                  const r = await this.controller.setBoost(Number((e.target as HTMLInputElement).value));
                  if (!r.ok) toast(r.error, 'error');
                  this.show('dyno');
                })(),
            }),
            h('span', {}, `${f2(car.tune?.boostBar ?? 0.6)} bar`),
          )
        : null;
    setTimeout(() => this.runDyno(b, canvas, info), 20);
    return this.frame(
      'Dinamômetro',
      'career-dyno',
      h('p', { class: 'lead' }, `${car.nickname}: o dinamômetro mede o motor que está no carro, com as peças instaladas. Os valores vêm do freio do banco, não da ficha.`),
      canvas,
      info,
      tuneRow,
      this.nav(['Voltar à garagem', 'dyno-back', () => this.show('garage'), true]),
    );
  }

  private runDyno(b: BuildResult, canvas: HTMLCanvasElement, info: HTMLElement): void {
    if (!b.ok) {
      drawMessage(canvas, b.errors.join('; '));
      return;
    }
    const e = b.car.engine;
    const d = new EngineDyno(e);
    if (!d.start()) {
      drawMessage(canvas, 'o motor não pegou no banco');
      return;
    }
    const pts: DynoPoint[] = [];
    const rpms: number[] = [];
    for (let r = 1500; r <= e.revLimitRpm; r += 250) rpms.push(r);
    let i = 0;
    const stepChunk = (): void => {
      if (!canvas.isConnected) return;
      for (let k = 0; k < 3 && i < rpms.length; k++, i++) pts.push(d.measure(rpms[i]!, 1, PHYSICS_DT, e.induction === 'turbo' ? 1.5 : 0.6, 0.15));
      drawLineChart(
        canvas,
        [
          { label: 'torque N·m', color: '#f2b705', x: pts.map((p) => p.rpm), y: pts.map((p) => p.torqueNm), points: true },
          { label: 'potência cv', color: '#2bb3ff', x: pts.map((p) => p.rpm), y: pts.map((p) => p.powerCv), right: true, points: true },
        ],
        { xLabel: 'rpm', title: b.car.name, xMin: 1000, xMax: e.revLimitRpm, yMin: 0 },
      );
      if (i < rpms.length) setTimeout(stepChunk, 0);
      else {
        const t = pts.reduce((a, p) => (p.torqueNm > a.torqueNm ? p : a));
        const p = pts.reduce((a, q) => (q.powerCv > a.powerCv ? q : a));
        info.textContent = `Medido: ${f1(t.torqueNm)} N·m a ${t.rpm.toFixed(0)} rpm · ${f1(p.powerCv)} cv a ${p.rpm.toFixed(0)} rpm${b.steadyBoostBar.length ? ` · pressão máx. ${f2(Math.max(...b.steadyBoostBar.map((x) => x.bar)))} bar` : ''}`;
        info.dataset.done = '1';
      }
    };
    stepChunk();
  }

  // ------------------------------------------------------------------ events

  private eventsScreen(): HTMLElement {
    const s = this.controller.save!;
    const label = { locked: 'bloqueado', available: 'disponível', completed: 'concluído', final: 'desafio final' } as const;
    return this.frame(
      'Noites',
      'career-events',
      h(
        'div',
        { class: 'career-regions' },
        REGIONS.map((r) =>
          h(
            'section',
            { class: `region ${r.id}` },
            h('h2', {}, r.label),
            h('div', { class: 'hint' }, r.blurb),
            EVENTS.filter((e) => e.trackId === r.id).map((e) => {
              const st = eventStatus(s, e);
              const rv = rivalOf(e);
              return h(
                'button',
                {
                  class: `career-event ${st}`,
                  'data-testid': `event-${e.id}`,
                  'data-status': st,
                  disabled: st === 'locked',
                  onclick: () => {
                    this.selectedEvent = e.id;
                    this.show('rival');
                  },
                },
                h('div', { class: 'ev-portrait' }, portraitEl(rv.portrait)),
                h('div', {}, h('b', {}, `${e.order}. ${e.title}`), h('small', {}, `${rv.name} "${rv.nickname}" · ${RACE_DISTANCES[e.distance].label} · ${cr(e.rewardCr)}`), h('em', {}, label[st])),
              );
            }),
          ),
        ),
      ),
      this.nav(['Voltar à garagem', 'events-back', () => this.show('garage')]),
    );
  }

  selectedEvent: string | null = null;

  private rivalScreen(): HTMLElement {
    const ev = findEvent(this.selectedEvent ?? '') ?? nextEvent(this.controller.save!) ?? EVENTS[0]!;
    const rv = rivalOf(ev);
    const rb = rivalBuild(rv);
    const s = this.controller.save!;
    const firstWin = !s.claimedRewardIds.includes(`${ev.id}:first`);
    this.trackCfg = findCareerTrack(ev.trackId);
    this.runner.setTrack(this.trackCfg);
    return this.frame(
      ev.finale ? 'Desafio final' : `Noite ${ev.order}`,
      'career-rival',
      h(
        'div',
        { class: 'career-rival' },
        h('div', { class: 'career-portrait-lg' }, portraitEl(rv.portrait)),
        h(
          'div',
          { class: 'rival-info' },
          h('h2', { 'data-testid': 'rival-name' }, `${rv.name} "${rv.nickname}"`),
          h('blockquote', { 'data-testid': 'rival-line' }, `“${rv.lines.before}”`),
          this.preview(rivalCar(rv.id), 460, 190),
          h(
            'dl',
            { class: 'career-stats' },
            h('dt', {}, 'Evento'),
            h('dd', {}, ev.title),
            h('dt', {}, 'Carro'),
            h('dd', {}, rb.car.name),
            h('dt', {}, 'Ficha'),
            h('dd', {}, `${rb.peakPowerCv.toFixed(0)} cv · ${rb.peakTorqueNm.toFixed(0)} N·m · ${rb.car.massKg} kg${rb.car.engine.induction === 'turbo' ? ' · turbo (não original)' : ''}`),
            h('dt', {}, 'Peças'),
            h('dd', {}, rv.parts.length ? rv.parts.map((id) => findPart(id)!.name).join(', ') : 'original de fábrica'),
            h('dt', {}, 'Piloto'),
            h('dd', {}, rv.skillLabel),
            h('dt', {}, 'Distância'),
            h('dd', {}, `${RACE_DISTANCES[ev.distance].label} · ${ev.regionLabel}`),
            h('dt', {}, 'Prêmio'),
            h('dd', { 'data-testid': 'rival-reward' }, firstWin ? `${cr(ev.rewardCr)} + ${ev.reputation} de reputação` : `revanche: ${cr(Math.round((ev.rewardCr * 0.35) / 10) * 10)}`),
          ),
        ),
      ),
      this.nav(
        ['Iniciar corrida', 'rival-start', () => (ev.finale ? this.playScenes('final-challenge', undefined, () => this.startRace(ev)) : this.startRace(ev)), true],
        ['Voltar', 'rival-back', () => this.show('events')],
      ),
    );
  }

  // ------------------------------------------------------------------ race

  private clearRace(): void {
    const sounds = this.runner?.vehicles.map((v) => v.sound) ?? [];
    for (const v of this.runner?.vehicles ?? []) v.sound = null;
    for (const v of [...(this.runner?.vehicles ?? [])]) this.runner.remove(v.id);
    for (const s of sounds) s?.dispose();
    if (this.runner) this.runner.afterStep.length = 0;
    this.race = null;
    this.current = null;
    this.renderList = [];
  }

  startRace(ev: CareerEventDef): void {
    if (!this.guard()) return;
    const owned = this.controller.activeCar;
    if (!owned) return;
    const pb = ownedCarBuild(owned);
    if (!pb.ok) {
      toast(`Build inválido: ${pb.errors.join('; ')}`, 'error');
      return;
    }
    this.clearRace();
    const rv = rivalOf(ev);
    const playerCar = ownedCarConfig(owned);
    const rivalCarCfg = rivalCar(rv.id);
    this.trackCfg = findCareerTrack(ev.trackId);
    this.runner.resetAll();
    this.runner.setTrack(this.trackCfg);
    this.ctx.input.pedal = 0;
    const p = this.runner.add(playerCar, { id: 'player', lane: 0, isPlayer: true });
    const o = this.runner.add(rivalCarCfg, { id: 'opponent', lane: 1, isPlayer: false });
    this.views.names.set('opponent', `${rv.name} "${rv.nickname}"`);
    this.seed++;
    const lanes: RaceLane[] = [
      this.autopilot
        ? { sim: p.sim, ai: new DragAI(p.sim.car, 'advanced', 77 + this.seed, AI_PROFILES.advanced), name: 'Você' }
        : { sim: p.sim, ai: null, pedal: () => this.ctx.input.updatePedal(PHYSICS_DT), name: 'Você' },
      { sim: o.sim, ai: new DragAI(o.sim.car, 'advanced', 500 + this.seed, rv.skill), name: `${rv.name} "${rv.nickname}"` },
    ];
    const race = new RaceController(lanes, ev.distance, 'pro', this.seed);
    this.race = race;
    const probes: [TelemetryProbe, TelemetryProbe] = [new TelemetryProbe(), new TelemetryProbe()];
    this.current = {
      event: ev,
      rival: rv,
      attemptId: `${ev.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`,
      playerCar,
      rivalCarCfg,
      probes,
      recorded: false,
      playerBuild: pb,
    };
    p.control = (hh) => race.beforeStep(hh);
    this.runner.afterStep.push((hh) => {
      race.afterStep(hh);
      this.views.latch(this.runner.vehicles);
      const racing = race.greenAt !== null && race.time >= race.greenAt;
      probes[0].sample(p.sim, racing, hh);
      probes[1].sample(o.sim, racing, hh);
    });
    this.markerList = race.splits.map((s) => ({ xM: s.m, label: s.label, major: s.trap }));
    if (!this.hud) this.hud = new Hud(this.ctx.hud);
    if (!this.banner) {
      this.banner = h('div', { class: 'banner career-banner', 'data-testid': 'race-status' }, '');
      this.ctx.overlay.append(this.banner);
    }
    this.banner.style.display = '';
    this.onAudioReady();
    this.show('race');
  }

  private summarize(r: LaneResult, probe: TelemetryProbe, name: string): RunSummary {
    const t = probe.result();
    return {
      name: name.slice(0, 64),
      rt: r.rt,
      et: r.et,
      total: r.total ?? null,
      trapKmh: r.trapMs === null ? null : r.trapMs * 3.6,
      redLight: r.redLight,
      finished: r.finished,
      dnf: r.dnf,
      launchRpm: t.launchRpm,
      maxSlipRatio: t.maxSlipRatio,
      wheelspinS: t.wheelspinS,
      shiftRpms: t.shiftRpms,
      clutchSlipS: t.clutchSlipS,
    };
  }

  private outcomeOf(race: { results: LaneResult[]; winner: number | null }): Outcome {
    const p = race.results[0]!;
    if (p.redLight) return 'red-light';
    if (p.dnf) return 'dnf';
    return race.winner === 0 ? 'win' : 'loss';
  }

  private async finishRace(): Promise<void> {
    const cur = this.current;
    const race = this.race;
    if (!cur || !race || cur.recorded) return;
    cur.recorded = true;
    const outcome = this.outcomeOf(race);
    const playerRes = this.summarize(race.results[0]!, cur.probes[0], 'Você');
    const oppRes = this.summarize(race.results[1]!, cur.probes[1], `${cur.rival.name} "${cur.rival.nickname}"`);
    await this.record(cur.event, cur.rival, cur.attemptId, outcome, playerRes, oppRes, cur.playerBuild);
  }

  private async record(ev: CareerEventDef, rv: RivalDef, attemptId: string, outcome: Outcome, player: RunSummary, opponent: RunSummary, pb: BuildResult): Promise<void> {
    const owned = this.controller.activeCar!;
    const rb = rivalBuild(rv);
    const res: Omit<CareerRaceResult, 'creditsAwarded' | 'reputationAwarded'> = {
      attemptId,
      eventId: ev.id,
      playerCarId: owned.id,
      opponentCarId: rb.car.id,
      playerResult: player,
      opponentResult: opponent,
      outcome,
      completedAt: new Date().toISOString(),
      buildVersion: BUILD_RESOLVER_VERSION,
      playerBuildKey: pb.ok ? pb.key : '',
      opponentBuildKey: rb.key,
    };
    const r = await this.controller.recordRace(res);
    if (!r.ok) {
      toast(`O resultado não foi salvo: ${r.error}`, 'error');
      return;
    }
    this.lastRecord = r.value;
    this.lastComments = evaluateRace({
      outcome,
      player,
      opponent,
      playerCar: pb.ok ? pb.car : findCampaignCar(owned.baseCarId)!,
      playerPowerCv: pb.ok ? pb.peakPowerCv : 0,
      opponentPowerCv: rb.peakPowerCv,
    });
    const trigger: StoryTrigger = outcome === 'win' ? 'victory' : 'defeat';
    const after = (): void => {
      if (r.value.chapterCompleted) this.show('ending');
      else this.show('result');
    };
    // result first, then the scenes on top of it
    this.show('result');
    this.playScenes(trigger, ev.id, () => {
      if (r.value.newUnlocks.length) this.playScenes('unlock', ev.id, after);
      else after();
    });
  }

  /**
   * Test hook: runs the event's race without rendering (same RaceController, simulations and AI)
   * and records it through the normal path. Only used by the end-to-end tests to cover the seven
   * events in reasonable time; one race of the e2e is always run through the visible path.
   */
  async debugSimulateRace(eventId: string): Promise<Outcome> {
    const ev = findEvent(eventId)!;
    const rv = rivalOf(ev);
    const owned = this.controller.activeCar!;
    const pb = ownedCarBuild(owned);
    const car = ownedCarConfig(owned);
    const x = runHeadlessRace(
      { car, name: 'Você', profile: AI_PROFILES.advanced, seed: 900 + this.seed },
      { car: rivalCar(rv.id), name: rv.nickname, profile: rv.skill, seed: 1900 + this.seed },
      findCareerTrack(ev.trackId),
      ev.distance,
      2900 + this.seed++,
    );
    const outcome: Outcome = x.lanes[0].redLight ? 'red-light' : x.lanes[0].dnf ? 'dnf' : x.winner === 0 ? 'win' : 'loss';
    const sum = (r: LaneResult, i: 0 | 1, name: string): RunSummary => ({
      name,
      rt: r.rt,
      et: r.et,
      total: r.total ?? null,
      trapKmh: r.trapMs === null ? null : r.trapMs * 3.6,
      redLight: r.redLight,
      finished: r.finished,
      dnf: r.dnf,
      ...x.telemetry[i],
    });
    await this.record(ev, rv, `${ev.id}-sim-${Date.now().toString(36)}-${this.seed}`, outcome, sum(x.lanes[0], 0, 'Você'), sum(x.lanes[1], 1, rv.nickname), pb);
    return outcome;
  }

  // ------------------------------------------------------------------ result / ending / history

  private resultScreen(): HTMLElement {
    const rec = this.lastRecord;
    if (!rec) return this.frame('Resultado', 'career-result', h('div', { class: 'hint' }, 'Nenhuma corrida.'));
    const r = rec.result;
    const ev = findEvent(r.eventId)!;
    const rv = rivalOf(ev);
    const won = r.outcome === 'win';
    const p = r.playerResult;
    const o = r.opponentResult;
    const row = (label: string, a: string, b: string): HTMLElement => h('tr', {}, h('td', {}, label), h('td', {}, a), h('td', {}, b));
    const title = { win: 'Vitória', loss: 'Derrota', 'red-light': 'Queima de largada', dnf: 'Não completou' }[r.outcome];
    const rivalLine = won ? rv.lines.win : rv.lines.lose;
    const nxt = nextEvent(this.controller.save!);
    return this.frame(
      title,
      'career-result',
      h(
        'div',
        { class: 'career-result' },
        h(
          'div',
          { class: 'career-col' },
          h('h2', { 'data-testid': 'result-winner', 'data-outcome': r.outcome }, won ? 'Você venceu' : `Vencedor: ${rv.name} "${rv.nickname}"`),
          h(
            'table',
            { class: 'results' },
            h('tr', {}, h('th', {}, ''), h('th', { class: won ? 'win' : '' }, 'Você'), h('th', { class: won ? '' : 'win' }, rv.nickname)),
            row('Reação (RT)', f3(p.rt), f3(o.rt)),
            row('ET', p.dnf ? 'DNF' : f3(p.et), o.dnf ? 'DNF' : f3(o.et)),
            row('Tempo desde o verde', f3(p.total), f3(o.total)),
            row('Velocidade final', p.trapKmh === null ? '—' : `${f1(p.trapKmh)} km/h`, o.trapKmh === null ? '—' : `${f1(o.trapKmh)} km/h`),
            row('Patinagem', `${f2(p.wheelspinS ?? 0)} s`, `${f2(o.wheelspinS ?? 0)} s`),
          ),
          h(
            'div',
            { class: 'career-award', 'data-testid': 'result-award' },
            `+${cr(r.creditsAwarded)} · +${r.reputationAwarded} de reputação${rec.applied ? '' : ' (já registrado)'}`,
          ),
          rec.newUnlocks.length ? h('div', { class: 'career-unlocks', 'data-testid': 'result-unlocks' }, `Liberado: ${rec.newUnlocks.map((u) => UNLOCK_LABEL[u]).join(', ')}`) : null,
        ),
        h(
          'div',
          { class: 'career-col' },
          rivalLine ? h('div', { class: 'quote' }, h('div', { class: 'ev-portrait' }, portraitEl(rv.portrait)), h('blockquote', {}, `“${rivalLine}”`)) : null,
          h(
            'div',
            { class: 'quote' },
            h('div', { class: 'ev-portrait' }, portraitEl('nina')),
            h(
              'ul',
              { class: 'nina-comments', 'data-testid': 'nina-comments' },
              this.lastComments.map((c) => h('li', { 'data-comment': c.id }, c.text)),
            ),
          ),
          h('div', { class: 'hint' }, nxt ? `Próximo desafio: ${nxt.order}. ${nxt.title} (${rivalOf(nxt).nickname})` : 'Capítulo concluído.'),
        ),
      ),
      this.nav(
        ['Revanche', 'result-retry', () => this.startRace(ev), !won],
        ['Garagem', 'result-garage', () => this.show('garage'), won],
        ['Noites', 'result-events', () => this.show('events')],
      ),
    );
  }

  private endingScreen(): HTMLElement {
    const s = this.controller.save!;
    const car = this.controller.activeCar!;
    const wins = s.results.filter((r) => r.outcome === 'win').length;
    const best = s.results.filter((r) => r.playerResult.et !== null && r.eventId === 'e7-rei-da-madrugada' && r.outcome === 'win').map((r) => r.playerResult.et!);
    const b = ownedCarBuild(car);
    const host = this.frame(
      'Rei da Madrugada',
      'career-ending',
      h(
        'div',
        { class: 'career-ending' },
        h('div', { class: 'ending-shop' }, this.preview(ownedCarConfig(car), 620, 260, 'studio'), h('div', { class: 'ending-title', 'data-testid': 'ending-title' }, 'Rei da Madrugada')),
        h(
          'dl',
          { class: 'career-stats' },
          h('dt', {}, 'Créditos'),
          h('dd', {}, cr(s.credits)),
          h('dt', {}, 'Reputação'),
          h('dd', {}, String(s.reputation)),
          h('dt', {}, 'Corridas'),
          h('dd', {}, `${s.results.length} (${wins} vitórias)`),
          h('dt', {}, 'Carro'),
          h('dd', {}, `${car.nickname}: ${b.ok ? `${b.peakPowerCv.toFixed(0)} cv, ${b.peakTorqueNm.toFixed(0)} N·m` : ''}, ${car.installedParts.length} peças`),
          h('dt', {}, 'Melhor ET na final'),
          h('dd', {}, best.length ? `${f3(Math.min(...best))} s` : '—'),
          h('dt', {}, 'Concluído em'),
          h('dd', {}, s.chapterCompletedAt?.slice(0, 10) ?? '—'),
        ),
      ),
      this.nav(['Garagem', 'ending-garage', () => this.show('garage'), true], ['Menu', 'ending-menu', () => this.show('menu')]),
    );
    setTimeout(() => this.playScenes('completion', undefined, () => undefined), 400);
    return host;
  }

  private historyScreen(): HTMLElement {
    const s = this.controller.save!;
    const rows = [...s.results].reverse().slice(0, 40);
    return this.frame(
      'Histórico',
      'career-history-screen',
      rows.length
        ? h(
            'table',
            { class: 'results' },
            h('tr', {}, h('th', {}, 'Data'), h('th', {}, 'Noite'), h('th', {}, 'Resultado'), h('th', {}, 'RT'), h('th', {}, 'ET'), h('th', {}, 'Rival ET'), h('th', {}, 'Prêmio')),
            rows.map((r) =>
              h(
                'tr',
                {},
                h('td', {}, r.completedAt.slice(0, 16).replace('T', ' ')),
                h('td', {}, findEvent(r.eventId)?.title ?? r.eventId),
                h('td', {}, { win: 'vitória', loss: 'derrota', 'red-light': 'queima', dnf: 'DNF' }[r.outcome]),
                h('td', {}, f3(r.playerResult.rt)),
                h('td', {}, f3(r.playerResult.et)),
                h('td', {}, f3(r.opponentResult.et)),
                h('td', {}, `${cr(r.creditsAwarded)} / +${r.reputationAwarded}`),
              ),
            ),
          )
        : h('div', { class: 'hint' }, 'Nenhuma corrida ainda.'),
      this.nav(['Voltar', 'history-back', () => this.show(this.controller.save ? 'garage' : 'menu')]),
    );
  }

  // ------------------------------------------------------------------ per frame

  onAudioReady(): void {
    const a = this.ctx?.audio;
    if (!a || !a.running) return;
    for (const v of this.runner.vehicles) {
      if (v.sound) continue;
      try {
        const q = v.isPlayer || !this.ctx.settings.opponentLowQuality ? this.ctx.settings.audioQuality : 'low';
        v.sound = new VehicleSound(a, carToAcousticConfig(v.sim.car, q, v.isPlayer ? 11 : 23), v.id, 0.05, this.trackCfg.ambientTempC + 273.15);
      } catch (e) {
        toast(`Falha ao criar voz de áudio: ${e instanceof Error ? e.message : String(e)}`, 'error');
      }
    }
  }

  onSettingsChanged(key: keyof AppSettings): void {
    if (key === 'audioQuality' || key === 'opponentLowQuality')
      for (const v of this.runner.vehicles) v.sound?.setQuality(v.isPlayer || !this.ctx.settings.opponentLowQuality ? this.ctx.settings.audioQuality : 'low');
  }

  tick(dtS: number): void {
    this.runner.advance(dtS);
    this.renderList = this.views.render(this.runner.vehicles, dtS);
    this.views.spatialize(this.runner.vehicles, dtS);
    const race = this.race;
    const p = this.runner.player;
    if (this.screen === 'race' && race && p && this.current) {
      const opp = this.runner.vehicles.find((v) => v.id === 'opponent');
      const r0 = race.results[0];
      const done = r0?.et != null;
      const sinceGreen = race.elapsedSinceGreen(0);
      this.hud?.update(p.sim, this.ctx.settings.units, this.runner.paused ? 'PAUSADO' : '', {
        distanceM: p.sim.x,
        timeS: sinceGreen,
        timeLabel: done ? 'TEMPO TOTAL' : sinceGreen === null ? 'preparação' : 'TEMPO DESDE O VERDE',
        etS: sinceGreen === null ? undefined : race.elapsed(0),
        alert: r0?.redLight ?? false,
        gapM: opp ? opp.sim.x - p.sim.x : null,
      });
      if (this.banner) this.banner.textContent = `${this.current.event.title} · Você × ${this.current.rival.name} "${this.current.rival.nickname}" · ${race.status}`;
      if (race.phase === 'finished' && !this.current.recorded) {
        this.banner && (this.banner.textContent = race.status);
        void this.finishRace();
      }
    } else if (this.banner && this.screen !== 'race') {
      this.banner.style.display = 'none';
    }
    if (this.screen !== 'race') this.hud?.dispose(), (this.hud = null);
  }

  vehicles(): RenderVehicle[] {
    return this.renderList;
  }
  track(): TrackConfig {
    return this.trackCfg;
  }
  markers(): TrackMarker[] {
    return this.screen === 'race' ? this.markerList : [];
  }
  tree(): TreeLights | null {
    return this.screen === 'race' && this.race ? this.race.lights() : null;
  }
  finishM(): number | null {
    return this.screen === 'race' ? (this.race?.distanceM ?? null) : null;
  }
  focusM(): number | null {
    const p = this.runner.player;
    if (!this.race || !p || this.race.phase === 'finished') return null;
    return p.sim.x < 5.5 ? TREE_X_M : null;
  }
}

function portraitEl(id: Parameters<typeof portraitSvg>[0]): HTMLElement {
  const d = h('div', { class: 'portrait', 'data-portrait': id });
  d.innerHTML = portraitSvg(id);
  return d;
}

/** What the factory fitted in a slot, from the catalogue car (never mutated). */
function stockSpec(car: CarConfig, cat: PartCategory): string {
  const e = car.engine;
  switch (cat) {
    case 'intake-filter':
      return 'Filtro de ar de papel na caixa de ar original de fábrica.';
    case 'intake-manifold':
      return 'Coletor de admissão original, com os dutos e o plenum de fábrica.';
    case 'camshaft':
      return `Comando de válvulas original; corte de giro de fábrica em ${e.revLimitRpm} rpm.`;
    case 'exhaust':
      return 'Escapamento original de fábrica, com os abafadores da época.';
    case 'turbo':
      return e.induction === 'turbo' ? 'Turbo original de fábrica.' : 'Motor aspirado, como saiu de fábrica.';
    case 'clutch':
      return `Embreagem original: ${car.transmission.clutch.maxTorqueNm} N·m de capacidade.`;
    case 'differential':
      return `Relação final original: ${car.transmission.finalDrive.toFixed(3).replace('.', ',')}.`;
    case 'tires':
      return `Pneus de rua originais (μ de pico ${car.tires.muPeak.toFixed(2).replace('.', ',')}).`;
    default:
      return `${CATEGORY_LABEL[cat]} original de fábrica: sem alteração de componentes.`;
  }
}
