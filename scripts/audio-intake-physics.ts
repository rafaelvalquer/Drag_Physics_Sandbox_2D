/**
 * Intake metrics at the operating points produced by the real physics (idle, free rev, part rev,
 * lift, launch, full-throttle run, coast).
 *   npx tsx scripts/audio-intake-physics.ts [carId|all] [--rate 48000] [--quality high|low] [--wav dir] [--tag before|after]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listCalibrationCases } from '../src/audio/analysis/calibrationCases';
import { TRACKS } from '../src/data/tracks/index';
import { VehicleSimulation } from '../src/physics/vehicle/VehicleSimulation';
import { encodeWavMono } from '../src/audio/core/wav';
import { firingHz } from '../src/audio/analysis/exhaustLab';
import { intakeMetrics } from '../src/audio/analysis/intakeLab';
import { renderIntakePhysics, type PhysicsPhaseResult } from '../src/audio/analysis/intakePhysics';

const args = process.argv.slice(2);
const val = (k: string): string | undefined => (args.indexOf(k) >= 0 ? args[args.indexOf(k) + 1] : undefined);
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const fs = Number(val('--rate') ?? 48000);
const quality = (val('--quality') ?? 'high') as 'high' | 'low';
const wavDir = val('--wav');
const tag = val('--tag') ?? 'after';
const f = (x: number, d = 2, w = 7): string => x.toFixed(d).padStart(w);

function levelMatch(x: Float32Array, targetRms = 0.1): Float32Array {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!;
  const g = targetRms / Math.sqrt(s / Math.max(1, x.length) + 1e-20);
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = Math.max(-1, Math.min(1, x[i]! * g));
  return y;
}
const cat = (parts: Float32Array[]): Float32Array => {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const o = new Float32Array(n);
  let k = 0;
  for (const p of parts) {
    o.set(p, k);
    k += p.length;
  }
  return o;
};

for (const sample of listCalibrationCases({
  scope: (val('--scope') ?? 'general') as 'all' | 'campaign' | 'fictional' | 'lab' | 'general',
  car: val('--car') ?? which,
  variant: (val('--variant') ?? 'stock') as 'stock' | 'aspirated-build' | 'turbo-build' | 'all',
})) {
  const car = sample.car;
  const sim = new VehicleSimulation(car, TRACKS[0]!);
  const res: PhysicsPhaseResult[] = renderIntakePhysics(car, sim, fs, undefined, quality);
  console.log(`\n=== ${sample.id} (${car.engine.cylinders} cil, ${car.engine.induction}) intake, real physics @ ${fs} Hz, ${quality} ===`);
  console.log('phase      rpm  load  thr  MAP kPa boost | tone.rms hiss.rms roar.rms noise/tone | norm.pk sat% | <500 .5-1.5k 1.5-4k >4k  harm  cent step');
  for (const r of res) {
    const m = intakeMetrics(r.render, fs, firingHz(car.engine.cylinders, Math.max(r.rpm, 300)));
    console.log(
      `${r.name.padEnd(9)} ${f(r.rpm, 0, 5)} ${f(r.load)} ${f(r.throttle)} ${f(r.manifoldPa / 1000, 1, 7)} ${f(r.boostPa / 1000, 0, 5)} | ${f(m.toneRms, 1, 8)} ${f(m.hissRms, 1, 8)} ${f(m.roarRms, 1, 8)} ${f(m.noiseOverToneDb, 1, 9)} | ${f(m.normPeak, 2)} ${f(m.satShare * 100, 1, 5)} | ${m.bands.map((b) => f(b, 2, 5)).join(' ')} ${f(m.harmonicShare, 2, 5)} ${f(m.centroidHz, 0, 5)} ${f(m.maxStepRatio, 1, 5)}`,
    );
  }
  if (wavDir) {
    mkdirSync(wavDir, { recursive: true });
    const parts = { full: 'final', pulses: 'tone', hiss: 'hiss', roar: 'roar' } as const;
    for (const [name, key] of Object.entries(parts)) {
      const sig = cat(res.map((r) => r.render[key]));
      writeFileSync(join(wavDir, `intake-${tag}-${sample.id}-${name}.wav`), encodeWavMono(levelMatch(sig), fs));
    }
    console.log(`wrote ${wavDir}/intake-${tag}-${sample.id}-{full,pulses,hiss,roar}.wav`);
  }
}
