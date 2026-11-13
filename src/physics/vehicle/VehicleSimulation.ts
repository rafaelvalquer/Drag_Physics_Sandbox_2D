import type { CarConfig, TrackConfig } from '../../data/schema';
import { AF, type VehicleTelemetry } from '../../core/contracts';
import { STANDARD_GRAVITY, airDensity, celsiusToKelvin, radSToRpm } from '../../core/units';
import { clamp, clamp01 } from '../../core/math';
import { ConstraintRow, ConstraintSolver, Dof } from '../solver/ConstraintSolver';
import { EngineModel, type EngineInputs } from '../engine/EngineModel';
import { Gearbox } from '../drivetrain/Gearbox';
import { ShiftController, type ShiftContext, type ShiftRequestResult } from '../drivetrain/ShiftController';
import { AutomaticClutchController, type ClutchContext } from '../drivetrain/AutomaticClutchController';
import { TireModel } from './TireModel';

export interface VehicleControls {
  /** Driver/AI throttle request 0..1 (already progressive). */
  pedal: number;
  /** Automatic ignition + cranking (default in races). */
  autoStart: boolean;
  /** Manual ignition switch (Sandbox button) – ignored while autoStart is on. */
  ignition: boolean;
  /** Manual starter request (Sandbox button) – ignored while autoStart is on. */
  starter: boolean;
  /** Automatic deceleration and braking (after the finish line). */
  autoBrake: boolean;
  /** Keeps the brakes applied (staging, dyno). */
  holdBrake: boolean;
}

/**
 * Longitudinal vehicle model: crankshaft – bounded clutch – gearbox/differential – driven wheels
 * – tires – body. Integrated with a fixed step (1/120 s) semi-implicit Euler scheme; all couplings
 * (clutch, tires, brakes, rolling resistance, engine friction, starter) are solved together as
 * bounded velocity constraints so stiff couplings stay stable at 120 Hz.
 *
 * DOFs: crank ω_e (I_engine), driveline ω_w (driven wheels + reflected driveline inertia),
 * body v (vehicle mass + free-wheel inertia/r²).
 */
export class VehicleSimulation {
  readonly engine: EngineModel;
  readonly gearbox: Gearbox;
  readonly shift: ShiftController;
  readonly clutchCtl: AutomaticClutchController;
  readonly tire: TireModel;
  readonly driveline: Dof;
  readonly body: Dof;
  readonly clutchRow = new ConstraintRow('clutch');
  readonly lossRow = new ConstraintRow('gear-mesh-loss');
  readonly brakeDrivenRow = new ConstraintRow('brake-driven');
  readonly brakeFreeRow = new ConstraintRow('brake-free');
  readonly tireRow = new ConstraintRow('tire');
  readonly rollingRow = new ConstraintRow('rolling');
  readonly solver = new ConstraintSolver();
  private readonly rows: ConstraintRow[];

  controls: VehicleControls = {
    pedal: 0,
    autoStart: true,
    ignition: false,
    starter: false,
    autoBrake: false,
    holdBrake: false,
  };

  // ---- kinematic state ----
  x = 0;
  simTime = 0;
  acceleration = 0;
  loadTransfer = 0;
  private loadTransferVel = 0;
  pitch = 0;
  wheelAngleDriven = 0;
  wheelAngleFree = 0;
  clutchTorque = 0;
  tireForce = 0;
  dragForce = 0;
  rollingForce = 0;
  brakeForce = 0;
  maxRpm = 0;
  slipIntegral = 0;
  gearsUsed = new Set<number>();
  lastShiftResult: ShiftRequestResult | null = null;
  private autoStartCooldown = 0;
  private autoStartAttempts = 0;
  private ignitionEventsStep = 0;
  private readonly engineInputs: EngineInputs = {
    pedal: 0,
    throttleOverride: null,
    sparkCut: 0,
    ignitionOn: false,
    starter: false,
  };
  readonly audioFrame = new Float64Array(AF.length);
  readonly telemetry: VehicleTelemetry;
  private rho: number;
  private readonly freeWheelInertia: number;

