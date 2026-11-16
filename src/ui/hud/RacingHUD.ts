import type { VehicleSimulation } from '../../physics/vehicle/VehicleSimulation';
import { h, speedUnit } from '../dom';
import { GearIndicator } from './GearIndicator';
import { ShiftLights, shiftLightState, shiftTargets } from './ShiftLights';
import { Tachometer, tachScale, type TachScale } from './Tachometer';

/** Run information shown next to the gauges (computed by the mode). */
export interface HudInfo {
  /** Distance from the start line (m). */
  distanceM: number;
  /** Run timer (s) or null before the launch. */
  timeS: number | null;
  /** Label for the timer (e.g. "tempo", "ET"). */
  timeLabel?: string;
  /** Opponent position relative to the player (m, positive = opponent ahead) or null. */
  gapM: number | null;
}

/**
 * Driver instruments: analogue tachometer scaled to the engine, gear indicator, digital speed,
 * progressive shift lights, throttle, boost (turbo cars), run timer, distance, gap to the
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
  private readonly boostRow: HTMLElement;
  private readonly boost: HTMLElement;
  private readonly boostText: HTMLElement;
  private readonly msg: HTMLElement;
  private readonly dist: HTMLElement;
  private readonly time: HTMLElement;
  private readonly timeLabel: HTMLElement;
  private readonly gapRow: HTMLElement;
  private readonly gap: HTMLElement;
  private readonly slipBar: HTMLElement;
  private readonly slipText: HTMLElement;
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
    this.boost = h('div', { class: 'fill boost' });
    this.boostText = h('span', { class: 'val', 'data-testid': 'hud-boost' }, '0.00 bar');
    this.boostRow = h('div', { class: 'bar-row' }, h('span', { class: 'k' }, 'turbo'), h('div', { class: 'hbar' }, this.boost), this.boostText);
    this.msg = h('div', { class: 'msg', 'data-testid': 'hud-msg' }, '');
    this.dist = h('span', { 'data-testid': 'hud-distance' }, '0.0 m');
    this.time = h('span', { 'data-testid': 'hud-time' }, '—');
    this.timeLabel = h('span', { class: 'k' }, 'tempo');
    this.gap = h('span', { 'data-testid': 'hud-gap' }, '');
    this.gapRow = h('div', { class: 'kv-row' }, h('span', { class: 'k' }, 'adversário'), this.gap);
    this.slipBar = h('div', { class: 'fill' });
    this.slipText = h('span', { class: 'val', 'data-testid': 'hud-slip' }, '0 %');
    this.el = h(
      'div',
      { class: 'rhud', 'data-testid': 'hud' },
      h('div', { class: 'tach' }, this.tach.canvas, this.gear.el, this.rpm),
      h(
        'div',
        { class: 'centre' },
        this.lights.el,
        h('div', { class: 'speed' }, this.speed, this.speedLabel),
        h('div', { class: 'bar-row' }, h('span', { class: 'k' }, 'acel.'), h('div', { class: 'hbar' }, this.throttle), this.throttleText),
        this.boostRow,
      ),
      h(
        'div',
        { class: 'info' },
        h('div', { class: 'kv-row big' }, this.timeLabel, this.time),
        h('div', { class: 'kv-row' }, h('span', { class: 'k' }, 'distância'), this.dist),
        this.gapRow,
        h('div', { class: 'bar-row', title: 'Escorregamento longitudinal dos pneus de tração: (ωr − v) / v' }, h('span', { class: 'k' }, 'patinagem'), h('div', { class: 'hbar' }, this.slipBar), this.slipText),
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
    if (sim.engine.turbo) {
      this.boostRow.style.display = '';
      const bar = sim.engine.turbo.boostPa / 1e5;
      const max = Math.max(0.2, e.turbo?.maxBoostBar ?? 1);
      this.boost.style.width = `${Math.max(0, Math.min(100, (bar / max) * 100)).toFixed(0)}%`;
      this.boostText.textContent = `${bar.toFixed(2)} bar`;
    } else this.boostRow.style.display = 'none';

    this.msg.textContent = message || stateText(sim);
    const inf = info ?? { distanceM: sim.x, timeS: null, gapM: null };
    this.dist.textContent = `${inf.distanceM.toFixed(1)} m`;
    this.timeLabel.textContent = inf.timeLabel ?? 'tempo';
    this.time.textContent = inf.timeS === null ? '—' : `${inf.timeS.toFixed(3)} s`;
    this.gapRow.style.display = inf.gapM === null ? 'none' : '';
    if (inf.gapM !== null) this.gap.textContent = `${inf.gapM >= 0 ? '+' : '−'}${Math.abs(inf.gapM).toFixed(1)} m ${inf.gapM >= 0 ? 'à frente' : 'atrás'}`;
    // slip ratio of the driven tyres; below ~2 m/s the ratio uses 2 m/s as reference (telemetry)
    const slip = Math.max(0, sim.telemetry.slipRatio);
    this.slipBar.style.width = `${Math.min(100, slip * 100).toFixed(0)}%`;
    this.slipBar.classList.toggle('hot', slip > 0.15);
    this.slipText.textContent = slip > 9.99 ? '>999 %' : `${(slip * 100).toFixed(0)} %`;
  }

  /** Current scale and shift target (for the tests). */
  get debug(): { maxRpm: number; redlineRpm: number; targets: (number | null)[]; shownRpm: number } {
    return { maxRpm: this.scale.maxRpm, redlineRpm: this.scale.redlineRpm, targets: this.targets, shownRpm: this.tach.shownRpm };
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
  if (sim.controls.autoBrake) return 'frenagem automática';
  return '';
}
