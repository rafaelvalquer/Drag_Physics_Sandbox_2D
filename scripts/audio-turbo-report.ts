/**
 * Turbo Acoustics 2.0 — before/after report of the representative builds.
 *
 * For every build the real VehicleSimulation drives the voice through the same drive (launch, run
 * through the gears, tip-out under boost, re-open, lift) twice: with the legacy turbo model ("before")
 * and with Turbo Acoustics 2.0 ("after"). Writes:
 *  - docs/audio-turbo/{before,after}/<build>-turbo.wav    isolated turbo channel (same gain per build
 *    in before and after, so the A/B keeps the real level difference — no per-file normalization);
 *  - docs/audio-turbo/{before,after}/<build>-vehicle.wav  full vehicle mix (DEFAULT_MIX), selected builds;
 *  - docs/audio-turbo/spectrograms/<build>-{before,after}.png  turbo channel spectrograms;
 *  - docs/audio-turbo/after/report.json  per-phase metrics, events and render cost;
 *  - docs/audio-turbo/spectral-report.md and calibration-matrix.md (generated tables).
 *
 *   npx tsx scripts/audio-turbo-report.ts [--car=id,id] [--rate=32000] [--no-wav]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { encodeWavMono } from '../src/audio/core/wav';
import { CH, CHANNELS, CHANNEL_COUNT, carToAcousticConfig } from '../src/audio/dsp/AcousticConfig';
import { DEFAULT_MIX } from '../src/audio/core/VehicleSound';
import { VehicleAcoustics } from '../src/audio/dsp/VehicleAcoustics';
import { turboProfileOf } from '../src/audio/dsp/turbo/TurboAcoustics';
import { magnitudeSpectrum } from '../src/audio/analysis/spectrum';
import { H, mixChannels, turboMetrics, type TurboMetrics } from '../src/audio/analysis/turboLab';
import { renderTurboPhysics, TURBO_DRIVE_PHASES, type PhysicsTurboRender } from '../src/audio/analysis/turboPhysics';
import { referenceTurboBuilds, type TurboBuild } from '../src/audio/analysis/turboBuilds';
import { VehicleSimulation } from '../src/physics/vehicle/VehicleSimulation';
import { TRACKS } from '../src/data/tracks/index';

const args = process.argv.slice(2);
const opt = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const RATE = Number(opt('rate') ?? 32000);
const WAV = !args.includes('--no-wav');
const OUT = 'docs/audio-turbo';
export const REPORT_CARS = ['vw-gol-gts-1988', 'vw-saveiro-gl-1994', 'bmw-320i-f30-2014', 'mitsubishi-evo-x-2012', 'honda-civic-si-2008', 'nissan-370z-2014', 'nissan-gtr-r35-2015'];
const VEHICLE_WAV = new Set(['vw-gol-gts-1988', 'nissan-gtr-r35-2015']);
const cars = opt('car')?.split(',') ?? REPORT_CARS;
const fullMix = CHANNELS.map((c) => DEFAULT_MIX[c]);
type Model = 'legacy' | 'v2';

// ------------------------------------------------------------------ PNG spectrogram

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const v of b) c = CRC[(c ^ v) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
}
/** Perceptually ordered dark→bright ramp (black, indigo, magenta, orange, pale yellow). */
function ramp(t: number): [number, number, number] {
  const stops: [number, number, number][] = [[0, 0, 4], [40, 11, 84], [136, 34, 106], [212, 72, 66], [250, 147, 24], [252, 255, 164]];
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f].map(Math.round) as [number, number, number];
}
const SPEC_N = 2048;
/** Loudest spectral bin (dB) of a signal: the shared top of the before/after colour scale. */
function spectralMaxDb(x: Float32Array, fs: number): number {
  const hop = Math.round(fs * 0.025);
  let m = 1e-12;
  for (let c = 0; c * hop + SPEC_N < x.length; c++) for (const v of magnitudeSpectrum(x, SPEC_N, c * hop)) m = Math.max(m, v);
  return 20 * Math.log10(m);
}
/** Linear-frequency spectrogram 0..fs/2, 80 dB range, the same absolute scale for before and after. */
function spectrogram(x: Float32Array, fs: number, refDb: number): Buffer {
  const n = SPEC_N;
  const hop = Math.round(fs * 0.025);
  const cols = Math.max(1, Math.floor((x.length - n) / hop));
  const rows = 320;
  const rgb = new Uint8Array(cols * rows * 3);
  for (let c = 0; c < cols; c++) {
    const s = magnitudeSpectrum(x, n, c * hop);
    for (let r = 0; r < rows; r++) {
      const lo = Math.floor((r / rows) * (n / 2));
      const hi = Math.max(lo + 1, Math.floor(((r + 1) / rows) * (n / 2)));
      let m = 0;
      for (let k = lo; k < hi; k++) m = Math.max(m, s[k]!);
      const db = 20 * Math.log10(m + 1e-12);
      const [R, G, B] = ramp(Math.pow(Math.max(0, (db - (refDb - 80)) / 80), 0.8));
      const o = ((rows - 1 - r) * cols + c) * 3;
      rgb[o] = R;
      rgb[o + 1] = G;
      rgb[o + 2] = B;
    }
  }
  return png(cols, rows, rgb);
}

