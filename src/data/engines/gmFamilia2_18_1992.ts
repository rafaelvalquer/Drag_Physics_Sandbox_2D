import type { EngineConfig } from '../schema';
import { KGFM_TO_NM, ratedAirFlowKgS, torqueForPower } from '../provenance';
import { firingAngles, fmepFriction } from './builders';

/**
 * GM Família II 1.8 (1796 cm³, SOHC 8V, twin-barrel carburettor) of the Chevrolet Kadett SL 1992,
 * petrol, transverse. The largest naturally aspirated engine of the chapter: oversquare
 * (84.8 × 79.5 mm), torque peak at 3600 rpm and power at 5800 rpm.
 *
 * Documented (Revista Auto, Kadett SL 1.8 1992): 1796 cm³ · 8.8:1 · carburador · 98 cv @ 5800 rpm
 * · 14.6 kgfm @ 3600 rpm. Bore × stroke: Família II 1.8 literature (84.8 × 79.5 → 1796 cm³).
 */
export const FAMILIA2_18_1992_DOC = {
  code: 'GM Família II 1.8 8V',
  displacementCm3: 1796,
  boreMm: 84.8,
  strokeMm: 79.5,
  compressionRatio: 8.8,
  fuel: 'gasolina',
  feed: 'carburador de corpo duplo',
  power: { cv: 98, rpm: 5800, standard: 'não informada' },
  torque: { kgfm: 14.6, nm: Math.round(14.6 * KGFM_TO_NM * 10) / 10, rpm: 3600 },
  layout: 'dianteiro transversal, 4 em linha, comando no cabeçote por correia, tuchos hidráulicos',
  firingOrder: [1, 3, 4, 2],
  sources: ['revistaauto-kadett-1992', 'fichacompleta-kadett-1992'],
} as const;

const PEAK_T = FAMILIA2_18_1992_DOC.torque.nm; // 143.2 N·m
const RATED_T = torqueForPower(98, 5800); // 118.67 N·m

export const FAMILIA2_18_1992_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2800, 3600, 4200, 4800, 5300, 5800, 6200, 6600, 7000],
  torqueNm: [92, 113, 124.5, 132, 139.6, PEAK_T, 141.4, 135.6, 128.2, RATED_T, 109.4, 97.5, 84],
  documented: [3600, 5800],
};

export const ENGINE_GM_FAMILIA2_18_1992: EngineConfig = {
  id: 'gm-familia2-18-1992',
  name: 'GM Família II 1.8 (Kadett SL 1992)',
  architecture: 'I4',
  cylinders: 4,
  bankAngleDeg: 0,
  crankType: 'inline',
  firingOrder: [1, 3, 4, 2],
  firingAnglesDeg: firingAngles([1, 3, 4, 2], 180),
  bankOfCylinder: [0, 0, 0, 0],
  boreMm: 84.8, // literature
  strokeMm: 79.5, // literature → 1796 cm³ (matches the sheet)
  rodLengthMm: 143, // estimated
  compressionRatio: 8.8, // secondary
  inertiaKgM2: 0.13, // estimated
  reciprocatingMassKg: 0.52,
  idleRpm: 850,
  redlineRpm: 6200,
  revLimitRpm: 6500, // simulation protection limit (carburettor, no limiter documented)
  limiterCutTimeS: 0.08,
  maxSafeRpm: 6800,
  torqueCurve: { rpm: [...FAMILIA2_18_1992_TORQUE_CURVE.rpm], torqueNm: [...FAMILIA2_18_1992_TORQUE_CURVE.torqueNm] },
  ratedPowerCv: 98,
  friction: fmepFriction(84.8, 79.5, 4, 0.8, 0.12, 0.024),
  accessoriesNm: 2.2, // estimated (power steering absent on the SL)
  throttle: { bodyDiameterMm: 46, responseTimeS: 0.06, idlePlatePosition: 0.998, pedalGamma: 2.2 }, // estimated: progressive twin-barrel
  intake: { manifoldVolumeL: 1.9, runnerLengthM: 0.24, runnerDiameterMm: 33, airboxVolumeL: 6 }, // estimated
  cam: { evoDeg: 130, evcDeg: 370, ivoDeg: 350, ivcDeg: 592, intakeLiftMm: 9.6, exhaustLiftMm: 9.2 }, // estimated
  breathing: {
    referenceFlowKgS: ratedAirFlowKgS(1796, 5800),
    airFilterDropKPa: 3.0,
    exhaustBackPressureKPa: 18,
  },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 56, cycleVariation: 0.055 },
  induction: 'NA',
  egt: { idleK: 690, maxK: 1160 },
  starter: { torqueNm: 40, speedRpm: 240 },
  idleControl: { naturalFrequencyRadS: 2.3, damping: 1, maxAirFraction: 0.04 },
};
