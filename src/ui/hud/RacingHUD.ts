import type { VehicleSimulation } from '../../physics/vehicle/VehicleSimulation';
import { h, speedUnit } from '../dom';
import { GearIndicator } from './GearIndicator';
import { ShiftLights, shiftLightState, shiftTargets } from './ShiftLights';
import { TurboGauge, turboGaugeState } from './TurboGauge';
import { Tachometer, tachScale, type TachScale } from './Tachometer';
import { strainLevel, type StrainLevel } from '../../physics/engine/EngineOverrevFailure';

/** Text and symbol of each strain band (colour is never the only cue). */
export const STRAIN_TEXT: Record<StrainLevel | 'broken', { text: string; symbol: string }> = {
  normal: { text: 'Normal', symbol: '●' },
  elevated: { text: 'Elevado', symbol: '▲' },
  high: { text: 'Alto', symbol: '▲▲' },
  critical: { text: 'Crítico', symbol: '⚠' },
  broken: { text: 'Quebrado', symbol: '✖' },
};

/** Run information shown next to the gauges (computed by the mode). */
export interface HudInfo {
  /** Distance from the start line (m). */
  distanceM: number;
  /** Run timer (s) or null before the launch. */
  timeS: number | null;
  /** Label for the timer (e.g. "tempo", "ET"). */
  timeLabel?: string;
  /** Separate ET (s since leaving the stage beam): undefined hides the row, null shows "—". */
  etS?: number | null;
  /** Highlights the timer (e.g. red light). */
  alert?: boolean;
  /** Opponent position relative to the player (m, positive = opponent ahead) or null. */
  gapM: number | null;
}

/**
 * Driver instruments: analogue tachometer scaled to the engine, gear indicator, digital speed,
 * progressive shift lights, throttle, turbo gauge (turbo cars), run timer, distance, gap to the
 * opponent and tyre slip. Every value is read from the simulation; the only processing is a
 * short visual filter on the needle and the speed digits. Following the semi-automatic
 * transmission plan there is no clutch indicator.
 */
export class RacingHUD {
  readonly el: HTMLElement;
  private readonly tach = new Tachometer(150);
  private readonly gear = new GearIndicator();
  private readonly lights = new ShiftLights();
  private readonly rpm: HTMLElement;
  private readonly speed: HTMLElement;
  private readonly speedLabel: HTMLElement;
  private readonly throttle: HTMLElement;
  private readonly throttleText: HTMLElement;
  private readonly turbo = new TurboGauge(78);
  private readonly msg: HTMLElement;
  private readonly dist: HTMLElement;
  private readonly time: HTMLElement;
  private readonly timeLabel: HTMLElement;
  private readonly etRow: HTMLElement;
  private readonly et: HTMLElement;
  private readonly timeRow: HTMLElement;
  private readonly gapRow: HTMLElement;
  private readonly gap: HTMLElement;
  private readonly slipBar: HTMLElement;
  private readonly slipText: HTMLElement;
  private readonly strainRow: HTMLElement;
  private readonly strainBar: HTMLElement;
  private readonly strainText: HTMLElement;
  /** Overrides the computed shift point (rpm) when set. */
  shiftRpm: number | null = null;
  private scale: TachScale = tachScale(7000, 7200);
  private targets: (number | null)[] = [];
  private carKey = '';
  private shownSpeed = 0;
  private lastT = 0;
  private clock = 0;

