/**
 * Acoustic calibration report of the eight Chapter 3 engines.
 *
 * Drives the real physics (VehicleSimulation + the same DragAI the races use) through idle, a free
 * rev, a full-throttle 402 m run and a coast, renders all seven channels at 44.1 and 48 kHz in high
 * and low quality and reports, per car:
 *  - per-channel RMS / peak, clipped samples, non-finite resets, click detector (max step / RMS);
 *  - spectral balance of the mix (bands <300 / 300–1500 / 1500–4000 / >4000 Hz, centroid);
 *  - firing-order check at a steady 3000 rpm: energy of the firing order vs. the half orders
 *    (an even-firing inline engine has no half orders; this is what tells the N55 I6 from a V6);
 *  - hiss check: share of the mix above 4 kHz at WOT (static-like noise shows as a high share);
 *  - turbo blow-off on lift: peak of the turbo channel relative to the WOT exhaust;
 *  - switchable cam (K20Z3 i-VTEC): number of switchings, spectral centroid of the exhaust just
 *    below and just above the switch, and the largest level step across the crossover window.
 *
 * "before" renders the engine with the generic V6 acoustic baseline (default gains, stock
 * exhaust preset, no cam switching); "after" is the per-car calibrated configuration.
 *
 *   npx tsx scripts/audio-chapter3.ts [carId|all] [--wav <dir>] [--report <file>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHAPTER3_CARS } from '../src/data/cars/chapter3/index';
import { modernAcoustic, modernStockExhaust } from '../src/data/cars/chapter2/shared';
import type { CarConfig } from '../src/data/schema';
import { TRACKS } from '../src/data/tracks/index';
import { VehicleSimulation } from '../src/physics/vehicle/VehicleSimulation';
import { DragAI } from '../src/game/ai/DragAI';
import { CHANNELS, CHANNEL_COUNT, carToAcousticConfig, type AcousticQuality } from '../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../src/audio/dsp/VehicleAcoustics';
import { encodeWavMono } from '../src/audio/core/wav';
import { analyzeSignal, dB } from '../src/audio/analysis/noiseLab';
import { averagedSpectrum, bandEnergy } from '../src/audio/analysis/spectrum';

const H = 1 / 120;
const args = process.argv.slice(2);
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const opt = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const wavDir = opt('--wav');
const reportFile = opt('--report');
const MIX = [0.8, 0.6, 1, 0.7, 0.8, 0.6, 0.5];
const TRACK = TRACKS.find((t) => t.id === 'test-track') ?? TRACKS[0]!;

/** Generic acoustic baseline every Chapter 3 car started from (the "before" of the report). */
export function baselineCar(car: CarConfig): CarConfig {
  const c = structuredClone(car);
  c.acoustic = modernAcoustic({ turboGain: car.engine.induction === 'turbo' ? 0.8 : 0 });
  c.exhaust = modernStockExhaust({ layout: 'single', headerLengthM: 0.3, headerDiameterMm: 40 });
  delete c.engine.variableCam;
  return c;
}

interface Phase {
  name: string;
  start: number;
  end: number;
  rpm: number;
}

interface Render {
  ch: Float32Array[];
  mix: Float32Array;
  phases: Phase[];
  voice: VehicleAcoustics;
  sampleRate: number;
  camTrace: { sample: number; blend: number; rpm: number }[];
}

