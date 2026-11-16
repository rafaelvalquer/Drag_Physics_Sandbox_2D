import type { CarConfig } from '../../data/schema';
import { Prng } from '../../core/prng';
import { composeVehicle } from '../../game/vehicles/compose';
import { assembleVehicleSprites, type VehicleSpriteSet } from '../../game/vehicles/VehicleSpriteAssembler';
import { WheelAnimationController } from '../../game/vehicles/WheelAnimationController';

/**
 * Dyno cell illustration: the selected car (same artwork as on the track) strapped on a roller
 * bench in an industrial test cell – rollers, cooling fan, exhaust extraction, console, lamps.
 *
 * The simulation behind this mode is an ENGINE dynamometer (torque measured at the crank). The
 * picture is a presentation of it: the driven wheels and the rollers turn at the engine speed
 * through the car's most direct gear, which is a visual mapping only. The measured curves on the
 * charts beside it are the real data.
 */
export interface DynoBayState {
  rpm: number;
  running: boolean;
  cranking: boolean;
}

/** Wheel speed (rad/s) shown for an engine speed: through the gear closest to direct drive. */
export function dynoWheelOmega(car: CarConfig, rpm: number): number {
  const ratios = car.transmission.gearRatios;
  let best = ratios[0] ?? 1;
  for (const r of ratios) if (Math.abs(r - 1) < Math.abs(best - 1)) best = r;
  return ((rpm * 2 * Math.PI) / 60 / (best * car.transmission.finalDrive)) * 1;
}

const ROLLER_R_M = 0.17;

