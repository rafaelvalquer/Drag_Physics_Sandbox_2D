import { END_FADE_LEVEL, VehicleSound } from '../audio/core/VehicleSound';
import { carToAcousticConfig } from '../audio/dsp/AcousticConfig';
import { findCampaignCar } from '../data/cars/campaign';
import type { CarConfig, TrackConfig } from '../data/schema';
import { CAREER_TRACKS, findCareerTrack } from '../data/tracks/career';
import { AI_PROFILES, DragAI } from '../game/ai/DragAI';
import { CareerController, buildVersionFor } from '../game/career/CareerController';
import { REGIONS, eventsOf, findEvent, rivalOf, type CareerEventDef, type RivalDef } from '../game/career/CareerEvents';
import { availableFreeTiers, FREE_CLASS_GATES } from '../game/career/freeEvents/FreeEventCatalog';
import { freeEligibility, toFreeRaceOffer } from '../game/career/freeEvents/FreeEventService';
import { FREE_DISTANCE_LABEL, FREE_TIERS, FREE_TIER_LABEL, type FreeAttempt, type FreeRaceOffer, type FreeTier } from '../game/career/freeEvents/FreeEventTypes';
import { prizeEvents, prizeState } from '../game/career/PrizeCars';
import {
  eventLabel,
  eventStatus,
  isChapterComplete,
  isChapterUnlocked,
  nextEvent,
  unlocksOf,
} from '../game/career/CareerProgression';
import { CHAPTER_1_ID, CHAPTER_2_ID, CHAPTER_3_ID, CHAPTERS, chapterOf, nextChapterOf, type ChapterId } from '../game/career/chapters';
import { CLASSIC_CARS, DEALER_CARS, offerAvailability, resaleValue } from '../game/career/chapter2/dealer';
import { CareerRepository, CareerTabLock } from '../game/career/CareerRepository';
import { evaluateRace, type Comment } from '../game/career/CareerResultEvaluator';
import { DEFAULT_SLOT, STARTER_CARS, type CareerRaceResult, type FreeRaceResult, type OutcomeSchema, type OwnedCar, type RunSummary } from '../game/career/CareerState';
import { SPEAKER_NAME, pendingScenes, type StoryScene, type StoryTrigger } from '../game/career/CareerStory';
import type { RaceRecord } from '../game/career/CareerController';
import { TelemetryProbe, runHeadlessRace } from '../game/career/headlessRace';
import { ownedCarBuild, ownedCarConfig, ownedCarLook, rivalBuild, rivalCar } from '../game/career/RivalBuildFactory';
import { BUILD_RESOLVER_VERSION, resolveBuild, type BuildResult } from '../game/career/tuning/BuildResolver';
import type { BuildTune } from '../game/career/tuning/buildCommon';
import { failureSpecFor, reconcileTune, tuneReliability } from '../game/career/tuning/TuningCapabilities';
import { playBlownEngine, playRiskWarning } from '../audio/core/blownEngineSound';
import { UNLOCK_LABEL, findPart, type NitrousKitPart } from '../game/career/tuning/parts';
import { RACE_DISTANCES, RaceController, type LaneResult, type RaceLane } from '../game/race/RaceController';
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
import { buildWorkshop, type WorkshopVisualView } from '../ui/workshop/WorkshopController';
import { CareerWorkshopAdapter } from '../ui/workshop/CareerWorkshopAdapter';
import { WorkshopVisualState } from '../ui/workshop/WorkshopVisualState';

import { menuViewModel } from '../ui/career/menu/CareerMenuProgress';

