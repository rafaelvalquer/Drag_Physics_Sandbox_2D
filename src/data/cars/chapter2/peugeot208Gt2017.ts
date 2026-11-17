import { ENGINE_PSA_PRINCE_THP16 } from '../../engines/chapter2/psaPrinceThp16';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { manualTransmission, modernAcoustic, modernStockExhaust } from './shared';

/**
 * Peugeot 208 GT 1.6 THP 2017, Brazil, flex (ethanol rating), 6-speed manual, front-wheel drive,
 * 205/45 R17. Gear ratios were not found in an accessible document: the set used is the PSA
 * 6-speed (MCM) set of the THP hatchbacks, flagged as estimated; the overall gearing is checked
 * against the published top speed.
 */
export const PEUGEOT_208GT_2017_DOC = {
  market: 'Brasil',
  modelYear: 2017,
  version: '208 GT 1.6 THP Flex, manual 6',
  sources: ['shopcar-208gt-2017', 'estimate-chapter2-gearing'],
  body: 'hatch 5 portas',
  dimensions: { lengthMm: 3973, widthMm: 1739, heightMm: 1460, wheelbaseMm: 2538, frontOverhangMm: 810 },
  weights: { runningOrderKg: 1199 },
  tyres: '205/45 R17',
  aero: { cd: 0.3, frontalAreaM2: 2.12 },
  performance: { accel0to100S: 7.7, topSpeedKmh: 220 },
  transmission: { code: 'PSA MCM 6', kind: 'manual 6', gearRatios: [3.417, 1.952, 1.333, 1.035, 0.844, 0.693], finalDrive: 3.88 },
  drive: 'dianteira',
};

export const PEUGEOT_208GT_2017_MASS = { tareKg: 1199, driverKg: 75, fuelKg: 0 } as const;

export const CAR_PEUGEOT_208GT_2017: CarConfig = {
  schemaVersion: 1,
  id: 'peugeot-208-gt-2017',
  name: 'Peugeot 208 GT 1.6 THP 2017',
  description: '1.6 THP flex com turbo twin-scroll (173 cv no etanol, 24,5 kgfm a 1400 rpm), manual de seis marchas. Torque cheio logo cedo.',
  massKg: PEUGEOT_208GT_2017_MASS.tareKg + PEUGEOT_208GT_2017_MASS.driverKg + PEUGEOT_208GT_2017_MASS.fuelKg,
  wheelbaseM: 2.538,
  cgHeightM: 0.52,
  frontWeightFraction: 0.63,
  drivenAxle: 'front',
  dragCoefficient: 0.3,
  frontalAreaM2: 2.12,
  brakeTorqueNm: 3600,
  engine: ENGINE_PSA_PRINCE_THP16,
  transmission: manualTransmission({
    gearRatios: [...PEUGEOT_208GT_2017_DOC.transmission.gearRatios],
    finalDrive: PEUGEOT_208GT_2017_DOC.transmission.finalDrive,
    efficiency: 0.91,
    clutchMaxTorqueNm: 360,
    launchRpm: 3000,
    antiStallRpm: 900,
  }),
  tires: { radiusM: rollingRadiusM(205, 45, 17), wheelInertiaKgM2: 0.86, muPeak: 1.08, B: 12, C: 1.48, E: 0.35, rollingResistance: 0.011, optimalTempC: 62, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.22, headerDiameterMm: 36, collectorDiameterMm: 52, tailpipeDiameterMm: 60, mufflerAbsorption: 0.58, outputGain: 1.0 }),
  acoustic: modernAcoustic({ intakeGain: 0.62, blockGain: 0.5, exhaustGain: 0.86, turboGain: 0.5, mechanicalNoise: 0.4, gearTeeth: 21 }),
  visual: { bodyStyle: 'peugeot208Gt17', color: '#b8141f', accent: '#1c1c1c', lengthM: 3.973, heightM: 1.46, frontOverhangM: 0.81, rideHeightM: 0.13 },
};

export const PEUGEOT_208GT_2017_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'estimated',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@1400': 'secondary',
  'engine.torqueCurve@6000': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'calibrated',
  'transmission.gearRatios': 'estimated',
  'transmission.finalDrive': 'estimated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'secondary',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
