import { CHANNELS as AUDIO_CHANNELS, CHANNEL_COUNT, carToAcousticConfig, type AcousticQuality } from '../audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../audio/dsp/VehicleAcoustics';
import type { AudioEngine } from '../audio/core/AudioEngine';
import type { SimulationRunner } from '../game/SimulationRunner';
import { TelemetryRecorder } from '../telemetry/TelemetryRecorder';
import { drawLineChart, Ring } from './charts';
import { downloadText, fmt, h, toast } from './dom';

const LIVE_HZ = 30;
const LIVE_SECONDS = 10;
const RAD_S_TO_RPM = 60 / (2 * Math.PI);
const G = 9.80665;

const CHANNEL_LABELS: Record<string, string> = {
  intake: 'admissão',
  block: 'bloco',
  exhaust: 'escape',
  turbo: 'turbo',
  tire: 'pneus',
  transmission: 'transmissão',
  environment: 'ambiente',
};

/** Chrome's AudioContext.playoutStats (not in every browser / TS lib). */
interface PlayoutStats {
  fallbackFramesEvents?: number;
  fallbackDuration?: number;
  totalFramesDuration?: number;
  averageLatency?: number;
}

/**
 * Developer Lab (spec §18): live physics values and charts, runtime counters, pause /
 * single-step, per-channel audio solo and the CSV telemetry recorder.
 * Measured values and estimates are listed separately; nothing is shown that the APIs do not
 * provide (e.g. audio-thread CPU load or device underruns where the browser does not expose them).
 */
export class DevLab {
  readonly el: HTMLElement;
  readonly recorder = new TelemetryRecorder();
  private readonly t = new Ring(LIVE_HZ * LIVE_SECONDS);
  private readonly rpm = new Ring(LIVE_HZ * LIVE_SECONDS);
  private readonly speed = new Ring(LIVE_HZ * LIVE_SECONDS);
  private readonly clutchTq = new Ring(LIVE_HZ * LIVE_SECONDS);
  private readonly tireF = new Ring(LIVE_HZ * LIVE_SECONDS);
  private readonly torque = new Ring(LIVE_HZ * LIVE_SECONDS);
  private readonly accel = new Ring(LIVE_HZ * LIVE_SECONDS);
  private readonly c1: HTMLCanvasElement;
  private readonly c2: HTMLCanvasElement;
  private readonly c3: HTMLCanvasElement;
  private readonly live: HTMLElement;
  private readonly measured: HTMLElement;
  private readonly estimated: HTMLElement;
  private readonly recBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private acc = 0;
  private soloCh: number | null = null;
  /** Rendered frames per second (measured from real frame intervals, smoothed). */
  private fps = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private audioEstimate: string | null = null;

  constructor(
    private readonly runner: () => SimulationRunner,
    private readonly audio: AudioEngine,
    private readonly meta: () => Record<string, string>,
    private readonly quality: () => AcousticQuality = () => 'high',
  ) {
    this.c1 = h('canvas', { class: 'chart' }) as HTMLCanvasElement;
    this.c2 = h('canvas', { class: 'chart' }) as HTMLCanvasElement;
    this.c3 = h('canvas', { class: 'chart' }) as HTMLCanvasElement;
    this.live = h('div', { class: 'kv', 'data-testid': 'devlab-live' });
    this.measured = h('div', { class: 'kv', 'data-testid': 'devlab-stats' });
    this.estimated = h('div', { class: 'kv', 'data-testid': 'devlab-estimated' });
    this.recBtn = h('button', { 'data-testid': 'rec', onclick: () => this.toggleRecord() }, '● Gravar telemetria') as HTMLButtonElement;
    this.pauseBtn = h('button', { 'data-testid': 'pause', onclick: () => this.togglePause() }, 'Pausar (P)') as HTMLButtonElement;
    const solo = h(
      'select',
      {
        'data-testid': 'solo',
        onchange: (e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          this.soloCh = v === '' ? null : Number(v);
          for (const rv of this.runner().vehicles) rv.sound?.solo(this.soloCh);
        },
      },
      h('option', { value: '' }, 'todos os canais'),
      AUDIO_CHANNELS.map((c, i) => h('option', { value: String(i) }, `solo: ${CHANNEL_LABELS[c] ?? c}`)),
    );
    this.el = h(
      'div',
      { class: 'devlab', 'data-testid': 'devlab' },
      h(
        'h3',
        { class: 'devlab-head', title: 'Mostrar/ocultar (tecla T)', onclick: () => this.toggleCollapsed() },
        'Developer Lab ',
        h('span', { class: 'hint' }, '(T mostra/oculta)'),
      ),
      this.c1,
      this.c3,
      this.c2,
      h('div', { class: 'row' }, this.pauseBtn, h('button', { 'data-testid': 'step', onclick: () => this.stepOnce() }, 'Avançar 1 passo'), solo),
      h('div', { class: 'row' }, this.recBtn, h('button', { 'data-testid': 'csv', onclick: () => this.exportCsv() }, 'Exportar CSV')),
      h('h4', {}, 'Tempo real (carro do jogador)'),
      this.live,
      h('h4', {}, 'Medido'),
      this.measured,
      h('h4', {}, 'Estimado'),
      this.estimated,
      h('div', { class: 'row' }, h('button', { 'data-testid': 'audio-estimate', onclick: () => this.estimateAudioLoad() }, 'Estimar carga de áudio')),
    );
  }

