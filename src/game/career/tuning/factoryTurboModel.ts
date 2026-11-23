import type { EngineConfig } from '../../../data/schema';
import { ATMOSPHERIC_PRESSURE, STANDARD_TEMPERATURE_K } from '../../../core/units';
import { EngineModel, WILLANS_OFFSET } from '../../../physics/engine/EngineModel';
import { engineGeometry } from '../../../physics/engine/EngineGeometry';
import {
  burnWorkRatio, camChargeRatio, camGeometryDelta, extendCurve, headChargeRatio, intakeRamRatio, modifiedCam,
  ottoEfficiency, powerPeakRpm, runnerPressureRecoveryPa, throttleChargeRatio, torquePeakRpm,
} from './breathingModel';
import type { EngineFamilyDef } from './chapter2Parts';
import { memoizeEngineCalibration } from './engineCalibrationCache';
import type { BoostControlPart, CamPart, EcuPart, ExhaustPart, FilterPart, HeadPart, IntercoolerPart, ManifoldPart, MechanicalMods, PistonPart, TurboUpgradePart, WastegatePart } from './parts';

/**
 * Tuning of a FACTORY turbocharged engine (resolver v2). The stock WOT curve is the brake torque
 * of the stock hardware at the stock boost, under the stock ECU torque limiter. A modification
 * changes the hardware or the calibration; the new curve is derived from the stock operating
 * point of the same EngineModel the race runs, term by term (as breathingModel.ts does for NA
 * engines):
 *
 *   T_brake = T_ind · (ρ_charge,new / ρ_charge,stock in the Willans line) · η_otto ratio · ignition
 *             · (1 − knock retard) − T_friction − T_pumping(new MAP, new back pressure)
 *   clamped by the torque limiter of the ECU (stock: the stock curve; remap: a fraction of the
 *   mechanical limit of the pistons/rods).
 *
 *  - boost target: stock ECU = factory target; Stage 1 = factory + boostAdd; programmable = the
 *    tune. The wastegate holds at most factory + 0.35 bar (factory actuator) or + its headroom.
 *  - the boost that actually develops at each speed comes from the game's Turbocharger model
 *    (spool vs exhaust flow, fixed point with the new curve) and is capped by the compressor flow
 *    capacity: the factory unit flows 12 % more than its rated point, a hybrid `flowScale` more;
 *    above that the boost falls with rpm (the turbo "runs out").
 *  - charge temperature: compressor η 0.65, intercooler effectiveness (factory 0.6);
 *  - knock: 98 RON runs the family's knock-free boost; above it the ECU retards ignition (7 % of
 *    indicated torque per bar), less with a better intercooler and lower compression.
 * Nothing scales power directly.
 */

const COMPRESSOR_EFFICIENCY = 0.65;
const FACTORY_INTERCOOLER = 0.6;
/** Boost the factory wastegate actuator holds above the factory target (bar). */
export const FACTORY_WASTEGATE_HEADROOM_BAR = 0.35;
/** Flow capacity of the factory compressor relative to its rated operating point. */
const FACTORY_COMPRESSOR_MARGIN = 1.12;
const KNOCK_LOSS_PER_BAR = 0.07;

/** Outlet temperature of the charge circuit at a given boost and heat rejection. */
export function factoryChargeTemperatureK(
  bar: number,
  coolerEffectiveness = FACTORY_INTERCOOLER,
  compressorEfficiency = COMPRESSOR_EFFICIENCY,
): number {
  const pressureRatio = 1 + bar * 1e5 / ATMOSPHERIC_PRESSURE;
  const compressorRiseK = STANDARD_TEMPERATURE_K * (Math.pow(pressureRatio, 0.2857) - 1) / compressorEfficiency;
  return STANDARD_TEMPERATURE_K + compressorRiseK * (1 - coolerEffectiveness);
}

