import type { EngineConfig } from '../../data/schema';
import { radSToRpm, rpmToRadS, wattsToCv } from '../../core/units';
import { ConstraintSolver } from '../solver/ConstraintSolver';
import { EngineModel, type Ambient, type EngineInputs } from './EngineModel';

export interface DynoPoint {
  rpm: number;
  torqueNm: number;
  powerW: number;
  powerCv: number;
  manifoldPa: number;
  boostPa: number;
}

/**
 * Engine dynamometer bench: the engine model on its own crank with the dynamometer constraint
 * (port of engine-sim `Dynamometer`: a bounded velocity constraint that holds the crank at the
 * target speed and measures the torque it has to absorb). The torque is *measured*, never taken
 * from the configured curve: brake torque = −λ_dyno, power = T·ω.
 */
export class EngineDyno {
  readonly engine: EngineModel;
  readonly solver = new ConstraintSolver();
  readonly inputs: EngineInputs = { pedal: 0, throttleOverride: null, sparkCut: 0, ignitionOn: true, starter: false };
  simTime = 0;

  constructor(cfg: EngineConfig, ambient?: Ambient) {
    this.engine = new EngineModel(cfg, ambient);
  }

  step(h: number): void {
    const e = this.engine;
    const explicit = e.preStep(h, this.inputs);
    e.crank.v += h * e.crank.invMass * explicit;
    this.solver.solve([e.frictionRow, e.starterRow, e.dynoRow], h);
    this.simTime += h;
    // A bench blower supplies air to the radiator while the car is stationary.
    e.postStep(h, this.inputs, this.simTime, 20);
  }

  /** Cranks the engine until it runs (or gives up after `timeoutS`). */
  start(h = 1 / 120, timeoutS = 6): boolean {
    this.inputs.ignitionOn = true;
    this.inputs.starter = true;
    const steps = Math.ceil(timeoutS / h);
    for (let i = 0; i < steps; i++) {
      this.step(h);
      if (this.engine.runState === 'RUNNING') break;
    }
    this.inputs.starter = false;
    return this.engine.runState === 'RUNNING';
  }

  /**
   * Holds the engine at `rpm` with the given throttle until steady and returns the measured point
   * (averaged over the last `averageS` seconds).
   */
  measure(rpm: number, pedal: number, h = 1 / 120, settleS = 2.5, averageS = 0.5): DynoPoint {
    const e = this.engine;
    e.dyno.enabled = true;
    e.dyno.hold = true;
    e.dyno.targetOmega = rpmToRadS(rpm);
    this.inputs.pedal = pedal;
    const settle = Math.ceil(settleS / h);
    const avg = Math.ceil(averageS / h);
    let t = 0;
    let w = 0;
    let map = 0;
    let boost = 0;
    for (let i = 0; i < settle + avg; i++) {
      this.step(h);
      if (i >= settle) {
        t += e.dynoTorque;
        w += e.omega;
        map += e.manifoldPressure;
        boost += e.turbo ? e.turbo.boostPa : 0;
      }
    }
    const torque = t / avg;
    const omega = w / avg;
    const powerW = torque * omega;
    return {
      rpm: radSToRpm(omega),
      torqueNm: torque,
      powerW,
      powerCv: wattsToCv(powerW),
      manifoldPa: map / avg,
      boostPa: boost / avg,
    };
  }

  /** Full-load sweep (steady points). */
  sweep(fromRpm: number, toRpm: number, stepRpm: number, pedal = 1): DynoPoint[] {
    const pts: DynoPoint[] = [];
    for (let rpm = fromRpm; rpm <= toRpm + 1e-9; rpm += stepRpm) pts.push(this.measure(rpm, pedal));
    return pts;
  }

  release(): void {
    this.engine.dyno.enabled = false;
    this.engine.dyno.hold = false;
  }
}
