import { ENGINE_MERCEDES_M274 } from '../../engines/chapter2/mercedesM274';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { modernAcoustic, modernStockExhaust, torqueConverterTransmission } from './shared';

/**
 * Mercedes-Benz C200 Avantgarde W205 2015, Brazil, gasoline, 7G-TRONIC PLUS automatic with
 * torque converter, rear drive. Revista Auto sheet: 1505 kg, 4686 × 1810 × 1442 mm, 2840 mm
 * wheelbase, 225/45 R17, Cx 0.27, A 2.22 m², 0–100 in 7.3 s, 235 km/h. Gear ratios from the
 * 7G-TRONIC (722.9) literature; the axle ratio is flagged as estimated.
 */
export const MERCEDES_C200_2015_DOC = {
  market: 'Brasil',
  modelYear: 2015,
  version: 'C200 Avantgarde (W205) 2.0 turbo, 7G-TRONIC PLUS',
  sources: ['revistaauto-c200-2015', 'literature-mercedes-722-9'],
  body: 'sedã 4 portas (W205)',
  dimensions: { lengthMm: 4686, widthMm: 1810, heightMm: 1442, wheelbaseMm: 2840, frontOverhangMm: 810 },
  weights: { runningOrderKg: 1505 },
  tyres: '225/45 R17',
  aero: { cd: 0.27, frontalAreaM2: 2.22 },
  performance: { accel0to100S: 7.3, topSpeedKmh: 235 },
  transmission: { code: '7G-TRONIC PLUS (722.9)', kind: 'automático 7 (conversor)', gearRatios: [4.377, 2.859, 1.921, 1.368, 1.0, 0.82, 0.728], finalDrive: 2.82 },
  drive: 'traseira',
};

export const MERCEDES_C200_2015_MASS = { tareKg: 1505, driverKg: 75, fuelKg: 0 } as const;

export const CAR_MERCEDES_C200_2015: CarConfig = {
  schemaVersion: 1,
  id: 'mercedes-c200-w205-2015',
  name: 'Mercedes-Benz C200 W205 2015',
  description: 'M274 2.0 turbo (184 cv, 30,6 kgfm desde 1200 rpm), 7G-TRONIC PLUS com conversor e tração traseira. Aerodinâmica de Cx 0,27.',
  massKg: MERCEDES_C200_2015_MASS.tareKg + MERCEDES_C200_2015_MASS.driverKg + MERCEDES_C200_2015_MASS.fuelKg,
  wheelbaseM: 2.84,
  cgHeightM: 0.5,
  frontWeightFraction: 0.52,
  drivenAxle: 'rear',
  dragCoefficient: 0.27,
  frontalAreaM2: 2.22,
  brakeTorqueNm: 4300,
  engine: ENGINE_MERCEDES_M274,
  transmission: torqueConverterTransmission({
    gearRatios: [...MERCEDES_C200_2015_DOC.transmission.gearRatios],
    finalDrive: MERCEDES_C200_2015_DOC.transmission.finalDrive,
    efficiency: 0.915,
    elementMaxTorqueNm: 820,
    converter: { kFactor: 130, stallTorqueRatio: 1.85, couplingSpeedRatio: 0.85, turbineInertiaKgM2: 0.065, lockup: { maxTorqueNm: 560, minGear: 2, engageRatePerS: 4.5, minTurbineRpm: 1200 } },
    powershift: { torquePhaseS: 0.11, inertiaPhaseMaxS: 0.42, torqueReduction: 0.3, inertiaCapacity: 0.85, downshiftReleaseS: 0.1 },
    autoShift: { wotUpshiftFraction: 0.92, lightUpshiftRpm: 1600, kickdownPedal: 0.9, kickdownRpm: 3300, coastDownshiftRpm: 1050 },
  }),
  tires: { radiusM: rollingRadiusM(225, 45, 17), wheelInertiaKgM2: 0.94, muPeak: 1.07, B: 11.5, C: 1.5, E: 0.34, rollingResistance: 0.0105, optimalTempC: 62, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.2, headerDiameterMm: 40, collectorDiameterMm: 58, collectorLengthM: 2.3, tailpipeDiameterMm: 58, mufflerAbsorption: 0.74, outputGain: 0.86 }),
  acoustic: modernAcoustic({ intakeGain: 0.45, blockGain: 0.42, exhaustGain: 0.74, turboGain: 0.36, mechanicalNoise: 0.32, transmissionGain: 0.22, environmentGain: 0.45, gearTeeth: 31 }),
  visual: { bodyStyle: 'mercedesC200W205', color: '#141518', accent: '#c0c4c8', lengthM: 4.686, heightM: 1.442, frontOverhangM: 0.81, rideHeightM: 0.13 },
};

export const MERCEDES_C200_2015_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'secondary',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@1200': 'secondary',
  'engine.torqueCurve@5500': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'calibrated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'estimated',
  'transmission.torqueConverter': 'estimated',
  'transmission.powershift': 'calibrated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'secondary',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
