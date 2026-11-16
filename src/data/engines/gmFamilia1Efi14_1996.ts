import type { EngineConfig } from '../schema';
import { KGFM_TO_NM, ratedAirFlowKgS, torqueForPower } from '../provenance';
import { firingAngles, fmepFriction } from './builders';

/**
 * GM Família I 1.4 EFI (1389 cm³, SOHC 8V, single-point injection) of the Chevrolet Corsa GL 1996,
 * petrol, mounted TRANSVERSELY (Carros na Web lists "Disposição: Transversal"; the Revista Auto
 * sheet prints "longitudinal" – a transcription error: the Corsa B is a transverse-engine FWD car).
 * A torque engine: 11.1 kgfm at only 2800 rpm, power peak early at 5200 rpm.
 *
 * Documented: 1389 cm³ · 77.6 × 73.4 mm · 9.4:1 · EFI monoponto · 60 cv @ 5200 · 11.1 kgfm @ 2800.
 */
export const FAMILIA1_EFI_14_1996_DOC = {
  code: 'GM Família I 1.4 EFI 8V',
  displacementCm3: 1389,
  boreMm: 77.6,
  strokeMm: 73.4,
  compressionRatio: 9.4,
  fuel: 'gasolina',
  feed: 'injeção eletrônica monoponto (EFI)',
  power: { cv: 60, rpm: 5200, standard: 'não informada' },
  torque: { kgfm: 11.1, nm: Math.round(11.1 * KGFM_TO_NM * 10) / 10, rpm: 2800 },
  layout: 'dianteiro TRANSVERSAL (divergência: Revista Auto imprime longitudinal), 4 em linha',
  firingOrder: [1, 3, 4, 2],
  sources: ['revistaauto-corsa-1996', 'carrosnaweb-corsa-1996'],
} as const;

const PEAK_T = FAMILIA1_EFI_14_1996_DOC.torque.nm; // 108.9 N·m
const RATED_T = torqueForPower(60, 5200); // 81.04 N·m

/** Curve through 2800 rpm and the 5200 rpm power point; other points estimated (TBI, long runners). */
export const FAMILIA1_EFI_14_1996_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2800, 3400, 4000, 4600, 5200, 5600, 6000, 6400],
  torqueNm: [70, 87, 97.5, 104.2, PEAK_T, 104.6, 96.8, 88.8, RATED_T, 73.6, 64.6, 54.5],
  documented: [2800, 5200],
};

export const ENGINE_GM_FAMILIA1_EFI_14_1996: EngineConfig = {
  id: 'gm-familia1-efi-14-1996',
  name: 'GM Família I 1.4 EFI (Corsa GL 1996)',
  architecture: 'I4',
  cylinders: 4,
  bankAngleDeg: 0,
  crankType: 'inline',
  firingOrder: [1, 3, 4, 2],
  firingAnglesDeg: firingAngles([1, 3, 4, 2], 180),
  bankOfCylinder: [0, 0, 0, 0],
  boreMm: 77.6, // secondary
  strokeMm: 73.4, // secondary → 1389 cm³
  rodLengthMm: 129.8, // estimated
  compressionRatio: 9.4, // secondary (olhonocarro: 9.5 – divergence of 0.1)
  inertiaKgM2: 0.1, // estimated
  reciprocatingMassKg: 0.44,
  idleRpm: 850,
  redlineRpm: 5900, // estimated
  revLimitRpm: 6200, // estimated: ECU fuel cut
  limiterCutTimeS: 0.06,
  maxSafeRpm: 6500,
  torqueCurve: { rpm: [...FAMILIA1_EFI_14_1996_TORQUE_CURVE.rpm], torqueNm: [...FAMILIA1_EFI_14_1996_TORQUE_CURVE.torqueNm] },
  ratedPowerCv: 60,
  friction: fmepFriction(77.6, 73.4, 4, 0.78, 0.12, 0.024),
  accessoriesNm: 1.8,
  throttle: { bodyDiameterMm: 42, responseTimeS: 0.05, idlePlatePosition: 0.998, pedalGamma: 1.8 }, // estimated: TBI body
  intake: { manifoldVolumeL: 1.4, runnerLengthM: 0.34, runnerDiameterMm: 32, airboxVolumeL: 5 }, // estimated: long runners → low-rpm torque
  cam: { evoDeg: 128, evcDeg: 364, ivoDeg: 352, ivcDeg: 582, intakeLiftMm: 8.8, exhaustLiftMm: 8.6 }, // estimated: mild timing
  breathing: {
    referenceFlowKgS: ratedAirFlowKgS(1389, 5200),
    airFilterDropKPa: 2.8,
    exhaustBackPressureKPa: 20, // estimated: catalyst
  },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 55, cycleVariation: 0.05 },
  induction: 'NA',
  egt: { idleK: 690, maxK: 1160 },
  starter: { torqueNm: 32, speedRpm: 250 },
  idleControl: { naturalFrequencyRadS: 3.5, damping: 0.9, maxAirFraction: 0.06 },
};
