import type { EngineConfig } from '../../../data/schema';
import { ATMOSPHERIC_PRESSURE, R_AIR, STANDARD_TEMPERATURE_K } from '../../../core/units';
import { EngineModel, WILLANS_OFFSET } from '../../../physics/engine/EngineModel';
import { engineGeometry } from '../../../physics/engine/EngineGeometry';
import type { CamPart, ExhaustPart, FilterPart, ManifoldPart, TurboPart, MechanicalMods } from './parts';

/**
 * Physical model of the career engine parts. The engine's torque curve is the steady WOT brake
 * torque of its hardware; EngineModel calibrates its charge table so the running engine reproduces
 * that curve. A part changes the hardware, so this module derives the curve of the NEW hardware
 * from the stock operating point of the same EngineModel, term by term:
 *
 *   T_brake = T_indicated · Π(charge ratios) − T_friction − T_pumping(new MAP, new back pressure)
 *
 * Charge ratios (fresh air trapped per cycle, new / stock), each from a textbook mechanism:
 *  - air filter:   upstream pressure p_atm − Δp_f(ṁ), Δp_f = Δp_ref·(ṁ/ṁ_ref)² (turbulent element);
 *  - exhaust:      back pressure p_b = p_atm + Δp_ref·(ṁ/ṁ_ref)²; residual gas fraction
 *                  x_r ≈ (p_b / p_map)^(1/γ) / r_c (Heywood, eq. 6.24 simplified) dilutes the charge,
 *                  and (p_b − p_map)·V_d / 4π is the pumping work;
 *  - intake runners: Helmholtz resonance, f ∝ √(A / (L·V)): shorter, wider runners move the
 *                  ram-tuning bump up in rpm; the runner's own pressure loss scales with 1/D⁴;
 *  - camshaft:     later intake closing traps more air at high rpm (inertia ram) and pushes charge
 *                  back into the manifold at low rpm; more overlap dilutes the low-speed charge;
 *                  more lift raises the flow capacity where the valve chokes (high rpm);
 *  - turbo:        steady boost from the game's Turbocharger model (fixed point on the curve),
 *                  charge density through a compressor (η_c 0.65) and an intercooler, Willans line
 *                  extended to the boosted MAP, and ignition retard against knock.
 * Nothing scales power directly: every factor is a pressure, a density or a trapped-mass ratio.
 */

const GAMMA_EXHAUST = 1.3;
const COMPRESSOR_EFFICIENCY = 0.65;
/** Amplitude of the intake ram-tuning bump in volumetric efficiency (≈ 5 % on 2-valve engines). */
const RAM_TUNING_AMPLITUDE = 0.05;
/** Relative width of the tuning bump (fraction of the tuned speed). */
const RAM_TUNING_WIDTH = 0.38;
/** Runner + port pressure loss of a stock manifold at the reference flow (kPa). */
const STOCK_RUNNER_DROP_KPA = 1.6;
/** Charge change per crank degree of intake-closing delay, per unit of (rpm/rated − pivot). */
const IVC_SENSITIVITY_PER_DEG = 0.0045;
const IVC_PIVOT = 0.78;
/** Flow-capacity gain per mm of extra valve lift where the valve chokes. */
const LIFT_GAIN_PER_MM = 0.03;
/** Low-speed dilution per degree of extra valve overlap. */
const OVERLAP_LOSS_PER_DEG = 0.0016;

export interface EngineParts {
  filter?: FilterPart;
  manifold?: ManifoldPart;
  cam?: CamPart;
  exhaust?: ExhaustPart;
  turbo?: TurboPart;
  /** Wastegate setting of the turbo (bar); default: the kit's. */
  boostBar?: number;
  /** Additional hardware effects resolved from independent workshop slots. */
  mod?: MechanicalMods;
}

/** Stock breathing assumed for an engine that has none documented (estimated values). */
export function withStockBreathing(e: EngineConfig, ratedRpm: number): EngineConfig {
  if (e.breathing) return e;
  const g = engineGeometry(e);
  const flow = 0.85 * (ATMOSPHERIC_PRESSURE / (R_AIR * STANDARD_TEMPERATURE_K)) * g.displacement * ((ratedRpm * 2 * Math.PI) / 60 / (4 * Math.PI));
  return { ...e, breathing: { referenceFlowKgS: Math.round(flow * 10000) / 10000, airFilterDropKPa: 3.0, exhaustBackPressureKPa: 18 } };
}

