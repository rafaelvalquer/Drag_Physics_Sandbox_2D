import { hpToCv, lbftToNm } from '../../provenance';
import { modernEngine, torqueForPower, type EngineDoc } from '../chapter2/common';

/**
 * Kia/Hyundai Lambda II 3.3 T-GDI G6DP (Stinger GT 2019, AWD): 3.3 V6 at 60°, DOHC 24V, direct
 * injection, one turbocharger per bank. Auto-Data sheet: 92 × 83.8 mm, 3,342 cc, 10:1, 366 Hp at
 * 6000 rpm, 510 N·m at 1300–4500 rpm (European rating); the 365 hp / 376 lb-ft figures of the
 * US-specification sheet (the project plan) are used and converted. The Kia brochure PDF of the
 * plan has no extractable text and was not used as a source of values. Boost, valve events,
 * inertia and the firing order 1-2-3-4-5-6 (alternating banks, even 120° firing) are estimated.
 */
export const LAMBDA_33_TGDI_DOC: EngineDoc = {
  code: 'Kia Lambda II 3.3 T-GDI G6DP (365 hp)',
  displacementCm3: 3342,
  boreMm: 92,
  strokeMm: 83.8,
  compressionRatio: 10,
  fuel: 'gasolina',
  feed: 'injeção direta, dois turbos em paralelo (um por bancada)',
  power: { cv: hpToCv(365), rpm: 6000 },
  torque: { nm: lbftToNm(376), rpm: 1300, rpmTo: 4500 },
  layout: 'dianteiro longitudinal, V6 a 60°, DOHC 24V, corrente',
  firingOrder: [1, 2, 3, 4, 5, 6],
  published: { hp: 365, lbFt: 376 },
  sources: ['autodata-stinger-gt-2019', 'literature-kia-lambda2'],
};

export const LAMBDA_33_TORQUE_CURVE = {
  rpm: [500, 1000, 1300, 3000, 4500, 5000, 5500, 6000, 6500, 6800, 7000],
  torqueNm: [180, 420, lbftToNm(376), lbftToNm(376), lbftToNm(376), 487, 458, torqueForPower(hpToCv(365), 6000), 400, 372, 345],
  documented: [1300, 6000],
};

export const ENGINE_KIA_LAMBDA_33 = modernEngine({
  id: 'kia-lambda2-33-tgdi-365',
  family: 'kia-lambda33',
  name: 'Kia Lambda II 3.3 T-GDI V6 biturbo 365 hp (Stinger GT)',
  architecture: 'V6',
  bankAngleDeg: 60,
  crankType: 'split-pin',
  bankOfCylinder: [0, 1, 0, 1, 0, 1],
  firingOrder: [1, 2, 3, 4, 5, 6],
  boreMm: 92,
  strokeMm: 83.8,
  rodLengthMm: 147, // estimated
  compressionRatio: 10,
  inertiaKgM2: 0.21,
  reciprocatingMassKg: 0.5,
  idleRpm: 700,
  redlineRpm: 6500,
  revLimitRpm: 6700,
  limiterCutTimeS: 0.08,
  torqueCurve: LAMBDA_33_TORQUE_CURVE,
  ratedPowerCv: hpToCv(365),
  ratedPowerRpm: 6000,
  fmep: [0.8, 0.115, 0.023],
  accessoriesNm: 4.8,
  throttle: { bodyDiameterMm: 72, responseTimeS: 0.035, idlePlatePosition: 0.998, pedalGamma: 1.5 },
  intake: { manifoldVolumeL: 4.4, runnerLengthM: 0.28, runnerDiameterMm: 40, airboxVolumeL: 12 },
  cam: { evoDeg: 134, evcDeg: 362, ivoDeg: 350, ivcDeg: 584, intakeLiftMm: 9.8, exhaustLiftMm: 9.4 },
  breathing: { airFilterDropKPa: 2.3, exhaustBackPressureKPa: 14 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 44, cycleVariation: 0.028 },
  turbo: { layout: 'parallel-twin', maxBoostBar: 0.9, spoolTimeS: 0.3, fullBoostFlowFraction: 0.2, maxShaftRpm: 220000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.1, bovVent: 'recirculating' },
  egt: { idleK: 700, maxK: 1190 },
  starterTorqueNm: 85,
});