function render(car: CarConfig, sampleRate: number, quality: AcousticQuality): Render {
  const sim = new VehicleSimulation(car, TRACK);
  const voice = new VehicleAcoustics(sampleRate, carToAcousticConfig(car, quality, 1));
  const ai = new DragAI(car, 'advanced', 7);
  const perStep = sampleRate * H;
  let acc = 0;
  const bufs = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(perStep) + 2));
  const out: number[][] = Array.from({ length: CHANNEL_COUNT }, () => []);
  const phases: Phase[] = [];
  const camTrace: Render['camTrace'] = [];
  const stepAudio = (): void => {
    voice.pushFrame(sim.audioFrame);
    acc += perStep;
    const m = Math.floor(acc);
    acc -= m;
    voice.render(bufs, m);
    for (let k = 0; k < CHANNEL_COUNT; k++) for (let j = 0; j < m; j++) out[k]!.push(bufs[k]![j]!);
    camTrace.push({ sample: out[0]!.length, blend: voice.engine.camBlend, rpm: sim.engine.rpm });
  };
  const phase = (name: string, seconds: number, ctl: (t: number) => void): void => {
    const start = out[0]!.length;
    const n = Math.round(seconds / H);
    for (let i = 0; i < n; i++) {
      ctl(i * H);
      sim.step(H);
      stepAudio();
    }
    phases.push({ name, start, end: out[0]!.length, rpm: sim.engine.rpm });
  };
  phase('start', 2.5, () => (sim.controls.pedal = 0));
  phase('idle', 2, () => (sim.controls.pedal = 0));
  // steady 3000 rpm in neutral (firing-order analysis): simple throttle governor
  phase('hold3000', 2.5, () => {
    const e = 3000 - sim.engine.rpm;
    sim.controls.pedal = Math.min(1, Math.max(0, 0.12 + e * 0.0004));
  });
  phase('lift', 1.2, () => (sim.controls.pedal = 0));
  // free rev to the limiter and back (blow-off / cam switching in neutral)
  phase('rev', 1.6, () => (sim.controls.pedal = 1));
  phase('lift2', 1.5, () => (sim.controls.pedal = 0));
  // launch and run with the race AI (same controls the player has)
  let g0 = -1;
  let x0 = Number.NaN;
  phase('stage', 2.5, () => ai.update(H, sim, { timeSinceGreen: null, staged: true, finished: false }));
  phase('run', 11, (t) => {
    if (g0 < 0) {
      g0 = sim.simTime - t;
      x0 = sim.x;
    }
    ai.update(H, sim, { timeSinceGreen: sim.simTime - g0, staged: true, finished: sim.x - x0 >= 402 });
    if (sim.x - x0 >= 402) sim.controls.pedal = 0;
  });
  phase('coast', 2, () => (sim.controls.pedal = 0));
  const ch = out.map((a) => Float32Array.from(a));
  const mix = new Float32Array(ch[0]!.length);
  for (let i = 0; i < mix.length; i++) {
    let s = 0;
    for (let k = 0; k < CHANNEL_COUNT; k++) s += MIX[k]! * ch[k]![i]!;
    mix[i] = s * 0.35;
  }
  return { ch, mix, phases, voice, sampleRate, camTrace };
}

const slice = (x: Float32Array, p: Phase): Float32Array => x.subarray(p.start, p.end);

/** Energy of the firing order vs. the half orders (rev-frequency multiples k+0.5) at a held speed. */
function orderAnalysis(x: Float32Array, sampleRate: number, rpm: number, cylinders: number): { firingDb: number; halfOrderDb: number } {
  const n = 16384;
  const spec = averagedSpectrum(x, n);
  const f1 = rpm / 60;
  const firing = (cylinders / 2) * f1;
  const bw = Math.max(4, f1 * 0.08);
  let fire = 0;
  for (let h = 1; h <= 3; h++) fire += bandEnergy(spec, sampleRate, n, firing * h, bw);
  let half = 0;
  for (let k = 0; k < 6; k++) half += bandEnergy(spec, sampleRate, n, f1 * (k + 0.5), bw);
  return { firingDb: dB(Math.sqrt(fire)), halfOrderDb: dB(Math.sqrt(half)) };
}

function camReport(r: Render): string {
  const switches = r.voice.engine.camSwitches;
  if (switches === 0) return 'sem troca de came';
  // first engagement during the run
  const run = r.phases.find((p) => p.name === 'run')!;
  const idx = r.camTrace.findIndex((c) => c.sample > run.start && c.blend >= 0.5);
  if (idx < 0) return `${switches} trocas (nenhuma durante a corrida)`;
  const at = r.camTrace[idx]!.sample;
  const w = Math.round(r.sampleRate * 0.12);
  const ex = r.ch[2]!;
  const before = analyzeSignal(ex.subarray(Math.max(0, at - 3 * w), at - w), r.sampleRate);
  const after = analyzeSignal(ex.subarray(at + w, at + 3 * w), r.sampleRate);
  // level step across the crossover: 10 ms RMS windows, largest change between neighbours
  const win = Math.round(r.sampleRate * 0.01);
  let maxStepDb = 0;
  let prev = -1;
  for (let s = at - w; s + win < at + w; s += win) {
    let e = 0;
    for (let j = 0; j < win; j++) e += ex[s + j]! ** 2;
    const lv = dB(Math.sqrt(e / win));
    if (prev > -1e9 && prev !== -1) maxStepDb = Math.max(maxStepDb, Math.abs(lv - prev));
    prev = lv;
  }
  return `${switches} trocas; na corrida a ${r.camTrace[idx]!.rpm.toFixed(0)} rpm: centroide escape ${before.centroidHz.toFixed(0)} → ${after.centroidHz.toFixed(0)} Hz, nível ${dB(before.rms).toFixed(1)} → ${dB(after.rms).toFixed(1)} dB, maior passo em 10 ms ${maxStepDb.toFixed(1)} dB`;
}

