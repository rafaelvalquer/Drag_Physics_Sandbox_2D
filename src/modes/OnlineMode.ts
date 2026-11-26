import type { AppContext, Mode } from '../app/Mode';
import { findCampaignCar } from '../data/cars/campaign';
import { findTrack, TRACKS } from '../data/tracks';
import { ONLINE_INPUT_HZ, type GarageRequest, type OnlineGearUpdate, type OnlineLoadingState, type OnlineLobbyState, type OnlineRaceSnapshot } from '../game/online/contracts';
import { ONLINE_STARTERS } from '../game/online/demoCatalog';
import { rankCategory } from '../game/online/economy';
import type { Garage, HistoryRace, OnlineClient, OnlineRoom, Ranking } from '../game/online/OnlineClient';
import { OnlineRaceRenderer } from '../game/online/OnlineRaceRenderer';
import { PREPARATION_TREES } from '../game/online/preparation';
import { RACE_DISTANCES, SPLITS } from '../game/race/RaceController';
import type { CameraMode } from '../game/scenes/CameraController';
import type { OnlineAward } from '../server/online/matches';
import { fmt, h, toast } from '../ui/dom';
import { onlineDyno } from '../ui/online/OnlineDyno';
import { garageCards, market, preparationTree, workshop } from '../ui/online/OnlineGarageView';
import '../ui/online/online.css';

type Screen = 'Garagem' | 'Classificados' | 'Preparação' | 'Oficina' | 'Dinamômetro' | 'Ranking' | 'Histórico';
type Result = { snapshot: OnlineRaceSnapshot; award: OnlineAward };
const outcomes = { win: 'Vitória', loss: 'Derrota', draw: 'Empate', forfeit: 'Desistência', cancelled: 'Cancelada' };
const cameras: CameraMode[] = ['follow', 'wide', 'start'];
const markers = SPLITS.filter((split) => split.m <= RACE_DISTANCES.quarter.m).map((split) => ({ xM: split.m, label: split.label, major: split.trap }));
const INPUT_INTERVAL_MS = 1_000 / ONLINE_INPUT_HZ;
// Allow a shift before the next frame without flooding the room's message limit.
const MIN_INPUT_INTERVAL_MS = 28;

export class OnlineMode implements Mode {
  readonly id = 'online';
  readonly label = 'Online';
  readonly noPanel = true;
  cameraMode: CameraMode = 'follow';
  private ctx!: AppContext;
  private root!: HTMLElement;
  private client?: OnlineClient;
  private room?: OnlineRoom;
  private garage?: Garage;
  private screen: Screen = 'Garagem';
  private carId?: string;
  private focusNode?: string;
  private renderer?: OnlineRaceRenderer;
  private lobby?: OnlineLobbyState;
  private ranking?: Ranking;
  private history?: HistoryRace[];
  private page = 0;
  private trackConfig = TRACKS[0]!;
  private result?: Result;
  private countdown?: HTMLElement;
  private countdownLocalAt = 0;
  private reconnectNote?: HTMLElement;
  private inputTimer?: number;
  private pedalUpdatedAt = 0;
  private lastInputAt = -Infinity;
  private nextProbeAt = 0;
  private bestRttMs = Number.POSITIVE_INFINITY;
  private serverClockOffsetMs?: number;
  private inputSequence = 0;
  private shift?: -1 | 1;
  private connected = false;
  private driving = false;
  private mounted = false;
  private busy = false;
  private disposeScreen?: () => void;
  private readonly pendingOperations = new Map<string, string>();
  private readonly cleanups: (() => void)[] = [];

  get usesTrack(): boolean { return this.driving && !!this.renderer; }
  track() { return this.trackConfig; }
  vehicles() { return this.renderer?.vehicles() ?? []; }
  tree() { return this.renderer?.lights() ?? null; }
  markers() { return markers; }
  finishM() { return RACE_DISTANCES.quarter.m; }
  onAudioReady(): void { this.renderer?.onAudioReady(); }

