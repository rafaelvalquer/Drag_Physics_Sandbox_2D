import { hpToCv, lbftToNm } from '../../provenance';
import { modernEngine, torqueForPower, type EngineDoc } from '../chapter2/common';

/**
 * Nissan VR38DETT (GT-R R35 Premium 2015): 3.8 V6 at 60°, DOHC 24V with N-VCT, plasma-sprayed
 * bores, twin IHI turbochargers (one per bank). Nissan press kit 2015: 95.5 × 88.4 mm, 9.0:1,
 * 545 hp at 6400 rpm, 463 lb-ft at 3200–5800 rpm, maximum engine speed 7000 rpm, 93 octane.
 * Boost (not published in the kit), valve events and the firing order 1-2-3-4-5-6 (VR
 * literature; alternating banks, even 120° firing) are estimated.
 */
export const VR38DETT_DOC: EngineDoc = {
  code: 'Nissan VR38DETT (545 hp)',
  displacementCm3: 3799,
  boreMm: 95.5,
  strokeMm: 88.4,
  compressionRatio: 9,
  fuel: 'gasolina (93 octanas)',
  feed: 'injeção multiponto, dois turbos IHI em paralelo (um por bancada)',
  power: { cv: hpToCv(545), rpm: 6400 },
  torque: { nm: lbftToNm(463), rpm: 3200, rpmTo: 5800 },
  layout: 'dianteiro longitudinal, V6 a 60°, DOHC 24V, bloco e cabeçotes de alumínio',
  firingOrder: [1, 2, 3, 4, 5, 6],
  published: { hp: 545, lbFt: 463 },
  sources: ['nissan-gtr-2015-presskit', 'literature-nissan-vr38'],
};

export const VR38DETT_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2500, 3200, 5800, 6400, 6800, 7000, 7400],
  torqueNm: [220, 380, 500, 570, 610, lbftToNm(463), lbftToNm(463), torqueForPower(hpToCv(545), 6400), 565, 540, 470],
  documented: [3200, 6400],
};

export const ENGINE_NISSAN_VR38DETT = modernEngine({
  id: 'nissan-vr38dett-545',
  family: 'nissan-vr38dett',
  name: 'Nissan VR38DETT 3.8 V6 biturbo 545 hp (GT-R)',
  architecture: 'V6',
  bankAngleDeg: 60,
  crankType: 'split-pin',
  bankOfCylinder: [0, 1, 0, 1, 0, 1],
  firingOrder: [1, 2, 3, 4, 5, 6],
  boreMm: 95.5,
  strokeMm: 88.4,
  rodLengthMm: 152.3, // estimated
  compressionRatio: 9,
  inertiaKgM2: 0.26,
  reciprocatingMassKg: 0.55,
  idleRpm: 700,
  redlineRpm: 6800,
  revLimitRpm: 7000,
  limiterCutTimeS: 0.06,
  torqueCurve: VR38DETT_TORQUE_CURVE,
  ratedPowerCv: hpToCv(545),
  ratedPowerRpm: 6400,
  fmep: [0.84, 0.12, 0.025],
  accessoriesNm: 5.2,
  throttle: { bodyDiameterMm: 80, responseTimeS: 0.035, idlePlatePosition: 0.998, pedalGamma: 1.5 },
  intake: { manifoldVolumeL: 5, runnerLengthM: 0.25, runnerDiameterMm: 46, airboxVolumeL: 14 },
  cam: { evoDeg: 138, evcDeg: 366, ivoDeg: 350, ivcDeg: 590, intakeLiftMm: 10.4, exhaustLiftMm: 10 },
  breathing: { airFilterDropKPa: 2.4, exhaustBackPressureKPa: 16 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 45, cycleVariation: 0.027 },
  turbo: { layout: 'parallel-twin', maxBoostBar: 1, spoolTimeS: 0.36, fullBoostFlowFraction: 0.26, maxShaftRpm: 220000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.1, bovVent: 'recirculating' },
  egt: { idleK: 700, maxK: 1230 },
  starterTorqueNm: 90,
});
