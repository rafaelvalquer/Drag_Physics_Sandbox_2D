/**
 * Offline acoustic calibration / inspection.
 * Drives the real physics (VehicleSimulation) through idle → free rev → full-throttle run and
 * renders the acoustic voice at a real sample rate, reporting per-channel RMS / peak per phase,
 * CPU cost relative to real time and non-finite resets. Optionally writes a WAV mix:
 *   npx tsx scripts/audio-calibrate.ts [carId|all] [sampleRate] [--wav out-dir]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARS } from '../src/data/cars/index';
import { TRACKS } from '../src/data/tracks/index';
import { VehicleSimulation } from '../src/physics/vehicle/VehicleSimulation';
import { CHANNELS, CHANNEL_COUNT, carToAcousticConfig } from '../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../src/audio/dsp/VehicleAcoustics';
import { encodeWavMono } from '../src/audio/core/wav';

const H = 1 / 120;
const args = process.argv.slice(2);
const which = args[0] ?? 'all';
const fs = Number(args[1] ?? 48000);
const wavIdx = args.indexOf('--wav');
const wavDir = wavIdx >= 0 ? args[wavIdx + 1] : undefined;
const MIX = [0.8, 0.6, 1, 0.7, 0.8, 0.6, 0.5];

for (const car of CARS) {
  if (which !== 'all' && car.id !== which) continue;
  const sim = new VehicleSimulation(car, TRACKS[0]!);
  const voice = new VehicleAcoustics(fs, carToAcousticConfig(car, 'high', 1));
  if (args.includes('--nopop')) {
    const st = voice.stream;
    const orig = st.step.bind(st);
    st.step = () => {
      orig();
      st.eventAfterfire = false;
    };
  }
  let pops = 0;
  const perStep = fs * H;
  let acc = 0;
  const bufs = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(perStep) + 2));
  const mix: number[] = [];
  let audioMs = 0;
  let audioS = 0;
  const report: string[] = [];
  const phase = (name: string, seconds: number, ctl: (t: number) => void): void => {
    voice.resetStats();
    const n = Math.round(seconds / H);
    for (let i = 0; i < n; i++) {
      ctl(i * H);
      sim.step(H);
      voice.pushFrame(sim.audioFrame);
      if (sim.audioFrame[23]! > 0.5) pops++;
      acc += perStep;
      const m = Math.floor(acc);
      acc -= m;
      const t0 = performance.now();
      voice.render(bufs, m);
      audioMs += performance.now() - t0;
      audioS += m / fs;
      if (wavDir) for (let j = 0; j < m; j++) mix.push(MIX.reduce((s, g, k) => s + g * bufs[k]![j]!, 0) * 0.35);
    }
    const cells = CHANNELS.map((c, k) => `${c.slice(0, 5)} ${voice.rms(k).toFixed(3)}/${voice.peak[k]!.toFixed(2)} (${voice.rawRms(k).toPrecision(2)})`);
    report.push(`  ${name.padEnd(9)} rpm ${sim.engine.rpm.toFixed(0).padStart(5)}  ${cells.join('  ')}`);
  };
  phase('start', 3, () => {
    sim.controls.pedal = 0;
  });
  phase('idle', 2, () => {
    sim.controls.pedal = 0;
  });
  phase('rev', 1.2, () => {
    sim.controls.pedal = 1;
  });
  phase('lift', 1.5, () => {
    sim.controls.pedal = 0;
  });
  sim.requestShift(1);
  phase('gear1', 0.5, () => {
    sim.controls.pedal = 0;
  });
  phase('launch', 2.5, () => {
    sim.controls.pedal = 1;
  });
  phase('run', 5, () => {
    sim.controls.pedal = 1;
    if (!sim.shift.active && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm > car.engine.redlineRpm - 300 && sim.gear < 4) sim.requestShift(1);
  });
  phase('coast', 2, () => {
    sim.controls.pedal = 0;
  });
  console.log(
    `${car.id} @${fs} Hz: audio ${(audioMs / 1000).toFixed(2)} s CPU for ${audioS.toFixed(1)} s (${((audioMs / 1000 / audioS) * 100).toFixed(1)} % of real time), nanResets ${voice.nanResets}, afterfires ${pops}, fired ${voice.engine.firedEvents}, cut ${voice.engine.cutEvents}, rejected ${voice.stream.rejectedFrames}`,
  );
  for (const r of report) console.log(r);
  if (wavDir) {
    const out = join(wavDir, `${car.id}-${fs}.wav`);
    writeFileSync(out, encodeWavMono(Float32Array.from(mix), fs));
    console.log(`  wrote ${out}`);
  }
}
