/**
 * Intake channel diagnosis / comparison.
 *   npx tsx scripts/audio-intake-lab.ts [carId|all] [--wav out-dir] [--rate 48000] [--rpm N] [--load 0..1]
 *        [--throttle 0..1] [--source full|tone|hiss|roar] [--tag before|after] [--quality high|low]
 * Prints, per car, rpm and load: tone/hiss/roar RMS, noise-over-tone, pre-softClip level, final band
 * shares (<500, .5-1.5k, 1.5-4k, >4k), harmonic share and centroid. With --wav writes level-matched
 * full / tone / hiss / roar renders (rpm sweep at full load) as 16-bit WAV for before/after listening.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listCalibrationCases } from '../src/audio/analysis/calibrationCases';
import { carToAcousticConfig } from '../src/audio/dsp/AcousticConfig';
import { encodeWavMono } from '../src/audio/core/wav';
import { firingHz } from '../src/audio/analysis/exhaustLab';
import { intakeMetrics, renderIntake, renderIntakeSteady } from '../src/audio/analysis/intakeLab';

const args = process.argv.slice(2);
const val = (k: string): string | undefined => (args.indexOf(k) >= 0 ? args[args.indexOf(k) + 1] : undefined);
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const fs = Number(val('--rate') ?? 48000);
const wavDir = val('--wav');
const tag = val('--tag') ?? 'after';
const quality = (val('--quality') ?? 'high') as 'high' | 'low';
const onlyRpm = val('--rpm') ? Number(val('--rpm')) : undefined;
const onlyLoad = val('--load') ? Number(val('--load')) : undefined;
const onlyThr = val('--throttle') ? Number(val('--throttle')) : undefined;
const source = val('--source');
const f = (x: number, d = 2, w = 7): string => x.toFixed(d).padStart(w);

/** Scales to a common RMS so before/after files are compared at equal loudness. */
function levelMatch(x: Float32Array, targetRms = 0.1): Float32Array {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!;
  const g = targetRms / Math.sqrt(s / Math.max(1, x.length) + 1e-20);
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = Math.max(-1, Math.min(1, x[i]! * g));
  return y;
}

for (const sample of listCalibrationCases({
  scope: (val('--scope') ?? 'all') as 'all' | 'campaign' | 'fictional' | 'lab' | 'general',
  car: val('--car') ?? which,
  variant: (val('--variant') ?? 'stock') as 'stock' | 'aspirated-build' | 'turbo-build' | 'all',
})) {
  const car = sample.car;
  const cfg = carToAcousticConfig(car, quality, 1);
  const red = car.engine.redlineRpm;
  const turbo = car.engine.induction === 'turbo';
  const boost = turbo ? 80000 : 0;
  const rpms = onlyRpm ? [onlyRpm] : [1000, 2000, 3000, 4000, 5000, 6000, red - 150].filter((r, i, a) => r < red && a.indexOf(r) === i);
  const loads = onlyLoad !== undefined ? [onlyLoad] : [0.25, 0.5, 0.75, 1];
  console.log(`\n=== ${sample.id} (${car.engine.cylinders} cil, ${car.engine.induction}, redline ${red}) intake @ ${fs} Hz, ${quality} ===`);
  console.log('rpm  load | tone.rms hiss.rms roar.rms noise/tone dB | norm.rms norm.pk sat% | fin.rms fin.pk | <500 .5-1.5k 1.5-4k >4k  harm  cent step');
  for (const rpm of rpms) {
    for (const load of loads) {
      const thr = onlyThr ?? load;
      const r = renderIntakeSteady(cfg, fs, { rpm, load, throttle: thr, boostPa: boost * load }, 2.5);
      const m = intakeMetrics(r, fs, firingHz(car.engine.cylinders, rpm));
      console.log(
        `${String(rpm).padStart(4)} ${f(load)} | ${f(m.toneRms, 1, 8)} ${f(m.hissRms, 1, 8)} ${f(m.roarRms, 1, 8)} ${f(m.noiseOverToneDb, 1, 9)} | ${f(m.normRms, 3)} ${f(m.normPeak, 2)} ${f(m.satShare * 100, 1, 5)} | ${f(m.finalRms, 3)} ${f(m.finalPeak, 2)} | ${m.bands.map((b) => f(b, 2, 5)).join(' ')} ${f(m.harmonicShare, 2, 5)} ${f(m.centroidHz, 0, 5)} ${f(m.maxStepRatio, 1, 5)}`,
      );
    }
  }
  if (wavDir) {
    mkdirSync(wavDir, { recursive: true });
    const red2 = red - 150;
    const sweep = renderIntake(cfg, fs, (t) => ({ rpm: 1000 + Math.min(1, t / 6) * (red2 - 1000), load: 1, boostPa: boost }), 8);
    const parts = [['full', sweep.final], ['pulses', sweep.tone], ['hiss', sweep.hiss], ['roar', sweep.roar]] as const;
    for (const [name, sig] of parts) {
      if (source && source !== name && !(source === 'tone' && name === 'pulses')) continue;
      writeFileSync(join(wavDir, `intake-${tag}-${sample.id}-${name}.wav`), encodeWavMono(levelMatch(sig), fs));
    }
    console.log(`wrote ${wavDir}/intake-${tag}-${sample.id}-{full,pulses,hiss,roar}.wav`);
  }
}
