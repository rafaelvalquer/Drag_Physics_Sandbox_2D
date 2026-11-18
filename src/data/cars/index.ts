import type { AcousticConfig, CarConfig, ShiftConfig } from '../schema';
import {
  ENGINE_ARCO_I4,
  ENGINE_AURORA_V12,
  ENGINE_KRONOS_V8,
  ENGINE_LINCE_V6,
  ENGINE_ORION_I6T,
  ENGINE_TEMPEST_V8,
  ENGINE_VETRA_I4T,
} from '../engines';
import { exhaustPreset } from '../exhaustPresets';
import { CAR_VW_GOL_GTS_1988 } from './vwGolGts1988';
import { CHAPTER2_CARS } from './chapter2/index';
import { CHAPTER3_CARS } from './chapter3/index';
import { CAMPAIGN_CARS } from './campaign';

export { CAR_VW_GOL_GTS_1988 } from './vwGolGts1988';

/**
 * Fictional cars. Masses, ratios, aerodynamics and power targets are illustrative values for a
 * game sandbox, not certified manufacturer data. No real brand, logo or body design is used.
 *
 * The one real car, the Volkswagen Gol GTS 1988, lives in its own module (vwGolGts1988.ts) with
 * the factory data of its owner's manual and the provenance of every value.
 */

const acoustic = (over: Partial<AcousticConfig> = {}): AcousticConfig => ({
  intakeGain: 0.7,
  blockGain: 0.6,
  exhaustGain: 1,
  turboGain: 0.8,
  tireGain: 0.8,
  transmissionGain: 0.5,
  environmentGain: 0.5,
  gearTeeth: 23,
  mechanicalNoise: 0.6,
  ...over,
});

const sequentialShift = (over: Partial<ShiftConfig> = {}): ShiftConfig => ({
  torqueCutTimeS: 0.035,
  upshiftFreeFallMaxS: 0.05,
  clutchDisengageTimeS: 0.03,
  gearChangeTimeS: 0.06,
  clutchEngageTimeS: 0.11,
  revMatch: { enabled: true, gain: 1.4, toleranceRpm: 250, maxBlipThrottle: 0.5, timeoutS: 0.35, leadTimeS: 0.14 },
  overRevProtection: 'block',
  maxDownshiftRpmFraction: 0.97,
  ...over,
});

export const CAR_ARCO_1600: CarConfig = {
  schemaVersion: 1,
  id: 'arco-1600',
  name: 'Arco 1600',
  description: 'Hatch compacto, I4 1.6 aspirado, tração dianteira. Leve e com marchas curtas.',
  massKg: 1050,
  wheelbaseM: 2.5,
  cgHeightM: 0.52,
  frontWeightFraction: 0.61,
  drivenAxle: 'front',
  dragCoefficient: 0.32,
  frontalAreaM2: 2.0,
  brakeTorqueNm: 3200,
  engine: ENGINE_ARCO_I4,
  transmission: {
    gearRatios: [3.42, 1.95, 1.35, 1.03, 0.82],
    finalDrive: 4.06,
    efficiency: 0.93,
    inputInertiaKgM2: 0.008,
    outputInertiaKgM2: 0.01,
    clutch: { maxTorqueNm: 260, engageRatePerS: 4.5, launchRpm: 3600, antiStallRpm: 950 },
    shift: sequentialShift({ torqueCutTimeS: 0.05, clutchDisengageTimeS: 0.05, gearChangeTimeS: 0.1, clutchEngageTimeS: 0.16 }),
  },
  tires: {
    radiusM: 0.29,
    wheelInertiaKgM2: 0.75,
    muPeak: 1.0,
    B: 13,
    C: 1.45,
    E: 0.4,
    rollingResistance: 0.012,
    optimalTempC: 70,
    tempSensitivityPerC: 0.0018,
  },
  exhaust: exhaustPreset('stock', { layout: 'single', headerPrimaryLengthM: 0.55, headerDiameterMm: 36 }),
  acoustic: acoustic({ intakeGain: 0.8, gearTeeth: 19 }),
  visual: {
    bodyStyle: 'hatch',
    color: '#d9482b',
    accent: '#2b2f36',
    lengthM: 3.95,
    heightM: 1.45,
    frontOverhangM: 0.78,
    rideHeightM: 0.15,
  },
};

