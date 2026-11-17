import { ENGINE_HONDA_K20Z3 } from '../../engines/chapter2/hondaK20Z3';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { manualTransmission, modernAcoustic, modernStockExhaust } from './shared';

/**
 * Honda Civic Si 2008, Brazil (eighth-generation sedan, imported), gasoline, six-speed manual,
 * front-wheel drive with helical limited-slip differential (not modelled separately: one driven
 * axle). Ratios of the Si six-speed: 3.267/2.130/1.517/1.147/0.921/0.738, final 4.764.
 */
export const CIVIC_SI_2008_DOC = {
  market: 'Brasil',
  modelYear: 2008,
  version: 'Civic Si 2.0 i-VTEC sedã, manual 6',
  sources: ['honda-civic-si-2008-manual', 'literature-k20z3', 'estimate-chapter2-aero'],
  body: 'sedã 4 portas (8ª geração)',
  dimensions: { lengthMm: 4525, widthMm: 1752, heightMm: 1435, wheelbaseMm: 2700, frontOverhangMm: 900 },
  weights: { runningOrderKg: 1288 },
  tyres: '215/45 R17',
  aero: { cd: 0.31, frontalAreaM2: 2.08 },
  performance: { accel0to100S: 7.4, topSpeedKmh: 220 },
  transmission: { code: 'Honda 6MT (Si)', kind: 'manual 6', gearRatios: [3.267, 2.13, 1.517, 1.147, 0.921, 0.738], finalDrive: 4.764 },
  drive: 'dianteira',
};

export const CIVIC_SI_2008_MASS = { tareKg: 1288, driverKg: 75, fuelKg: 0 } as const;

export const CAR_HONDA_CIVIC_SI_2008: CarConfig = {
  schemaVersion: 1,
  id: 'honda-civic-si-2008',
  name: 'Honda Civic Si 2008',
  description: 'K20Z3 2.0 i-VTEC aspirado (192 cv a 7800 rpm, corte em 8300), manual de seis marchas e tração dianteira. Giro, não pressão.',
  massKg: CIVIC_SI_2008_MASS.tareKg + CIVIC_SI_2008_MASS.driverKg + CIVIC_SI_2008_MASS.fuelKg,
  wheelbaseM: 2.7,
  cgHeightM: 0.51,
  frontWeightFraction: 0.61,
  drivenAxle: 'front',
  dragCoefficient: 0.31,
  frontalAreaM2: 2.08,
  brakeTorqueNm: 3800,
  engine: ENGINE_HONDA_K20Z3,
  transmission: manualTransmission({
    gearRatios: [...CIVIC_SI_2008_DOC.transmission.gearRatios],
    finalDrive: CIVIC_SI_2008_DOC.transmission.finalDrive,
    efficiency: 0.915,
    clutchMaxTorqueNm: 300,
    launchRpm: 4500,
    antiStallRpm: 1000,
  }),
  tires: { radiusM: rollingRadiusM(215, 45, 17), wheelInertiaKgM2: 0.88, muPeak: 1.08, B: 12, C: 1.48, E: 0.35, rollingResistance: 0.011, optimalTempC: 62, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.42, headerDiameterMm: 42, collectorDiameterMm: 57, tailpipeDiameterMm: 76, mufflerAbsorption: 0.5, outputGain: 1.1 }),
  acoustic: modernAcoustic({ intakeGain: 1.0, blockGain: 0.6, exhaustGain: 1.0, turboGain: 0, mechanicalNoise: 0.62, gearTeeth: 19 }),
  visual: { bodyStyle: 'civicSi08', color: '#d8d9db', accent: '#b5121b', lengthM: 4.525, heightM: 1.435, frontOverhangM: 0.9, rideHeightM: 0.13 },
};

export const CIVIC_SI_2008_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@6100': 'secondary',
  'engine.torqueCurve@7800': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.variableCam': 'estimated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'secondary',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'secondary',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