  constructor(
    public readonly car: CarConfig,
    public track: TrackConfig,
  ) {
    const ambient = {
      pressurePa: track.ambientPressurePa,
      temperatureK: celsiusToKelvin(track.ambientTempC),
    };
    this.engine = new EngineModel(car.engine, ambient);
    this.gearbox = new Gearbox(car.transmission);
    this.shift = new ShiftController(car.transmission, this.gearbox);
    this.clutchCtl = new AutomaticClutchController(car.transmission);
    this.tire = new TireModel(car.tires);
    this.freeWheelInertia = 2 * car.tires.wheelInertiaKgM2;
    this.driveline = new Dof('driveline', this.drivelineInertia());
    this.body = new Dof('body', car.massKg + this.freeWheelInertia / car.tires.radiusM ** 2);
    this.rho = airDensity(ambient.pressurePa, ambient.temperatureK);
    this.rows = [
      this.engine.frictionRow,
      this.engine.starterRow,
      this.engine.dynoRow,
      this.lossRow,
      this.brakeDrivenRow,
      this.brakeFreeRow,
      this.rollingRow,
      this.clutchRow,
      this.tireRow,
    ];
    this.telemetry = {
      simTime: 0,
      engine: this.engine.frame,
      speed: 0,
      acceleration: 0,
      distance: 0,
      wheelOmegaDriven: 0,
      wheelOmegaFree: 0,
      wheelAngleDriven: 0,
      wheelAngleFree: 0,
      slipRatio: 0,
      tireForce: 0,
      tireForceMax: 0,
      normalLoadDriven: 0,
      normalLoadFree: 0,
      wheelTorque: 0,
      clutchTorque: 0,
      clutchSlip: 0,
      gearRatio: 0,
      dragForce: 0,
      rollingForce: 0,
      brakeForce: 0,
      pitchRad: 0,
      shiftState: 'IDLE',
      clutchMode: 'OPEN',
      engineTorqueNet: 0,
      powerW: 0,
      wheelPowerW: 0,
      physicsStepMs: 0,
      ignitionEvents: 0,
      afterfire: false,
    };
    this.applyTrack(track);
  }

  /** Applies track conditions. Mid-run changes keep the current tyre temperature. */
  applyTrack(track: TrackConfig, keepTyreTemp = false): void {
    this.track = track;
    this.engine.setAmbient({
      pressurePa: track.ambientPressurePa,
      temperatureK: celsiusToKelvin(track.ambientTempC),
    });
    this.rho = airDensity(track.ambientPressurePa, celsiusToKelvin(track.ambientTempC));
    this.tire.surfaceGrip = track.surfaceGrip;
    this.tire.surfaceTempC = track.surfaceTempC;
    if (!keepTyreTemp) this.tire.temperatureC = track.surfaceTempC;
  }

  reset(x = 0): void {
    this.engine.reset();
    this.gearbox.reset();
    this.shift.reset();
    this.clutchCtl.reset();
    this.driveline.v = 0;
    this.body.v = 0;
    this.x = x;
    this.simTime = 0;
    this.acceleration = 0;
    this.loadTransfer = 0;
    this.loadTransferVel = 0;
    this.pitch = 0;
    this.wheelAngleDriven = 0;
    this.wheelAngleFree = 0;
    this.maxRpm = 0;
    this.slipIntegral = 0;
    this.gearsUsed.clear();
    this.autoStartAttempts = 0;
    this.autoStartCooldown = 0;
    for (const r of this.rows) r.lambda = 0;
    this.tire.temperatureC = this.track.surfaceTempC;
    this.controls.pedal = 0;
    this.controls.autoBrake = false;
    this.controls.holdBrake = false;
  }

  private drivelineInertia(): number {
    const t = this.car.transmission;
    return 2 * this.car.tires.wheelInertiaKgM2 + t.outputInertiaKgM2 * t.finalDrive ** 2 + this.gearbox.reflectedInputInertia();
  }

  get speed(): number {
    return this.body.v;
  }

  get gear(): number {
    return this.gearbox.gear;
  }

  /** Request a sequential shift (+1 up, −1 down). */
  requestShift(dir: 1 | -1): ShiftRequestResult {
    const res = this.shift.request(dir, this.shiftContext(), this.clutchCtl.engagement);
    this.lastShiftResult = res;
    return res;
  }

  private shiftContext(): ShiftContext {
    return {
      engineRpm: this.engine.rpm,
      wheelOmega: this.driveline.v,
      pedal: this.controls.pedal,
      revLimitRpm: this.car.engine.revLimitRpm,
      engineRunning: this.engine.runState === 'RUNNING',
      vehicleSpeed: this.body.v,
    };
  }