export const CAR_VETRA_RS: CarConfig = {
  schemaVersion: 1,
  id: 'vetra-rs',
  name: 'Vetra RS',
  description: 'Hot hatch I4 2.0 turbo, tração dianteira: muito torque para o eixo dianteiro.',
  massKg: 1260,
  wheelbaseM: 2.62,
  cgHeightM: 0.5,
  frontWeightFraction: 0.6,
  drivenAxle: 'front',
  dragCoefficient: 0.33,
  frontalAreaM2: 2.15,
  brakeTorqueNm: 4200,
  engine: ENGINE_VETRA_I4T,
  transmission: {
    gearRatios: [3.31, 2.13, 1.48, 1.14, 0.95, 0.79],
    finalDrive: 3.94,
    efficiency: 0.92,
    inputInertiaKgM2: 0.009,
    outputInertiaKgM2: 0.012,
    clutch: { maxTorqueNm: 620, engageRatePerS: 5, launchRpm: 3900, antiStallRpm: 950 },
    shift: sequentialShift(),
  },
  tires: {
    radiusM: 0.316,
    wheelInertiaKgM2: 0.95,
    muPeak: 1.1,
    B: 13.5,
    C: 1.45,
    E: 0.35,
    rollingResistance: 0.011,
    optimalTempC: 75,
    tempSensitivityPerC: 0.0016,
  },
  exhaust: exhaustPreset('sport', { layout: 'single', headerPrimaryLengthM: 0.4, headerDiameterMm: 40 }),
  acoustic: acoustic({ turboGain: 1, gearTeeth: 21 }),
  visual: {
    bodyStyle: 'hotHatch',
    color: '#1f6fd1',
    accent: '#f2c230',
    lengthM: 4.25,
    heightM: 1.44,
    frontOverhangM: 0.86,
    rideHeightM: 0.13,
  },
};

export const CAR_LINCE_GT: CarConfig = {
  schemaVersion: 1,
  id: 'lince-gt',
  name: 'Lince GT',
  description: 'Cupê V6 3.5 aspirado, tração traseira, resposta linear até 7.300 rpm.',
  massKg: 1380,
  wheelbaseM: 2.65,
  cgHeightM: 0.47,
  frontWeightFraction: 0.53,
  drivenAxle: 'rear',
  dragCoefficient: 0.3,
  frontalAreaM2: 1.95,
  brakeTorqueNm: 4800,
  engine: ENGINE_LINCE_V6,
  transmission: {
    gearRatios: [3.79, 2.32, 1.62, 1.27, 1.0, 0.79],
    finalDrive: 3.69,
    efficiency: 0.91,
    inputInertiaKgM2: 0.01,
    outputInertiaKgM2: 0.02,
    clutch: { maxTorqueNm: 600, engageRatePerS: 5, launchRpm: 4300, antiStallRpm: 900 },
    shift: sequentialShift(),
  },
  tires: {
    radiusM: 0.322,
    wheelInertiaKgM2: 1.0,
    muPeak: 1.12,
    B: 13,
    C: 1.45,
    E: 0.35,
    rollingResistance: 0.011,
    optimalTempC: 75,
    tempSensitivityPerC: 0.0016,
  },
  exhaust: exhaustPreset('sport', { layout: 'dual', headerPrimaryLengthM: 0.62, headerDiameterMm: 42 }),
  acoustic: acoustic({ gearTeeth: 23 }),
  visual: {
    bodyStyle: 'coupe',
    color: '#e8e4da',
    accent: '#a3122a',
    lengthM: 4.45,
    heightM: 1.32,
    frontOverhangM: 0.9,
    rideHeightM: 0.12,
  },
};

