import { hpToCv, lbftToNm } from '../../provenance';
import { modernEngine, torqueForPower, type EngineDoc } from '../chapter2/common';

/**
 * Nissan VQ37VHR (370Z 2014, manual): 3.7 V6 at 60°, DOHC 24V with VVEL (continuously variable
 * valve event and lift) and CVTCS. Nissan press kit 2014 (370Z Coupe MT): 95.5 × 86.0 mm,
 * 11:1, 332 hp at 7000 rpm, 270 lb-ft at 5200 rpm, maximum engine speed 7500 rpm. VVEL has no
 * counterpart in this simulator (the cam profile is the mean one: the lift range is not modelled).
 * Firing order 1-2-3-4-5-6 from the VQ literature, even 120° firing.
 */
export const VQ37VHR_DOC: EngineDoc = {
  code: 'Nissan VQ37VHR (332 hp)',
  displacementCm3: 3696,
  boreMm: 95.5,
  strokeMm: 86,
  compressionRatio: 11,
  fuel: 'gasolina',
  feed: 'injeção multiponto, aspirado, VVEL + CVTCS',
  power: { cv: hpToCv(332), rpm: 7000 },
  torque: { nm: lbftToNm(270), rpm: 5200 },
  layout: 'dianteiro longitudinal, V6 a 60°, DOHC 24V, corrente',
  firingOrder: [1, 2, 3, 4, 5, 6],
  published: { hp: 332, lbFt: 270 },
  sources: ['nissan-370z-2014-presskit', 'literature-nissan-vq'],
};

export const VQ37VHR_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5200, 6000, 6500, 7000, 7500, 7900],
  torqueNm: [160, 250, 286, 312, 327, 337, 347, 354, 361, lbftToNm(270), 358, 350, torqueForPower(hpToCv(332), 7000), 302, 250],
  documented: [5200, 7000],
};

export const ENGINE_NISSAN_VQ37VHR = modernEngine({
  id: 'nissan-vq37vhr-332',
  family: 'nissan-vq37vhr',
  name: 'Nissan VQ37VHR 3.7 V6 332 hp (370Z)',
  architecture: 'V6',
  bankAngleDeg: 60,
  crankType: 'split-pin',
  bankOfCylinder: [0, 1, 0, 1, 0, 1],
  firingOrder: [1, 2, 3, 4, 5, 6],
  boreMm: 95.5,
  strokeMm: 86,
  rodLengthMm: 152.3, // estimated
  compressionRatio: 11,
  inertiaKgM2: 0.2,
  reciprocatingMassKg: 0.5,
  idleRpm: 700,
  redlineRpm: 7400,
  revLimitRpm: 7500,
  limiterCutTimeS: 0.06,
  torqueCurve: VQ37VHR_TORQUE_CURVE,
  ratedPowerCv: hpToCv(332),
  ratedPowerRpm: 7000,
  fmep: [0.84, 0.12, 0.026],
  accessoriesNm: 4.5,
  throttle: { bodyDiameterMm: 80, responseTimeS: 0.03, idlePlatePosition: 0.998, pedalGamma: 1.7 },
  intake: { manifoldVolumeL: 4.2, runnerLengthM: 0.28, runnerDiameterMm: 44, airboxVolumeL: 12 },
  cam: { evoDeg: 140, evcDeg: 372, ivoDeg: 350, ivcDeg: 592, intakeLiftMm: 11, exhaustLiftMm: 9.8 },
  breathing: { airFilterDropKPa: 2, exhaustBackPressureKPa: 11 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 44, cycleVariation: 0.028 },
  egt: { idleK: 700, maxK: 1160 },
  starterTorqueNm: 85,
});
