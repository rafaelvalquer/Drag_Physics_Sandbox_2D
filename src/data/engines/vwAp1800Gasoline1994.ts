import type { EngineConfig } from '../schema';
import { KGFM_TO_NM, ratedAirFlowKgS, torqueForPower } from '../provenance';
import { firingAngles, fmepFriction } from './builders';

/**
 * VW AP-1800 on PETROL as fitted to the Saveiro GL 1.8 1994 (twin-barrel carburettor). Same block
 * geometry as the Gol GTS's AP 1.8S (81.0 × 86.4 mm) but a different engine for the simulation:
 * low compression for petrol (8.5:1), milder GL camshaft, hotter exhaust, and its own documented
 * output: 88 cv @ 5600 rpm and 14.9 kgfm @ 3200 rpm (guiacarros, Saveiro GL 1.8 1994).
 *
 * The low compression is what makes this AP the classic base for a turbo conversion.
 */
export const AP1800_GAS_1994_DOC = {
  code: 'VW AP-1800 (gasolina)',
  displacementCm3: 1781,
  boreMm: 81.0,
  strokeMm: 86.4,
  compressionRatio: 8.5,
  fuel: 'gasolina',
  feed: 'carburador de corpo duplo',
  power: { cv: 88, rpm: 5600, standard: 'não informada' },
  torque: { kgfm: 14.9, nm: Math.round(14.9 * KGFM_TO_NM * 10) / 10, rpm: 3200 },
  layout: 'dianteiro longitudinal, 4 em linha, comando no cabeçote por correia',
  firingOrder: [1, 3, 4, 2],
  sources: ['guiacarros-saveiro-1994'],
} as const;

const PEAK_T = AP1800_GAS_1994_DOC.torque.nm; // 146.1 N·m
const RATED_T = torqueForPower(88, 5600); // 110.37 N·m

/** Curve through 3200 and 5600 rpm; other points estimated (milder cam than the GTS's 49G). */
export const AP1800_GAS_1994_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2600, 3200, 3800, 4400, 5000, 5600, 6000, 6400, 6800],
  torqueNm: [80, 106, 120, 130, 140.2, PEAK_T, 143.6, 133.6, 121.6, RATED_T, 101.4, 90, 77],
  documented: [3200, 5600],
};

export const ENGINE_VW_AP1800_GAS_1994: EngineConfig = {
  id: 'vw-ap1800-gasoline-1994',
  name: 'VW AP-1800 a gasolina (Saveiro GL 1994)',
  architecture: 'I4',
  cylinders: 4,
  bankAngleDeg: 0,
  crankType: 'inline',
  firingOrder: [1, 3, 4, 2],
  firingAnglesDeg: firingAngles([1, 3, 4, 2], 180),
  bankOfCylinder: [0, 0, 0, 0],
  boreMm: 81.0,
  strokeMm: 86.4,
  rodLengthMm: 144, // estimated (AP family)
  compressionRatio: 8.5, // secondary
  inertiaKgM2: 0.13,
  reciprocatingMassKg: 0.55,
  idleRpm: 850, // estimated (petrol)
  redlineRpm: 6000,
  revLimitRpm: 6300, // simulation protection limit
  limiterCutTimeS: 0.08,
  maxSafeRpm: 6600,
  torqueCurve: { rpm: [...AP1800_GAS_1994_TORQUE_CURVE.rpm], torqueNm: [...AP1800_GAS_1994_TORQUE_CURVE.torqueNm] },
  ratedPowerCv: 88,
  friction: fmepFriction(81, 86.4, 4),
  accessoriesNm: 2.0,
  throttle: { bodyDiameterMm: 46, responseTimeS: 0.06, idlePlatePosition: 0.998, pedalGamma: 2.3 },
  intake: { manifoldVolumeL: 1.8, runnerLengthM: 0.24, runnerDiameterMm: 32, airboxVolumeL: 5.5 },
  cam: { evoDeg: 128, evcDeg: 366, ivoDeg: 352, ivcDeg: 586, intakeLiftMm: 9.8, exhaustLiftMm: 9.4 }, // estimated: milder than 49G
  breathing: {
    referenceFlowKgS: ratedAirFlowKgS(1781, 5600),
    airFilterDropKPa: 3.0,
    exhaustBackPressureKPa: 18,
  },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 58, cycleVariation: 0.06 },
  induction: 'NA',
  egt: { idleK: 690, maxK: 1160 },
  starter: { torqueNm: 38, speedRpm: 250 },
  idleControl: { naturalFrequencyRadS: 2.2, damping: 1, maxAirFraction: 0.04 },
};
