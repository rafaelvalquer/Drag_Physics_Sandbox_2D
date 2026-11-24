import type { CarConfig, TrackConfig } from '../../data/schema';
import type { OverrevSpec } from '../../physics/engine/EngineOverrevFailure';
import { RaceController } from '../race/RaceController';
import { PHYSICS_DT, SimulationRunner } from '../SimulationRunner';
import type { OnlineLaneSnapshot, OnlineRaceSnapshot, RaceInput } from './contracts';

export interface OfficialBuild {
  car: CarConfig;
  name: string;
  failureSpec: OverrevSpec | null;
}

const MAX_OBSERVATION_AGE_TICKS = 120;
const INPUT_RELEASE_TICKS = 30;

/** Holds the two independently controlled lanes. Only the server advances its clock. */
export class AuthoritativeRace {
  readonly runner: SimulationRunner;
  readonly race: RaceController;
  private readonly drivers = [0, 1].map(() => ({
    throttle: 0, nitrous: false, sequence: -1, lastInputTick: -INPUT_RELEASE_TICKS,
    shift: undefined as RaceInput['shift'],
  }));

  constructor(readonly matchId: string, builds: readonly [OfficialBuild, OfficialBuild], track: TrackConfig, seed: number) {
    this.runner = new SimulationRunner(track);
    const lanes = builds.map((build, index) => {
      const { sim } = this.runner.add(build.car, { id: String(index), lane: index, isPlayer: false });
      sim.enableEngineFailure(build.failureSpec);
      return { sim, ai: null, name: build.name, pedal: () => this.drivers[index]!.throttle };
    });
    this.race = new RaceController(lanes, 'quarter', 'pro', seed, true);
    this.runner.afterStep.push((step) => this.race.afterStep(step));
  }

  get tick(): number { return this.runner.stats.steps; }

  submit(lane: 0 | 1, input: RaceInput): boolean {
    const driver = this.drivers[lane]!;
    if (this.race.phase === 'finished' || input.matchId !== this.matchId || input.sequence <= driver.sequence ||
        input.observedTick > this.tick || this.tick - input.observedTick > MAX_OBSERVATION_AGE_TICKS) return false;
    driver.sequence = input.sequence;
    driver.lastInputTick = this.tick;
    driver.throttle = input.throttle;
    driver.nitrous = input.nitrous ?? false;
    driver.shift ??= input.shift;
    return true;
  }

  release(lane: 0 | 1): void {
    Object.assign(this.drivers[lane]!, { throttle: 0, nitrous: false, shift: undefined });
    this.race.raceLanes[lane]!.sim.stopNitrous();
  }

  step(): void {
    if (this.race.phase === 'finished') return;
    const results = this.race.results;
    this.drivers.forEach((driver, index) => {
      if (this.tick - driver.lastInputTick >= INPUT_RELEASE_TICKS) this.release(index as 0 | 1);
      const sim = this.race.raceLanes[index]!.sim;
      const result = results[index]!;
      sim.nitrousHeld = !result.finished && !result.dnf && driver.nitrous;
      if (!result.finished && !result.dnf && driver.shift !== undefined) sim.requestShift(driver.shift);
      driver.shift = undefined;
    });
    this.race.beforeStep(PHYSICS_DT);
    this.runner.stepOnce();
  }

  snapshot(): OnlineRaceSnapshot {
    const results = this.race.results;
    const lane = (index: 0 | 1): OnlineLaneSnapshot => {
      const { sim } = this.race.raceLanes[index]!;
      const nitrous = sim.nitrous;
      return {
        x: sim.x, speed: sim.speed, rpm: sim.engine.rpm, gear: sim.gear, pitch: sim.pitch,
        wheelAngleDriven: sim.wheelAngleDriven, wheelAngleFree: sim.wheelAngleFree,
        boostBar: (sim.engine.turbo?.boostPa ?? 0) / 100_000,
        audioFrame: Array.from(sim.audioFrame), runState: sim.engine.runState, pedal: sim.controls.pedal,
        braking: sim.controls.autoBrake || sim.controls.holdBrake,
        shifting: sim.shift.active, targetGear: sim.shift.targetGear,
        wheelOmegaDriven: sim.telemetry.wheelOmegaDriven, wheelOmegaFree: sim.telemetry.wheelOmegaFree,
        slipRatio: sim.telemetry.slipRatio, accel: sim.telemetry.acceleration,
        nitrous: nitrous && nitrous.setup.maxFlowKgS > 0 ? nitrous.telemetry().flowKgPerS / nitrous.setup.maxFlowKgS : 0,
        result: structuredClone(results[index]!),
      };
    };
    return {
      matchId: this.matchId, tick: this.tick, phase: this.race.phase, lights: this.race.lights(),
      scheduledGreenTick: this.race.greenAt === null ? null : Math.ceil(this.race.greenAt / PHYSICS_DT),
      lanes: [lane(0), lane(1)], winner: this.race.winner,
    };
  }
}