export class DynoBayView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private set: VehicleSpriteSet | null = null;
  private car: CarConfig | null = null;
  private token = 0;
  private w = 0;
  private h = 0;
  private wheelAngle = 0;
  private rollerAngle = 0;
  private fanAngle = 0;
  private fanSpeed = 0;
  private readonly wheelCtl = new WheelAnimationController('staged');
  private readonly rng = new Prng(11);
  private readonly ro: ResizeObserver;
  private lastOmega = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dyno-bay';
    this.canvas.setAttribute('data-testid', 'dyno-bay');
    this.canvas.title = 'Ilustração da bancada: as rodas giram na rotação do motor pela marcha mais direta (apenas visual). As curvas ao lado são as medidas reais.';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (w < 20 || h < 20 || (w === this.w && h === this.h)) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.bg = null;
    if (this.car) void this.setCar(this.car);
  }

  async setCar(car: CarConfig): Promise<void> {
    this.car = car;
    if (this.w === 0) return;
    const token = ++this.token;
    const needed = (this.w * 0.6) / car.visual.lengthM;
    const set = await assembleVehicleSprites(car, Math.min(260, Math.max(60, Math.ceil(needed / 20) * 20)));
    if (token !== this.token) return;
    this.set = set;
    this.bg = null;
  }

  /** Pixels per metre and key positions of the current layout. */
  private layout(): { px: number; groundY: number; frontX: number } | null {
    const set = this.set;
    if (!set) return null;
    const px = (this.w * 0.6) / set.meta.lengthM;
    const groundY = this.h * 0.8;
    const frontX = this.w * 0.52 - ((set.meta.rearX + set.meta.noseX) / 2) * px;
    return { px, groundY, frontX };
  }

  private buildBackground(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d')!;
    const { w, h } = this;
    const lay = this.layout()!;
    const { px, groundY, frontX } = lay;
    const m = this.set!.meta;
    // wall: acoustic panels above a painted dado
    const wall = g.createLinearGradient(0, 0, 0, groundY);
    wall.addColorStop(0, '#161b21');
    wall.addColorStop(1, '#2b333c');
    g.fillStyle = wall;
    g.fillRect(0, 0, w, groundY);
    const tile = px * 0.6;
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = Math.max(1, px * 0.008);
    for (let x = 0; x < w; x += tile) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, groundY - px * 0.9);
      g.stroke();
    }
    for (let y = 0; y < groundY - px * 0.9; y += tile) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.fillStyle = '#3a444e';
    g.fillRect(0, groundY - px * 0.9, w, px * 0.9);
    g.fillStyle = '#e0a100';
    g.fillRect(0, groundY - px * 0.92, w, px * 0.05);
    // overhead lamps with light cones
    for (const fx of [0.2, 0.52, 0.84]) {
      const lx = w * fx;
      const cone = g.createLinearGradient(0, 0, 0, groundY);
      cone.addColorStop(0, 'rgba(255,244,214,0.22)');
      cone.addColorStop(1, 'rgba(255,244,214,0)');
      g.fillStyle = cone;
      g.beginPath();
      g.moveTo(lx - px * 0.35, px * 0.12);
      g.lineTo(lx + px * 0.35, px * 0.12);
      g.lineTo(lx + px * 1.9, groundY);
      g.lineTo(lx - px * 1.9, groundY);
      g.fill();
      g.fillStyle = '#39414a';
      g.fillRect(lx - px * 0.45, 0, px * 0.9, px * 0.1);
      g.fillStyle = '#fff6da';
      g.fillRect(lx - px * 0.38, px * 0.1, px * 0.76, px * 0.05);
    }
    // wall sign and extraction duct along the ceiling
    g.fillStyle = '#10141a';
    g.fillRect(w * 0.33, groundY - px * 2.25, px * 2.6, px * 0.42);
    g.fillStyle = '#f2b705';
    g.font = `700 ${Math.round(px * 0.22)}px system-ui, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('BANCADA DE TESTES', w * 0.33 + px * 0.16, groundY - px * 2.04);
    const duct = g.createLinearGradient(0, px * 0.3, 0, px * 0.62);
    duct.addColorStop(0, '#9aa3ab');
    duct.addColorStop(1, '#565e66');
    g.fillStyle = duct;
    g.fillRect(0, px * 0.3, w * 0.42, px * 0.32);
    // control console
    const cx = Math.max(px * 0.2, frontX + m.rearX * px - px * 2.3);
    g.fillStyle = '#20262d';
    g.fillRect(cx, groundY - px * 1.25, px * 0.85, px * 1.25);
    g.fillStyle = '#0c0f13';
    g.fillRect(cx + px * 0.08, groundY - px * 1.15, px * 0.69, px * 0.4);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = ['#37e06a', '#37e06a', '#ffc02e', '#2bb3ff', '#ff4040'][i]!;
      g.beginPath();
      g.arc(cx + px * (0.16 + i * 0.13), groundY - px * 0.6, px * 0.03, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#39424c';
    for (let i = 0; i < 3; i++) g.fillRect(cx + px * 0.08, groundY - px * (0.46 - i * 0.14), px * 0.69, px * 0.09);
    // floor: epoxy with a hazard border around the bench
    const floor = g.createLinearGradient(0, groundY, 0, h);
    floor.addColorStop(0, '#4a535d');
    floor.addColorStop(1, '#1d2228');
    g.fillStyle = floor;
    g.fillRect(0, groundY, w, h - groundY);
    const x0 = frontX + m.rearX * px - px * 0.5;
    const x1 = frontX + m.noseX * px + px * 0.5;
    g.fillStyle = '#5b646e';
    g.fillRect(x0, groundY, x1 - x0, px * 0.09);
    const stripe = px * 0.16;
    g.save();
    g.beginPath();
    g.rect(x0, groundY + px * 0.09, x1 - x0, px * 0.1);
    g.clip();
    for (let x = x0 - stripe * 2; x < x1 + stripe; x += stripe * 2) {
      g.fillStyle = '#e0a100';
      g.beginPath();
      g.moveTo(x, groundY + px * 0.19);
      g.lineTo(x + stripe, groundY + px * 0.19);
      g.lineTo(x + stripe * 2, groundY + px * 0.09);
      g.lineTo(x + stripe, groundY + px * 0.09);
      g.fill();
    }
    g.restore();
    // roller pit under the driven axle, chocks at the other one
    const driven = this.car!.drivenAxle === 'rear' ? m.wheelCentres.rear : m.wheelCentres.front;
    const idle = this.car!.drivenAxle === 'rear' ? m.wheelCentres.front : m.wheelCentres.rear;
    const dx = frontX + driven.x * px;
    g.fillStyle = '#07090b';
    g.fillRect(dx - px * 0.5, groundY, px * 1.0, px * 0.3);
    const ix = frontX + idle.x * px;
    g.fillStyle = '#e0a100';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(ix + s * px * (m.tyreRadiusM * 0.55), groundY);
      g.lineTo(ix + s * px * (m.tyreRadiusM * 0.55 + 0.22), groundY);
      g.lineTo(ix + s * px * (m.tyreRadiusM * 0.72), groundY - px * 0.14);
      g.fill();
    }
    return c;
  }

  update(dtS: number, st: DynoBayState): void {
    const set = this.set;
    const car = this.car;
    const lay = this.layout();
    if (!set || !car || !lay || this.w === 0) return;
    if (!this.bg) this.bg = this.buildBackground();
    const g = this.ctx;
    const { px, groundY, frontX } = lay;
    const m = set.meta;
    const dt = Math.min(0.1, Math.max(0, dtS));
    const omega = st.running ? dynoWheelOmega(car, st.rpm) : 0;
    this.lastOmega = omega;
    this.wheelAngle += omega * dt;
    this.rollerAngle -= ((omega * m.tyreRadiusM) / ROLLER_R_M) * dt;
    this.fanSpeed += ((st.running ? 26 : 0) - this.fanSpeed) * Math.min(1, dt / 1.2);
    this.fanAngle += this.fanSpeed * dt;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.bg, 0, 0);

    const rearDriven = car.drivenAxle === 'rear';
    const driven = rearDriven ? m.wheelCentres.rear : m.wheelCentres.front;
    const dx = frontX + driven.x * px;
    // rollers cradle the driven tyre
    for (const s of [-1, 1]) {
      const rx = dx + s * px * 0.215;
      const ry = groundY + px * 0.135;
      const rr = px * ROLLER_R_M;
      const grad = g.createLinearGradient(rx - rr, ry - rr, rx + rr, ry + rr);
      grad.addColorStop(0, '#c9d0d6');
      grad.addColorStop(0.5, '#5d666e');
      grad.addColorStop(1, '#a9b1b8');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(rx, ry, rr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = Math.max(1, px * 0.012);
      const blur = Math.min(1, Math.abs(omega) / 30);
      g.globalAlpha = 1 - blur * 0.85;
      for (let i = 0; i < 6; i++) {
        const a = this.rollerAngle + (i / 6) * Math.PI * 2;
        g.beginPath();
        g.moveTo(rx + Math.cos(a) * rr * 0.25, ry + Math.sin(a) * rr * 0.25);
        g.lineTo(rx + Math.cos(a) * rr * 0.92, ry + Math.sin(a) * rr * 0.92);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#1b1f24';
      g.beginPath();
      g.arc(rx, ry, rr * 0.22, 0, Math.PI * 2);
      g.fill();
    }
    // exhaust extraction hose from the ceiling duct to the tail pipe
    const ex = m.exhausts[0] ?? { x: m.rearX, y: 0.3 };
    const ex0 = frontX + ex.x * px;
    const ey0 = groundY - ex.y * px;
    g.strokeStyle = '#2b3138';
    g.lineWidth = px * 0.14;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(Math.max(px * 0.4, ex0 - px * 1.5), px * 0.6);
    g.bezierCurveTo(Math.max(px * 0.4, ex0 - px * 1.5), groundY * 0.7, ex0 - px * 1.0, ey0 + px * 0.05, ex0 - px * 0.16, ey0);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = px * 0.03;
    g.stroke();
    g.fillStyle = '#3a424a';
    g.beginPath();
    g.moveTo(ex0 - px * 0.2, ey0 - px * 0.08);
    g.lineTo(ex0 + px * 0.02, ey0 - px * 0.13);
    g.lineTo(ex0 + px * 0.02, ey0 + px * 0.13);
    g.lineTo(ex0 - px * 0.2, ey0 + px * 0.08);
    g.fill();

    // the car: wheels by the shown wheel speed, a little shake from the running engine
    const layers = this.wheelCtl.layers(omega);
    const frame = layers.full > 0.5 ? 'wheelFull' : layers.soft > 0.5 ? 'wheelSoft' : 'wheel';
    const shake = st.cranking ? 0.004 : st.running ? 0.0016 * Math.max(0.3, 1 - st.rpm / 6000) : 0;
    composeVehicle(g, set, frontX, groundY, px / m.pxPerM, {
      rearAngle: rearDriven ? this.wheelAngle : 0,
      frontAngle: rearDriven ? 0 : this.wheelAngle,
      rearFrame: rearDriven ? frame : 'wheel',
      frontFrame: rearDriven ? 'wheel' : frame,
      bodyDy: this.rng.bipolar() * shake * px,
    });
    // tie-down straps
    g.strokeStyle = '#e0a100';
    g.lineWidth = Math.max(1.5, px * 0.022);
    for (const [bx, ax] of [
      [m.rearX + 0.25, m.rearX - 0.35],
      [m.noseX - 0.3, m.noseX + 0.35],
    ] as const) {
      g.beginPath();
      g.moveTo(frontX + bx * px, groundY - px * 0.3);
      g.lineTo(frontX + ax * px, groundY - px * 0.01);
      g.stroke();
    }
    // cooling fan in front of the car
    const fx = Math.min(this.w - px * 0.5, frontX + m.noseX * px + px * 1.15);
    const fy = groundY - px * 0.62;
    g.fillStyle = '#2b3138';
    g.fillRect(fx - px * 0.06, fy, px * 0.12, px * 0.62);
    g.fillRect(fx - px * 0.3, groundY - px * 0.05, px * 0.6, px * 0.05);
    g.save();
    g.translate(fx, fy);
    g.scale(0.34, 1);
    g.fillStyle = '#12161b';
    g.beginPath();
    g.arc(0, 0, px * 0.56, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#9aa3ab';
    g.lineWidth = px * 0.05;
    g.stroke();
    const spin = Math.min(1, this.fanSpeed / 20);
    g.strokeStyle = `rgba(190,200,210,${(0.75 - spin * 0.5).toFixed(2)})`;
    g.lineWidth = px * (0.09 + spin * 0.12);
    for (let i = 0; i < 5; i++) {
      const a = this.fanAngle + (i / 5) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * px * 0.08, Math.sin(a) * px * 0.08);
      g.lineTo(Math.cos(a) * px * 0.48, Math.sin(a) * px * 0.48);
      g.stroke();
    }
    g.restore();
  }

  /** State of the illustration (for the tests). */
  debug(): { loaded: boolean; wheelOmega: number; carPx: number; groundY: number; width: number; height: number } {
    const lay = this.layout();
    return { loaded: !!this.set, wheelOmega: this.lastOmega, carPx: lay && this.set ? lay.px * this.set.meta.lengthM : 0, groundY: lay?.groundY ?? 0, width: this.w, height: this.h };
  }

  dispose(): void {
    this.ro.disconnect();
    this.token++;
  }
}
