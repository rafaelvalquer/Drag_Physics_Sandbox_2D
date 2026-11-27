/** Turbo 2.1: level-matched comparisons, diagnostics, family/rate matrix and WAV stems. */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { AF } from '../src/core/contracts';
import { encodeWavMono } from '../src/audio/core/wav';
import { CH, CHANNELS, carToAcousticConfig, type AcousticQuality } from '../src/audio/dsp/AcousticConfig';
import { DEFAULT_MIX } from '../src/audio/core/VehicleSound';
import { turboProfileOf } from '../src/audio/dsp/turbo/TurboAcoustics';
import { averagedSpectrum, magnitudeSpectrum } from '../src/audio/analysis/spectrum';
import { dB, envelope, mixChannels, renderTurboScenario, rotorDriveMetrics, rotorOrderMetrics, turboMetrics } from '../src/audio/analysis/turboLab';
import { renderTurboPhysics, TURBO_DRIVE_PHASES } from '../src/audio/analysis/turboPhysics';
import { referenceTurboBuilds, turboBuildMatrix, type TurboBuild } from '../src/audio/analysis/turboBuilds';
import { TURBO_LAYER, TURBO_MODELS, TURBO_PROFILE_IDS, type TurboAcousticModel, type TurboDiagnostics } from '../src/audio/dsp/turbo/TurboAcousticTypes';
import { TWIN_ROTOR_GAIN } from '../src/audio/dsp/turbo/TurboAcousticMixer';

const args = process.argv.slice(2);
const opt = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const rates = (opt('rate') ?? '48000,44100,32000').split(',').map(Number);
if (new Set(rates).size !== rates.length || rates.some((rate) => ![48000, 44100, 32000].includes(rate))) {
  throw new Error('Taxas aceitas: 48000, 44100, 32000 Hz, sem repetição');
}
const qualities: AcousticQuality[] = args.includes('--high-only') ? ['high'] : ['high', 'low'];
const WAV = !args.includes('--no-wav');
const OUT = opt('out') ?? 'docs/audio-turbo/v21';
const LISTENING_CARS = ['vw-gol-gts-1988', 'bmw-320i-f30-2014', 'nissan-gtr-r35-2015'];
const only = opt('car')?.split(',');
const fullMix = CHANNELS.map((c) => DEFAULT_MIX[c]);
const MODEL_FILES = { legacy: 'a-legado', v2: 'b-turbo-2', reduced: 'c-harmonicos-reduzidos', hybrid: 'd-rotor-hibrido' };
const DRIVE = [
  ...TURBO_DRIVE_PHASES.slice(0, -1),
  { name: 'partial', seconds: 3, pedal: .42, autoShift: true },
  TURBO_DRIVE_PHASES.at(-1)!,
];
const table = `# Turbo Acoustics 2.1

48 kHz é a taxa de referência. 44,1 kHz repete a análise e 32 kHz é a condição adicional.
Cada comparação usa a mesma condução física. Nos WAVs A/B/C/D o canal turbo é equiparado pela
medida ponderada A da condução. As faixas de rotor isoladas conservam as diferenças de nível
entre si. Os espectrogramas usam a mesma escala de intensidade em cada carro.

| Amostras | Qualidade | Build | Perfil | Nível A/B/C/D (dBA antes de equiparar) | Tonal/ruído A/B/C/D em carga (dB) |
|---|---|---|---|---|---|
`;

