import { ENGINE_VW_EA888_20 } from '../../engines/chapter2/vwEa88820';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { dualClutchTransmission, modernAcoustic, modernStockExhaust } from './shared';

/**
 * Volkswagen Jetta Highline 2.0 TSI 2012 (sixth generation, NCS/A6), Brazil, gasoline, DSG DQ250
 * six-speed wet dual clutch, front-wheel drive. VW do Brasil sheet (Feb/2011): 1375 kg, 4644 mm
 * long, 1473 mm high, 2651 mm wheelbase, 225/45 R17, Cw 0.300, A 2.180 m², 0–100 7.3 s,
 * 238 km/h; gear ratios 3.462/2.050/1.300/0.902/0.914/0.756 and differential 4.059.
 *
 * The DQ250 has two final drives (one per output shaft): with the single published differential
 * the 5th and 6th gears would be shorter than 4th, so they are referred to the 4.059 output with
 * the usual DQ250 ratio between the two finals (0.75): 0.914·0.75 = 0.686, 0.756·0.75 = 0.567.
 */
export const JETTA_TSI_2012_DOC = {
  market: 'Brasil',
  modelYear: 2012,
  version: 'Jetta Highline 2.0 TSI, DSG 6',
  sources: ['vw-jetta-2012-ficha', 'literature-dq250'],
  body: 'sedã 4 portas (6ª geração)',
  dimensions: { lengthMm: 4644, widthMm: 1778, heightMm: 1473, wheelbaseMm: 2651, frontOverhangMm: 900 },
  weights: { runningOrderKg: 1375 },
  tyres: '225/45 R17',
  aero: { cd: 0.3, frontalAreaM2: 2.18 },
  performance: { accel0to100S: 7.3, topSpeedKmh: 238 },
  transmission: {
    code: 'DSG DQ250',
    kind: 'dupla embreagem 6',
    publishedRatios: [3.462, 2.05, 1.3, 0.902, 0.914, 0.756],
    gearRatios: [3.462, 2.05, 1.3, 0.902, 0.686, 0.567],
    finalDrive: 4.059,
  },
  drive: 'dianteira',
};

export const JETTA_TSI_2012_MASS = { tareKg: 1375, driverKg: 75, fuelKg: 0 } as const;

export const CAR_VW_JETTA_TSI_2012: CarConfig = {
  schemaVersion: 1,
  id: 'vw-jetta-tsi-2012',
  name: 'Volkswagen Jetta Highline TSI 2012',
  description: 'EA888 2.0 TSI (200 cv, 280 N·m a 1700 rpm) com DSG de dupla embreagem banhada a óleo e tração dianteira. Troca sem buraco de torque.',
  massKg: JETTA_TSI_2012_MASS.tareKg + JETTA_TSI_2012_MASS.driverKg + JETTA_TSI_2012_MASS.fuelKg,
  wheelbaseM: 2.651,
  cgHeightM: 0.53,
  frontWeightFraction: 0.6,
  drivenAxle: 'front',
  dragCoefficient: 0.3,
  frontalAreaM2: 2.18,
  brakeTorqueNm: 4000,
  engine: ENGINE_VW_EA888_20,
  transmission: dualClutchTransmission({
    gearRatios: [...JETTA_TSI_2012_DOC.transmission.gearRatios],
    finalDrive: JETTA_TSI_2012_DOC.transmission.finalDrive,
    efficiency: 0.92,
    clutchMaxTorqueNm: 560,
    launchRpm: 3200,
    powershift: { torquePhaseS: 0.05, inertiaPhaseMaxS: 0.18, torqueReduction: 0.45, inertiaCapacity: 0.9, downshiftReleaseS: 0.05 },
    autoShift: { wotUpshiftFraction: 0.95, lightUpshiftRpm: 1600, kickdownPedal: 0.9, kickdownRpm: 3500, coastDownshiftRpm: 1100 },
  }),
  tires: { radiusM: rollingRadiusM(225, 45, 17), wheelInertiaKgM2: 0.92, muPeak: 1.07, B: 11.5, C: 1.5, E: 0.34, rollingResistance: 0.011, optimalTempC: 62, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.2, headerDiameterMm: 40, collectorDiameterMm: 57, tailpipeDiameterMm: 63, mufflerAbsorption: 0.62, outputGain: 1.0 }),
  acoustic: modernAcoustic({ intakeGain: 0.6, blockGain: 0.5, exhaustGain: 0.9, turboGain: 0.5, mechanicalNoise: 0.4, transmissionGain: 0.3, gearTeeth: 27 }),
  visual: { bodyStyle: 'jettaTsi12', color: '#3d4a5c', accent: '#b9bec4', lengthM: 4.644, heightM: 1.473, frontOverhangM: 0.9, rideHeightM: 0.14 },
};

export const JETTA_TSI_2012_PROVENANCE: Record<string, Provenance> = {
  massKg: 'factory',
  wheelbaseM: 'factory',
  dragCoefficient: 'factory',
  frontalAreaM2: 'factory',
  'engine.boreMm': 'factory',
  'engine.strokeMm': 'factory',
  'engine.compressionRatio': 'factory',
  'engine.torqueCurve@1700': 'factory',
  'engine.torqueCurve@5100': 'factory',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'calibrated',
  'transmission.gearRatios(1-4)': 'factory',
  'transmission.gearRatios(5-6)': 'derived',
  'transmission.finalDrive': 'factory',
  'transmission.powershift': 'calibrated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'factory',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
