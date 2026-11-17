/**
 * Offline physics-driven audio campaign calibration (all seven channels).
 * Compatible with the original positional command: tsx scripts/audio-calibrate.ts [carId|all] [48000] [--wav dir]
 * Extended: --scope campaign --variant stock|aspirated-build|turbo-build|all
 *           --car id --quality high|low --rate 48000|44100 --wav dir --report dir
 *           --channel intake|block|exhaust|turbo|tire|transmission|environment|mix --tag before|after
 *           --short (CI smoke calibration, shorter recorded phases)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { AF } from '../src/core/contracts';
import { TRACKS } from '../src/data/tracks/index';
import { VehicleSimulation } from '../src/physics/vehicle/VehicleSimulation';
import { CHANNELS, CHANNEL_COUNT, carToAcousticConfig } from '../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../src/audio/dsp/VehicleAcoustics';
import { averagedSpectrum } from '../src/audio/analysis/spectrum';
import { listCalibrationCases, type CalibrationScope, type CalibrationVariant } from '../src/audio/analysis/calibrationCases';
import { encodeWavMono } from '../src/audio/core/wav';

const H = 1 / 120;
const MIX = [0.8, 0.6, 1, 0.7, 0.8, 0.6, 0.5];
const args = process.argv.slice(2);
const value = (key: string): string | undefined => {
  const i = args.indexOf(key);
  return i < 0 ? undefined : args[i + 1];
};
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const rate = Number(value('--rate') ?? (args[1] && !args[1].startsWith('--') ? args[1] : 48000));
const quality = (value('--quality') ?? 'high') as 'high' | 'low';
const scope = (value('--scope') ?? 'general') as CalibrationScope;
const variant = (value('--variant') ?? (scope === 'campaign' || scope === 'all' ? 'all' : 'stock')) as CalibrationVariant | 'all';
const carId = value('--car') ?? which;
const wavDir = value('--wav');
const reportDir = value('--report') ?? wavDir;
const tag = value('--tag') ?? 'after';
const channel = value('--channel');
const short = args.includes('--short');
if (![44100, 48000].includes(rate)) throw new Error('Taxa válida: 44100 ou 48000 Hz');
if (!['high', 'low'].includes(quality)) throw new Error('Qualidade válida: high ou low');
if (channel && channel !== 'mix' && !CHANNELS.includes(channel as typeof CHANNELS[number])) throw new Error('Canal inválido: ' + channel);
const cases = listCalibrationCases({ scope, car: carId, variant });
if (!cases.length) throw new Error('Nenhum caso de calibração válido para ' + JSON.stringify({ scope, carId, variant }));
if (wavDir) mkdirSync(wavDir, { recursive: true });
if (reportDir) mkdirSync(reportDir, { recursive: true });

function metrics(x: number[], fs: number): { centroidHz: number; bands: number[] } {
  const n = 2048;
  if (x.length < n) return { centroidHz: 0, bands: [0, 0, 0, 0] };
  const spec = averagedSpectrum(x, n);
  const bands = [0, 0, 0, 0];
  let total = 0, weighted = 0;
  for (let k = 1; k < spec.length; k++) {
    const f = k * fs / n, e = spec[k]! ** 2;
    total += e;
    weighted += f * e;
    bands[f < 500 ? 0 : f < 1500 ? 1 : f < 4000 ? 2 : 3]! += e;
  }
  return { centroidHz: total ? weighted / total : 0, bands: bands.map((x) => x / (total || 1)) };
}

/** Identical target for comparative listening; raw RMS is preserved in the JSON. */
function matched(x: Float32Array, target = 0.09): Float32Array {
  let sum = 0;
  for (const v of x) sum += v * v;
  const gain = target / Math.sqrt(sum / Math.max(1, x.length) + 1e-20);
  return Float32Array.from(x, (v) => Math.max(-1, Math.min(1, v * gain)));
}

