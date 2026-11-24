import type { CarConfig, TrackConfig } from '../../data/schema';
import { VehicleSimulation } from '../../physics/vehicle/VehicleSimulation';
import { DragAI, type AiLevel } from '../ai/DragAI';
import type { OverrevSpec } from '../../physics/engine/EngineOverrevFailure';

/**
 * Standing-start acceleration test as a manufacturer runs it: engine running, first gear, flat
 * out with the best shift points, timed from the first movement of the car. The driver is the
 * game's AI, which only writes the controls the player has (throttle, upshift, downshift) – the
 * times result from the physics, never from a scripted speed or a corrected stopwatch.
 */
export interface AccelerationOptions {
  speedsKmh?: readonly number[];
  distancesM?: readonly number[];
  /** Simulated time after the start (s). Long enough to settle at top speed. */
  maxS?: number;
  /** Stop after the requested speed and distance splits. Top speed and slip then describe only that run. */
  stopAtLastSplit?: boolean;
  level?: AiLevel;
  seed?: number;
  /**
   * Extra mass carried during the test (kg). Period press tests ran with a second occupant and the
   * instrumentation (fifth wheel, recorder): the campaign cars whose targets come from press
   * sheets are tested with that payload; the Gol's manual figures are tested without it.
   */
  payloadKg?: number;
  nitrous?: DragAI['nitrousMode'];
  failureSpec?: OverrevSpec;
}

export interface AccelerationResult {
  /** Time to reach each speed (s), null if never reached. */
  speedTimes: Map<number, number | null>;
  /** Time to cover each distance (s), null if never reached. */
  distanceTimes: Map<number, number | null>;
  distanceSpeedsKmh: Map<number, number>;
  topSpeedKmh: number;
  /** Engine speed and gear when the top speed was reached. */
  topSpeedRpm: number;
  topSpeedGear: number;
  /** Upshifts: gear left, engine rpm when the shift started and time. */
  shifts: { from: number; rpm: number; t: number }[];
  /** Highest slip ratio of the driven tyres during the run. */
  maxSlipRatio: number;
  /** Time the driven tyres spent above 15 % slip (s). */
  wheelspinS: number;
  /** Driven axle and the share of the total wheel load on it at the start and at peak traction. */
  drivenLoadShare: { atRest: number; min: number; max: number };
  /** N₂O spent and injection time in the run (0 without a kit). */
  nitrousUsedKg: number;
  nitrousActiveS: number;
  nitrousPeakPowerCv: number;
  nitrousPeakTorqueNm: number;
  engineFailed: boolean;
}

const H = 1 / 120;

