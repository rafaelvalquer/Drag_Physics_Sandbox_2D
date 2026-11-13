/**
 * Performance benchmark (Node, single thread):
 *  - physics: wall time of one 1/120 s step per vehicle during a full-throttle quarter mile;
 *  - acoustics: CPU time to render one second of audio per voice (high and low quality).
 * Results are measured on this machine and printed as-is; the browser adds rendering and
 * scheduling overhead not included here.
 *   npx tsx scripts/bench/benchmark.ts [sampleRate]
 */
import { CHANNEL_COUNT, carToAcousticConfig, type AcousticQuality } from '../../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../../src/audio/dsp/VehicleAcoustics';
import { LAB_CARS } from '../../src/data/cars/index';
import { TRACKS } from '../../src/data/tracks/index';
import { DragAI } from '../../src/game/ai/DragAI';
import { VehicleSimulation } from '../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;
const fs = Number(process.argv[2] ?? 48000);

function physicsRun(carIdx: number): { stepUs: number; steps: number; et: number | null } {
  const car = LAB_CARS[carIdx]!;
  const sim = new VehicleSimulation(car, TRACKS[0]!);
  const ai = new DragAI(car, 'advanced', 1);
  // warm-up: engine start and staging
  for (let i = 0; i < 480; i++) {
    ai.update(H, sim, { timeSinceGreen: null, staged: true, finished: false });
    sim.step(H);
  }
  const t0 = performance.now();
  const green = sim.simTime;
  let steps = 0;
  let et: number | null = null;
  while (sim.simTime - green < 30) {
    ai.update(H, sim, { timeSinceGreen: sim.simTime - green, staged: true, finished: sim.x > 402.336 });
    sim.step(H);
    steps++;
    if (et === null && sim.x > 402.336) et = sim.simTime - green;
  }
  return { stepUs: ((performance.now() - t0) * 1000) / steps, steps, et };
}

function audioRun(carIdx: number, quality: AcousticQuality): { cpuPerAudioS: number } {
  const car = LAB_CARS[carIdx]!;
  const sim = new VehicleSimulation(car, TRACKS[0]!);
  const ai = new DragAI(car, 'advanced', 1);
  const voice = new VehicleAcoustics(fs, carToAcousticConfig(car, quality, 1));
  const bufs = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(fs * H) + 2));
  let acc = 0;
  let ms = 0;
  let audioS = 0;
  const green = 4;
  for (let i = 0; i < Math.round(20 / H); i++) {
    const t = sim.simTime;
    ai.update(H, sim, { timeSinceGreen: t >= green ? t - green : null, staged: true, finished: false });
    sim.step(H);
    voice.pushFrame(sim.audioFrame);
    acc += fs * H;
    const m = Math.floor(acc);
    acc -= m;
    const t0 = performance.now();
    voice.render(bufs, m);
    ms += performance.now() - t0;
    audioS += m / fs;
  }
  return { cpuPerAudioS: ms / 1000 / audioS };
}

console.log(`benchmark – Node ${process.version}, audio at ${fs} Hz\n`);
console.log('car'.padEnd(26) + 'physics µs/step'.padStart(17) + '1/4 mi from green'.padStart(19) + 'audio high %RT'.padStart(16) + 'audio low %RT'.padStart(15));
for (let i = 0; i < LAB_CARS.length; i++) {
  const p = physicsRun(i);
  const hi = audioRun(i, 'high');
  const lo = audioRun(i, 'low');
  console.log(
    LAB_CARS[i]!.name.padEnd(26) +
      p.stepUs.toFixed(1).padStart(17) +
      (p.et === null ? '—' : `${p.et.toFixed(3)} s`).padStart(19) +
      `${(hi.cpuPerAudioS * 100).toFixed(1)}%`.padStart(16) +
      `${(lo.cpuPerAudioS * 100).toFixed(1)}%`.padStart(15),
  );
}
console.log('\n1/4 mi from green = time from the green light (includes AI reaction and rollout; a race ET starts at the stage beam).');
console.log('%RT = CPU time per second of audio for one voice (100% = one core fully used).');
console.log('Physics budget at 120 Hz: 8333 µs per step for all vehicles together.');
