import { VehicleSound } from '../audio/core/VehicleSound';
import { carToAcousticConfig } from '../audio/dsp/AcousticConfig';
import { findCampaignCar } from '../data/cars/campaign';
import type { CarConfig, TrackConfig } from '../data/schema';
import { CAREER_TRACKS, findCareerTrack } from '../data/tracks/career';
import { AI_PROFILES, DragAI } from '../game/ai/DragAI';
import { CareerController, buildVersionFor, parseInventoryEntry } from '../game/career/CareerController';
import { REGIONS, eventsOf, findEvent, rivalOf, type CareerEventDef, type RivalDef } from '../game/career/CareerEvents';
import { availableFreeOffers, freeChapterOf, type FreeEventOffer } from '../game/career/FreeEvents';
import { prizeEvents, prizeState } from '../game/career/PrizeCars';
import {
  eventLabel,
  eventStatus,
  isChapterComplete,
  isChapterUnlocked,
  isPartUnlocked,
  nextEvent,
  partStatus,
  stockStatus,
  partRequirements,
  unlocksOf,
} from '../game/career/CareerProgression';
import { CHAPTER_1_ID, CHAPTER_2_ID, CHAPTER_3_ID, CHAPTERS, chapterOf, nextChapterOf, type ChapterId } from '../game/career/chapters';
import { DEALER_CARS, offerAvailability, resaleValue } from '../game/career/chapter2/dealer';
import { familyOf, incompatibility } from '../game/career/tuning/BuildResolverV2';
import { CareerRepository, CareerTabLock } from '../game/career/CareerRepository';
import { evaluateRace, type Comment } from '../game/career/CareerResultEvaluator';
import { DEFAULT_SLOT, STARTER_CARS, type CareerRaceResult, type OutcomeSchema, type OwnedCar, type RunSummary } from '../game/career/CareerState';
import { SPEAKER_NAME, pendingScenes, type StoryScene, type StoryTrigger } from '../game/career/CareerStory';
import type { RaceRecord } from '../game/career/CareerController';
import { TelemetryProbe, runHeadlessRace } from '../game/career/headlessRace';
import { ownedCarBuild, ownedCarConfig, ownedCarLook, rivalBuild, rivalCar } from '../game/career/RivalBuildFactory';
import { BUILD_RESOLVER_VERSION, resolveBuild, type BuildResult } from '../game/career/tuning/BuildResolver';
import type { BuildTune } from '../game/career/tuning/buildCommon';
import { failureSpecFor, reconcileTune, tuneReliability } from '../game/career/tuning/TuningCapabilities';
import { playBlownEngine, playRiskWarning } from '../audio/core/blownEngineSound';
import { ALL_PARTS, CATEGORY_DESCRIPTION, CATEGORY_LABEL, CATEGORY_ORDER_V1, UNLOCK_LABEL, WORKSHOP_TABS, findPart, type PartCategory, type PartDef } from '../game/career/tuning/parts';
import { RACE_DISTANCES, RaceController, type LaneResult, type RaceLane } from '../game/race/RaceController';
import { runAccelerationTest } from '../game/race/accelerationTest';
import type { CameraMode, RenderVehicle, TrackMarker, TreeLights } from '../game/scenes/RaceScene';
import { TREE_X_M } from '../game/scenes/worldScale';
import { PHYSICS_DT, SimulationRunner } from '../game/SimulationRunner';
import type { AppContext, Mode } from '../app/Mode';
import type { AppSettings } from '../app/settings';
import { VehicleViews } from '../app/vehicleView';
import { clear, downloadText, h, pickTextFile, toast } from '../ui/dom';
import { Hud } from '../ui/Hud';
import { GarageVehiclePreview } from '../ui/garage/GarageVehiclePreview';
import { openGarage } from '../ui/garage/GarageDialog';
import { portraitSvg } from '../ui/career/portraits';
import { SHIFT_MESSAGES } from './SandboxMode';
import '../ui/career/career.css';
import '../ui/career/menu/career-menu.css';
import { buildMainMenu } from '../ui/career/menu/CareerMainMenu';
import { CareerMenuAnimations, prefersReducedMotion } from '../ui/career/menu/CareerMenuAnimations';
import '../ui/career/design/career-tokens.css';
import '../ui/career/design/career-components.css';
import '../ui/career/design/career-screens.css';
import '../ui/career/design/career-market.css';
import '../ui/career/design/career-lab.css';
import '../ui/career/design/career-story.css';
import '../ui/career/design/career-free-events.css';
import { buildChoose } from '../ui/career/screens/CareerChooseCarScreen';
import { buildEnding } from '../ui/career/screens/CareerEndingScreen';
import { buildResult } from '../ui/career/screens/CareerResultScreen';
import { buildRival } from '../ui/career/screens/CareerRivalScreen';
import { buildDynoLab, type DynoLabView } from '../ui/career/screens/CareerDynoScreen';
import { measureLab } from '../game/career/tuning/dynoLab';
import { TRACKS } from '../data/tracks/index';
import { buildHistory, type HistoryRow } from '../ui/career/screens/CareerHistoryScreen';
import { buildMarket, type Offer } from '../ui/career/screens/CareerMarketScreen';
import { buildChapters } from '../ui/career/screens/CareerChaptersScreen';
import { buildEvents } from '../ui/career/screens/CareerEventsScreen';
import { buildFreeEvents } from '../ui/career/screens/CareerFreeEventsScreen';
import { buildGarage, type GarageStats } from '../ui/career/screens/CareerGarageScreen';
import { buildShell, type NavItem } from '../ui/career/screens/CareerShell';
import { CareerTransitionManager } from '../ui/career/motion/CareerTransitionManager';
import { menuViewModel } from '../ui/career/menu/CareerMenuProgress';

type Screen = 'menu' | 'choose' | 'garage' | 'workshop' | 'dyno' | 'events' | 'free-events' | 'rival' | 'race' | 'result' | 'ending' | 'history' | 'market' | 'chapters';
type Outcome = (typeof OutcomeSchema)['options'][number];

const CAMERAS: CameraMode[] = ['follow', 'wide', 'start'];
const f1 = (v: number): string => v.toFixed(1).replace('.', ',');
const f2 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : v.toFixed(2).replace('.', ','));
const f3 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : v.toFixed(3).replace('.', ','));
const cr = (v: number): string => `${v.toLocaleString('pt-BR')} CR`;

/** pt-BR label of the driven axles. */
export function driveLabel(c: CarConfig): string {
  return c.drivenAxle === 'awd' ? 'integral' : c.drivenAxle === 'rear' ? 'traseira' : 'dianteira';
}

/** pt-BR label of the gearbox type. */
export function gearboxLabel(c: CarConfig): string {
  const n = c.transmission.gearRatios.length;
  const k = c.transmission.kind ?? 'manual';
  if (k === 'dual-clutch') return `dupla embreagem, ${n} marchas (D/M)`;
  if (k === 'torque-converter-auto') return `automático com conversor, ${n} marchas (D/M)`;
  return `manual, ${n} marchas`;
}

