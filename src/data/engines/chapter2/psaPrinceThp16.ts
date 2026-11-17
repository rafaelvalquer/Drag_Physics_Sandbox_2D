import { modernEngine, kgfm, torqueForPower, type EngineDoc } from './common';

/**
 * PSA "Prince" EP6 1.6 THP flex (Peugeot 208 GT 2017), DOHC 16V, direct injection, twin-scroll
 * turbo, variable intake timing. Ethanol rating: 173 cv @ 6000 rpm and 24.5 kgfm @ 1400 rpm.
 * Bore × stroke 77 × 85.8 mm and 10.5:1 from the EP6 family literature.
 */
export const PRINCE_THP16_DOC: EngineDoc = {
  code: 'PSA EP6 1.6 THP (Prince) flex',
  displacementCm3: 1598,
  boreMm: 77,
  strokeMm: 85.8,
  compressionRatio: 10.5,
  fuel: 'etanol (E100)',
  feed: 'injeção direta, turbo twin-scroll',
  power: { cv: 173, rpm: 6000 },
  torque: { nm: kgfm(24.5), rpm: 1400, rpmTo: 3500 },
  layout: 'dianteiro transversal, 4 em linha, DOHC 16V, corrente',
  firingOrder: [1, 3, 4, 2],
  sources: ['shopcar-208gt-2017', 'literature-prince-ep6'],
};

const T = kgfm(24.5); // 240.3 N·m
export const PRINCE_THP16_TORQUE_CURVE = {
  rpm: [500, 1000, 1400, 2500, 3500, 4500, 5500, 6000, 6300, 6900],
  torqueNm: [105, 168, T, T, T, 232, 214, torqueForPower(173, 6000), 190, 158],
  documented: [1400, 6000],
};

export const ENGINE_PSA_PRINCE_THP16 = modernEngine({
  id: 'psa-prince-thp-16-2017',
  family: 'psa-prince-thp',
  name: 'PSA 1.6 THP flex (208 GT 2017)',
  architecture: 'I4',
  firingOrder: [1, 3, 4, 2],
  boreMm: 77,
  strokeMm: 85.8,
  rodLengthMm: 136.5, // literature (Prince)
  compressionRatio: 10.5,
  inertiaKgM2: 0.11, // estimated
  reciprocatingMassKg: 0.42,
  idleRpm: 750,
  redlineRpm: 6250,
  revLimitRpm: 6500, // estimated
  limiterCutTimeS: 0.07,
  torqueCurve: PRINCE_THP16_TORQUE_CURVE,
  ratedPowerCv: 173,
  ratedPowerRpm: 6000,
  fmep: [0.78, 0.11, 0.022],
  accessoriesNm: 3,
  throttle: { bodyDiameterMm: 54, responseTimeS: 0.035, idlePlatePosition: 0.998, pedalGamma: 1.7 },
  intake: { manifoldVolumeL: 2.2, runnerLengthM: 0.2, runnerDiameterMm: 34, airboxVolumeL: 6 },
  cam: { evoDeg: 136, evcDeg: 368, ivoDeg: 354, ivcDeg: 580, intakeLiftMm: 9.0, exhaustLiftMm: 8.7 },
  breathing: { airFilterDropKPa: 2.4, exhaustBackPressureKPa: 14 },
  fuel: 'ethanol',
  combustion: { burnDurationDeg: 46, cycleVariation: 0.03 },
  turbo: { maxBoostBar: 1.0, spoolTimeS: 0.32, fullBoostFlowFraction: 0.27, maxShaftRpm: 220000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.09, bovVent: 'recirculating' },
  egt: { idleK: 700, maxK: 1210 },
  starterTorqueNm: 44,
});
