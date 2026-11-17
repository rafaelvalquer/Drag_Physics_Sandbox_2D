import { ENGINE_BMW_N20 } from '../../engines/chapter2/bmwN20';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { modernAcoustic, modernStockExhaust, torqueConverterTransmission } from './shared';

/** ZF 8HP (8HP45) ratios, ZF/BMW literature. */
export const ZF_8HP_RATIOS = [4.714, 3.143, 2.106, 1.667, 1.285, 1.0, 0.839, 0.667];

/**
 * BMW 320i F30 2014, Brazil, gasoline, ZF 8-speed automatic with torque converter, rear drive.
 * BMW Brazil sheet (Série 3 2013): 184 hp, 270 N·m from 1250 rpm, Aut/8, traseira, 17" wheels.
 * Dimensions from the F30 literature; the axle ratio (3.23) is flagged as estimated.
 */
export const BMW_320I_2014_DOC = {
  market: 'Brasil',
  modelYear: 2014,
  version: '320i (F30) 2.0 TwinPower Turbo, automático 8',
  sources: ['bmw-serie3-2013-ficha', 'literature-bmw-f30', 'literature-zf-8hp'],
  body: 'sedã 4 portas (F30)',
  dimensions: { lengthMm: 4624, widthMm: 1811, heightMm: 1429, wheelbaseMm: 2810, frontOverhangMm: 770 },
  weights: { runningOrderKg: 1475 },
  tyres: '225/50 R17',
  aero: { cd: 0.29, frontalAreaM2: 2.18 },
  performance: { accel0to100S: 7.3, topSpeedKmh: 235 },
  transmission: { code: 'ZF 8HP45', kind: 'automático 8 (conversor)', gearRatios: ZF_8HP_RATIOS, finalDrive: 3.23 },
  drive: 'traseira',
};

export const BMW_320I_2014_MASS = { tareKg: 1475, driverKg: 75, fuelKg: 0 } as const;

export const CAR_BMW_320I_2014: CarConfig = {
  schemaVersion: 1,
  id: 'bmw-320i-f30-2014',
  name: 'BMW 320i F30 2014',
  description: 'N20 2.0 TwinPower Turbo (184 hp, 270 N·m a 1250 rpm), automático ZF de oito marchas com conversor e tração traseira.',
  massKg: BMW_320I_2014_MASS.tareKg + BMW_320I_2014_MASS.driverKg + BMW_320I_2014_MASS.fuelKg,
  wheelbaseM: 2.81,
  cgHeightM: 0.5,
  frontWeightFraction: 0.5,
  drivenAxle: 'rear',
  dragCoefficient: 0.29,
  frontalAreaM2: 2.18,
  brakeTorqueNm: 4200,
  engine: ENGINE_BMW_N20,
  transmission: torqueConverterTransmission({
    gearRatios: [...ZF_8HP_RATIOS],
    finalDrive: BMW_320I_2014_DOC.transmission.finalDrive,
    efficiency: 0.92,
    elementMaxTorqueNm: 760,
    converter: { kFactor: 140, stallTorqueRatio: 1.9, couplingSpeedRatio: 0.86, turbineInertiaKgM2: 0.06, lockup: { maxTorqueNm: 520, minGear: 2, engageRatePerS: 6, minTurbineRpm: 1100 } },
    powershift: { torquePhaseS: 0.08, inertiaPhaseMaxS: 0.32, torqueReduction: 0.35, inertiaCapacity: 0.9, downshiftReleaseS: 0.08 },
    autoShift: { wotUpshiftFraction: 0.93, lightUpshiftRpm: 1700, kickdownPedal: 0.92, kickdownRpm: 3500, coastDownshiftRpm: 1100 },
  }),
  tires: { radiusM: rollingRadiusM(225, 50, 17), wheelInertiaKgM2: 0.95, muPeak: 1.08, B: 11.5, C: 1.5, E: 0.34, rollingResistance: 0.011, optimalTempC: 62, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.2, headerDiameterMm: 40, collectorDiameterMm: 60, collectorLengthM: 2.2, tailpipeDiameterMm: 63, mufflerAbsorption: 0.68, outputGain: 0.95 }),
  acoustic: modernAcoustic({ intakeGain: 0.55, blockGain: 0.48, exhaustGain: 0.82, turboGain: 0.42, mechanicalNoise: 0.38, transmissionGain: 0.25, gearTeeth: 29 }),
  visual: { bodyStyle: 'bmw320iF30', color: '#e7e9eb', accent: '#2a3038', lengthM: 4.624, heightM: 1.429, frontOverhangM: 0.77, rideHeightM: 0.13 },
};

export const BMW_320I_2014_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@1250': 'factory',
  'engine.torqueCurve@5000': 'secondary',
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