// ------------------------------------------------------------------ voice-only render cost

/** Records the audio frames of the drive once, then times the voice alone (legacy vs v2). */
function voiceCost(b: TurboBuild, fs: number): Record<Model, number> {
  const sim = new VehicleSimulation(b.car, TRACKS[0]!);
  const frames: Float64Array[] = [];
  const redline = b.car.engine.redlineRpm;
  const gears = b.car.transmission.gearRatios.length;
  for (const p of [{ name: 'startup', seconds: 1.5, pedal: 0 }, ...TURBO_DRIVE_PHASES]) {
    if ('engage' in p && p.engage && sim.gear === 0) sim.requestShift(1);
    for (let i = 0; i < Math.round(p.seconds / H); i++) {
      sim.controls.pedal = p.pedal;
      if ('autoShift' in p && p.autoShift && !sim.shift.active && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm > redline - 250 && sim.gear < gears) sim.requestShift(1);
      sim.step(H);
      frames.push(Float64Array.from(sim.audioFrame));
    }
  }
  const out = {} as Record<Model, number>;
  const per = Math.round(fs * H);
  const tmp = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(per + 2));
  const best: Record<Model, number> = { legacy: Infinity, v2: Infinity };
  // interleaved repetitions (legacy, v2, legacy, …) so machine load affects both alike; best of 7
  for (let rep = 0; rep < 7; rep++) {
    for (const model of ['legacy', 'v2'] as Model[]) {
      const voice = new VehicleAcoustics(fs, { ...carToAcousticConfig(b.car, 'high', 1), turboModel: model });
      const t0 = performance.now();
      for (const f of frames) {
        voice.pushFrame(f);
        voice.render(tmp, per);
      }
      best[model] = Math.min(best[model], performance.now() - t0);
    }
  }
  for (const model of ['legacy', 'v2'] as Model[]) out[model] = best[model] / ((frames.length * per) / fs); // ms of CPU per second of audio
  return out;
}

// ------------------------------------------------------------------ report

interface PhaseMetrics { run: TurboMetrics; tipOut: TurboMetrics; reopen: TurboMetrics }
interface Row {
  build: string;
  group: string;
  layout: string;
  bov: string;
  profile?: string;
  maxBoostBar: number;
  maxShaftRpm: number;
  legacy: PhaseMetrics;
  v2: PhaseMetrics;
  bovEvents: number;
  flutterEvents: number;
  costMsPerS: Record<Model, number>;
}

const seg = (r: PhysicsTurboRender, a: string, b?: string): [number, number] => [r.phaseStart[a]!, b ? r.phaseStart[b]! : r.ch[0]!.length];
function phases(r: PhysicsTurboRender): PhaseMetrics {
  const x = r.ch[CH.turbo]!;
  const m = ([s, e]: [number, number]) => turboMetrics(x, r.sampleRate, s, e);
  // the run segment skips the launch transient; the tip-out segment is the BOV / flutter window
  return { run: m(seg(r, 'run', 'tip-out')), tipOut: m(seg(r, 'tip-out', 'reopen')), reopen: m(seg(r, 'reopen', 'lift')) };
}

