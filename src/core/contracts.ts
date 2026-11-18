/**
 * Typed contracts between the independent modules (physics → audio, physics → render/UI).
 * The physics engine is the single source of truth; every consumer only reads these frames.
 */

/** BROKEN: the engine failed mechanically (blown engine); final for the attempt, nothing restarts it. */
export type EngineRunState = 'OFF' | 'CRANKING' | 'RUNNING' | 'STALLED' | 'BROKEN';

export type ShiftState =
  | 'IDLE'
  | 'TORQUE_CUT'
  | 'CLUTCH_DISENGAGE'
  | 'GEAR_CHANGE'
  | 'REV_MATCH'
  | 'CLUTCH_ENGAGE'
  | 'TORQUE_PHASE'
  | 'INERTIA_PHASE'
  | 'COMPLETE';

export type ClutchMode = 'OPEN' | 'LAUNCH' | 'SHIFT' | 'LOCKED' | 'ANTI_STALL' | 'MANUAL_TEST';

/** Physics → acoustics contract (also used by HUD and telemetry). */
export interface EngineTelemetryFrame {
  /** Simulation time of this frame (s). */
  simTime: number;
  engineId: string;
  rpm: number;
  /** Crank angle inside the 4-stroke cycle, 0..4π rad (engine-sim `getCycleAngle`). */
  crankAngle: number;
  /** Crankshaft angular velocity (rad/s). */
  omega: number;
  /** Driver/AI throttle request 0..1. */
  pedal: number;
  /** Effective throttle opening after actuator dynamics, idle control and rev-match blips. */
  throttle: number;
  /** Engine load: trapped air charge relative to the reference WOT charge (≈ manifold / reference pressure). */
  load: number;
  /** Instantaneous combustion (indicated) torque (N·m). */
  torqueCombustion: number;
  /** Net brake torque at the flywheel after friction, pumping and accessories (N·m). */
  torqueNet: number;
  manifoldPressurePa: number;
  /** Boost pressure above ambient (Pa, gauge). 0 for naturally aspirated engines. */
  boostPressurePa: number;
  /** Fraction of the clutch capacity currently commanded (0 open … 1 fully clamped). */
  clutchEngagement: number;
  gear: number;
  runState: EngineRunState;
  ignitionOn: boolean;
  revLimiterActive: boolean;
  /** Fraction of combustion events suppressed by the shift torque cut (0..1). */
  sparkCut: number;
  /** Approximate exhaust gas temperature (K). */
  exhaustTempK: number;
  turboShaftRpm: number;
  /** Second rotor of a parallel-twin turbo (0 on a single turbo). */
  turboShaftRpm2?: number;
  /** Blow-off valve vent flow, normalized 0..1. */
  bovFlow: number;
  starterActive: boolean;
}

/**
 * Compact numeric layout of the audio control frame sent to the AudioWorklet each physics step.
 * A Float64Array is reused on the main thread and copied into the message (no object graph).
 */
export const AF = {
  simTime: 0,
  omega: 1,
  crankAngle: 2,
  throttle: 3,
  load: 4,
  manifoldPressure: 5,
  boostPressure: 6,
  combustionEnabled: 7, // 1 when ignition on and engine able to burn (RUNNING or catching while cranking)
  sparkCut: 8,
  revLimiter: 9,
  exhaustTempK: 10,
  turboShaftRpm: 11,
  bovFlow: 12,
  vehicleSpeed: 13,
  wheelSlipSpeed: 14, // |ωr − v| on the driven axle (m/s)
  tireLoadN: 15,
  gearboxOutputOmega: 16,
  clutchSlipOmega: 17,
  transmissionTorque: 18,
  gear: 19,
  torqueNet: 20,
  paused: 21,
  starterActive: 22,
  afterfire: 23, // 1 on the step an afterfire (unburnt fuel igniting in the hot exhaust) happens
  turboShaftRpm2: 24, // second rotor of a parallel-twin turbo (0 otherwise)
  length: 25,
} as const;

export interface VehicleTelemetry {
  simTime: number;
  engine: EngineTelemetryFrame;
  speed: number;
  acceleration: number;
  distance: number;
  wheelOmegaDriven: number;
  wheelOmegaFree: number;
  wheelAngleDriven: number;
  wheelAngleFree: number;
  slipRatio: number;
  tireForce: number;
  tireForceMax: number;
  normalLoadDriven: number;
  normalLoadFree: number;
  wheelTorque: number;
  clutchTorque: number;
  clutchSlip: number;
  gearRatio: number;
  dragForce: number;
  rollingForce: number;
  brakeForce: number;
  pitchRad: number;
  shiftState: ShiftState;
  clutchMode: ClutchMode;
  engineTorqueNet: number;
  powerW: number;
  wheelPowerW: number;
  physicsStepMs: number;
  ignitionEvents: number;
  afterfire: boolean;
  /** Front axle tyre force of a four-wheel-drive car (N); 0 otherwise. */
  frontTireForce?: number;
  /** Torque transferred by the centre coupling (front ← rear positive, N·m). */
  centerCouplingTorque?: number;
  /** Torque converter turbine/impeller speed ratio (automatics). */
  converterSpeedRatio?: number;
  /** Automatic gearbox mode: D (schedule) or M (manual requests); null for the manual gearbox. */
  gearboxMode?: 'D' | 'M' | null;
  /** Engine strain 0..1 (over-rev exposure, see EngineOverrevFailure); 0 when failures are off. */
  engineStrain?: number;
}

export interface InputState {
  throttle: number; // 0..1 (already progressive)
  upshift: boolean; // edge-triggered request
  downshift: boolean; // edge-triggered request
}