export function runAccelerationTest(car: CarConfig, track: TrackConfig, opts: AccelerationOptions = {}): AccelerationResult {
  const speeds = [...(opts.speedsKmh ?? [80, 100, 120])].sort((a, b) => a - b);
  const distances = [...(opts.distancesM ?? [400, 1000])].sort((a, b) => a - b);
  const lastSpeed = speeds.at(-1);
  const lastDistance = distances.at(-1);
  const maxS = opts.maxS ?? 120;
  const sim = new VehicleSimulation(opts.payloadKg ? { ...car, massKg: car.massKg + opts.payloadKg } : car, track);
  const ai = new DragAI(car, opts.level ?? 'advanced', opts.seed ?? 7);
  ai.nitrousMode = opts.nitrous ?? 'strategic';
  if (opts.failureSpec) sim.enableEngineFailure(opts.failureSpec);

  // ---- start the engine, select first gear, let everything settle
  let guard = 0;
  let readyAt: number | null = null;
  while (guard++ < 120 * 15) {
    ai.update(H, sim, { timeSinceGreen: null, staged: true, finished: false });
    sim.step(H);
    if (readyAt === null && sim.engine.runState === 'RUNNING' && sim.gear === 1 && !sim.shift.active) readyAt = sim.simTime;
    if (readyAt !== null && sim.simTime - readyAt > 1) break;
  }
  if (readyAt === null) throw new Error(`${car.id}: engine did not start or first gear was not engaged`);

  // ---- green: flat out
  const green = sim.simTime;
  const speedTimes = new Map<number, number | null>(speeds.map((s) => [s, null]));
  const distanceTimes = new Map<number, number | null>(distances.map((d) => [d, null]));
  const distanceSpeedsKmh = new Map<number, number>();
  const shifts: { from: number; rpm: number; t: number }[] = [];
  const loadShare = (): number => {
    const t = sim.telemetry;
    return t.normalLoadDriven / Math.max(1, t.normalLoadDriven + t.normalLoadFree);
  };
  const share = { atRest: loadShare(), min: 1, max: 0 };
  let t0: number | null = null;
  let top = 0;
  let topRpm = 0;
  let topGear = 0;
  let maxSlip = 0;
  let spin = 0;
  let nitrousPeakPowerCv = 0;
  let nitrousPeakTorqueNm = 0;
  let prevV = 0;
  let prevX = 0;
  let prevT = 0;
  let wasShifting = false;
  let x0 = sim.x;
  const steps = Math.round(maxS / H);
  for (let i = 0; i < steps; i++) {
    ai.update(H, sim, { timeSinceGreen: sim.simTime - green, staged: true, finished: false });
    const xBefore = sim.x;
    sim.step(H);
    const nitrous = sim.nitrous?.telemetry();
    if (nitrous) {
      nitrousPeakPowerCv = Math.max(nitrousPeakPowerCv, nitrous.additionalPowerW / 735.5);
      nitrousPeakTorqueNm = Math.max(nitrousPeakTorqueNm, nitrous.additionalTorqueNm);
    }
    if (sim.engine.runState === 'BROKEN') break;
    const v = sim.speed;
    if (t0 === null) {
      // the stopwatch starts with the first movement of the car (the step before it moved)
      if (v <= 0.05) continue;
      t0 = sim.simTime - H;
      x0 = xBefore;
    }
    const t = sim.simTime - t0;
    const x = sim.x - x0;
    for (const s of speeds) {
      const target = s / 3.6;
      if (speedTimes.get(s) === null && v >= target) speedTimes.set(s, prevT + ((target - prevV) / Math.max(v - prevV, 1e-9)) * (t - prevT));
    }
    for (const d of distances) {
      if (distanceTimes.get(d) === null && x >= d) {
        const fraction = (d - prevX) / Math.max(x - prevX, 1e-9);
        distanceTimes.set(d, prevT + fraction * (t - prevT));
        distanceSpeedsKmh.set(d, (prevV + fraction * (v - prevV)) * 3.6);
      }
    }
    if (sim.shift.active && !wasShifting) shifts.push({ from: sim.gear, rpm: sim.engine.rpm, t });
    wasShifting = sim.shift.active;
    const slip = sim.telemetry.slipRatio;
    maxSlip = Math.max(maxSlip, slip);
    if (slip > 0.15) spin += H;
    const sh = loadShare();
    share.min = Math.min(share.min, sh);
    share.max = Math.max(share.max, sh);
    if (v > top) {
      top = v;
      topRpm = sim.engine.rpm;
      topGear = sim.gear;
    }
    prevV = v;
    prevX = x;
    prevT = t;
    if (opts.stopAtLastSplit &&
      (lastSpeed === undefined || speedTimes.get(lastSpeed) !== null) &&
      (lastDistance === undefined || distanceTimes.get(lastDistance) !== null)) break;
  }
  return {
    speedTimes,
    distanceTimes,
    distanceSpeedsKmh,
    topSpeedKmh: top * 3.6,
    topSpeedRpm: topRpm,
    topSpeedGear: topGear,
    shifts,
    maxSlipRatio: maxSlip,
    wheelspinS: spin,
    drivenLoadShare: share,
    nitrousUsedKg: sim.nitrous?.telemetry().consumedKg ?? 0,
    nitrousActiveS: sim.nitrous?.telemetry().activeTimeS ?? 0,
    nitrousPeakPowerCv,
    nitrousPeakTorqueNm,
    engineFailed: sim.engine.runState === 'BROKEN',
  };
}
