import type { CarConfig, TrackConfig, TransmissionKind } from '../../data/schema';
import { AF, type VehicleTelemetry } from '../../core/contracts';
import { STANDARD_GRAVITY, airDensity, celsiusToKelvin, radSToRpm } from '../../core/units';
import { clamp, clamp01 } from '../../core/math';
import { ConstraintRow, ConstraintSolver, Dof } from '../solver/ConstraintSolver';
import { EngineModel, type EngineInputs } from '../engine/EngineModel';
import { Gearbox } from '../drivetrain/Gearbox';
import { ShiftController, type ShiftContext, type ShiftRequestResult } from '../drivetrain/ShiftController';
import { AutomaticClutchController, type ClutchContext } from '../drivetrain/AutomaticClutchController';
import { PowershiftController, autoShiftDecision, type GearboxMode } from '../drivetrain/PowershiftController';
import { TorqueConverterController, converterState } from '../drivetrain/TorqueConverter';
import { TireModel } from './TireModel';
import { EngineOverrevFailure, type OverrevSpec } from '../engine/EngineOverrevFailure';

/** Events of one simulation (emitted once each). */
export type VehicleEvent = { type: 'ENGINE_BLOWN'; simTime: number; rpm: number };

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
 *
 * Extensions (the manual front/rear-drive path is unchanged):
 * - AWD: the driveline DOF becomes the rear axle and a front-axle DOF is added. The gearbox output
 *   feeds an open centre differential with a static split α (ω_out = α·ω_f + (1−α)·ω_r, torque
 *   α·T to the front, (1−α)·T to the rear) – a three-DOF clutch row – plus a bounded centre
 *   coupling row (ω_f − ω_r = 0, |λ| ≤ T_coupling) that represents the multi-plate centre clutch.
 *   Each axle has its own tyre row with its own normal load (load transfer included), so the grip
 *   is the sum of what each axle can transmit – never a larger friction coefficient.
 * - Dual clutch: two clutch rows from the crank, one per shaft (current gear / oncoming gear),
 *   commanded by the PowershiftController.
 * - Torque converter automatic: a turbine DOF; the converter is a linearized soft row between crank
 *   and turbine (J = [1, −TR], impeller torque T_i(ω_i, ω_t)), the lock-up clutch a bounded row
 *   crank–turbine, and the planetary shift elements two bounded rows turbine–output.
 */
