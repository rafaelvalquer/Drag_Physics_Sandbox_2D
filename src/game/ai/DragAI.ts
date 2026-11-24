import type { CarConfig } from '../../data/schema';
import { MonotoneCubic, clamp, clamp01 } from '../../core/math';
import { Prng } from '../../core/prng';
import type { VehicleSimulation } from '../../physics/vehicle/VehicleSimulation';
import { TireModel } from '../../physics/vehicle/TireModel';
import { launchTargetRpm } from '../../physics/drivetrain/AutomaticClutchController';

export type AiLevel = 'beginner' | 'intermediate' | 'advanced';

export interface AiProfile {
  reactionMeanS: number;
  reactionJitterS: number;
  /**
   * Traction control: null = flat out (no throttle modulation). Otherwise the driver aims at a
   * fraction of the tire's peak slip ratio and a fraction of the available tire force.
   */
  traction: { slipFraction: number; forceFraction: number; trimGain: number; updateHz: number } | null;
  /** Offset from the computed optimal shift rpm. */
  shiftOffsetRpm: number;
  shiftJitterRpm: number;
  /** Probability of a premature start (red light). */
  jumpStartChance: number;
}

export const AI_PROFILES: Record<AiLevel, AiProfile> = {
  beginner: {
    reactionMeanS: 0.42,
    reactionJitterS: 0.12,
    traction: null,
    shiftOffsetRpm: -650,
    shiftJitterRpm: 350,
    jumpStartChance: 0.05,
  },
  intermediate: {
    reactionMeanS: 0.27,
    reactionJitterS: 0.06,
    traction: { slipFraction: 1.8, forceFraction: 0.85, trimGain: 1.5, updateHz: 12 },
    shiftOffsetRpm: -250,
    shiftJitterRpm: 150,
    jumpStartChance: 0.02,
  },
  advanced: {
    reactionMeanS: 0.16,
    reactionJitterS: 0.025,
    traction: { slipFraction: 1.0, forceFraction: 1.0, trimGain: 4, updateHz: 60 },
    shiftOffsetRpm: -40,
    shiftJitterRpm: 40,
    jumpStartChance: 0,
  },
};

/**
 * Optimal upshift points: for each gear the engine speed where the wheel force in the next gear
 * becomes larger than in the current one (same road speed), from the configured WOT torque curve.
 * If the current gear always pulls harder, shift just below the rev limiter.
 */
export function optimalShiftRpms(car: CarConfig): number[] {
  const e = car.engine;
  const t = car.transmission;
  const curve = new MonotoneCubic(e.torqueCurve.rpm, e.torqueCurve.torqueNm);
  const res: number[] = [];
  for (let g = 0; g < t.gearRatios.length - 1; g++) {
    const r0 = t.gearRatios[g]!;
    const r1 = t.gearRatios[g + 1]!;
    let shift = e.revLimitRpm - 120;
    for (let rpm = e.idleRpm + 1500; rpm < e.revLimitRpm - 120; rpm += 25) {
      const nextRpm = (rpm * r1) / r0;
      const f0 = curve.evaluate(rpm) * r0;
      const f1 = curve.evaluate(nextRpm) * r1;
      if (f1 > f0) {
        shift = rpm;
        break;
      }
    }
    res.push(shift);
  }
  return res;
}

/** Slip ratio at which the configured tire produces its peak longitudinal force. */
export function peakSlipRatio(car: CarConfig): number {
  const t = car.tires;
  let best = 0.1;
  let bestMu = -1;
  for (let k = 0.01; k <= 1; k += 0.0025) {
    const mu = TireModel.shape(k, t.B, t.C, t.E).mu;
    if (mu > bestMu) {
      bestMu = mu;
      best = k;
    }
  }
  return best;
}

export interface AiRaceView {
  /** Seconds since the green light (negative before). null while the tree has not started. */
  timeSinceGreen: number | null;
  staged: boolean;
  finished: boolean;
}

/**
 * Deterministic drag-race AI. It only writes the throttle request and shift requests of its
 * vehicle – exactly the controls the player has. Difficulty changes reaction, throttle precision
 * and shift points, never torque or speed.
 */
