import { hpToCv, lbftToNm } from '../../provenance';
import { modernEngine, torqueForPower, type EngineDoc } from '../chapter2/common';

/**
 * Toyota 2GR-FSE (Lexus IS 350 2015, RWD): 3.5 V6 at 60°, DOHC 24V with Dual VVT-i and D-4S
 * (direct + port injection), Atkinson-capable. Lexus press release 2015: 3.5 L V6, 306 hp,
 * 277 lb-ft, 8-speed automatic. Auto-Data sheet: 94 × 83 mm, 11.8:1, 306 hp at 6400 rpm,
 * 376 N·m at 4800 rpm. Redline / cut (6600 / 6800) estimated from the usual 2GR calibration.
 * Firing order 1-2-3-4-5-6 from the 2GR literature, even 120° firing.
 */
export const GR2_FSE_DOC: EngineDoc = {
  code: 'Toyota 2GR-FSE (306 hp)',
  displacementCm3: 3456,
  boreMm: 94,
  strokeMm: 83,
  compressionRatio: 11.8,
  fuel: 'gasolina',
  feed: 'injeção direta + indireta (D-4S), aspirado, Dual VVT-i',
  power: { cv: hpToCv(306), rpm: 6400 },
  torque: { nm: lbftToNm(277), rpm: 4800 },
  layout: 'dianteiro longitudinal, V6 a 60°, DOHC 24V, corrente',
  firingOrder: [1, 2, 3, 4, 5, 6],
  published: { hp: 306, lbFt: 277 },
  sources: ['lexus-is-2015-pressroom', 'autodata-lexus-is350-2015', 'literature-toyota-2gr'],
};

export const GR2_FSE_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4800, 5600, 6400, 6800, 7000, 7400],
  torqueNm: [130, 232, 280, 312, 332, 347, 360, 369, lbftToNm(277), 366, torqueForPower(hpToCv(306), 6400), 322, 296, 230],
  documented: [4800, 6400],
};

export const ENGINE_TOYOTA_2GR_FSE = modernEngine({
  id: 'toyota-2gr-fse-306',
  family: 'toyota-2gr-fse',
  name: 'Toyota 2GR-FSE 3.5 V6 306 hp (Lexus IS 350)',
  architecture: 'V6',
  bankAngleDeg: 60,
  crankType: 'split-pin',
  bankOfCylinder: [0, 1, 0, 1, 0, 1],
  firingOrder: [1, 2, 3, 4, 5, 6],
  boreMm: 94,
  strokeMm: 83,
  rodLengthMm: 144.2, // estimated
  compressionRatio: 11.8,
  inertiaKgM2: 0.19,
  reciprocatingMassKg: 0.48,
  idleRpm: 650,
  redlineRpm: 6600,
  revLimitRpm: 6800,
  limiterCutTimeS: 0.08,
  torqueCurve: GR2_FSE_TORQUE_CURVE,
  ratedPowerCv: hpToCv(306),
  ratedPowerRpm: 6400,
  fmep: [0.78, 0.11, 0.022],
  accessoriesNm: 4.2,
  throttle: { bodyDiameterMm: 70, responseTimeS: 0.04, idlePlatePosition: 0.998, pedalGamma: 1.5 },
  intake: { manifoldVolumeL: 3.6, runnerLengthM: 0.34, runnerDiameterMm: 40, airboxVolumeL: 12 },
  cam: { evoDeg: 134, evcDeg: 364, ivoDeg: 346, ivcDeg: 584, intakeLiftMm: 9.6, exhaustLiftMm: 9.2 },
  breathing: { airFilterDropKPa: 2.2, exhaustBackPressureKPa: 12 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 42, cycleVariation: 0.025 },
  egt: { idleK: 690, maxK: 1130 },
  starterTorqueNm: 80,
});
