import type { EngineConfig } from '../../data/schema';
import type { EngineRunState, EngineTelemetryFrame } from '../../core/contracts';
import { ATMOSPHERIC_PRESSURE, FOUR_PI, R_AIR, STANDARD_TEMPERATURE_K, radSToRpm, rpmToRadS } from '../../core/units';
import { MonotoneCubic, clamp, clamp01, firstOrder, positiveMod, smoothstep } from '../../core/math';
import { Prng } from '../../core/prng';
import { ConstraintRow, Dof } from '../solver/ConstraintSolver';
import { engineGeometry, type Geometry } from './EngineGeometry';
import { orificeMassFlow, throttleAttenuation } from './GasFlow';
import { IgnitionModule } from './IgnitionModule';
import { IdleAirController } from './IdleAirController';
import { Turbocharger } from './Turbocharger';

export interface EngineInputs {
  /** Driver / AI throttle request 0..1. */
  pedal: number;
  /** When not null replaces the pedal (rev-match blip, shift strategy). */
  throttleOverride: number | null;
  /** Spark cut fraction requested by the shift controller (0..1). */
  sparkCut: number;
  ignitionOn: boolean;
  starter: boolean;
}

export interface DynoControl {
  enabled: boolean;
  targetOmega: number;
  maxTorque: number;
  /** When true the dyno may also drive the engine up to speed (engine-sim `m_hold`). */
  hold: boolean;
}

export interface Ambient {
  pressurePa: number;
  temperatureK: number;
}

const THROTTLE_DISCHARGE_COEFF = 0.82;
const FLUID_SUBSTEPS = 8; // same value as engine-sim `setFluidSimulationSteps(8)`
const PEAK_VE = 0.95;
/** Load fraction at which the Willans line crosses zero indicated torque. */
export const WILLANS_OFFSET = 0.1;

/**
 * Mean-value engine model on a rotating crankshaft body.
 *
 *   I·dω/dt = T_combustion − T_friction − T_pumping − T_load − T_accessories
 *
 * - T_combustion: indicated torque = WOT indicated torque(rpm) × trapped-charge ratio (load)
 *   × spark/fuel enable. The WOT indicated torque is the configured brake torque curve plus the
 *   modelled losses, so that at wide open throttle and standard conditions the *net* torque equals
 *   the configured curve – power is never imposed, it results from T·ω.
 * - Manifold filling/emptying (speed-density):  dp/dt = (R·T/V)·(ṁ_throttle − ṁ_cylinders),
 *   integrated implicitly in 8 fluid sub-steps; the throttle flow uses the compressible orifice
 *   equation ported from engine-sim.
 * - Coulomb friction, accessory drag and pumping loss are a bounded friction constraint on the
 *   crank (engine-sim `RotationFrictionConstraint`), viscous friction is explicit.
 * - Starter motor and dynamometer are bounded velocity constraints (engine-sim `StarterMotor`,
 *   `Dynamometer`).
 */
export class EngineModel {
  readonly crank: Dof;
  readonly frictionRow = new ConstraintRow('engine-friction');
  readonly starterRow = new ConstraintRow('starter');
  readonly dynoRow = new ConstraintRow('dyno');
  readonly geometry: Geometry;
  readonly ignition: IgnitionModule;
  readonly idleAir: IdleAirController;
  readonly turbo: Turbocharger | null;
  readonly torqueCurve: MonotoneCubic;
  readonly frame: EngineTelemetryFrame;

  ambient: Ambient = { pressurePa: ATMOSPHERIC_PRESSURE, temperatureK: 298.15 };
  dyno: DynoControl = { enabled: false, targetOmega: 0, maxTorque: 3000, hold: false };

  // ----- state -----
  theta = 0;
  runState: EngineRunState = 'OFF';
  manifoldPressure = ATMOSPHERIC_PRESSURE;
  throttleActuator = 0;
  throttleEffective = 0;
  exhaustTempK = 400;
  load = 1;
  airMassFlow = 0;
  torqueCombustion = 0;
  torqueNetLast = 0;
  pumpingTorque = 0;
  fuelCut = false;
  afterfire = false;
  stallCount = 0;
  failedStarts = 0;
  lastMessage = '';
  private crankingTime = 0;
  private catchTime = 0;
  private wasLimiter = false;
  private lastSparkCut = 0;
  private readonly prng = new Prng(0xc0ffee);
  private referencePressure: number;
  /** Charge torque table K(rpm): indicated torque at load 1 (MAP = reference pressure). */
  private readonly kTable: Float64Array;
  private readonly veTable: Float64Array;
  private readonly tableRpm0: number;
  private readonly tableStep = 100;
  private readonly throttleArea: number;
  private readonly manifoldVolume: number;
  /** Idle-air opening that gives zero net torque at the idle speed (ECU base map). */
  idleBaseOpening: number;
  /** dT/d(opening) at idle (N·m per unit opening), used for the idle loop gains. */
  idleSensitivity = 1;
  /** Manifold filling time constant at idle (s). */
  idleManifoldTau = 0;
  private runTime = 0;

