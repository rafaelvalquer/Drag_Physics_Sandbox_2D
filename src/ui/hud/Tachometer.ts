/**
 * Analogue tachometer drawn on a canvas. The scale adapts to each engine: its top is the first
 * round thousand above the rev limiter, the red zone starts at that engine's redline and an
 * amber marker shows the best shift point for the current gear. The needle follows the engine
 * speed of the physics through a short visual filter (the value itself is never changed).
 */
export interface TachScale {
  /** Top of the scale (rpm). */
  maxRpm: number;
  redlineRpm: number;
  limitRpm: number;
}

/** Scale for an engine: the next round thousand above the limiter, with a little head-room. */
export function tachScale(redlineRpm: number, limitRpm: number): TachScale {
  const top = Math.max(redlineRpm, limitRpm);
  const maxRpm = Math.max(4000, Math.ceil((top + 300) / 1000) * 1000);
  return { maxRpm, redlineRpm, limitRpm };
}

const A0 = (135 * Math.PI) / 180;
const SWEEP = (270 * Math.PI) / 180;

/** Needle angle (rad, canvas convention) for an engine speed on a scale. */
export function tachAngle(rpm: number, maxRpm: number): number {
  return A0 + SWEEP * Math.min(1, Math.max(0, rpm / maxRpm));
}

export class Tachometer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private face: HTMLCanvasElement | null = null;
  private faceKey = '';
  private shown = 0;
  private readonly px: number;

  constructor(readonly size = 176) {
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
  }

  /** Engine speed currently shown by the needle (after the visual filter). */
  get shownRpm(): number {
    return this.shown;
  }

  private buildFace(scale: TachScale): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.px;
    c.height = this.px;
    const g = c.getContext('2d')!;
    const S = this.px;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.48;
    // bezel and face
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
    g.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
    g.fill();
    // red zone band
    g.lineCap = 'butt';
    g.strokeStyle = '#d32f2f';
    g.lineWidth = R * 0.07;
    g.beginPath();
    g.arc(cx, cy, R * 0.86, tachAngle(scale.redlineRpm, scale.maxRpm), tachAngle(scale.maxRpm, scale.maxRpm));
    g.stroke();
    // ticks and numbers
    const minor = scale.maxRpm <= 7000 ? 250 : 500;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let r = 0; r <= scale.maxRpm + 1; r += minor) {
      const a = tachAngle(r, scale.maxRpm);
      const major = r % 1000 === 0;
      const mid = r % 500 === 0;
      const red = r >= scale.redlineRpm;
      const r0 = R * (major ? 0.72 : mid ? 0.78 : 0.82);
      g.strokeStyle = red ? '#ff6b6b' : major ? '#f1f3f5' : '#8d97a3';
      g.lineWidth = S * (major ? 0.014 : 0.007);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * R * 0.895, cy + Math.sin(a) * R * 0.895);
      g.stroke();
      if (major) {
        g.fillStyle = red ? '#ff8a8a' : '#e6e9ee';
        g.font = `600 ${Math.round(S * 0.085)}px system-ui, sans-serif`;
        g.fillText(String(r / 1000), cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6);
      }
    }
    g.fillStyle = '#7d8792';
    g.font = `${Math.round(S * 0.052)}px system-ui, sans-serif`;
    g.fillText('×1000 rpm', cx, cy - R * 0.3);
    return c;
  }

  /**
   * Draws the gauge. `shiftRpm` is the best shift point of the current gear (null in top gear or
   * neutral), `limiter` lights the needle while the rev limiter is cutting.
   */
  draw(rpm: number, scale: TachScale, shiftRpm: number | null, limiter: boolean, dtS: number): void {
    const key = `${scale.maxRpm}|${scale.redlineRpm}`;
    if (key !== this.faceKey || !this.face) {
      this.face = this.buildFace(scale);
      this.faceKey = key;
    }
    // visual filter only: ~35 ms, fast enough to follow a gear change
    const k = dtS > 0 ? 1 - Math.exp(-dtS / 0.035) : 1;
    this.shown += (rpm - this.shown) * k;
    if (!Number.isFinite(this.shown)) this.shown = 0;
    const g = this.ctx;
    const S = this.px;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.48;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.face, 0, 0);
    const a = tachAngle(this.shown, scale.maxRpm);
    // swept arc
    g.lineCap = 'round';
    g.strokeStyle = limiter ? '#ff5c5c' : this.shown >= scale.redlineRpm ? '#ff8a3c' : '#f2b705';
    g.globalAlpha = 0.9;
    g.lineWidth = R * 0.035;
    g.beginPath();
    g.arc(cx, cy, R * 0.935, A0, Math.max(A0 + 0.001, a));
    g.stroke();
    g.globalAlpha = 1;
    // shift marker
    if (shiftRpm !== null) {
      const sa = tachAngle(shiftRpm, scale.maxRpm);
      g.fillStyle = '#ffd24a';
      g.beginPath();
      g.moveTo(cx + Math.cos(sa) * R * 0.9, cy + Math.sin(sa) * R * 0.9);
      g.lineTo(cx + Math.cos(sa - 0.05) * R * 0.99, cy + Math.sin(sa - 0.05) * R * 0.99);
      g.lineTo(cx + Math.cos(sa + 0.05) * R * 0.99, cy + Math.sin(sa + 0.05) * R * 0.99);
      g.fill();
    }
    // needle
    g.save();
    g.translate(cx, cy);
    g.rotate(a);
    g.shadowColor = limiter ? 'rgba(255,60,60,0.9)' : 'rgba(255,90,40,0.7)';
    g.shadowBlur = S * 0.04;
    g.fillStyle = limiter ? '#ff5252' : '#ff6a2b';
    g.beginPath();
    g.moveTo(-R * 0.16, -R * 0.022);
    g.lineTo(R * 0.86, -R * 0.007);
    g.lineTo(R * 0.86, R * 0.007);
    g.lineTo(-R * 0.16, R * 0.022);
    g.fill();
    g.restore();
    const hub = g.createRadialGradient(cx - R * 0.03, cy - R * 0.03, 1, cx, cy, R * 0.13);
    hub.addColorStop(0, '#6b727a');
    hub.addColorStop(1, '#15181c');
    g.fillStyle = hub;
    g.beginPath();
    g.arc(cx, cy, R * 0.12, 0, Math.PI * 2);
    g.fill();
  }
}