async function runRates(): Promise<void> {
  const passthrough = args.filter((arg) => !arg.startsWith('--rate='));
  const primary = rates.includes(48000) ? 48000 : rates[0]!;
  await Promise.all(rates.map((rate) => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', process.argv[1]!, ...passthrough,
      `--rate=${rate}`, '--rate-worker', ...(rate === primary ? ['--primary'] : [])], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Falha ao renderizar ${rate} Hz: código ${code}`)));
  })));
  const rows = rates.map((rate) => {
    const file = join(OUT, `report-${rate}.json`);
    const data = JSON.parse(readFileSync(file, 'utf8')) as { markdownRows: string };
    return data.markdownRows;
  });
  writeFileSync(join(OUT, 'relatorio.md'), table + rows.join(''));
}

if (rates.length > 1) {
  await runRates();
  process.exit(0);
}

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

const profileOf = (b: TurboBuild) => turboProfileOf(carToAcousticConfig(b.car))!;
const builds = referenceTurboBuilds(only);
const variants = turboBuildMatrix(only).builds;
if (!only) {
  for (const id of TURBO_PROFILE_IDS) {
    if (builds.some((b) => profileOf(b).baseId === id)) continue;
    const build = variants.find((b) => profileOf(b).baseId === id);
    if (build) builds.push(build);
  }
}
const exactIds = new Set(referenceTurboBuilds(only).map((b) => b.id));
if (builds.length === 0) throw new Error('Nenhum build turbo encontrado para o relatório');
const coverage = variants.map((b) => {
  const p = profileOf(b);
  return { id: b.id, profile: p.baseId, chain: p.chain, intake: p.intakePath, layout: p.twin ? 'parallel-twin' : 'single', orders: p.reducedOrders, texture: p.texture };
});

const STEMS = ['rotor-1x', 'rotor-2x', 'rotor-3x', 'rotor-bpf', 'rotor-narrowband', 'rotor-hybrid', 'rotor-v2-original'] as const;
const OUT_LEVELS = 'src/audio/dsp/turbo/TurboComparisonLevels.ts';
const levelGroups = new Map<string, number[][]>();
const num = (x: number, n = 1) => Number(x.toFixed(n));
const median = (x: number[]) => x.sort((a, b) => a - b)[Math.floor(x.length / 2)]!;

function saveWav(dir: string, name: string, x: Float32Array, rate: number, gain: number): void {
  writeFileSync(join(dir, `${name}.wav`), encodeWavMono(x.map((v) => v * gain), rate));
}

function renderBuild(b: TurboBuild, rate: number, quality: AcousticQuality, model: TurboAcousticModel, stems?: Float32Array[]) {
  let index = 0;
  return renderTurboPhysics(b.car, rate, {
    quality, phases: DRIVE, acoustic: (c) => ({ ...c, turboModel: model }),
    tap: stems && (({ turbo }) => {
      if (!turbo) return;
      const { rotorA: a, rotorB: b } = turbo;
      const gain = b ? TWIN_ROTOR_GAIN : 1;
      if (model === 'hybrid') {
        stems[0]![index] = gain * (a.out1 + (b?.out1 ?? 0));
        stems[1]![index] = gain * (a.out2 + (b?.out2 ?? 0));
        stems[2]![index] = gain * (a.out3 + (b?.out3 ?? 0));
        stems[3]![index] = gain * (a.outB + (b?.outB ?? 0));
        stems[4]![index] = gain * (a.narrowbandOut + (b?.narrowbandOut ?? 0));
        stems[5]![index] = turbo.rotorOut;
      } else stems[6]![index] = turbo.rotorOut;
      index++;
    }),
  });
}

type Render = ReturnType<typeof renderBuild>;
const analyze = (r: Render, b: TurboBuild, detailed: boolean) => {
  const x = r.ch[CH.turbo]!;
  const from = r.phaseStart.launch!;
  const windows = detailed && rotorDriveMetrics(r, b.car.engine.turbo!.compressorBlades);
  let highestBoost = 0;
  for (let i = 1; i < r.meta.length; i++) if (r.meta[i]!.boostPa > r.meta[highestBoost]!.boostPa) highestBoost = i;
  const peakSample = Math.round(highestBoost * r.sampleRate / 120);
  const half = Math.round(r.sampleRate * .15);
  return {
    launch: turboMetrics(x, r.sampleRate, from, r.phaseStart.run),
    run: turboMetrics(x, r.sampleRate, r.phaseStart.run, r.phaseStart['tip-out']),
    tipOut: turboMetrics(x, r.sampleRate, r.phaseStart['tip-out'], r.phaseStart.reopen),
    partial: turboMetrics(x, r.sampleRate, r.phaseStart.partial, r.phaseStart.lift),
    maxPressure: turboMetrics(x, r.sampleRate, Math.max(0, peakSample - half), Math.min(x.length, peakSample + half)),
    comparison: turboMetrics(x, r.sampleRate, from, r.phaseStart.lift),
    maxBoostPa: r.maxBoostPa,
    maxShaftRpm: r.maxShaftRpm,
    voiceMsPerAudioSecond: r.voiceMsPerAudioSecond,
    ...(windows ? { windows } : {}),
  };
};

function writeComparisons(b: TurboBuild, rate: number, renders: Render[], from: number, levels: number[], stems: Float32Array[]): void {
  const dir = join(OUT, b.carId);
  mkdirSync(dir, { recursive: true });
  const gains = levels.map((db) => 10 ** (db / 20));
  const turbos = renders.map((r, i) => r.ch[CH.turbo]!.subarray(from).map((v) => v * gains[i]!));
  const vehicles = renders.map((r, i) => mixChannels(r.ch, fullMix.map((g, k) => k === CH.turbo ? g * gains[i]! : g)).subarray(from));
  const rawStems = stems.map((x) => x.subarray(from));
  const maxPeak = (signals: Float32Array[]) => {
    let peak = 1e-9;
    for (const x of signals) for (const sample of x) peak = Math.max(peak, Math.abs(sample));
    return peak;
  };
  const turboGain = .82 / maxPeak(turbos);
  const vehicleGain = .82 / maxPeak(vehicles);
  const stemGain = .82 / maxPeak(rawStems);
  const specMax = Math.max(...turbos.map((x) => spectralMaxDb(x, rate)));
  for (const [i, model] of TURBO_MODELS.entries()) {
    const name = MODEL_FILES[model];
    writeFileSync(join(dir, `${name}.png`), spectrogram(turbos[i]!, rate, specMax));
    if (WAV) {
      saveWav(dir, name, turbos[i]!, rate, turboGain);
      saveWav(dir, `${name}-veiculo`, vehicles[i]!, rate, vehicleGain);
    }
  }
  if (!WAV) return;
  for (const [i, name] of STEMS.entries()) saveWav(dir, name, rawStems[i]!, rate, stemGain);
  const installedRotor = renderTurboPhysics(b.car, rate, {
    phases: DRIVE, acoustic: (c) => ({
      ...c, turboModel: 'hybrid', turboLayers: TURBO_LAYER.rotor | TURBO_LAYER.resonance,
    }),
  }).ch[CH.turbo]!.subarray(from);
  saveWav(dir, 'rotor-v21', installedRotor, rate, .82 / maxPeak([installedRotor]));
  saveWav(dir, 'turbo-completo', turbos[3]!, rate, turboGain);
  saveWav(dir, 'veiculo-completo', vehicles[3]!, rate, vehicleGain);
}

function diagnosticCases(b: TurboBuild, rate: number) {
  const base = carToAcousticConfig(b.car);
  const p = profileOf(b);
  const tc = b.car.engine.turbo!;
  const shaftRpm = p.maxShaftRpm * .61;
  const samples = Math.round(1.4 * rate);
  const ordersOff = { order1: 0, order2: 0, order3: 0, bladePass: 0 };
  const dry = { amplitude: 0, exhaustPulse: 0, resonances: p.resonance.map(() => 0) };
  const render = (model: TurboAcousticModel, d: TurboDiagnostics, layers: number, trackRotor = false) => {
    const rotors = new Float32Array(samples);
    let index = 0;
    const r = renderTurboScenario({ ...base, turboModel: model, turboDiagnostics: d, turboLayers: layers }, rate, 'steady', {
      script: { seconds: 1.4, at: () => ({ rpm: base.engine.redlineRpm * .78, throttle: 1 }) },
      mutate: (f, _t) => {
        f[AF.turboShaftRpm] = shaftRpm;
        f[AF.turboShaftRpm2] = p.twin ? shaftRpm * .985 : 0;
        f[AF.boostPressure] = tc.maxBoostBar * .80 * 1e5;
        f[AF.bovFlow] = 0;
      },
      tap: trackRotor ? ({ turbo }) => {
        if (turbo?.rotorB) rotors[index++] = (turbo.rotorA.out1 + turbo.rotorB.out1) * TWIN_ROTOR_GAIN;
      } : undefined,
    });
    const x = r.ch[CH.turbo]!.subarray(Math.round(.4 * rate));
    const n = 8192;
    const spec = averagedSpectrum(x, n);
    const beats = trackRotor && p.twin ? (() => {
      const hop = .0025;
      const env = envelope(rotors, rate, hop, Math.round(.4 * rate));
      const mean = env.reduce((sum, x) => sum + x, 0) / env.length;
      const n = 512;
      const spectrum = magnitudeSpectrum(env.map((v) => v - mean), n);
      const expectedHz = shaftRpm * .015 / 60;
      const binHz = 1 / (hop * n);
      const center = Math.round(expectedHz / binHz);
      const peak = Math.max(...spectrum.subarray(center - 1, center + 2));
      const adjacent = [...spectrum.subarray(center - 12, center - 3), ...spectrum.subarray(center + 4, center + 13)];
      return { expectedHz, measuredHz: spectrum.indexOf(peak) * binHz, relativeDepthDb: dB(peak / mean), prominenceDb: dB(peak / median(adjacent)) };
    })() : undefined;
    return { ...turboMetrics(x, rate), orders: rotorOrderMetrics(spec, rate / n, shaftRpm / 60, p.blades), ...(beats ? { beats } : {}) };
  };
  const rotor = TURBO_LAYER.rotor;
  const duct = rotor | TURBO_LAYER.resonance;
  return {
    turbo20: render('v2', {}, duct, true),
    reduced: render('reduced', {}, duct, true),
    hybrid: render('hybrid', {}, duct, true),
    noThird: render('reduced', { order3: 0 }, duct),
    noModulation: render('hybrid', dry, rotor),
    periodicReduced: render('hybrid', { ...dry, exhaustPulse: 1 }, rotor),
    periodicOff: render('hybrid', { ...dry, amplitude: 1 }, rotor),
    combinedModulation: render('hybrid', { ...dry, amplitude: 1, exhaustPulse: 1 }, rotor),
    toneHeavy: render('hybrid', { ...dry, texture: { coherentToneMix: .86, narrowbandNoiseMix: .49 } }, rotor),
    textureHeavy: render('hybrid', { ...dry, texture: { coherentToneMix: .35, narrowbandNoiseMix: .94 } }, rotor),
    order1: render('v2', { ...dry, ...ordersOff, order1: 1 }, rotor),
    order2: render('v2', { ...dry, ...ordersOff, order2: 1 }, rotor),
    order3: render('v2', { ...dry, ...ordersOff, order3: 1 }, rotor),
    bladePass: render('v2', { ...dry, ...ordersOff, bladePass: 1 }, rotor),
    whoosh: render('hybrid', {}, TURBO_LAYER.whoosh),
    noResonances20: render('v2', dry, duct),
    noResonances21: render('hybrid', dry, duct),
    filters20: p.resonance.map((_, i) => render('v2', { ...dry, resonances: p.resonance.map((_, j) => Number(i === j)) }, duct)),
    filters21: p.resonance.map((_, i) => render('hybrid', { ...dry, resonances: p.resonance.map((_, j) => Number(i === j)) }, duct)),
  };
}

mkdirSync(OUT, { recursive: true });
let markdownRows = '';
const diagnostics: Record<string, ReturnType<typeof diagnosticCases>> = {};
for (const rate of rates) {
  const rows = [];
  for (const b of builds) for (const quality of qualities) {
    const clips = rate === 48000 && quality === 'high' && LISTENING_CARS.includes(b.carId) && exactIds.has(b.id);
    const total = Math.round(rate * (1.5 + DRIVE.reduce((sum, p) => sum + p.seconds, 0)));
    const stems = clips ? STEMS.map(() => new Float32Array(total)) : undefined;
    const models = TURBO_MODELS.map((model) => renderBuild(b, rate, quality, model, model === 'v2' || model === 'hybrid' ? stems : undefined));
    const data = models.map((m) => analyze(m, b, LISTENING_CARS.includes(b.carId) && exactIds.has(b.id)));
    const levels = data.map((m) => m.comparison.aLevelDb);
    const matchDb = levels.map((level) => num(levels[3]! - level, 2));
    const profile = profileOf(b).baseId;
    if (rate === 48000) {
      const group = `${quality}/${profile}`;
      const values = levelGroups.get(group) ?? [];
      values.push(matchDb);
      levelGroups.set(group, values);
      if (exactIds.has(b.id)) levelGroups.set(`${group}/${b.car.engine.id}`, [matchDb]);
    }
    if (stems) {
      writeComparisons(b, rate, models, models[0]!.phaseStart.launch!, matchDb, stems);
      diagnostics[b.id] = diagnosticCases(b, rate);
    }
    rows.push({ build: b.id, profile, quality, matchDb, models: Object.fromEntries(TURBO_MODELS.map((model, i) => [model, data[i]])) });
    markdownRows += `| ${rate} | ${quality} | ${b.id} | ${profile} | ${levels.map((x) => num(x)).join(' / ')} | ${data.map((x) => num(x.run.tonalToNoiseDb)).join(' / ')} |\n`;
    console.log(`${rate} ${quality} ${b.id}: ${levels.map((x) => num(x)).join(' / ')} dBA`);
  }
  writeFileSync(join(OUT, `report-${rate}.json`), JSON.stringify({ rate, drive: DRIVE, rows, markdownRows }));
}
if (!args.includes('--rate-worker')) writeFileSync(join(OUT, 'relatorio.md'), table + markdownRows);
if (rates.includes(48000)) writeFileSync(join(OUT, 'diagnostico-48000.json'), JSON.stringify(diagnostics, null, 2));
if (!args.includes('--rate-worker') || args.includes('--primary')) writeFileSync(join(OUT, 'perfis.json'), JSON.stringify(coverage, null, 2));
if (args.includes('--write-levels') && !only && rates.includes(48000) && qualities.length === 2) {
  const rows = Object.fromEntries([...levelGroups.entries()].sort().map(([key, values]) => [
    key, TURBO_MODELS.map((_, i) => num(median(values.map((v) => v[i]!)), 2)),
  ]));
  const lines = Object.entries(rows).map(([key, v]) => `  '${key}': [${v.join(', ')}],`);
  writeFileSync(OUT_LEVELS, '// Generated by scripts/audio-turbo-report.ts --write-levels from the 48 kHz matrix.\n'
    + `export const TURBO_COMPARISON_DB: Readonly<Record<string, readonly number[]>> = {\n${lines.join('\n')}\n};\n`);
}