export interface FactoryTurboParts {
  family: EngineFamilyDef;
  filter?: FilterPart;
  exhaust?: ExhaustPart;
  ecu?: EcuPart;
  turbo?: TurboUpgradePart;
  intercooler?: IntercoolerPart;
  boostControl?: BoostControlPart;
  wastegate?: WastegatePart;
  pistons?: PistonPart;
  chamberCompressionAdd?: number;
  cam?: CamPart;
  head?: HeadPart;
  manifold?: ManifoldPart;
  /** Boost target set on the dyno (programmable ECU only), bar gauge. */
  boostBar?: number;
  /** Cooling, breathing and ignition hardware. */
  mod?: MechanicalMods;
}

export interface FactoryTurboResult {
  engine: EngineConfig;
  steadyBoostBar: { rpm: number; bar: number }[];
  knockLoss: number;
  /** Boost target the ECU aims at and what the wastegate can hold (bar). */
  targetBoostBar: number;
  wastegateMaxBar: number;
  torqueLimitNm: number;
  exhaustRestrictionKPa: number;
  chargeTemperatureAtTargetK: number;
  knockFreeBoostBar: number;
}

/** Pressure before the factory turbo model starts retarding ignition under reference conditions. */
export function factoryKnockFreeBoostBar(
  stock: EngineConfig, family: EngineFamilyDef,
  compression = stock.compressionRatio, coolerEffectiveness = FACTORY_INTERCOOLER,
): number {
  return (family.knockFreeBoostBar ?? stock.turbo!.maxBoostBar) +
    0.3 * (stock.compressionRatio - compression) + 0.5 * (coolerEffectiveness - FACTORY_INTERCOOLER);
}

/** Highest boost target the wastegate of this build can hold (bar). */
export function wastegateMaxBar(stock: EngineConfig, bc?: BoostControlPart, ecu?: EcuPart, valve?: WastegatePart): number {
  const headroom = Math.max(FACTORY_WASTEGATE_HEADROOM_BAR, bc?.wastegateHeadroomBar ?? 0,
    ecu?.wastegateHeadroomBar ?? 0, valve?.actuatorHeadroomBar ?? 0);
  return stock.turbo!.maxBoostBar + headroom;
}

/** Boost target the ECU of this build aims at (bar), before the wastegate limit. */
export function ecuBoostTarget(stock: EngineConfig, ecu?: EcuPart, tuneBar?: number): number {
  const b0 = stock.turbo!.maxBoostBar;
  if (!ecu) return b0;
  if (ecu.level === 'programmable' && tuneBar !== undefined) return tuneBar;
  return b0 + ecu.boostAddBar;
}

export const applyFactoryTurboParts = memoizeEngineCalibration(calibrateFactoryTurboParts);

