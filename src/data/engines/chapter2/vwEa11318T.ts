import { modernEngine, torqueForPower, type EngineDoc, type ModernEngineSpec } from './common';

/**
 * VW/Audi EA113 1.8T 20V (five valves per cylinder: three intake, two exhaust), 180 cv version
 * of the Golf GTI Mk4 and the Audi A3 8L sold in Brazil. 81 × 86.4 mm, 1781 cm³, 9.5:1,
 * 180 cv @ 5500 rpm, 235 N·m from 1950 to 5000 rpm, K03-family turbo with a recirculating
 * diverter valve, gasoline. Both cars share this one engine family definition; what differs
 * between them lives in the car files (mass, gearing, intake/exhaust plumbing).
 */
export const EA113_18T_DOC: EngineDoc = {
  code: 'VW EA113 1.8 20V Turbo (180 cv)',
  displacementCm3: 1781,
  boreMm: 81,
  strokeMm: 86.4,
  compressionRatio: 9.5,
  fuel: 'gasolina',
  feed: 'injeção multiponto Bosch Motronic ME7, turbo K03',
  power: { cv: 180, rpm: 5500 },
  torque: { nm: 235, rpm: 1950, rpmTo: 5000 },
  layout: 'dianteiro transversal, 4 em linha, DOHC 20V (5 válvulas por cilindro)',
  firingOrder: [1, 3, 4, 2],
  sources: ['olhonocarro-golf-gti-2003', 'literature-ea113-18t'],
};

export const EA113_18T_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 1950, 3000, 4000, 5000, 5500, 6000, 6500, 7200],
  torqueNm: [95, 138, 192, 235, 235, 235, 235, torqueForPower(180, 5500), 205, 176, 140],
  documented: [1950, 5500],
};

/** Shared EA113 1.8T 180 cv spec; the A3 and the Golf instantiate it with their own ids. */
export const EA113_18T_SPEC: Omit<ModernEngineSpec, 'id' | 'name'> = {
  family: 'vw-ea113',
  architecture: 'I4',
  firingOrder: [1, 3, 4, 2],
  boreMm: 81,
  strokeMm: 86.4,
  rodLengthMm: 144, // literature
  compressionRatio: 9.5,
  inertiaKgM2: 0.13, // estimated (dual-mass flywheel)
  reciprocatingMassKg: 0.48,
  idleRpm: 800,
  redlineRpm: 6500,
  revLimitRpm: 6800,
  limiterCutTimeS: 0.07,
  torqueCurve: EA113_18T_TORQUE_CURVE,
  ratedPowerCv: 180,
  ratedPowerRpm: 5500,
  fmep: [0.82, 0.12, 0.024],
  accessoriesNm: 3.2,
  throttle: { bodyDiameterMm: 56, responseTimeS: 0.05, idlePlatePosition: 0.998, pedalGamma: 1.9 },
  // three small intake valves per cylinder fed by long runners of the plastic manifold
  intake: { manifoldVolumeL: 2.6, runnerLengthM: 0.3, runnerDiameterMm: 33, airboxVolumeL: 8 },
  cam: { evoDeg: 134, evcDeg: 366, ivoDeg: 356, ivcDeg: 584, intakeLiftMm: 9.3, exhaustLiftMm: 9.0 },
  breathing: { airFilterDropKPa: 2.8, exhaustBackPressureKPa: 15 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 50, cycleVariation: 0.035 },
  turbo: { maxBoostBar: 0.8, spoolTimeS: 0.42, fullBoostFlowFraction: 0.33, maxShaftRpm: 200000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.1, bovVent: 'recirculating' },
  egt: { idleK: 700, maxK: 1220 },
  starterTorqueNm: 46,
};

export const ENGINE_VW_EA113_18T_GOLF = modernEngine({
  ...EA113_18T_SPEC,
  id: 'vw-ea113-18t-180-golf',
  name: 'VW EA113 1.8T 20V 180 cv (Golf GTI)',
});

/** Audi installation: same engine, the A3 8L airbox and a longer intake tract. */
export const ENGINE_VW_EA113_18T_A3 = modernEngine({
  ...EA113_18T_SPEC,
  id: 'vw-ea113-18t-180-a3',
  name: 'Audi 1.8T 20V 180 cv (A3 8L)',
  intake: { ...EA113_18T_SPEC.intake, airboxVolumeL: 9.5, runnerLengthM: 0.32 },
});
