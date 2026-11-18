import { ENGINE_NISSAN_VR38DETT } from '../../engines/chapter3/nissanVr38dett';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { dualClutchTransmission, modernAcoustic, modernStockExhaust } from '../chapter2/shared';

/**
 * Nissan GT-R R35 Premium 2015, AWD (ATTESA E-TS), 6-speed dual-clutch transaxle. Nissan press kit
 * 2015: ratios 4.056 / 2.301 / 1.595 / 1.248 / 1.001 / 0.796, rear final 3.700, torque split from
 * 0:100 to 50:50, 3,851 lb (53/47), wheelbase 109.4 in, 183.8 × 74.6 × 53.9 in, Cd 0.26, Dunlop
 * SP Sport Maxx GT600 DSST CTT 255/40 ZRF20 front and 285/35 ZRF20 rear. The static front share
 * (30 %) and the coupling capacity are estimates of the ATTESA behaviour; the press kit has no
 * 0–60 figure (≈ 3.0 s on 0–100 km/h is a literature estimate, not a source).
 */
export const NISSAN_GTR_R35_2015_DOC = {
  market: 'EUA',
  modelYear: 2015,
  version: 'GT-R Premium 3.8 V6 biturbo, dupla embreagem 6',
  sources: ['nissan-gtr-2015-presskit', 'literature-attesa-ets', 'estimate-chapter3-gearing', 'estimate-chapter3-aero'],
  body: 'cupê 2 portas (R35)',
  dimensions: { lengthMm: 4669, widthMm: 1895, heightMm: 1369, wheelbaseMm: 2779, frontOverhangMm: 830 },
  weights: { runningOrderKg: 1747 },
  tyres: '285/35 ZRF20 (traseiros)',
  aero: { cd: 0.26, frontalAreaM2: 2.14 },
  performance: { accel0to100S: 3.0, topSpeedKmh: 315 },
  transmission: { code: 'GR6 (dupla embreagem)', kind: 'dupla embreagem 6', gearRatios: [4.056, 2.301, 1.595, 1.248, 1.001, 0.796], finalDrive: 3.7 },
  drive: 'integral ATTESA E-TS (0:100 a 50:50)',
};

export const CAR_NISSAN_GTR_R35_2015: CarConfig = {
  schemaVersion: 1,
  id: 'nissan-gtr-r35-2015',
  name: 'Nissan GT-R R35 Premium 2015',
  description: 'VR38DETT 3.8 V6 biturbo (545 hp, 463 lb-ft de 3.200 a 5.800 rpm), dupla embreagem de seis marchas e tração integral ATTESA E-TS.',
  massKg: NISSAN_GTR_R35_2015_DOC.weights.runningOrderKg + 75,
  wheelbaseM: 2.779,
  cgHeightM: 0.5,
  frontWeightFraction: 0.53,
  drivenAxle: 'awd',
  awd: { frontTorqueFraction: 0.3, centerCouplingNm: 1400, transferEfficiency: 0.94 },
  dragCoefficient: NISSAN_GTR_R35_2015_DOC.aero.cd,
  frontalAreaM2: NISSAN_GTR_R35_2015_DOC.aero.frontalAreaM2,
  brakeTorqueNm: 7000,
  engine: ENGINE_NISSAN_VR38DETT,
  transmission: dualClutchTransmission({
    gearRatios: [...NISSAN_GTR_R35_2015_DOC.transmission.gearRatios],
    finalDrive: NISSAN_GTR_R35_2015_DOC.transmission.finalDrive,
    efficiency: 0.91,
    clutchMaxTorqueNm: 900,
    launchRpm: 4000,
    powershift: { torquePhaseS: 0.04, inertiaPhaseMaxS: 0.16, torqueReduction: 0.5, inertiaCapacity: 0.9, downshiftReleaseS: 0.04 },
    autoShift: { wotUpshiftFraction: 0.97, lightUpshiftRpm: 2000, kickdownPedal: 0.9, kickdownRpm: 4200, coastDownshiftRpm: 1300 },
  }),
  tires: { radiusM: rollingRadiusM(285, 35, 20), wheelInertiaKgM2: 1.5, muPeak: 1.25, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.012, optimalTempC: 70, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.3, headerDiameterMm: 46, collectorDiameterMm: 66, collectorLengthM: 1.8, tailpipeDiameterMm: 65, mufflerAbsorption: 0.45, mufflerChambersM: [0.13, 0.21, 0.29], outputGain: 1.1 }),
  acoustic: modernAcoustic({ intakeGain: 0.7, blockGain: 0.58, exhaustGain: 1.0, turboGain: 0.5, mechanicalNoise: 0.55, transmissionGain: 0.5, gearTeeth: 24 }),
  visual: { bodyStyle: 'nissanGtrR35', color: '#f1f2f3', accent: '#14161a', lengthM: 4.669, heightM: 1.369, frontOverhangM: 0.83, rideHeightM: 0.12 },
};

export const NISSAN_GTR_R35_2015_PROVENANCE: Record<string, Provenance> = {
  massKg: 'factory',
  wheelbaseM: 'factory',
  dragCoefficient: 'factory',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'factory',
  'engine.strokeMm': 'factory',
  'engine.torqueCurve@3200': 'factory',
  'engine.torqueCurve@6400': 'factory',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'estimated',
  'transmission.gearRatios': 'factory',
  'transmission.finalDrive': 'factory',
  'transmission.powershift': 'calibrated',
  'awd.frontTorqueFraction': 'estimated',
  'awd.centerCouplingNm': 'estimated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'estimated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