  mount(ctx: AppContext): void {
    this.ctx = ctx;
    this.mounted = true;
    this.root = h('div', { class: 'career online-screen', 'data-testid': 'online-screen' });
    ctx.overlay.append(this.root);
    this.reconnectNote = h('div', { class: 'banner', hidden: true, role: 'status' }, 'Reconectando à partida…');
    ctx.overlay.append(this.reconnectNote);
    const captureShift = (direction: 1 | -1) => {
      if (!this.driving || !this.connected) return;
      this.shift = direction;
      this.sendInput(performance.now());
    };
    this.cleanups.push(ctx.input.on('upshift', () => captureShift(1)), ctx.input.on('downshift', () => captureShift(-1)),
      ctx.input.on('camera', () => { this.cameraMode = cameras[(cameras.indexOf(this.cameraMode) + 1) % cameras.length]!; }));
    this.status('Conectando ao modo online…');
    void this.initialize();
  }

  unmount(): void {
    this.mounted = false;
    this.leaveRoom();
    this.disposeScreen?.();
    this.reconnectNote?.remove();
    this.root.remove();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
  }

  tick(dt: number): void {
    const now = performance.now();
    if (this.countdown && this.lobby?.deadline != null) {
      this.countdown.textContent = `${Math.max(0, Math.ceil((this.countdownLocalAt - now) / 1_000))} s`;
    }
    if (this.room && this.connected && now >= this.nextProbeAt) {
      this.nextProbeAt = now + 2_000;
      this.room.send('timeProbe', now);
    }
    if (this.driving) this.renderer?.tick(dt);
  }

  private sendInput(now: number): void {
    const snapshot = this.renderer?.newest;
    if (!snapshot || !this.room || !this.connected || now - this.lastInputAt < MIN_INPUT_INTERVAL_MS) return;
    this.lastInputAt = now;
    this.ctx.input.updatePedal((now - this.pedalUpdatedAt) / 1_000);
    this.pedalUpdatedAt = now;
    this.room.send('input', { matchId: snapshot.matchId, observedTick: snapshot.tick, sequence: this.inputSequence++,
      throttle: this.ctx.input.pedal, shift: this.shift, nitrous: this.ctx.input.isDown('nitrous') });
    this.shift = undefined;
  }

  private async initialize(): Promise<void> {
    try {
      const { onlineClient } = await import('../game/online/OnlineClient');
      if (!this.mounted) return;
      this.client = onlineClient();
      this.cleanups.push(this.client.onSession((token) => {
        if (token && this.connected) this.room?.send('session', token);
        if (!token && this.mounted) {
          this.pendingOperations.clear();
          this.leaveRoom();
          this.garage = undefined;
          this.login();
        }
      }));
      const loggedIn = await this.client.restore();
      if (!this.mounted) return;
      if (loggedIn) await this.refresh();
      else this.login();
    } catch (error) {
      if (this.mounted) this.login(this.message(error));
    }
  }

  private message(error: unknown): string { return error instanceof Error ? error.message : 'Não foi possível concluir a operação online.'; }
  private button(label: string, action: () => void, primary = false, disabled = false): HTMLButtonElement {
    return h('button', { onclick: action, class: primary ? 'primary' : '', disabled }, label);
  }

  private show(title: string, content: HTMLElement, navigation?: HTMLElement): void {
    if (!this.mounted) return;
    this.disposeScreen?.();
    this.disposeScreen = undefined;
    this.root.hidden = false;
    this.root.replaceChildren(h('main', { class: 'career-screen' }, h('header', {},
      h('div', { class: 'career-title' }, h('h1', {}, title)),
      this.garage && h('div', { class: 'career-status' },
        this.garage.profile.avatar_url && h('img', { class: 'online-avatar', src: this.garage.profile.avatar_url, alt: '', referrerpolicy: 'no-referrer' }),
        h('span', {}, this.garage.profile.nickname),
        h('span', {}, `${this.garage.profile.cr_balance.toLocaleString('pt-BR')} CR`), h('span', {}, `${this.garage.profile.rp} RP`))),
    navigation, content));
  }

  private status(message: string): void { this.show('Online', h('p', { role: 'status' }, message)); }

  private policyLinks(): HTMLElement {
    return h('div', { class: 'row' },
      h('a', { href: './online/privacidade.html', target: '_blank', rel: 'noopener' }, 'Privacidade'),
      h('a', { href: './online/termos.html', target: '_blank', rel: 'noopener' }, 'Termos de uso'));
  }

