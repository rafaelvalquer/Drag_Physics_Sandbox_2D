import { ENGINE_MERCEDES_M276 } from '../../engines/chapter3/mercedesM276Biturbo';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { modernAcoustic, modernStockExhaust, torqueConverterTransmission } from '../chapter2/shared';

/**
 * Mercedes-AMG C 43 4MATIC Sedan 2017, 9G-TRONIC (nine speeds), all-wheel drive. Mercedes-Benz USA
 * specification page: ratios 5.35 / 3.24 / 2.25 / 1.64 / 1.21 / 1.00 / 0.86 / 0.72 / 0.60, final
 * 3.07, AMG Performance 4MATIC 31:69, 3,759 lb, wheelbase 111.8 in, 185 × 71.3 × 56.3 in,
 * 225/45 R18 front and 245/40 R18 rear, 0–60 mph in 4.6 s, 130 mph electronically limited. The Cd
 * is not on the page (0.27 estimated).
 */
export const MERCEDES_AMG_C43_2017_DOC = {
  market: 'EUA',
  modelYear: 2017,
  version: 'AMG C 43 4MATIC Sedan 3.0 V6 biturbo, automático 9',
  sources: ['mbusa-c43-2017', 'literature-mercedes-m276', 'literature-4matic-c43', 'estimate-chapter3-aero'],
  body: 'sedã 4 portas (W205)',
  dimensions: { lengthMm: 4699, widthMm: 1811, heightMm: 1430, wheelbaseMm: 2840, frontOverhangMm: 840 },
  weights: { runningOrderKg: 1705 },
  tyres: '245/40 R18 (traseiros)',
  aero: { cd: 0.27, frontalAreaM2: 2.16 },
  performance: { accel0to100S: 4.8, topSpeedKmh: 209, topSpeedLimited: true },
  transmission: { code: 'Mercedes 9G-TRONIC', kind: 'automático 9 (conversor)', gearRatios: [5.35, 3.24, 2.25, 1.64, 1.21, 1.0, 0.86, 0.72, 0.6], finalDrive: 3.07 },
  drive: 'integral (31:69)',
};

export const CAR_MERCEDES_AMG_C43_2017: CarConfig = {
  schemaVersion: 1,
  id: 'mercedes-amg-c43-2017',
  name: 'Mercedes-AMG C 43 4MATIC 2017',
  description: 'M276 3.0 V6 biturbo (362 hp, 384 lb-ft de 2.000 a 4.200 rpm), 9G-TRONIC de nove marchas e tração integral 4MATIC 31:69.',
  massKg: MERCEDES_AMG_C43_2017_DOC.weights.runningOrderKg + 75,
  wheelbaseM: 2.84,
  cgHeightM: 0.54,
  frontWeightFraction: 0.54,
  drivenAxle: 'awd',
  awd: { frontTorqueFraction: 0.31, centerCouplingNm: 800, transferEfficiency: 0.95 },
  dragCoefficient: MERCEDES_AMG_C43_2017_DOC.aero.cd,
  frontalAreaM2: MERCEDES_AMG_C43_2017_DOC.aero.frontalAreaM2,
  brakeTorqueNm: 5600,
  engine: ENGINE_MERCEDES_M276,
  transmission: torqueConverterTransmission({
    gearRatios: [...MERCEDES_AMG_C43_2017_DOC.transmission.gearRatios],
    finalDrive: MERCEDES_AMG_C43_2017_DOC.transmission.finalDrive,
    efficiency: 0.92,
    elementMaxTorqueNm: 1050,
    converter: { kFactor: 118, stallTorqueRatio: 1.9, couplingSpeedRatio: 0.86, turbineInertiaKgM2: 0.065, lockup: { maxTorqueNm: 800, minGear: 2, engageRatePerS: 6, minTurbineRpm: 1100 } },
    powershift: { torquePhaseS: 0.06, inertiaPhaseMaxS: 0.26, torqueReduction: 0.4, inertiaCapacity: 0.9, downshiftReleaseS: 0.06 },
    autoShift: { wotUpshiftFraction: 0.96, lightUpshiftRpm: 1500, kickdownPedal: 0.92, kickdownRpm: 3400, coastDownshiftRpm: 1000 },
  }),
  tires: { radiusM: rollingRadiusM(245, 40, 18), wheelInertiaKgM2: 1.05, muPeak: 1.12, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.011, optimalTempC: 65, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'dual', headerLengthM: 0.3, headerDiameterMm: 44, collectorDiameterMm: 58, collectorLengthM: 2.0, tailpipeDiameterMm: 60, mufflerAbsorption: 0.5, mufflerChambersM: [0.13, 0.21, 0.29], outputGain: 1.0 }),
  acoustic: modernAcoustic({ intakeGain: 0.55, blockGain: 0.48, exhaustGain: 1.0, turboGain: 0.4, mechanicalNoise: 0.36, transmissionGain: 0.25, gearTeeth: 28 }),
  visual: { bodyStyle: 'amgC43', color: '#3b4252', accent: '#10131a', lengthM: 4.699, heightM: 1.43, frontOverhangM: 0.84, rideHeightM: 0.12 },
};

export const MERCEDES_AMG_C43_2017_PROVENANCE: Record<string, Provenance> = {
  massKg: 'factory',
  wheelbaseM: 'factory',
  dragCoefficient: 'estimated',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'factory',
  'engine.strokeMm': 'factory',
  'engine.torqueCurve@2000': 'factory',
  'engine.torqueCurve@5500': 'factory',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'estimated',
  'transmission.gearRatios': 'factory',
  'transmission.finalDrive': 'factory',
  'transmission.torqueConverter': 'estimated',
  'transmission.powershift': 'calibrated',
  'awd.frontTorqueFraction': 'factory',
  'awd.centerCouplingNm': 'estimated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'secondary',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
