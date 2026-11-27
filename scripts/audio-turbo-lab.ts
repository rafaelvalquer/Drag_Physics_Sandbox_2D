/**
 * Turbo Acoustics lab (Node.js, no browser).
 *
 *   npx tsx scripts/audio-turbo-lab.ts --car=vw-gol-gts-1988
 *   npx tsx scripts/audio-turbo-lab.ts --all
 *   npx tsx scripts/audio-turbo-lab.ts --all --matrix            (every resolver-accepted build)
 *   npx tsx scripts/audio-turbo-lab.ts --scenario=tip-out        (steady|spool-sweep|tip-out|gear-shift|twin|stress|idle|engine-off|physics|all)
 *   npx tsx scripts/audio-turbo-lab.ts --rate=44100 | --rate=48000 | --rate=96000
 *   npx tsx scripts/audio-turbo-lab.ts --quality=low
 *   npx tsx scripts/audio-turbo-lab.ts --model=legacy|v2|both
 *   npx tsx scripts/audio-turbo-lab.ts --car=vw-gol-gts-1988 --wav=docs/audio-turbo/after --layers
 *   npx tsx scripts/audio-turbo-lab.ts --all --json=docs/audio-turbo/after/metrics.json
 *
 * Prints, per build / model / scenario: RMS, peak, clipping, non-finite samples, centroid, band
 * shares, tonal-to-noise ratio, dominant frequency, order prominence (1X/2X/3X/BPF, spool sweep),
 * flutter pulse rate (tip-out) and the render cost. With --wav writes 16-bit WAVs of the isolated
 * turbo channel, engine + turbo and the full vehicle (and with --layers each Turbo 2.0 layer).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CH, CHANNELS, carToAcousticConfig, type AcousticQuality } from '../src/audio/dsp/AcousticConfig';
import { DEFAULT_MIX } from '../src/audio/core/VehicleSound';
import { encodeWavMono } from '../src/audio/core/wav';
import { TURBO_SCENARIOS, envelope, mixChannels, modulationRate, orderTracking, renderTurboScenario, turboMetrics, type TurboRender, type TurboScenarioId } from '../src/audio/analysis/turboLab';
import { renderTurboPhysics } from '../src/audio/analysis/turboPhysics';
import { referenceTurboBuilds, turboBuildMatrix, type TurboBuild } from '../src/audio/analysis/turboBuilds';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const flag = (name: string): boolean => args.includes(`--${name}`);
const cars = opt('car')?.split(',');
const rate = Number(opt('rate') ?? 48000);
const quality = (opt('quality') ?? 'high') as AcousticQuality;
const modelArg = opt('model') ?? 'both';
const models = (modelArg === 'both' ? ['legacy', 'v2'] : [modelArg]) as ('legacy' | 'v2')[];
const scenarioArg = opt('scenario') ?? 'all';
const scenarios: (TurboScenarioId | 'physics')[] = scenarioArg === 'all' ? [...TURBO_SCENARIOS, 'physics'] : (scenarioArg.split(',') as (TurboScenarioId | 'physics')[]);
const wavDir = opt('wav');
const jsonPath = opt('json');
const layers = flag('layers');
if (!cars && !flag('all')) {
  console.error('use --car=<id>[,<id>] or --all');
  process.exit(1);
}
const bovArg = opt('bov') as 'none' | 'atmosphere' | 'recirculating' | undefined;
const wgArg = opt('wastegate') as 'internal' | 'external-recirculated' | 'external-open' | undefined;
let builds: TurboBuild[] = flag('matrix') ? turboBuildMatrix(cars).builds : referenceTurboBuilds(cars);
// lab-only hardware overrides (valve / wastegate types the catalogue may not offer for that car)
if (bovArg || wgArg) {
  builds = builds.map((b) => {
    const car = structuredClone(b.car) as typeof b.car;
    if (bovArg && car.engine.turbo) {
      car.engine.turbo.bovEnabled = bovArg !== 'none';
      if (bovArg === 'recirculating') car.engine.turbo.bovVent = 'recirculating';
      else delete car.engine.turbo.bovVent;
    }
    if (wgArg) car.acoustic = { ...car.acoustic, turbo: { ...car.acoustic.turbo, wastegate: wgArg } };
    return { ...b, id: b.id + (bovArg ? '+bov-' + bovArg : '') + (wgArg ? '+wg-' + wgArg : ''), group: 'lab', car };
  });
}

const engineMix = CHANNELS.map((c, i) => (i === CH.intake || i === CH.block || i === CH.exhaust || i === CH.turbo ? DEFAULT_MIX[c] : 0));
const fullMix = CHANNELS.map((c) => DEFAULT_MIX[c]);
const f = (x: number, d = 3): string => (Number.isFinite(x) ? x.toFixed(d) : '  -  ').padStart(7);
const rows: Record<string, unknown>[] = [];

const LAYER_FILES: [string, (aux: any) => number][] = [
  ['rotor-1x', (a) => a.turbo?.rotorA.out1 ?? 0],
  ['rotor-harmonics', (a) => a.turbo?.rotorA.outH ?? 0],
  ['blade-pass', (a) => a.turbo?.rotorA.outB ?? 0],
  ['rotor-full', (a) => a.turbo?.rotorOut ?? 0],
  ['compressor-whoosh', (a) => a.turbo?.whooshOut ?? 0],
  ['blowoff', (a) => a.turbo?.bovOut ?? 0],
  ['flutter', (a) => a.turbo?.flutterOut ?? 0],
  ['wastegate', (a) => a.turbo?.wastegateOut ?? 0],
  ['duct-resonance', (a) => a.turbo?.duct.out ?? 0],
];

function normalize(x: Float32Array, peak = 0.7): Float32Array {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m < 1e-9) return x;
  const g = peak / m;
  return x.map((v) => v * g);
}

for (const b of builds) {
  console.log(`\n=== ${b.id}  (${b.group})  blades ${b.car.engine.turbo?.compressorBlades}  max ${b.car.engine.turbo?.maxShaftRpm} rpm  ${b.car.engine.turbo?.maxBoostBar} bar  ${b.car.engine.turbo?.layout ?? 'single'}  BOV ${b.car.engine.turbo?.bovEnabled ? b.car.engine.turbo?.bovVent ?? 'atmosphere' : 'none'}`);
  console.log('model  scenario     |   rms    dBA   peak  clip nan   cent   <700 .7-2k 2-4.5k 4.5-8k  >8k  TNRdB  domHz | 1X    2X    3X   BPF  | flutHz  str | ms/s');
  for (const model of models) {
    for (const sc of scenarios) {
      const cfg = { ...carToAcousticConfig(b.car, quality, 1), turboModel: model };
      const taps: Float32Array[] | null = layers && model === 'v2' && wavDir ? LAYER_FILES.map(() => new Float32Array(0)) : null;
      const tapBuf: number[][] = LAYER_FILES.map(() => []);
      const tap = taps ? (aux: unknown) => LAYER_FILES.forEach(([, get], i) => tapBuf[i]!.push(get(aux))) : undefined;
      const t0 = performance.now();
      let r: TurboRender;
      let from = Math.round(0.3 * rate);
      if (sc === 'physics') {
        const pr = renderTurboPhysics(b.car, rate, { quality, acoustic: (c) => ({ ...c, turboModel: model }), tap });
        r = pr;
        from = pr.phaseStart['launch'] ?? from;
      } else r = renderTurboScenario(cfg, rate, sc, { tap });
      const ms = performance.now() - t0;
      const x = r.ch[CH.turbo]!;
      const m = turboMetrics(x, rate, from);
      const ord = sc === 'spool-sweep' || sc === 'twin' ? orderTracking(r, b.car.engine.turbo!.compressorBlades) : {};
      let flut = { hz: NaN, strength: NaN };
      if (sc === 'tip-out') {
        const s0 = Math.round(3.02 * rate);
        flut = modulationRate(envelope(x, rate, 0.004, s0, Math.min(x.length, s0 + Math.round(1.2 * rate))), 0.004, 4, 40);
      }
      const seconds = x.length / rate;
      const row = { build: b.id, group: b.group, model, scenario: sc, rate, quality, ...m, orders: ord, flutterHz: flut.hz, flutterStrength: flut.strength, msPerS: ms / seconds };
      rows.push(row);
      console.log(
        `${model.padEnd(6)} ${sc.padEnd(12)} | ${f(m.rms, 4)} ${f(m.aLevelDb, 1)} ${f(m.peak, 3)} ${String(m.clipped).padStart(4)} ${String(m.nonFinite).padStart(3)} ${f(m.centroidHz, 0)} ${m.bands.map((v) => f(v, 2)).join('')} ${f(m.tonalToNoiseDb, 1)} ${f(m.dominantHz, 0)} | ${['1X', '2X', '3X', 'BPF'].map((k) => f((ord as Record<string, number>)[k] ?? NaN, 1)).join('')} | ${f(flut.hz, 1)} ${f(flut.strength, 2)} | ${f(ms / seconds, 0)}`,
      );
      if (wavDir) {
        const dir = join(wavDir, b.id.replace(/[/:]/g, '_'), model);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${sc}-turbo-isolated.wav`), encodeWavMono(normalize(x), rate));
        writeFileSync(join(dir, `${sc}-engine-and-turbo.wav`), encodeWavMono(normalize(mixChannels(r.ch, engineMix), 0.8), rate));
        writeFileSync(join(dir, `${sc}-full-vehicle.wav`), encodeWavMono(normalize(mixChannels(r.ch, fullMix), 0.8), rate));
        if (taps) LAYER_FILES.forEach(([name], i) => writeFileSync(join(dir, `${sc}-${name}.wav`), encodeWavMono(normalize(Float32Array.from(tapBuf[i]!)), rate)));
      }
    }
  }
}
if (jsonPath) {
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify({ generated: new Date().toISOString(), rate, quality, rows }, null, 1));
  console.log(`\nmetrics → ${jsonPath}`);
}
