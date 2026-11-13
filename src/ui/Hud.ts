import type { VehicleSimulation } from '../physics/vehicle/VehicleSimulation';
import { h, speedUnit } from './dom';

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
 * Driver HUD: tachometer with redline, gear, speed, throttle, boost and a shift light.
 * Following the semi-automatic transmission plan there is no clutch indicator.
 */
export class Hud {
  readonly el: HTMLElement;
  private readonly tach: HTMLCanvasElement;
  private readonly gear: HTMLElement;
  private readonly speed: HTMLElement;
  private readonly speedLabel: HTMLElement;
  private readonly rpm: HTMLElement;
  private readonly throttle: HTMLElement;
  private readonly boostWrap: HTMLElement;
  private readonly boost: HTMLElement;
  private readonly light: HTMLElement;
  private readonly msg: HTMLElement;
  private readonly dist: HTMLElement;
  private readonly time: HTMLElement;
  private readonly timeLabel: HTMLElement;
  private readonly gapRow: HTMLElement;
  private readonly gap: HTMLElement;
  private readonly slipBar: HTMLElement;
  private readonly slipText: HTMLElement;
  shiftRpm: number | null = null;

  constructor(parent: HTMLElement) {
    this.tach = h('canvas', { width: 220, height: 130 }) as HTMLCanvasElement;
    this.gear = h('div', { class: 'big' }, 'N');
    this.speed = h('div', { class: 'big' }, '0');
    this.speedLabel = h('div', { class: 'small' }, 'km/h');
    this.rpm = h('div', { class: 'small' }, '0 rpm');
    this.throttle = h('div');
    this.boost = h('div', { class: 'small' }, '');
    this.boostWrap = h('div', { class: 'gauge' }, h('div', { class: 'small' }, 'turbo'), this.boost);
    this.light = h('span', { class: 'shiftlight' });
    this.msg = h('div', { class: 'small' }, '');
    this.dist = h('span', { 'data-testid': 'hud-distance' }, '0,0 m');
    this.time = h('span', { 'data-testid': 'hud-time' }, '—');
    this.timeLabel = h('span', { class: 'k' }, 'tempo');
    this.gap = h('span', { 'data-testid': 'hud-gap' }, '');
    this.gapRow = h('div', { class: 'kv-row' }, h('span', { class: 'k' }, 'adversário'), this.gap);
    this.slipBar = h('div', { class: 'fill' });
    this.slipText = h('span', { class: 'slip-text', 'data-testid': 'hud-slip' }, '0 %');
    const info = h(
      'div',
      { class: 'gauge info' },
      h('div', { class: 'kv-row' }, h('span', { class: 'k' }, 'distância'), this.dist),
      h('div', { class: 'kv-row' }, this.timeLabel, this.time),
      this.gapRow,
      h('div', { class: 'kv-row', title: 'Escorregamento longitudinal dos pneus de tração: (ωr − v) / v' }, h('span', { class: 'k' }, 'patinagem'), h('div', { class: 'hbar' }, this.slipBar), this.slipText),
    );
    this.el = h(
      'div',
      { class: 'hud' },
      h('div', { class: 'gauge' }, this.tach, h('div', { class: 'row' }, this.rpm, this.light)),
      h('div', { class: 'gauge' }, h('div', { class: 'small' }, 'marcha'), this.gear),
      h('div', { class: 'gauge' }, this.speed, this.speedLabel),
      h('div', { class: 'gauge' }, h('div', { class: 'small' }, 'acel.'), h('div', { class: 'bar' }, this.throttle)),
      this.boostWrap,
      info,
      h('div', { class: 'gauge' }, this.msg),
    );
    parent.append(this.el);
  }

  update(sim: VehicleSimulation, units: 'kmh' | 'mph', message = '', info?: HudInfo): void {
    const e = sim.car.engine;
    const rpm = sim.engine.rpm;
    const g = sim.gearbox.engaged ? sim.gearbox.gear : 0;
    this.gear.textContent = sim.shift.active ? '·' : g === 0 ? 'N' : String(g);
    const su = speedUnit(units);
    this.speed.textContent = Math.abs(sim.speed * su.k).toFixed(0);
    this.speedLabel.textContent = su.label;
    this.rpm.textContent = `${rpm.toFixed(0).padStart(5)} rpm`;
    (this.throttle as HTMLElement).style.height = `${(sim.controls.pedal * 100).toFixed(0)}%`;
    if (sim.engine.turbo) {
      this.boostWrap.style.display = '';
      this.boost.textContent = `${(sim.engine.turbo.boostPa / 1e5).toFixed(2)} bar`;
    } else this.boostWrap.style.display = 'none';
    const shiftAt = this.shiftRpm ?? e.redlineRpm - 250;
    this.light.classList.toggle('on', rpm >= shiftAt && g > 0 && g < sim.car.transmission.gearRatios.length);
    this.msg.textContent = message || stateText(sim);
    const inf = info ?? { distanceM: sim.x, timeS: null, gapM: null };
    this.dist.textContent = `${inf.distanceM.toFixed(1)} m`;
    this.timeLabel.textContent = inf.timeLabel ?? 'tempo';
    this.time.textContent = inf.timeS === null ? '—' : `${inf.timeS.toFixed(3)} s`;
    this.gapRow.style.display = inf.gapM === null ? 'none' : '';
    if (inf.gapM !== null) this.gap.textContent = `${inf.gapM >= 0 ? '+' : '−'}${Math.abs(inf.gapM).toFixed(1)} m ${inf.gapM >= 0 ? 'à frente' : 'atrás'}`;
    // slip ratio of the driven tyres; below ~2 m/s the ratio uses 2 m/s as reference (telemetry)
    const slip = Math.max(0, sim.telemetry.slipRatio);
    const pct = Math.min(100, slip * 100);
    this.slipBar.style.width = `${pct.toFixed(0)}%`;
    this.slipBar.classList.toggle('hot', slip > 0.15);
    this.slipText.textContent = slip > 9.99 ? '>999 %' : `${(slip * 100).toFixed(0)} %`;
    this.drawTach(rpm, e.redlineRpm, e.revLimitRpm, sim.engine.ignition.limiterActive);
  }

  private drawTach(rpm: number, red: number, limit: number, limiter: boolean): void {
    const c = this.tach;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    ctx.clearRect(0, 0, W, H);
    const max = Math.ceil((limit * 1.08) / 1000) * 1000;
    const cx = W / 2;
    const cy = H - 12;
    const R = 96;
    const a0 = Math.PI * 1.05;
    const a1 = Math.PI * 1.95;
    const ang = (r: number): number => a0 + (a1 - a0) * Math.min(1, Math.max(0, r / max));
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#2a323c';
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = '#c62828';
    ctx.beginPath();
    ctx.arc(cx, cy, R, ang(red), a1);
    ctx.stroke();
    ctx.strokeStyle = limiter ? '#ff5c5c' : '#f2b705';
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, ang(rpm));
    ctx.stroke();
    ctx.fillStyle = '#8d97a3';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (let r = 0; r <= max; r += 1000) {
      const a = ang(r);
      ctx.fillText(String(r / 1000), cx + Math.cos(a) * (R - 18), cy + Math.sin(a) * (R - 18) + 3);
    }
    const a = ang(rpm);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
    ctx.stroke();
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
