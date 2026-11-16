/**
 * Compact boost gauge (turbo cars only). Reads the real charge-pipe gauge pressure of the
 * simulated turbocharger (`Turbocharger.boostPa`); the only processing is a short visual filter on
 * the needle. The scale is derived from the configured maximum boost of the effective build.
 */
export interface TurboGaugeState {
  visible: boolean;
  /** Gauge pressure (bar, never negative). */
  boostBar: number;
  /** Maximum boost the installed turbo system is configured for (bar). */
  maxBoostBar: number;
}

/** Minimal view of the simulation needed by the gauge. */
export interface TurboSource {
  engine: { turbo: { boostPa: number; cfg: { maxBoostBar: number } } | null };
}

export const PA_PER_BAR = 100_000;
const MIN_SCALE_BAR = 0.8;
const MAX_SCALE_BAR = 2.5;

export function paToBar(pa: number): number {
  return Number.isFinite(pa) ? Math.max(0, pa / PA_PER_BAR) : 0;
}

/** Top of the dial: configured boost + 20 %, rounded up to 0.1 bar, clamped to 0.8..2.5 bar. */
export function turboGaugeMax(maxBoostBar: number): number {
  const raw = Math.ceil(Math.round(maxBoostBar * 1.2 * 1000) / 100) / 10;
  return Math.min(MAX_SCALE_BAR, Math.max(MIN_SCALE_BAR, raw));
}

export function turboGaugeState(sim: TurboSource): TurboGaugeState {
  const t = sim.engine.turbo;
  if (!t) return { visible: false, boostBar: 0, maxBoostBar: 0 };
  return { visible: true, boostBar: paToBar(t.boostPa), maxBoostBar: Math.max(0, t.cfg.maxBoostBar) };
}

const A0 = (135 * Math.PI) / 180;
const SWEEP = (270 * Math.PI) / 180;

/** Needle angle (rad, canvas convention); values outside the dial are clamped. */
export function boostAngle(bar: number, displayMax: number): number {
  return A0 + SWEEP * Math.min(1, Math.max(0, bar / displayMax));
}

/** One step of the visual needle filter (time constant `tau`, s). */
export function smoothBoost(shown: number, target: number, dtS: number, tau = 0.06): number {
  const next = dtS > 0 ? shown + (target - shown) * (1 - Math.exp(-dtS / tau)) : target;
  return Number.isFinite(next) ? next : 0;
}

export class TurboGauge {
  readonly el: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly value: HTMLElement;
  private face: HTMLCanvasElement | null = null;
  private faceKey = '';
  private shown = 0;
  private visible = true;
  private readonly px: number;

  constructor(readonly size = 78) {
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    this.px = Math.round(size * dpr);
    this.canvas.width = this.px;
    this.canvas.height = this.px;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.value = document.createElement('div');
    this.value.className = 'boost-val';
    this.value.dataset.testid = 'hud-boost';
    this.value.textContent = '0.0';
    const unit = document.createElement('div');
    unit.className = 'boost-unit';
    unit.textContent = 'bar';
    this.el = document.createElement('div');
    this.el.className = 'turbo-gauge';
    this.el.dataset.testid = 'turbo-gauge';
    this.el.style.width = `${size}px`;
    this.el.style.height = `${size}px`;
    this.el.append(this.canvas, this.value, unit);
  }

  /** Boost currently shown by the needle (after the visual filter). */
  get shownBar(): number {
    return this.shown;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.el.style.display = v ? '' : 'none';
    if (!v) this.shown = 0;
  }