const rows: Row[] = [];
for (const dir of ['before', 'after', 'spectrograms']) mkdirSync(join(OUT, dir), { recursive: true });
for (const b of referenceTurboBuilds(cars)) {
  const t = b.car.engine.turbo!;
  const name = b.carId;
  const r: Record<Model, PhysicsTurboRender> = {
    legacy: renderTurboPhysics(b.car, RATE, { acoustic: (c) => ({ ...c, turboModel: 'legacy' }) }),
    v2: renderTurboPhysics(b.car, RATE, { acoustic: (c) => ({ ...c, turboModel: 'v2' }) }),
  };
  const turbo = r.v2.voice.aux.turbo!;
  const from = r.v2.phaseStart['launch']!;
  // one gain per build for both models (A/B keeps the real level difference)
  let peak = 1e-9;
  let peakMix = 1e-9;
  const mixes = {} as Record<Model, Float32Array>;
  for (const m of ['legacy', 'v2'] as Model[]) {
    for (const v of r[m].ch[CH.turbo]!.subarray(from)) peak = Math.max(peak, Math.abs(v));
    mixes[m] = mixChannels(r[m].ch, fullMix).subarray(from);
    for (const v of mixes[m]) peakMix = Math.max(peakMix, Math.abs(v));
  }
  const refDb = Math.max(spectralMaxDb(r.legacy.ch[CH.turbo]!.subarray(from), RATE), spectralMaxDb(r.v2.ch[CH.turbo]!.subarray(from), RATE));
  for (const [m, dir] of [['legacy', 'before'], ['v2', 'after']] as [Model, string][]) {
    const x = r[m].ch[CH.turbo]!.subarray(from);
    if (WAV) {
      writeFileSync(join(OUT, dir, `${name}-turbo.wav`), encodeWavMono(x.map((v) => (v * 0.7) / peak), RATE));
      if (VEHICLE_WAV.has(name)) writeFileSync(join(OUT, dir, `${name}-vehicle.wav`), encodeWavMono(mixes[m].map((v) => (v * 0.8) / peakMix), RATE));
    }
    writeFileSync(join(OUT, 'spectrograms', `${name}-${dir}.png`), spectrogram(x, RATE, refDb));
  }
  const row: Row = {
    build: b.id,
    group: b.group,
    layout: t.layout ?? 'single',
    bov: t.bovEnabled ? (t.bovVent ?? 'atmosphere') : 'none',
    profile: turbo.profile.baseId,
    maxBoostBar: r.v2.maxBoostPa / 1e5,
    maxShaftRpm: r.v2.maxShaftRpm,
    legacy: phases(r.legacy),
    v2: phases(r.v2),
    bovEvents: turbo.bov.events,
    flutterEvents: turbo.flutter.events,
    costMsPerS: voiceCost(b, 48000),
  };
  rows.push(row);
  console.log(`${b.id.padEnd(48)} ${row.profile?.padEnd(26)} run dBA ${row.legacy.run.aLevelDb.toFixed(1)} → ${row.v2.run.aLevelDb.toFixed(1)}  TNR ${Math.max(-60, row.legacy.run.tonalToNoiseDb).toFixed(1)} → ${row.v2.run.tonalToNoiseDb.toFixed(1)}  cent ${row.legacy.run.centroidHz.toFixed(0)} → ${row.v2.run.centroidHz.toFixed(0)}  BOV ${row.bovEvents} flutter ${row.flutterEvents}  ms/s ${row.costMsPerS.legacy.toFixed(1)} → ${row.costMsPerS.v2.toFixed(1)}`);
}
writeFileSync(join(OUT, 'after', 'report.json'), JSON.stringify({ rate: RATE, drive: TURBO_DRIVE_PHASES, rows }, null, 1));

// ------------------------------------------------------------------ markdown tables

const f = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '–');
const tnr = (x: number): string => (x < -60 ? "< −60" : f(x));
const hi = (m: TurboMetrics): string => f((m.bands[4] ?? 0) * 100, 0);
let spectral = `# Relatório espectral — Turbo Acoustics 2.0

> Gerado por \`npx tsx scripts/audio-turbo-report.ts\` (${RATE} Hz, qualidade alta, condução física real:
> largada, aceleração com trocas, tip-out sob pressão, reabertura, alívio). Canal turbo isolado.
> "Antes" = modelo legado (mantido idêntico para o A/B); "depois" = Turbo Acoustics 2.0.
> Métricas são objetivas; **não** comprovam fidelidade — ver [listening-validation.md](listening-validation.md).

## Carga plena (fase *run*)

| Build | Perfil 2.0 | Centroide antes → depois (Hz) | Energia > 8 kHz antes → depois (%) | Tonal/ruído antes → depois (dB) | Planicidade antes → depois |
|---|---|---|---|---|---|
`;
for (const r of rows) spectral += `| ${r.build} | ${r.profile} | ${f(r.legacy.run.centroidHz, 0)} → ${f(r.v2.run.centroidHz, 0)} | ${hi(r.legacy.run)} → ${hi(r.v2.run)} | ${tnr(r.legacy.run.tonalToNoiseDb)} → ${tnr(r.v2.run.tonalToNoiseDb)} | ${f(r.legacy.run.flatness, 2)} → ${f(r.v2.run.flatness, 2)} |\n`;
spectral += `
## Tip-out sob pressão (válvula, flutter)

| Build | Válvula | Eventos BOV (2.0) | Eventos de flutter (2.0) | Pico antes → depois | Centroide antes → depois (Hz) |
|---|---|---|---|---|---|
`;
for (const r of rows) spectral += `| ${r.build} | ${r.bov} | ${r.bovEvents} | ${r.flutterEvents} | ${f(r.legacy.tipOut.peak, 3)} → ${f(r.v2.tipOut.peak, 3)} | ${f(r.legacy.tipOut.centroidHz, 0)} → ${f(r.v2.tipOut.centroidHz, 0)} |\n`;
spectral += `
## Espectrogramas

Escala linear 0–${RATE / 2000} kHz, 80 dB, mesma referência absoluta para antes e depois de cada build.

`;
for (const r of rows) {
  const n = r.build.split('/')[0];
  spectral += `### ${r.build}\n\n| Antes (legado) | Depois (2.0) |\n|---|---|\n| ![antes](spectrograms/${n}-before.png) | ![depois](spectrograms/${n}-after.png) |\n\n`;
}
writeFileSync(join(OUT, 'spectral-report.md'), spectral);

