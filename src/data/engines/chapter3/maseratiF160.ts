import { hpToCv, lbftToNm } from '../../provenance';
import { modernEngine, torqueForPower, type EngineDoc } from '../chapter2/common';

/**
 * Maserati F160 (Ghibli S Q4 2015; the engine code of the Auto-Data sheet is "M156B"): 3.0 V6 at
 * 60°, 2,979 cc, DOHC 24V, direct injection, one turbocharger per bank. Kelley Blue Book: 404 hp at
 * 5500 rpm, 406 lb-ft; Auto-Data sheet: 86.5 × 84.5 mm, 9.7:1, 410 Hp (metric) at 5500 rpm,
 * 550 N·m at 4500–5000 rpm. The plateau from 3000 rpm, the boost, the valve events and the firing
 * order (alternating banks, even 120° firing; the crank design was not found) are estimated.
 */
export const F160_DOC: EngineDoc = {
  code: 'Maserati F160 3.0 V6 biturbo (404 hp)',
  displacementCm3: 2979,
  boreMm: 86.5,
  strokeMm: 84.5,
  compressionRatio: 9.7,
  fuel: 'gasolina',
  feed: 'injeção direta, dois turbos em paralelo (um por bancada)',
  power: { cv: hpToCv(404), rpm: 5500 },
  torque: { nm: lbftToNm(406), rpm: 4500, rpmTo: 5000 },
  layout: 'dianteiro longitudinal, V6 a 60°, DOHC 24V, corrente',
  firingOrder: [1, 4, 2, 5, 3, 6],
  published: { hp: 404, lbFt: 406 },
  sources: ['kbb-ghibli-2015', 'autodata-ghibli-s-q4', 'literature-maserati-f160'],
};

export const F160_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2500, 3000, 5000, 5500, 6000, 6500, 6800, 7000],
  torqueNm: [200, 330, 450, 515, 545, lbftToNm(406), lbftToNm(406), torqueForPower(hpToCv(404), 5500), 470, 425, 390, 365],
  documented: [4500, 5500],
};

export const ENGINE_MASERATI_F160 = modernEngine({
  id: 'maserati-f160-404',
  family: 'maserati-f160',
  name: 'Maserati F160 3.0 V6 biturbo 404 hp (Ghibli S Q4)',
  architecture: 'V6',
  bankAngleDeg: 60,
  crankType: 'split-pin',
  bankOfCylinder: [0, 0, 0, 1, 1, 1],
  firingOrder: [1, 4, 2, 5, 3, 6],
  boreMm: 86.5,
  strokeMm: 84.5,
  rodLengthMm: 144, // estimated
  compressionRatio: 9.7,
  inertiaKgM2: 0.2,
  reciprocatingMassKg: 0.46,
  idleRpm: 650,
  redlineRpm: 6500,
  revLimitRpm: 6800,
  limiterCutTimeS: 0.07,
  torqueCurve: F160_TORQUE_CURVE,
  ratedPowerCv: hpToCv(404),
  ratedPowerRpm: 5500,
  fmep: [0.78, 0.11, 0.022],
  accessoriesNm: 4.6,
  throttle: { bodyDiameterMm: 74, responseTimeS: 0.035, idlePlatePosition: 0.998, pedalGamma: 1.5 },
  intake: { manifoldVolumeL: 4.2, runnerLengthM: 0.27, runnerDiameterMm: 40, airboxVolumeL: 12 },
  cam: { evoDeg: 136, evcDeg: 364, ivoDeg: 350, ivcDeg: 586, intakeLiftMm: 9.8, exhaustLiftMm: 9.6 },
  breathing: { airFilterDropKPa: 2.2, exhaustBackPressureKPa: 13 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 43, cycleVariation: 0.025 },
  turbo: { layout: 'parallel-twin', maxBoostBar: 0.95, spoolTimeS: 0.3, fullBoostFlowFraction: 0.21, maxShaftRpm: 220000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.09, bovVent: 'recirculating' },
  egt: { idleK: 690, maxK: 1190 },
  starterTorqueNm: 80,
});
