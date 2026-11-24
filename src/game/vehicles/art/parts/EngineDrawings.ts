import type { CarConfig } from '../../../../data/schema';

/**
 * Small library of engine drawings by architecture and cylinder count: in-line, V and boxer.
 * Two views: an end view (banks, cylinders per bank, manifolds and turbochargers: what the player
 * needs to understand the layout) and a side outline (block, head and cylinder tops) for the car.
 * They are illustrations: no number shown here comes from the drawing.
 */
export type EngineShape = 'inline' | 'v' | 'boxer';

export interface EngineSpec {
  shape: EngineShape;
  cylinders: number;
  /** Cylinders in each bank (in-line: all of them in one). */
  perBank: number;
  banks: 1 | 2;
  bankAngleDeg: number;
  /** Turbochargers drawn (0 = naturally aspirated). */
  turbos: number;
  label: string;
}

export function engineSpecOf(car: Pick<CarConfig, 'engine'>): EngineSpec {
  const e = car.engine;
  const n = e.cylinders;
  const flat = e.bankAngleDeg >= 170;
  const v = e.architecture === 'V6' || e.architecture === 'V8' || e.architecture === 'V12' || e.bankAngleDeg > 5;
  const banks: 1 | 2 = v ? 2 : 1;
  const shape: EngineShape = banks === 1 ? 'inline' : flat ? 'boxer' : 'v';
  const turbos = e.induction === 'turbo' && e.turbo ? (e.turbo.layout === 'parallel-twin' ? 2 : 1) : 0;
  const label = shape === 'inline' ? `${n} cilindros em linha` : shape === 'boxer' ? `${n} cilindros opostos (boxer)` : `V${n}: duas bancadas de ${n / 2} cilindros`;
  return { shape, cylinders: n, perBank: banks === 2 ? Math.ceil(n / 2) : n, banks, bankAngleDeg: e.bankAngleDeg, turbos, label };
}

const STROKE = '#9aa6b6';
const BLOCK = '#3a4350';
const HEAD = '#566273';
const GOLD = '#c9a24d';

function cyl(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number, fill: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = fill;
  c.strokeStyle = STROKE;
  c.lineWidth = 1.4;
  c.beginPath();
  c.roundRect(-w / 2, -h, w, h, 2);
  c.fill();
  c.stroke();
  c.restore();
}

function turbo(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = '#5b4a2a';
  c.strokeStyle = GOLD;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#2a2113';
  c.beginPath();
  c.arc(x, y, r * 0.5, 0, Math.PI * 2);
  c.fill();
}

/**
 * End view of the engine in a box of (w, h) centred on (cx, cy): the banks, a cylinder per piston,
 * the exhaust manifold of each bank and the turbochargers (one per bank on a twin layout).
 */
export function drawEngineEndView(c: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, s: EngineSpec, highlight = false): void {
  c.save();
  c.translate(cx, cy);
  const u = Math.min(w, h);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (highlight) {
    c.shadowColor = '#ffcf8a';
    c.shadowBlur = 14;
  }
  const ang = (s.bankAngleDeg * Math.PI) / 180;
  // crankcase
  c.fillStyle = BLOCK;
  c.strokeStyle = STROKE;
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(-u * 0.32, u * 0.05, u * 0.64, u * 0.3, 8);
  c.fill();
  c.stroke();
  const cw = u * 0.15;
  const ch = u * 0.34;
  if (s.banks === 1) {
    cyl(c, 0, u * 0.08, cw, ch, 0, HEAD);
    c.fillStyle = HEAD;
    c.fillRect(-cw * 0.6, -u * 0.3, cw * 1.2, u * 0.06);
    // intake on one side, exhaust manifold on the other
    c.strokeStyle = '#6ab4ff';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-cw * 0.8, -u * 0.26);
    c.lineTo(-u * 0.34, -u * 0.26);
    c.stroke();
    c.strokeStyle = '#8a94a2';
    c.beginPath();
    c.moveTo(cw * 0.8, -u * 0.2);
    c.lineTo(u * 0.3, -u * 0.12);
    c.stroke();
    if (s.turbos) turbo(c, u * 0.38, -u * 0.08, u * 0.1);
  } else {
    const half = s.shape === 'boxer' ? Math.PI / 2 : ang / 2;
    for (const side of [-1, 1] as const) {
      const a = side * half;
      cyl(c, side * u * (s.shape === 'boxer' ? 0.14 : 0.05), u * 0.08, cw, ch, a, HEAD);
      // manifold on the outside of the bank, turbo hung below it
      const mx = side * u * (s.shape === 'boxer' ? 0.46 : 0.3);
      c.strokeStyle = '#8a94a2';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(side * u * (s.shape === 'boxer' ? 0.34 : 0.22), s.shape === 'boxer' ? u * 0.12 : -u * 0.18);
      c.lineTo(mx, s.shape === 'boxer' ? u * 0.24 : -u * 0.02);
      c.stroke();
      if (s.turbos >= 2 || (s.turbos === 1 && side === 1)) turbo(c, mx, s.shape === 'boxer' ? u * 0.3 : u * 0.1, u * (s.turbos >= 2 ? 0.075 : 0.1));
    }
    if (s.shape === 'v') {
      // shared intake plenum in the V
      c.fillStyle = '#2f4a63';
      c.strokeStyle = '#6ab4ff';
      c.lineWidth = 1.6;
      c.beginPath();
      c.roundRect(-u * 0.08, -u * 0.12, u * 0.16, u * 0.08, 3);
      c.fill();
      c.stroke();
    }
  }
  c.restore();
}

/**
 * Side outline of the engine for the technical view of the car: block, head and `perBank` cylinder
 * tops along the car (V and boxer engines show one bank's worth; the other hides behind it).
 */
export function drawEngineSide(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: EngineSpec, stroke: string, highlight: boolean): void {
  c.save();
  if (highlight) {
    c.shadowColor = '#ffcf8a';
    c.shadowBlur = 16;
  }
  c.fillStyle = BLOCK;
  c.strokeStyle = stroke;
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(x, y + h * 0.2, w, h * 0.8, 8);
  c.fill();
  c.stroke();
  const n = s.perBank;
  const pad = w * 0.06;
  const cw = (w - pad * 2) / n;
  for (let i = 0; i < n; i++) {
    c.fillStyle = HEAD;
    c.strokeStyle = HEAD;
    c.lineWidth = 1;
    c.beginPath();
    c.roundRect(x + pad + i * cw + cw * 0.12, y, cw * 0.76, h * 0.24, 2);
    c.fill();
    c.stroke();
  }
  if (s.banks === 2) {
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.font = `600 ${Math.max(9, h * 0.22)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText(s.shape === 'boxer' ? 'boxer' : `V${s.cylinders}`, x + w / 2, y + h * 0.68);
  }
  c.restore();
}