  constructor(parent: HTMLElement) {
    this.rpm = h('div', { class: 'rpm-val', 'data-testid': 'hud-rpm' }, '0');
    this.speed = h('div', { class: 'speed-val', 'data-testid': 'hud-speed' }, '0');
    this.speedLabel = h('div', { class: 'unit' }, 'km/h');
    this.throttle = h('div', { class: 'fill' });
    this.throttleText = h('span', { class: 'val' }, '0 %');
    this.msg = h('div', { class: 'msg', 'data-testid': 'hud-msg' }, '');
    this.dist = h('span', { 'data-testid': 'hud-distance' }, '0.0 m');
    this.time = h('span', { 'data-testid': 'hud-time' }, '—');
    this.timeLabel = h('span', { class: 'k' }, 'tempo');
    this.et = h('span', { 'data-testid': 'hud-et' }, '—');
    this.etRow = h('div', { class: 'kv-row' }, h('span', { class: 'k' }, 'ET (desde o sensor)'), this.et);
    this.etRow.style.display = 'none';
    this.timeRow = h('div', { class: 'kv-row big' }, this.timeLabel, this.time);
    this.gap = h('span', { 'data-testid': 'hud-gap' }, '');
    this.gapRow = h('div', { class: 'kv-row' }, h('span', { class: 'k' }, 'adversário'), this.gap);
    this.slipBar = h('div', { class: 'fill' });
    this.slipText = h('span', { class: 'val', 'data-testid': 'hud-slip' }, '0 %');
    this.strainBar = h('div', { class: 'fill' });
    this.strainText = h('span', { class: 'val', 'data-testid': 'hud-strain-text' }, '● Normal');
    this.strainRow = h(
      'div',
      {
        class: 'bar-row strain-row',
        'data-testid': 'hud-strain',
        'data-level': 'normal',
        role: 'meter',
        'aria-label': 'Esforço do motor',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        title: 'Esforço do motor: acumula acima da rotação recomendada (mais rápido com carga e pressão) e alivia abaixo dela.',
      },
      h('span', { class: 'k' }, 'ESFORÇO DO MOTOR'),
      h('div', { class: 'hbar' }, this.strainBar),
      this.strainText,
    );
    this.strainRow.style.display = 'none';
    this.el = h(
      'div',
      { class: 'rhud', 'data-testid': 'hud' },
      h('div', { class: 'tach' }, this.tach.canvas, this.gear.el, this.rpm),
      h(
        'div',
        { class: 'centre' },
        this.lights.el,
        h('div', { class: 'speed-row' }, h('div', { class: 'speed' }, this.speed, this.speedLabel), this.turbo.el),
        h('div', { class: 'bar-row' }, h('span', { class: 'k' }, 'acel.'), h('div', { class: 'hbar' }, this.throttle), this.throttleText),
      ),
      h(
        'div',
        { class: 'info' },
        this.timeRow,
        this.etRow,
        h('div', { class: 'kv-row' }, h('span', { class: 'k' }, 'distância'), this.dist),
        this.gapRow,
        h('div', { class: 'bar-row', title: 'Escorregamento longitudinal dos pneus de tração: (ωr − v) / v' }, h('span', { class: 'k' }, 'patinagem'), h('div', { class: 'hbar' }, this.slipBar), this.slipText),
        this.strainRow,
        this.msg,
      ),
    );
    parent.append(this.el);
  }