type Screen = 'menu' | 'choose' | 'garage' | 'workshop' | 'dyno' | 'events' | 'free-events' | 'free-rival' | 'free-result' | 'free-history' | 'rival' | 'race' | 'result' | 'ending' | 'history' | 'market' | 'chapters';
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
  // an upgraded box has no D schedule: the player does every shift
  if (c.transmission.playerShifts) return `manual (câmbio melhorado), ${n} marchas, você troca`;
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
  private seed = 1;
  /** Race in progress. */
  private current: ({
    event: CareerEventDef;
    rival: RivalDef;
    attemptId: string;
    playerCar: CarConfig;
    rivalCarCfg: CarConfig;
    probes: [TelemetryProbe, TelemetryProbe];
    recorded: boolean;
    playerBuild: BuildResult;
    playerCarId: string;
  } & ({ kind: 'campaign' } | { kind: 'free'; freeOffer: FreeRaceOffer })) | null = null;
  lastRecord: RaceRecord | null = null;
  private freeSelected: FreeRaceOffer | null = null;
  private lastFreeOffer: FreeRaceOffer | null = null;
  private freeResultError: { message: string; retry(): Promise<void> } | null = null;
  private freeFilter: FreeTier | null = null;
  private startingFreeRace = false;
  private lastComments: Comment[] = [];
  /** Test hook: the player's lane is driven by the advanced AI profile. */
  autopilot = false;
  /** Ready promise for the tests. */
  ready: Promise<void> = Promise.resolve();

  mount(ctx: AppContext): void {
    this.ctx = ctx;
    this.runner = new SimulationRunner(this.trackCfg, () => ctx.input.release('nitrous'));
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
      for (const n of this.controller.migrationNotices) toast(n);
      this.controller.migrationNotices = [];
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
    this.workshopView?.dispose();
    this.workshopView = null;
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
    } else if (screen === 'workshop') (this.workshopView as WorkshopVisualView | null)?.attach(this.transition.enterWorkshop(body, reduced));
    else this.transition.enter(body, reduced);
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
      case 'free-rival':
      case 'rival':
        return this.rivalScreen(screen === 'free-rival');
      case 'free-result':
        return this.freeResultError ? this.freeResultErrorScreen() : this.resultScreen();
      case 'result':
        return this.resultScreen();
      case 'ending':
        return this.endingScreen();
      case 'free-history':
      case 'history':
        return this.historyScreen(screen === 'free-history');
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
      for (const n of this.controller.migrationNotices) toast(n);
      this.controller.migrationNotices = [];
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
      ...CLASSIC_CARS.map((o) => {
        const a = offerAvailability(s, o);
        return mk(o.baseCarId, o.price, 'street', a.ok, a.ok ? null : a.reason, s.ownedCars.some((c) => c.baseCarId === o.baseCarId));
      }),
      ...(leagueOpen
        ? DEALER_CARS.filter((o) => (o.chapter ?? 2) >= 2 && (o.chapter !== 3 || eliteOpen)).map((o) => {
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

  /** The visual workshop (src/ui/career/workshop-visual): the UI state survives visits, the view does not. */
  private readonly workshopState = new WorkshopVisualState();
  private workshopView: WorkshopVisualView | null = null;

  private workshopScreen(): HTMLElement {
    this.workshopView?.dispose();
    const view = buildWorkshop(
      new CareerWorkshopAdapter(this.controller, () => chapterOf(this.chapter).number),
      {
        guard: () => this.guard(),
        audio: this.ctx.audio,
        openDyno: () => this.show('dyno'),
        back: () => this.show('garage'),
        changed: () => this.refreshStatus(),
        toast,
      },
      this.workshopState,
    );
    this.workshopView = view;
    return this.frame('Oficina', 'career-workshop', view.root);
  }

  /** Updates the shell status (credits, reputation) after the save changed without rebuilding the screen. */
  private refreshStatus(): void {
    const s = this.controller.save;
    if (!s) return;
    const set = (id: string, text: string): void => {
      const el = this.root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (el) el.textContent = text;
    };
    set('career-credits', cr(s.credits));
    set('career-reputation', `Reputação ${s.reputation}`);
  }

  // ------------------------------------------------------------------ dyno

  private dynoLab: DynoLabView | null = null;
  /** How the Dyno Lab test run uses the N₂O kit (a car without one ignores it). */
  private dynoNitro: 'off' | 'continuous' | 'strategic' = 'off';

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
    const nitroSelect = h(
      'label',
      { class: 'lead' },
      'Nitro no teste: ',
      h(
        'select',
        {
          'data-testid': 'dyno-nitro-mode',
          onchange: (e: Event) => {
            this.dynoNitro = (e.target as HTMLSelectElement).value as typeof this.dynoNitro;
            this.show('dyno');
          },
        },
        h('option', { value: 'off', selected: this.dynoNitro === 'off' }, 'sem nitro'),
        h('option', { value: 'continuous', selected: this.dynoNitro === 'continuous' }, 'uso contínuo'),
        h('option', { value: 'strategic', selected: this.dynoNitro === 'strategic' }, 'uso estratégico'),
      ),
    );
    const nitroKit = car.installedParts.map((id) => findPart(id)).find((p): p is NitrousKitPart => !!p && p.category === 'nitrous');
    const nitroNote = h('p', { class: 'lead', 'data-testid': 'dyno-nitro-note' });
    const view = buildDynoLab({
      carName: car.nickname,
      cfg: b.ok ? ownedCarConfig(car) : null,
      makePreview: (c, w, hh) => this.preview(c, w, hh, 'plain', 0.86),
      caps,
      saved: car.tune ?? {},
      turbo: b.ok && b.car.engine.induction === 'turbo',
      ...(nitroKit
        ? { nitro: { kit: nitroKit, resolve: (tune: BuildTune) => resolveBuild(base, car.installedParts, tune, version) } }
        : {}),
      measure: async (tune, stale, prog) => {
        const r = resolveBuild(base, car.installedParts, tune, version);
        if (!r.ok) return { error: r.errors.join('; ') };
        const m = await measureLab(r.car, track, () => stale() || !view.el.isConnected, prog, { nitrous: this.dynoNitro });
        const nz = m?.nitrous;
        nitroNote.textContent = nz
          ? `N₂O: ${Math.round(nz.peakCv)} cv na bancada. Na pista, ${nz.usedKg > 0 ? `+${Math.round(nz.observedExtraCv)} cv de pico e ${(nz.usedKg * 1000).toFixed(1)} de ${(nz.capacityKg * 1000).toFixed(0)} g usados em ${nz.activeS.toFixed(1)} s` : 'sem injeção'}.`
          : '';
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
    return this.frame('Dyno Lab', 'career-dyno', h('p', { class: 'lead' }, `${car.nickname}: o dinamômetro mede o motor que está no carro, com as peças instaladas, e a pista de testes mede o carro. Os valores vêm da física, não da ficha.`), car.installedParts.some((p) => p.startsWith('nitrous-')) ? nitroSelect : null, nitroNote, view.el);
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
    const chapter = this.chapter;
    const initial = this.controller.save!;
    const unlocked = availableFreeTiers(initial, chapter);
    const filter = this.freeFilter && unlocked.includes(this.freeFilter) ? this.freeFilter : null;
    const host = h('div', { 'aria-busy': 'true' }, h('p', { class: 'hint', role: 'status' }, 'Carregando ofertas…'));
    let busy = false;
    const load = async (refresh = false, replaceId?: string): Promise<void> => {
      if (busy) return;
      busy = true;
      host.setAttribute('aria-busy', 'true');
      host.inert = true;
      const result = await this.controller.freeBoard(filter, refresh, replaceId, this.readOnly);
      busy = false;
      if (!host.isConnected) return;
      host.inert = false;
      host.setAttribute('aria-busy', 'false');
      if (!result.ok) {
        host.replaceChildren(h('p', { class: 'error', role: 'alert' }, result.error),
          h('button', { class: 'cs-btn', onclick: () => void load() }, 'Tentar novamente'));
        return;
      }
      this.disposePreviews();
      const car = this.controller.activeCar;
      const build = car && ownedCarBuild(car);
      const gateLabels = Object.fromEntries(FREE_TIERS.map((tier) => [
        tier, `Após ${chapterOf(chapter).theLabel} ${FREE_CLASS_GATES[chapter][tier]}`,
      ])) as Record<FreeTier, string>;
      host.replaceChildren(buildFreeEvents({
        chapterTitle: chapterOf(chapter).title,
        offers: result.value.map((offer) => ({
          offer,
          powerCv: rivalBuild(toFreeRaceOffer(offer).rival).peakPowerCv,
          eligibility: car && build ? freeEligibility(offer, car, build) : 'Escolha um carro na garagem.',
        })),
        unlocked, gateLabels, filter,
        makePreview: (offer, width, height) => this.preview(rivalCar(toFreeRaceOffer(offer).rival), width, height, 'plain', 0.86),
        onPick: (offer) => {
          this.freeSelected = toFreeRaceOffer(offer);
          this.show('free-rival');
        },
        onFilter: (tier) => {
          this.freeFilter = tier;
          this.show('free-events');
        },
        onRefresh: () => { if (this.guard()) void load(true); },
        onReplace: (id) => { if (this.guard()) void load(false, id); },
        onHistory: () => this.show('free-history'),
        onBack: () => this.show('garage'),
      }));
    };
    queueMicrotask(() => { if (host.isConnected) void load(); });
    return this.frame('Eventos Livres — A Madrugada Não Para', 'career-free-events', host);
  }

  selectedEvent: string | null = null;
  /** Chapter whose ending screen is shown. */
  private endingChapter: ChapterId = CHAPTER_1_ID;

  /** Active chapter of the save. */
  get chapter(): ChapterId {
    return this.controller.save?.chapterId ?? CHAPTER_1_ID;
  }

  private rivalScreen(free = false): HTMLElement {
    const offer = free ? this.freeSelected : null;
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
      startBlocked: offer ? freeEligibility(offer.offer, mine, mb) : null,
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
        note: offer ? [offer.offer.paintName, offer.offer.preparation, rivalNote(rv.parts, rb.car, findCampaignCar(rv.baseCarId)!)].filter(Boolean).join(" · ") : rivalNote(rv.parts, rb.car, findCampaignCar(rv.baseCarId)!),
        parts: rv.parts.length ? rv.parts.map((id) => findPart(id)!.name).join(', ') : '',
        skill: rv.skillLabel,
      },
      event: { title: ev.title, distance: RACE_DISTANCES[ev.distance].label, region: ev.regionLabel, prize: offer ? `${cr(ev.rewardCr)} por vitória · sem taxa de inscrição` : firstWin ? `${cr(ev.rewardCr)} + ${ev.reputation} de reputação${rv.prize && prizeState(s, ev) !== 'delivered' ? ` + ${rv.prize.nickname} (quem perde entrega o carro)` : ''}` : `revanche: ${cr(Math.round((ev.rewardCr * 0.35) / 10) * 10)}`, finale: !!ev.finale },
      makePreview: (c, w, hh) => this.preview(c, w, hh, 'plain', 0.86),
      onStart: () => offer ? void this.startFreeRace(offer) : ev.finale ? this.playScenes('final-challenge', undefined, () => this.startRace(ev)) : this.startRace(ev),
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

  private async startFreeRace(selection: FreeRaceOffer): Promise<void> {
    if (!this.guard() || this.startingFreeRace) return;
    this.startingFreeRace = true;
    try {
      const result = await this.controller.beginFreeRace(selection.offer.id);
      if (!this.root.isConnected || this.screen !== 'free-rival' || this.freeSelected !== selection) return;
      if (!result.ok) { toast(result.error, 'error'); return; }
      const { offer, attempt } = result.value;
      const raceOffer = toFreeRaceOffer(offer);
      this.startRace(raceOffer.event, { offer: raceOffer, attempt });
    } finally {
      this.startingFreeRace = false;
    }
  }

  startRace(ev: CareerEventDef, free?: { offer: FreeRaceOffer; attempt: FreeAttempt }): void {
    this.ctx.input.release('nitrous');
    if (!this.guard()) return;
    const owned = this.controller.activeCar;
    if (!owned) return;
    const pb = ownedCarBuild(owned);
    if (!pb.ok) {
      toast(`Build inválido: ${pb.errors.join('; ')}`, 'error');
      return;
    }
    if (free && (free.attempt.carId !== owned.id || free.attempt.buildKey !== pb.key)) {
      toast('A preparação mudou. Confirme a inscrição novamente.', 'error');
      return;
    }
    this.clearRace();
    this.freeResultError = null;
    const rv = free?.offer.rival ?? rivalOf(ev);
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
    const opponentSeed = free ? (free.offer.offer.opponent.seed + free.offer.offer.attemptsStarted) >>> 0 : 500 + this.seed;
    const lanes: RaceLane[] = [
      this.autopilot
        ? { sim: p.sim, ai: new DragAI(p.sim.car, 'advanced', 77 + this.seed, AI_PROFILES.advanced), name: 'Você' }
        : { sim: p.sim, ai: null, pedal: () => this.ctx.input.updatePedal(PHYSICS_DT), name: 'Você' },
      { sim: o.sim, ai: new DragAI(o.sim.car, 'advanced', opponentSeed, rv.skill), name: `${rv.name} "${rv.nickname}"` },
    ];
    const race = new RaceController(lanes, ev.distance, 'pro', this.seed);
    this.race = race;
    const probes: [TelemetryProbe, TelemetryProbe] = [new TelemetryProbe(), new TelemetryProbe()];
    this.current = {
      event: ev,
      rival: rv,
      attemptId: free?.attempt.id ?? `${ev.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`,
      playerCar,
      rivalCarCfg,
      probes,
      recorded: false,
      playerBuild: pb,
      playerCarId: owned.id,
      ...(free ? { kind: 'free' as const, freeOffer: free.offer } : { kind: 'campaign' as const }),
    };
    p.control = (hh) => {
      p.sim.nitrousHeld = !this.autopilot && race.phase !== 'finished' && this.ctx.input.isDown('nitrous');
      race.beforeStep(hh);
    };
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
    await this.record(cur.event, cur.rival, cur.attemptId, outcome, playerRes, oppRes, cur.playerBuild, cur.kind === 'free' ? cur.freeOffer : undefined, cur.playerCarId);
  }

  private async record(ev: CareerEventDef, rv: RivalDef, attemptId: string, outcome: Outcome, player: RunSummary, opponent: RunSummary, pb: BuildResult, freeOffer?: FreeRaceOffer, playerCarId = this.controller.activeCar!.id): Promise<void> {
    const rb = rivalBuild(rv);
    const res: Omit<CareerRaceResult, 'creditsAwarded' | 'reputationAwarded'> = {
      attemptId,
      eventId: ev.id,
      playerCarId,
      opponentCarId: rb.car.id,
      playerResult: player,
      opponentResult: opponent,
      outcome,
      completedAt: new Date().toISOString(),
      buildVersion: pb.ok ? pb.version : BUILD_RESOLVER_VERSION,
      playerBuildKey: pb.ok ? pb.key : '',
      opponentBuildKey: rb.key,
    };
    const r = freeOffer ? await this.controller.recordFreeRace(res) : await this.controller.recordRace(res);
    if (!r.ok) {
      if (freeOffer && this.root.isConnected) {
        this.freeResultError = {
          message: r.error,
          retry: () => this.record(ev, rv, attemptId, outcome, player, opponent, pb, freeOffer, playerCarId),
        };
        this.show('free-result');
      } else toast(`O resultado não foi salvo: ${r.error}`, 'error');
      return;
    }
    this.lastRecord = r.value;
    this.freeResultError = null;
    this.lastFreeOffer = freeOffer ?? null;
    this.lastComments = evaluateRace({
      outcome,
      player,
      opponent,
      playerCar: pb.ok ? pb.car : ownedCarConfig(this.controller.activeCar!),
      playerPowerCv: pb.ok ? pb.peakPowerCv : 0,
      opponentPowerCv: rb.peakPowerCv,
    });
    if (freeOffer) {
      this.freeSelected = null;
      this.show('free-result');
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

  private freeResultErrorScreen(): HTMLElement {
    const pending = this.freeResultError!;
    const retry = h('button', { class: 'cs-btn', type: 'button', onclick: () => {
      retry.disabled = true;
      void pending.retry();
    } }, 'Salvar resultado novamente');
    return this.frame('Resultado pendente', 'career-result-pending',
      h('p', { class: 'error', role: 'alert' }, pending.message), retry);
  }

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
      next: freeOffer ? (won ? 'Novo adversário disponível nos Eventos Livres.' : 'Este adversário está disponível para revanche.') : nxt ? `Próximo desafio: ${nxt.order}. ${nxt.title} (${rivalOf(nxt).nickname})` : 'Capítulo concluído.',
      chapterEvents: freeOffer ? 'Eventos livres' : chapterOf(ev.chapter).eventsTab,
      won,
      free: !!freeOffer,
      rivalCar: freeOffer ? this.preview(rivalCar(rv), 420, 160, 'plain', 0.86) : undefined,
      rivalCarLabel: freeOffer ? `${freeOffer.offer.carName} · ${freeOffer.offer.paintName}` : undefined,
      onRetry: () => {
        if (!freeOffer) return this.startRace(ev);
        if (won) return this.show('free-events');
        this.freeSelected = freeOffer;
        this.show('free-rival');
      },
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

  private historyScreen(free = false): HTMLElement {
    const s = this.controller.save!;
    const recent: (CareerRaceResult | FreeRaceResult)[] = free ? s.freeEvents.results : s.results;
    const rows: HistoryRow[] = [...recent].reverse().map((r) => {
      const ev = findEvent(r.eventId);
      const details = 'details' in r ? r.details : undefined;
      const chapter = 'chapter' in r ? r.chapter : ev?.chapter ?? CHAPTER_1_ID;
      return {
        id: r.attemptId,
        date: new Date(r.completedAt).toLocaleString('pt-BR'),
        chapter,
        event: details ? `Evento livre · ${FREE_TIER_LABEL[details.tier]}` : ev?.title ?? 'Evento livre',
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
        freeDetails: details && {
          car: details.carName, paint: details.paintName, preparation: details.preparation,
          track: findCareerTrack(details.trackId).name, distance: FREE_DISTANCE_LABEL[details.distance],
          chapterTitle: chapterOf(chapter).title,
        },
      };
    });
    const body = buildHistory({
      rows, chapters: CHAPTERS.map((c) => ({ id: c.id, label: `Cap. ${c.number} · ${c.title}` })),
      freeStats: free ? s.freeEvents.stats : undefined,
      activeChapter: this.chapter,
      onEvents: () => this.show(free ? 'free-events' : 'events'),
      onBack: () => this.show('garage'),
    });
    const tabs = h('div', { class: 'mk-filters', 'aria-label': 'Tipos de histórico' },
      h('button', { class: `mk-filter ${free ? '' : 'on'}`, 'aria-pressed': String(!free), onclick: () => this.show('history') }, 'Campanha'),
      h('button', { class: `mk-filter ${free ? 'on' : ''}`, 'aria-pressed': String(free), 'data-testid': 'history-free-tab', onclick: () => this.show('free-history') }, 'Eventos Livres'),
    );
    return this.frame(free ? 'Histórico dos Eventos Livres' : 'Histórico', 'career-history-screen', tabs, body);
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
    // the race is over: the idling engines fade out under the result, and come back with the next race
    const over = this.screen === 'race' && this.race?.phase === 'finished';
    for (const v of this.runner.vehicles) v.sound?.setFade(over ? END_FADE_LEVEL : 1);
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
  const ecuLevel = parts.map((id) => findPart(id)).find((p) => p?.category === 'ecu') as { level?: string } | undefined;
  const stageOf = ecuLevel?.level === 'stage3' ? 'Stage 3' : ecuLevel?.level === 'stage2' ? 'Stage 2' : ecuLevel?.level === 'stage1' ? 'Stage 1' : null;
  const stage = stageOf ?? (parts.length ? 'preparado' : 'de fábrica');
  return `${aspiration} · ${stage}${turbo && base.engine.induction !== 'turbo' ? ' (turbo não original)' : ''}`;
}

function portraitEl(id: Parameters<typeof portraitSvg>[0]): HTMLElement {
  const d = h('div', { class: 'portrait', 'data-portrait': id });
  d.innerHTML = portraitSvg(id);
  return d;
}