export const CAR_ORION_XR: CarConfig = {
  schemaVersion: 1,
  id: 'orion-xr',
  name: 'Orion XR',
  description: 'Sedã esportivo I6 3.0 turbo, tração traseira, torque plano a partir de 2.400 rpm.',
  massKg: 1480,
  wheelbaseM: 2.85,
  cgHeightM: 0.5,
  frontWeightFraction: 0.52,
  drivenAxle: 'rear',
  dragCoefficient: 0.29,
  frontalAreaM2: 2.2,
  brakeTorqueNm: 5200,
  engine: ENGINE_ORION_I6T,
  transmission: {
    gearRatios: [4.11, 2.32, 1.54, 1.18, 1.0, 0.85],
    finalDrive: 3.15,
    efficiency: 0.92,
    inputInertiaKgM2: 0.011,
    outputInertiaKgM2: 0.022,
    clutch: { maxTorqueNm: 900, engageRatePerS: 5, launchRpm: 3600, antiStallRpm: 850 },
    shift: sequentialShift({ gearChangeTimeS: 0.055, clutchEngageTimeS: 0.1 }),
  },
  tires: {
    radiusM: 0.33,
    wheelInertiaKgM2: 1.1,
    muPeak: 1.15,
    B: 13,
    C: 1.45,
    E: 0.35,
    rollingResistance: 0.011,
    optimalTempC: 78,
    tempSensitivityPerC: 0.0015,
  },
  exhaust: exhaustPreset('sport', { layout: 'dual', headerPrimaryLengthM: 0.45, headerDiameterMm: 42 }),
  acoustic: acoustic({ turboGain: 0.9 }),
  visual: {
    bodyStyle: 'sedan',
    color: '#3d4a52',
    accent: '#9fd3ff',
    lengthM: 4.75,
    heightM: 1.42,
    frontOverhangM: 0.88,
    rideHeightM: 0.13,
  },
};

export const CAR_KRONOS_V8: CarConfig = {
  schemaVersion: 1,
  id: 'kronos-v8',
  name: 'Kronos V8',
  description: 'Muscle car V8 5.7 cross-plane, tração traseira. Burble irregular característico.',
  massKg: 1590,
  wheelbaseM: 2.72,
  cgHeightM: 0.53,
  frontWeightFraction: 0.54,
  drivenAxle: 'rear',
  dragCoefficient: 0.36,
  frontalAreaM2: 2.3,
  brakeTorqueNm: 5600,
  engine: ENGINE_KRONOS_V8,
  transmission: {
    gearRatios: [2.66, 1.78, 1.3, 1.0, 0.74, 0.5],
    finalDrive: 3.73,
    efficiency: 0.9,
    inputInertiaKgM2: 0.014,
    outputInertiaKgM2: 0.03,
    clutch: { maxTorqueNm: 1000, engageRatePerS: 4.5, launchRpm: 3300, antiStallRpm: 850 },
    shift: sequentialShift({ gearChangeTimeS: 0.075, clutchEngageTimeS: 0.13 }),
  },
  tires: {
    radiusM: 0.345,
    wheelInertiaKgM2: 1.3,
    muPeak: 1.18,
    B: 12,
    C: 1.45,
    E: 0.3,
    rollingResistance: 0.012,
    optimalTempC: 80,
    tempSensitivityPerC: 0.0015,
  },
  exhaust: exhaustPreset('sport', { layout: 'dual', headerPrimaryLengthM: 0.78, headerDiameterMm: 45 }),
  acoustic: acoustic({ blockGain: 0.75, gearTeeth: 25 }),
  visual: {
    bodyStyle: 'muscle',
    color: '#151a1f',
    accent: '#e5a019',
    lengthM: 4.8,
    heightM: 1.38,
    frontOverhangM: 0.98,
    rideHeightM: 0.14,
  },
};

export const CAR_TEMPEST_V8: CarConfig = {
  schemaVersion: 1,
  id: 'tempest-v8',
  name: 'Tempest V8',
  description: 'Superesportivo de motor central V8 4.0 flat-plane, gira até 8.800 rpm.',
  massKg: 1390,
  wheelbaseM: 2.65,
  cgHeightM: 0.44,
  frontWeightFraction: 0.42,
  drivenAxle: 'rear',
  dragCoefficient: 0.33,
  frontalAreaM2: 1.95,
  brakeTorqueNm: 6400,
  engine: ENGINE_TEMPEST_V8,
  transmission: {
    gearRatios: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84],
    finalDrive: 4.44,
    efficiency: 0.92,
    inputInertiaKgM2: 0.008,
    outputInertiaKgM2: 0.015,
    clutch: { maxTorqueNm: 800, engageRatePerS: 6, launchRpm: 4800, antiStallRpm: 1050 },
    shift: sequentialShift({ torqueCutTimeS: 0.025, clutchDisengageTimeS: 0.02, gearChangeTimeS: 0.045, clutchEngageTimeS: 0.08 }),
  },
  tires: {
    radiusM: 0.34,
    wheelInertiaKgM2: 1.15,
    muPeak: 1.25,
    B: 13,
    C: 1.45,
    E: 0.3,
    rollingResistance: 0.011,
    optimalTempC: 85,
    tempSensitivityPerC: 0.0014,
  },
  exhaust: exhaustPreset('sport', { layout: 'dual', headerPrimaryLengthM: 0.38, headerDiameterMm: 40 }),
  acoustic: acoustic({ intakeGain: 0.9, gearTeeth: 21 }),
  visual: {
    bodyStyle: 'supercar',
    color: '#f2b705',
    accent: '#1c1c1c',
    lengthM: 4.55,
    heightM: 1.18,
    frontOverhangM: 1.0,
    rideHeightM: 0.1,
  },
};