export class DragAI {
  readonly profile: AiProfile;
  readonly shiftPoints: number[];
  private readonly prng: Prng;
  private reaction: number;
  private jumpStart: boolean;
  private shiftJitter: number[];
  /** Highest nitrous stage the driver will start (0 = never): lab tests of one stage or of none. */
  nitrousMode: 'off' | 'continuous' | 'strategic' = 'strategic';
  private pedal = 0;
  private lastShiftAt = -10;
  private tcTrim = 0;
  private tcTimer = 0;
  readonly kappaPeak: number;
  enabled = true;

  constructor(
    public readonly car: CarConfig,
    public readonly level: AiLevel,
    seed = 1234,
    /** Driver skill of a named rival (career). Same controls and physics; only the driver differs. */
    profile?: AiProfile,
  ) {
    this.profile = profile ?? AI_PROFILES[level];
    this.prng = new Prng(seed);
    this.shiftPoints = optimalShiftRpms(car);
    this.kappaPeak = peakSlipRatio(car);
    this.reaction = 0;
    this.jumpStart = false;
    this.shiftJitter = [];
    this.newRace();
  }

  newRace(): void {
    const p = this.profile;
    this.reaction = Math.max(0.08, p.reactionMeanS + this.prng.gaussian() * p.reactionJitterS);
    this.jumpStart = this.prng.next() < p.jumpStartChance;
    this.shiftJitter = this.shiftPoints.map(() => this.prng.gaussian() * p.shiftJitterRpm);
    this.pedal = 0;
    this.lastShiftAt = -10;
    this.tcTrim = 0;
    this.tcTimer = 0;
  }

  get reactionTime(): number {
    return this.reaction;
  }

