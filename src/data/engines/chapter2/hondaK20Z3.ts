import { modernEngine, kgfm, torqueForPower, type EngineDoc } from './common';

/**
 * Honda K20Z3 (Civic Si 2008, Brazil): 2.0 DOHC i-VTEC, naturally aspirated, gasoline.
 * 86 × 86 mm, 1998 cm³, 11.0:1; 192 cv @ 7800 rpm and 19.2 kgfm @ 6100 rpm (Brazilian rating).
 * i-VTEC switches the rocker arms onto the high-speed lobes at about 5800 rpm under load: the knee
 * is in the WOT curve, the valve events switch in `variableCam` (hydraulic spool, ~50 ms).
 */
export const K20Z3_DOC: EngineDoc = {
  code: 'Honda K20Z3 2.0 i-VTEC',
  displacementCm3: 1998,
  boreMm: 86,
  strokeMm: 86,
  compressionRatio: 11,
  fuel: 'gasolina',
  feed: 'injeção multiponto PGM-FI, i-VTEC',
  power: { cv: 192, rpm: 7800 },
  torque: { nm: kgfm(19.2), rpm: 6100 },
  layout: 'dianteiro transversal, 4 em linha, DOHC 16V i-VTEC, corrente',
  firingOrder: [1, 3, 4, 2],
  sources: ['honda-civic-si-2008-manual', 'literature-k20z3'],
};

export const K20Z3_TORQUE_CURVE = {
  rpm: [500, 1000, 2000, 3000, 4000, 5000, 5600, 5800, 6100, 7000, 7800, 8000, 8600],
  torqueNm: [112, 140, 158, 166, 172, 170, 167, 178, kgfm(19.2), 184, torqueForPower(192, 7800), 167, 146],
  documented: [6100, 7800],
};

export const ENGINE_HONDA_K20Z3 = modernEngine({
  id: 'honda-k20z3-192',
  family: 'honda-k20',
  name: 'Honda K20Z3 2.0 i-VTEC 192 cv (Civic Si)',
  architecture: 'I4',
  firingOrder: [1, 3, 4, 2],
  boreMm: 86,
  strokeMm: 86,
  rodLengthMm: 139, // literature (K20)
  compressionRatio: 11,
  inertiaKgM2: 0.105, // estimated: light flywheel
  reciprocatingMassKg: 0.47,
  idleRpm: 750,
  redlineRpm: 8000,
  revLimitRpm: 8300,
  limiterCutTimeS: 0.06,
  torqueCurve: K20Z3_TORQUE_CURVE,
  ratedPowerCv: 192,
  ratedPowerRpm: 7800,
  fmep: [0.8, 0.12, 0.026],
  accessoriesNm: 3,
  throttle: { bodyDiameterMm: 62, responseTimeS: 0.035, idlePlatePosition: 0.998, pedalGamma: 1.8 },
  intake: { manifoldVolumeL: 3.0, runnerLengthM: 0.3, runnerDiameterMm: 40, airboxVolumeL: 8 },
  // low-speed lobes (VTEC off): small lift, short duration
  cam: { evoDeg: 140, evcDeg: 364, ivoDeg: 356, ivcDeg: 578, intakeLiftMm: 8.4, exhaustLiftMm: 8.0 },
  variableCam: {
    switchRpm: 5800,
    hysteresisRpm: 200,
    actuationTimeS: 0.05,
    // high-speed lobes: earlier exhaust opening, later intake closing, more lift and overlap
    high: { evoDeg: 124, evcDeg: 376, ivoDeg: 344, ivcDeg: 604, intakeLiftMm: 11.8, exhaustLiftMm: 10.9 },
  },
  breathing: { airFilterDropKPa: 2.5, exhaustBackPressureKPa: 14 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 46, cycleVariation: 0.035 },
  egt: { idleK: 690, maxK: 1170 },
  starterTorqueNm: 44,
});