  constructor(
    public readonly cfg: EngineConfig,
    ambient?: Ambient,
  ) {
    if (ambient) this.ambient = { ...ambient };
    this.geometry = engineGeometry(cfg);
    this.crank = new Dof('crank', cfg.inertiaKgM2);
    this.torqueCurve = new MonotoneCubic(cfg.torqueCurve.rpm, cfg.torqueCurve.torqueNm);
    this.ignition = new IgnitionModule(cfg.firingAnglesDeg, rpmToRadS(cfg.revLimitRpm), cfg.limiterCutTimeS);
    this.throttleArea = (Math.PI * (cfg.throttle.bodyDiameterMm / 1000) ** 2) / 4;
    this.manifoldVolume = cfg.intake.manifoldVolumeL / 1000;
    this.referencePressure =
      ATMOSPHERIC_PRESSURE + (cfg.induction === 'turbo' && cfg.turbo ? cfg.turbo.maxBoostBar * 1e5 : 0);
    // ---- charge torque / VE tables (see buildTables) ----
    this.tableRpm0 = Math.min(cfg.torqueCurve.rpm[0]!, 300);
    const n = Math.ceil((cfg.revLimitRpm * 1.15 - this.tableRpm0) / this.tableStep) + 2;
    this.kTable = new Float64Array(n);
    this.veTable = new Float64Array(n);
    let peakRpm = cfg.idleRpm;
    let peakBrake = 0;
    for (let rpm = cfg.idleRpm; rpm <= cfg.revLimitRpm; rpm += 50) {
      const t = this.torqueCurve.evaluate(rpm);
      if (t > peakBrake) {
        peakBrake = t;
        peakRpm = rpm;
      }
    }
    if (cfg.induction === 'turbo' && cfg.turbo) {
      const rho = this.referencePressure / (R_AIR * this.ambient.temperatureK);
      const refFlow = PEAK_VE * rho * this.geometry.displacement * (rpmToRadS(peakRpm) / FOUR_PI);
      this.turbo = new Turbocharger(cfg.turbo, refFlow);
    } else {
      this.turbo = null;
    }
    this.buildTables();
    this.idleBaseOpening = this.calibrateIdleOpening();
    this.idleAir = this.makeIdleController();
    this.frictionRow.set1(this.crank, 1);
    this.starterRow.set1(this.crank, 1);
    this.dynoRow.set1(this.crank, 1);
    this.frame = {
      simTime: 0,
      engineId: cfg.id,
      rpm: 0,
      crankAngle: 0,
      omega: 0,
      pedal: 0,
      throttle: 0,
      load: 0,
      torqueCombustion: 0,
      torqueNet: 0,
      manifoldPressurePa: this.manifoldPressure,
      boostPressurePa: 0,
      clutchEngagement: 0,
      gear: 0,
      runState: 'OFF',
      ignitionOn: false,
      revLimiterActive: false,
      sparkCut: 0,
      exhaustTempK: this.exhaustTempK,
      turboShaftRpm: 0,
      bovFlow: 0,
      starterActive: false,
    };
    this.reset();
  }

  reset(): void {
    this.crank.v = 0;
    this.theta = 0;
    this.runState = 'OFF';
    this.manifoldPressure = this.ambient.pressurePa;
    this.throttleActuator = 0;
    this.throttleEffective = 0;
    this.exhaustTempK = this.ambient.temperatureK + 20;
    this.idleAir.reset();
    this.turbo?.reset();
    this.ignition.reset(0);
    this.crankingTime = 0;
    this.catchTime = 0;
    this.fuelCut = false;
    this.afterfire = false;
    this.torqueCombustion = 0;
    this.stallCount = 0;
    this.failedStarts = 0;
    this.lastMessage = '';
  }

  get omega(): number {
    return this.crank.v;
  }
  get rpm(): number {
    return radSToRpm(this.crank.v);
  }
  get cycleAngle(): number {
    return positiveMod(this.theta, FOUR_PI);
  }
  get displacement(): number {
    return this.geometry.displacement;
  }
  get upstreamPressure(): number {
    return this.ambient.pressurePa + (this.turbo ? this.turbo.boostPa : 0) - this.filterDrop(this.airMassFlow);
  }