  get collapsed(): boolean {
    return this.el.classList.contains('collapsed');
  }

  toggleCollapsed(): void {
    this.el.classList.toggle('collapsed');
  }

  /** Re-applies the solo state to newly created voices. */
  applySolo(): void {
    if (this.soloCh !== null) for (const rv of this.runner().vehicles) rv.sound?.solo(this.soloCh);
  }

  /** Per physics step: recorder. */
  afterStep(): void {
    const p = this.runner().player;
    if (p && this.recorder.recording) this.recorder.sample(p.sim);
  }

  togglePause(): void {
    const r = this.runner();
    r.paused = !r.paused;
    this.pauseBtn.textContent = r.paused ? 'Continuar (P)' : 'Pausar (P)';
  }

  private stepOnce(): void {
    const r = this.runner();
    if (!r.paused) this.togglePause();
    r.stepOnce();
    for (const v of r.vehicles) v.sound?.flush();
  }

  private toggleRecord(): void {
    if (this.recorder.recording) {
      this.recorder.stop();
      this.recBtn.textContent = '● Gravar telemetria';
      toast(`Gravação parada: ${this.recorder.count} amostras.`);
    } else {
      this.recorder.start(this.meta());
      this.recBtn.textContent = '■ Parar gravação';
    }
  }

  private exportCsv(): void {
    if (this.recorder.count === 0) {
      toast('Nada gravado ainda.', 'error');
      return;
    }
    const r = this.runner();
    const notes = [`tempo real não simulado (quadros > 0.25 s): ${r.stats.droppedRealTimeS.toFixed(3)} s`, `passo de física: 1/120 s (fixo)`];
    downloadText(`telemetria-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`, this.recorder.toCsv(notes), 'text/csv');
  }

  clear(): void {
    for (const r of [this.t, this.rpm, this.speed, this.clutchTq, this.tireF, this.torque, this.accel]) r.clear();
  }

