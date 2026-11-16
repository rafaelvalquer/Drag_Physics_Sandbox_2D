import type { EngineConfig } from '../schema';
import { KGFM_TO_NM, ratedAirFlowKgS, torqueForPower } from '../provenance';
import { firingAngles, fmepFriction } from './builders';

/**
 * GM 1.6/S of the Chevrolet Chevette SL 1988 (1599 cm³, SOHC 8V, single carburettor), ETHANOL,
 * mounted longitudinally and driving the REAR wheels. A different engine family from the Família
 * I/II units: the Chevette's own belt-driven SOHC four.
 *
 * Power divergence by version and fuel (investigated, see docs/vehicles/campaign-cars.md):
 *  - fichacompleta, SL/E 1.6 1988 álcool:   72 cv @ 5600 rpm, 12.3 kgfm @ 3200 rpm  ← used
 *  - jkcarros, SL/E 1.6/S 1988 álcool:      73 cv @ 5800 rpm, 12.8 kgfm @ 3400 rpm
 *  - petrol 1.6 versions are lower (not used: the chosen car is the ethanol 1.6/S).
 * Bore × stroke 82.0 × 75.7 mm, compression 11.8:1 (fichacompleta).
 */
export const CHEVETTE_16S_1988_DOC = {
  code: 'GM 1.6/S (Chevette) SOHC 8V',
  displacementCm3: 1599,
  boreMm: 82.0,
  strokeMm: 75.7,
  compressionRatio: 11.8,
  fuel: 'etanol hidratado',
  feed: 'carburador de corpo simples',
  power: { cv: 72, rpm: 5600, standard: 'não informada' },
  torque: { kgfm: 12.3, nm: Math.round(12.3 * KGFM_TO_NM * 10) / 10, rpm: 3200 },
  alternative: { cv: 73, rpm: 5800, kgfm: 12.8, torqueRpm: 3400, source: 'jkcarros-chevette-1988' },
  layout: 'dianteiro LONGITUDINAL, tração traseira, 4 em linha, comando no cabeçote por correia',
  firingOrder: [1, 3, 4, 2],
  sources: ['fichacompleta-chevette-1988', 'jkcarros-chevette-1988'],
} as const;

const PEAK_T = CHEVETTE_16S_1988_DOC.torque.nm; // 120.6 N·m
const RATED_T = torqueForPower(72, 5600); // 90.3 N·m

export const CHEVETTE_16S_1988_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2600, 3200, 3800, 4400, 5000, 5600, 6000, 6400, 6800],
  torqueNm: [80, 96, 106, 113, 118.4, PEAK_T, 118.2, 110.2, 99.6, RATED_T, 82.6, 72.5, 61],
  documented: [3200, 5600],
};

export const ENGINE_GM_CHEVETTE_16S_1988: EngineConfig = {
  id: 'gm-chevette-16s-1988-ethanol',
  name: 'GM 1.6/S a etanol (Chevette 1988)',
  architecture: 'I4',
  cylinders: 4,
  bankAngleDeg: 0,
  crankType: 'inline',
  firingOrder: [1, 3, 4, 2],
  firingAnglesDeg: firingAngles([1, 3, 4, 2], 180),
  bankOfCylinder: [0, 0, 0, 0],
  boreMm: 82.0, // secondary
  strokeMm: 75.7, // secondary → 1599 cm³
  rodLengthMm: 132, // estimated
  compressionRatio: 11.8, // secondary
  inertiaKgM2: 0.12, // estimated: heavier flywheel of the RWD longitudinal driveline
  reciprocatingMassKg: 0.5,
  idleRpm: 900, // estimated (ethanol)
  redlineRpm: 6000,
  revLimitRpm: 6300, // simulation protection limit
  limiterCutTimeS: 0.08,
  maxSafeRpm: 6600,
  torqueCurve: { rpm: [...CHEVETTE_16S_1988_TORQUE_CURVE.rpm], torqueNm: [...CHEVETTE_16S_1988_TORQUE_CURVE.torqueNm] },
  ratedPowerCv: 72,
  friction: fmepFriction(82, 75.7, 4, 0.84, 0.12, 0.024),
  accessoriesNm: 1.8,
  throttle: { bodyDiameterMm: 38, responseTimeS: 0.06, idlePlatePosition: 0.998, pedalGamma: 1.9 }, // estimated: single barrel
  intake: { manifoldVolumeL: 1.3, runnerLengthM: 0.22, runnerDiameterMm: 31, airboxVolumeL: 4.5 },
  cam: { evoDeg: 128, evcDeg: 366, ivoDeg: 350, ivcDeg: 586, intakeLiftMm: 9.2, exhaustLiftMm: 9.0 },
  breathing: {
    referenceFlowKgS: ratedAirFlowKgS(1599, 5600),
    airFilterDropKPa: 3.2,
    exhaustBackPressureKPa: 17,
  },
  fuel: 'ethanol',
  combustion: { burnDurationDeg: 58, cycleVariation: 0.06 },
  induction: 'NA',
  egt: { idleK: 640, maxK: 1070 }, // ethanol runs cooler
  starter: { torqueNm: 36, speedRpm: 240 },
  idleControl: { naturalFrequencyRadS: 2.2, damping: 1, maxAirFraction: 0.04 },
};
