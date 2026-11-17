import { modernEngine, torqueForPower, type EngineDoc } from './common';

/**
 * GM Família II 2.0 8V Flexpower of the Chevrolet Astra 2011, transverse, SOHC 8V, multipoint
 * injection, ethanol (E100). Owner's manual MY2011 (section 12, p. 12-3/12-4): 86 × 86 mm,
 * 1998 cm³, 11.5:1, 1-3-4-2, idle 800 rpm, 140 cv (103 kW) @ 5600 rpm and 193 N·m (19.7 kgf·m)
 * @ 2600 rpm on ethanol, fuel cut-off 6400 rpm.
 */
export const FAMILIA2_FLEX20_DOC: EngineDoc = {
  code: 'GM Família II 2.0 8V Flexpower',
  displacementCm3: 1998,
  boreMm: 86,
  strokeMm: 86,
  compressionRatio: 11.5,
  fuel: 'etanol (E100)',
  feed: 'injeção multiponto sequencial',
  power: { cv: 140, rpm: 5600 },
  torque: { nm: 193, rpm: 2600 },
  layout: 'dianteiro transversal, 4 em linha, SOHC 8V por correia',
  firingOrder: [1, 3, 4, 2],
  sources: ['gm-astra-2011-manual'],
};

export const FAMILIA2_FLEX20_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2600, 3200, 4000, 4800, 5600, 6000, 6400, 6800],
  torqueNm: [118, 150, 168, 182, 193, 192, 188, 182, torqueForPower(140, 5600), 160, 145, 124],
  documented: [2600, 5600],
};

export const ENGINE_GM_FAMILIA2_FLEX20 = modernEngine({
  id: 'gm-familia2-flex-20-2011',
  family: 'gm-familia2',
  name: 'GM Família II 2.0 8V Flexpower (Astra 2011)',
  architecture: 'I4',
  firingOrder: [1, 3, 4, 2],
  boreMm: 86,
  strokeMm: 86,
  rodLengthMm: 143, // estimated (Família II literature)
  compressionRatio: 11.5,
  inertiaKgM2: 0.14, // estimated
  reciprocatingMassKg: 0.55,
  idleRpm: 800,
  redlineRpm: 6000,
  revLimitRpm: 6400, // factory fuel cut-off (manual p. 12-4)
  limiterCutTimeS: 0.08,
  torqueCurve: FAMILIA2_FLEX20_TORQUE_CURVE,
  ratedPowerCv: 140,
  ratedPowerRpm: 5600,
  fmep: [0.85, 0.12, 0.024],
  accessoriesNm: 3.5,
  throttle: { bodyDiameterMm: 56, responseTimeS: 0.04, idlePlatePosition: 0.998, pedalGamma: 1.9 },
  intake: { manifoldVolumeL: 2.4, runnerLengthM: 0.36, runnerDiameterMm: 36, airboxVolumeL: 7 },
  cam: { evoDeg: 132, evcDeg: 372, ivoDeg: 352, ivcDeg: 588, intakeLiftMm: 10.0, exhaustLiftMm: 9.6 },
  breathing: { airFilterDropKPa: 2.6, exhaustBackPressureKPa: 16 },
  fuel: 'ethanol',
  combustion: { burnDurationDeg: 52, cycleVariation: 0.045 },
  egt: { idleK: 680, maxK: 1130 },
  starterTorqueNm: 48,
});
