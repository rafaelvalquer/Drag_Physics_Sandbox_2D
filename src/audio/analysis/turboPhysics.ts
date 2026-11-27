/**
 * Physics-driven turbo renders: the real VehicleSimulation drives the voice, so spool, boost, BOV
 * flow, gear shifts and the rev limiter are exactly what the game produces for a resolved build.
 */
import { AF } from '../../core/contracts';
import type { CarConfig } from '../../data/schema';
import { TRACKS } from '../../data/tracks/index';
import { VehicleSimulation } from '../../physics/vehicle/VehicleSimulation';
import { CHANNEL_COUNT, carToAcousticConfig, type AcousticQuality, type AcousticVehicleConfig } from '../dsp/AcousticConfig';
import { VehicleAcoustics } from '../dsp/VehicleAcoustics';
import { H, type TurboFrameMeta, type TurboRender } from './turboLab';

export interface DrivePhase {
  name: string;
  seconds: number;
  pedal: number;
  autoShift?: boolean;
  /** Select first gear at the start of the phase (the simulation starts in neutral). */
  engage?: boolean;
}

/** Launch, full-throttle run through the gears, tip-out under boost, re-open, lift and coast. */
export const TURBO_DRIVE_PHASES: readonly DrivePhase[] = [
  { name: 'idle', seconds: 1.5, pedal: 0 },
  { name: 'launch', seconds: 2.5, pedal: 1, engage: true },
  { name: 'run', seconds: 5, pedal: 1, autoShift: true },
  { name: 'tip-out', seconds: 1.6, pedal: 0 },
  { name: 'reopen', seconds: 2.5, pedal: 1, autoShift: true },
  { name: 'lift', seconds: 2.5, pedal: 0 },
];

export interface PhysicsTurboRender extends TurboRender {
  /** Start sample of every phase. */
  phaseStart: Record<string, number>;
  /** Physics telemetry (max values) for the report. */
  maxBoostPa: number;
  maxShaftRpm: number;
  maxBovFlow: number;
  voiceMsPerAudioSecond: number;
}

export function renderTurboPhysics(
  car: CarConfig,
  sampleRate: number,
  opts: { quality?: AcousticQuality; phases?: readonly DrivePhase[]; seed?: number; acoustic?: (c: AcousticVehicleConfig) => AcousticVehicleConfig; tap?: VehicleAcoustics['turboTap'] } = {},
): PhysicsTurboRender {
  const phases = opts.phases ?? TURBO_DRIVE_PHASES;
  const base = carToAcousticConfig(car, opts.quality ?? 'high', opts.seed ?? 1);
  const cfg = opts.acoustic ? opts.acoustic(base) : base;
  const voice = new VehicleAcoustics(sampleRate, cfg);
  voice.turboTap = opts.tap ?? null;
  const sim = new VehicleSimulation(car, TRACKS[0]!);
  const startupS = 1.5;
  const totalS = startupS + phases.reduce((s, p) => s + p.seconds, 0);
  const total = Math.round(totalS * sampleRate);
  const ch = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(total));
  const tmp = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(Math.ceil(sampleRate * H) + 2));
  const meta: TurboFrameMeta[] = [];
  const phaseStart: Record<string, number> = {};
  let written = 0;
  let acc = 0;
  let maxBoostPa = 0;
  let maxShaftRpm = 0;
  let maxBovFlow = 0;
  let voiceMs = 0;
  let measuredSamples = 0;
  const redline = car.engine.redlineRpm;
  const gears = car.transmission.gearRatios.length;
  const run = (seconds: number, pedal: number, autoShift: boolean, engage = false): void => {
    const n = Math.round(seconds / H);
    if (engage && sim.gear === 0) sim.requestShift(1);
    for (let i = 0; i < n; i++) {
      sim.controls.pedal = pedal;
      if (autoShift && !sim.shift.active && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm > redline - 250 && sim.gear < gears) sim.requestShift(1);
      sim.step(H);
      const a = sim.audioFrame;
      maxBoostPa = Math.max(maxBoostPa, a[AF.boostPressure]!);
      maxShaftRpm = Math.max(maxShaftRpm, a[AF.turboShaftRpm]!);
      maxBovFlow = Math.max(maxBovFlow, a[AF.bovFlow]!);
      meta.push({
        t: a[AF.simTime]!,
        shaftRpm: a[AF.turboShaftRpm]!,
        shaftRpm2: a[AF.turboShaftRpm2]!,
        boostPa: a[AF.boostPressure]!,
        bovFlow: a[AF.bovFlow]!,
        throttle: a[AF.throttle]!,
        rpm: (a[AF.omega]! * 60) / (2 * Math.PI),
      });
      acc += sampleRate * H;
      const m = Math.min(Math.floor(acc), total - written);
      acc -= Math.floor(acc);
      const measure = written >= startupS * sampleRate;
      const start = measure ? performance.now() : 0;
      voice.pushFrame(a);
      if (m > 0) {
        voice.render(tmp, m);
        if (measure) {
          voiceMs += performance.now() - start;
          measuredSamples += m;
        }
        for (let k = 0; k < CHANNEL_COUNT; k++) ch[k]!.set(tmp[k]!.subarray(0, m), written);
        written += m;
      }
    }
  };
  run(startupS, 0, false);
  for (const p of phases) {
    phaseStart[p.name] = written;
    run(p.seconds, p.pedal, p.autoShift === true, p.engage === true);
  }
  return { ch, meta, voice, sampleRate, phaseStart, maxBoostPa, maxShaftRpm, maxBovFlow, voiceMsPerAudioSecond: voiceMs * sampleRate / measuredSamples };
}

