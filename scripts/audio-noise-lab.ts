/**
 * Tyre / wind noise measurement and comparison renders (companion of audio-calibrate.ts).
 *   npx tsx scripts/audio-noise-lab.ts [carId] [--wav out-dir] [--seconds 12]
 * Prints, for 44.1 and 48 kHz, RMS / peak / A-level / band shares / centroid of the `environment`
 * and `tire` channels for steady speeds 0…300 km/h in every slip scenario, and (with --wav) writes
 * 0→300 km/h acceleration sweeps as 16-bit WAV files for listening (before/after comparisons).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARS, findCar } from '../src/data/cars/index';
import { CH, CHANNELS, CHANNEL_COUNT, carToAcousticConfig } from '../src/audio/dsp/AcousticConfig';
import { DEFAULT_MIX } from '../src/audio/core/VehicleSound';
import { encodeWavMono } from '../src/audio/core/wav';
import { NOISE_SCENARIOS, NOISE_SPEEDS_KMH, analyzeSignal, renderNoise, renderSteady, dB } from '../src/audio/analysis/noiseLab';

const args = process.argv.slice(2);
const carId = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--wav' && args[i - 1] !== '--seconds');
const car = (carId ? findCar(carId) : undefined) ?? CARS[0]!;
const wavIdx = args.indexOf('--wav');
const wavDir = wavIdx >= 0 ? args[wavIdx + 1] : undefined;
const secIdx = args.indexOf('--seconds');
const sweepS = secIdx >= 0 ? Number(args[secIdx + 1]) : 12;
const cfg = carToAcousticConfig(car, 'high', 1);

const f = (x: number, d = 3): string => x.toFixed(d).padStart(6 + d - 3);
console.log(`car ${car.id}`);
for (const fs of [44100, 48000]) {
  for (const sc of NOISE_SCENARIOS) {
    console.log(`\n== ${sc.label} @ ${fs} Hz ==`);
    console.log('km/h  | ENV rms  peak  dBA   <300 .3-1.5k 1.5-4k >4k  cent | TIRE rms peak  dBA   <300 .3-1.5k 1.5-4k >4k  cent | clip');
    for (const kmh of NOISE_SPEEDS_KMH) {
      const { ch } = renderSteady(cfg, fs, kmh, sc);
      const e = analyzeSignal(ch[CH.environment]!, fs);
      const t = analyzeSignal(ch[CH.tire]!, fs);
      const b = (m: typeof e): string => m.bands.map((x) => f(x, 2)).join(' ');
      console.log(
        `${String(kmh).padStart(4)}  | ${f(e.rms)} ${f(e.peak, 2)} ${f(e.aLevelDb, 1)} ${b(e)} ${f(e.centroidHz, 0)} | ${f(t.rms)} ${f(t.peak, 2)} ${f(t.aLevelDb, 1)} ${b(t)} ${f(t.centroidHz, 0)} | ${e.clipped + t.clipped}`,
      );
    }
  }
}

if (wavDir) {
  mkdirSync(wavDir, { recursive: true });
  const fs = 48000;
  const speed = (t: number): number => (Math.min(1, t / sweepS) * 300) / 3.6;
  const sweeps: { name: string; slip: (v: number) => number; weights: number[] }[] = [];
  const only = (...k: number[]): number[] => CHANNELS.map((_, i) => (k.includes(i) ? DEFAULT_MIX[CHANNELS[i]!] : 0));
  const all = CHANNELS.map((c) => DEFAULT_MIX[c]);
  const sc = Object.fromEntries(NOISE_SCENARIOS.map((s) => [s.id, s.slip]));
  sweeps.push({ name: 'wind', slip: sc['roll']!, weights: only(CH.environment) });
  sweeps.push({ name: 'tires-roll', slip: sc['roll']!, weights: only(CH.tire) });
  sweeps.push({ name: 'tires-slip-light', slip: sc['slip-light']!, weights: only(CH.tire) });
  sweeps.push({ name: 'tires-slip-heavy', slip: sc['slip-heavy']!, weights: only(CH.tire) });
  sweeps.push({ name: 'wind+tires', slip: sc['roll']!, weights: only(CH.environment, CH.tire) });
  sweeps.push({ name: 'all', slip: sc['roll']!, weights: all });
  for (const s of sweeps) {
    const { ch } = renderNoise(cfg, { sampleRate: fs, seconds: sweepS + 2, speed, slip: s.slip });
    const n = ch[0]!.length;
    const mix = new Float32Array(n);
    for (let k = 0; k < CHANNEL_COUNT; k++) {
      const w = s.weights[k]!;
      if (w === 0) continue;
      for (let i = 0; i < n; i++) mix[i]! += ch[k]![i]! * w * 0.5;
    }
    const out = join(wavDir, `${s.name.replace('+', '-plus-')}.wav`);
    writeFileSync(out, encodeWavMono(mix, fs));
    console.log(`wrote ${out}  rms ${dB(analyzeSignal(mix, fs).rms).toFixed(1)} dBFS`);
  }
}
