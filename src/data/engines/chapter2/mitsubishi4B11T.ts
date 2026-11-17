import { modernEngine, kgfm, torqueForPower, type EngineDoc } from './common';

/**
 * Mitsubishi 4B11T (Lancer Evolution X 2012, Brazil, gasoline): 2.0 aluminium block, DOHC 16V
 * with MIVEC on both camshafts, TD05-family turbo and intercooler. 86 × 86 mm, 1998 cm³, 9.0:1;
 * 295 cv @ 6500 rpm and 37.3 kgfm @ 3500 rpm (Brazilian rating). A larger turbo than the small
 * modern units: full torque arrives later.
 */
export const B4B11T_DOC: EngineDoc = {
  code: 'Mitsubishi 4B11T 2.0 MIVEC turbo (295 cv)',
  displacementCm3: 1998,
  boreMm: 86,
  strokeMm: 86,
  compressionRatio: 9,
  fuel: 'gasolina',
  feed: 'injeção multiponto, turbo TD05, intercooler',
  power: { cv: 295, rpm: 6500 },
  torque: { nm: kgfm(37.3), rpm: 3500 },
  layout: 'dianteiro transversal, 4 em linha, DOHC 16V MIVEC duplo, corrente',
  firingOrder: [1, 3, 4, 2],
  sources: ['encycarpedia-evo-x', 'literature-4b11t'],
};

export const B4B11T_TORQUE_CURVE = {
  rpm: [500, 1000, 2000, 2500, 3000, 3500, 4400, 5000, 5500, 6000, 6500, 7000, 7600],
  torqueNm: [128, 168, 258, 328, 355, kgfm(37.3), 362, 350, 340, 328, torqueForPower(295, 6500), 290, 245],
  documented: [3500, 6500],
};

export const ENGINE_MITSUBISHI_4B11T = modernEngine({
  id: 'mitsubishi-4b11t-295',
  family: 'mitsubishi-4b11',
  name: 'Mitsubishi 4B11T 2.0 turbo 295 cv (Evo X)',
  architecture: 'I4',
  firingOrder: [1, 3, 4, 2],
  boreMm: 86,
  strokeMm: 86,
  rodLengthMm: 143.75, // literature (4B11)
  compressionRatio: 9,
  inertiaKgM2: 0.13, // estimated: flywheel + twin-clutch input
  reciprocatingMassKg: 0.5,
  idleRpm: 800,
  redlineRpm: 7000,
  revLimitRpm: 7200,
  limiterCutTimeS: 0.06,
  torqueCurve: B4B11T_TORQUE_CURVE,
  ratedPowerCv: 295,
  ratedPowerRpm: 6500,
  fmep: [0.82, 0.12, 0.025],
  accessoriesNm: 3.6,
  throttle: { bodyDiameterMm: 65, responseTimeS: 0.04, idlePlatePosition: 0.998, pedalGamma: 1.8 },
  intake: { manifoldVolumeL: 3.6, runnerLengthM: 0.24, runnerDiameterMm: 38, airboxVolumeL: 9 },
  cam: { evoDeg: 128, evcDeg: 372, ivoDeg: 348, ivcDeg: 596, intakeLiftMm: 9.8, exhaustLiftMm: 9.4 },
  breathing: { airFilterDropKPa: 2.6, exhaustBackPressureKPa: 16 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 48, cycleVariation: 0.035 },
  turbo: { maxBoostBar: 1.25, spoolTimeS: 0.5, fullBoostFlowFraction: 0.48, maxShaftRpm: 190000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.1, bovVent: 'recirculating' },
  egt: { idleK: 700, maxK: 1250 },
  starterTorqueNm: 52,
});
