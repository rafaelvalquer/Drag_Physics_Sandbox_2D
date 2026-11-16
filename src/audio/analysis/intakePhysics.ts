/**
 * Physics-driven intake rendering: the real VehicleSimulation supplies load, throttle, manifold
 * pressure and boost, so the intake is measured at the operating points the game actually produces.
 */
import { AF } from '../../core/contracts';
import { CHANNEL_COUNT, carToAcousticConfig } from '../dsp/AcousticConfig';
import { VehicleAcoustics } from '../dsp/VehicleAcoustics';
import type { IntakeRender } from './intakeLab';

const H = 1 / 120;

export interface PhysicsPhase {
  name: string;
  seconds: number;
  pedal: number;
  /** Upshift automatically near the redline (full-throttle runs). */
  autoShift?: boolean;
}

export interface PhysicsPhaseResult {
  name: string;
  render: IntakeRender;
  rpm: number;
  load: number;
  throttle: number;
  manifoldPa: number;
  boostPa: number;
}

export const DEFAULT_PHYSICS_PHASES: PhysicsPhase[] = [
  { name: 'idle', seconds: 2, pedal: 0 },
  { name: 'rev', seconds: 1.6, pedal: 1 },
  { name: 'rev-half', seconds: 1.6, pedal: 0.4 },
  { name: 'lift', seconds: 1.5, pedal: 0 },
  { name: 'launch', seconds: 2.5, pedal: 1 },
  { name: 'run', seconds: 5, pedal: 1, autoShift: true },
  { name: 'coast', seconds: 2, pedal: 0 },
];

/** The subset of VehicleSimulation the renderer needs. */
export interface SimLike {
  step(h: number): void;
  audioFrame: ArrayLike<number>;
  controls: { pedal: number };
  requestShift(d: number): void;
  engine: { rpm: number };
  shift: { active: boolean };
  clutchCtl: { mode: string };
  gear: number;
}

export function renderIntakePhysics(
  car: Parameters<typeof carToAcousticConfig>[0],
  sim: SimLike,
  fs: number,
  phases: PhysicsPhase[] = DEFAULT_PHYSICS_PHASES,
  quality: 'high' | 'low' = 'high',
  startupS = 3,
): PhysicsPhaseResult[] {
  const voice = new VehicleAcoustics(fs, carToAcousticConfig(car, quality, 1));
  const ch = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(fs * H) + 2));
  const total = Math.round((phases.reduce((s, p) => s + p.seconds, 0) + startupS) * fs) + 4096;
  const o = { tone: new Float32Array(total), hiss: new Float32Array(total), roar: new Float32Array(total), combined: new Float32Array(total), normalized: new Float32Array(total), final: new Float32Array(total) };
  let w = 0;
  voice.intakeTap = (t, h, r, c, nrm, y) => {
    if (w < total) {
      o.tone[w] = t;
      o.hiss[w] = h;
      o.roar[w] = r;
      o.combined[w] = c;
      o.normalized[w] = nrm;
      o.final[w] = y;
    }
    w++;
  };
  let acc = 0;
  const redline = car.engine.redlineRpm;
  type Stats = { n: number; load: number; thr: number; man: number; boost: number; rpm: number };
  const run = (seconds: number, pedal: number, autoShift: boolean, stats?: Stats): void => {
    const n = Math.round(seconds / H);
    for (let i = 0; i < n; i++) {
      sim.controls.pedal = pedal;
      if (autoShift && !sim.shift.active && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm > redline - 300 && sim.gear < 4) sim.requestShift(1);
      sim.step(H);
      voice.pushFrame(sim.audioFrame);
      if (stats) {
        const a = sim.audioFrame;
        stats.n++;
        stats.load += a[AF.load]!;
        stats.thr += a[AF.throttle]!;
        stats.man += a[AF.manifoldPressure]!;
        stats.boost += a[AF.boostPressure]!;
        stats.rpm += (a[AF.omega]! * 60) / (2 * Math.PI);
      }
      acc += fs * H;
      const m = Math.floor(acc);
      acc -= m;
      if (m > 0) voice.render(ch, m);
    }
  };
  run(startupS, 0, false);
  const out: PhysicsPhaseResult[] = [];
  for (const p of phases) {
    const s0 = w;
    const st: Stats = { n: 0, load: 0, thr: 0, man: 0, boost: 0, rpm: 0 };
    run(p.seconds, p.pedal, p.autoShift === true, st);
    const s1 = Math.min(w, total);
    // skip the first 0.25 s of each phase so steady metrics are not dominated by the transient
    const a = Math.min(s1, s0 + Math.round(0.25 * fs));
    const sl = (x: Float32Array): Float32Array => x.subarray(a, s1);
    const n = Math.max(1, st.n);
    out.push({
      name: p.name,
      render: { tone: sl(o.tone), hiss: sl(o.hiss), roar: sl(o.roar), combined: sl(o.combined), normalized: sl(o.normalized), final: sl(o.final), voice },
      rpm: st.rpm / n,
      load: st.load / n,
      throttle: st.thr / n,
      manifoldPa: st.man / n,
      boostPa: st.boost / n,
    });
  }
  return out;
}
