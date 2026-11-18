import { ENGINE_NISSAN_VQ35DE } from '../../engines/chapter3/nissanVq35deRevup';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { manualTransmission, modernAcoustic, modernStockExhaust } from '../chapter2/shared';

/**
 * Nissan 350Z Coupé 2006 (Z33), manual of 6, rear drive. Nissan press kit 2006: VQ35DE Rev-Up
 * 300 hp, 260 lb-ft, 7,000 rpm redline, wheelbase 104.3 in, Cd 0.30, 18" wheels 225/45 front and
 * 245/45 rear. Mass ≈ 3,350 lb from the Motor Matchup listings (3,346–3,370 lb: the sources
 * disagree). The six-speed ratios are those of the 370Z press kit (same family of gearbox: the
 * Motor Matchup summary confirms 1st 3.794, 6th 0.794 and the 3.538 final of the 350Z).
 */
export const NISSAN_350Z_2006_DOC = {
  market: 'EUA',
  modelYear: 2006,
  version: '350Z Coupé 3.5 V6 Rev-Up, manual 6',
  sources: ['nissan-350z-2006-presskit', 'motormatchup-350z-2006', 'estimate-chapter3-aero'],
  body: 'cupê 2 portas (Z33)',
  dimensions: { lengthMm: 4310, widthMm: 1815, heightMm: 1315, wheelbaseMm: 2649, frontOverhangMm: 860 },
  weights: { runningOrderKg: 1520 },
  tyres: '245/45 R18 (traseiros)',
  aero: { cd: 0.3, frontalAreaM2: 2.02 },
  performance: { accel0to100S: 5.6, topSpeedKmh: 250 },
  transmission: { code: 'Nissan 6MT', kind: 'manual 6', gearRatios: [3.794, 2.324, 1.624, 1.271, 1.0, 0.794], finalDrive: 3.538 },
  drive: 'traseira',
};

export const CAR_NISSAN_350Z_2006: CarConfig = {
  schemaVersion: 1,
  id: 'nissan-350z-2006',
  name: 'Nissan 350Z Coupé 2006',
  description: 'VQ35DE Rev-Up 3.5 V6 aspirado (300 hp, 260 lb-ft), manual de seis marchas e tração traseira.',
  massKg: NISSAN_350Z_2006_DOC.weights.runningOrderKg + 75,
  wheelbaseM: 2.649,
  cgHeightM: 0.45,
  frontWeightFraction: 0.53,
  drivenAxle: 'rear',
  dragCoefficient: NISSAN_350Z_2006_DOC.aero.cd,
  frontalAreaM2: NISSAN_350Z_2006_DOC.aero.frontalAreaM2,
  brakeTorqueNm: 5200,
  engine: ENGINE_NISSAN_VQ35DE,
  transmission: manualTransmission({
    gearRatios: [...NISSAN_350Z_2006_DOC.transmission.gearRatios],
    finalDrive: NISSAN_350Z_2006_DOC.transmission.finalDrive,
    efficiency: 0.92,
    clutchMaxTorqueNm: 520,
    launchRpm: 3800,
    antiStallRpm: 800,
  }),
  tires: { radiusM: rollingRadiusM(245, 45, 18), wheelInertiaKgM2: 1.05, muPeak: 1.25, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.011, optimalTempC: 65, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'dual', headerLengthM: 0.42, headerDiameterMm: 40, collectorDiameterMm: 60, collectorLengthM: 1.6, tailpipeDiameterMm: 60, mufflerAbsorption: 0.45, mufflerChambersM: [0.12, 0.2, 0.28], outputGain: 1.05 }),
  acoustic: modernAcoustic({ intakeGain: 0.95, blockGain: 0.55, exhaustGain: 1.05, turboGain: 0, mechanicalNoise: 0.5, transmissionGain: 0.3, gearTeeth: 22 }),
  visual: { bodyStyle: 'nissan350z', color: '#8a9ba8', accent: '#1a1c1f', lengthM: 4.31, heightM: 1.315, frontOverhangM: 0.86, rideHeightM: 0.12 },
};

export const NISSAN_350Z_2006_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'factory',
  dragCoefficient: 'factory',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@4800': 'factory',
  'engine.torqueCurve@6400': 'factory',
  'engine.torqueCurve(other points)': 'estimated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'secondary',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'estimated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
