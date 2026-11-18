import { hpToCv, lbftToNm } from '../../provenance';
import { modernEngine, torqueForPower, type EngineDoc } from '../chapter2/common';

/**
 * Alfa Romeo 690T (Giulia Quadrifoglio 2017): 2.9 V6 at **90°**, DOHC 24V, direct injection, one
 * turbocharger per bank, a Ferrari-derived design. Fiat/Alfa preliminary specification sheet:
 * 86.5 × 82.0 mm, 2,891 cc, 9.3:1, 505 hp at 6500 rpm, 443 lb-ft at 2500–5500 rpm, redline 6,500,
 * maximum engine speed 7,250 rpm, "35 psi" maximum boost (not read as gauge pressure: the boost
 * of the model, 1.2 bar, is estimated from the power density).
 *
 * Crankshaft and firing: three crankpins 120° apart, each carrying one rod of each bank, so the
 * 90° V6 fires UNEVENLY (90° / 150° alternating) — each bank still fires every 240° — and its
 * main harmonic is the 1.5th order, the one of an inline three (Wikipedia, 690T). The firing order
 * differs between sources (1-6-3-4-2-5 and 1-6-3-4-5-2); 1-6-3-4-2-5 is used here. Cylinders 1-3
 * are on bank 1 and 4-6 on bank 2: the pairs that share a crankpin are (1,6), (3,4), (2,5).
 */
export const ALFA_690T_DOC: EngineDoc = {
  code: 'Alfa Romeo 690T 2.9 V6 biturbo (505 hp)',
  displacementCm3: 2891,
  boreMm: 86.5,
  strokeMm: 82,
  compressionRatio: 9.3,
  fuel: 'gasolina',
  feed: 'injeção direta, dois turbos em paralelo (um por bancada)',
  power: { cv: hpToCv(505), rpm: 6500 },
  torque: { nm: lbftToNm(443), rpm: 2500, rpmTo: 5500 },
  layout: 'dianteiro longitudinal, V6 a 90° (disparo irregular 90°/150°), DOHC 24V',
  firingOrder: [1, 6, 3, 4, 2, 5],
  published: { hp: 505, lbFt: 443 },
  sources: ['alfa-giulia-qv-2017-specs', 'autodata-giulia-qv-2017', 'literature-alfa-690t'],
};

export const ALFA_690T_TORQUE_CURVE = {
  rpm: [500, 1000, 1500, 2000, 2500, 5500, 6000, 6500, 7000, 7250, 7600],
  torqueNm: [200, 380, 510, 575, lbftToNm(443), lbftToNm(443), 578, torqueForPower(hpToCv(505), 6500), 510, 480, 430],
  documented: [2500, 6500],
};

export const ENGINE_ALFA_690T = modernEngine({
  id: 'alfa-690t-505',
  family: 'alfa-690t',
  name: 'Alfa Romeo 690T 2.9 V6 90° biturbo 505 hp (Giulia Quadrifoglio)',
  architecture: 'V6',
  bankAngleDeg: 90,
  crankType: 'split-pin',
  bankOfCylinder: [0, 0, 0, 1, 1, 1],
  firingOrder: [1, 6, 3, 4, 2, 5],
  firingIntervalsDeg: [90, 150, 90, 150, 90, 150],
  boreMm: 86.5,
  strokeMm: 82,
  rodLengthMm: 141, // estimated
  compressionRatio: 9.3,
  inertiaKgM2: 0.18,
  reciprocatingMassKg: 0.44,
  idleRpm: 750,
  redlineRpm: 6500,
  revLimitRpm: 7250,
  limiterCutTimeS: 0.06,
  torqueCurve: ALFA_690T_TORQUE_CURVE,
  ratedPowerCv: hpToCv(505),
  ratedPowerRpm: 6500,
  fmep: [0.76, 0.1, 0.021],
  accessoriesNm: 4.4,
  throttle: { bodyDiameterMm: 76, responseTimeS: 0.03, idlePlatePosition: 0.998, pedalGamma: 1.5 },
  intake: { manifoldVolumeL: 4.4, runnerLengthM: 0.25, runnerDiameterMm: 44, airboxVolumeL: 12 },
  cam: { evoDeg: 140, evcDeg: 366, ivoDeg: 352, ivcDeg: 586, intakeLiftMm: 10.2, exhaustLiftMm: 9.8 },
  breathing: { airFilterDropKPa: 2.1, exhaustBackPressureKPa: 15 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 44, cycleVariation: 0.025 },
  turbo: { layout: 'parallel-twin', maxBoostBar: 1.2, spoolTimeS: 0.27, fullBoostFlowFraction: 0.22, maxShaftRpm: 240000, compressorBlades: 7, bovEnabled: true, bovVentTimeS: 0.08, bovVent: 'recirculating' },
  egt: { idleK: 690, maxK: 1220 },
  starterTorqueNm: 80,
});