/** Speed of the brake-power peak of a curve (rpm). */
export function powerPeakRpm(c: { rpm: readonly number[]; torqueNm: readonly number[] }, maxRpm = Infinity): number {
  let best = 0;
  let at = c.rpm[0]!;
  for (let i = 0; i < c.rpm.length; i++) {
    const r = c.rpm[i]!;
    if (r > maxRpm) break;
    const p = c.torqueNm[i]! * r;
    if (p > best) {
      best = p;
      at = r;
    }
  }
  return at;
}

export function torquePeakRpm(c: { rpm: readonly number[]; torqueNm: readonly number[] }): number {
  let i = 0;
  for (let k = 1; k < c.torqueNm.length; k++) if (c.torqueNm[k]! > c.torqueNm[i]!) i = k;
  return c.rpm[i]!;
}

/** Peak power (cv) of a brake torque curve up to a speed. */
export function curvePeakCv(c: { rpm: readonly number[]; torqueNm: readonly number[] }, maxRpm: number): number {
  let best = 0;
  for (let i = 0; i < c.rpm.length; i++) {
    if (c.rpm[i]! > maxRpm) break;
    best = Math.max(best, (c.torqueNm[i]! * c.rpm[i]! * Math.PI) / 30 / 735.49875);
  }
  return best;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The stock curve extended (linearly, along its last slope) up to a higher speed limit. */
function extendCurve(e: EngineConfig, toRpm: number): EngineConfig {
  const rpm = [...e.torqueCurve.rpm];
  const t = [...e.torqueCurve.torqueNm];
  const last = rpm[rpm.length - 1]!;
  if (last >= toRpm) return e;
  const n = rpm.length;
  const slope = (t[n - 1]! - t[n - 2]!) / (rpm[n - 1]! - rpm[n - 2]!);
  for (let r = last + 400; ; r += 400) {
    const at = Math.min(r, toRpm);
    rpm.push(at);
    t.push(Math.max(1, t[n - 1]! + slope * (at - last)));
    if (at >= toRpm) break;
  }
  return { ...e, torqueCurve: { rpm, torqueNm: t } };
}

/** Speed grid of a modified curve: the stock points plus a 400 rpm grid up to the new limit. */
function gridFor(e: EngineConfig, toRpm: number): number[] {
  const out = new Set<number>(e.torqueCurve.rpm);
  for (let r = 1000; r <= toRpm; r += 400) out.add(r);
  out.add(toRpm);
  return [...out].filter((r) => r <= toRpm).sort((a, b) => a - b);
}

export interface BreathingResult {
  engine: EngineConfig;
  /** Brake torque change at the stock torque and power peaks (diagnostics). */
  steadyBoostBar: { rpm: number; bar: number }[];
  /** Largest torque fraction lost to the ignition retard against knock (0 without turbo). */
  knockLoss: number;
}

/**
 * Derives the engine configuration of the given parts from a stock engine (which must carry a
 * `breathing` block — see withStockBreathing).
 */
export function applyEngineParts(stock: EngineConfig, parts: EngineParts): BreathingResult {
  const b0 = stock.breathing!;
  const mod = parts.mod ?? {};
  const compressionRatio = Math.max(6, stock.compressionRatio + (mod.compressionRatioDelta ?? 0));
  const otto = (r: number): number => 1 - 1 / Math.pow(r, 0.33);
  const thermalRatio = otto(compressionRatio) / otto(stock.compressionRatio);
  const burnRatio = 1 / Math.pow(mod.burnDurationScale ?? 1, 0.15);
  const g = engineGeometry(stock);
  const vdOver4pi = g.displacement / (4 * Math.PI);
  const ratedRpm = powerPeakRpm(stock.torqueCurve, stock.revLimitRpm);
  const torqueRpm = torquePeakRpm(stock.torqueCurve);

  // ---- hardware changes stored in the configuration ----
  const revAdd = parts.cam?.revLimitAddRpm ?? mod.revLimitAddRpm ?? 0;
  const revLimit = stock.revLimitRpm + revAdd;
  const curveTop = Math.max(stock.torqueCurve.rpm[stock.torqueCurve.rpm.length - 1]!, revLimit + 300);
  const filterDrop = Math.max(0.15, (mod.filterDropKPa ?? parts.filter?.airFilterDropKPa ?? b0.airFilterDropKPa) - (mod.filterDropReductionKPa ?? 0));
  const backRef = Math.max(0.5, (mod.backPressureKPa ?? parts.exhaust?.backPressureKPa ?? b0.exhaustBackPressureKPa) - (mod.backPressureReductionKPa ?? 0));
  const m = parts.manifold;
  const runnerL = stock.intake.runnerLengthM * (m?.runnerLengthScale ?? mod.runnerLengthScale ?? 1);
  const runnerD = stock.intake.runnerDiameterMm + (m?.runnerDiameterAddMm ?? mod.runnerDiameterAddMm ?? 0);
  const c = parts.cam;
  const camDelta = {
    evo: c?.evoDeltaDeg ?? mod.camEvoDeltaDeg ?? 0,
    evc: c?.evcDeltaDeg ?? mod.camEvcDeltaDeg ?? 0,
    ivo: c?.ivoDeltaDeg ?? mod.camIvoDeltaDeg ?? 0,
    ivc: c?.ivcDeltaDeg ?? mod.camIvcDeltaDeg ?? 0,
    lift: c?.liftAddMm ?? mod.camLiftAddMm ?? 0,
  };
  const hasCam = !!c || !!mod.camLiftAddMm || !!mod.camIvcDeltaDeg;
  const cam = hasCam ? {
    evoDeg: stock.cam.evoDeg + camDelta.evo,
    evcDeg: stock.cam.evcDeg + camDelta.evc,
    ivoDeg: stock.cam.ivoDeg + camDelta.ivo,
    ivcDeg: stock.cam.ivcDeg + camDelta.ivc,
    intakeLiftMm: stock.cam.intakeLiftMm + camDelta.lift,
    exhaustLiftMm: stock.cam.exhaustLiftMm + camDelta.lift,
  } : stock.cam;
  const overlapAdd = camDelta.evc - camDelta.ivo;

  // ---- stock operating points (same EngineModel the race uses) ----
  const stockExt = extendCurve(stock, curveTop);
  const stockModel = new EngineModel(stockExt);
  const grid = gridFor(stockExt, curveTop);

  // Helmholtz: tuned speed ∝ √(A/L); the stock manifold is assumed tuned at the torque peak.
  const tunedStock = torqueRpm;
  const tunedNew = tunedStock * (runnerD / stock.intake.runnerDiameterMm) * Math.sqrt(stock.intake.runnerLengthM / runnerL);
  const ram = (rpm: number, tuned: number): number => 1 + RAM_TUNING_AMPLITUDE * Math.exp(-(((rpm - tuned) / (RAM_TUNING_WIDTH * tuned)) ** 2));
  const runnerDrop = (flow: number, d: number): number => STOCK_RUNNER_DROP_KPA * 1000 * (stock.intake.runnerDiameterMm / d) ** 4 * (flow / b0.referenceFlowKgS) ** 2;

  const na: number[] = [];
  const naIndicated: number[] = [];
  const naMap: number[] = [];
  for (const rpm of grid) {
    const op = stockModel.wotOperatingPoint(rpm);
    const r = op.flow / b0.referenceFlowKgS;
    // upstream (filter) and runner losses act on the manifold pressure
    const filterRatio = (ATMOSPHERIC_PRESSURE - filterDrop * 1000 * r * r) / (ATMOSPHERIC_PRESSURE - b0.airFilterDropKPa * 1000 * r * r);
    const runnerRatio =
      (op.map - runnerDrop(op.flow, runnerD) + runnerDrop(op.flow, stock.intake.runnerDiameterMm)) / op.map;
    const map = op.map * filterRatio * runnerRatio;
    const back = ATMOSPHERIC_PRESSURE + backRef * 1000 * r * r;
    const residual = (p: number, pm: number): number => Math.pow(p / pm, 1 / GAMMA_EXHAUST) / stock.compressionRatio;
    const residualRatio = (1 - residual(back, map)) / (1 - residual(op.back, op.map));
    const x = rpm / ratedRpm;
    const camRatio = hasCam
      ? (1 + IVC_SENSITIVITY_PER_DEG * camDelta.ivc * (x - IVC_PIVOT)) *
        (1 + LIFT_GAIN_PER_MM * camDelta.lift * smoothstep(0.55, 1.15, x)) *
        (1 - OVERLAP_LOSS_PER_DEG * overlapAdd * Math.max(0, 0.6 - x) / 0.6)
      : 1;
    // Port flow, throttle cross-section and Otto efficiency alter trapped mass / indicated work,
    // not an arbitrary power multiplier; strongest flow effect near peak rated air demand.
    const portFlowRatio = 1 + ((mod.headFlowScale ?? 1) - 1) * smoothstep(0.48, 1.2, x);
    const throttleDiam = stock.throttle.bodyDiameterMm;
    const newThrottle = throttleDiam + (mod.throttleDiameterAddMm ?? 0);
    const throttleFlowRatio = 1 + Math.min(0.012, (newThrottle * newThrottle / (throttleDiam * throttleDiam) - 1) * 0.055) * smoothstep(0.55, 1.1, x);
    const ramRatio = ram(rpm, tunedNew) / ram(rpm, tunedStock);
    const willans = (p: number): number => p - WILLANS_OFFSET * ATMOSPHERIC_PRESSURE;
    // Willans line: indicated work ∝ (charge − offset); the charge follows MAP × trapped-mass ratios
    const chargeRatio = residualRatio * camRatio * ramRatio * portFlowRatio * throttleFlowRatio;
    const indicated = (op.indicatedNm * willans(map * chargeRatio) * thermalRatio * burnRatio) / willans(op.map);
    const pumping = (back - map) * vdOver4pi;
    const friction = op.frictionNm * (mod.coolingFrictionScale ?? 1);
    na.push(indicated - friction - pumping);
    naIndicated.push(indicated);
    naMap.push(map);
  }

  const base: EngineConfig = {
    ...stock,
    revLimitRpm: revLimit,
    redlineRpm: stock.redlineRpm + revAdd,
    maxSafeRpm: Math.max(stock.maxSafeRpm, revLimit + (stock.maxSafeRpm - stock.revLimitRpm)),
    cam,
    compressionRatio,
    inertiaKgM2: stock.inertiaKgM2 * (mod.flywheelInertiaScale ?? 1),
    throttle: {
      ...stock.throttle,
      bodyDiameterMm: stock.throttle.bodyDiameterMm + (mod.throttleDiameterAddMm ?? 0),
      responseTimeS: stock.throttle.responseTimeS * (mod.throttleResponseScale ?? 1),
    },
    friction: {
      coulombNm: stock.friction.coulombNm * (mod.coolingFrictionScale ?? 1),
      viscousNmPerRadS: stock.friction.viscousNmPerRadS * (mod.coolingFrictionScale ?? 1),
      quadraticNmPerRadS2: stock.friction.quadraticNmPerRadS2 * (mod.coolingFrictionScale ?? 1),
    },
    combustion: { ...stock.combustion, burnDurationDeg: stock.combustion.burnDurationDeg * (mod.burnDurationScale ?? 1) },
    intake: {
      ...stock.intake,
      runnerLengthM: runnerL,
      runnerDiameterMm: runnerD,
      manifoldVolumeL: stock.intake.manifoldVolumeL * (m?.plenumScale ?? mod.plenumScale ?? 1) + (parts.turbo?.chargePipeVolumeL ?? 0),
      airboxVolumeL: stock.intake.airboxVolumeL * (mod.airboxVolumeScale ?? 1),
    },
    breathing: { ...b0, airFilterDropKPa: filterDrop, exhaustBackPressureKPa: backRef },
    torqueCurve: { rpm: grid, torqueNm: na.map((t) => round1(Math.max(t, 1))) },
  };

  const turbo = parts.turbo;
  if (!turbo) return { engine: base, steadyBoostBar: [], knockLoss: 0 };
  const turboCfg = {
    ...turbo.turbo,
    maxBoostBar: parts.boostBar ?? mod.boostTargetBar ?? turbo.turbo.maxBoostBar,
    spoolTimeS: turbo.turbo.spoolTimeS * (mod.turboSpoolScale ?? 1),
    fullBoostFlowFraction: turbo.turbo.fullBoostFlowFraction * (mod.turboFlowScale ?? 1),
  };
  const intercooler = Math.min(0.92, (mod.intercoolerEffectiveness ?? turbo.intercoolerEffectiveness) + (mod.intercoolerEffectivenessAdd ?? 0));
  let knockLoss = 0;

  // ---- turbo: fixed point between the curve and the steady boost it produces ----
  const fuel = engineFuel(stock);
  const knockPerBar = fuel === 'ethanol' ? turbo.knockLossPerBarEthanol : turbo.knockLossPerBarPetrol;
  const crExcess = Math.max(1, compressionRatio - 7);
  let curve = base.torqueCurve.torqueNm.slice();
  let boosts: number[] = grid.map(() => 0);
  for (let pass = 0; pass < 5; pass++) {
    const cand: EngineConfig = { ...base, induction: 'turbo', turbo: turboCfg, torqueCurve: { rpm: grid, torqueNm: curve } };
    const model = new EngineModel(cand);
    const next: number[] = [];
    boosts = [];
    for (let i = 0; i < grid.length; i++) {
      const op = model.wotOperatingPoint(grid[i]!);
      const pr = (ATMOSPHERIC_PRESSURE + op.boost) / ATMOSPHERIC_PRESSURE;
      const t2 = STANDARD_TEMPERATURE_K * (1 + (Math.pow(pr, 0.2857) - 1) / COMPRESSOR_EFFICIENCY);
      const tCharge = t2 - intercooler * (t2 - STANDARD_TEMPERATURE_K);
      // boosted MAP scaled from the NA point (same restriction ratio, higher upstream pressure)
      const mapT = naMap[i]! * pr;
      const willans = (p: number): number => p - WILLANS_OFFSET * ATMOSPHERIC_PRESSURE;
      const density = (mapT * STANDARD_TEMPERATURE_K) / tCharge;
      const knock = 1 - knockPerBar * (mod.knockRetardScale ?? 1) * (mod.coolingKnockScale ?? 1) * (op.boost / 1e5) * crExcess;
      knockLoss = Math.max(knockLoss, 1 - knock);
      const indicated = (naIndicated[i]! * willans(density) * knock) / willans(naMap[i]!);
      const back = op.back;
      const pumping = (back - mapT) * vdOver4pi;
      next.push(round1(Math.max(indicated - op.frictionNm * (mod.coolingFrictionScale ?? 1) - pumping, 1)));
      boosts.push(op.boost / 1e5);
    }
    const change = Math.max(...next.map((t, i) => Math.abs(t - curve[i]!)));
    curve = next;
    if (change < 0.5) break;
  }
  return {
    engine: { ...base, induction: 'turbo', turbo: turboCfg, torqueCurve: { rpm: grid, torqueNm: curve } },
    steadyBoostBar: grid.map((rpm, i) => ({ rpm, bar: Math.round(boosts[i]! * 100) / 100 })),
    knockLoss,
  };
}

/** Fuel of an engine: the field when present, else inferred from the id (older data). */
export function engineFuel(e: EngineConfig): 'gasoline' | 'ethanol' {
  return e.fuel ?? (/ethanol|etanol|alcool/i.test(e.id) ? 'ethanol' : 'gasoline');
}

/** Highest compression ratio that takes 0.6 bar of boost with ignition retard alone. */
export const TURBO_MAX_COMPRESSION: Record<'gasoline' | 'ethanol', number> = { gasoline: 10.5, ethanol: 13 };

const round1 = (v: number): number => Math.round(v * 10) / 10;
