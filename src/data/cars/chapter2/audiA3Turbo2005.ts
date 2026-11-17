import { ENGINE_VW_EA113_18T_A3 } from '../../engines/chapter2/vwEa11318T';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { manualTransmission, modernAcoustic, modernStockExhaust } from './shared';

/**
 * Audi A3 1.8T 180 cv 2005, built in Brazil (São José dos Pinhais) on the 8L platform, five-door
 * hatch, gasoline, six-speed manual (02M family), front-wheel drive. Same EA113 1.8T family as the
 * Golf GTI; the car differs in mass, gearing (six speeds), airbox and exhaust (twin tips).
 */
export const AUDI_A3_2005_DOC = {
  market: 'Brasil',
  modelYear: 2005,
  version: 'A3 1.8T 180 cv, 5 portas (8L), manual 6',
  sources: ['literature-audi-a3-8l-br', 'literature-vw-02m', 'estimate-chapter2-aero'],
  body: 'hatch 5 portas (8L)',
  dimensions: { lengthMm: 4203, widthMm: 1735, heightMm: 1423, wheelbaseMm: 2513, frontOverhangMm: 880 },
  weights: { runningOrderKg: 1290 },
  tyres: '205/55 R16',
  aero: { cd: 0.31, frontalAreaM2: 2.1 },
  performance: { accel0to100S: 7.9, topSpeedKmh: 228 },
  transmission: { code: 'VW 02M', kind: 'manual 6', gearRatios: [3.364, 2.059, 1.381, 1.037, 0.821, 0.684], finalDrive: 3.94 },
  drive: 'dianteira',
};

export const AUDI_A3_2005_MASS = { tareKg: 1290, driverKg: 75, fuelKg: 0 } as const;

export const CAR_AUDI_A3_2005: CarConfig = {
  schemaVersion: 1,
  id: 'audi-a3-18t-2005',
  name: 'Audi A3 1.8T 2005',
  description: 'O mesmo 1.8 20V turbo do GTI (180 cv) num A3 8L mais pesado, com seis marchas e caixa de ar própria.',
  massKg: AUDI_A3_2005_MASS.tareKg + AUDI_A3_2005_MASS.driverKg + AUDI_A3_2005_MASS.fuelKg,
  wheelbaseM: 2.513,
  cgHeightM: 0.52,
  frontWeightFraction: 0.61,
  drivenAxle: 'front',
  dragCoefficient: 0.31,
  frontalAreaM2: 2.1,
  brakeTorqueNm: 3700,
  engine: ENGINE_VW_EA113_18T_A3,
  transmission: manualTransmission({
    gearRatios: [...AUDI_A3_2005_DOC.transmission.gearRatios],
    finalDrive: AUDI_A3_2005_DOC.transmission.finalDrive,
    efficiency: 0.905,
    clutchMaxTorqueNm: 340,
    launchRpm: 3300,
    antiStallRpm: 950,
  }),
  tires: { radiusM: rollingRadiusM(205, 55, 16), wheelInertiaKgM2: 0.84, muPeak: 1.06, B: 11.5, C: 1.47, E: 0.36, rollingResistance: 0.012, optimalTempC: 62, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.24, headerDiameterMm: 38, collectorDiameterMm: 57, collectorLengthM: 1.8, tailpipeDiameterMm: 55, mufflerAbsorption: 0.66, outputGain: 0.95 }),
  acoustic: modernAcoustic({ intakeGain: 0.68, blockGain: 0.5, exhaustGain: 0.86, turboGain: 0.55, mechanicalNoise: 0.42, gearTeeth: 22 }),
  visual: { bodyStyle: 'audiA3_8l', color: '#9aa1a8', accent: '#202326', lengthM: 4.203, heightM: 1.423, frontOverhangM: 0.88, rideHeightM: 0.13 },
};

export const AUDI_A3_2005_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@1950': 'secondary',
  'engine.torqueCurve@5500': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'calibrated',
  'transmission.gearRatios': 'estimated',
  'transmission.finalDrive': 'estimated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'estimated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