for (const sample of cases) {
  const car = sample.car;
  const sim = new VehicleSimulation(car, TRACKS[0]!);
  const voice = new VehicleAcoustics(rate, carToAcousticConfig(car, quality, 1));
  const buffers = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(rate * H) + 2));
  const wavs: number[][] = Array.from({ length: CHANNEL_COUNT + 1 }, () => []);
  const allPhases: unknown[] = [];
  let acc = 0, totalAudioS = 0, totalCpuMs = 0, afterfires = 0;
  let intakePeak = 0, exhaustPeak = 0, intakeClip = 0, exhaustClip = 0, tapCount = 0;
  voice.intakeTap = (_tone, _hiss, _roar, _combined, normalized) => {
    intakePeak = Math.max(intakePeak, Math.abs(normalized));
    if (Math.abs(normalized) >= 1) intakeClip++;
    tapCount++;
  };
  voice.exhaustTap = (_pulse, _jet, _combined, normalized) => {
    exhaustPeak = Math.max(exhaustPeak, Math.abs(normalized));
    if (Math.abs(normalized) >= 1) exhaustClip++;
  };
  const phase = (name: string, duration: number, pedal: number, shift = false): void => {
    voice.resetStats();
    intakePeak = 0; exhaustPeak = 0; intakeClip = 0; exhaustClip = 0; tapCount = 0;
    const samples: number[][] = Array.from({ length: CHANNEL_COUNT }, () => []);
    let rpm = 0, load = 0, throttle = 0, map = 0, boost = 0, shaftMax = 0, bovMax = 0, frames = 0;
    const seconds = short && name !== 'start' ? duration * 0.42 : duration;
    const n = Math.round(seconds / H);
    const startCpu = performance.now();
    for (let i = 0; i < n; i++) {
      sim.controls.pedal = pedal;
      if (shift && !sim.shift.active && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm > car.engine.redlineRpm - 300 && sim.gear < 4) sim.requestShift(1);
      sim.step(H);
      const a = sim.audioFrame;
      rpm += a[AF.omega]! * 60 / (2 * Math.PI);
      load += a[AF.load]!;
      throttle += a[AF.throttle]!;
      map += a[AF.manifoldPressure]!;
      boost += a[AF.boostPressure]!;
      shaftMax = Math.max(shaftMax, a[AF.turboShaftRpm]!);
      bovMax = Math.max(bovMax, a[AF.bovFlow]!);
      if (a[AF.afterfire]! > 0.5) afterfires++;
      frames++;
      voice.pushFrame(a);
      acc += rate * H;
      const m = Math.floor(acc);
      acc -= m;
      if (!m) continue;
      voice.render(buffers, m);
      totalAudioS += m / rate;
      for (let k = 0; k < CHANNEL_COUNT; k++) {
        for (let j = 0; j < m; j++) {
          const y = buffers[k]![j]!;
          if (samples[k]!.length < 8192) samples[k]!.push(y);
          if (wavDir) wavs[k]!.push(y);
        }
      }
      if (wavDir) for (let j = 0; j < m; j++) {
        let mixed = 0;
        for (let k = 0; k < CHANNEL_COUNT; k++) mixed += MIX[k]! * buffers[k]![j]!;
        wavs[CHANNEL_COUNT]!.push(mixed * 0.35);
      }
    }
    const elapsedMs = performance.now() - startCpu;
    totalCpuMs += elapsedMs;
    const channels = Object.fromEntries(CHANNELS.map((ch, k) => [
      ch, { rms: voice.rms(k), peak: voice.peak[k], rawRms: voice.rawRms(k), ...metrics(samples[k]!, rate) },
    ]));
    allPhases.push({
      name, seconds, rpm: rpm / Math.max(1, frames), load: load / Math.max(1, frames),
      throttle: throttle / Math.max(1, frames), manifoldKPa: map / Math.max(1, frames) / 1000,
      boostBar: boost / Math.max(1, frames) / 1e5,
      maxTurboShaftRpm: shaftMax, maxBovFlow: bovMax,
      intakePreClipPeak: intakePeak, exhaustPreClipPeak: exhaustPeak,
      intakeSaturationShare: intakeClip / Math.max(1, tapCount),
      exhaustSaturationShare: exhaustClip / Math.max(1, tapCount),
      channels,
    });
  };
  phase('start', 3, 0);
  phase('idle', 2, 0);
  phase('25%', 1, 0.25);
  phase('50%', 1, 0.5);
  phase('75%', 1, 0.75);
  phase('rev', 1.2, 1);
  phase('lift', 1.5, 0);
  sim.requestShift(1);
  phase('gear1', 0.5, 0);
  phase('launch', 2.5, 1);
  phase('run', 5, 1, true);
  phase('coast', 2, 0);
  const report = {
    id: sample.id, baseCarId: sample.baseCarId, catalog: sample.catalog, variant: sample.variant,
    name: car.name, engineId: car.engine.id, cylinders: car.engine.cylinders, firingAnglesDeg: car.engine.firingAnglesDeg,
    boreMm: car.engine.boreMm, strokeMm: car.engine.strokeMm, compressionRatio: car.engine.compressionRatio,
    redlineRpm: car.engine.redlineRpm, induction: car.engine.induction, acoustic: car.acoustic,
    rate, quality, tag, simDriven: true,
    cpuMs: totalCpuMs, audioSeconds: totalAudioS, cpuRealtimeShare: totalCpuMs / (totalAudioS * 1000),
    nanResets: voice.nanResets, rejectedFrames: voice.stream.rejectedFrames,
    resyncs: voice.stream.resyncs, starvedSeconds: voice.stream.starvedS, afterfires, phases: allPhases,
    limitations: ['Render offline do DSP: starvation do navegador/AudioWorklet requer Playwright.', 'Sem escuta humana validada automaticamente.'],
  };
  console.log(sample.id + ' [' + sample.variant + '] ' + quality + ' ' + rate +
    ' Hz | CPU ' + (report.cpuRealtimeShare * 100).toFixed(1) + '% | NaN ' + report.nanResets +
    ' | frames rejeitados ' + report.rejectedFrames + ' | resyncs ' + report.resyncs);
  for (const p of allPhases as Array<{ name: string; rpm: number; load: number; boostBar: number; channels: Record<string, { rms: number; peak: number }> }>) {
    console.log('  ' + p.name.padEnd(7) + ' RPM=' + p.rpm.toFixed(0).padStart(5) +
      ' load=' + p.load.toFixed(2) + ' boost=' + p.boostBar.toFixed(2) +
      '  ' + CHANNELS.map((ch) => ch.slice(0, 4) + ':' + p.channels[ch]!.rms.toFixed(3) + '/' + p.channels[ch]!.peak.toFixed(2)).join(' '));
  }
  const prefix = tag + '-' + sample.id + '-' + quality + '-' + rate;
  if (reportDir) writeFileSync(join(reportDir, prefix + '.json'), JSON.stringify(report, null, 2) + '\n');
  if (wavDir) for (let k = 0; k <= CHANNEL_COUNT; k++) {
    const name = k === CHANNEL_COUNT ? 'mix' : CHANNELS[k]!;
    if (channel && channel !== name) continue;
    const sig = Float32Array.from(wavs[k]!);
    writeFileSync(join(wavDir, prefix + '-' + name + '.wav'), encodeWavMono(name === 'mix' ? matched(sig) : sig, rate));
  }
}
