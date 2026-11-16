import { DynoBayView } from '../ui/dyno/DynoBayView';
import { fillEngineAudioFrame } from '../audio/adapters/engineFrame';
import { VehicleSound } from '../audio/core/VehicleSound';
import { carToAcousticConfig } from '../audio/dsp/AcousticConfig';
import { AF } from '../core/contracts';
import { MonotoneCubic } from '../core/math';
import { celsiusToKelvin, rpmToRadS } from '../core/units';
import { LAB_CARS, cloneCar } from '../data/cars/index';
import { exhaustPreset, type ExhaustPresetId } from '../data/exhaustPresets';
import type { CarConfig, TrackConfig } from '../data/schema';
import { findTrack } from '../data/tracks/index';
import type { CameraMode, RenderVehicle, TrackMarker } from '../game/scenes/RaceScene';
import { PHYSICS_DT } from '../game/SimulationRunner';
import { EngineDyno, type DynoPoint } from '../physics/engine/EngineDyno';
import type { AppContext, Mode } from '../app/Mode';
import { drawLineChart, drawMessage, type Series } from '../ui/charts';
import { clear, downloadText, fmt, h, toast } from '../ui/dom';

const EXHAUST_LABELS: Record<ExhaustPresetId, string> = { stock: 'original', sport: 'esportivo', straight: 'direto' };

/**
 * Engine dynamometer. The sweep measures the torque the absorber has to hold at each speed
 * (engine-sim Dynamometer port) – it is never read from the configured curve, which is drawn
 * dashed for comparison. The live bench runs the same engine model in real time with sound.
 */
export class DynoMode implements Mode {
  readonly id = 'dyno';
  readonly label = 'Dinamômetro';
  readonly usesTrack = false;
  cameraMode: CameraMode = 'follow';

  private ctx!: AppContext;
  private car: CarConfig = cloneCar(LAB_CARS[0]!);
  private readonly trackCfg: TrackConfig = findTrack('test-track');
  private view: HTMLElement | null = null;
  private bay: DynoBayView | null = null;
  private curveCanvas!: HTMLCanvasElement;
  private specCanvas!: HTMLCanvasElement;
  private scopeCanvas!: HTMLCanvasElement;
  private points: DynoPoint[] = [];
  private sweeping = false;
  private sweepToken = 0;
  private status!: HTMLElement;
  private live!: HTMLElement;
  private bench: EngineDyno | null = null;
  private sound: VehicleSound | null = null;
  private frame = new Float64Array(AF.length);
  private acc = 0;
  private drawAcc = 0;
  private targetRpm = 3000;
  private throttleSlider = 0;
  private absorber = true;
  private freq: Float32Array<ArrayBuffer> | null = null;
  private wave: Float32Array<ArrayBuffer> | null = null;
  /** Last drawn spectrum (Hz, dBFS) and a held reference for A/B comparison. */
  private lastSpec: { x: Float64Array; y: Float64Array } | null = null;
  private refSpec: { x: Float64Array; y: Float64Array; label: string } | null = null;

  mount(ctx: AppContext): void {
    this.ctx = ctx;
    this.curveCanvas = h('canvas', { 'data-testid': 'dyno-curve' }) as HTMLCanvasElement;
    this.specCanvas = h('canvas', { 'data-testid': 'dyno-spectrum' }) as HTMLCanvasElement;
    this.scopeCanvas = h('canvas') as HTMLCanvasElement;
    this.bay = new DynoBayView();
    this.view = h('div', { class: 'dyno-view' }, h('div', { class: 'top' }, this.bay.canvas, this.curveCanvas), h('div', { class: 'split' }, this.specCanvas, this.scopeCanvas));
    ctx.overlay.append(this.view);
    void this.bay.setCar(this.car);
    this.buildPanel();
    this.resetBench();
    this.drawCurves();
  }

  unmount(): void {
    this.sweepToken++;
    this.sound?.dispose();
    this.sound = null;
    this.bay?.dispose();
    this.bay = null;
    this.view?.remove();
    clear(this.ctx.panel);
  }

