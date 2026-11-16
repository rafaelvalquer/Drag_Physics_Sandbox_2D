import type { CarConfig, TrackConfig } from '../../data/schema';
import { VehicleSimulation } from '../../physics/vehicle/VehicleSimulation';
import { DragAI, type AiProfile } from '../ai/DragAI';
import { RaceController, type LaneResult, type RaceDistanceId } from '../race/RaceController';

/**
 * A complete drag race without rendering: the same RaceController (tree, neutral start, RT, ET,
 * splits, red light, DNF), the same VehicleSimulation and DragAI drivers on both lanes. Used by
 * the balancing script and the career tests; the visible race runs the very same objects through
 * the SimulationRunner.
 */
export interface HeadlessLane {
  car: CarConfig;
  name: string;
  profile: AiProfile;
  seed: number;
}

export interface HeadlessRaceResult {
  lanes: [LaneResult, LaneResult];
  winner: number | null;
  /** Diagnostics of each lane for the evaluator (launch rpm, slip). */
  telemetry: [LaneTelemetry, LaneTelemetry];
}

export interface LaneTelemetry {
  launchRpm: number;
  maxSlipRatio: number;
  wheelspinS: number;
  shiftRpms: number[];
  clutchSlipS: number;
}

const H = 1 / 120;

export function runHeadlessRace(a: HeadlessLane, b: HeadlessLane, track: TrackConfig, distance: RaceDistanceId, seed = 1): HeadlessRaceResult {
  const lanes = [a, b].map((l) => {
    const sim = new VehicleSimulation(l.car, track);
    const ai = new DragAI(l.car, 'advanced', l.seed, l.profile);
    return { sim, ai, name: l.name };
  });
  const race = new RaceController(lanes, distance, 'pro', seed);
  const tele = lanes.map(() => new TelemetryProbe());
  let guard = 0;
  while (race.phase !== 'finished' && guard++ < 120 * 90) {
    race.beforeStep(H);
    for (const l of lanes) l.sim.step(H);
    race.afterStep(H);
    lanes.forEach((l, i) => tele[i]!.sample(l.sim, race.greenAt !== null && race.time >= race.greenAt, H));
  }
  const r = race.results;
  return { lanes: [r[0]!, r[1]!], winner: race.winner, telemetry: [tele[0]!.result(), tele[1]!.result()] };
}

/** Collects what the mechanic comments on: launch speed, wheelspin, shift points, clutch slip. */
export class TelemetryProbe {
  private launchRpm = 0;
  private launched = false;
  private maxSlip = 0;
  private spin = 0;
  private clutchSlip = 0;
  private lastGear = 0;
  private lastRpm = 0;
  /** Time since the last gear change ended (the clutch normally re-engages within it). */
  private sinceShift = 0;
  private readonly shifts: number[] = [];

  sample(sim: VehicleSimulation, racing: boolean, h: number): void {
    if (!racing) {
      this.lastGear = sim.gear;
      this.lastRpm = sim.engine.rpm;
      return;
    }
    if (!this.launched && sim.speed > 0.3) {
      this.launched = true;
      this.launchRpm = sim.engine.rpm;
    }
    const s = Math.abs(sim.telemetry.slipRatio);
    if (sim.speed > 0.5) {
      this.maxSlip = Math.max(this.maxSlip, s);
      if (s > 0.15) this.spin += h;
    }
    this.sinceShift = sim.shift.active ? 0 : this.sinceShift + h;
    // slip that outlasts the normal re-engagement after a shift = the disc cannot hold the torque
    if (this.launched && sim.gear >= 2 && sim.clutchCtl.mode !== 'LOCKED' && this.sinceShift > 0.6) this.clutchSlip += h;
    if (sim.gear > this.lastGear && this.lastGear >= 1) this.shifts.push(this.lastRpm);
    if (!sim.shift.active) this.lastRpm = sim.engine.rpm;
    this.lastGear = sim.gear;
  }

  result(): LaneTelemetry {
    return { launchRpm: this.launchRpm, maxSlipRatio: this.maxSlip, wheelspinS: this.spin, shiftRpms: [...this.shifts], clutchSlipS: this.clutchSlip };
  }
}