const lines: string[] = [];
const log = (s: string): void => {
  console.log(s);
  lines.push(s);
};

log(`# Relatório acústico — Capítulo 2 (gerado por scripts/audio-chapter3.ts)`);
log('');
for (const car of CHAPTER3_CARS) {
  if (which !== 'all' && car.id !== which) continue;
  log(`## ${car.name} (${car.engine.name}, ${car.engine.cylinders} cil.)`);
  for (const [label, cfg] of [
    ['antes', baselineCar(car)],
    ['depois', car],
  ] as const) {
    for (const fs of [44100, 48000]) {
      for (const q of ['high', 'low'] as const) {
        if (label === 'antes' && (fs !== 48000 || q !== 'high')) continue;
        const t0 = performance.now();
        const r = render(cfg, fs, q);
        const cpu = (performance.now() - t0) / 1000;
        const audioS = r.mix.length / fs;
        const all = analyzeSignal(r.mix, fs);
        const run = r.phases.find((p) => p.name === 'run')!;
        const wot = analyzeSignal(slice(r.mix, run), fs);
        const hold = r.phases.find((p) => p.name === 'hold3000')!;
        const order = orderAnalysis(slice(r.ch[2]!, { ...hold, start: hold.start + Math.round(fs * 0.8) }), fs, hold.rpm, car.engine.cylinders);
        const lift2 = r.phases.find((p) => p.name === 'lift2')!;
        const turboPeak = analyzeSignal(slice(r.ch[3]!, lift2), fs).peak;
        const exWot = analyzeSignal(slice(r.ch[2]!, run), fs);
        const tuWot = analyzeSignal(slice(r.ch[3]!, run), fs);
        const chans = CHANNELS.map((c, k) => {
          const m = analyzeSignal(slice(r.ch[k]!, run), fs);
          return `${c} ${m.rms.toFixed(3)}/${m.peak.toFixed(2)}`;
        }).join(' · ');
        log(
          `- **${label}** ${fs} Hz ${q}: CPU ${((cpu / audioS) * 100).toFixed(1)} % do tempo real, nanResets ${r.voice.nanResets}, clip ${all.clipped}, clique máx ${wot.maxJumpRatio.toFixed(1)}`,
        );
        log(`  - WOT: bandas ${wot.bands.map((b) => (b * 100).toFixed(0) + '%').join(' / ')}, centroide ${wot.centroidHz.toFixed(0)} Hz, >4 kHz ${(wot.bands[3] * 100).toFixed(1)} %`);
        log(`  - ordens a ${hold.rpm.toFixed(0)} rpm: ordem de ignição ${order.firingDb.toFixed(1)} dB, meias ordens ${order.halfOrderDb.toFixed(1)} dB (Δ ${(order.firingDb - order.halfOrderDb).toFixed(1)} dB)`);
        log(`  - válvula de alívio: pico do canal turbo no alívio ${turboPeak.toFixed(3)} vs. pico sob carga ${tuWot.peak.toFixed(3)} (escape WOT pico ${exWot.peak.toFixed(2)})`);
        log(`  - came: ${camReport(r)}`);
        log(`  - canais na corrida (rms/pico): ${chans}`);
        if (wavDir && q === 'high') {
          mkdirSync(join(wavDir, label === 'antes' ? 'before' : 'after'), { recursive: true });
          const f = join(wavDir, label === 'antes' ? 'before' : 'after', `${car.id}-${fs}.wav`);
          writeFileSync(f, encodeWavMono(r.mix, fs));
        }
      }
    }
  }
  log('');
}
if (reportFile) writeFileSync(reportFile, lines.join('\n') + '\n');