  private normalLoads(): { front: number; rear: number; total: number } {
    const c = this.car;
    const grade = Math.atan(this.track.gradePercent / 100);
    const w = c.massKg * STANDARD_GRAVITY * Math.cos(grade);
    const minLoad = 0.04 * w;
    const front = Math.max(w * c.frontWeightFraction - this.loadTransfer, minLoad);
    const rear = Math.max(w * (1 - c.frontWeightFraction) + this.loadTransfer, minLoad);
    return { front, rear, total: w };
  }

  /** One fixed physics step. */
  step(h: number): void {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const c = this.car;
    const ctl = this.controls;
    const eng = this.engine;
    const r = c.tires.radiusM;

    // ---------- automatic ignition / cranking ----------
    let ignitionOn = ctl.ignition;
    let starter = ctl.starter;
    if (ctl.autoStart) {
      ignitionOn = true;
      starter = false;
      if (eng.runState === 'CRANKING') starter = true;
      else if (eng.runState !== 'RUNNING') {
        this.autoStartCooldown -= h;
        const clutchOpen = this.clutchCtl.engagement < 0.05 || !this.gearbox.engaged;
        if (this.autoStartCooldown <= 0 && clutchOpen && this.autoStartAttempts < 4) {
          starter = true;
          this.autoStartAttempts++;
          this.autoStartCooldown = 1.0;
        }
      } else {
        this.autoStartAttempts = 0;
      }
    }

    // ---------- shift + clutch controllers ----------
    const sctx = this.shiftContext();
    const shiftDone = this.shift.update(h, sctx, this.simTime, this.clutchCtl.engagement);
    const ratio = this.gearbox.activeRatio;
    const inputRpm = radSToRpm(Math.abs(this.driveline.v) * this.gearbox.overallRatio(this.gearbox.gear));
    const cctx: ClutchContext = {
      gear: this.gearbox.gear,
      gearEngaged: this.gearbox.engaged,
      engineRpm: eng.rpm,
      inputRpm,
      idleRpm: c.engine.idleRpm,
      pedal: ctl.autoBrake ? 0 : ctl.pedal,
      engineRunning: eng.runState === 'RUNNING',
      clutchTorque: this.clutchTorque,
      engineTorque: eng.brakeTorqueEstimate,
      vehicleSpeed: this.body.v,
      drivenSlipRatio: (this.driveline.v * c.tires.radiusM - this.body.v) / Math.max(Math.abs(this.body.v), 2),
      shiftActive: this.shift.active,
      shiftClutchCommand: this.shift.clutchCommand,
      launchRequested: shiftDone && this.shift.launchAfter,
      forceOpen: ctl.autoBrake,
    };
    const engagement = this.clutchCtl.update(h, cctx);

    // ---------- engine pre-step ----------
    const ei = this.engineInputs;
    ei.pedal = ctl.autoBrake ? 0 : clamp01(ctl.pedal);
    ei.throttleOverride = this.shift.throttleOverride;
    ei.sparkCut = this.shift.sparkCut;
    ei.ignitionOn = ignitionOn;
    ei.starter = starter;
    const engineTorque = eng.preStep(h, ei);

    // ---------- loads & external forces ----------
    this.driveline.setMass(this.drivelineInertia());
    const loads = this.normalLoads();
    const drivenLoad = c.drivenAxle === 'rear' ? loads.rear : loads.front;
    const freeLoad = c.drivenAxle === 'rear' ? loads.front : loads.rear;
    const grade = Math.atan(this.track.gradePercent / 100);
    const vRel = this.body.v - this.track.windMs;
    const aero = 0.5 * this.rho * c.dragCoefficient * c.frontalAreaM2 * vRel * Math.abs(vRel);
    const gradeForce = c.massKg * STANDARD_GRAVITY * Math.sin(grade);
    const drivelineDrag = 0.015 * this.driveline.v;

    const v0Body = this.body.v;
    const v0Drive = this.driveline.v;
    const slip0 = v0Drive * r - v0Body;
    const tireEval = this.tire.evaluate(slip0, v0Body, drivenLoad);

    // predicted velocities with explicit forces (semi-implicit Euler)
    eng.crank.v += h * eng.crank.invMass * engineTorque;
    this.driveline.v += h * this.driveline.invMass * -drivelineDrag;
    this.body.v += h * this.body.invMass * (-aero - gradeForce);

    // ---------- constraint rows ----------
    // Clutch (engine-sim ClutchConstraint + Transmission::update): ω_e − G·ω_w = 0, |λ| ≤ T_max·p
    const cap = c.transmission.clutch.maxTorqueNm * engagement;
    this.clutchRow.enabled = ratio > 0;
    this.clutchRow.set2(eng.crank, 1, this.driveline, -ratio);
    this.clutchRow.bias = 0;
    this.clutchRow.cfm = 0;
    this.clutchRow.lo = -cap;
    this.clutchRow.hi = cap;

    // Gear mesh losses: Coulomb friction proportional to the transmitted torque (1 − η).
    const meshLoss = ratio > 0 ? (1 - c.transmission.efficiency) * ratio * Math.abs(this.clutchTorque) + 1.5 : 0.5;
    this.lossRow.enabled = true;
    this.lossRow.set1(this.driveline, 1);
    this.lossRow.bias = 0;
    this.lossRow.lo = -meshLoss;
    this.lossRow.hi = meshLoss;

    // Brakes
    let brakeTotal = 0;
    if (ctl.holdBrake) brakeTotal = c.brakeTorqueNm;
    else if (ctl.autoBrake) {
      const demand = c.massKg * 0.55 * STANDARD_GRAVITY * r;
      brakeTotal = Math.min(c.brakeTorqueNm, Math.abs(this.body.v) < 0.3 ? c.brakeTorqueNm : demand);
    }
    const frontBias = 0.62;
    const drivenShare = c.drivenAxle === 'rear' ? 1 - frontBias : frontBias;
    const drivenBrake = brakeTotal * drivenShare;
    const freeBrakeForce = Math.min((brakeTotal * (1 - drivenShare)) / r, c.tires.muPeak * this.tire.surfaceGrip * freeLoad);
    this.brakeDrivenRow.enabled = drivenBrake > 0;
    this.brakeDrivenRow.set1(this.driveline, 1);
    this.brakeDrivenRow.lo = -drivenBrake;
    this.brakeDrivenRow.hi = drivenBrake;
    this.brakeFreeRow.enabled = freeBrakeForce > 0;
    this.brakeFreeRow.set1(this.body, 1);
    this.brakeFreeRow.lo = -freeBrakeForce;
    this.brakeFreeRow.hi = freeBrakeForce;

    // Rolling resistance (engine-sim VehicleDragConstraint: a friction-like bound that can only
    // decelerate the body to rest; aerodynamic drag is explicit here because wind can push both ways)
    const roll = c.tires.rollingResistance * this.track.rollingResistanceFactor * loads.total;
    this.rollingRow.enabled = true;
    this.rollingRow.set1(this.body, 1);
    this.rollingRow.lo = -roll;
    this.rollingRow.hi = roll;

    // Tire: soft constraint, linearized Magic Formula  (λ = −F_tire)
    const k = tireEval.slope;
    this.tireRow.enabled = true;
    this.tireRow.set2(this.driveline, r, this.body, -1);
    this.tireRow.cfm = 1 / k;
    this.tireRow.bias = slip0 - tireEval.force / k;
    this.tireRow.lo = -tireEval.peakForce * 1.02;
    this.tireRow.hi = tireEval.peakForce * 1.02;

    this.solver.solve(this.rows, h);

    // ---------- post-step ----------
    this.clutchTorque = this.clutchRow.enabled ? -this.clutchRow.lambda : 0;
    this.tireForce = -this.tireRow.lambda;
    this.dragForce = aero;
    this.rollingForce = -this.rollingRow.lambda;
    this.brakeForce = -this.brakeFreeRow.lambda + (-this.brakeDrivenRow.lambda) / r;
    const v1 = this.body.v;
    this.acceleration = (v1 - v0Body) / h;
    this.x += v1 * h;
    this.wheelAngleDriven += this.driveline.v * h;
    this.wheelAngleFree += (v1 / r) * h;
    this.simTime += h;

    // suspension: load transfer follows m·a·h/L through a damped spring (≈1.6 Hz, ζ≈0.7)
    const targetTransfer = (c.massKg * this.acceleration * c.cgHeightM) / c.wheelbaseM;
    const wn = 2 * Math.PI * 1.6;
    const accT = wn * wn * (targetTransfer - this.loadTransfer) - 2 * 0.7 * wn * this.loadTransferVel;
    this.loadTransferVel += accT * h;
    this.loadTransfer += this.loadTransferVel * h;
    this.pitch = clamp((this.loadTransfer / (c.massKg * STANDARD_GRAVITY)) * 0.09, -0.06, 0.06);

    const slipVel = this.driveline.v * r - v1;
    this.tire.updateTemperature(h, this.tireForce * slipVel, v1);
    this.slipIntegral += Math.abs(slipVel) * h;

    eng.postStep(h, ei, this.simTime);
    this.ignitionEventsStep = eng.ignition.eventsLastStep;
    if (eng.rpm > this.maxRpm) this.maxRpm = eng.rpm;
    if (this.gearbox.engaged && this.gearbox.gear > 0) this.gearsUsed.add(this.gearbox.gear);

    const netTorque = engineTorque + eng.frictionRow.lambda;
    eng.torqueNetLast = netTorque;
    eng.frame.torqueNet = netTorque;
    eng.frame.clutchEngagement = engagement;
    eng.frame.gear = this.gearbox.engaged ? this.gearbox.gear : this.gearbox.gear === 0 ? 0 : this.gearbox.gear;

    this.fillTelemetry(slipVel, tireEval.peakForce, drivenLoad, freeLoad, netTorque);
    this.fillAudioFrame(slipVel, drivenLoad);
    this.telemetry.physicsStepMs = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
  }

