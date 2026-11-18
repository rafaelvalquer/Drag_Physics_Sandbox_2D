import { hpToCv, lbftToNm } from '../../provenance';
import { modernEngine, torqueForPower, type EngineDoc } from '../chapter2/common';

/**
 * Mercedes-AMG M276 DE30 AL biturbo (C 43 4MATIC 2017): 3.0 V6 at 60°, DOHC 24V, direct
 * injection, one turbocharger per bank (parallel twin). Mercedes-Benz USA specification page:
 * 88.0 × 82.1 mm, 2,996 cc, 10.5:1, 362 hp at 5500–6000 rpm, 384 lb-ft at 2000–4200 rpm,
 * redline 6,550 rpm. Boost, valve events, inertia and the firing order 1-4-3-6-2-5 (cylinders
 * 1-3 on bank 1, 4-6 on bank 2; consecutive events alternate banks) come from the M276
 * literature and are estimated. Even 120° firing.
 */
export const M276_BITURBO_DOC: EngineDoc = {
  code: 'Mercedes-AMG M276 DE30 AL biturbo (362 hp)',
  displacementCm3: 2996,
  boreMm: 88,
  strokeMm: 82.1,
  compressionRatio: 10.5,
  fuel: 'gasolina',
  feed: 'injeção direta, dois turbos em paralelo (um por bancada)',
  power: { cv: hpToCv(362), rpm: 5500, rpmTo: 6000 },
  torque: { nm: lbftToNm(384), rpm: 2000, rpmTo: 4200 },
  layout: 'dianteiro longitudinal, V6 a 60°, DOHC 24V, corrente',
  firingOrder: [1, 4, 3, 6, 2, 5],
  published: { hp: 362, lbFt: 384 },
  sources: ['mbusa-c43-2017', 'literature-mercedes-m276'],
};

export const M276_BITURBO_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 3000, 4200, 4800, 5500, 6000, 6550, 6800, 7000],
  torqueNm: [190, 340, 470, lbftToNm(384), lbftToNm(384), lbftToNm(384), 500, torqueForPower(hpToCv(362), 5500), torqueForPower(hpToCv(362), 6000), 385, 350, 320],
  documented: [2000, 6000],
};

export const ENGINE_MERCEDES_M276 = modernEngine({
  id: 'mercedes-m276-biturbo-362',
  family: 'mercedes-m276',
  name: 'Mercedes-AMG M276 3.0 V6 biturbo 362 hp (C 43)',
  architecture: 'V6',
  bankAngleDeg: 60,
  crankType: 'split-pin',
  bankOfCylinder: [0, 0, 0, 1, 1, 1],
  firingOrder: [1, 4, 3, 6, 2, 5],
  boreMm: 88,
  strokeMm: 82.1,
  rodLengthMm: 143, // estimated
  compressionRatio: 10.5,
  inertiaKgM2: 0.19,
  reciprocatingMassKg: 0.47,
  idleRpm: 700,
  redlineRpm: 6550,
  revLimitRpm: 6700,
  limiterCutTimeS: 0.08,
  torqueCurve: M276_BITURBO_TORQUE_CURVE,
  ratedPowerCv: hpToCv(362),
  ratedPowerRpm: 5500,
  fmep: [0.78, 0.11, 0.022],
  accessoriesNm: 4.5,
  throttle: { bodyDiameterMm: 74, responseTimeS: 0.03, idlePlatePosition: 0.998, pedalGamma: 1.5 },
  intake: { manifoldVolumeL: 4, runnerLengthM: 0.3, runnerDiameterMm: 38, airboxVolumeL: 12 },
  cam: { evoDeg: 132, evcDeg: 360, ivoDeg: 348, ivcDeg: 580, intakeLiftMm: 9.6, exhaustLiftMm: 9.3 },
  breathing: { airFilterDropKPa: 2.2, exhaustBackPressureKPa: 14 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 43, cycleVariation: 0.025 },
  turbo: { layout: 'parallel-twin', maxBoostBar: 0.9, spoolTimeS: 0.26, fullBoostFlowFraction: 0.19, maxShaftRpm: 230000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.09, bovVent: 'recirculating' },
  egt: { idleK: 690, maxK: 1180 },
  starterTorqueNm: 80,
});
