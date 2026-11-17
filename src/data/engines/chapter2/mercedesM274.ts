import { modernEngine, kgfm, torqueForPower, type EngineDoc } from './common';

/**
 * Mercedes-Benz M274 DE20 (C200 W205 2015, Brazil): 2.0 turbo with piezo direct injection and
 * adjustment of both camshafts. Revista Auto sheet: 1991 cm³, 9.8:1, 184 cv @ 5500 rpm,
 * 30.6 kgfm @ 1200 rpm, 7-speed automatic. 83 × 92 mm and the plateau to 4000 rpm from the M274
 * literature. More low-speed torque than the BMW N20 of the same rating, but it revs less.
 */
export const M274_DOC: EngineDoc = {
  code: 'Mercedes-Benz M274 DE20 (184 cv)',
  displacementCm3: 1991,
  boreMm: 83,
  strokeMm: 92,
  compressionRatio: 9.8,
  fuel: 'gasolina',
  feed: 'injeção direta piezo, turbo',
  power: { cv: 184, rpm: 5500 },
  torque: { nm: kgfm(30.6), rpm: 1200, rpmTo: 4000 },
  layout: 'dianteiro longitudinal, 4 em linha, DOHC 16V, corrente',
  firingOrder: [1, 3, 4, 2],
  sources: ['revistaauto-c200-2015', 'literature-mercedes-m274'],
};

const T = kgfm(30.6); // 300.1 N·m
export const M274_TORQUE_CURVE = {
  rpm: [500, 1000, 1200, 2500, 4000, 4800, 5500, 6000, 6300, 6900],
  torqueNm: [118, 232, T, T, T, 268, torqueForPower(184, 5500), 207, 190, 150],
  documented: [1200, 5500],
};

export const ENGINE_MERCEDES_M274 = modernEngine({
  id: 'mercedes-m274-de20-184',
  family: 'mb-m274',
  name: 'Mercedes M274 2.0 turbo 184 cv (C200)',
  architecture: 'I4',
  firingOrder: [1, 3, 4, 2],
  boreMm: 83,
  strokeMm: 92,
  rodLengthMm: 146, // estimated
  compressionRatio: 9.8,
  inertiaKgM2: 0.17, // estimated: flexplate + converter impeller
  reciprocatingMassKg: 0.5,
  idleRpm: 650,
  redlineRpm: 6250,
  revLimitRpm: 6500,
  limiterCutTimeS: 0.07,
  torqueCurve: M274_TORQUE_CURVE,
  ratedPowerCv: 184,
  ratedPowerRpm: 5500,
  fmep: [0.8, 0.11, 0.022],
  accessoriesNm: 3.8,
  throttle: { bodyDiameterMm: 60, responseTimeS: 0.045, idlePlatePosition: 0.998, pedalGamma: 1.9 },
  intake: { manifoldVolumeL: 3.2, runnerLengthM: 0.2, runnerDiameterMm: 35, airboxVolumeL: 9 },
  cam: { evoDeg: 134, evcDeg: 368, ivoDeg: 352, ivcDeg: 590, intakeLiftMm: 9.5, exhaustLiftMm: 9.3 },
  breathing: { airFilterDropKPa: 2.4, exhaustBackPressureKPa: 15 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 46, cycleVariation: 0.028 },
  turbo: { maxBoostBar: 1.0, spoolTimeS: 0.36, fullBoostFlowFraction: 0.2, maxShaftRpm: 210000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.09, bovVent: 'recirculating' },
  egt: { idleK: 680, maxK: 1200 },
  starterTorqueNm: 52,
});