/**
 * Physics fingerprint of a car: FNV-1a over every audio-control frame of a fixed drive (same
 * phases and inputs), plus the car configuration without its acoustic block. Used to prove that the
 * turbo sound work leaves the physics bit-identical (docs/audio-turbo/before/physics-fingerprint.json).
 */
export function physicsFingerprint(car: CarConfig, phases: readonly DrivePhase[] = TURBO_DRIVE_PHASES): { config: string; frames: string; maxBoostPa: number; maxShaftRpm: number; distanceM: number } {
  const fnv = (h: number, bytes: Uint8Array): number => {
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i]!, 16777619) >>> 0;
    return h;
  };
  const { acoustic: _a, ...rest } = car as CarConfig & Record<string, unknown>;
  const cfg = fnv(2166136261, new TextEncoder().encode(JSON.stringify(rest)));
  const sim = new VehicleSimulation(car, TRACKS[0]!);
  let h = 2166136261;
  let maxBoostPa = 0;
  let maxShaftRpm = 0;
  const redline = car.engine.redlineRpm;
  const gears = car.transmission.gearRatios.length;
  for (const p of [{ name: 'startup', seconds: 1.5, pedal: 0 } as DrivePhase, ...phases]) {
    if (p.engage && sim.gear === 0) sim.requestShift(1);
    for (let i = 0; i < Math.round(p.seconds / H); i++) {
      sim.controls.pedal = p.pedal;
      if (p.autoShift && !sim.shift.active && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm > redline - 250 && sim.gear < gears) sim.requestShift(1);
      sim.step(H);
      const a = Float64Array.from(sim.audioFrame);
      h = fnv(h, new Uint8Array(a.buffer));
      maxBoostPa = Math.max(maxBoostPa, a[AF.boostPressure]!);
      maxShaftRpm = Math.max(maxShaftRpm, a[AF.turboShaftRpm]!);
    }
  }
  return { config: cfg.toString(16), frames: h.toString(16), maxBoostPa, maxShaftRpm, distanceM: sim.telemetry.distance };
}

/** FNV-1a over the raw float bytes of a rendered channel. */
export function fnvFloat32(x: Float32Array): string {
  let h = 2166136261;
  const b = new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i]!, 16777619) >>> 0;
  return h.toString(16);
}

/** Drive used by the per-channel regression hashes (shorter than the full drive). */
export const HASH_PHASES = TURBO_DRIVE_PHASES.slice(0, 4);
export const HASH_CARS = ['arco-1600', 'vw-gol-gts-1988', 'nissan-370z-2014'];
export const HASH_TURBO_BUILDS = ['vw-gol-gts-1988', 'bmw-320i-f30-2014', 'nissan-gtr-r35-2015'];
