import type { EngineConfig } from '../schema';
import { KGFM_TO_NM, ratedAirFlowKgS, torqueForPower } from '../provenance';
import { firingAngles, fmepFriction } from './builders';

/**
 * Fiat 1.0 "Fiasa" (994 cm³, SOHC 8V, carburettor) as fitted to the Uno Mille Electronic 1995,
 * petrol. A short-stroke (76 × 54.8 mm) small block derived from the 147 engine family: it makes
 * its torque low and revs freely, but the small displacement limits the power.
 *
 * Documented (technical sheets guiacarros / fichacompleta, model year 1995, petrol):
 *   994 cm³ · 76.0 × 54.8 mm · 9.5:1 · 56.1 cv @ 6000 rpm · 8.2 kgfm @ 3250 rpm.
 * The sheets do not name the power standard (net ABNT/NBR is the usual one for the period:
 * treated as such, unconfirmed). Everything else is estimated and flagged as such.
 */
export const FIASA_10_1995_DOC = {
  code: 'Fiat 1.0 Fiasa (família 147), SOHC 8V',
  displacementCm3: 994,
  boreMm: 76.0,
  strokeMm: 54.8,
  compressionRatio: 9.5,
  fuel: 'gasolina',
  feed: 'carburador (modelo não identificado nas fontes consultadas)',
  power: { cv: 56.1, rpm: 6000, standard: 'não informada (provável ABNT líquida)' },
  torque: { kgfm: 8.2, nm: Math.round(8.2 * KGFM_TO_NM * 10) / 10, rpm: 3250 },
  layout: 'dianteiro transversal, 4 cilindros em linha, comando no cabeçote por correia, tuchos mecânicos',
  firingOrder: [1, 3, 4, 2],
  sources: ['guiacarros-uno-1995', 'fichacompleta-uno-1995'],
} as const;

const PEAK_T = FIASA_10_1995_DOC.torque.nm; // 80.4 N·m
const RATED_T = torqueForPower(56.1, 6000); // 65.66 N·m

/**
 * Brake torque curve (N·m). Passes exactly through the two documented points (3250 rpm and the
 * power point at 6000 rpm). The rest of the shape is ESTIMATED: a broad, flat small-carburettor
 * curve that falls off steeply above the power peak (small valves, single-barrel carburettor).
 */
export const FIASA_10_1995_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2500, 3250, 4000, 4600, 5200, 6000, 6400, 6800, 7200],
  torqueNm: [47, 57.5, 65, 71, 76.4, PEAK_T, 79.2, 76.6, 72.6, RATED_T, 60.4, 53.5, 45],
  documented: [3250, 6000],
};

export const ENGINE_FIAT_FIASA_10_1995: EngineConfig = {
  id: 'fiat-fiasa-10-1995',
  name: 'Fiat 1.0 Fiasa (Uno Mille Electronic 1995)',
  architecture: 'I4',
  cylinders: 4,
  bankAngleDeg: 0,
  crankType: 'inline',
  firingOrder: [1, 3, 4, 2], // secondary: standard Fiat in-line four order
  firingAnglesDeg: firingAngles([1, 3, 4, 2], 180), // derived
  bankOfCylinder: [0, 0, 0, 0],
  boreMm: FIASA_10_1995_DOC.boreMm, // secondary (technical sheet)
  strokeMm: FIASA_10_1995_DOC.strokeMm, // secondary → 994 cm³
  rodLengthMm: 110, // estimated (short-stroke block, rod/stroke ≈ 2)
  compressionRatio: FIASA_10_1995_DOC.compressionRatio, // secondary
  inertiaKgM2: 0.075, // estimated: small crank + 180 mm clutch
  reciprocatingMassKg: 0.38, // estimated
  idleRpm: 850, // estimated
  redlineRpm: 6400, // estimated (tachometer marking)
  revLimitRpm: 6700, // simulation protection limit (no electronic limiter documented)
  limiterCutTimeS: 0.08,
  maxSafeRpm: 7000,
  torqueCurve: { rpm: [...FIASA_10_1995_TORQUE_CURVE.rpm], torqueNm: [...FIASA_10_1995_TORQUE_CURVE.torqueNm] },
  ratedPowerCv: 56.1,
  friction: fmepFriction(76, 54.8, 4, 0.78, 0.11, 0.022), // estimated
  accessoriesNm: 1.4, // estimated: alternator, water pump, mechanical fuel pump
  throttle: { bodyDiameterMm: 32, responseTimeS: 0.055, idlePlatePosition: 0.998, pedalGamma: 1.8 }, // estimated: single-barrel
  intake: { manifoldVolumeL: 0.9, runnerLengthM: 0.19, runnerDiameterMm: 28, airboxVolumeL: 3.5 }, // estimated
  cam: { evoDeg: 132, evcDeg: 368, ivoDeg: 350, ivcDeg: 590, intakeLiftMm: 8.6, exhaustLiftMm: 8.2 }, // estimated
  breathing: {
    referenceFlowKgS: ratedAirFlowKgS(994, 6000), // derived (estimated VE 0.85)
    airFilterDropKPa: 3.0, // estimated: paper element in the original airbox at rated flow
    exhaustBackPressureKPa: 16, // estimated: original single system, two silencers
  },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 58, cycleVariation: 0.06 }, // estimated
  induction: 'NA',
  egt: { idleK: 690, maxK: 1150 }, // estimated (petrol)
  starter: { torqueNm: 26, speedRpm: 260 }, // estimated: ≈ 0.7 kW starter
  idleControl: { naturalFrequencyRadS: 2.4, damping: 1, maxAirFraction: 0.04 }, // calibrated (carburettor idle)
};