  update(h: number, sim: VehicleSimulation, race: AiRaceView): void {
    sim.nitrousHeld = false;
    if (!this.enabled) return;
    const c = sim.controls;
    if (race.finished) {
      c.pedal = 0;
      return;
    }
    const running = sim.engine.runState === 'RUNNING';
    // stage: select first gear once the engine runs
    if (running && sim.gear === 0 && !sim.shift.active && race.staged) {
      sim.requestShift(1);
    }
    const t = race.timeSinceGreen;
    const go = t !== null && (t >= this.reaction || (this.jumpStart && t >= -0.12));
    if (!go) {
      c.pedal = 0;
      this.pedal = 0;
      return;
    }
    const p = this.profile;
    const slip = sim.telemetry.slipRatio;
    this.updateThrottle(h, sim, slip);
    c.pedal = this.pedal;

    const nit = sim.nitrous;
    sim.nitrousHeld = !!nit && this.nitrousMode !== 'off' && nit.remainingFraction > 0 &&
      race.timeSinceGreen !== null && !race.finished && c.pedal > 0.8 &&
      sim.engine.nitrousInjectable && sim.engine.rpm >= nit.setup.minRpm &&
      (this.nitrousMode === 'continuous' ? sim.gear >= 1 :
        sim.gear >= 2 && sim.speed > 12 && slip < (nit.active ? 0.15 : 0.10));

    // shifting
    const g = sim.gear;
    // an automatic with torque converter is driven in D: its shift schedule does the shifting
    const selfShifting = sim.transmissionKind === 'torque-converter-auto' && !sim.car.transmission.playerShifts;
    if (!selfShifting && g >= 1 && g < sim.gearbox.gearCount && !sim.shift.active && sim.simTime - this.lastShiftAt > 0.4) {
      const target = this.shiftPoints[g - 1]! + p.shiftOffsetRpm + (this.shiftJitter[g - 1] ?? 0);
      // Engine rpm only reflects road speed once the clutch is locked; skilled drivers also ignore
      // revs produced by wheelspin.
      // an automatic has no clutch to lock: its converter is coupled once input and output turn alike
      const locked = sim.transmissionKind === 'torque-converter-auto' ? (sim.telemetry.converterSpeedRatio ?? 1) > 0.85 : sim.clutchCtl.mode === 'LOCKED';
      const spinning = slip > 0.5 && p.traction !== null;
      const roadRpm = (sim.speed / sim.car.tires.radiusM) * sim.gearbox.overallRatio(g) * (60 / (2 * Math.PI));
      const limit = sim.car.engine.revLimitRpm - 60;
      if ((locked && !spinning && sim.engine.rpm >= Math.min(target, limit)) || roadRpm >= limit) {
        sim.requestShift(1);
        this.lastShiftAt = sim.simTime;
      }
    }
  }
  /**
   * Throttle. Flat out without traction control; otherwise a driver model that knows its car:
   * feed-forward engine torque that puts the available tire force on the road
   *   T_e = F_tire·r/(G·η) + I_e·a·G/r
   * converted to a pedal position with the engine torque map, and corrected by an integral trim on
   * the measured slip ratio. Only the pedal is written – the physics is the same as the player's.
   */
  private launchPedal(sim: VehicleSimulation, torqueNm: number, minPedal = 0.5 / 1.15): number {
    const e = sim.car.engine;
    const launchRpm = sim.car.transmission.clutch.launchRpm;
    const boost = sim.engine.turbo ? sim.engine.turbo.boostPa : 0;
    const torqueAt = (p: number): number =>
      sim.engine.steadyNetTorque(sim.engine.plateOpeningForPedal(p), launchTargetRpm(p, e.idleRpm, launchRpm), boost);
    // launch at least half-way between idle and the launch speed (a low-rpm launch bogs), unless
    // the tyres are already spinning there (boost building on a turbo engine)
    const pMin = minPedal;
    if (torqueAt(1) <= torqueNm) return 1;
    if (torqueAt(pMin) >= torqueNm) return pMin;
    let lo = pMin;
    let hi = 1;
    for (let i = 0; i < 14; i++) {
      const mid = 0.5 * (lo + hi);
      if (torqueAt(mid) < torqueNm) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  private updateThrottle(h: number, sim: VehicleSimulation, slip: number): void {
    const tc = this.profile.traction;
    if (tc === null) {
      this.pedal = 1;
      return;
    }
    this.tcTimer -= h;
    if (this.tcTimer > 0) return;
    const dt = 1 / tc.updateHz;
    this.tcTimer += dt;
    const g = sim.gear;
    const ratio = g >= 1 ? sim.gearbox.overallRatio(g) : 0;
    if (ratio <= 0) {
      this.pedal = 1;
      return;
    }
    // during a shift the shift controller owns torque (cut / blip); the driver holds the pedal
    if (sim.shift.active) return;
    const car = sim.car;
    const slipTarget = this.kappaPeak * tc.slipFraction;
    const fTire = sim.telemetry.tireForceMax * tc.forceFraction;
    const r = car.tires.radiusM;
    const accel = fTire / car.massKg;
    const tEngine = (fTire * r) / (ratio * car.transmission.efficiency) + (car.engine.inertiaKgM2 * accel * ratio) / r;
    // Launch (clutch still slipping): the pedal also sets the speed the clutch logic holds, so
    // pick the pedal whose torque at that speed matches the tire-limited request.
    if (sim.clutchCtl.mode !== 'LOCKED') {
      // Slip feedback during the launch only takes torque away: with a turbo the torque of a
      // given pedal keeps rising while the boost builds, so the driver lifts as the tyre goes past
      // its peak slip. Without excess slip the trim stays 0 and the launch is the feed-forward one.
      const errL = clamp((slipTarget - slip) / slipTarget, -3, 1);
      this.tcTrim = Math.min(0, clamp(this.tcTrim + dt * tc.trimGain * errL * 0.5, -0.6, 0.6));
      const floor = this.tcTrim < 0 ? 0.15 : 0.5 / 1.15;
      this.pedal = this.launchPedal(sim, tEngine * Math.max(1 + this.tcTrim, 0.25), floor);
      return;
    }
    const err = clamp((slipTarget - slip) / slipTarget, -3, 1);
    this.tcTrim = clamp(this.tcTrim + dt * tc.trimGain * err * 0.5, -0.6, 0.6);
    // never below 25 % of the feed-forward: the tire must still pull while it recovers
    const request = tEngine * Math.max(1 + this.tcTrim + 0.15 * err, 0.25);
    const opening = sim.engine.openingForTorque(request, Math.max(sim.engine.rpm, car.engine.idleRpm));
    this.pedal = clamp01(sim.engine.pedalForPlateOpening(opening));
  }
}


/** Utility for tests: engine speed (rad/s) of a given gear at a road speed. */
export function engineOmegaAt(car: CarConfig, gear: number, speed: number): number {
  const ratio = car.transmission.gearRatios[gear - 1]! * car.transmission.finalDrive;
  return (speed / car.tires.radiusM) * ratio;
}

