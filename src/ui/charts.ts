/** Minimal canvas line charts (no dependency). Values are drawn exactly as given – no smoothing. */
export interface Series {
  label: string;
  color: string;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  /** Plot against the right axis. */
  right?: boolean;
  dashed?: boolean;
  /** Draw markers on each point. */
  points?: boolean;
}

export interface ChartOptions {
  xLabel?: string;
  yLabel?: string;
  yRightLabel?: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  title?: string;
  /** Shaded x ranges drawn behind the series (e.g. recommended / risk rpm bands). */
  bands?: { from: number; to: number; color: string; label?: string }[];
  /** Vertical marker lines (e.g. the rev limiter). */
  markers?: { x: number; color: string; label?: string; dashed?: boolean }[];
}

const AXIS = '#3a4450';
const TEXT = '#8d97a3';

/** Resizes the backing store to the CSS size × devicePixelRatio. Returns the 2D context. */
function prepare(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(50, Math.round(canvas.clientWidth * dpr));
  const hgt = Math.max(40, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== hgt) {
    canvas.width = w;
    canvas.height = hgt;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function niceStep(range: number, target: number): number {
  const raw = range / Math.max(1, target);
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

function extent(series: Series[], key: 'x' | 'y', right: boolean | null): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const s of series) {
    if (right !== null && !!s.right !== right) continue;
    const a = s[key];
    for (let i = 0; i < a.length; i++) {
      const v = a[i]!;
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!Number.isFinite(lo)) return [0, 1];
  if (hi - lo < 1e-9) return [lo - 1, hi + 1];
  return [lo, hi];
}

export function drawLineChart(canvas: HTMLCanvasElement, series: Series[], o: ChartOptions = {}): void {
  const ctx = prepare(canvas);
  if (!ctx) return;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  ctx.clearRect(0, 0, W, H);
  const hasRight = series.some((s) => s.right);
  const L = 48;
  const R = hasRight ? 48 : 12;
  const T = o.title ? 22 : 10;
  const B = 26;
  const pw = W - L - R;
  const ph = H - T - B;
  if (pw < 20 || ph < 20) return;
  let [x0, x1] = extent(series, 'x', null);
  if (o.xMin !== undefined) x0 = o.xMin;
  if (o.xMax !== undefined) x1 = o.xMax;
  let [y0, y1] = extent(series, 'y', false);
  if (o.yMin !== undefined) y0 = o.yMin;
  if (o.yMax !== undefined) y1 = o.yMax;
  else y1 += (y1 - y0) * 0.06;
  let [r0, r1] = extent(series, 'y', true);
  if (o.yMin !== undefined && hasRight) r0 = Math.min(r0, 0);
  r1 += (r1 - r0) * 0.06;
  const X = (v: number): number => L + ((v - x0) / (x1 - x0 || 1)) * pw;
  const Y = (v: number): number => T + ph - ((v - y0) / (y1 - y0 || 1)) * ph;
  const YR = (v: number): number => T + ph - ((v - r0) / (r1 - r0 || 1)) * ph;

  ctx.font = '11px ui-monospace, Consolas, monospace';
  ctx.lineWidth = 1;
  ctx.strokeStyle = AXIS;
  ctx.fillStyle = TEXT;
  // grid + ticks
  const xs = niceStep(x1 - x0, Math.max(2, pw / 80));
  ctx.textAlign = 'center';
  for (let v = Math.ceil(x0 / xs) * xs; v <= x1 + 1e-9; v += xs) {
    const px = X(v);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(px, T);
    ctx.lineTo(px, T + ph);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(fmtTick(v, xs), px, T + ph + 14);
  }
  const ys = niceStep(y1 - y0, Math.max(2, ph / 34));
  ctx.textAlign = 'right';
  for (let v = Math.ceil(y0 / ys) * ys; v <= y1 + 1e-9; v += ys) {
    const py = Y(v);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(L, py);
    ctx.lineTo(L + pw, py);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(fmtTick(v, ys), L - 5, py + 4);
  }
  if (hasRight) {
    const rs = niceStep(r1 - r0, Math.max(2, ph / 34));
    ctx.textAlign = 'left';
    for (let v = Math.ceil(r0 / rs) * rs; v <= r1 + 1e-9; v += rs) ctx.fillText(fmtTick(v, rs), L + pw + 5, YR(v) + 4);
  }
  ctx.strokeStyle = AXIS;
  ctx.strokeRect(L, T, pw, ph);
  if (o.title) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9d1da';
    ctx.fillText(o.title, L, 14);
  }
  if (o.xLabel) {
    ctx.textAlign = 'right';
    ctx.fillStyle = TEXT;
    ctx.fillText(o.xLabel, L + pw, H - 2);
  }
  // series
  ctx.save();
  ctx.beginPath();
  ctx.rect(L, T, pw, ph);
  ctx.clip();
  for (const b of o.bands ?? []) {
    const a = X(Math.max(x0, b.from));
    const z = X(Math.min(x1, b.to));
    if (z <= a) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(a, T, z - a, ph);
    if (b.label) {
      ctx.fillStyle = '#c9d1da';
      ctx.globalAlpha = 0.8;
      ctx.textAlign = 'left';
      ctx.fillText(b.label, a + 3, T + ph - 6);
      ctx.globalAlpha = 1;
    }
  }
  for (const m of o.markers ?? []) {
    const px = X(m.x);
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(m.dashed ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(px, T);
    ctx.lineTo(px, T + ph);
    ctx.stroke();
    ctx.setLineDash([]);
    if (m.label) {
      ctx.fillStyle = m.color;
      ctx.textAlign = 'right';
      ctx.fillText(m.label, px - 3, T + 30);
    }
  }
  for (const s of series) {
    const yf = s.right ? YR : Y;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash(s.dashed ? [5, 4] : []);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < s.x.length; i++) {
      const vx = s.x[i]!;
      const vy = s.y[i]!;
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(X(vx), yf(vy));
      else ctx.moveTo(X(vx), yf(vy));
      pen = true;
    }
    ctx.stroke();
    if (s.points) {
      ctx.fillStyle = s.color;
      for (let i = 0; i < s.x.length; i++) ctx.fillRect(X(s.x[i]!) - 2, yf(s.y[i]!) - 2, 4, 4);
    }
  }
  ctx.restore();
  ctx.setLineDash([]);
  // legend (wraps to further lines inside the plot area)
  ctx.textAlign = 'left';
  let lx = L + 6;
  let ly = T + 6;
  for (const s of series) {
    const label = s.label + (s.right ? ' →' : '');
    const w = ctx.measureText(label).width + 28;
    if (lx > L + 6 && lx + w > L + pw) {
      lx = L + 6;
      ly += 14;
    }
    ctx.fillStyle = s.color;
    if (s.dashed) {
      ctx.fillRect(lx, ly, 4, 3);
      ctx.fillRect(lx + 6, ly, 4, 3);
    } else ctx.fillRect(lx, ly, 10, 3);
    ctx.fillStyle = '#c9d1da';
    ctx.fillText(label, lx + 14, ly + 5);
    lx += w;
  }
}

/** Placeholder text in an empty chart canvas. */
export function drawMessage(canvas: HTMLCanvasElement, text: string): void {
  const ctx = prepare(canvas);
  if (!ctx) return;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = TEXT;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, H / 2);
}

function fmtTick(v: number, step: number): string {
  const d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  const s = v.toFixed(d);
  return s === '-0' ? '0' : s;
}

/** Fixed-length ring buffer for live charts. */
export class Ring {
  readonly data: Float64Array;
  private n = 0;
  private head = 0;
  constructor(readonly capacity: number) {
    this.data = new Float64Array(capacity);
  }
  push(v: number): void {
    this.data[this.head] = v;
    this.head = (this.head + 1) % this.capacity;
    if (this.n < this.capacity) this.n++;
  }
  get length(): number {
    return this.n;
  }
  /** Oldest → newest copy. */
  toArray(): Float64Array {
    const out = new Float64Array(this.n);
    const start = (this.head - this.n + this.capacity) % this.capacity;
    for (let i = 0; i < this.n; i++) out[i] = this.data[(start + i) % this.capacity]!;
    return out;
  }
  clear(): void {
    this.n = 0;
    this.head = 0;
  }
}
