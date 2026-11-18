import { ENGINE_NISSAN_VQ37VHR } from '../../engines/chapter3/nissanVq37vhr';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { manualTransmission, modernAcoustic, modernStockExhaust } from '../chapter2/shared';

/**
 * Nissan 370Z Coupé 2014, manual of 6, rear drive. Nissan press kit 2014 (370Z Coupe MT): VQ37VHR
 * 332 hp / 270 lb-ft, gear ratios 3.794 / 2.324 / 1.624 / 1.271 / 1.000 / 0.794, final 3.692,
 * 3,278 lb (54/46), wheelbase 100.4 in, 167.2 × 72.6 × 51.8 in, Cd 0.30, 18" 225/50 front and
 * 245/45 rear Yokohama ADVAN Sport.
 */
export const NISSAN_370Z_2014_DOC = {
  market: 'EUA',
  modelYear: 2014,
  version: '370Z Coupé 3.7 V6 VVEL, manual 6',
  sources: ['nissan-370z-2014-presskit', 'estimate-chapter3-aero'],
  body: 'cupê 2 portas (Z34)',
  dimensions: { lengthMm: 4247, widthMm: 1844, heightMm: 1316, wheelbaseMm: 2550, frontOverhangMm: 860 },
  weights: { runningOrderKg: 1487 },
  tyres: '245/45 R18 (traseiros)',
  aero: { cd: 0.3, frontalAreaM2: 2.0 },
  performance: { accel0to100S: 5.1, topSpeedKmh: 250 },
  transmission: { code: 'Nissan 6MT', kind: 'manual 6', gearRatios: [3.794, 2.324, 1.624, 1.271, 1.0, 0.794], finalDrive: 3.692 },
  drive: 'traseira',
};

export const CAR_NISSAN_370Z_2014: CarConfig = {
  schemaVersion: 1,
  id: 'nissan-370z-2014',
  name: 'Nissan 370Z Coupé 2014',
  description: 'VQ37VHR 3.7 V6 aspirado com VVEL (332 hp, 270 lb-ft, giro até 7.500 rpm), manual de seis marchas e tração traseira.',
  massKg: NISSAN_370Z_2014_DOC.weights.runningOrderKg + 75,
  wheelbaseM: 2.55,
  cgHeightM: 0.45,
  frontWeightFraction: 0.54,
  drivenAxle: 'rear',
  dragCoefficient: NISSAN_370Z_2014_DOC.aero.cd,
  frontalAreaM2: NISSAN_370Z_2014_DOC.aero.frontalAreaM2,
  brakeTorqueNm: 5400,
  engine: ENGINE_NISSAN_VQ37VHR,
  transmission: manualTransmission({
    gearRatios: [...NISSAN_370Z_2014_DOC.transmission.gearRatios],
    finalDrive: NISSAN_370Z_2014_DOC.transmission.finalDrive,
    efficiency: 0.92,
    clutchMaxTorqueNm: 540,
    launchRpm: 4000,
    antiStallRpm: 800,
  }),
  tires: { radiusM: rollingRadiusM(245, 45, 18), wheelInertiaKgM2: 1.05, muPeak: 1.3, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.011, optimalTempC: 65, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'dual', headerLengthM: 0.4, headerDiameterMm: 42, collectorDiameterMm: 62, collectorLengthM: 1.5, tailpipeDiameterMm: 62, mufflerAbsorption: 0.42, mufflerChambersM: [0.12, 0.2, 0.27], outputGain: 1.1 }),
  acoustic: modernAcoustic({ intakeGain: 1.0, blockGain: 0.58, exhaustGain: 1.1, turboGain: 0, mechanicalNoise: 0.5, transmissionGain: 0.3, gearTeeth: 22 }),
  visual: { bodyStyle: 'nissan370z', color: '#d97a1a', accent: '#16181b', lengthM: 4.247, heightM: 1.316, frontOverhangM: 0.86, rideHeightM: 0.12 },
};

export const NISSAN_370Z_2014_PROVENANCE: Record<string, Provenance> = {
  massKg: 'factory',
  wheelbaseM: 'factory',
  dragCoefficient: 'factory',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'factory',
  'engine.strokeMm': 'factory',
  'engine.torqueCurve@5200': 'factory',
  'engine.torqueCurve@7000': 'factory',
  'engine.torqueCurve(other points)': 'estimated',
  'transmission.gearRatios': 'factory',
  'transmission.finalDrive': 'factory',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'estimated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