/** Experimental lab-only car carrying the V12 preset (selectable in the Sandbox laboratory). */
export const CAR_AURORA_V12_LAB: CarConfig = {
  ...CAR_TEMPEST_V8,
  id: 'aurora-v12-lab',
  name: 'Aurora V12 (lab)',
  description: 'Protótipo experimental do laboratório com o motor V12 6.5 60°.',
  massKg: 1560,
  frontWeightFraction: 0.46,
  engine: ENGINE_AURORA_V12,
  transmission: {
    ...CAR_TEMPEST_V8.transmission,
    gearRatios: [3.0, 2.12, 1.6, 1.27, 1.03, 0.85],
    finalDrive: 4.1,
    clutch: { maxTorqueNm: 1150, engageRatePerS: 6, launchRpm: 4500, antiStallRpm: 1000 },
  },
  exhaust: exhaustPreset('sport', { layout: 'dual', headerPrimaryLengthM: 0.42, headerDiameterMm: 40 }),
  visual: { ...CAR_TEMPEST_V8.visual, bodyStyle: 'prototype', color: '#6b2fd6', accent: '#d8d8e0', lengthM: 4.7, heightM: 1.2 },
};

export const CARS: readonly CarConfig[] = [
  CAR_ARCO_1600,
  CAR_VETRA_RS,
  CAR_LINCE_GT,
  CAR_ORION_XR,
  CAR_KRONOS_V8,
  CAR_TEMPEST_V8,
  CAR_VW_GOL_GTS_1988,
];

/** Deduplicate by canonical factory ID; the Gol is intentionally the same CarConfig object. */
export function uniqueCars(cars: readonly CarConfig[]): CarConfig[] {
  const seen = new Set<string>();
  return cars.filter((car) => !seen.has(car.id) && !!seen.add(car.id));
}

/** Free modes never depend on career ownership, progression or inventory. */
/** The ten Chapter 2 cars are the same objects the career uses (one catalogue, no duplicate entry). */
export const SANDBOX_CARS: readonly CarConfig[] = uniqueCars([...CARS, ...CAMPAIGN_CARS, ...CHAPTER2_CARS, ...CHAPTER3_CARS]);
export const LAB_CARS: readonly CarConfig[] = uniqueCars([...SANDBOX_CARS, CAR_AURORA_V12_LAB]);
export const CALIBRATION_CARS: readonly CarConfig[] = LAB_CARS;

/** Display-only grouping; no copies of original vehicles are created. */
export const CAR_GROUPS: readonly { label: string; cars: readonly CarConfig[] }[] = [
  { label: 'Brasileiros clássicos', cars: CAMPAIGN_CARS },
  { label: 'Liga da Madrugada (Capítulo 2)', cars: CHAPTER2_CARS },
  { label: 'Elite da Madrugada (Capítulo 3)', cars: CHAPTER3_CARS },
  { label: 'Veículos fictícios', cars: CARS.filter((c) => !CAMPAIGN_CARS.some((b) => b.id === c.id)) },
  { label: 'Experimentais', cars: [CAR_AURORA_V12_LAB] },
];

export function findCar(id: string): CarConfig | undefined {
  return LAB_CARS.find((c) => c.id === id);
}

export function cloneCar(c: CarConfig): CarConfig {
  return JSON.parse(JSON.stringify(c)) as CarConfig;
}
