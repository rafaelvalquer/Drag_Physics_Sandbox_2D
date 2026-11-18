import { hpToCv, lbftToNm } from '../../provenance';
import { modernEngine, torqueForPower, type EngineDoc } from '../chapter2/common';

/**
 * Nissan VQ35DE "Rev-Up" (350Z 2006, manual): 3.5 V6 at 60°, DOHC 24V with CVTCS on the intake
 * cams, port injection. Nissan press kit 2006: "VQ35DE", 3.5 L, 300 hp (SAE J1349), 260 lb-ft,
 * 7,000 rpm redline, 24V DOHC. Bore × stroke 95.5 × 81.4 mm and 10.3:1 from the Encycarpedia
 * summary; peaks at 6400 rpm (300 hp) and 4800 rpm (260 lb-ft) from the usual 2006 rating (the
 * press kit text does not give the rpm). Firing order 1-2-3-4-5-6 (bank 1: 1-3-5, bank 2: 2-4-6)
 * from the VQ literature; even 120° firing with split crankpins.
 */
export const VQ35DE_DOC: EngineDoc = {
  code: 'Nissan VQ35DE Rev-Up (300 hp)',
  displacementCm3: 3498,
  boreMm: 95.5,
  strokeMm: 81.4,
  compressionRatio: 10.3,
  fuel: 'gasolina',
  feed: 'injeção multiponto, aspirado, CVTCS na admissão',
  power: { cv: hpToCv(300), rpm: 6400 },
  torque: { nm: lbftToNm(260), rpm: 4800 },
  layout: 'dianteiro longitudinal, V6 a 60°, DOHC 24V, corrente',
  firingOrder: [1, 2, 3, 4, 5, 6],
  published: { hp: 300, lbFt: 260 },
  sources: ['nissan-350z-2006-presskit', 'encycarpedia-350z-2006', 'literature-nissan-vq'],
};

export const VQ35DE_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4800, 5600, 6400, 6800, 7000, 7100, 7700],
  torqueNm: [150, 235, 272, 290, 302, 314, 331, 345, lbftToNm(260), 346, torqueForPower(hpToCv(300), 6400), 307, 291, 284, 225],
  documented: [4800, 6400],
};

export const ENGINE_NISSAN_VQ35DE = modernEngine({
  id: 'nissan-vq35de-revup-300',
  family: 'nissan-vq35de',
  name: 'Nissan VQ35DE Rev-Up 3.5 V6 300 hp (350Z)',
  architecture: 'V6',
  bankAngleDeg: 60,
  crankType: 'split-pin',
  bankOfCylinder: [0, 1, 0, 1, 0, 1],
  firingOrder: [1, 2, 3, 4, 5, 6],
  boreMm: 95.5,
  strokeMm: 81.4,
  rodLengthMm: 152, // estimated
  compressionRatio: 10.3,
  inertiaKgM2: 0.2,
  reciprocatingMassKg: 0.5,
  idleRpm: 700,
  redlineRpm: 7000,
  revLimitRpm: 7100,
  limiterCutTimeS: 0.07,
  torqueCurve: VQ35DE_TORQUE_CURVE,
  ratedPowerCv: hpToCv(300),
  ratedPowerRpm: 6400,
  fmep: [0.82, 0.12, 0.024],
  accessoriesNm: 4.5,
  throttle: { bodyDiameterMm: 80, responseTimeS: 0.035, idlePlatePosition: 0.998, pedalGamma: 1.6 },
  intake: { manifoldVolumeL: 3.9, runnerLengthM: 0.3, runnerDiameterMm: 42, airboxVolumeL: 11 },
  cam: { evoDeg: 138, evcDeg: 368, ivoDeg: 352, ivcDeg: 596, intakeLiftMm: 10, exhaustLiftMm: 9.6 },
  breathing: { airFilterDropKPa: 2, exhaustBackPressureKPa: 11 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 46, cycleVariation: 0.03 },
  egt: { idleK: 700, maxK: 1150 },
  starterTorqueNm: 85,
});
