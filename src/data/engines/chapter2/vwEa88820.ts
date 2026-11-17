import { modernEngine, torqueForPower, type EngineDoc } from './common';

/**
 * VW EA888 2.0 TSI (Gen 2) of the Jetta Highline TSI 2012, Brazil, gasoline. VW do Brasil sheet
 * (Feb/2011): 1984 cm³, 82.5 × 92.8 mm, 9.6:1, Bosch MED injection, 147 kW (200 cv) @ 5100 rpm,
 * 280 N·m (28.5 kgfm) @ 1700 rpm (NBR 5484). Plateau to 5000 rpm from the EA888 literature.
 */
export const EA888_20_DOC: EngineDoc = {
  code: 'VW EA888 2.0 TSI (200 cv)',
  displacementCm3: 1984,
  boreMm: 82.5,
  strokeMm: 92.8,
  compressionRatio: 9.6,
  fuel: 'gasolina',
  feed: 'injeção direta Bosch MED, turbo',
  power: { cv: 200, rpm: 5100, rpmTo: 6000 },
  torque: { nm: 280, rpm: 1700, rpmTo: 5000 },
  layout: 'dianteiro transversal, 4 em linha, DOHC 16V, corrente',
  firingOrder: [1, 3, 4, 2],
  sources: ['vw-jetta-2012-ficha'],
};

export const EA888_20_TORQUE_CURVE = {
  rpm: [500, 1000, 1700, 3000, 5000, 5100, 5500, 6000, 6500, 7100],
  torqueNm: [118, 192, 280, 280, 280, torqueForPower(200, 5100), 255, torqueForPower(200, 6000), 205, 165],
  documented: [1700, 5100],
};

export const ENGINE_VW_EA888_20 = modernEngine({
  id: 'vw-ea888-20-tsi-200',
  family: 'vw-ea888',
  name: 'VW EA888 2.0 TSI 200 cv (Jetta)',
  architecture: 'I4',
  firingOrder: [1, 3, 4, 2],
  boreMm: 82.5,
  strokeMm: 92.8,
  rodLengthMm: 148, // literature
  compressionRatio: 9.6,
  inertiaKgM2: 0.14, // estimated: dual-mass flywheel + DSG input
  reciprocatingMassKg: 0.49,
  idleRpm: 720,
  redlineRpm: 6500,
  revLimitRpm: 6700,
  limiterCutTimeS: 0.07,
  torqueCurve: EA888_20_TORQUE_CURVE,
  ratedPowerCv: 200,
  ratedPowerRpm: 5100,
  fmep: [0.8, 0.11, 0.023],
  accessoriesNm: 3.5,
  throttle: { bodyDiameterMm: 60, responseTimeS: 0.04, idlePlatePosition: 0.998, pedalGamma: 1.8 },
  intake: { manifoldVolumeL: 2.9, runnerLengthM: 0.22, runnerDiameterMm: 35, airboxVolumeL: 8 },
  cam: { evoDeg: 136, evcDeg: 366, ivoDeg: 354, ivcDeg: 586, intakeLiftMm: 10.7, exhaustLiftMm: 8.0 },
  breathing: { airFilterDropKPa: 2.4, exhaustBackPressureKPa: 14 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 46, cycleVariation: 0.03 },
  turbo: { maxBoostBar: 0.9, spoolTimeS: 0.34, fullBoostFlowFraction: 0.25, maxShaftRpm: 215000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.09, bovVent: 'recirculating' },
  egt: { idleK: 690, maxK: 1220 },
  starterTorqueNm: 50,
});
