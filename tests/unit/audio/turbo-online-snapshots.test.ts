import { describe, expect, it } from 'vitest';
import { AF } from '../../../src/core/contracts';
import { CH, CHANNEL_COUNT, carToAcousticConfig, type AcousticQuality } from '../../../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../../../src/audio/dsp/VehicleAcoustics';
import { H, maxJump, turboMetrics } from '../../../src/audio/analysis/turboLab';
import { TURBO_DRIVE_PHASES } from '../../../src/audio/analysis/turboPhysics';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';
import { TRACKS } from '../../../src/data/tracks/index';
import { dB, golTurbo } from './turboTestUtils';

/**
 * Multiplayer: the opponent's voice is fed from 20 Hz snapshots (every 6th physics tick) that
 * OnlineRaceRenderer interpolates back to 120 Hz (linear, step channels held). The valve must still
 * fire, and the rotor pitch must not jump.
 */
const FS = 48000;
const SNAPSHOT_TICKS = 6;
const STEP_CHANNELS = [AF.crankAngle, AF.revLimiter, AF.combustionEnabled, AF.starterActive, AF.gear, AF.afterfire];

function driveFrames(car = golTurbo()): Float64Array[] {
  const sim = new VehicleSimulation(car, TRACKS[0]!);
  const frames: Float64Array[] = [];
  const redline = car.engine.redlineRpm;
  const gears = car.transmission.gearRatios.length;
  for (const p of [{ name: 'startup', seconds: 1.5, pedal: 0 }, ...TURBO_DRIVE_PHASES.slice(0, 5)]) {
    if ('engage' in p && p.engage && sim.gear === 0) sim.requestShift(1);
    for (let i = 0; i < Math.round(p.seconds / H); i++) {
      sim.controls.pedal = p.pedal;
      if ('autoShift' in p && p.autoShift && !sim.shift.active && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm > redline - 250 && sim.gear < gears) sim.requestShift(1);
      sim.step(H);
      frames.push(Float64Array.from(sim.audioFrame));
    }
  }
  return frames;
}

/** The OnlineRaceRenderer reconstruction: lerp between consecutive snapshots, step channels held. */
function viaSnapshots(frames: Float64Array[]): Float64Array[] {
  const out: Float64Array[] = [];
  for (let s = 0; s + SNAPSHOT_TICKS < frames.length; s += SNAPSHOT_TICKS) {
    const a = frames[s]!;
    const b = frames[s + SNAPSHOT_TICKS]!;
    for (let k = 0; k < SNAPSHOT_TICKS; k++) {
      const alpha = k / SNAPSHOT_TICKS;
      const f = new Float64Array(AF.length);
      for (let c = 0; c < AF.length; c++) f[c] = a[c]! + (b[c]! - a[c]!) * alpha;
      for (const c of STEP_CHANNELS) f[c] = (alpha < 0.5 ? a : b)[c]!;
      out.push(f);
    }
  }
  return out;
}

function render(frames: Float64Array[], quality: AcousticQuality): { turbo: Float32Array; voice: VehicleAcoustics } {
  const voice = new VehicleAcoustics(FS, carToAcousticConfig(golTurbo(), quality, 61));
  const per = Math.round(FS * H);
  const tmp = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(per));
  const turbo = new Float32Array(frames.length * per);
  frames.forEach((f, i) => {
    voice.pushFrame(f);
    voice.render(tmp, per);
    turbo.set(tmp[CH.turbo]!, i * per);
  });
  return { turbo, voice };
}

describe('Turbo Acoustics 2.1 — online snapshots (20 Hz, interpolated)', () => {
  const full = driveFrames();
  const online = viaSnapshots(full);

  for (const quality of ['high', 'low'] as const) {
    it(`${quality} quality: the valve still fires and the level matches the local voice`, { timeout: 60_000 }, () => {
      const a = render(full, quality);
      const b = render(online, quality);
      const bovA = a.voice.aux.turbo!.bov.events;
      const bovB = b.voice.aux.turbo!.bov.events;
      expect(bovA).toBeGreaterThan(0);
      expect(bovB).toBeGreaterThan(0);
      expect(Math.abs(bovB - bovA)).toBeLessThanOrEqual(1);
      const n = Math.min(a.turbo.length, b.turbo.length);
      const la = turboMetrics(a.turbo, FS, 0, n).aLevelDb;
      const lb = turboMetrics(b.turbo, FS, 0, n).aLevelDb;
      expect(Math.abs(la - lb)).toBeLessThan(1.5);
      // no clicks / pitch jumps introduced by the 20 Hz steps
      expect(dB(maxJump(b.turbo, 0, n))).toBeLessThan(dB(maxJump(a.turbo, 0, n)) + 3);
      expect(b.turbo.every(Number.isFinite)).toBe(true);
    });
  }
});
