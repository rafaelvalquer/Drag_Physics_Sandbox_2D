import { ENGINE_MITSUBISHI_4B11T } from '../../engines/chapter2/mitsubishi4B11T';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { dualClutchTransmission, modernAcoustic, modernStockExhaust } from './shared';

/**
 * Mitsubishi Lancer Evolution X 2012 (GSR, TC-SST), Brazil, gasoline: six-speed Twin Clutch SST,
 * S-AWC four-wheel drive (ACD active centre differential + AYC rear). In this longitudinal model
 * the drivetrain is an open centre differential with a 50/50 static split and a bounded centre
 * clutch (ACD); AYC (yaw control, lateral) has no effect on a straight-line run and is not
 * modelled. TC-SST ratios 3.655/2.368/1.754/1.322/1.008/0.775, final 4.062 (literature).
 */
export const EVO_X_2012_DOC = {
  market: 'Brasil',
  modelYear: 2012,
  version: 'Lancer Evolution X GSR 2.0 turbo, TC-SST 6, S-AWC',
  sources: ['encycarpedia-evo-x', 'literature-tc-sst', 'literature-s-awc'],
  body: 'sedã 4 portas (Evolution X)',
  dimensions: { lengthMm: 4495, widthMm: 1810, heightMm: 1480, wheelbaseMm: 2650, frontOverhangMm: 960 },
  weights: { runningOrderKg: 1590 },
  tyres: '245/40 R18',
  aero: { cd: 0.34, frontalAreaM2: 2.2 },
  performance: { accel0to100S: 5.3, topSpeedKmh: 242 },
  transmission: { code: 'TC-SST (W6DGA)', kind: 'dupla embreagem 6', gearRatios: [3.655, 2.368, 1.754, 1.322, 1.008, 0.775], finalDrive: 4.062 },
  drive: 'integral (S-AWC: ACD + AYC)',
};

export const EVO_X_2012_MASS = { tareKg: 1590, driverKg: 75, fuelKg: 0 } as const;

export const CAR_MITSUBISHI_EVO_X_2012: CarConfig = {
  schemaVersion: 1,
  id: 'mitsubishi-evo-x-2012',
  name: 'Mitsubishi Lancer Evolution X 2012',
  description: '4B11T 2.0 turbo (295 cv, 37,3 kgfm), TC-SST de dupla embreagem e tração integral S-AWC com diferencial central ativo.',
  massKg: EVO_X_2012_MASS.tareKg + EVO_X_2012_MASS.driverKg + EVO_X_2012_MASS.fuelKg,
  wheelbaseM: 2.65,
  cgHeightM: 0.53,
  frontWeightFraction: 0.6,
  drivenAxle: 'awd',
  awd: { frontTorqueFraction: 0.5, centerCouplingNm: 1100, transferEfficiency: 0.95 },
  dragCoefficient: 0.34,
  frontalAreaM2: 2.2,
  brakeTorqueNm: 5200,
  engine: ENGINE_MITSUBISHI_4B11T,
  transmission: dualClutchTransmission({
    gearRatios: [...EVO_X_2012_DOC.transmission.gearRatios],
    finalDrive: EVO_X_2012_DOC.transmission.finalDrive,
    efficiency: 0.92,
    clutchMaxTorqueNm: 620,
    launchRpm: 4200,
    powershift: { torquePhaseS: 0.05, inertiaPhaseMaxS: 0.2, torqueReduction: 0.45, inertiaCapacity: 0.9, downshiftReleaseS: 0.05 },
    autoShift: { wotUpshiftFraction: 0.95, lightUpshiftRpm: 1900, kickdownPedal: 0.9, kickdownRpm: 4200, coastDownshiftRpm: 1200 },
  }),
  tires: { radiusM: rollingRadiusM(245, 40, 18), wheelInertiaKgM2: 1.02, muPeak: 1.12, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.012, optimalTempC: 65, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.18, headerDiameterMm: 44, collectorDiameterMm: 70, tailpipeDiameterMm: 89, mufflerAbsorption: 0.5, mufflerChambersM: [0.14, 0.22, 0.3], outputGain: 1.05 }),
  acoustic: modernAcoustic({ intakeGain: 0.72, blockGain: 0.6, exhaustGain: 1.0, turboGain: 0.48, mechanicalNoise: 0.5, transmissionGain: 0.42, gearTeeth: 25 }),
  visual: { bodyStyle: 'lancerEvoX', color: '#f2f3f4', accent: '#141414', lengthM: 4.495, heightM: 1.48, frontOverhangM: 0.96, rideHeightM: 0.13 },
};

export const EVO_X_2012_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@3500': 'secondary',
  'engine.torqueCurve@6500': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'calibrated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'secondary',
  'transmission.powershift': 'calibrated',
  'awd.frontTorqueFraction': 'secondary',
  'awd.centerCouplingNm': 'estimated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'secondary',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
