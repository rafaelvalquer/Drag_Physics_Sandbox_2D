/**
 * Exhaust channel diagnosis / comparison.
 *   npx tsx scripts/audio-exhaust-lab.ts [carId|all] [--presets] [--wav out-dir] [--rate 48000]
 * Prints, per car, rpm and load: radiated vs jet RMS, pre-softClip level / saturation share, final
 * band shares, harmonic share and centroid. With --wav writes level-matched radiated / jet /
 * final renders (and an rpm sweep) as 16-bit WAV for before/after listening.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LAB_CARS } from '../src/data/cars/index';
import { carToAcousticConfig } from '../src/audio/dsp/AcousticConfig';
import { encodeWavMono } from '../src/audio/core/wav';
import { exhaustPreset, type ExhaustPresetId } from '../src/data/exhaustPresets';
import { exhaustMetrics, firingHz, renderExhaust, renderExhaustSteady } from '../src/audio/analysis/exhaustLab';

const args = process.argv.slice(2);
const val = (k: string): string | undefined => (args.indexOf(k) >= 0 ? args[args.indexOf(k) + 1] : undefined);
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const fs = Number(val('--rate') ?? 48000);
const wavDir = val('--wav');
const presets = args.includes('--presets');
const f = (x: number, d = 2, w = 7): string => x.toFixed(d).padStart(w);

/** Peak-normalizes to a common RMS so before/after files are compared at equal loudness. */
function levelMatch(x: Float32Array, targetRms = 0.1): Float32Array {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!;
  const g = targetRms / Math.sqrt(s / Math.max(1, x.length) + 1e-20);
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = Math.max(-1, Math.min(1, x[i]! * g));
  return y;
}

for (const car of LAB_CARS) {
  if (which !== 'all' && car.id !== which) continue;
  const variants: { name: string; exhaust: typeof car.exhaust }[] = presets
    ? (['stock', 'sport', 'straight'] as ExhaustPresetId[]).map((id) => ({ name: id, exhaust: exhaustPreset(id, car.exhaust) }))
    : [{ name: car.exhaust.presetId ?? 'car', exhaust: car.exhaust }];
  for (const v of variants) {
    const c = { ...car, exhaust: v.exhaust };
    const cfg = carToAcousticConfig(c, 'high', 1);
    const red = car.engine.redlineRpm;
    const rpms = [1000, 2000, 3000, 4500, 6000, red - 150].filter((r, i, a) => r < red && a.indexOf(r) === i);
    console.log(`\n=== ${car.id} (${car.engine.cylinders} cil, ${car.engine.induction}, redline ${red}) exhaust ${v.name} @ ${fs} Hz ===`);
    console.log('rpm  load | rad.rms  jet.rms jet/rad dB | norm.rms norm.pk sat% | fin.rms fin.pk | <200 .2-1k 1-4k >4k  harm  cent');
    for (const rpm of rpms) {
      for (const load of [0.25, 0.5, 1]) {
        const r = renderExhaustSteady(cfg, fs, rpm, load);
        const m = exhaustMetrics(r, fs, firingHz(car.engine.cylinders, rpm));
        console.log(
          `${String(rpm).padStart(4)} ${f(load)} | ${f(m.radiatedRms, 1)} ${f(m.jetRms, 1)} ${f(m.jetOverRadiatedDb, 1)} | ${f(m.normRms, 3)} ${f(m.normPeak, 2)} ${f(m.satShare * 100, 1, 5)} | ${f(m.finalRms, 3)} ${f(m.finalPeak, 2)} | ${m.bands.map((b) => f(b, 2, 5)).join(' ')} ${f(m.harmonicShare, 2, 5)} ${f(m.centroidHz, 0, 5)}`,
        );
      }
    }
    if (wavDir) {
      mkdirSync(wavDir, { recursive: true });
      const red2 = red - 150;
      const sweep = renderExhaust(cfg, fs, (t) => ({ rpm: 1000 + Math.min(1, t / 6) * (red2 - 1000), load: 1 }), 8);
      for (const [name, sig] of [['final', sweep.final], ['radiated', sweep.radiated], ['jet', sweep.jet]] as const) {
        const out = join(wavDir, `${car.id}-${v.name}-${name}.wav`);
        writeFileSync(out, encodeWavMono(levelMatch(sig), fs));
      }
      console.log(`wrote ${wavDir}/${car.id}-${v.name}-{final,radiated,jet}.wav`);
    }
  }
}