  private buildFace(maxBoostBar: number, displayMax: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.px;
    c.height = this.px;
    const g = c.getContext('2d')!;
    const S = this.px;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.48;
    const bezel = g.createLinearGradient(0, 0, S, S);
    bezel.addColorStop(0, '#6f7780');
    bezel.addColorStop(0.5, '#23272c');
    bezel.addColorStop(1, '#565d65');
    g.fillStyle = bezel;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    const face = g.createRadialGradient(cx, cy - R * 0.25, R * 0.1, cx, cy, R * 0.95);
    face.addColorStop(0, '#20252b');
    face.addColorStop(1, '#090b0d');
    g.fillStyle = face;
    g.beginPath();
    g.arc(cx, cy, R * 0.92, 0, Math.PI * 2);
    g.fill();
    // zones: high boost (amber) from 85 % of the configured maximum, beyond it (red)
    const amberFrom = maxBoostBar * 0.85;
    g.lineCap = 'butt';
    g.lineWidth = R * 0.08;
    g.strokeStyle = '#e0a21a';
    g.beginPath();
    g.arc(cx, cy, R * 0.84, boostAngle(amberFrom, displayMax), boostAngle(maxBoostBar, displayMax));
    g.stroke();
    if (maxBoostBar < displayMax) {
      g.strokeStyle = '#b3342f';
      g.beginPath();
      g.arc(cx, cy, R * 0.84, boostAngle(maxBoostBar, displayMax), boostAngle(displayMax, displayMax));
      g.stroke();
    }
    // ticks (every 0.1 bar, major every 0.5 bar, numbers on majors)
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i * 0.1 <= displayMax + 1e-6; i++) {
      const v = i * 0.1;
      const major = i % 5 === 0;
      const a = boostAngle(v, displayMax);
      const r0 = R * (major ? 0.68 : 0.76);
      g.strokeStyle = v > maxBoostBar + 1e-6 ? '#d26a66' : v >= amberFrom ? '#f0c14a' : major ? '#f1f3f5' : '#8d97a3';
      g.lineWidth = S * (major ? 0.022 : 0.011);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88);
      g.stroke();
      if (major) {
        g.fillStyle = '#e6e9ee';
        g.font = `600 ${Math.round(S * 0.095)}px system-ui, sans-serif`;
        g.fillText(v.toFixed(1).replace(/\.0$/, ''), cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55);
      }
    }
    g.fillStyle = '#7d8792';
    g.font = `${Math.round(S * 0.1)}px system-ui, sans-serif`;
    g.fillText('turbo', cx, cy - R * 0.3);
    return c;
  }

  /** Updates visibility, needle and digital reading. Call every frame. */
  update(state: TurboGaugeState, dtS: number): void {
    this.setVisible(state.visible);
    if (!state.visible) return;
    const displayMax = turboGaugeMax(state.maxBoostBar);
    const key = `${state.maxBoostBar.toFixed(3)}|${displayMax}`;
    if (key !== this.faceKey || !this.face) {
      this.face = this.buildFace(state.maxBoostBar, displayMax);
      this.faceKey = key;
    }
    this.shown = smoothBoost(this.shown, Math.max(0, state.boostBar), dtS);
    const g = this.ctx;
    const S = this.px;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.48;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.face, 0, 0);
    const a = boostAngle(this.shown, displayMax);
    g.save();
    g.translate(cx, cy);
    g.rotate(a);
    g.shadowColor = 'rgba(255,90,40,0.7)';
    g.shadowBlur = S * 0.04;
    g.fillStyle = '#ff6a2b';
    g.beginPath();
    g.moveTo(-R * 0.14, -R * 0.03);
    g.lineTo(R * 0.8, -R * 0.01);
    g.lineTo(R * 0.8, R * 0.01);
    g.lineTo(-R * 0.14, R * 0.03);
    g.fill();
    g.restore();
    g.fillStyle = '#2a2f35';
    g.beginPath();
    g.arc(cx, cy, R * 0.1, 0, Math.PI * 2);
    g.fill();
    this.value.textContent = this.shown.toFixed(this.shown < 0.995 ? 2 : 1).replace(/^(\d)\.(\d)0$/, '$1.$2');
  }

  dispose(): void {
    this.el.remove();
  }
}