let cal = `# Matriz de calibração — nível e custo

> Gerado por \`npx tsx scripts/audio-turbo-report.ts\`. Nível ponderado A (dBA relativos, canal turbo
> isolado antes do mixer). O ganho global \`TURBO_V2_OUTPUT\` alinha o 2.0 ao legado em carga plena nos kits
> e conversões (± 1 dB), para a comparação A/B no Sandbox não favorecer o modelo mais alto. Turbos de fábrica
> (caixa de ar, válvula recirculada) ficam de propósito 4–7 dB abaixo: o legado não fazia essa distinção.
> Custo = ms de CPU por segundo de áudio da voz completa (7 canais, 48 kHz, melhor de 7 intercalado; Node, uma thread).

| Build | Grupo | Layout | Válvula | Boost máx (bar) | Rotor máx (rpm) | dBA run antes → depois | Δ dBA | dBA tip-out antes → depois | Custo antes → depois (ms/s) | Δ custo |
|---|---|---|---|---|---|---|---|---|---|---|
`;
let sumD = 0;
let sumL = 0;
let sumV = 0;
for (const r of rows) {
  const d = r.v2.run.aLevelDb - r.legacy.run.aLevelDb;
  sumD += d;
  sumL += r.costMsPerS.legacy;
  sumV += r.costMsPerS.v2;
  cal += `| ${r.build} | ${r.group} | ${r.layout} | ${r.bov} | ${f(r.maxBoostBar, 2)} | ${f(r.maxShaftRpm, 0)} | ${f(r.legacy.run.aLevelDb)} → ${f(r.v2.run.aLevelDb)} | ${d >= 0 ? '+' : ''}${f(d)} | ${f(r.legacy.tipOut.aLevelDb)} → ${f(r.v2.tipOut.aLevelDb)} | ${f(r.costMsPerS.legacy)} → ${f(r.costMsPerS.v2)} | ${f(((r.costMsPerS.v2 / r.costMsPerS.legacy) - 1) * 100, 0)}% |\n`;
}
cal += `\n**Média:** Δ nível ${f(sumD / rows.length)} dBA; custo ${f(sumL / rows.length)} → ${f(sumV / rows.length)} ms/s (${f(((sumV / sumL) - 1) * 100, 0)}%; meta < 15%).\n`;
writeFileSync(join(OUT, 'calibration-matrix.md'), cal);
console.log(`\nmean Δ dBA ${f(sumD / rows.length)}; cost ${f(sumL / rows.length)} → ${f(sumV / rows.length)} ms/s (${f(((sumV / sumL) - 1) * 100, 0)}%)`);

// ------------------------------------------------------------------ coverage matrix (every turbo build)

let cov = `# Matriz de cobertura — perfis de turbo por veículo

> Gerado por \`npx tsx scripts/audio-turbo-report.ts\`. Um build de referência por carro: turbo de fábrica
> (stock), preset turbo do Sandbox, kit clássico médio ou conversão estágio 2 da oficina. Cada linha mostra o
> perfil base resolvido e a cadeia de modificadores aplicada pelo \`TurboProfileResolver\`.

| Build | Grupo | Rotores | Carcaça | Válvula | Wastegate | Admissão | Perfil base | Cadeia |
|---|---|---|---|---|---|---|---|---|
`;
for (const b of referenceTurboBuilds()) {
  const p = turboProfileOf(carToAcousticConfig(b.car, 'high', 1));
  if (!p) continue;
  cov += `| ${b.id} | ${b.group} | ${p.twin ? 2 : 1} | ${p.housing} | ${p.ventType} | ${p.wastegateType} | ${p.intakePath} | ${p.baseId} | ${p.chain.join(' → ')} |\n`;
}
writeFileSync(join(OUT, 'coverage-matrix.md'), cov);
