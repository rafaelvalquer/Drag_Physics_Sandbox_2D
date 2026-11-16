import type { EngineConfig } from '../schema';
import { KGFM_TO_NM, ratedAirFlowKgS, torqueForPower } from '../provenance';
import { firingAngles, fmepFriction } from './builders';

/**
 * GM Família I 1.0 VHC (999 cm³, SOHC 8V, multipoint injection) of the Chevrolet Celta 2003,
 * petrol. "VHC" = very high compression (12.6:1): a high-revving one-litre that makes its power
 * at 6400 rpm with a flat torque plateau.
 *
 * Documented (Revista Auto technical sheet, Celta 1.0 2003; VRUM sheet for bore × stroke):
 *   999 cm³ · 71.1 × 62.9 mm · 12.6:1 · MPFI · 70 cv @ 6400 rpm · 8.8 kgfm @ 3000 rpm.
 */
export const FAMILIA1_VHC_10_2003_DOC = {
  code: 'GM Família I 1.0 VHC 8V',
  displacementCm3: 999,
  boreMm: 71.1,
  strokeMm: 62.9,
  compressionRatio: 12.6,
  fuel: 'gasolina',
  feed: 'injeção eletrônica multiponto',
  power: { cv: 70, rpm: 6400, standard: 'não informada (provável ABNT NBR ISO 1585)' },
  torque: { kgfm: 8.8, nm: Math.round(8.8 * KGFM_TO_NM * 10) / 10, rpm: 3000 },
  layout: 'dianteiro transversal, 4 em linha, comando no cabeçote por correia',
  firingOrder: [1, 3, 4, 2],
  sources: ['revistaauto-celta-2003', 'vrum-celta-2003'],
} as const;

const PEAK_T = FAMILIA1_VHC_10_2003_DOC.torque.nm; // 86.3 N·m
const RATED_T = torqueForPower(70, 6400); // 76.8 N·m

/** Curve through the documented points (3000 rpm, 6400 rpm); the rest is estimated (MPFI plateau). */
export const FAMILIA1_VHC_10_2003_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2500, 3000, 3800, 4600, 5400, 6000, 6400, 6800, 7200],
  torqueNm: [50, 62, 71, 78, 83.4, PEAK_T, 85.6, 83.8, 81.2, 79.2, RATED_T, 70.6, 62],
  documented: [3000, 6400],
};

export const ENGINE_GM_FAMILIA1_VHC_10_2003: EngineConfig = {
  id: 'gm-familia1-vhc-10-2003',
  name: 'GM Família I 1.0 VHC (Celta 2003)',
  architecture: 'I4',
  cylinders: 4,
  bankAngleDeg: 0,
  crankType: 'inline',
  firingOrder: [1, 3, 4, 2],
  firingAnglesDeg: firingAngles([1, 3, 4, 2], 180),
  bankOfCylinder: [0, 0, 0, 0],
  boreMm: 71.1, // secondary
  strokeMm: 62.9, // secondary → 999 cm³
  rodLengthMm: 129.8, // estimated (Família I rod)
  compressionRatio: 12.6, // secondary
  inertiaKgM2: 0.08, // estimated
  reciprocatingMassKg: 0.36, // estimated
  idleRpm: 850, // estimated (ECU idle target)
  redlineRpm: 6500, // estimated
  revLimitRpm: 6800, // estimated: ECU fuel cut
  limiterCutTimeS: 0.06,
  maxSafeRpm: 7100,
  torqueCurve: { rpm: [...FAMILIA1_VHC_10_2003_TORQUE_CURVE.rpm], torqueNm: [...FAMILIA1_VHC_10_2003_TORQUE_CURVE.torqueNm] },
  ratedPowerCv: 70,
  friction: fmepFriction(71.1, 62.9, 4, 0.74, 0.11, 0.022), // estimated (hydraulic tappets)
  accessoriesNm: 1.8, // estimated: electric fuel pump, alternator
  throttle: { bodyDiameterMm: 46, responseTimeS: 0.045, idlePlatePosition: 0.998, pedalGamma: 1.7 }, // estimated
  intake: { manifoldVolumeL: 1.6, runnerLengthM: 0.3, runnerDiameterMm: 30, airboxVolumeL: 5 }, // estimated: tuned plastic manifold
  cam: { evoDeg: 136, evcDeg: 370, ivoDeg: 348, ivcDeg: 596, intakeLiftMm: 8.8, exhaustLiftMm: 8.4 }, // estimated
  breathing: {
    referenceFlowKgS: ratedAirFlowKgS(999, 6400, 0.88),
    airFilterDropKPa: 2.6, // estimated
    exhaustBackPressureKPa: 22, // estimated: catalyst + two silencers
  },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 50, cycleVariation: 0.04 }, // estimated (MPFI, high compression)
  induction: 'NA',
  egt: { idleK: 680, maxK: 1170 },
  starter: { torqueNm: 27, speedRpm: 260 }, // estimated
  idleControl: { naturalFrequencyRadS: 4, damping: 0.9, maxAirFraction: 0.06 }, // calibrated (electronic idle valve)
};