  /**
   * Estimate of the acoustic model's CPU cost: renders one second of audio for the player's
   * current engine state on the main thread and times it. The real work runs on the audio thread,
   * whose load the Web Audio API does not report, so this is labelled as an estimate.
   */
  private estimateAudioLoad(): void {
    const p = this.runner().player;
    if (!p) return;
    const fs = this.audio.ctx ? this.audio.sampleRate : 48000;
    const q = this.quality();
    const voice = new VehicleAcoustics(fs, carToAcousticConfig(p.sim.car, q, 5));
    const bufs = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(fs / 120) + 2));
    const n = Math.round(fs / 120);
    // warm-up (JIT), then 1 s of audio
    for (let i = 0; i < 24; i++) {
      voice.pushFrame(p.sim.audioFrame);
      voice.render(bufs, n);
    }
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) {
      voice.pushFrame(p.sim.audioFrame);
      voice.render(bufs, n);
    }
    const ms = performance.now() - t0;
    this.audioEstimate = `${((ms / 1000) * 100).toFixed(1)} % de um núcleo por voz no estado atual do motor (qualidade ${q === 'high' ? 'alta' : 'baixa'}, ${fs} Hz, medido na thread principal; varia com rotação e carga)`;
    this.draw();
  }

  /** Per rendered frame. */
  update(dtS: number): void {
    const r = this.runner();
    const p = r.player;
    this.fpsFrames++;
    this.fpsTime += dtS;
    if (this.fpsTime >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    this.acc += dtS;
    if (p && this.acc >= 1 / LIVE_HZ) {
      this.acc = 0;
      if (!r.paused) {
        const s = p.sim;
        const tel = s.telemetry;
        this.t.push(s.simTime);
        this.rpm.push(s.engine.rpm);
        this.speed.push(s.speed * 3.6);
        this.clutchTq.push(s.clutchTorque);
        this.tireF.push(s.tireForce);
        this.torque.push(tel.engine.torqueNet);
        this.accel.push(tel.acceleration / G);
      }
      if (this.el.isConnected && !this.collapsed) this.draw();
    }
  }

  private draw(): void {
    const t = this.t.toArray();
    drawLineChart(
      this.c1,
      [
        { label: 'rpm', color: '#f2b705', x: t, y: this.rpm.toArray() },
        { label: 'km/h', color: '#2bb3ff', x: t, y: this.speed.toArray(), right: true },
      ],
      { xLabel: 't (s)' },
    );
    drawLineChart(
      this.c3,
      [
        { label: 'torque do motor N·m', color: '#e05cff', x: t, y: this.torque.toArray() },
        { label: 'aceleração g', color: '#3ccf6e', x: t, y: this.accel.toArray(), right: true },
      ],
      { xLabel: 't (s)' },
    );
    drawLineChart(
      this.c2,
      [
        { label: 'T embreagem N·m', color: '#ff7a59', x: t, y: this.clutchTq.toArray() },
        { label: 'Fx pneu N', color: '#3ccf6e', x: t, y: this.tireF.toArray(), right: true },
      ],
      { xLabel: 't (s)' },
    );
    const r = this.runner();
    const p = r.player;
    const kv = (rows: [string, string][]): HTMLElement[] => rows.flatMap(([k, v]) => [h('span', {}, k), h('span', {}, v)]);

    // ---- realtime physics values (the simulation's own state – exact for the model)
    if (p) {
      const s = p.sim;
      const tel = s.telemetry;
      const en = tel.engine;
      this.live.replaceChildren(
        ...kv([
          ['rotação do motor', `${en.rpm.toFixed(0)} rpm`],
          ['velocidade angular', `${en.omega.toFixed(1)} rad/s`],
          ['torque do motor (líquido / combustão)', `${en.torqueNet.toFixed(0)} / ${en.torqueCombustion.toFixed(0)} N·m`],
          ['torque na roda', `${tel.wheelTorque.toFixed(0)} N·m`],
          ['rotação da roda (tração)', `${(tel.wheelOmegaDriven * RAD_S_TO_RPM).toFixed(0)} rpm`],
          ['velocidade', `${(tel.speed * 3.6).toFixed(1)} km/h`],
          ['aceleração', `${tel.acceleration.toFixed(2)} m/s² (${(tel.acceleration / G).toFixed(2)} g)`],
          ['acelerador (pedal / borboleta)', `${(en.pedal * 100).toFixed(0)} / ${(en.throttle * 100).toFixed(0)} %`],
          ['escorregamento da embreagem', `${(tel.clutchSlip * RAD_S_TO_RPM).toFixed(0)} rpm`],
          ['embreagem', `${s.clutchCtl.mode} · ${(s.clutchCtl.engagement * 100).toFixed(0)} %`],
          ['relação de marcha', tel.gearRatio === 0 ? 'neutro' : tel.gearRatio.toFixed(3)],
          ['estado da troca', String(tel.shiftState)],
          ['patinagem do pneu', fmt(tel.slipRatio, 3)],
          ['força do pneu (Fx / pico)', `${tel.tireForce.toFixed(0)} / ${tel.tireForceMax.toFixed(0)} N`],
          ['arrasto aerodinâmico', `${tel.dragForce.toFixed(0)} N`],
          ['resistência ao rolamento', `${tel.rollingForce.toFixed(0)} N`],
          ['pressão no coletor (absoluta)', `${(en.manifoldPressurePa / 1000).toFixed(1)} kPa`],
          ['estado do motor', en.runState],
          ['gravação', this.recorder.recording ? `${this.recorder.count} amostras` : this.recorder.count ? `${this.recorder.count} (parada)` : '—'],
        ]),
      );
    }

    // ---- measured runtime counters
    const st = p?.sound?.lastStats ?? null;
    const measured: [string, string][] = [
      ['FPS (quadros renderizados)', this.fps.toFixed(0)],
      ['duração do passo de física', `${fmt(r.stats.stepMs, 3)} ms (todos os carros)`],
      ['passos de física', String(r.stats.steps)],
      ['passos no último quadro', String(r.stats.lastFrameSteps)],
      ['tempo real não simulado', `${fmt(r.stats.droppedRealTimeS, 3)} s`],
      ['áudio', `${this.audio.state}${this.audio.ctx ? ` · ${this.audio.sampleRate} Hz` : ''}`],
    ];
    if (st) {
      measured.push(
        ['worklet: quadros recebidos', String(st.receivedFrames)],
        ['worklet: quadros rejeitados', String(st.rejectedFrames)],
        ['worklet: ressincronizações', String(st.resyncs)],
        ['worklet: falta de dados da física', `${fmt(st.starvedS, 2)} s`],
        ['worklet: taxa de reprodução', fmt(st.playbackRate, 4)],
        ['worklet: pico por canal', st.peak.map((v) => v.toFixed(2)).join(' ')],
        ['worklet: resets por NaN', String(st.nanResets)],
      );
    } else measured.push(['worklet', this.audio.running ? 'aguardando estatísticas' : 'áudio desligado']);
    const ps = (this.audio.ctx as (AudioContext & { playoutStats?: PlayoutStats }) | null)?.playoutStats;
    if (ps && typeof ps.fallbackFramesEvents === 'number') {
      measured.push(['falhas de reprodução do dispositivo (playoutStats)', `${ps.fallbackFramesEvents} eventos · ${fmt(ps.fallbackDuration, 3)} s`]);
    } else {
      measured.push(['falhas (underruns) do dispositivo', 'não expostas por este navegador (AudioContext.playoutStats indisponível)']);
    }
    this.measured.replaceChildren(...kv(measured));

    // ---- estimates
    this.estimated.replaceChildren(
      ...kv([
        ['carga de áudio (thread de áudio)', 'não mensurável: a Web Audio API não informa o uso de CPU do worklet'],
        ['estimativa de carga de áudio', this.audioEstimate ?? 'clique em "Estimar carga de áudio"'],
      ]),
    );
  }
}
