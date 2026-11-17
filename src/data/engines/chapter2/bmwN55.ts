import { modernEngine, torqueForPower, type EngineDoc } from './common';

/**
 * BMW N55B30 (335i F30 2013, Brazil, gasoline): 3.0 straight six, single twin-scroll turbo,
 * direct injection, Valvetronic and double VANOS. BMW Brazil sheet (Série 3 2013): 306 hp,
 * 400 N·m from 1200 rpm, Aut/8, rear drive. 84 × 89.6 mm, 2979 cm³ (km77 sheet), 10.2:1 and
 * the firing order 1-5-3-6-2-4 from the N55 literature; 306 hp at 5800 rpm, plateau to 5000 rpm.
 */
export const N55_DOC: EngineDoc = {
  code: 'BMW N55B30 (306 hp)',
  displacementCm3: 2979,
  boreMm: 84,
  strokeMm: 89.6,
  compressionRatio: 10.2,
  fuel: 'gasolina',
  feed: 'injeção direta, turbo twin-scroll único, Valvetronic',
  power: { cv: 306, rpm: 5800, rpmTo: 6000 },
  torque: { nm: 400, rpm: 1200, rpmTo: 5000 },
  layout: 'dianteiro longitudinal, 6 em linha, DOHC 24V, corrente',
  firingOrder: [1, 5, 3, 6, 2, 4],
  sources: ['bmw-serie3-2013-ficha', 'km77-335i-2013', 'literature-bmw-n55'],
};

export const N55_TORQUE_CURVE = {
  rpm: [500, 1000, 1200, 3000, 5000, 5400, 5800, 6000, 6500, 7400],
  torqueNm: [170, 300, 400, 400, 400, 390, torqueForPower(306, 5800), 352, 315, 250],
  documented: [1200, 5800],
};

export const ENGINE_BMW_N55 = modernEngine({
  id: 'bmw-n55b30-306',
  family: 'bmw-n55',
  name: 'BMW N55 3.0 6 em linha TwinPower Turbo 306 hp (335i)',
  architecture: 'I6',
  firingOrder: [1, 5, 3, 6, 2, 4],
  boreMm: 84,
  strokeMm: 89.6,
  rodLengthMm: 144.35, // literature
  compressionRatio: 10.2,
  inertiaKgM2: 0.22, // estimated: six-cylinder crank + flexplate + impeller
  reciprocatingMassKg: 0.5,
  idleRpm: 650,
  redlineRpm: 6800,
  revLimitRpm: 7000,
  limiterCutTimeS: 0.07,
  torqueCurve: N55_TORQUE_CURVE,
  ratedPowerCv: 306,
  ratedPowerRpm: 5800,
  fmep: [0.78, 0.11, 0.022],
  accessoriesNm: 4.5,
  throttle: { bodyDiameterMm: 74, responseTimeS: 0.03, idlePlatePosition: 0.998, pedalGamma: 1.5 },
  intake: { manifoldVolumeL: 4.2, runnerLengthM: 0.26, runnerDiameterMm: 37, airboxVolumeL: 11 },
  cam: { evoDeg: 136, evcDeg: 366, ivoDeg: 354, ivcDeg: 588, intakeLiftMm: 9.9, exhaustLiftMm: 9.7 },
  breathing: { airFilterDropKPa: 2.2, exhaustBackPressureKPa: 13 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 44, cycleVariation: 0.025 },
  turbo: { maxBoostBar: 0.85, spoolTimeS: 0.36, fullBoostFlowFraction: 0.22, maxShaftRpm: 200000, compressorBlades: 7, bovEnabled: true, bovVentTimeS: 0.09, bovVent: 'recirculating' },
  egt: { idleK: 680, maxK: 1210 },
  starterTorqueNm: 70,
});