  /** Puts another car's engine on the bench (car list and garage). */
  selectCar(id: string, paint?: { color: string; accent: string }): boolean {
    const c = LAB_CARS.find((x) => x.id === id);
    if (!c) return false;
    this.car = cloneCar(c);
    if (paint) this.car.visual = { ...this.car.visual, ...paint };
    this.points = [];
    this.sweepToken++;
    this.sweeping = false;
    this.sound?.setConfig(carToAcousticConfig(this.car, this.ctx.settings.audioQuality, 5));
    this.resetBench();
    this.buildPanel();
    this.drawCurves();
    void this.bay?.setCar(this.car);
    return true;
  }

  currentCar(): CarConfig {
    return this.car;
  }

  private ambient(): { pressurePa: number; temperatureK: number } {
    return { pressurePa: this.trackCfg.ambientPressurePa, temperatureK: celsiusToKelvin(this.trackCfg.ambientTempC) };
  }

  private resetBench(): void {
    this.bench = new EngineDyno(this.car.engine, this.ambient());
    this.bench.inputs.ignitionOn = true;
    this.bench.inputs.starter = true;
    this.sound?.reset();
  }

  onAudioReady(): void {
    const a = this.ctx.audio;
    if (!a.running || this.sound) return;
    try {
      this.sound = new VehicleSound(a, carToAcousticConfig(this.car, this.ctx.settings.audioQuality, 5), 'dyno', 0.05, this.trackCfg.ambientTempC + 273.15);
      this.sound.setSpatial(0, 6);
    } catch (e) {
      toast(`Falha ao criar voz de áudio: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  private buildPanel(): void {
    const panel = this.ctx.panel;
    clear(panel);
    const e = this.car.engine;
    this.status = h('div', { class: 'hint', 'data-testid': 'dyno-status' }, 'Pronto.');
    this.live = h('div', { class: 'kv', 'data-testid': 'dyno-live' });
    const rpmVal = h('span', { class: 'unit' }, String(this.targetRpm));
    const thrVal = h('span', { class: 'unit' }, '0%');
    this.targetRpm = Math.min(Math.max(this.targetRpm, e.idleRpm), e.revLimitRpm);
    panel.append(
      h('h2', {}, 'Dinamômetro de motor'),
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Motor'),
        h(
          'select',
          {
            'data-testid': 'dyno-car',
            onchange: (ev: Event) => void this.selectCar((ev.target as HTMLSelectElement).value),
          },
          LAB_CARS.map((c) => h('option', { value: c.id, selected: c.id === this.car.id }, `${c.name} – ${c.engine.name}`)),
        ),
      ),
      h('h3', {}, 'Varredura em plena carga'),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'primary', 'data-testid': 'dyno-sweep', onclick: () => void this.sweep() }, 'Medir curva'),
        h('button', { onclick: () => this.exportCsv() }, 'Exportar CSV'),
      ),
      this.status,
      h('h3', {}, 'Bancada ao vivo (com som)'),
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Freio do dinamômetro'),
        h('input', {
          type: 'checkbox',
          checked: this.absorber,
          onchange: (ev: Event) => (this.absorber = (ev.target as HTMLInputElement).checked),
        }),
      ),
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Rotação alvo'),
        h('input', {
          type: 'range',
          min: e.idleRpm,
          max: e.revLimitRpm,
          step: 50,
          value: String(this.targetRpm),
          'data-testid': 'dyno-rpm',
          oninput: (ev: Event) => {
            this.targetRpm = Number((ev.target as HTMLInputElement).value);
            rpmVal.textContent = String(this.targetRpm);
          },
        }),
        rpmVal,
      ),
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Acelerador'),
        h('input', {
          type: 'range',
          min: 0,
          max: 1,
          step: 0.01,
          value: '0',
          'data-testid': 'dyno-throttle',
          oninput: (ev: Event) => {
            this.throttleSlider = Number((ev.target as HTMLInputElement).value);
            thrVal.textContent = `${Math.round(this.throttleSlider * 100)}%`;
          },
        }),
        thrVal,
      ),
      h(
        'div',
        { class: 'row' },
        h('label', {}, 'Escapamento'),
        h(
          'select',
          {
            'data-testid': 'dyno-exhaust',
            onchange: (ev: Event) => this.setExhaust((ev.target as HTMLSelectElement).value as ExhaustPresetId),
          },
          (['stock', 'sport', 'straight'] as ExhaustPresetId[]).map((id) => h('option', { value: id, selected: this.car.exhaust.presetId === id }, EXHAUST_LABELS[id])),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { 'data-testid': 'dyno-ref', title: 'Guarda o espectro atual para comparar com outro escapamento ou rotação', onclick: () => this.holdReference() }, 'Fixar espectro de referência'),
        h('button', { onclick: () => (this.refSpec = null) }, 'Limpar referência'),
      ),
      h('div', { class: 'hint' }, 'W/↑ também acelera (máximo entre tecla e controle). Sem freio do dinamômetro o motor gira livre até o limitador.'),
      h('div', { class: 'row' }, h('button', { onclick: () => this.resetBench() }, 'Reiniciar motor')),
      this.live,
    );
  }

  /** Swaps the exhaust preset (geometry and silencer) – acoustic only, the engine keeps running. */
  private setExhaust(id: ExhaustPresetId): void {
    const x = this.car.exhaust;
    this.car.exhaust = exhaustPreset(id, { layout: x.layout, headerPrimaryLengthM: x.headerPrimaryLengthM, headerDiameterMm: x.headerDiameterMm });
    this.sound?.setConfig(carToAcousticConfig(this.car, this.ctx.settings.audioQuality, 5));
  }

  private holdReference(): void {
    if (!this.lastSpec) {
      toast('Ative o som e deixe o espectro aparecer antes de fixar a referência.', 'error');
      return;
    }
    const rpm = this.bench ? this.bench.engine.rpm : 0;
    this.refSpec = { x: this.lastSpec.x.slice(), y: this.lastSpec.y.slice(), label: `ref.: ${EXHAUST_LABELS[this.car.exhaust.presetId as ExhaustPresetId] ?? this.car.exhaust.presetId} @ ${rpm.toFixed(0)} rpm` };
  }

  /** Offline sweep on a fresh engine instance, one point per macrotask so the UI stays responsive. */
  private async sweep(): Promise<void> {
    if (this.sweeping) return;
    const token = ++this.sweepToken;
    this.sweeping = true;
    this.points = [];
    const e = this.car.engine;
    const dyno = new EngineDyno(e, this.ambient());
    if (!dyno.start()) {
      this.status.textContent = 'O motor não pegou na partida – nenhuma medição feita.';
      this.sweeping = false;
      return;
    }
    const from = Math.ceil((e.idleRpm + 300) / 250) * 250;
    const to = e.redlineRpm;
    const t0 = performance.now();
    for (let rpm = from; rpm <= to + 1e-6; rpm += 250) {
      await new Promise((r) => setTimeout(r, 0));
      if (token !== this.sweepToken) return;
      this.points.push(dyno.measure(rpm, 1));
      this.status.textContent = `Medindo… ${rpm} rpm`;
      this.drawCurves();
    }
    dyno.release();
    this.sweeping = false;
    const peakT = this.points.reduce((a, b) => (b.torqueNm > a.torqueNm ? b : a));
    const peakP = this.points.reduce((a, b) => (b.powerCv > a.powerCv ? b : a));
    // deviation from the configured curve (the calibration target of the engine model)
    let maxDev = 0;
    let worst: DynoPoint | null = null;
    for (const p of this.points) {
      const ref = interp(e.torqueCurve.rpm, e.torqueCurve.torqueNm, p.rpm);
      const dev = ref > 1 ? Math.abs(p.torqueNm - ref) / ref : 0;
      if (dev > maxDev) {
        maxDev = dev;
        worst = p;
      }
    }
    let why = '';
    if (worst && maxDev > 0.01) {
      why = ` (em ${worst.rpm.toFixed(0)} rpm`;
      if (e.turbo && worst.boostPa < e.turbo.maxBoostBar * 1e5 * 0.95) {
        why += `: turbo a ${(worst.boostPa / 1e5).toFixed(2)} de ${e.turbo.maxBoostBar.toFixed(2)} bar – vazão de escape insuficiente nesta rotação`;
      }
      why += ')';
    }
    this.status.textContent =
      `Torque máx. ${peakT.torqueNm.toFixed(1)} N·m @ ${peakT.rpm.toFixed(0)} rpm · potência máx. ${peakP.powerCv.toFixed(1)} cv @ ${peakP.rpm.toFixed(0)} rpm ` +
      `(anunciado ${e.ratedPowerCv} cv) · desvio máx. da curva configurada ${(maxDev * 100).toFixed(2)}%${why} · ${this.points.length} pontos em ${((performance.now() - t0) / 1000).toFixed(1)} s`;
    this.drawCurves();
  }

  private exportCsv(): void {
    if (this.points.length === 0) {
      toast('Faça uma medição primeiro.', 'error');
      return;
    }
    const e = this.car.engine;
    const lines = [
      `# Dinamômetro – ${this.car.name} / ${e.name}`,
      '# torque medido pela restrição do dinamômetro (regime permanente, média de 0,5 s após 2,5 s de estabilização)',
      `# ambiente: ${this.trackCfg.ambientPressurePa} Pa, ${this.trackCfg.ambientTempC} °C`,
      'rpm,torque_Nm,potencia_kW,potencia_cv,coletor_kPa,turbo_kPa,torque_configurado_Nm',
      ...this.points.map((p) =>
        [p.rpm.toFixed(1), p.torqueNm.toFixed(2), (p.powerW / 1000).toFixed(2), p.powerCv.toFixed(2), (p.manifoldPa / 1000).toFixed(2), (p.boostPa / 1000).toFixed(2), interp(e.torqueCurve.rpm, e.torqueCurve.torqueNm, p.rpm).toFixed(2)].join(','),
      ),
    ];
    downloadText(`dino-${this.car.id}.csv`, lines.join('\n') + '\n', 'text/csv');
  }

  private drawCurves(): void {
    if (!this.curveCanvas.isConnected) return;
    const e = this.car.engine;
    const tc = e.torqueCurve;
    const lim = tc.rpm.map((r, i) => [r, tc.torqueNm[i]!] as const).filter(([r]) => r <= e.revLimitRpm);
    const cfgPower = lim.map(([r, t]) => (t * rpmToRadS(r)) / 735.49875);
    drawLineChart(
      this.curveCanvas,
      [
        { label: 'torque medido N·m', color: '#f2b705', x: this.points.map((p) => p.rpm), y: this.points.map((p) => p.torqueNm), points: true },
        { label: 'torque configurado', color: '#f2b705', x: lim.map((p) => p[0]), y: lim.map((p) => p[1]), dashed: true },
        { label: 'potência medida cv', color: '#2bb3ff', x: this.points.map((p) => p.rpm), y: this.points.map((p) => p.powerCv), right: true, points: true },
        { label: 'potência configurada', color: '#2bb3ff', x: lim.map((p) => p[0]), y: cfgPower, right: true, dashed: true },
      ],
      { xLabel: 'rpm', title: `${this.car.name} – ${e.name}`, xMin: 0, xMax: e.revLimitRpm, yMin: 0 },
    );
  }

  private drawAudio(): void {
    const an = this.ctx.audio.analyser;
    if (!an || !this.ctx.audio.running) {
      drawMessage(this.specCanvas, 'Ative o som para ver o espectro da saída');
      drawMessage(this.scopeCanvas, 'Ative o som para ver o oscilograma');
      return;
    }
    if (!this.freq || this.freq.length !== an.frequencyBinCount) this.freq = new Float32Array(an.frequencyBinCount);
    if (!this.wave || this.wave.length !== an.fftSize) this.wave = new Float32Array(an.fftSize);
    an.getFloatFrequencyData(this.freq);
    an.getFloatTimeDomainData(this.wave);
    const fs = this.ctx.audio.sampleRate;
    const n = this.freq.length;
    const maxBin = Math.min(n, Math.ceil((4000 / (fs / 2)) * n));
    const fx = new Float64Array(maxBin);
    const fy = new Float64Array(maxBin);
    for (let i = 0; i < maxBin; i++) {
      fx[i] = (i * fs) / (2 * n);
      fy[i] = Math.max(-120, this.freq[i]!);
    }
    this.lastSpec = { x: fx, y: fy };
    const series: Series[] = [{ label: 'agora (dBFS)', color: '#3ccf6e', x: fx, y: fy }];
    if (this.refSpec) series.unshift({ label: this.refSpec.label, color: '#8d97a3', x: this.refSpec.x, y: this.refSpec.y, dashed: true });
    drawLineChart(this.specCanvas, series, { title: 'Espectro da saída (0–4 kHz)', xLabel: 'Hz', yMin: -120, yMax: 0 });
    const m = Math.min(this.wave.length, Math.round(fs * 0.04));
    const tx = new Float64Array(m);
    const ty = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      tx[i] = (i / fs) * 1000;
      ty[i] = this.wave[i]!;
    }
    drawLineChart(this.scopeCanvas, [{ label: 'amplitude', color: '#ff7a59', x: tx, y: ty }], { title: 'Oscilograma (40 ms)', xLabel: 'ms', yMin: -1, yMax: 1 });
  }

  tick(dtS: number): void {
    const b = this.bench;
    if (b) {
      const e = b.engine;
      b.inputs.pedal = Math.max(this.throttleSlider, this.ctx.input.updatePedal(dtS));
      e.dyno.enabled = this.absorber;
      e.dyno.hold = this.absorber;
      e.dyno.targetOmega = rpmToRadS(this.targetRpm);
      this.acc += Math.min(dtS, 0.25);
      while (this.acc >= PHYSICS_DT) {
        if (e.runState === 'RUNNING') b.inputs.starter = false;
        b.step(PHYSICS_DT);
        this.acc -= PHYSICS_DT;
        if (this.sound) this.sound.pushFrame(fillEngineAudioFrame(this.frame, e, b.simTime));
      }
      this.sound?.flush();
    }
    if (b) this.bay?.update(dtS, { rpm: b.engine.rpm, running: b.engine.runState === 'RUNNING', cranking: b.engine.runState === 'CRANKING' });
    this.drawAcc += dtS;
    if (this.drawAcc > 1 / 30) {
      this.drawAcc = 0;
      if (b) {
        const e = b.engine;
        const tq = this.absorber ? e.dynoTorque : e.torqueNetLast;
        const rows: [string, string][] = [
          ['estado', e.runState],
          ['rpm', e.rpm.toFixed(0)],
          ['acelerador', fmt(b.inputs.pedal, 2)],
          ['borboleta efetiva', fmt(e.throttleEffective, 3)],
          ['coletor', `${(e.manifoldPressure / 1000).toFixed(1)} kPa`],
          ['carga', fmt(e.load, 3)],
          [this.absorber ? 'torque no freio' : 'torque líquido', `${tq.toFixed(1)} N·m`],
          ['potência', `${((tq * e.omega) / 735.49875).toFixed(1)} cv`],
          ['temp. escape', `${e.exhaustTempK.toFixed(0)} K`],
          ['limitador', e.ignition.limiterActive ? 'cortando' : '—'],
        ];
        if (e.turbo) rows.push(['turbo', `${(e.turbo.boostPa / 1e5).toFixed(2)} bar · ${(e.turbo.shaftRpm / 1000).toFixed(0)} krpm`]);
        this.live.replaceChildren(...rows.flatMap(([k, v]) => [h('span', {}, k), h('span', {}, v)]));
      }
      this.drawAudio();
      if (!this.sweeping) this.drawCurves();
    }
  }

  vehicles(): RenderVehicle[] {
    return [];
  }
  track(): TrackConfig {
    return this.trackCfg;
  }
  markers(): TrackMarker[] {
    return [];
  }
  tree(): null {
    return null;
  }
  finishM(): null {
    return null;
  }
}

/** Configured curve value with the same monotone cubic interpolation the engine model uses. */
function interp(xs: readonly number[], ys: readonly number[], x: number): number {
  return new MonotoneCubic(xs, ys).evaluate(x);
}
