import type { EngineConfig } from '../../data/schema';
import { radSToRpm, rpmToRadS, wattsToCv } from '../../core/units';
import { ConstraintSolver } from '../solver/ConstraintSolver';
import { EngineModel, type Ambient, type EngineInputs } from './EngineModel';
import { NitrousController, type NitrousSetup } from './NitrousController';

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
  readonly nitrous: NitrousController | null;
  nitrousHeld = false;

  constructor(cfg: EngineConfig, ambient?: Ambient, nitrous?: NitrousSetup) {
    this.engine = new EngineModel(cfg, ambient);
    this.nitrous = nitrous ? new NitrousController(nitrous) : null;
  }

  private readonly injectNitrous = (h: number, rpm: number, injectable: boolean): number => {
    const n = this.nitrous!;
    n.update(h, { rpm, injectable, broken: this.engine.runState === 'BROKEN' }, this.nitrousHeld);
    n.drainEvents();
    return n.additionalTorqueNm;
  };

  step(h: number): void {
    const e = this.engine;
    const explicit = e.preStep(h, this.inputs, this.nitrous ? this.injectNitrous : undefined);
    e.crank.v += h * e.crank.invMass * explicit;
    this.solver.solve([e.frictionRow, e.starterRow, e.dynoRow], h);
    this.simTime += h;
    // The full-load bench blower supplies the airflow of about 200 km/h.
    e.postStep(h, this.inputs, this.simTime, 55);
  }

  /** Cranks the engine until it runs (or gives up after `timeoutS`). */
  start(h = 1 / 120, timeoutS = 6): boolean {
    this.nitrous?.reset();
    this.nitrousHeld = false;
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