  private fillTelemetry(slipVel: number, peak: number, drivenLoad: number, freeLoad: number, netTorque: number): void {
    const t = this.telemetry;
    const r = this.car.tires.radiusM;
    const ratio = this.gearbox.activeRatio;
    t.simTime = this.simTime;
    t.speed = this.body.v;
    t.acceleration = this.acceleration;
    t.distance = this.x;
    t.wheelOmegaDriven = this.driveline.v;
    t.wheelOmegaFree = this.body.v / r;
    t.wheelAngleDriven = this.wheelAngleDriven;
    t.wheelAngleFree = this.wheelAngleFree;
    t.slipRatio = slipVel / Math.max(Math.abs(this.body.v), 2);
    t.tireForce = this.tireForce;
    t.tireForceMax = peak;
    t.normalLoadDriven = drivenLoad;
    t.normalLoadFree = freeLoad;
    t.clutchTorque = this.clutchTorque;
    t.wheelTorque = ratio * this.clutchTorque + this.lossRow.lambda;
    t.clutchSlip = this.engine.crank.v - ratio * this.driveline.v;
    t.gearRatio = ratio;
    t.dragForce = this.dragForce;
    t.rollingForce = this.rollingForce;
    t.brakeForce = this.brakeForce;
    t.pitchRad = this.pitch;
    t.shiftState = this.shift.state;
    t.clutchMode = this.clutchCtl.mode;
    t.engineTorqueNet = netTorque;
    t.powerW = netTorque * this.engine.crank.v;
    t.wheelPowerW = this.tireForce * this.body.v;
    t.ignitionEvents = this.ignitionEventsStep;
    t.afterfire = this.engine.afterfire;
  }

