import type { CarConfig, TrackConfig } from '../data/schema';
import { VehicleSimulation } from '../physics/vehicle/VehicleSimulation';
import type { VehicleSound } from '../audio/core/VehicleSound';

export const PHYSICS_DT = 1 / 120;
/** Never simulate more than this much real time per rendered frame (tab was hidden, debugger…). */
const MAX_FRAME_S = 0.25;

/**
 * The continuous quantities the renderer interpolates between two physics steps. Copied by value
 * (no references into the simulation), so rendering can never write back into the physics.
 */
export interface VehicleSnapshot {
  x: number;
  speed: number;
  pitch: number;
  wheelAngleDriven: number;
  wheelAngleFree: number;
}

/** Physics states before and after the last step, and where the rendered frame lies between them. */
export interface VehicleInterpolation {
  readonly prev: VehicleSnapshot;
  readonly cur: VehicleSnapshot;
  /** Fraction of a physics step of real time accumulated but not simulated yet (0..1). */
  alpha: number;
  /** Physics steps executed in the last rendered frame. */
  steps: number;
}

export function takeSnapshot(sim: VehicleSimulation, out: VehicleSnapshot): void {
  out.x = sim.x;
  out.speed = sim.speed;
  out.pitch = sim.pitch;
  out.wheelAngleDriven = sim.wheelAngleDriven;
  out.wheelAngleFree = sim.wheelAngleFree;
}

function copySnapshot(from: VehicleSnapshot, to: VehicleSnapshot): void {
  to.x = from.x;
  to.speed = from.speed;
  to.pitch = from.pitch;
  to.wheelAngleDriven = from.wheelAngleDriven;
  to.wheelAngleFree = from.wheelAngleFree;
}

function matches(s: VehicleSnapshot, sim: VehicleSimulation): boolean {
  return s.x === sim.x && s.speed === sim.speed && s.pitch === sim.pitch && s.wheelAngleDriven === sim.wheelAngleDriven && s.wheelAngleFree === sim.wheelAngleFree;
}

/** Linear interpolation between the two physics states of a vehicle (alpha clamped to 0..1). */
export function lerpSnapshot(i: VehicleInterpolation, key: keyof VehicleSnapshot): number {
  const a = i.alpha <= 0 ? 0 : i.alpha >= 1 ? 1 : i.alpha;
  const p = i.prev[key];
  return p + (i.cur[key] - p) * a;
}

export interface RunnerVehicle {
  id: string;
  sim: VehicleSimulation;
  /** Lane offset for rendering (m, + = towards the camera). */
  lane: number;
  isPlayer: boolean;
  sound: VehicleSound | null;
  /** Called before every physics step (player input, AI, race logic). */
  control?: (h: number, v: RunnerVehicle) => void;
  /** Render interpolation state, maintained by the runner (read-only for everyone else). */
  readonly interp: VehicleInterpolation;
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
 *
 * Rendering: the state before and after each step is kept per vehicle, and after every frame
 * `interp.alpha` tells how far the real clock is between them. Drawing lerp(prev, cur, alpha)
 * makes the on-screen motion follow the real clock exactly instead of jumping by whole steps
 * (one frame advancing 1 step and the next 3 steps reads as the car shaking back and forth).
 * The drawn state lags the physics by at most one step (8.3 ms).
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
    const interp: VehicleInterpolation = {
      prev: { x: 0, speed: 0, pitch: 0, wheelAngleDriven: 0, wheelAngleFree: 0 },
      cur: { x: 0, speed: 0, pitch: 0, wheelAngleDriven: 0, wheelAngleFree: 0 },
      alpha: 0,
      steps: 0,
    };
    const v: RunnerVehicle = { id: opts.id, sim, lane: opts.lane, isPlayer: opts.isPlayer, sound: opts.sound ?? null, interp };
    this.snap(v);
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
    // a car moved outside a physics step (reset, teleport): show the new state at once instead
    // of animating from the old one
    for (const v of this.vehicles) if (!matches(v.interp.cur, v.sim)) this.snap(v);
    if (this.paused) {
      this.stats.lastFrameSteps = 0;
      this.publish(0);
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
    this.publish(n);
    for (const v of this.vehicles) v.sound?.flush();
  }

  private publish(steps: number): void {
    // paused (or single-stepped in the Developer Lab): show the latest physics state exactly
    const a = this.paused ? 1 : this.alpha;
    for (const v of this.vehicles) {
      v.interp.alpha = a;
      v.interp.steps = steps;
    }
  }

  /** Makes the next rendered frame show this vehicle exactly at its current state. */
  snap(v: RunnerVehicle): void {
    takeSnapshot(v.sim, v.interp.cur);
    copySnapshot(v.interp.cur, v.interp.prev);
  }

  /** Exactly one physics step (also used by the Developer Lab single-step button). */
  stepOnce(): void {
    const h = PHYSICS_DT;
    for (const v of this.vehicles) v.control?.(h, v);
    for (const v of this.vehicles) {
      // a control hook may have moved the car (back to the line): that is a cut, not motion
      if (!matches(v.interp.cur, v.sim)) takeSnapshot(v.sim, v.interp.cur);
      copySnapshot(v.interp.cur, v.interp.prev);
      v.sim.step(h);
      takeSnapshot(v.sim, v.interp.cur);
      v.sound?.pushFrame(v.sim.audioFrame);
    }
    this.simTime += h;
    this.stats.steps++;
    for (const hook of this.afterStep) hook(h, this.simTime);
  }

  /** Interpolation factor between the last two physics states (for smooth rendering), 0..1. */
  get alpha(): number {
    return Math.min(1, Math.max(0, this.accumulator / PHYSICS_DT));
  }

  resetAll(): void {
    this.accumulator = 0;
    this.simTime = 0;
    for (const v of this.vehicles) {
      v.sim.reset();
      v.sound?.reset();
      this.snap(v);
      v.interp.alpha = 0;
    }
  }

  dispose(): void {
    for (const v of this.vehicles) v.sound?.dispose();
    this.vehicles.length = 0;
    this.afterStep.length = 0;
  }
}