export class VehicleSimulation {
  readonly engine: EngineModel;
  readonly gearbox: Gearbox;
  readonly shift: ShiftController | PowershiftController;
  readonly clutchCtl: AutomaticClutchController | TorqueConverterController;
  readonly tire: TireModel;
  readonly driveline: Dof;
  readonly body: Dof;
  /** Front axle (AWD only). */
  readonly front: Dof | null;
  readonly tireFront: TireModel | null;
  /** Torque converter turbine (automatics only). */
  readonly turbine: Dof | null;
  readonly transmissionKind: TransmissionKind;
  readonly clutchRow = new ConstraintRow('clutch');
  readonly lossRow = new ConstraintRow('gear-mesh-loss');
  readonly brakeDrivenRow = new ConstraintRow('brake-driven');
  readonly brakeFreeRow = new ConstraintRow('brake-free');
  readonly tireRow = new ConstraintRow('tire');
  readonly rollingRow = new ConstraintRow('rolling');
  readonly clutchRow2 = new ConstraintRow('clutch-oncoming');
  readonly converterRow = new ConstraintRow('torque-converter');
  readonly lockupRow = new ConstraintRow('lockup-clutch');
  readonly centerRow = new ConstraintRow('center-coupling');
  readonly tireFrontRow = new ConstraintRow('tire-front');
  readonly brakeFrontRow = new ConstraintRow('brake-front');
  readonly lossFrontRow = new ConstraintRow('gear-mesh-loss-front');
  readonly solver = new ConstraintSolver();
  private readonly rows: ConstraintRow[];
  private readonly ps: PowershiftController | null;
  private readonly manualShift: ShiftController | null;
  private readonly launchClutch: AutomaticClutchController | null;
  private readonly tcCtl: TorqueConverterController | null;
  /** Front torque share of the centre differential (AWD), 0 otherwise. */
  private readonly alpha: number;

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
  /** Torque of the oncoming element (powershift), N·m at the input member. */
  clutchTorque2 = 0;
  tireForce = 0;
  frontTireForce = 0;
  dragForce = 0;
  rollingForce = 0;
  brakeForce = 0;
  maxRpm = 0;
  slipIntegral = 0;
  gearsUsed = new Set<number>();
  lastShiftResult: ShiftRequestResult | null = null;
  /** Over-rev failure model (null = mechanical failures off: sandbox default, dyno, AI rivals). */
  failure: EngineOverrevFailure | null = null;
  /** Listener of the simulation events (ENGINE_BLOWN). */
  onEvent: ((e: VehicleEvent) => void) | null = null;
  private autoStartCooldown = 0;
  private autoStartAttempts = 0;
  private ignitionEventsStep = 0;
  private ratio2 = 0;
  private converterSr = 1;
  /** Driver demand kept by the gearbox controller (fast attack, slow release). */
  private pedalMemory = 0;
  private prevPedal = 0;
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
    this.transmissionKind = car.transmission.kind ?? 'manual';
    if (this.transmissionKind === 'manual') {
      this.manualShift = new ShiftController(car.transmission, this.gearbox);
      this.ps = null;
      this.shift = this.manualShift;
    } else {
      this.manualShift = null;
      this.ps = new PowershiftController(car.transmission, this.gearbox, this.transmissionKind);
      this.shift = this.ps;
    }
    if (this.transmissionKind === 'torque-converter-auto') {
      this.tcCtl = new TorqueConverterController(car.transmission.torqueConverter!);
      this.launchClutch = null;
      this.clutchCtl = this.tcCtl;
      this.turbine = new Dof('turbine', car.transmission.torqueConverter!.turbineInertiaKgM2 + car.transmission.inputInertiaKgM2);
    } else {
      this.tcCtl = null;
      this.launchClutch = new AutomaticClutchController(car.transmission);
      this.clutchCtl = this.launchClutch;
      this.turbine = null;
    }
    this.tire = new TireModel(car.tires);
    const awd = car.drivenAxle === 'awd';
    this.alpha = awd ? car.awd!.frontTorqueFraction : 0;
    this.tireFront = awd ? new TireModel(car.tires) : null;
    this.front = awd ? new Dof('front-axle', 1) : null;
    this.freeWheelInertia = awd ? 0 : 2 * car.tires.wheelInertiaKgM2;
    this.driveline = new Dof('driveline', 1);
    this.setDrivelineInertias();
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
      // extensions (disabled rows are skipped by the solver)
      this.converterRow,
      this.lockupRow,
      this.clutchRow2,
      this.lossFrontRow,
      this.brakeFrontRow,
      this.centerRow,
      this.tireFrontRow,
    ];
    for (const r of [this.converterRow, this.lockupRow, this.clutchRow2, this.lossFrontRow, this.brakeFrontRow, this.centerRow, this.tireFrontRow]) r.enabled = false;
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
      frontTireForce: 0,
      centerCouplingTorque: 0,
      converterSpeedRatio: 1,
      gearboxMode: null,
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
    for (const t of this.tireFront ? [this.tire, this.tireFront] : [this.tire]) {
      t.surfaceGrip = track.surfaceGrip;
      t.surfaceTempC = track.surfaceTempC;
      if (!keepTyreTemp) t.temperatureC = track.surfaceTempC;
    }
  }

  reset(x = 0): void {
    this.engine.reset();
    this.failure?.reset(); // a restart is a fresh engine (failures stay enabled)
    this.gearbox.reset();
    this.shift.reset();
    this.clutchCtl.reset();
    this.driveline.v = 0;
    this.body.v = 0;
    if (this.front) this.front.v = 0;
    if (this.turbine) this.turbine.v = 0;
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
    if (this.tireFront) this.tireFront.temperatureC = this.track.surfaceTempC;
    this.pedalMemory = 0;
    this.prevPedal = 0;
    this.controls.pedal = 0;
    this.controls.autoBrake = false;
    this.controls.holdBrake = false;
  }

  private drivelineInertia(): number {
    const t = this.car.transmission;
    return 2 * this.car.tires.wheelInertiaKgM2 + t.outputInertiaKgM2 * t.finalDrive ** 2 + this.gearbox.reflectedInputInertia();
  }

  /** Inertias of the driven DOFs (the gearbox input is part of the turbine on an automatic). */
  private setDrivelineInertias(): void {
    if (!this.front && !this.turbine) {
      this.driveline.setMass(this.drivelineInertia());
      return;
    }
    const t = this.car.transmission;
    const wheels = 2 * this.car.tires.wheelInertiaKgM2;
    const shared = t.outputInertiaKgM2 * t.finalDrive ** 2 + (this.turbine ? 0 : this.gearbox.reflectedInputInertia());
    if (this.front) {
      this.driveline.setMass(wheels + shared * (1 - this.alpha));
      this.front.setMass(wheels + shared * this.alpha);
    } else {
      this.driveline.setMass(wheels + shared);
    }
  }

  get speed(): number {
    return this.body.v;
  }

  get gear(): number {
    return this.gearbox.gear;
  }

  /** Mode of an automatic / dual-clutch gearbox (null for the manual gearbox). */
  get gearboxMode(): GearboxMode | null {
    return this.ps ? this.ps.mode : null;
  }

  /** Gearbox output speed referred to the wheels (centre differential input on AWD). */
  get outputOmega(): number {
    return this.front ? this.alpha * this.front.v + (1 - this.alpha) * this.driveline.v : this.driveline.v;
  }

  /** Request a sequential shift (+1 up, −1 down). */
  requestShift(dir: 1 | -1): ShiftRequestResult {
    const res = this.ps
      ? this.ps.request(dir, this.shiftContext(), this.currentElementCommand())
      : this.manualShift!.request(dir, this.shiftContext(), this.clutchCtl.engagement);
    this.lastShiftResult = res;
    return res;
  }

  private currentElementCommand(): number {
    if (this.launchClutch) return this.launchClutch.engagement;
    return this.gearbox.engaged ? this.ps!.clutchCommand : 0;
  }

  private shiftContext(): ShiftContext {
    return {
      engineRpm: this.engine.rpm,
      wheelOmega: this.outputOmega,
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

  /** Writes a row between an input member and the gearbox output (centre differential on AWD). */
  private setOutputRow(row: ConstraintRow, input: Dof, ratio: number): void {
    if (this.front) row.set3(input, 1, this.driveline, -ratio * (1 - this.alpha), this.front, -ratio * this.alpha);
    else row.set2(input, 1, this.driveline, -ratio);
  }

  /** Turns the over-rev failure model on (career races, sandbox option) or off (null). */
  enableEngineFailure(spec: OverrevSpec | null): void {
    this.failure = spec ? new EngineOverrevFailure(spec) : null;
  }

  /** One fixed physics step. */
  step(h: number): void {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const c = this.car;
    const ctl = this.controls;
    const eng = this.engine;
    const r = c.tires.radiusM;
    const ps = this.ps;

    // ---------- automatic ignition / cranking ----------
    let ignitionOn = ctl.ignition;
    let starter = ctl.starter;
    if (ctl.autoStart) {
      ignitionOn = true;
      starter = false;
      if (eng.runState === 'CRANKING') starter = true;
      else if (eng.runState === 'BROKEN') {
        // a blown engine is not restarted
      } else if (eng.runState !== 'RUNNING') {
        this.autoStartCooldown -= h;
        const clutchOpen = this.tcCtl ? true : this.clutchCtl.engagement < 0.05 || !this.gearbox.engaged;
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
    let engagement: number;
    let engagement2 = 0;
    let lockup = 0;
    let ratio: number;
    let shiftDone: boolean;
    const slipOf = (dof: Dof): number => (dof.v * c.tires.radiusM - this.body.v) / Math.max(Math.abs(this.body.v), 2);
    const drivenSlip = this.front ? Math.max(slipOf(this.driveline), slipOf(this.front)) : slipOf(this.driveline);
    if (!ps) {
      shiftDone = this.manualShift!.update(h, sctx, this.simTime, this.clutchCtl.engagement);
      ratio = this.gearbox.activeRatio;
    } else {
      if (ps.pendingRetry !== null && !ps.active) {
        const d = ps.pendingRetry;
        ps.pendingRetry = null;
        ps.requestAuto(d, sctx, this.currentElementCommand());
      }
      const inputOmega = this.turbine ? this.turbine.v : eng.crank.v;
      const pd = ctl.autoBrake ? 0 : ctl.pedal;
      const memBefore = this.pedalMemory;
      this.pedalMemory = pd > this.pedalMemory ? pd : Math.max(pd, this.pedalMemory - h / 6);
      if (!ps.active && ps.mode === 'D' && this.gearbox.engaged && this.gearbox.gear >= 1 && eng.runState === 'RUNNING') {
        const inRpm = this.turbine ? radSToRpm(Math.abs(this.turbine.v)) : radSToRpm(Math.abs(this.outputOmega) * this.gearbox.overallRatio(this.gearbox.gear));
        const locked = this.launchClutch ? this.launchClutch.mode === 'LOCKED' : true;
        const ped = ctl.autoBrake ? 0 : ctl.pedal;
        const kick = ped >= (c.transmission.autoShift?.kickdownPedal ?? 1) && this.prevPedal < (c.transmission.autoShift?.kickdownPedal ?? 1) && memBefore < 0.5;
        const d = autoShiftDecision(c.transmission, this.gearbox.gear, this.gearbox.gearCount, inRpm, this.outputOmega, ped, ctl.autoBrake ? 0 : this.pedalMemory, kick, c.engine.idleRpm, c.engine.revLimitRpm, (g) => this.gearbox.overallRatio(g));
        // shift inhibit during a traction event (the output speed is not the road speed)
        const spinning = drivenSlip > 0.25 && inRpm < c.engine.revLimitRpm - 150;
        if (d !== 0 && ((locked && !spinning) || d < 0)) ps.requestAuto(d, sctx, this.currentElementCommand());
      }
      shiftDone = ps.update(h, sctx, this.simTime, inputOmega, this.currentElementCommand());
      this.prevPedal = pd;
      ratio = this.gearbox.activeRatio;
      this.ratio2 = ps.oncomingGear > 0 ? this.gearbox.overallRatio(ps.oncomingGear) : 0;
      engagement2 = ps.oncomingCommand;
    }
    if (this.tcCtl) {
      engagement = this.gearbox.engaged ? ps!.clutchCommand : 0;
      lockup = this.tcCtl.update(h, {
        gear: this.gearbox.gear,
        gearEngaged: this.gearbox.engaged,
        shiftActive: ps!.active,
        turbineOmega: this.turbine!.v,
        engineOmega: eng.crank.v,
        pedal: ctl.pedal,
        forceOpen: false,
      });
    } else {
      const sh = this.shift;
      const inputRpm = radSToRpm(Math.abs(this.outputOmega) * this.gearbox.overallRatio(this.gearbox.gear));
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
        drivenSlipRatio: drivenSlip,
        shiftActive: sh.active,
        shiftClutchCommand: sh.clutchCommand,
        launchRequested: shiftDone && sh.launchAfter,
        forceOpen: ctl.autoBrake,
      };
      engagement = this.launchClutch!.update(h, cctx);
    }

    // ---------- engine pre-step ----------
    const ei = this.engineInputs;
    ei.pedal = ctl.autoBrake ? 0 : clamp01(ctl.pedal);
    ei.throttleOverride = this.shift.throttleOverride;
    ei.sparkCut = this.shift.sparkCut;
    ei.ignitionOn = ignitionOn;
    ei.starter = starter;
    const engineTorque = eng.preStep(h, ei);

    // ---------- loads & external forces ----------
    this.setDrivelineInertias();
    const loads = this.normalLoads();
    const rearDriven = c.drivenAxle !== 'front';
    const drivenLoad = rearDriven ? loads.rear : loads.front;
    const freeLoad = rearDriven ? loads.front : loads.rear;
    const grade = Math.atan(this.track.gradePercent / 100);
    const vRel = this.body.v - this.track.windMs;
    const aero = 0.5 * this.rho * c.dragCoefficient * c.frontalAreaM2 * vRel * Math.abs(vRel);
    const gradeForce = c.massKg * STANDARD_GRAVITY * Math.sin(grade);
    const drivelineDrag = 0.015 * this.driveline.v;

    const v0Body = this.body.v;
    const v0Drive = this.driveline.v;
    const slip0 = v0Drive * r - v0Body;
    const tireEval = this.tire.evaluate(slip0, v0Body, drivenLoad);
    const front = this.front;
    const slip0F = front ? front.v * r - v0Body : 0;
    const tireEvalF = front ? this.tireFront!.evaluate(slip0F, v0Body, loads.front) : null;

    // predicted velocities with explicit forces (semi-implicit Euler)
    eng.crank.v += h * eng.crank.invMass * engineTorque;
    this.driveline.v += h * this.driveline.invMass * -drivelineDrag;
    if (front) front.v += h * front.invMass * -0.015 * front.v;
    if (this.turbine) this.turbine.v += h * this.turbine.invMass * -0.004 * this.turbine.v;
    this.body.v += h * this.body.invMass * (-aero - gradeForce);

    // ---------- constraint rows ----------
    const tr = c.transmission;
    if (!ps && !front) {
      // Clutch (engine-sim ClutchConstraint + Transmission::update): ω_e − G·ω_w = 0, |λ| ≤ T_max·p
      const cap = tr.clutch.maxTorqueNm * engagement;
      this.clutchRow.enabled = ratio > 0;
      this.clutchRow.set2(eng.crank, 1, this.driveline, -ratio);
      this.clutchRow.bias = 0;
      this.clutchRow.cfm = 0;
      this.clutchRow.lo = -cap;
      this.clutchRow.hi = cap;

      // Gear mesh losses: Coulomb friction proportional to the transmitted torque (1 − η).
      const meshLoss = ratio > 0 ? (1 - tr.efficiency) * ratio * Math.abs(this.clutchTorque) + 1.5 : 0.5;
      this.lossRow.enabled = true;
      this.lossRow.set1(this.driveline, 1);
      this.lossRow.bias = 0;
      this.lossRow.lo = -meshLoss;
      this.lossRow.hi = meshLoss;
    } else {
      const input = this.turbine ?? eng.crank;
      const cap = tr.clutch.maxTorqueNm * engagement;
      this.clutchRow.enabled = ratio > 0;
      this.setOutputRow(this.clutchRow, input, ratio);
      this.clutchRow.bias = 0;
      this.clutchRow.cfm = 0;
      this.clutchRow.lo = -cap;
      this.clutchRow.hi = cap;
      const cap2 = tr.clutch.maxTorqueNm * engagement2;
      this.clutchRow2.enabled = this.ratio2 > 0 && cap2 > 0;
      this.setOutputRow(this.clutchRow2, input, this.ratio2);
      this.clutchRow2.bias = 0;
      this.clutchRow2.cfm = 0;
      this.clutchRow2.lo = -cap2;
      this.clutchRow2.hi = cap2;

      const eff = tr.efficiency * (front ? c.awd!.transferEfficiency : 1);
      const transmitted = ratio * Math.abs(this.clutchTorque) + this.ratio2 * Math.abs(this.clutchTorque2);
      const meshLoss = ratio > 0 || this.ratio2 > 0 ? (1 - eff) * transmitted + 1.5 : 0.5;
      this.lossRow.enabled = true;
      this.lossRow.set1(this.driveline, 1);
      this.lossRow.bias = 0;
      this.lossRow.lo = -meshLoss * (1 - this.alpha);
      this.lossRow.hi = meshLoss * (1 - this.alpha);
      this.lossFrontRow.enabled = !!front;
      if (front) {
        this.lossFrontRow.set1(front, 1);
        this.lossFrontRow.bias = 0;
        this.lossFrontRow.lo = -meshLoss * this.alpha;
        this.lossFrontRow.hi = meshLoss * this.alpha;
      }

      if (this.turbine) {
        // torque converter: λ = −T_i, linearized around the current speeds
        const cs = converterState(tr.torqueConverter!, eng.crank.v, this.turbine.v);
        this.converterSr = cs.speedRatio;
        const s0 = eng.crank.v - cs.torqueRatio * this.turbine.v;
        this.converterRow.enabled = true;
        this.converterRow.set2(eng.crank, 1, this.turbine, -cs.torqueRatio);
        this.converterRow.cfm = 1 / cs.stiffness;
        this.converterRow.bias = s0 - cs.impellerTorque / cs.stiffness;
        this.converterRow.lo = -Infinity;
        this.converterRow.hi = Infinity;
        const lcap = tr.torqueConverter!.lockup.maxTorqueNm * lockup;
        this.lockupRow.enabled = lcap > 0;
        this.lockupRow.set2(eng.crank, 1, this.turbine, -1);
        this.lockupRow.bias = 0;
        this.lockupRow.cfm = 0;
        this.lockupRow.lo = -lcap;
        this.lockupRow.hi = lcap;
      }
      if (front) {
        const cc = c.awd!.centerCouplingNm;
        this.centerRow.enabled = cc > 0;
        this.centerRow.set2(front, 1, this.driveline, -1);
        this.centerRow.bias = 0;
        this.centerRow.cfm = 0;
        this.centerRow.lo = -cc;
        this.centerRow.hi = cc;
      }
    }

    // Brakes
    let brakeTotal = 0;
    if (ctl.holdBrake) brakeTotal = c.brakeTorqueNm;
    else if (ctl.autoBrake) {
      const demand = c.massKg * 0.55 * STANDARD_GRAVITY * r;
      brakeTotal = Math.min(c.brakeTorqueNm, Math.abs(this.body.v) < 0.3 ? c.brakeTorqueNm : demand);
    }
    const frontBias = 0.62;
    if (front) {
      const rearBrake = brakeTotal * (1 - frontBias);
      const frontBrake = brakeTotal * frontBias;
      this.brakeDrivenRow.enabled = rearBrake > 0;
      this.brakeDrivenRow.set1(this.driveline, 1);
      this.brakeDrivenRow.lo = -rearBrake;
      this.brakeDrivenRow.hi = rearBrake;
      this.brakeFrontRow.enabled = frontBrake > 0;
      this.brakeFrontRow.set1(front, 1);
      this.brakeFrontRow.lo = -frontBrake;
      this.brakeFrontRow.hi = frontBrake;
      this.brakeFreeRow.enabled = false;
    } else {
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
    }

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
    if (front && tireEvalF) {
      const kf = tireEvalF.slope;
      this.tireFrontRow.enabled = true;
      this.tireFrontRow.set2(front, r, this.body, -1);
      this.tireFrontRow.cfm = 1 / kf;
      this.tireFrontRow.bias = slip0F - tireEvalF.force / kf;
      this.tireFrontRow.lo = -tireEvalF.peakForce * 1.02;
      this.tireFrontRow.hi = tireEvalF.peakForce * 1.02;
    }

    this.solver.solve(this.rows, h);

    // ---------- post-step ----------
    if (this.turbine) {
      // torque on the crank through the converter + lock-up clutch
      this.clutchTorque = this.clutchRow.enabled ? -this.clutchRow.lambda : 0;
      this.clutchTorque2 = this.clutchRow2.enabled ? -this.clutchRow2.lambda : 0;
    } else {
      this.clutchTorque = this.clutchRow.enabled ? -this.clutchRow.lambda : 0;
      this.clutchTorque2 = this.clutchRow2.enabled ? -this.clutchRow2.lambda : 0;
    }
    this.tireForce = -this.tireRow.lambda;
    this.frontTireForce = front ? -this.tireFrontRow.lambda : 0;
    this.dragForce = aero;
    this.rollingForce = -this.rollingRow.lambda;
    this.brakeForce = -this.brakeFreeRow.lambda + (-this.brakeDrivenRow.lambda) / r + (front ? -this.brakeFrontRow.lambda / r : 0);
    const v1 = this.body.v;
    this.acceleration = (v1 - v0Body) / h;
    this.x += v1 * h;
    this.wheelAngleDriven += this.driveline.v * h;
    this.wheelAngleFree += (front ? front.v : v1 / r) * h;
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
    let slipMax = slipVel;
    if (front) {
      const slipF = front.v * r - v1;
      this.tireFront!.updateTemperature(h, this.frontTireForce * slipF, v1);
      if (Math.abs(slipF) > Math.abs(slipMax)) slipMax = slipF;
    }
    this.slipIntegral += Math.abs(slipMax) * h;

    eng.postStep(h, ei, this.simTime, this.body.v);
    const fl = this.failure;
    if (fl && eng.runState !== 'BROKEN') {
      const egt = (eng.exhaustTempK - c.engine.egt.idleK) / (c.engine.egt.maxK - c.engine.egt.idleK);
      if (fl.update(h, eng.rpm, eng.load, eng.turbo ? Math.max(0, eng.turbo.boostPa) / 1e5 : 0, egt, this.simTime)) {
        eng.breakEngine();
        this.onEvent?.({ type: 'ENGINE_BLOWN', simTime: this.simTime, rpm: fl.brokenRpm });
      }
    }
    this.ignitionEventsStep = eng.ignition.eventsLastStep;
    if (eng.rpm > this.maxRpm) this.maxRpm = eng.rpm;
    if (this.gearbox.engaged && this.gearbox.gear > 0) this.gearsUsed.add(this.gearbox.gear);

    const netTorque = engineTorque + eng.frictionRow.lambda;
    eng.torqueNetLast = netTorque;
    eng.frame.torqueNet = netTorque;
    eng.frame.clutchEngagement = this.tcCtl ? lockup : engagement;
    eng.frame.gear = this.gearbox.engaged ? this.gearbox.gear : this.gearbox.gear === 0 ? 0 : this.gearbox.gear;

    const peak = tireEval.peakForce + (tireEvalF ? tireEvalF.peakForce : 0);
    this.fillTelemetry(slipMax, peak, drivenLoad, front ? loads.front : freeLoad, netTorque);
    this.fillAudioFrame(slipMax, front ? drivenLoad + loads.front : drivenLoad);
    this.telemetry.physicsStepMs = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
  }

  /** Torque the crank delivers into the driveline (clutch rows, or converter + lock-up). */
  private crankDriveTorque(): number {
    if (this.turbine) return -(this.converterRow.enabled ? this.converterRow.lambda : 0) - (this.lockupRow.enabled ? this.lockupRow.lambda : 0);
    return this.clutchTorque + this.clutchTorque2;
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
    t.wheelOmegaFree = this.front ? this.front.v : this.body.v / r;
    t.wheelAngleDriven = this.wheelAngleDriven;
    t.wheelAngleFree = this.wheelAngleFree;
    t.slipRatio = slipVel / Math.max(Math.abs(this.body.v), 2);
    t.tireForce = this.tireForce + this.frontTireForce;
    t.tireForceMax = peak;
    t.normalLoadDriven = drivenLoad;
    t.normalLoadFree = freeLoad;
    t.clutchTorque = this.ps ? this.crankDriveTorque() : this.clutchTorque;
    t.wheelTorque = ratio * this.clutchTorque + this.ratio2 * this.clutchTorque2 + this.lossRow.lambda + (this.front ? this.lossFrontRow.lambda : 0);
    t.clutchSlip = this.turbine ? this.engine.crank.v - this.turbine.v : this.engine.crank.v - ratio * this.outputOmega;
    t.gearRatio = ratio;
    t.dragForce = this.dragForce;
    t.rollingForce = this.rollingForce;
    t.brakeForce = this.brakeForce;
    t.pitchRad = this.pitch;
    t.shiftState = this.shift.state;
    t.clutchMode = this.clutchCtl.mode;
    t.engineTorqueNet = netTorque;
    t.powerW = netTorque * this.engine.crank.v;
    t.wheelPowerW = t.tireForce * this.body.v;
    t.ignitionEvents = this.ignitionEventsStep;
    t.afterfire = this.engine.afterfire;
    t.frontTireForce = this.frontTireForce;
    t.centerCouplingTorque = this.centerRow.enabled ? this.centerRow.lambda : 0;
    t.converterSpeedRatio = this.turbine ? this.converterSr : 1;
    t.gearboxMode = this.gearboxMode;
    t.engineStrain = this.failure ? this.failure.strain : 0;
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
    a[AF.turboShaftRpm2] = e.turbo ? e.turbo.shaftRpm2 : 0;
    a[AF.bovFlow] = e.turbo ? e.turbo.bovFlow : 0;
    a[AF.vehicleSpeed] = this.body.v;
    a[AF.wheelSlipSpeed] = Math.abs(slipVel);
    a[AF.tireLoadN] = drivenLoad;
    a[AF.gearboxOutputOmega] = this.outputOmega * this.car.transmission.finalDrive;
    a[AF.clutchSlipOmega] = this.telemetry.clutchSlip;
    a[AF.transmissionTorque] = this.ps ? this.crankDriveTorque() : this.clutchTorque;
    a[AF.gear] = this.gearbox.engaged ? this.gearbox.gear : 0;
    a[AF.torqueNet] = e.torqueNetLast;
    a[AF.paused] = 0;
    a[AF.starterActive] = e.starterRow.enabled ? 1 : 0;
    a[AF.afterfire] = e.afterfire ? 1 : 0;
  }
}