  private fillAudioFrame(slipVel: number, drivenLoad: number): void {
    const a = this.audioFrame;
    const e = this.engine;
    a[AF.simTime] = this.simTime;
    a[AF.omega] = e.crank.v;
    a[AF.crankAngle] = e.cycleAngle;
    a[AF.throttle] = e.throttleEffective;
    a[AF.load] = e.load;
    a[AF.manifoldPressure] = e.manifoldPressure;
    a[AF.boostPressure] = e.turbo ? e.turbo.boostPa : 0;
    a[AF.combustionEnabled] = e.combustionEnabled && !e.ignition.limiterActive ? 1 : 0;
    a[AF.sparkCut] = this.shift.sparkCut;
    a[AF.revLimiter] = e.ignition.limiterActive ? 1 : 0;
    a[AF.exhaustTempK] = e.exhaustTempK;
    a[AF.turboShaftRpm] = e.turbo ? e.turbo.shaftRpm : 0;
    a[AF.bovFlow] = e.turbo ? e.turbo.bovFlow : 0;
    a[AF.vehicleSpeed] = this.body.v;
    a[AF.wheelSlipSpeed] = Math.abs(slipVel);
    a[AF.tireLoadN] = drivenLoad;
    a[AF.gearboxOutputOmega] = this.driveline.v * this.car.transmission.finalDrive;
    a[AF.clutchSlipOmega] = this.telemetry.clutchSlip;
    a[AF.transmissionTorque] = this.clutchTorque;
    a[AF.gear] = this.gearbox.engaged ? this.gearbox.gear : 0;
    a[AF.torqueNet] = e.torqueNetLast;
    a[AF.paused] = 0;
    a[AF.starterActive] = e.starterRow.enabled ? 1 : 0;
    a[AF.afterfire] = e.afterfire ? 1 : 0;
  }
}
