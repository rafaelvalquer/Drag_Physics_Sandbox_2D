import type { CarConfig, TrackConfig } from '../data/schema';
import { VehicleSimulation } from '../physics/vehicle/VehicleSimulation';
import type { VehicleSound } from '../audio/core/VehicleSound';

export const PHYSICS_DT = 1 / 120;
/** Never simulate more than this much real time per rendered frame (tab was hidden, debugger…). */
const MAX_FRAME_S = 0.25;

export interface RunnerVehicle {
  id: string;
  sim: VehicleSimulation;
  /** Lane offset for rendering (m, + = towards the camera). */
  lane: number;
  isPlayer: boolean;
  sound: VehicleSound | null;
  /** Called before every physics step (player input, AI, race logic). */
  control?: (h: number, v: RunnerVehicle) => void;
}

export interface RunnerStats {
  /** Physics steps executed since start. */
  steps: number;
  /** Real time that was not simulated because a frame exceeded MAX_FRAME_S (honest counter). */
  droppedRealTimeS: number;
  /** Average wall time of one physics step of all vehicles (ms). */
  stepMs: number;
  /** Steps executed in the last frame. */
  lastFrameSteps: number;
}

/**
 * Fixed-step simulation loop decoupled from rendering: real elapsed time is accumulated and the
 * physics is advanced in exact 1/120 s steps (the render frame rate never changes the physics).
 * Each step's audio control frame is queued on the vehicle's voice; queued frames are posted to
 * the AudioWorklet once per rendered frame.
 */
export class SimulationRunner {
  readonly vehicles: RunnerVehicle[] = [];
  private accumulator = 0;
  paused = false;
  /** Hooks run once per physics step after all vehicles stepped (race timing). */
  readonly afterStep: ((h: number, simTime: number) => void)[] = [];
  readonly stats: RunnerStats = { steps: 0, droppedRealTimeS: 0, stepMs: 0, lastFrameSteps: 0 };
  simTime = 0;

  constructor(public track: TrackConfig) {}

  add(car: CarConfig, opts: { id: string; lane: number; isPlayer: boolean; sound?: VehicleSound | null; x?: number }): RunnerVehicle {
    const sim = new VehicleSimulation(car, this.track);
    if (opts.x) sim.x = opts.x;
    const v: RunnerVehicle = { id: opts.id, sim, lane: opts.lane, isPlayer: opts.isPlayer, sound: opts.sound ?? null };
    this.vehicles.push(v);
    return v;
  }

  remove(id: string): void {
    const i = this.vehicles.findIndex((v) => v.id === id);
    if (i >= 0) {
      this.vehicles[i]!.sound?.dispose();
      this.vehicles.splice(i, 1);
    }
  }

  get player(): RunnerVehicle | undefined {
    return this.vehicles.find((v) => v.isPlayer);
  }

  setTrack(track: TrackConfig, keepTyreTemp = false): void {
    this.track = track;
    for (const v of this.vehicles) v.sim.applyTrack(track, keepTyreTemp);
  }

  /** Advances by the real elapsed time `realDt` (s). */
  advance(realDt: number): void {
    if (this.paused) {
      this.stats.lastFrameSteps = 0;
      return;
    }
    let dt = realDt;
    if (dt > MAX_FRAME_S) {
      this.stats.droppedRealTimeS += dt - MAX_FRAME_S;
      dt = MAX_FRAME_S;
    }
    this.accumulator += dt;
    let n = 0;
    const t0 = performance.now();
    while (this.accumulator >= PHYSICS_DT) {
      this.stepOnce();
      this.accumulator -= PHYSICS_DT;
      n++;
    }
    if (n > 0) {
      const ms = (performance.now() - t0) / n;
      this.stats.stepMs = this.stats.stepMs * 0.95 + ms * 0.05;
    }
    this.stats.lastFrameSteps = n;
    for (const v of this.vehicles) v.sound?.flush();
  }

  /** Exactly one physics step (also used by the Developer Lab single-step button). */
  stepOnce(): void {
    const h = PHYSICS_DT;
    for (const v of this.vehicles) v.control?.(h, v);
    for (const v of this.vehicles) {
      v.sim.step(h);
      v.sound?.pushFrame(v.sim.audioFrame);
    }
    this.simTime += h;
    this.stats.steps++;
    for (const hook of this.afterStep) hook(h, this.simTime);
  }

  /** Interpolation factor between the last two physics states (for smooth rendering). */
  get alpha(): number {
    return this.accumulator / PHYSICS_DT;
  }

  resetAll(): void {
    this.accumulator = 0;
    this.simTime = 0;
    for (const v of this.vehicles) {
      v.sim.reset();
      v.sound?.reset();
    }
  }

  dispose(): void {
    for (const v of this.vehicles) v.sound?.dispose();
    this.vehicles.length = 0;
    this.afterStep.length = 0;
  }
}
