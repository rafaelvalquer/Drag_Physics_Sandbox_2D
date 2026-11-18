import { ENGINE_KIA_LAMBDA_33 } from '../../engines/chapter3/kiaLambda33Tgdi';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { ZF_8HP_RATIOS } from '../chapter2/bmw320i2014';
import { modernAcoustic, modernStockExhaust, torqueConverterTransmission } from '../chapter2/shared';

/**
 * Kia Stinger GT 2019, AWD, 8-speed automatic. Auto-Data sheet (European version): 1,858–1,905 kg,
 * wheelbase 2,905 mm, 4,830 × 1,870 × 1,400 mm, 225/40 R19 front and 255/35 R19 rear, 0–100 km/h
 * in 5.5 s, 270 km/h. The Kia brochure of the plan has no extractable text (nothing taken from
 * it). The ratios of the 8-speed and the front/rear split were not found: the ZF 8HP spread, a
 * 3.15 final and a rear-biased 30:70 split with an estimated coupling are used (ESTIMATED).
 */
export const KIA_STINGER_GT_2019_DOC = {
  market: 'EUA',
  modelYear: 2019,
  version: 'Stinger GT 3.3 T-GDI AWD, automático 8',
  sources: ['autodata-stinger-gt-2019', 'literature-hyundai-8at', 'estimate-chapter3-gearing', 'estimate-chapter3-aero'],
  body: 'liftback 5 portas (CK)',
  dimensions: { lengthMm: 4830, widthMm: 1870, heightMm: 1400, wheelbaseMm: 2905, frontOverhangMm: 930 },
  weights: { runningOrderKg: 1860 },
  tyres: '255/35 R19 (traseiros)',
  aero: { cd: 0.3, frontalAreaM2: 2.25 },
  performance: { accel0to100S: 5.5, topSpeedKmh: 270 },
  transmission: { code: 'Hyundai/Kia 8 marchas', kind: 'automático 8 (conversor)', gearRatios: ZF_8HP_RATIOS, finalDrive: 3.15 },
  drive: 'integral (30:70, estimada)',
};

export const CAR_KIA_STINGER_GT_2019: CarConfig = {
  schemaVersion: 1,
  id: 'kia-stinger-gt-2019',
  name: 'Kia Stinger GT 2019 AWD',
  description: 'Lambda II 3.3 V6 biturbo (365 hp, 376 lb-ft de 1.300 a 4.500 rpm), automático de oito marchas e tração integral de base traseira.',
  massKg: KIA_STINGER_GT_2019_DOC.weights.runningOrderKg + 75,
  wheelbaseM: 2.905,
  cgHeightM: 0.54,
  frontWeightFraction: 0.53,
  drivenAxle: 'awd',
  awd: { frontTorqueFraction: 0.3, centerCouplingNm: 900, transferEfficiency: 0.95 },
  dragCoefficient: KIA_STINGER_GT_2019_DOC.aero.cd,
  frontalAreaM2: KIA_STINGER_GT_2019_DOC.aero.frontalAreaM2,
  brakeTorqueNm: 6000,
  engine: ENGINE_KIA_LAMBDA_33,
  transmission: torqueConverterTransmission({
    gearRatios: [...KIA_STINGER_GT_2019_DOC.transmission.gearRatios],
    finalDrive: KIA_STINGER_GT_2019_DOC.transmission.finalDrive,
    efficiency: 0.92,
    elementMaxTorqueNm: 1000,
    converter: { kFactor: 122, stallTorqueRatio: 1.85, couplingSpeedRatio: 0.86, turbineInertiaKgM2: 0.07, lockup: { maxTorqueNm: 750, minGear: 2, engageRatePerS: 6, minTurbineRpm: 1100 } },
    powershift: { torquePhaseS: 0.07, inertiaPhaseMaxS: 0.3, torqueReduction: 0.38, inertiaCapacity: 0.9, downshiftReleaseS: 0.07 },
    autoShift: { wotUpshiftFraction: 0.95, lightUpshiftRpm: 1600, kickdownPedal: 0.92, kickdownRpm: 3500, coastDownshiftRpm: 1050 },
  }),
  tires: { radiusM: rollingRadiusM(255, 35, 19), wheelInertiaKgM2: 1.15, muPeak: 1.12, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.011, optimalTempC: 65, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'dual', headerLengthM: 0.32, headerDiameterMm: 42, collectorDiameterMm: 58, collectorLengthM: 2.1, tailpipeDiameterMm: 60, mufflerAbsorption: 0.58, mufflerChambersM: [0.13, 0.21, 0.3], outputGain: 0.95 }),
  acoustic: modernAcoustic({ intakeGain: 0.6, blockGain: 0.5, exhaustGain: 0.95, turboGain: 0.42, mechanicalNoise: 0.38, transmissionGain: 0.26, gearTeeth: 27 }),
  visual: { bodyStyle: 'kiaStingerGt', color: '#7a1722', accent: '#14161a', lengthM: 4.83, heightM: 1.4, frontOverhangM: 0.93, rideHeightM: 0.13 },
};

export const KIA_STINGER_GT_2019_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'estimated',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@1300': 'secondary',
  'engine.torqueCurve@6000': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'estimated',
  'transmission.gearRatios': 'estimated',
  'transmission.finalDrive': 'estimated',
  'transmission.torqueConverter': 'estimated',
  'transmission.powershift': 'calibrated',
  'awd.frontTorqueFraction': 'estimated',
  'awd.centerCouplingNm': 'estimated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'secondary',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
