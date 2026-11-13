import { AF } from '../../../src/core/contracts';
import { findCar } from '../../../src/data/cars/index';
import type { CarConfig } from '../../../src/data/schema';
import { CHANNEL_COUNT, carToAcousticConfig, type AcousticVehicleConfig } from '../../../src/audio/dsp/AcousticConfig';
import { VehicleAcoustics } from '../../../src/audio/dsp/VehicleAcoustics';

export const H = 1 / 120;

export function car(id: string): CarConfig {
  const c = findCar(id);
  if (!c) throw new Error(`car ${id} missing`);
  return c;
}

export interface OperatingPoint {
  rpm: number;
  load: number;
  combustion?: boolean;
  sparkCut?: number;
  egtK?: number;
}

/**
 * Renders a voice driven by synthetic steady telemetry (no physics), returning every channel.
 * `schedule(t)` may change the operating point over time.
 */
export function renderSynthetic(
  cfg: AcousticVehicleConfig,
  sampleRate: number,
  seconds: number,
  schedule: (t: number) => OperatingPoint,
  opts: { stopFramesAt?: number; resumeFramesAt?: number; noise?: (f: Float64Array, i: number) => void } = {},
): { ch: Float32Array[]; voice: VehicleAcoustics } {
  const voice = new VehicleAcoustics(sampleRate, cfg);
  const total = Math.round(seconds * sampleRate);
  const ch = Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(total));
  const f = new Float64Array(AF.length);
  let theta = 0;
  let written = 0;
  let acc = 0;
  const steps = Math.ceil(seconds / H);
  for (let i = 0; i < steps; i++) {
    const t = i * H;
    const p = schedule(t);
    const w = (p.rpm * 2 * Math.PI) / 60;
    theta = (theta + w * H) % (4 * Math.PI);
    f.fill(0);
    f[AF.simTime] = t;
    f[AF.omega] = w;
    f[AF.crankAngle] = theta;
    f[AF.throttle] = p.load;
    f[AF.load] = p.load;
    f[AF.manifoldPressure] = 101325 * Math.max(0.2, p.load);
    f[AF.combustionEnabled] = p.combustion === false ? 0 : 1;
    f[AF.sparkCut] = p.sparkCut ?? 0;
    f[AF.exhaustTempK] = p.egtK ?? 650 + 450 * p.load * Math.min(1, p.rpm / 6000);
    opts.noise?.(f, i);
    const stopped = opts.stopFramesAt !== undefined && t >= opts.stopFramesAt && (opts.resumeFramesAt === undefined || t < opts.resumeFramesAt);
    if (!stopped) voice.pushFrame(f);
    acc += sampleRate * H;
    const n = Math.min(Math.floor(acc), total - written);
    acc -= Math.floor(acc);
    if (n > 0) {
      voice.render(ch, n, written);
      written += n;
    }
  }
  return { ch, voice };
}

export function withFiring(c: CarConfig, angles: number[], crankType: CarConfig['engine']['crankType']): CarConfig {
  const copy: CarConfig = JSON.parse(JSON.stringify(c));
  copy.engine.firingAnglesDeg = angles;
  copy.engine.crankType = crankType;
  return copy;
}

export { carToAcousticConfig };