/** Settings that survive a part change (the hardware still allows them and they are in range). */
function keptTune(car: OwnedCar, parts: readonly string[]): BuildTune {
  if (!car.tune) return {};
  return reconcileTune(findCampaignCar(car.baseCarId)!, parts, buildVersionFor(car, parts), car.tune).tune;
}

/** Resolves a hypothetical part list of an owned car with the resolver version it would use. */
function resolveOwned(car: OwnedCar, parts: readonly string[], tune = keptTune(car, parts)): BuildResult {
  return resolveBuild(findCampaignCar(car.baseCarId)!, parts, tune, buildVersionFor(car, parts));
}

interface Estimate {
  t100: number | null;
  t402: number | null;
}

/**
 * Campaign mode — chapter 1 "Madrugada Zero" and chapter 2 "Liga da Madrugada" (one career, one
 * save; the active chapter picks the events, regions and story). Screens are DOM overlays over the night track; the
 * race reuses the RaceController, SimulationRunner, HUD and DragAI of the Race mode. Every change
 * of the career goes through CareerController (atomic, idempotent, validated).
 */
export class CareerMode implements Mode {
  readonly id = 'career';
  readonly label = 'Campanha';
  readonly usesTrack = true;
  readonly noPanel = true;
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
  private menuAnim: CareerMenuAnimations | null = null;
  private readonly transition = new CareerTransitionManager();
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
    freeOffer?: FreeEventOffer;
  } | null = null;
  lastRecord: RaceRecord | null = null;
  private freeSelected: FreeEventOffer | null = null;
  private lastFreeOffer: FreeEventOffer | null = null;
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
    this.menuAnim?.dispose();
    this.menuAnim = null;
    this.transition.cancel();
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

  private preview(car: CarConfig, w: number, hgt: number, backdrop: 'studio' | 'plain' = 'studio', fill?: number): HTMLCanvasElement {
    const p = new GarageVehiclePreview(backdrop);
    if (fill !== undefined) p.fill = fill;
    this.previews.push(p);
    p.resize(w, hgt);
    void p.setCar(car);
    return p.canvas;
  }

  /** Renders a screen. Scenes for the trigger play first when they are pending. */
  show(screen: Screen): void {
    this.screen = screen;
    this.disposePreviews();
    this.dynoLab?.dispose(); // a pending Dyno Lab measurement is discarded with its screen
    this.dynoLab = null;
    this.menuAnim?.dispose();
    this.menuAnim = null;
    this.transition.cancel();
    clear(this.root);
    this.root.classList.toggle('hidden', screen === 'race');
    this.root.dataset.screen = screen;
    const s = this.controller.save;
    if (screen !== 'race' && screen !== 'menu' && screen !== 'choose' && !s) screen = 'menu';
    const body = this.renderScreen(screen);
    this.root.append(body);
    if (screen === 'race') return;
    const reduced = prefersReducedMotion(this.ctx.settings.graphics === 'low');
    if (screen === 'menu') {
      this.menuAnim = new CareerMenuAnimations(body, reduced);
      this.menuAnim.play();
    } else this.transition.enter(body, reduced);
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
      case 'free-events':
        return this.freeEventsScreen();
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
      case 'chapters':
        return this.chaptersScreen();
      default:
        return h('div');
    }
  }

  private frame(title: string, testid: string, ...children: (HTMLElement | string | null)[]): HTMLElement {
    const s = this.controller.save;
    const ch = chapterOf(this.chapter);
    const evs = eventsOf(ch.id);
    const done = s ? evs.filter((e) => s.completedEventIds.includes(e.id)).length : 0;
    const car = this.controller.activeCar;
    return buildShell({
      screen: this.screen,
      title,
      testid,
      chapterLabel: `Capítulo ${ch.number} · ${ch.title}`,
      status: s ? { credits: cr(s.credits), reputation: `Reputação ${s.reputation}`, progress: `${done}/${evs.length} ${ch.unit}` } : null,
      carName: car?.nickname ?? null,
      nav: s ? this.careerNav(s) : null,
      children: children.filter((c): c is HTMLElement | string => c !== null),
    });
  }

  /** Global career navigation, the same on every screen. */
  private careerNav(s: NonNullable<CareerController['save']>): NavItem[] {
    const workshopOpen = unlocksOf(s).has('workshop-basic');
    const ch2 = isChapterUnlocked(s, CHAPTER_2_ID);
    return [
      { id: 'overview', label: 'Visão geral', icon: 'overview', on: () => this.show('menu') },
      { id: 'garage', label: 'Garagem', icon: 'garage', on: () => this.show('garage') },
      { id: 'events', label: 'Eventos', icon: 'events', on: () => this.show('events') },
      { id: 'free-events', label: 'Eventos livres', icon: 'flag', on: () => this.show('free-events') },
      { id: 'workshop', label: 'Oficina', icon: 'workshop', locked: workshopOpen ? null : 'Libera durante o capítulo 1', on: () => this.playScenes('workshop', undefined, () => this.show('workshop')) },
      { id: 'dyno', label: 'Dinamômetro', icon: 'dyno', on: () => this.show('dyno') },
      { id: 'market', label: 'Classificados', icon: 'market', on: () => this.show('market') },
      { id: 'history', label: 'Histórico', icon: 'history', on: () => this.show('history') },
      { id: 'chapters', label: 'Capítulos', icon: 'chapters', locked: ch2 ? null : 'Conclua o capítulo 1 para liberar', on: () => this.show('chapters') },
    ];
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
    const vm = menuViewModel(s, this.chapter);
    const active = this.controller.activeCar;
    // the hero shows the saved car with its effective build; without a save, a stock demonstration car
    let heroCar = findCampaignCar(STARTER_CARS[0].baseCarId)!;
    if (active && vm.car) heroCar = ownedCarConfig(active);
    return buildMainMenu({
      vm,
      heroCar,
      persistent: this.ctx.store.persistent,
      makePreview: (car, w, hgt) => this.preview(car, w, hgt, 'plain', 0.86),
      portrait: (id) => portraitEl(id),
      callbacks: {
        continueCareer: () => this.continueCareer(),
        newCampaign: () => this.confirmNew(),
        garage: () => void this.deliverPrizes(() => this.show('garage')),
        chapters: () => this.show('chapters'),
        history: () => this.show('history'),
        freeEvents: () => this.show('free-events'),
        exportSave: () => this.exportSave(),
        importSave: () => void this.importSave(),
        back: () => this.ctx.switchMode?.('sandbox'),
      },
    });
  }

  private confirmNew(): void {
    if (!this.guard()) return;
    if (this.controller.save && !confirm('Começar uma nova campanha apaga a atual. Continuar?')) return;
    this.show('choose');
  }

  private continueCareer(): void {
    void this.deliverPrizes(() => this.continueCareerNow());
  }

  private continueCareerNow(): void {
    const s = this.controller.save!;
    const ch = this.chapter;
    const completionScene = chapterOf(ch).completionScene;
    // the chapter is done, its ending seen and the next chapter never opened: offer the new chapter
    const nextCh = nextChapterOf(ch);
    if (nextCh && isChapterComplete(s, ch) && s.seenStorySceneIds.includes(completionScene) && isChapterUnlocked(s, nextCh.id) && !s.storyMilestones.includes(`${nextCh.id}-started`)) {
      this.show('chapters');
      return;
    }
    if (isChapterComplete(s, ch) && !s.seenStorySceneIds.includes(completionScene)) {
      this.endingChapter = ch;
      this.show('ending');
    } else this.show('garage');
  }

  /** Prize car of a won final that waits for room in the garage (a full garage never loses it). */
  private prizeNotice(): string | null {
    const s = this.controller.save!;
    const waiting = prizeEvents().filter((e) => prizeState(s, e) === 'garage-full');
    return waiting.length ? `${rivalOf(waiting[0]!).prize!.nickname} está esperando vaga: venda um carro para receber o prêmio da final.` : null;
  }

  /**
   * Delivers the prize cars of finals already won and not yet claimed (saves that won the final
   * before the prize existed, or that had a full garage), with the hand-over scene of each. A
   * second call finds nothing to deliver.
   */
  private async deliverPrizes(then: () => void): Promise<void> {
    const s = this.controller.save;
    if (!s || this.readOnly || !prizeEvents().some((e) => prizeState(s, e) === 'ready')) {
      then();
      return;
    }
    const r = await this.controller.claimPendingPrizes();
    if (!r.ok || !r.value.length) {
      if (!r.ok) toast(`O prêmio da final não foi entregue: ${r.error}`, 'error');
      then();
      return;
    }
    const cars = r.value;
    const next = (i: number): void => {
      const car = cars[i];
      if (!car) {
        then();
        return;
      }
      toast(`${car.nickname} entregue na sua garagem.`);
      this.playScenes('prize', car.prizeEventId, () => next(i + 1));
    };
    next(0);
  }

  /** Chapter selector: chapter 2 opens after chapter 1; progress of both is kept. */
  private chaptersScreen(): HTMLElement {
    const s = this.controller.save!;
    const body = buildChapters({
      chapters: CHAPTERS.map((c) => {
        const evs = eventsOf(c.id);
        return {
          id: c.id,
          number: c.number,
          title: c.title,
          blurb: c.blurb,
          events: evs.length,
          done: evs.filter((e) => s.completedEventIds.includes(e.id)).length,
          unit: c.unit,
          open: isChapterUnlocked(s, c.id),
          active: s.chapterId === c.id,
          lockedReason: 'Conclua o capítulo anterior para liberar.',
        };
      }),
      onOpen: (id) => void this.openChapter(id as ChapterId),
      onBack: () => this.show(this.controller.save ? 'garage' : 'menu'),
    });
    return this.frame('Capítulos', 'career-chapters-screen', body);
  }

  private async openChapter(id: ChapterId): Promise<void> {
    if (!this.guard()) return;
    const r = await this.controller.setActiveChapter(id);
    if (!r.ok) {
      toast(r.error, 'error');
      return;
    }
    this.estimates.clear();
    this.playScenes('start', undefined, () => this.show('garage'));
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
    const body = buildChoose({
      budget: 4500,
      cards: STARTER_CARS.map((st) => {
        const car = findCampaignCar(st.baseCarId)!;
        return { id: st.baseCarId, name: car.name, description: car.description, price: st.price, cfg: car, cv: car.engine.ratedPowerCv, nm: Math.max(...car.engine.torqueCurve.torqueNm), massKg: car.massKg, drive: driveLabel(car) };
      }),
      makePreview: (c, w, hh) => this.preview(c, w, hh, 'studio', 0.8),
      onChoose: (id) => void this.startCareer(id),
      onBack: () => this.show('menu'),
    });
    return this.frame('Escolha o primeiro carro', 'career-choose', body);
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
    const chapter = eventId ? (findEvent(eventId)?.chapter ?? this.chapter) : trigger === 'completion' ? this.endingChapter : this.chapter;
    const scenes = s ? pendingScenes(trigger, s.seenStorySceneIds, eventId, chapter) : [];
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

  private garageScreen(): HTMLElement {
    const s = this.controller.save!;
    const car = this.controller.activeCar!;
    const b = ownedCarBuild(car);
    const cfg = ownedCarConfig(car);
    const stock = resolveOwned(car, [], {});
    const ch = this.chapter;
    const nxt = nextEvent(s, ch);
    const evs = eventsOf(ch);
    const base = findCampaignCar(car.baseCarId)!;
    const workshopOpen = unlocksOf(s).has('workshop-basic');
    const stats: GarageStats | null = b.ok
      ? {
          powerCv: Math.round(b.peakPowerCv),
          torqueNm: Math.round(b.peakTorqueNm),
          massKg: b.car.massKg,
          aspiration: b.car.engine.induction === 'turbo' ? `turbo ${f2(b.car.engine.turbo!.maxBoostBar)} bar` : 'aspirado',
          revLimit: b.car.engine.revLimitRpm,
          drive: driveLabel(b.car),
          gearbox: gearboxLabel(b.car),
          clutch: `${b.car.transmission.clutch.maxTorqueNm} N·m`,
          finalDrive: b.car.transmission.finalDrive.toFixed(3).replace('.', ','),
          grip: b.car.tires.muPeak.toFixed(2).replace('.', ','),
          stock: stock.ok && car.installedParts.length ? { powerCv: Math.round(stock.peakPowerCv), torqueNm: Math.round(stock.peakTorqueNm) } : null,
        }
      : null;
    const goWorkshop = (): void => this.playScenes('workshop', undefined, () => this.show('workshop'));
    const body = buildGarage({
      car: { nickname: car.nickname, baseName: base.name, year: null, trophy: !!car.prizeEventId },
      prizeNotice: this.prizeNotice(),
      cfg,
      stats,
      buildError: b.ok ? null : b.errors.join('; '),
      installed: car.installedParts.map((id) => ({ id, name: findPart(id)?.name ?? id, category: findPart(id)?.category ?? '' })),
      next: nxt ? { order: nxt.order, total: evs.length, title: nxt.title, rival: rivalOf(nxt).name, nickname: rivalOf(nxt).nickname, distance: RACE_DISTANCES[nxt.distance].label, region: nxt.regionLabel, reward: nxt.rewardCr, word: ch === CHAPTER_1_ID ? 'noite' : 'etapa' } : null,
      chapterDone: evs.filter((e) => s.completedEventIds.includes(e.id)).length,
      chapterTotal: evs.length,
      others: s.ownedCars.filter((c) => c.id !== car.id).map((c) => ({ id: c.id, nickname: c.nickname, trophy: !!c.prizeEventId, cfg: ownedCarLook(c) })),
      flags: { workshopOpen, chapter2: isChapterUnlocked(s, CHAPTER_2_ID), chapterComplete: isChapterComplete(s, ch), canSell: s.ownedCars.length > 1, sellLabel: `Vender este carro (${cr(resaleValue(car))})` },
      makePreview: (c, w, hh, studio) => this.preview(c, w, hh, studio ? 'studio' : 'plain', studio ? 0.8 : 0.86),
      on: {
        events: () => this.show('events'),
        workshop: goWorkshop,
        dyno: () => this.show('dyno'),
        market: () => this.show('market'),
        history: () => this.show('history'),
        chapters: () => this.show('chapters'),
        ending: () => {
          this.endingChapter = ch;
          this.show('ending');
        },
        menu: () => this.show('menu'),
        sell: () => void this.sellActive(),
        pick: (id) => void this.controller.setActiveCar(id).then(() => this.show('garage')),
      },
    });
    return this.frame('Garagem', 'career-garage-screen', body);
  }

  private async sellActive(carId?: string, back: Screen = 'garage'): Promise<void> {
    if (!this.guard()) return;
    const car = (carId ? this.controller.save?.ownedCars.find((c) => c.id === carId) : this.controller.activeCar) ?? this.controller.activeCar!;
    const value = resaleValue(car);
    const n = car.installedParts.length;
    if (!confirm(`Vender ${car.nickname} por ${cr(value)}?${n ? ` As ${n} peças instaladas vão para o estoque deste modelo.` : ''} Esta venda não pode ser desfeita.`)) return;
    const r = await this.controller.sellCar(car.id);
    if (!r.ok) toast(r.error, 'error');
    else toast(`${car.nickname} vendido por ${cr(r.value.credits)}.`);
    void this.deliverPrizes(() => this.show(back));
  }

  private openPurchase(o: Offer): void {
    if (!this.guard()) return;
    openGarage({
      cars: [o.cfg],
      current: null,
      useLabel: `Comprar por ${cr(o.price)}`,
      purchase: {
        confirm: async (id, paint) => {
          if (this.readOnly) return 'Campanha aberta em outra aba: só leitura.';
          const result = await this.controller.buyCar(id, paint ?? undefined);
          return result.ok ? null : result.error;
        },
        onPurchased: () => {
          toast(`${o.name} comprado. Selecione-o na garagem.`);
          this.show('market');
        },
      },
    });
  }

  private marketScreen(): HTMLElement {
    const s = this.controller.save!;
    const leagueOpen = isChapterUnlocked(s, CHAPTER_2_ID);
    const eliteOpen = isChapterUnlocked(s, CHAPTER_3_ID);
    const mk = (id: string, price: number, source: 'street' | 'league' | 'elite', ok: boolean, reason: string | null, owned: boolean): Offer => {
      const car = findCampaignCar(id)!;
      return {
        id,
        name: car.name,
        price,
        source,
        ok,
        reason,
        owned,
        affordable: s.credits >= price,
        cfg: car,
        cv: Math.round(car.engine.ratedPowerCv),
        nm: Math.round(Math.max(...car.engine.torqueCurve.torqueNm)),
        massKg: car.massKg,
        drive: driveLabel(car),
        gearbox: gearboxLabel(car),
        aspiration: car.engine.induction === 'turbo' ? 'turbo' : 'aspirado',
      };
    };
    const offers: Offer[] = [
      ...STARTER_CARS.map((o) => mk(o.baseCarId, o.price, 'street', true, null, s.ownedCars.some((c) => c.baseCarId === o.baseCarId))),
      ...(leagueOpen
        ? DEALER_CARS.filter((o) => o.chapter !== 3 || eliteOpen).map((o) => {
            const a = offerAvailability(s, o);
            return mk(o.baseCarId, o.price, o.chapter === 3 ? 'elite' : 'league', a.ok, a.ok ? null : a.reason, s.ownedCars.some((c) => c.baseCarId === o.baseCarId));
          })
        : []),
    ];
    const body = buildMarket({
      offers,
      credits: s.credits,
      leagueOpen,
      eliteOpen,
      fleet: s.ownedCars.map((c) => ({ id: c.id, nickname: c.nickname, value: resaleValue(c), paid: c.purchasePrice ?? null, parts: c.installedParts.length, trophy: !!c.prizeEventId, active: c.id === s.activeCarId, cfg: ownedCarLook(c) })),
      makePreview: (c, w, hh) => this.preview(c, w, hh, 'plain', 0.86),
      buy: (o) => this.openPurchase(o),
      sell: (id) => void this.sellActive(id, 'market'),
      onBack: () => this.show('garage'),
    });
    return this.frame('Classificados', 'career-market', body);
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
    const visible = this.visibleParts(car);
    // a category is shown when it has parts for this car; a car of resolver version 1 keeps every
    // chapter 1 slot (its factory part), exactly as the chapter 1 workshop showed it
    const legacy = buildVersionFor(car, car.installedParts) === 1;
    const catVisible = (c: PartCategory): boolean => visible.some((p) => p.category === c) || (legacy && CATEGORY_ORDER_V1.includes(c));
    const tabs = WORKSHOP_TABS.map((t) => ({ ...t, categories: t.categories.filter(catVisible) })).filter((t) => t.categories.length);
    const tab = tabs.find((t) => t.id === this.workshopTab) ?? tabs[0]!;
    const before = ownedCarBuild(car);
    const allInTab = visible.filter((p) => tab.categories.includes(p.category));
    const stockSel = this.selectedPart?.startsWith('stock:') ? this.selectedPart.slice(6) as PartCategory : null;
    const sel = stockSel ? undefined : (this.selectedPart ? findPart(this.selectedPart) : allInTab[0]);
    const equipped = car.installedParts.map((id) => findPart(id)).filter((p): p is PartDef => !!p);
    const kit = equipped.find((p) => p.category === 'turbo');
    const highestTier = equipped.reduce((top, p) => Math.max(top, p.chapter ?? 1), 1);
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
        metric('CAPÍTULO', `${String(chapterOf(this.chapter).number).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`),
      ),
    );
    const rail = h(
      'aside', { class: 'ws-left' },
      h('div', { class: 'ws-preview' }, this.preview(ownedCarConfig(car), 320, 168)),
      h('span', { class: 'ws-sidebar-title' }, 'SISTEMAS DO VEÍCULO'),
      h(
        'nav', { class: 'ws-tabs', 'aria-label': 'Sistemas da oficina' },
        tabs.map((t) => h('button', {
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
        const st = partStatus(s, car, p, familyOf(findCampaignCar(car.baseCarId)!));
        return h('li', {
          class: `ws-part-card ${sel?.id === p.id ? 'sel' : ''} ${st.state}`,
          'data-testid': `ws-part-${p.id}`,
          'data-state': st.state,
          title: st.detail,
          tabindex: '0', role: 'button',
          onclick: () => { this.selectedPart = p.id; this.show('workshop'); },
          onkeydown: (e: Event) => {
            if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.selectedPart = p.id; this.show('workshop'); }
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

  /**
   * Parts the shop offers for this car: parts of resolver version 2 appear once chapter 2 is open,
   * and only those that fit the car (engine family, induction, gearbox, driven axles). An AP part
   * never shows on an N55; a manual clutch never shows on a DSG.
   */
  private visibleParts(car: OwnedCar): PartDef[] {
    const s = this.controller.save!;
    const base = findCampaignCar(car.baseCarId)!;
    const c2 = isChapterUnlocked(s, CHAPTER_2_ID);
    const v2 = buildVersionFor(car, car.installedParts) === 2;
    return ALL_PARTS.filter((p) => {
      if (car.installedParts.includes(p.id)) return true;
      if (p.since === 2 && !c2) return false;
      // version 2 compatibility rules apply to the cars resolved by version 2 and to v2 parts
      if ((v2 || p.since === 2) && incompatibility(base, p)) return false;
      return true;
    });
  }

  private async restoreAll(n: number): Promise<void> {
    if (!this.guard()) return;
    if (!confirm(`Voltar o carro ao original? ${n === 1 ? 'A peça vai' : `As ${n} peças vão`} para o estoque e pode${n === 1 ? '' : 'm'} ser reinstalada${n === 1 ? '' : 's'} depois.`)) return;
    const r = await this.controller.restoreStock();
    if (!r.ok) toast(r.error, 'error');
    else toast(r.notice ? `Carro de volta ao original. As peças estão no estoque. ${r.notice}` : 'Carro de volta ao original. As peças estão no estoque.');
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
    const after = resolveOwned(car, nextParts);
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
                else if (r.notice) toast(r.notice, 'error');
                if (r.ok) toast(`${CATEGORY_LABEL[cat]} original instalado. ${inSlot.map((id) => findPart(id)!.name).join(', ')} foi para o estoque.`);
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
      /**
       * Row with a change marker on the "after" cell: green ▲ when the change helps, red ▼ when it
       * hurts, grey ◆ when it only changes (final drive). `better` says which direction helps.
       */
      const row = (label: string, a: string, b: string, va?: number, vb?: number, better: 'higher' | 'lower' | 'neutral' = 'higher', eps = 1e-6): HTMLElement => {
        const cell = h('td', {}, b);
        if (va !== undefined && vb !== undefined && Number.isFinite(va) && Number.isFinite(vb) && Math.abs(vb - va) > eps) {
          const kind = better === 'neutral' ? 'neutral' : (vb > va) === (better === 'higher') ? 'up' : 'down';
          const mark = kind === 'up' ? '▲' : kind === 'down' ? '▼' : '◆';
          const aria = kind === 'up' ? 'melhora' : kind === 'down' ? 'piora' : 'muda';
          cell.append(h('span', { class: `delta delta-${kind}`, 'data-testid': `delta-${kind}`, 'aria-label': aria, title: aria }, ` ${mark}`));
        }
        return h('tr', {}, h('td', {}, label), h('td', {}, a), cell);
      };
      const band = (x: Extract<BuildResult, { ok: true }>): [number, number] => {
        const c = x.car.engine.torqueCurve;
        const peak = Math.max(...c.torqueNm);
        const r = c.rpm.filter((_, i) => c.torqueNm[i]! >= peak * 0.9);
        return [r[0]!, r[r.length - 1]!];
      };
      const range = (x: Extract<BuildResult, { ok: true }>): string => {
        const [lo, hi] = band(x);
        return `${lo}–${hi} rpm`;
      };
      const width = (x: Extract<BuildResult, { ok: true }>): number => {
        const [lo, hi] = band(x);
        return hi - lo;
      };
      cmpHost.append(
        h(
          'table',
          { class: 'results' },
          h('tr', {}, h('th', {}, ''), h('th', {}, 'Antes'), h('th', {}, afterLabel)),
          row('Potência', `${f1(before.peakPowerCv)} cv`, `${f1(after.peakPowerCv)} cv`, before.peakPowerCv, after.peakPowerCv, 'higher', 0.05),
          row('Torque', `${f1(before.peakTorqueNm)} N·m`, `${f1(after.peakTorqueNm)} N·m`, before.peakTorqueNm, after.peakTorqueNm, 'higher', 0.05),
          row('Faixa útil (90 % do torque)', range(before), range(after), width(before), width(after), 'higher'),
          row('Embreagem', `${before.car.transmission.clutch.maxTorqueNm} N·m`, `${after.car.transmission.clutch.maxTorqueNm} N·m`, before.car.transmission.clutch.maxTorqueNm, after.car.transmission.clutch.maxTorqueNm, 'higher'),
          row('Aderência (μ pico)', f2(before.car.tires.muPeak), f2(after.car.tires.muPeak), before.car.tires.muPeak, after.car.tires.muPeak, 'higher', 0.005),
          row('Relação final', f3(before.car.transmission.finalDrive), f3(after.car.transmission.finalDrive), before.car.transmission.finalDrive, after.car.transmission.finalDrive, 'neutral', 0.0005),
          row('0–100 km/h (estimativa)', eb ? `${f2(eb.t100)} s` : '…', ea ? `${f2(ea.t100)} s` : '…', eb?.t100 ?? undefined, ea?.t100 ?? undefined, 'lower', 0.005),
          row('402 m (estimativa)', eb ? `${f2(eb.t402)} s` : '…', ea ? `${f2(ea.t402)} s` : '…', eb?.t402 ?? undefined, ea?.t402 ?? undefined, 'lower', 0.005),
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
    const fam = familyOf(findCampaignCar(car.baseCarId)!);
    const unlocked = isPartUnlocked(s, p, fam);
    const nextParts = installed ? car.installedParts.filter((x) => x !== p.id) : CareerController.withPart(car.installedParts, p.id).parts;
    const after = resolveOwned(car, nextParts);
    const reqs = partRequirements(p, fam).map((u) => `${UNLOCK_LABEL[u]}${unlocksOf(s).has(u) ? ' ✓' : ''}`);
    const cmpHost = this.compareTable(before, after, installed ? 'Sem a peça' : 'Depois');
    const act = async (fn: () => Promise<{ ok: boolean; error?: string; notice?: string }>, okMsg: string): Promise<void> => {
      if (!this.guard()) return;
      const r = await fn();
      if (!r.ok) toast(r.error ?? 'falhou', 'error');
      else {
        toast(okMsg);
        if (r.notice) toast(r.notice, 'error');
      }
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

  private dynoLab: DynoLabView | null = null;

  /**
   * Dyno Lab 3.0: editing a setting changes only the draft (measured after a debounce, with the A/B
   * comparison); the save is written by "Aplicar" through CareerController.applyTune, which
   * validates again. The screen is never rebuilt while editing.
   */
  private dynoScreen(): HTMLElement {
    this.dynoLab?.dispose();
    const car = this.controller.activeCar!;
    const base = findCampaignCar(car.baseCarId)!;
    const version = buildVersionFor(car, car.installedParts);
    const b = ownedCarBuild(car);
    const caps = this.controller.capabilitiesOf(car)!;
    const track = TRACKS.find((t) => t.id === 'test-track') ?? this.trackCfg;
    const view = buildDynoLab({
      carName: car.nickname,
      cfg: b.ok ? b.car : null,
      makePreview: (c, w, hh) => this.preview(c, w, hh, 'plain', 0.86),
      caps,
      saved: car.tune ?? {},
      turbo: b.ok && b.car.engine.induction === 'turbo',
      measure: async (tune, stale, prog) => {
        const r = resolveBuild(base, car.installedParts, tune, version);
        if (!r.ok) return { error: r.errors.join('; ') };
        const m = await measureLab(r.car, track, () => stale() || !view.el.isConnected, prog);
        return m ?? (stale() || !view.el.isConnected ? null : { error: 'o motor não pegou no banco' });
      },
      reliabilityOf: (tune) => tuneReliability(caps, tune),
      apply: async (tune) => {
        if (!this.guard()) return { ok: false, error: 'aguarde' };
        const r = await this.controller.applyTune(car.id, tune);
        if (!r.ok) {
          toast(r.error, 'error');
          return { ok: false, error: r.error };
        }
        toast('Ajustes do Dyno Lab aplicados.');
        return { ok: true };
      },
      onBack: () => this.show('garage'),
    });
    this.dynoLab = view;
    return this.frame('Dyno Lab', 'career-dyno', h('p', { class: 'lead' }, `${car.nickname}: o dinamômetro mede o motor que está no carro, com as peças instaladas, e a pista de testes mede o carro. Os valores vêm da física, não da ficha.`), view.el);
  }

  // ------------------------------------------------------------------ events

  private eventsScreen(): HTMLElement {
    const s = this.controller.save!;
    const ch = this.chapter;
    const evs = eventsOf(ch);
    const nxt = nextEvent(s, ch);
    const body = buildEvents({
      regions: REGIONS.filter((r) => r.chapter === ch).map((r) => ({
        id: r.id,
        label: r.label,
        blurb: r.blurb,
        events: evs
          .filter((e) => e.trackId === r.id)
          .map((e) => {
            const rv = rivalOf(e);
            return { id: e.id, order: e.order, title: e.title, state: eventStatus(s, e), rival: rv.name, nickname: rv.nickname, carName: findCampaignCar(rv.baseCarId)?.name ?? rv.baseCarId, distance: RACE_DISTANCES[e.distance].label, reward: e.rewardCr, portrait: portraitEl(rv.portrait) };
          }),
      })),
      nextId: nxt?.id ?? null,
      unit: chapterOf(ch).unit,
      done: evs.filter((e) => s.completedEventIds.includes(e.id)).length,
      total: evs.length,
      onPick: (id) => {
        this.freeSelected = null;
        this.selectedEvent = id;
        this.show('rival');
      },
      onBack: () => this.show('garage'),
    });
    return this.frame(chapterOf(ch).eventsTitle, 'career-events', h('button', { class: 'cs-btn', 'data-testid': 'events-free-shortcut', onclick: () => this.show('free-events') }, 'Eventos livres · ganhar créditos'), body);
  }

  private freeEventsScreen(): HTMLElement {
    const save = this.controller.save!;
    const offers = availableFreeOffers(this.chapter, save.freeEventRotation);
    const body = buildFreeEvents({
      chapterTitle: chapterOf(this.chapter).title,
      offers,
      makePreview: (offer, width, height) => this.preview(rivalCar(offer.rival), width, height, 'plain', 0.86),
      onPick: (offer) => {
        this.freeSelected = offer;
        this.selectedEvent = null;
        this.show('rival');
      },
      onRefresh: async () => {
        if (!this.guard()) return;
        const rotated = await this.controller.rotateFreeEvents();
        if (!rotated.ok) { toast(rotated.error, 'error'); return; }
        this.freeSelected = null;
        this.show('free-events');
      },
      onBack: () => this.show('garage'),
    });
    return this.frame('Eventos livres', 'career-free-events', body);
  }

  selectedEvent: string | null = null;
  /** Chapter whose ending screen is shown. */
  private endingChapter: ChapterId = CHAPTER_1_ID;

  /** Active chapter of the save. */
  get chapter(): ChapterId {
    return this.controller.save?.chapterId ?? CHAPTER_1_ID;
  }

  private rivalScreen(): HTMLElement {
    const offer = this.freeSelected;
    const ev = offer?.event ?? findEvent(this.selectedEvent ?? '') ?? nextEvent(this.controller.save!, this.chapter) ?? eventsOf(this.chapter)[0]!;
    const rv = offer?.rival ?? rivalOf(ev);
    const rb = rivalBuild(rv);
    const s = this.controller.save!;
    const firstWin = offer ? true : !s.claimedRewardIds.includes(`${ev.id}:first`);
    this.trackCfg = findCareerTrack(ev.trackId);
    this.runner.setTrack(this.trackCfg);
    const mine = this.controller.activeCar!;
    const mb = ownedCarBuild(mine);
    const body = buildRival({
      player: { name: mine.nickname, car: findCampaignCar(mine.baseCarId)!.name, cfg: ownedCarConfig(mine), cv: mb.ok ? mb.peakPowerCv : 0, nm: mb.ok ? mb.peakTorqueNm : 0, massKg: mb.ok ? mb.car.massKg : 0, drive: mb.ok ? driveLabel(mb.car) : '—' },
      rival: {
        name: rv.name,
        nickname: rv.nickname,
        portrait: portraitEl(rv.portrait),
        line: rv.lines.before,
        car: rb.car.name,
        cfg: rivalCar(rv),
        cv: rb.peakPowerCv,
        nm: rb.peakTorqueNm,
        massKg: rb.car.massKg,
        drive: driveLabel(rb.car),
        note: rivalNote(rv.parts, rb.car, findCampaignCar(rv.baseCarId)!),
        parts: rv.parts.length ? rv.parts.map((id) => findPart(id)!.name).join(', ') : '',
        skill: rv.skillLabel,
      },
      event: { title: ev.title, distance: RACE_DISTANCES[ev.distance].label, region: ev.regionLabel, prize: offer ? `${cr(ev.rewardCr)} por vitória · sem taxa de inscrição` : firstWin ? `${cr(ev.rewardCr)} + ${ev.reputation} de reputação${rv.prize && prizeState(s, ev) !== 'delivered' ? ` + ${rv.prize.nickname} (quem perde entrega o carro)` : ''}` : `revanche: ${cr(Math.round((ev.rewardCr * 0.35) / 10) * 10)}`, finale: !!ev.finale },
      makePreview: (c, w, hh) => this.preview(c, w, hh, 'plain', 0.86),
      onStart: () => offer ? this.startRace(ev, offer) : ev.finale ? this.playScenes('final-challenge', undefined, () => this.startRace(ev)) : this.startRace(ev),
      onBack: () => this.show(offer ? 'free-events' : 'events'),
    });
    return this.frame(offer ? 'Rival da madrugada' : ev.finale ? 'Desafio final' : eventLabel(ev), 'career-rival', body);
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

  startRace(ev: CareerEventDef, offer?: FreeEventOffer): void {
    if (!this.guard()) return;
    const owned = this.controller.activeCar;
    if (!owned) return;
    const pb = ownedCarBuild(owned);
    if (!pb.ok) {
      toast(`Build inválido: ${pb.errors.join('; ')}`, 'error');
      return;
    }
    this.clearRace();
    if (offer && (offer.rotation !== this.controller.save?.freeEventRotation || offer.event.chapter !== this.chapter)) {
      toast('Esta oferta já mudou. Gere um novo rival.', 'error'); return;
    }
    const rv = offer?.rival ?? rivalOf(ev);
    const playerCar = ownedCarConfig(owned);
    const rivalCarCfg = rivalCar(rv);
    this.trackCfg = findCareerTrack(ev.trackId);
    this.runner.resetAll();
    this.runner.setTrack(this.trackCfg);
    this.ctx.input.pedal = 0;
    const p = this.runner.add(playerCar, { id: 'player', lane: 0, isPlayer: true });
    // mechanical failures are on in the campaign (player car only: the rivals run their own stock limits)
    const base = findCampaignCar(owned.baseCarId)!;
    p.sim.enableEngineFailure(failureSpecFor(base, owned.installedParts, buildVersionFor(owned, owned.installedParts)));
    p.sim.onEvent = (e) => {
      if (e.type === 'ENGINE_BLOWN') playBlownEngine(this.ctx.audio);
    };
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
      freeOffer: offer,
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
    if (!this.hud) {
      this.hud = new Hud(this.ctx.hud);
      this.hud.onRiskCritical = () => playRiskWarning(this.ctx.audio);
    }
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
      ...(r.dnfReason ? { dnfReason: r.dnfReason } : {}),
      ...(r.dnfReason === 'engine-blown' && r.blownAtRpm !== undefined ? { blownAtRpm: Math.round(r.blownAtRpm) } : {}),
      ...(Object.keys(r.splits).length ? { splitsS: { ...r.splits } } : {}),
      ...(r.finished ? { maxRpm: Math.round(r.maxRpm ?? 0), gearsUsed: [...(r.gearsUsed ?? [])] } : {}),
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
    await this.record(cur.event, cur.rival, cur.attemptId, outcome, playerRes, oppRes, cur.playerBuild, cur.freeOffer);
  }

  private async record(ev: CareerEventDef, rv: RivalDef, attemptId: string, outcome: Outcome, player: RunSummary, opponent: RunSummary, pb: BuildResult, freeOffer?: FreeEventOffer): Promise<void> {
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
      buildVersion: pb.ok ? pb.version : BUILD_RESOLVER_VERSION,
      playerBuildKey: pb.ok ? pb.key : '',
      opponentBuildKey: rb.key,
    };
    const r = freeOffer ? await this.controller.recordFreeRace(res, freeOffer) : await this.controller.recordRace(res);
    if (!r.ok) {
      toast(`O resultado não foi salvo: ${r.error}`, 'error');
      return;
    }
    this.lastRecord = r.value;
    this.lastFreeOffer = freeOffer ?? null;
    this.lastComments = evaluateRace({
      outcome,
      player,
      opponent,
      playerCar: pb.ok ? pb.car : findCampaignCar(owned.baseCarId)!,
      playerPowerCv: pb.ok ? pb.peakPowerCv : 0,
      opponentPowerCv: rb.peakPowerCv,
    });
    if (freeOffer) {
      this.freeSelected = null;
      this.show('result');
      return;
    }
    const trigger: StoryTrigger = outcome === 'win' ? 'victory' : 'defeat';
    const after = (): void => {
      if (r.value.chapterCompleted) {
        this.endingChapter = ev.chapter;
        this.show('ending');
      } else this.show('result');
    };
    // result first, then the scenes on top of it
    this.show('result');
    this.playScenes(trigger, ev.id, () => {
      const next = (): void => {
        if (r.value.newUnlocks.length) this.playScenes('unlock', ev.id, after);
        else after();
      };
      if (r.value.prizeCar) this.playScenes('prize', ev.id, next);
      else next();
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
    const freeOffer = this.lastFreeOffer?.event.id === r.eventId ? this.lastFreeOffer : null;
    const ev = freeOffer?.event ?? findEvent(r.eventId)!;
    const rv = freeOffer?.rival ?? rivalOf(ev);
    const won = r.outcome === 'win';
    const p = r.playerResult;
    const o = r.opponentResult;
    const nxt = freeOffer ? null : nextEvent(this.controller.save!, ev.chapter);
    const sec = (v: number | null): string => f3(v);
    const body = buildResult({
      outcome: r.outcome,
      winnerLine: won ? 'Você venceu' : `Vencedor: ${rv.name} "${rv.nickname}"`,
      rivalName: rv.name,
      rivalNick: rv.nickname,
      rows: [
        { label: 'Reação (RT)', player: p.rt, rival: o.rt, better: 'low', format: sec },
        { label: 'ET', player: p.dnf ? null : p.et, rival: o.dnf ? null : o.et, better: 'low', format: (v) => (v === null ? 'DNF' : f3(v)) },
        ...(ev.distance === 'km'
          ? [
              { label: '201 m', player: p.splitsS?.eighth ?? null, rival: o.splitsS?.eighth ?? null, better: 'low' as const, format: (v: number | null) => (v === null ? '—' : f3(v)) },
              { label: '402 m', player: p.splitsS?.quarter ?? null, rival: o.splitsS?.quarter ?? null, better: 'low' as const, format: (v: number | null) => (v === null ? '—' : f3(v)) },
              { label: '1.000 m', player: p.dnf ? null : p.et, rival: o.dnf ? null : o.et, better: 'low' as const, format: (v: number | null) => (v === null ? 'DNF' : f3(v)) },
            ]
          : []),
        { label: 'Tempo desde o verde', player: p.total, rival: o.total, better: 'low', format: sec },
        { label: ev.distance === 'km' ? 'Velocidade na linha de chegada' : 'Velocidade final', player: p.trapKmh, rival: o.trapKmh, better: 'high', format: (v) => (v === null ? '—' : `${f1(v)} km/h`) },
        { label: 'Patinagem', player: p.wheelspinS ?? 0, rival: o.wheelspinS ?? 0, better: 'low', format: (v) => `${f2(v)} s` },
        ...(ev.distance === 'km'
          ? [
              { label: 'Rotação máxima', player: p.maxRpm ?? null, rival: o.maxRpm ?? null, better: 'low' as const, format: (v: number | null) => (v === null ? '—' : `${Math.round(v)} rpm`) },
              { label: 'Marchas usadas', player: p.gearsUsed?.length ?? null, rival: o.gearsUsed?.length ?? null, better: 'high' as const, format: (v: number | null) => (v === null ? '—' : `${v}`) },
            ]
          : []),
      ],
      credits: r.creditsAwarded,
      reputation: r.reputationAwarded,
      applied: rec.applied,
      unlocks: rec.newUnlocks.map((u) => UNLOCK_LABEL[u]),
      prize: rec.prizeCar
        ? { text: `Novo carro na garagem: ${rec.prizeCar.nickname}. ${rv.name} perdeu a final e entregou a chave.`, waiting: false }
        : rec.prizeGarageFull && rv.prize
          ? { text: `${rv.prize.nickname} está esperando: sua garagem está cheia. Venda um carro e abra a garagem para receber.`, waiting: true }
          : null,
      rivalQuote: (won ? rv.lines.win : rv.lines.lose) ?? null,
      rivalPortrait: portraitEl(rv.portrait),
      ninaPortrait: portraitEl('nina'),
      ninaComments: this.lastComments.map((c) => ({ id: c.id, text: c.text })),
      next: freeOffer ? 'Novo adversário disponível nos eventos livres.' : nxt ? `Próximo desafio: ${nxt.order}. ${nxt.title} (${rivalOf(nxt).nickname})` : 'Capítulo concluído.',
      chapterEvents: freeOffer ? 'Eventos livres' : chapterOf(ev.chapter).eventsTab,
      won,
      onRetry: () => freeOffer ? this.show('free-events') : this.startRace(ev),
      blown: p.dnfReason === 'engine-blown' ? { rpm: p.blownAtRpm ?? 0, onDyno: () => this.show('dyno') } : null,
      onGarage: () => this.show('garage'),
      onEvents: () => this.show(freeOffer ? 'free-events' : 'events'),
    });
    return this.frame({ win: 'Vitória', loss: 'Derrota', 'red-light': 'Queima de largada', dnf: 'Não completou' }[r.outcome], 'career-result', body);
  }

  private endingScreen(): HTMLElement {
    const s = this.controller.save!;
    const car = this.controller.activeCar!;
    const wins = s.results.filter((r) => r.outcome === 'win').length;
    const ch = this.endingChapter;
    const def = chapterOf(ch);
    const finale = eventsOf(ch).find((e) => e.finale)!;
    const titleText = def.championTitle;
    const nextCh = nextChapterOf(ch);
    const best = s.results.filter((r) => r.playerResult.et !== null && r.eventId === finale.id && r.outcome === 'win').map((r) => r.playerResult.et!);
    const b = ownedCarBuild(car);
    const body = buildEnding({
      chapterNumber: def.number,
      chapterTitle: def.title,
      title: titleText,
      cfg: ownedCarConfig(car),
      carLine: `${car.nickname}, ${car.installedParts.length} peças`,
      prizeLine: ((): string | null => {
        const won = s.ownedCars.find((c) => c.prizeEventId === finale.id);
        if (won) return `${won.nickname}, na garagem`;
        return rivalOf(finale).prize && prizeState(s, finale) === 'garage-full' ? `${rivalOf(finale).prize!.nickname} (espera vaga na garagem)` : null;
      })(),
      powerCv: b.ok ? b.peakPowerCv : null,
      torqueNm: b.ok ? b.peakTorqueNm : null,
      credits: s.credits,
      reputation: s.reputation,
      races: s.results.length,
      wins,
      bestEt: best.length ? Math.min(...best) : null,
      completedAt: (s.chapterCompletions[ch] ?? (ch === CHAPTER_1_ID ? s.chapterCompletedAt : null))?.slice(0, 10) ?? null,
      nextChapter: nextCh && isChapterUnlocked(s, nextCh.id) ? { number: nextCh.number, title: nextCh.title } : null,
      makePreview: (c, w, hh) => this.preview(c, w, hh, 'plain', 0.86),
      onChapters: () => this.show('chapters'),
      onGarage: () => this.show('garage'),
      onMenu: () => this.show('menu'),
    });
    const host = this.frame(titleText, 'career-ending', body);
    setTimeout(() => this.playScenes('completion', undefined, () => undefined), 400);
    return host;
  }

  private historyScreen(): HTMLElement {
    const s = this.controller.save!;
    const rows: HistoryRow[] = [...s.results].reverse().slice(0, 40).map((r) => {
      const ev = findEvent(r.eventId);
      return {
        id: r.attemptId,
        date: r.completedAt.slice(0, 16).replace('T', ' '),
        chapter: ev?.chapter ?? freeChapterOf(r.eventId) ?? CHAPTER_1_ID,
        event: ev?.title ?? (freeChapterOf(r.eventId) ? 'Evento livre' : r.eventId),
        rival: ev ? `${rivalOf(ev).name} "${rivalOf(ev).nickname}"` : r.opponentResult.name,
        outcome: r.outcome,
        rt: r.playerResult.rt,
        et: r.playerResult.et,
        total: r.playerResult.total,
        trapKmh: r.playerResult.trapKmh,
        rivalEt: r.opponentResult.et,
        credits: r.creditsAwarded,
        reputation: r.reputationAwarded,
        launchRpm: r.playerResult.launchRpm ?? null,
        maxSlip: r.playerResult.maxSlipRatio ?? null,
      };
    });
    const body = buildHistory({ rows, chapters: CHAPTERS.map((c) => ({ id: c.id, label: `Cap. ${c.number} · ${c.title}` })), onEvents: () => this.show('events'), onBack: () => this.show(this.controller.save ? 'garage' : 'menu') });
    return this.frame('Histórico', 'career-history-screen', body);
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
        ...(race.distanceId === 'km' ? { totalM: race.distanceM, partial: { label: 'parcial 402 m', timeS: r0?.splits.quarter ?? null } } : {}),
        timeS: sinceGreen,
        timeLabel: done ? 'TEMPO TOTAL' : sinceGreen === null ? 'preparação' : 'TEMPO DESDE O VERDE',
        etS: sinceGreen === null ? undefined : race.elapsed(0),
        alert: r0?.redLight ?? false,
        gapM: opp ? opp.sim.x - p.sim.x : null,
      });
      if (this.banner) this.banner.textContent = `${race.distanceId === 'km' ? 'ELITE DA MADRUGADA — 1.000 M · ' : ''}${this.current.event.title} · Você × ${this.current.rival.name} "${this.current.rival.nickname}" · ${race.status}`;
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

/** Aspiration and preparation level of a rival, read from its resolved build (never from a label). */
function rivalNote(parts: readonly string[], car: CarConfig, base: CarConfig): string {
  const turbo = car.engine.induction === 'turbo';
  const aspiration = !turbo ? 'aspirado' : car.engine.turbo?.layout === 'parallel-twin' ? 'biturbo' : 'turbo';
  const stage = parts.includes('ecu-stage3') ? 'Stage 3' : parts.includes('ecu-stage2') ? 'Stage 2' : parts.includes('ecu-stage1') ? 'Stage 1' : parts.length ? 'preparado' : 'de fábrica';
  return `${aspiration} · ${stage}${turbo && base.engine.induction !== 'turbo' ? ' (turbo não original)' : ''}`;
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
    case 'ecu':
      return e.turbo
        ? `ECU original: pressão de fábrica ${e.turbo.maxBoostBar.toFixed(2).replace('.', ',')} bar e o limitador de torque da curva original.`
        : `ECU original: corte em ${e.revLimitRpm} rpm.`;
    case 'intercooler':
      return 'Intercooler original de fábrica (≈ 60 % de eficiência).';
    case 'boost-control':
      return 'Wastegate original: segura ≈ 0,35 bar acima da pressão de fábrica.';
    case 'cylinder-head':
      return 'Cabeçote original, dutos de fundição.';
    case 'pistons':
      return `Pistões e bielas originais; taxa ${e.compressionRatio.toFixed(1).replace('.', ',')}:1.`;
    case 'flywheel':
      return `Volante original (inércia do motor ${e.inertiaKgM2.toFixed(3).replace('.', ',')} kg·m²).`;
    case 'gearbox':
      return car.transmission.kind === 'dual-clutch'
        ? `Embreagens da dupla embreagem originais: ${car.transmission.clutch.maxTorqueNm} N·m.`
        : `Elementos e conversor originais: ${car.transmission.clutch.maxTorqueNm} N·m.`;
    case 'awd':
      return car.awd ? `Diferencial central original: ${car.awd.centerCouplingNm} N·m de acoplamento.` : 'Sem tração integral.';
    case 'suspension':
      return 'Suspensão original de rua.';
    default:
      return `${CATEGORY_LABEL[cat]} original de fábrica: sem alteração de componentes.`;
  }
}
