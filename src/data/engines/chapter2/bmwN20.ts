import { modernEngine, torqueForPower, type EngineDoc } from './common';

/**
 * BMW N20B20 (320i F30 2014, Brazil, gasoline): 2.0 TwinPower Turbo, twin-scroll turbo, direct
 * injection, Valvetronic and double VANOS. BMW Brazil sheet (Série 3 2013): 184 hp, 270 N·m from
 * 1250 rpm, Aut/8, rear drive. 84 × 90.1 mm, 1997 cm³, 10.0:1, 184 hp at 5000 rpm and the
 * plateau to 4500 rpm from the N20 literature.
 */
export const N20_DOC: EngineDoc = {
  code: 'BMW N20B20 (184 hp)',
  displacementCm3: 1997,
  boreMm: 84,
  strokeMm: 90.1,
  compressionRatio: 10,
  fuel: 'gasolina',
  feed: 'injeção direta, turbo twin-scroll, Valvetronic',
  power: { cv: 184, rpm: 5000 },
  torque: { nm: 270, rpm: 1250, rpmTo: 4500 },
  layout: 'dianteiro longitudinal, 4 em linha, DOHC 16V, corrente',
  firingOrder: [1, 3, 4, 2],
  sources: ['bmw-serie3-2013-ficha', 'literature-bmw-n20'],
};

export const N20_TORQUE_CURVE = {
  rpm: [500, 1000, 1250, 2500, 4500, 5000, 5500, 6000, 6500, 7300],
  torqueNm: [120, 205, 270, 270, 270, torqueForPower(184, 5000), 232, 205, 176, 132],
  documented: [1250, 5000],
};

export const ENGINE_BMW_N20 = modernEngine({
  id: 'bmw-n20b20-184',
  family: 'bmw-n20',
  name: 'BMW N20 2.0 TwinPower Turbo 184 hp (320i)',
  architecture: 'I4',
  firingOrder: [1, 3, 4, 2],
  boreMm: 84,
  strokeMm: 90.1,
  rodLengthMm: 144.35, // literature
  compressionRatio: 10,
  inertiaKgM2: 0.17, // estimated: flexplate + converter impeller
  reciprocatingMassKg: 0.5,
  idleRpm: 700,
  redlineRpm: 6500,
  revLimitRpm: 7000,
  limiterCutTimeS: 0.07,
  torqueCurve: N20_TORQUE_CURVE,
  ratedPowerCv: 184,
  ratedPowerRpm: 5000,
  fmep: [0.78, 0.11, 0.022],
  accessoriesNm: 3.5,
  // Valvetronic controls the load with the intake valve lift: represented by a quick, large
  // "throttle" with a near-linear pedal map
  throttle: { bodyDiameterMm: 64, responseTimeS: 0.03, idlePlatePosition: 0.998, pedalGamma: 1.5 },
  intake: { manifoldVolumeL: 2.8, runnerLengthM: 0.24, runnerDiameterMm: 36, airboxVolumeL: 8.5 },
  cam: { evoDeg: 138, evcDeg: 364, ivoDeg: 356, ivcDeg: 586, intakeLiftMm: 9.9, exhaustLiftMm: 9.7 },
  breathing: { airFilterDropKPa: 2.2, exhaustBackPressureKPa: 13 },
  fuel: 'gasoline',
  combustion: { burnDurationDeg: 45, cycleVariation: 0.03 },
  turbo: { maxBoostBar: 0.9, spoolTimeS: 0.3, fullBoostFlowFraction: 0.24, maxShaftRpm: 220000, compressorBlades: 7, bovEnabled: true, bovVentTimeS: 0.08, bovVent: 'recirculating' },
  egt: { idleK: 690, maxK: 1220 },
  starterTorqueNm: 52,
});