function calibrateFactoryTurboParts(stock: EngineConfig, parts: FactoryTurboParts): FactoryTurboResult {
  const t0 = stock.turbo!;
  const b0 = stock.breathing!;
  const fam = parts.family;
  const g = engineGeometry(stock);
  const vdOver4pi = g.displacement / (4 * Math.PI);
  const ratedRpm = powerPeakRpm(stock.torqueCurve, stock.revLimitRpm);

  // ---- calibration and hardware ----
  const wgMax = wastegateMaxBar(stock, parts.boostControl, parts.ecu, parts.wastegate);
  const target = Math.min(ecuBoostTarget(stock, parts.ecu, parts.boostBar) + (parts.boostBar === undefined ? parts.boostControl?.holdAddBar ?? 0 : 0), wgMax);
  const up = parts.turbo;
  const turboCfg = {
    ...t0,
    maxBoostBar: target,
    fullBoostFlowFraction: t0.fullBoostFlowFraction * (up?.spoolFlowScale ?? 1),
    spoolTimeS: t0.spoolTimeS * (up?.spoolTimeScale ?? 1) * (parts.boostControl?.spoolTimeScale ?? 1) * (parts.exhaust?.spoolTimeScale ?? 1),
    compressorBlades: up?.compressorBlades ?? t0.compressorBlades,
  };
  const icEff = parts.intercooler?.effectiveness ?? FACTORY_INTERCOOLER;
  const cr = stock.compressionRatio + (parts.pistons?.compressionAdd ?? 0) + (parts.chamberCompressionAdd ?? 0);
  const knockFree = factoryKnockFreeBoostBar(stock, fam, cr, icEff);
  const knockAt = (bar: number): number =>
    KNOCK_LOSS_PER_BAR * (parts.mod?.coolingKnockScale ?? 1) * (parts.mod?.knockRetardScale ?? 1) * Math.max(0, bar - knockFree);
  const knockStock = (bar: number): number => KNOCK_LOSS_PER_BAR * Math.max(0, bar - (fam.knockFreeBoostBar ?? t0.maxBoostBar));
  const burnDurationScale = parts.mod?.burnDurationScale ?? 1;
  const indicatedScale = (ottoEfficiency(cr) / ottoEfficiency(stock.compressionRatio)) *
    (1 + (parts.ecu?.ignitionGain ?? 0)) * burnWorkRatio(burnDurationScale);
  const internals = fam.internalsTorqueNm * (parts.pistons?.torqueLimitScale ?? 1);
  // the map's torque target: a fraction of the mechanical limit, and for a staged map also a ceiling
  // over the factory peak (the calibration the stage is sold for)
  const stockPeakCfg = Math.max(...stock.torqueCurve.torqueNm);
  const limitNm = parts.ecu ? Math.min(internals * parts.ecu.torqueLimitFraction, stockPeakCfg * (parts.ecu.stockTorqueGainMax ?? Infinity)) : Infinity;
  const valveKitLimit = parts.cam ? Math.max(fam.valvetrainRevAddRpm, parts.cam.revLimitAddRpm) : fam.valvetrainRevAddRpm;
  const revAdd = Math.min(parts.ecu?.revLimitAddRpm ?? 0, valveKitLimit) + (parts.pistons?.revLimitAddRpm ?? 0);
  const revLimit = stock.revLimitRpm + revAdd;
  // a free-flow part never restricts more than the factory part it replaces
  const filterBase = Math.min(b0.airFilterDropKPa, parts.filter?.airFilterDropKPa ?? b0.airFilterDropKPa);
  const airboxRecovery = parts.mod?.filterDropReductionKPa;
  const filterDrop = airboxRecovery === undefined ? filterBase : Math.max(0.15, filterBase - airboxRecovery);
  const backRef = Math.max(0.5, Math.min(b0.exhaustBackPressureKPa, parts.mod?.backPressureKPa ?? parts.exhaust?.backPressureKPa ?? b0.exhaustBackPressureKPa) - (up?.backPressureReductionKPa ?? 0));
  const camDelta = camGeometryDelta(parts.cam);
  const cam = parts.cam ? modifiedCam(stock.cam, camDelta) : stock.cam;
  const runnerDiam = stock.intake.runnerDiameterMm + (parts.manifold?.runnerDiameterAddMm ?? 0);
  const runnerLength = stock.intake.runnerLengthM * (parts.manifold?.runnerLengthScale ?? 1);
  const tunedStock = torquePeakRpm(stock.torqueCurve);
  const tunedNew = tunedStock * (runnerDiam / stock.intake.runnerDiameterMm) * Math.sqrt(stock.intake.runnerLengthM / runnerLength);
  const intake = {
    ...stock.intake,
    manifoldVolumeL: stock.intake.manifoldVolumeL * (parts.manifold?.plenumScale ?? 1) + (parts.intercooler?.volumeAddL ?? 0),
    runnerDiameterMm: runnerDiam,
    runnerLengthM: runnerLength,
    airboxVolumeL: stock.intake.airboxVolumeL * (parts.mod?.airboxVolumeScale ?? 1),
  };
  const throttle = {
    ...stock.throttle,
    bodyDiameterMm: stock.throttle.bodyDiameterMm + (parts.mod?.throttleDiameterAddMm ?? 0),
    responseTimeS: stock.throttle.responseTimeS * (parts.mod?.throttleResponseScale ?? 1),
  };

  // ---- stock operating points (same EngineModel the race uses) ----
  const curveTop = Math.max(stock.torqueCurve.rpm[stock.torqueCurve.rpm.length - 1]!, revLimit + 300);
  const stockExt = extendCurve(stock, curveTop);
  const stockModel = new EngineModel(stockExt);
  // the stock nodes (plus the extension): a modified curve keeps the factory shape between nodes,
  // so an unchanged point stays exactly the factory value
  const grid = stockExt.torqueCurve.rpm.filter((r) => r <= curveTop);
  const ops0 = grid.map((r) => stockModel.wotOperatingPoint(r));
  // the factory curve at its own nodes (the configured values, not the model's re-evaluation of
  // them, so an unchanged point stays exactly the factory torque)
  const stockCurve = stockExt.torqueCurve.torqueNm.slice(0, grid.length);
  const stockPeakNm = Math.max(...stockCurve);
  const flowRated = stockModel.wotOperatingPoint(ratedRpm).flow;
  const flowCap = flowRated * FACTORY_COMPRESSOR_MARGIN * (fam.compressorMarginScale ?? 1) * (up?.flowScale ?? 1);
  const willans = (p: number): number => p - WILLANS_OFFSET * ATMOSPHERIC_PRESSURE;

  let curve = stockCurve.slice();
  let boosts = grid.map(() => 0);
  let knockLoss = 0;
  for (let pass = 0; pass < 6; pass++) {
    const cand: EngineConfig = { ...stockExt, compressionRatio: cr, turbo: turboCfg, torqueCurve: { rpm: grid, torqueNm: curve } };
    const model = new EngineModel(cand);
    const next: number[] = [];
    boosts = [];
    knockLoss = 0;
    for (let i = 0; i < grid.length; i++) {
      const op0 = ops0[i]!;
      const rpm = grid[i]!;
      const r = op0.flow / b0.referenceFlowKgS;
      const op = model.wotOperatingPoint(rpm);
      const rpmRatio = rpm / ratedRpm;
      const valveCharge = (parts.cam ? camChargeRatio(rpmRatio, camDelta) : 1) * headChargeRatio(rpmRatio, parts.head?.flowGain ?? 0) *
        throttleChargeRatio(rpmRatio, stock.throttle.bodyDiameterMm, throttle.bodyDiameterMm);
      const tunedCharge = parts.manifold ? intakeRamRatio(rpm, tunedStock, tunedNew) : 1;
      const runnerRecovery = parts.manifold ? runnerPressureRecoveryPa(r, stock.intake.runnerDiameterMm, runnerDiam) : 0;
      const runnerRatio = 1 + runnerRecovery / op0.map;
      const chargeDemand = valveCharge * tunedCharge * runnerRatio;
      // compressor flow limit: the charge mass flow scales with the absolute pressure at a speed
      const boostCapPa = ((ATMOSPHERIC_PRESSURE + op0.boost) * flowCap) / Math.max(op0.flow * chargeDemand, 1e-6) - ATMOSPHERIC_PRESSURE;
      const boostPa = Math.max(0, Math.min(op.boost, boostCapPa, target * 1e5));
      const pr0 = (ATMOSPHERIC_PRESSURE + op0.boost) / ATMOSPHERIC_PRESSURE;
      const pr1 = (ATMOSPHERIC_PRESSURE + boostPa) / ATMOSPHERIC_PRESSURE;
      const filterRatio = (ATMOSPHERIC_PRESSURE - filterDrop * 1000 * r * r) / (ATMOSPHERIC_PRESSURE - b0.airFilterDropKPa * 1000 * r * r);
      const pressureRatio = (pr1 / pr0) * filterRatio * runnerRatio;
      const density = pressureRatio * (factoryChargeTemperatureK(op0.boost / 1e5) /
        factoryChargeTemperatureK(boostPa / 1e5, icEff, up?.compressorEfficiency)) * valveCharge * tunedCharge;
      const kl = knockAt(boostPa / 1e5);
      knockLoss = Math.max(knockLoss, kl);
      const knock = (1 - kl) / (1 - knockStock(op0.boost / 1e5));
      const indicated = ((op0.indicatedNm * willans(op0.map * density)) / willans(op0.map)) * indicatedScale * knock;
      const map = op0.map * pressureRatio;
      const back = op0.back + 0.85 * (boostPa - op0.boost) + (backRef - b0.exhaustBackPressureKPa) * 1000 * r * r;
      const pumping = (back - map) * vdOver4pi;
      let brake = indicated - op0.frictionNm * (parts.pistons?.frictionScale ?? 1) * (parts.mod?.coolingFrictionScale ?? 1) - pumping;
      // torque limiter of the ECU: the factory map holds the factory plateau (the stock peak torque);
      // above it, where the factory curve falls with the air flow, freer breathing still gains.
      // A remap moves the limit to the mechanical one.
      brake = Math.min(brake, parts.ecu ? limitNm : Math.max(stockCurve[i]!, Math.min(brake, stockPeakNm)));
      // a staged map targets at most a multiple of the factory torque at every speed
      if (parts.ecu?.stockTorqueGainMax) brake = Math.min(brake, stockCurve[i]! * parts.ecu.stockTorqueGainMax);
      // freer breathing, a remap, a bigger intercooler or a hybrid turbine that fills at the same
      // exhaust flow never lose steady full-load torque against the factory engine (off-boost
      // points stay the factory ones)
      const sameSpool = !up || up.spoolFlowScale <= 1;
      if (sameSpool && !parts.cam && !parts.manifold && !parts.head && cr >= stock.compressionRatio) {
        brake = Math.max(brake, Math.min(stockCurve[i]!, parts.ecu ? limitNm : Infinity));
      }
      next.push(round1(Math.max(brake, 1)));
      boosts.push(boostPa / 1e5);
    }
    const change = Math.max(...next.map((t, i) => Math.abs(t - curve[i]!)));
    curve = next;
    if (change < 0.5) break;
  }
  const engine: EngineConfig = {
    ...stock,
    compressionRatio: cr,
    revLimitRpm: revLimit,
    redlineRpm: stock.redlineRpm + revAdd,
    maxSafeRpm: Math.max(stock.maxSafeRpm, revLimit + (stock.maxSafeRpm - stock.revLimitRpm)),
    cam,
    intake,
    throttle,
    combustion: { ...stock.combustion, burnDurationDeg: stock.combustion.burnDurationDeg * burnDurationScale },
    // the steady curve above already carries the lower pumping loss of a freer exhaust; the live
    // model keeps the factory back pressure, which there drives the turbine (a freer system after
    // the turbine raises its pressure ratio, never slows the spool)
    breathing: { ...b0, airFilterDropKPa: filterDrop },
    turbo: turboCfg,
    torqueCurve: { rpm: grid, torqueNm: curve },
  };
  return {
    engine,
    steadyBoostBar: grid.map((rpm, i) => ({ rpm, bar: Math.round(boosts[i]! * 100) / 100 })),
    knockLoss,
    targetBoostBar: target,
    wastegateMaxBar: wgMax,
    torqueLimitNm: limitNm,
    exhaustRestrictionKPa: backRef,
    chargeTemperatureAtTargetK: factoryChargeTemperatureK(target, icEff, up?.compressorEfficiency),
    knockFreeBoostBar: knockFree,
  };
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