  /** Air filter / airbox pressure drop (Pa) at an air mass flow (zero without a breathing block). */
  filterDrop(flow: number): number {
    const b = this.cfg.breathing;
    if (!b) return 0;
    const r = flow / b.referenceFlowKgS;
    return b.airFilterDropKPa * 1000 * r * r;
  }

  /** Friction torque magnitude (N·m) at angular speed ω (Coulomb + viscous + quadratic). */
  frictionTorque(omega: number): number {
    const f = this.cfg.friction;
    const w = Math.abs(omega);
    return f.coulombNm + f.viscousNmPerRadS * w + f.quadraticNmPerRadS2 * w * w;
  }

  /** Exhaust back pressure (Pa abs) – restriction grows with flow; turbine adds back pressure. */
  backPressure(): number {
    const boost = this.turbo ? this.turbo.boostPa : 0;
    return this.backPressureFor(this.ambient.pressurePa, this.airMassFlow, boost);
  }

  /**
   * Exhaust back pressure (Pa abs) for a flow and boost. With a breathing block the system
   * restriction is quadratic in the flow (Δp = Δp_ref·(ṁ/ṁ_ref)²); otherwise the original law.
   * The turbine adds 0.55 Pa of back pressure per Pa of boost in both cases.
   */
  backPressureFor(ambientPa: number, flow: number, boostPa: number): number {
    const b = this.cfg.breathing;
    if (b) {
      const r = flow / b.referenceFlowKgS;
      return ambientPa + b.exhaustBackPressureKPa * 1000 * r * r + 0.55 * boostPa;
    }
    return ambientPa + 0.04e5 * clamp01(flow / 0.4) + 0.55 * boostPa;
  }

  /** Pumping torque loss (positive = loss): (p_exhaust − p_intake)·V_d/(4π). */
  pumpingLoss(manifoldPa: number, backPa: number): number {
    return ((backPa - manifoldPa) * this.geometry.displacement) / FOUR_PI;
  }

  /**
   * Willans line: indicated work grows linearly with the trapped charge with a negative intercept
   * (residual gas dilution and heat losses dominate at very light load). The intercept is an
   * absolute manifold pressure (WILLANS_OFFSET · 1 atm), the same for NA and boosted engines.
   */
  willansFactor(manifoldPa: number): number {
    const p0 = WILLANS_OFFSET * ATMOSPHERIC_PRESSURE;
    return Math.max(0, (manifoldPa - p0) / (this.referencePressure - p0));
  }

  private tableLookup(table: Float64Array, rpm: number): number {
    const x = (rpm - this.tableRpm0) / this.tableStep;
    if (x <= 0) return table[0]!;
    const i = Math.floor(x);
    if (i >= table.length - 1) return table[table.length - 1]!;
    const f = x - i;
    return table[i]! * (1 - f) + table[i + 1]! * f;
  }

  /**
   * Charge torque K(rpm) (N·m): indicated torque when the manifold is at the reference pressure.
   * Combustion torque = K(rpm) · willans(MAP).
   */
  wotIndicatedTorque(rpm: number): number {
    return this.tableLookup(this.kTable, rpm);
  }

  /** Volumetric efficiency (shape of the charge torque, torque ∝ trapped air). */
  volumetricEfficiency(rpm: number): number {
    return this.tableLookup(this.veTable, rpm);
  }

  /** Air mass flow into the cylinders (kg/s) at a manifold pressure, speed and charge temperature. */
  cylinderMassFlow(pManifold: number, omega: number, tempK = this.manifoldTemperature()): number {
    if (omega <= 0) return 0;
    const rho = pManifold / (R_AIR * tempK);
    return this.volumetricEfficiency(radSToRpm(omega)) * rho * this.geometry.displacement * (omega / FOUR_PI);
  }

  manifoldTemperatureFor(ambientK: number, boostPa: number): number {
    return ambientK * (1 + 0.05 * (boostPa / 1e5));
  }

  private manifoldTemperature(): number {
    return this.manifoldTemperatureFor(this.ambient.temperatureK, this.turbo ? this.turbo.boostPa : 0);
  }

  private throttleEffectiveArea(opening: number): number {
    return THROTTLE_DISCHARGE_COEFF * this.throttleArea * throttleAttenuation(opening, this.cfg.throttle.idlePlatePosition);
  }