  update(sim: VehicleSimulation, units: 'kmh' | 'mph', message = '', info?: HudInfo): void {
    const now = performance.now();
    const dt = this.lastT === 0 ? 1 / 60 : Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    this.clock += dt;
    const e = sim.car.engine;
    const t = sim.car.transmission;
    // scale and shift points belong to the car: recompute when the car changes
    const key = `${sim.car.id}|${e.redlineRpm}|${e.revLimitRpm}|${t.gearRatios.join(',')}|${t.finalDrive}|${e.torqueCurve.torqueNm.join(',')}`;
    if (key !== this.carKey) {
      this.carKey = key;
      this.scale = tachScale(e.redlineRpm, e.revLimitRpm);
      this.targets = shiftTargets(sim.car);
    }
    const rpm = sim.engine.rpm;
    const g = sim.gearbox.engaged ? sim.gearbox.gear : 0;
    const target = g > 0 ? (this.shiftRpm ?? this.targets[g - 1] ?? null) : null;
    this.gear.update({ gear: g, shifting: sim.shift.active, targetGear: sim.shift.targetGear });
    this.tach.draw(rpm, this.scale, target, sim.engine.ignition.limiterActive, dt);
    this.lights.update(shiftLightState(rpm, sim.shift.active ? null : target), this.clock);
    this.rpm.textContent = String(Math.round(rpm / 10) * 10);

    const su = speedUnit(units);
    const v = Math.abs(sim.speed * su.k);
    this.shownSpeed += (v - this.shownSpeed) * (1 - Math.exp(-dt / 0.06));
    this.speed.textContent = this.shownSpeed.toFixed(0);
    this.speedLabel.textContent = su.label;

    const pedal = Math.max(0, Math.min(1, sim.controls.pedal));
    this.throttle.style.width = `${(pedal * 100).toFixed(0)}%`;
    this.throttleText.textContent = `${(pedal * 100).toFixed(0)} %`;
    this.turbo.update(turboGaugeState(sim), dt);

    this.msg.textContent = message || stateText(sim);
    const inf = info ?? { distanceM: sim.x, timeS: null, gapM: null };
    this.dist.textContent = `${inf.distanceM.toFixed(1)} m`;
    this.timeLabel.textContent = inf.timeLabel ?? 'tempo';
    this.time.textContent = inf.timeS === null ? '—' : `${inf.timeS.toFixed(3)} s`;
    this.etRow.style.display = inf.etS === undefined ? 'none' : '';
    this.et.textContent = inf.etS == null ? '—' : `${inf.etS.toFixed(3)} s`;
    this.timeRow.style.color = inf.alert ? '#ff4d4d' : '';
    this.gapRow.style.display = inf.gapM === null ? 'none' : '';
    if (inf.gapM !== null) this.gap.textContent = `${inf.gapM >= 0 ? '+' : '−'}${Math.abs(inf.gapM).toFixed(1)} m ${inf.gapM >= 0 ? 'à frente' : 'atrás'}`;
    // slip ratio of the driven tyres; below ~2 m/s the ratio uses 2 m/s as reference (telemetry)
    const slip = Math.max(0, sim.telemetry.slipRatio);
    this.slipBar.style.width = `${Math.min(100, slip * 100).toFixed(0)}%`;
    this.slipBar.classList.toggle('hot', slip > 0.15);
    this.slipText.textContent = slip > 9.99 ? '>999 %' : `${(slip * 100).toFixed(0)} %`;
    this.updateStrain(sim);
  }

  /** Engine strain gauge: only when mechanical failures are on for this car. */
  private updateStrain(sim: VehicleSimulation): void {
    const f = sim.failure;
    this.strainRow.style.display = f ? '' : 'none';
    if (!f) return;
    const strain = f.strain;
    const level: StrainLevel | 'broken' = f.broken ? 'broken' : strainLevel(strain);
    this.strainBar.style.width = `${Math.round(strain * 100)}%`;
    const t = STRAIN_TEXT[level];
    this.strainText.textContent = `${t.symbol} ${t.text}`;
    if (this.strainRow.dataset.level !== level) this.strainRow.dataset.level = level;
    this.strainRow.setAttribute('aria-valuenow', String(Math.round(strain * 100)));
    this.el.classList.toggle('strain-alert', level === 'high' || level === 'critical');
  }

  /** Strain gauge state for the tests. */
  get strainDebug(): { visible: boolean; level: string; text: string } {
    return { visible: this.strainRow.style.display !== 'none', level: this.strainRow.dataset.level ?? '', text: this.strainText.textContent ?? '' };
  }

  /** Current scale and shift target (for the tests). */
  get debug(): { maxRpm: number; redlineRpm: number; targets: (number | null)[]; shownRpm: number } {
    return { maxRpm: this.scale.maxRpm, redlineRpm: this.scale.redlineRpm, targets: this.targets, shownRpm: this.tach.shownRpm };
  }

  /** Turbo gauge state for the tests. */
  get turboDebug(): { visible: boolean; shownBar: number } {
    return { visible: this.turbo.isVisible, shownBar: this.turbo.shownBar };
  }

  dispose(): void {
    this.el.remove();
  }
}

function stateText(sim: VehicleSimulation): string {
  const e = sim.engine;
  if (e.runState === 'OFF') return 'motor desligado';
  if (e.runState === 'CRANKING') return 'dando partida…';
  if (e.runState === 'STALLED') return 'motor apagou';
  if (e.runState === 'BROKEN') return 'MOTOR QUEBRADO';
  if (sim.controls.autoBrake) return 'frenagem automática';
  return '';
}