  private login(message?: string): void {
    this.show('Online', h('section', { class: 'online-card online-small' },
      h('p', {}, message ?? 'Entre com sua conta Google para acessar sua garagem e disputar corridas 1 contra 1.'),
      this.client && this.button('Continuar com Google', () => { void this.run(() => this.client!.login()); }, true), this.policyLinks()));
  }

  private onboarding(): void {
    const nickname = h('input', { required: true, minlength: 3, maxlength: 24, autocomplete: 'nickname' });
    const car = h('select', {}, ONLINE_STARTERS.map((id) => h('option', { value: id }, findCampaignCar(id)!.name)));
    const terms = h('input', { type: 'checkbox', required: true });
    const avatar = h('input', { type: 'checkbox' });
    this.show('Primeiro acesso', h('form', { class: 'online-card online-small', onsubmit: (event) => {
      event.preventDefault();
      if (!terms.checked) return;
      void this.run(async () => {
        this.garage = await this.client!.setup({ nickname: nickname.value, baseCarId: car.value, termsAccepted: true, useGoogleAvatar: avatar.checked });
        this.dashboard();
      });
    } }, h('label', {}, 'Nickname público', nickname), h('label', {}, 'Primeiro carro', car),
    this.policyLinks(),
    h('label', { class: 'row' }, terms, 'Aceito os termos de uso'), h('label', { class: 'row' }, avatar, 'Usar imagem de perfil do Google'),
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary' }, 'Criar garagem'),
      h('button', { type: 'button', onclick: () => { void this.run(() => this.client!.logout()); } }, 'Sair'))));
  }

  private async refresh(): Promise<void> {
    const garage = await this.client!.garage();
    if (!this.mounted) return;
    this.garage = garage ?? undefined;
    if (this.garage) this.dashboard();
    else this.onboarding();
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy || !this.mounted) return;
    this.busy = true;
    try { await action(); } catch (error) { if (this.mounted) toast(this.message(error), 'error'); }
    finally { this.busy = false; }
  }

  private mutate = (operation: GarageRequest['operation']): Promise<void> => this.run(async () => {
    const { OnlineApiError } = await import('../game/online/OnlineClient');
    const key = JSON.stringify(operation);
    const operationId = this.pendingOperations.get(key) ?? crypto.randomUUID();
    this.pendingOperations.set(key, operationId);
    try {
      await this.client!.change({ operation, operationId });
      this.pendingOperations.delete(key);
    } catch (error) {
      if (error instanceof OnlineApiError && error.status < 500 && error.status !== 429) this.pendingOperations.delete(key);
      throw error;
    }
    await this.refresh();
  });

  private navigation(): HTMLElement {
    return h('nav', { class: 'row online-nav', 'aria-label': 'Modo online' },
      this.button('Buscar partida', () => { void this.queue(); }, true),
      (['Garagem', 'Classificados', 'Ranking', 'Histórico'] as const).map((screen) =>
        this.button(screen, () => this.navigate(screen), this.screen === screen)),
      this.button('Sair', () => { void this.run(() => this.client!.logout()); }));
  }

  private navigate(screen: Screen, carId?: string, node?: string): void {
    this.screen = screen;
    this.carId = carId;
    this.focusNode = node;
    this.page = 0;
    this.ranking = undefined;
    this.history = undefined;
    this.dashboard();
    if (screen === 'Ranking' || screen === 'Histórico') void this.fetchPage();
  }

  private dashboard(): void {
    if (!this.garage || !this.mounted || this.room) return;
    const garage = this.garage;
    const car = garage.cars.find((item) => item.id === this.carId);
    const section = new Map([['tree', 'Preparação'], ['workshop', 'Oficina'], ['dyno', 'Dinamômetro'], ['history', 'Histórico']] as const);
    let content: HTMLElement;
    let dispose: (() => void) | undefined;
    if (this.screen === 'Classificados') content = market(garage.profile.cr_balance, this.mutate);
    else if (this.screen === 'Ranking' || this.screen === 'Histórico') content = this.records();
    else if (this.screen === 'Preparação' && car) content = preparationTree(car, this.mutate, this.focusNode);
    else if (this.screen === 'Oficina' && car) content = workshop(garage, car, this.mutate, (node) => this.navigate('Preparação', car.id, node));
    else if (this.screen === 'Dinamômetro' && car) {
      const view = onlineDyno(car, (tune) => this.mutate({ kind: 'tune', carId: car.id, buildRevision: car.build_revision, tune }));
      content = view.element;
      dispose = view.dispose;
    }
    else content = garageCards(garage, this.mutate, (chosen, project) => this.navigate(section.get(project)!, chosen.id));
    this.show(this.screen, content, this.navigation());
    this.disposeScreen = dispose;
    if (this.focusNode) requestAnimationFrame(() => document.getElementById(`online-node-${this.focusNode}`)?.scrollIntoView({ block: 'nearest' }));
  }

  private async fetchPage(): Promise<void> {
    const { screen, page, carId } = this;
    try {
      if (screen === 'Ranking') {
        const ranking = await this.client!.ranking(page * 25);
        if (screen !== this.screen || page !== this.page) return;
        this.ranking = ranking;
      } else {
        const history = await this.client!.history(page * 25, carId);
        if (screen !== this.screen || page !== this.page || carId !== this.carId) return;
        this.history = history;
      }
      this.dashboard();
    } catch (error) { if (this.mounted) toast(this.message(error), 'error'); }
  }

  private records(): HTMLElement {
    const rank = this.screen === 'Ranking';
    const entries = rank ? this.ranking?.entries : this.history;
    const row = (headers: boolean, values: (string | number)[], mine = false) => h('tr', { class: mine ? 'online-focused' : '' },
      values.map((value) => headers ? h('th', { scope: 'col' }, value) : h('td', {}, value)));
    const heading = rank ? ['Posição', 'Piloto', 'Categoria', 'RP', 'V', 'D', 'Corridas', 'Vitórias %', 'Sequência', 'Melhor RP'] :
      ['Quando', 'Adversário', 'Resultado', 'CR', 'RP', 'PP', 'Motivo'];
    const rows = rank ? this.ranking?.entries.map((entry) => row(false, [entry.position, entry.nickname, entry.category, entry.rp,
      entry.wins, entry.losses, entry.total_races, entry.total_races ? `${(entry.wins * 100 / entry.total_races).toFixed(1)}%` : '—', entry.win_streak, entry.highest_rp], entry.mine)) :
      this.history?.map((entry) => row(false, [new Date(entry.finished_at).toLocaleString('pt-BR'), entry.opponent ?? '—',
        outcomes[entry.outcome], entry.cr_reward, entry.rp_delta, entry.pp_reward, entry.reward_reason ?? '—']));
    return h('section', { class: 'online-records' }, rank && this.ranking?.ownPosition != null && h('p', {}, `Sua posição global: ${this.ranking.ownPosition}`),
      !entries ? h('p', { role: 'status' }, 'Carregando…') : entries.length === 0 ? h('p', {}, 'Nenhum registro nesta página.') :
        h('div', { class: 'online-table' }, h('table', { class: rank ? '' : 'online-history-table' }, h('thead', {}, row(true, heading)), h('tbody', {}, rows ?? []))),
      h('div', { class: 'row' }, this.button('Anterior', () => { this.page--; void this.fetchPage(); }, false, this.page === 0),
        this.button('Próxima', () => { this.page++; void this.fetchPage(); }, false, entries?.length !== 25)));
  }

  private queue(): Promise<void> {
    return this.run(async () => {
      const room = await this.client!.joinQueue();
      if (!this.mounted) { void room.leave(); return; }
      this.room = room;
      this.connected = true;
      this.result = undefined;
      this.lobby = undefined;
      this.inputSequence = 0;
      this.shift = undefined;
      this.lastInputAt = -Infinity;
      this.nextProbeAt = 0;
      this.bestRttMs = Number.POSITIVE_INFINITY;
      this.serverClockOffsetMs = undefined;
      this.status('Buscando outro piloto…');
      room.reconnection.minUptime = 0;
      room.reconnection.maxEnqueuedMessages = 0;
      room.onMessage('timeProbe', ({ sentAt, serverTime }: { sentAt: number; serverTime: number }) => {
        if (room !== this.room) return;
        const now = performance.now();
        const rtt = now - sentAt;
        if (rtt < 0 || rtt > this.bestRttMs + 5) return;
        this.bestRttMs = Math.min(rtt, this.bestRttMs);
        this.serverClockOffsetMs = serverTime - (sentAt + now) / 2;
        if (this.lobby?.deadline != null) this.countdownLocalAt = this.lobby.deadline - this.serverClockOffsetMs;
        if (this.renderer) this.renderer.serverClockOffsetMs = this.serverClockOffsetMs;
      });
      room.onMessage('lobby', (lobby: OnlineLobbyState) => {
        if (room !== this.room || this.driving) return;
        this.lobby = lobby;
        this.trackConfig = findTrack(lobby.trackId);
        this.countdownLocalAt = this.serverClockOffsetMs !== undefined && lobby.deadline !== null
          ? lobby.deadline - this.serverClockOffsetMs
          : performance.now() + Math.max(0, (lobby.deadline ?? lobby.serverTime) - lobby.serverTime);
        this.showLobby(lobby);
      });
      room.onMessage('loading', (loading: OnlineLoadingState) => {
        if (room !== this.room) return;
        if (this.renderer?.loading.matchId !== loading.matchId) {
          this.renderer?.dispose();
          this.renderer = new OnlineRaceRenderer(this.ctx, loading, this.trackConfig);
          this.renderer.serverClockOffsetMs = this.serverClockOffsetMs;
        }
        if (!this.driving) room.send('loaded', loading.matchId);
      });
      room.onMessage('snapshot', (snapshot: OnlineRaceSnapshot) => {
        if (room !== this.room || !this.renderer || snapshot.matchId !== this.renderer.loading.matchId) return;
        this.renderer.receive(snapshot);
        if (!this.driving) {
          this.driving = true;
          this.pedalUpdatedAt = performance.now();
          this.inputTimer = window.setInterval(() => this.sendInput(performance.now()), INPUT_INTERVAL_MS);
          this.root.hidden = true;
          this.ctx.refreshTrackVisibility?.();
        }
      });
      room.onMessage('gear', (update: OnlineGearUpdate) => {
        if (room === this.room) this.renderer?.receiveGear(update);
      });
      room.onMessage('result', (result: Result) => {
        if (room !== this.room) return;
        this.result = result;
        this.showResult();
        this.leaveRoom();
      });
      room.onMessage('cancelled', ({ reason }: { reason: string }) => {
        if (room !== this.room) return;
        this.leaveRoom();
        toast(reason, 'error');
        this.dashboard();
      });
      room.onMessage('notice', (notice: string) => toast(notice, 'error'));
      room.onDrop(() => {
        if (room !== this.room) return;
        this.connected = false;
        this.shift = undefined;
        if (this.reconnectNote) this.reconnectNote.hidden = false;
      });
      room.onReconnect(() => {
        if (room !== this.room) return;
        this.connected = true;
        this.bestRttMs = Number.POSITIVE_INFINITY;
        this.nextProbeAt = 0;
        if (this.reconnectNote) this.reconnectNote.hidden = true;
        void this.client!.token().then((token) => { if (room === this.room) { room.send('session', token); room.send('sync'); } },
          () => { if (room === this.room) void room.leave(); });
      });
      room.onLeave(() => {
        if (room !== this.room) return;
        this.leaveRoom(false);
        if (this.mounted) {
          toast('Conexão com a partida encerrada.', 'error');
          this.dashboard();
        }
      });
      room.send('sync');
    });
  }

  private leaveRoom(sendLeave = true): void {
    const room = this.room;
    this.room = undefined;
    this.connected = false;
    this.driving = false;
    window.clearInterval(this.inputTimer);
    this.inputTimer = undefined;
    this.renderer?.dispose();
    this.renderer = undefined;
    this.ctx.input.release('nitrous');
    this.ctx.refreshTrackVisibility?.();
    if (this.reconnectNote) this.reconnectNote.hidden = true;
    if (sendLeave && room) void room.leave().catch(() => undefined);
  }

  private showLobby(lobby: OnlineLobbyState): void {
    const quit = this.button('Cancelar busca', () => { this.leaveRoom(); this.dashboard(); });
    if (lobby.phase === 'queue') {
      this.show('Fila global', h('section', { class: 'online-card online-small' }, h('p', { role: 'status' }, 'Aguardando outro piloto…'), quit));
      return;
    }
    this.countdown = h('strong', {}, `${Math.ceil((this.countdownLocalAt - performance.now()) / 1_000)} s`);
    const confirmed = lobby.players[lobby.lane]?.confirmed ?? false;
    const cars = h('select', { 'aria-label': 'Seu carro para a partida', disabled: confirmed || lobby.phase !== 'lobby',
      onchange: (event) => this.room?.send('select', (event.target as HTMLSelectElement).value),
    }, lobby.cars.map((car) => h('option', { value: car.id, selected: car.id === lobby.selectedCarId },
      `${car.name} · ${car.powerCv.toFixed(0)} cv · ${car.torqueNm.toFixed(0)} N·m`)));
    this.show(lobby.phase === 'lobby' ? 'Seleção de veículos' : 'Carregando pista', h('section', { class: 'online-card online-small' },
      h('p', {}, `${this.trackConfig.name} · ${RACE_DISTANCES.quarter.label} · `, this.countdown),
      lobby.players.map((player) => h('p', {}, `${player.nickname} · ${player.rp} RP · ${rankCategory(player.rp)} · ${player.selectedCar ?? 'Selecionando'}${player.confirmed ? ' ✓' : ''}`)),
      h('label', {}, 'Seu veículo', cars), h('div', { class: 'row' },
        this.button('Confirmar veículo', () => this.room?.send('confirm'), true, confirmed || lobby.phase !== 'lobby'),
        this.button('Sair da partida', () => { this.leaveRoom(); this.dashboard(); }))));
  }

  private showResult(): void {
    const result = this.result;
    const setup = this.renderer?.loading;
    if (!result || !setup) return;
    const { award, snapshot } = result;
    if (this.garage && award.crAfter !== undefined && award.rpAfter !== undefined) {
      this.garage.profile.cr_balance = award.crAfter;
      this.garage.profile.rp = award.rpAfter;
    }
    const carId = setup.ownCarId;
    const car = this.garage?.cars.find((item) => item.id === carId);
    const next = car && PREPARATION_TREES.get(car.base_car_id)?.nodes.find((node) => !car.unlocks.includes(node.id) &&
      node.costPP > award.ppBefore && node.costPP <= award.ppAfter && node.prerequisites.every((id) => car.unlocks.includes(id)));
    const go = (screen: Screen, id?: string, node?: string) => { void this.run(async () => {
      await this.refresh();
      this.navigate(screen, id, node);
    }); };
    this.show(outcomes[award.outcome], h('section', { class: 'online-card' },
      h('p', {}, `+${award.cr} CR · ${award.rp >= 0 ? '+' : ''}${award.rp} RP · +${award.pp} PP`),
      h('p', {}, `${setup.cars[setup.lane].name} · ${award.ppBefore} → ${award.ppAfter} PP`),
      h('p', { class: 'online-match-reference', 'data-testid': 'online-match-reference' }, 'ID da partida ', h('code', {}, snapshot.matchId)),
      award.reason && h('p', {}, award.reason),
      next && h('p', {}, `Nova preparação disponível · ${next.name} · ${next.costPP} PP`),
      h('div', { class: 'online-grid' }, snapshot.lanes.map((lane, index) => h('article', { class: 'online-card' },
        h('h2', {}, setup.names[index]!),
        h('p', {}, `Reação ${fmt(lane.result.rt)} s · ET ${fmt(lane.result.et)} s · Total ${fmt(lane.result.total)} s`),
        h('p', {}, `Final ${fmt(lane.result.trapMs == null ? null : lane.result.trapMs * 3.6, 1)} km/h · ${fmt(lane.result.maxRpm, 0)} rpm`),
        lane.result.redLight && h('p', {}, 'Queima de largada'), lane.result.dnfReason === 'engine-blown' && h('p', {}, 'Quebra mecânica'),
        h('dl', { class: 'online-specs' }, SPLITS.filter((split) => lane.result.splits[split.id] !== undefined).flatMap((split) =>
          [h('dt', {}, split.label), h('dd', {}, `${fmt(lane.result.splits[split.id])} s`)]))))),
      h('div', { class: 'row' }, this.button('Buscar nova partida', () => { void this.queue(); }, true),
        this.button('Abrir preparação', () => go('Preparação', carId, next?.id)),
        this.button('Abrir oficina', () => go('Oficina', carId)), this.button('Voltar à garagem', () => go('Garagem')))));
  }
}