  /** Steady-state manifold pressure for a throttle opening at a given speed and upstream state. */
  steadyManifoldPressure(
    opening: number,
    omega: number,
    upstreamPa = this.ambient.pressurePa,
    tempK = this.ambient.temperatureK,
  ): number {
    const area = this.throttleEffectiveArea(opening);
    let lo = 200;
    let hi = upstreamPa;
    for (let i = 0; i < 40; i++) {
      const mid = 0.5 * (lo + hi);
      const net = orificeMassFlow(area, upstreamPa, mid, tempK, tempK) - this.cylinderMassFlow(mid, omega, tempK);
      if (net > 0) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  /**
   * Steady wide-open-throttle operating point at a speed under standard conditions: manifold
   * pressure, air flow and (turbo) steady boost from the turbocharger model (fixed point).
   */
  private steadyWot(rpm: number): { map: number; flow: number; boost: number } {
    const w = rpmToRadS(rpm);
    const pAtm = ATMOSPHERIC_PRESSURE;
    const tAtm = STANDARD_TEMPERATURE_K;
    const evaluate = (boost: number): { map: number; flow: number; target: number } => {
      const tM = this.manifoldTemperatureFor(tAtm, boost);
      let map = this.steadyManifoldPressure(1, w, pAtm + boost, tM);
      let flow = this.cylinderMassFlow(map, w, tM);
      if (this.cfg.breathing) {
        for (let k = 0; k < 3; k++) {
          map = this.steadyManifoldPressure(1, w, pAtm + boost - this.filterDrop(flow), tM);
          flow = this.cylinderMassFlow(map, w, tM);
        }
      }
      if (!this.turbo) return { map, flow, target: 0 };
      const e = this.cfg.egt;
      const load = map / this.referencePressure;
      const egt = e.idleK + (e.maxK - e.idleK) * clamp01(load * this.fueledFraction(flow) * (0.3 + 0.7 * (rpm / this.cfg.redlineRpm)));
      return { map, flow, target: this.turbo.steadyBoost(flow, egt / e.maxK) };
    };
    if (!this.turbo) {
      const r = evaluate(0);
      return { map: r.map, flow: r.flow, boost: 0 };
    }
    // steady boost: lowest root of target(b) − b on [0, b_max] – the one a turbo spooling up from
    // zero boost settles at (target(b_max) ≤ b_max because of the wastegate). Coarse scan for the
    // first sign change, then bisection.
    const bMax = this.cfg.turbo!.maxBoostBar * 1e5;
    const scan = 32;
    let lo = 0;
    let hi = bMax;
    for (let i = 1; i <= scan; i++) {
      const b = (bMax * i) / scan;
      if (evaluate(b).target <= b) {
        hi = b;
        lo = (bMax * (i - 1)) / scan;
        break;
      }
    }
    for (let i = 0; i < 24 && hi - lo > 1; i++) {
      const mid = 0.5 * (lo + hi);
      if (evaluate(mid).target > mid) lo = mid;
      else hi = mid;
    }
    const boost = 0.5 * (lo + hi);
    const r = evaluate(boost);
    return { map: r.map, flow: r.flow, boost };
  }

  /**
   * Builds K(rpm) so that the steady WOT net torque at standard conditions equals the configured
   * brake torque curve:  K·willans(MAP_ss) − friction − accessories − pumping(MAP_ss) = T_curve.
   * For turbo engines MAP_ss includes the steady boost the turbo model reaches at that speed, so a
   * curve that is low at low rpm (turbo lag) is reproduced without double counting, and the engine
   * still produces naturally aspirated torque off boost (cranking, idle).
   * VE follows the shape of K (fixed point; the last pass only rebuilds K with the final VE).
   */
  private buildTables(): void {
    const curveMin = this.cfg.torqueCurve.rpm[0]!;
    this.veTable.fill(PEAK_VE * 0.85); // initial guess: flat VE
    const passes = 4;
    for (let pass = 0; pass < passes; pass++) {
      let peak = 0;
      for (let i = 0; i < this.kTable.length; i++) {
        const rpm = Math.max(this.tableRpm0 + i * this.tableStep, curveMin);
        const w = rpmToRadS(rpm);
        const op = this.steadyWot(rpm);
        const back = this.backPressureFor(ATMOSPHERIC_PRESSURE, op.flow, op.boost);
        const brake = Math.max(this.torqueCurve.evaluate(rpm), 0);
        const losses = this.frictionTorque(w) + this.cfg.accessoriesNm + this.pumpingLoss(op.map, back);
        const k = Math.max(0, brake + losses) / Math.max(this.willansFactor(op.map), 0.05);
        this.kTable[i] = k;
        if (k > peak) peak = k;
      }
      if (pass === passes - 1) break; // last pass: K consistent with the VE it was built with
      for (let i = 0; i < this.kTable.length; i++) {
        this.veTable[i] = clamp((PEAK_VE * this.kTable[i]!) / peak, 0.2, 1.1);
      }
    }
  }

  /**
   * Steady wide-open-throttle operating point at standard conditions (the point the torque curve
   * is calibrated at): manifold pressure, air flow, steady boost, back pressure and the torque
   * split. Used by the career tuning model and the tests; never by the step integration.
   */
  wotOperatingPoint(rpm: number): {
    map: number;
    flow: number;
    boost: number;
    back: number;
    indicatedNm: number;
    frictionNm: number;
    pumpingNm: number;
    brakeNm: number;
  } {
    const op = this.steadyWot(rpm);
    const w = rpmToRadS(rpm);
    const back = this.backPressureFor(ATMOSPHERIC_PRESSURE, op.flow, op.boost);
    const indicatedNm = this.wotIndicatedTorque(rpm) * this.willansFactor(op.map) * this.fueledFraction(op.flow);
    const frictionNm = this.frictionTorque(w) + this.cfg.accessoriesNm;
    const pumpingNm = this.pumpingLoss(op.map, back);
    return { ...op, back, indicatedNm, frictionNm, pumpingNm, brakeNm: indicatedNm - frictionNm - pumpingNm };
  }

  /** Steady-state net torque (no boost, combustion on) for an opening and speed. */
  steadyNetTorque(opening: number, rpm: number, boostPa = 0): number {
    const w = rpmToRadS(rpm);
    const tM = this.manifoldTemperatureFor(this.ambient.temperatureK, boostPa);
    let p = this.steadyManifoldPressure(opening, w, this.ambient.pressurePa + boostPa, tM);
    let flow = this.cylinderMassFlow(p, w, tM);
    if (this.cfg.breathing) {
      for (let k = 0; k < 2; k++) {
        p = this.steadyManifoldPressure(opening, w, this.ambient.pressurePa + boostPa - this.filterDrop(flow), tM);
        flow = this.cylinderMassFlow(p, w, tM);
      }
    }
    const back = this.backPressureFor(this.ambient.pressurePa, flow, boostPa);
    const pumping = this.pumpingLoss(p, back);
    return this.wotIndicatedTorque(rpm) * this.willansFactor(p) * this.fueledFraction(flow) - this.frictionTorque(w) - this.cfg.accessoriesNm - pumping;
  }

  /** Fraction of the trapped air the fuel system can serve at the commanded mixture. */
  private fueledFraction(airKgS: number): number {
    const fueling = this.cfg.fueling;
    if (!fueling || airKgS <= 0) return 1;
    return Math.min(1, (fueling.maxFuelKgS * fueling.airFuelRatio) / airKgS);
  }

  /**
   * Throttle opening that gives a requested steady net torque at a speed with the present boost
   * (inverse of the torque map, bisection). Used by drive-by-wire style controllers (AI traction
   * control). Returns 1 when the request exceeds what the engine can make.
   */
  openingForTorque(torqueNm: number, rpm: number): number {
    const boost = this.turbo ? this.turbo.boostPa : 0;
    if (this.steadyNetTorque(1, rpm, boost) <= torqueNm) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i++) {
      const mid = 0.5 * (lo + hi);
      if (this.steadyNetTorque(mid, rpm, boost) < torqueNm) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  /** Plate opening produced by a pedal position through the linkage (opening = pedal^γ). */
  plateOpeningForPedal(pedal: number): number {
    return Math.pow(clamp01(pedal), this.cfg.throttle.pedalGamma);
  }

  /** Pedal position that gives a plate opening (inverse linkage). */
  pedalForPlateOpening(opening: number): number {
    return Math.pow(clamp01(opening), 1 / this.cfg.throttle.pedalGamma);
  }

  /** Brake torque the engine is producing now without the clutch load (N·m, explicit estimate). */
  get brakeTorqueEstimate(): number {
    return this.torqueCombustion - this.frictionTorque(this.crank.v) - this.cfg.accessoriesNm - this.pumpingTorque;
  }

  /**
   * Base idle-air opening: bisection for the opening at which the steady net torque at idle speed
   * is zero (what an ECU base idle map provides; the closed loop then trims around it).
   */
  private calibrateIdleOpening(): number {
    let lo = 0;
    let hi = 0.25;
    for (let i = 0; i < 40; i++) {
      const mid = 0.5 * (lo + hi);
      if (this.steadyNetTorque(mid, this.cfg.idleRpm) > 0) hi = mid;
      else lo = mid;
    }
    return 0.5 * (lo + hi);
  }

  /**
   * PI gains from the idle torque sensitivity S = dT/d(opening) and the crank inertia so that the
   * closed loop has the configured natural frequency and damping (pole placement on I·dω/dt = S·u).
   */
  private makeIdleController(): IdleAirController {
    const c = this.cfg.idleControl;
    const base = this.idleBaseOpening;
    const d = Math.max(base * 0.25, 1e-4);
    const lo = Math.max(base - d, 0);
    const s = Math.max(
      (this.steadyNetTorque(base + d, this.cfg.idleRpm) - this.steadyNetTorque(lo, this.cfg.idleRpm)) / (base + d - lo),
      1,
    );
    const radPerKrpm = (2 * Math.PI * 1000) / 60; // error unit is 1000 rpm
    const inertia = this.cfg.inertiaKgM2;
    const kp = (2 * c.damping * c.naturalFrequencyRadS * inertia * radPerKrpm) / s;
    const ki = (c.naturalFrequencyRadS ** 2 * inertia * radPerKrpm) / s;
    // manifold filling time constant at idle: τ = V_m·4π / (VE·V_d·ω)   (choked throttle flow)
    const wIdle = rpmToRadS(this.cfg.idleRpm);
    const tauM = (this.manifoldVolume * FOUR_PI) / (this.volumetricEfficiency(this.cfg.idleRpm) * this.geometry.displacement * wIdle);
    this.idleSensitivity = s;
    this.idleManifoldTau = tauM;
    return new IdleAirController(base, kp, ki, kp * tauM, c.maxAirFraction);
  }

  /** Changes the ambient (track) conditions and recalibrates the base idle air. */
  setAmbient(a: Ambient): void {
    this.ambient = { ...a };
    this.idleBaseOpening = this.calibrateIdleOpening();
    this.idleAir.base = this.idleBaseOpening;
  }

  /** Implicit Euler sub-step of the manifold pressure (bisection on the monotone residual). */
  private manifoldSubstep(hs: number, effArea: number, omega: number): number {
    const pUp = this.upstreamPressure;
    const tUp = this.manifoldTemperature();
    const tM = tUp;
    const k = (R_AIR * tM) / this.manifoldVolume;
    const p0 = this.manifoldPressure;
    const residual = (p: number): number =>
      p - p0 - hs * k * (orificeMassFlow(effArea, pUp, p, tUp, tM) - this.cylinderMassFlow(p, omega));
    let lo = 200;
    let hi = Math.max(pUp, p0) * 1.02;
    for (let i = 0; i < 28; i++) {
      const mid = 0.5 * (lo + hi);
      if (residual(mid) > 0) hi = mid;
      else lo = mid;
    }
    this.manifoldPressure = 0.5 * (lo + hi);
    return this.cylinderMassFlow(this.manifoldPressure, omega);
  }

  /**
   * Computes explicit torques, configures the crank constraint rows and returns the explicit
   * torque to apply to the crank DOF during this step.
   */
  preStep(h: number, input: EngineInputs): number {
    const cfg = this.cfg;
    const omega = this.crank.v;
    const rpm = radSToRpm(omega);

    // ----- run state transitions that depend on requests -----
    if (this.runState === 'BROKEN') {
      // a broken engine stays broken for the attempt: no ignition, no starter
    } else if (!input.ignitionOn) {
      if (this.runState === 'RUNNING' || this.runState === 'CRANKING') this.lastMessage = 'ignição desligada';
      this.runState = 'OFF';
    } else if (input.starter && (this.runState === 'OFF' || this.runState === 'STALLED')) {
      this.runState = 'CRANKING';
      this.crankingTime = 0;
      this.catchTime = 0;
      this.idleAir.reset();
      this.lastMessage = 'partida';
    }

    // ----- throttle actuator + idle air -----
    const command = clamp01(input.throttleOverride ?? input.pedal);
    // pedal → plate linkage (port of engine-sim DirectThrottleLinkage: position = s^γ)
    this.throttleActuator = firstOrder(this.throttleActuator, this.plateOpeningForPedal(command), h, cfg.throttle.responseTimeS);
    // idle air = ECU base opening + closed-loop PI trim with dashpot (IdleAirController)
    let idleAir = 0;
    if (this.runState === 'RUNNING') {
      this.runTime += h;
      idleAir = this.idleAir.update(h, cfg.idleRpm, rpm, command < 0.02);
    } else if (this.runState === 'CRANKING') {
      this.runTime = 0;
      idleAir = this.idleBaseOpening * 1.4; // start enrichment / extra air while cranking
    } else {
      this.runTime = 0;
    }
    this.throttleEffective = clamp01(this.throttleActuator + (1 - this.throttleActuator) * Math.max(idleAir, 0));

    // ----- deceleration fuel cut with hysteresis (not during the start flare) -----
    const overrun = command < 0.01 && input.throttleOverride === null;
    if (overrun && rpm > cfg.idleRpm + 1200 && this.runTime > 1.5) this.fuelCut = true;
    if (!overrun || rpm < cfg.idleRpm + 500) this.fuelCut = false;

    // ----- manifold filling & turbo -----
    const effArea = this.throttleEffectiveArea(this.throttleEffective);
    const hs = h / FLUID_SUBSTEPS;
    let flowSum = 0;
    for (let i = 0; i < FLUID_SUBSTEPS; i++) flowSum += this.manifoldSubstep(hs, effArea, omega);
    this.airMassFlow = flowSum / FLUID_SUBSTEPS;
    if (this.turbo) {
      this.turbo.update(h, this.airMassFlow, this.throttleEffective, this.exhaustTempK / cfg.egt.maxK);
    }

    // ----- combustion torque -----
    const burningState = this.runState === 'RUNNING' || this.runState === 'CRANKING';
    const lowSpeedCombustion = smoothstep(110, Math.max(cfg.idleRpm * 0.55, 300), rpm);
    const limiter = this.ignition.limiterActive;
    const sparkFactor = 1 - clamp01(input.sparkCut);
    const burn = burningState && !this.fuelCut && !limiter ? sparkFactor * lowSpeedCombustion : 0;
    this.load = clamp(this.manifoldPressure / this.referencePressure, 0, 1.8);
    const indicated = this.wotIndicatedTorque(Math.max(rpm, cfg.torqueCurve.rpm[0]!));
    const willans = this.willansFactor(this.manifoldPressure);
    this.torqueCombustion = omega > 0 ? indicated * willans * burn * this.fueledFraction(this.airMassFlow) : 0;

    // ----- losses -----
    const back = this.backPressure();
    const pumping = this.pumpingLoss(this.manifoldPressure, back);
    this.pumpingTorque = pumping;
    const f = cfg.friction;
    const w = Math.abs(omega);
    const viscous = (f.viscousNmPerRadS * w + f.quadraticNmPerRadS2 * w * w) * Math.sign(omega);
    const accessories = burningState || this.runState === 'STALLED' || this.runState === 'BROKEN' ? cfg.accessoriesNm : cfg.accessoriesNm * 0.3;
    // pumping gain (boosted manifold) acts as a positive torque only while turning forward
    const pumpingGain = pumping < 0 && omega > 0 ? -pumping : 0;
    const coulomb = f.coulombNm + accessories + Math.max(pumping, 0) * clamp01(w / 4);

    this.frictionRow.enabled = true;
    this.frictionRow.bias = 0;
    this.frictionRow.cfm = 0;
    this.frictionRow.lo = -coulomb;
    this.frictionRow.hi = coulomb;

    // ----- starter motor (engine-sim StarterMotor: bounded velocity drive, pushes forward only) ----
    const starterOn = input.starter && input.ignitionOn && this.runState === 'CRANKING';
    this.starterRow.enabled = starterOn;
    this.starterRow.bias = rpmToRadS(cfg.starter.speedRpm);
    this.starterRow.cfm = 0;
    this.starterRow.lo = 0;
    this.starterRow.hi = cfg.starter.torqueNm;

    // ----- dynamometer (engine-sim Dynamometer) -----
    const d = this.dyno;
    this.dynoRow.enabled = d.enabled;
    this.dynoRow.bias = d.targetOmega;
    this.dynoRow.cfm = 0;
    this.dynoRow.lo = d.enabled ? -d.maxTorque : 0;
    this.dynoRow.hi = d.enabled && d.hold ? d.maxTorque : 0;

    this.ignition.sparkCut = clamp01(input.sparkCut);
    this.lastSparkCut = input.sparkCut;
    return this.torqueCombustion + pumpingGain - viscous;
  }

  /** Integrates the crank angle and updates ignition events, limiter and run state. */
  postStep(h: number, input: EngineInputs, simTime: number): void {
    const cfg = this.cfg;
    const omega = this.crank.v;
    const rpm = radSToRpm(omega);
    this.theta += omega * h;
    if (this.theta > 1e6) this.theta = positiveMod(this.theta, FOUR_PI);

    const burningState = this.runState === 'RUNNING' || this.runState === 'CRANKING';
    this.ignition.enabledGlobal = burningState && !this.fuelCut && rpm > 110;
    this.ignition.update(h, this.cycleAngle, omega);
    const limiter = this.ignition.limiterActive;

    // afterfire: rev-limiter cut or torque-cut onset with a hot exhaust
    this.afterfire = false;
    const hot = (this.exhaustTempK - cfg.egt.idleK) / (cfg.egt.maxK - cfg.egt.idleK);
    if (limiter && !this.wasLimiter && hot > 0.55 && this.prng.next() < 0.45) this.afterfire = true;
    if (this.lastSparkCut > 0.6 && hot > 0.6 && this.prng.next() < 0.04) this.afterfire = true;
    this.wasLimiter = limiter;

    // exhaust gas temperature (first order, approximate)
    const burning = burningState && !this.fuelCut && !limiter && rpm > 200;
    const target = burning
      ? cfg.egt.idleK + (cfg.egt.maxK - cfg.egt.idleK) * clamp01(this.load * this.fueledFraction(this.airMassFlow) * (0.3 + 0.7 * (rpm / cfg.redlineRpm)))
      : this.ambient.temperatureK + (rpm > 100 ? 120 : 0);
    this.exhaustTempK = firstOrder(this.exhaustTempK, target, h, target > this.exhaustTempK ? 0.7 : 2.5);

    // run state machine
    switch (this.runState) {
      case 'CRANKING': {
        this.crankingTime += h;
        if (rpm > cfg.idleRpm * 0.6) this.catchTime += h;
        else this.catchTime = 0;
        if (this.catchTime > 0.15) {
          this.runState = 'RUNNING';
          this.lastMessage = 'motor em funcionamento';
        } else if (!input.starter) {
          this.runState = 'STALLED';
          this.failedStarts++;
          this.lastMessage = 'partida interrompida';
        } else if (this.crankingTime > 5) {
          this.runState = 'STALLED';
          this.failedStarts++;
          this.lastMessage = 'falha na partida (carga excessiva ou rotação insuficiente)';
        }
        break;
      }
      case 'RUNNING': {
        if (rpm < Math.max(200, cfg.idleRpm * 0.3)) {
          this.runState = 'STALLED';
          this.stallCount++;
          this.lastMessage = 'motor apagou';
        }
        break;
      }
      default:
        break;
    }

    const fr = this.frame;
    fr.simTime = simTime;
    fr.rpm = rpm;
    fr.crankAngle = this.cycleAngle;
    fr.omega = omega;
    fr.pedal = input.pedal;
    fr.throttle = this.throttleEffective;
    fr.load = this.load;
    fr.torqueCombustion = this.torqueCombustion;
    fr.manifoldPressurePa = this.manifoldPressure;
    fr.boostPressurePa = this.turbo ? this.turbo.boostPa : 0;
    fr.runState = this.runState;
    fr.ignitionOn = input.ignitionOn;
    fr.revLimiterActive = limiter;
    fr.sparkCut = clamp01(input.sparkCut);
    fr.exhaustTempK = this.exhaustTempK;
    fr.turboShaftRpm = this.turbo ? this.turbo.shaftRpm : 0;
    fr.turboShaftRpm2 = this.turbo ? this.turbo.shaftRpm2 : 0;
    fr.bovFlow = this.turbo ? this.turbo.bovFlow : 0;
    fr.starterActive = this.starterRow.enabled;
  }

  /**
   * Mechanical failure (blown engine): combustion stops for good, the crank keeps its friction, so
   * the car coasts down naturally. Final for this engine instance (a new attempt builds a new one).
   */
  breakEngine(message = 'motor quebrou'): void {
    if (this.runState === 'BROKEN') return;
    this.runState = 'BROKEN';
    this.fuelCut = true;
    this.lastMessage = message;
    this.frame.runState = 'BROKEN';
  }

  /** Can the engine produce combustion right now (used by the acoustic model). */
  get combustionEnabled(): boolean {
    const s = this.runState;
    return (s === 'RUNNING' || s === 'CRANKING') && !this.fuelCut && this.rpm > 110;
  }

  get dynoTorque(): number {
    return -this.dynoRow.lambda;
  }
}
