import { ENGINE_TOYOTA_2GR_FSE } from '../../engines/chapter3/toyota2grFse';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { ZF_8HP_RATIOS } from '../chapter2/bmw320i2014';
import { modernAcoustic, modernStockExhaust, torqueConverterTransmission } from '../chapter2/shared';

/**
 * Lexus IS 350 F Sport 2015, rear drive, 8-speed automatic. Lexus release 2015: 3.5 V6, 306 hp,
 * 277 lb-ft, 8-speed SPDS automatic, 18" wheels on the F Sport. Auto-Data sheet (European
 * version, XE30): 1,630 kg, wheelbase 2,800 mm, 4,665 × 1,810 × 1,430 mm, Cd 0.28, 0–60 mph in
 * 5.6 s. The ratios of the Aisin 8-speed were not found: the ZF 8HP spread is used as an
 * approximation (ESTIMATED), and so is the 3.27 final drive.
 */
export const LEXUS_IS350_2015_DOC = {
  market: 'EUA',
  modelYear: 2015,
  version: 'IS 350 F Sport 3.5 V6 RWD, automático 8',
  sources: ['lexus-is-2015-pressroom', 'autodata-lexus-is350-2015', 'literature-lexus-aisin-8', 'estimate-chapter3-gearing'],
  body: 'sedã 4 portas (XE30)',
  dimensions: { lengthMm: 4665, widthMm: 1810, heightMm: 1430, wheelbaseMm: 2800, frontOverhangMm: 900 },
  weights: { runningOrderKg: 1630 },
  tyres: '255/35 R18 (traseiros)',
  aero: { cd: 0.28, frontalAreaM2: 2.17 },
  performance: { accel0to100S: 5.8, topSpeedKmh: 230, topSpeedLimited: true },
  transmission: { code: 'Aisin 8 marchas (SPDS)', kind: 'automático 8 (conversor)', gearRatios: ZF_8HP_RATIOS, finalDrive: 3.27 },
  drive: 'traseira',
};

export const CAR_LEXUS_IS350_2015: CarConfig = {
  schemaVersion: 1,
  id: 'lexus-is350-2015',
  name: 'Lexus IS 350 F Sport 2015',
  description: '2GR-FSE 3.5 V6 aspirado de funcionamento refinado (306 hp, 277 lb-ft), automático de oito marchas e tração traseira.',
  massKg: LEXUS_IS350_2015_DOC.weights.runningOrderKg + 75,
  wheelbaseM: 2.8,
  cgHeightM: 0.52,
  frontWeightFraction: 0.52,
  drivenAxle: 'rear',
  dragCoefficient: LEXUS_IS350_2015_DOC.aero.cd,
  frontalAreaM2: LEXUS_IS350_2015_DOC.aero.frontalAreaM2,
  brakeTorqueNm: 5200,
  engine: ENGINE_TOYOTA_2GR_FSE,
  transmission: torqueConverterTransmission({
    gearRatios: [...LEXUS_IS350_2015_DOC.transmission.gearRatios],
    finalDrive: LEXUS_IS350_2015_DOC.transmission.finalDrive,
    efficiency: 0.92,
    elementMaxTorqueNm: 700,
    converter: { kFactor: 110, stallTorqueRatio: 1.8, couplingSpeedRatio: 0.86, turbineInertiaKgM2: 0.06, lockup: { maxTorqueNm: 520, minGear: 3, engageRatePerS: 5, minTurbineRpm: 1100 } },
    powershift: { torquePhaseS: 0.08, inertiaPhaseMaxS: 0.32, torqueReduction: 0.35, inertiaCapacity: 0.9, downshiftReleaseS: 0.08 },
    autoShift: { wotUpshiftFraction: 0.95, lightUpshiftRpm: 1600, kickdownPedal: 0.92, kickdownRpm: 3600, coastDownshiftRpm: 1050 },
  }),
  tires: { radiusM: rollingRadiusM(255, 35, 18), wheelInertiaKgM2: 1.05, muPeak: 1.1, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.011, optimalTempC: 65, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'dual', headerLengthM: 0.4, headerDiameterMm: 38, collectorDiameterMm: 56, collectorLengthM: 1.9, tailpipeDiameterMm: 55, mufflerAbsorption: 0.7, mufflerChambersM: [0.14, 0.22, 0.3, 0.36], outputGain: 0.85 }),
  acoustic: modernAcoustic({ intakeGain: 0.7, blockGain: 0.45, exhaustGain: 0.8, turboGain: 0, mechanicalNoise: 0.32, transmissionGain: 0.22, gearTeeth: 27 }),
  visual: { bodyStyle: 'lexusIs350', color: '#d8dadd', accent: '#2a2f36', lengthM: 4.665, heightM: 1.43, frontOverhangM: 0.9, rideHeightM: 0.12 },
};

export const LEXUS_IS350_2015_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@4800': 'secondary',
  'engine.torqueCurve@6400': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'transmission.gearRatios': 'estimated',
  'transmission.finalDrive': 'estimated',
  'transmission.torqueConverter': 'estimated',
  'transmission.powershift': 'calibrated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'estimated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
