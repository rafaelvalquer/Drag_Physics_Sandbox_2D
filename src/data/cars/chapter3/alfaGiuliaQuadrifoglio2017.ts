import { ENGINE_ALFA_690T } from '../../engines/chapter3/alfa690t';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { ZF_8HP_RATIOS } from '../chapter2/bmw320i2014';
import { modernAcoustic, modernStockExhaust, torqueConverterTransmission } from '../chapter2/shared';

/**
 * Alfa Romeo Giulia Quadrifoglio 2017, rear drive, ZF 8-speed automatic. Fiat/Alfa specification
 * sheet (preliminary, European pre-production car with the Getrag manual): 505 hp, 443 lb-ft,
 * 1,524 kg, wheelbase 2,820 mm, 4,639 × 1,873 × 1,426 mm, Cd 0.32, 245/35 R19 front and
 * 285/30 R19 rear Pirelli P Zero Corsa, 0–60 mph in 3.8 s. The car of the game is the automatic:
 * mass 1,580 kg from a single unverified listing, ZF 8HP ratios and the 3.154 final estimated.
 */
export const ALFA_GIULIA_QV_2017_DOC = {
  market: 'EUA',
  modelYear: 2017,
  version: 'Giulia Quadrifoglio 2.9 V6 biturbo, automático 8',
  sources: ['alfa-giulia-qv-2017-specs', 'autodata-giulia-qv-2017', 'wikipedia-alfa-690t', 'literature-zf-8hp', 'estimate-chapter3-gearing'],
  body: 'sedã 4 portas (952)',
  dimensions: { lengthMm: 4639, widthMm: 1873, heightMm: 1426, wheelbaseMm: 2820, frontOverhangMm: 850 },
  weights: { runningOrderKg: 1580 },
  tyres: '285/30 R19 (traseiros)',
  aero: { cd: 0.32, frontalAreaM2: 2.15 },
  performance: { accel0to100S: 3.9, topSpeedKmh: 307 },
  transmission: { code: 'ZF 8HP75', kind: 'automático 8 (conversor)', gearRatios: ZF_8HP_RATIOS, finalDrive: 3.154 },
  drive: 'traseira',
};

export const CAR_ALFA_GIULIA_QV_2017: CarConfig = {
  schemaVersion: 1,
  id: 'alfa-giulia-qv-2017',
  name: 'Alfa Romeo Giulia Quadrifoglio 2017',
  description: '690T 2.9 V6 de 90° biturbo (505 hp, 443 lb-ft), disparo irregular 90°/150°, ZF de oito marchas e tração traseira.',
  massKg: ALFA_GIULIA_QV_2017_DOC.weights.runningOrderKg + 75,
  wheelbaseM: 2.82,
  cgHeightM: 0.5,
  frontWeightFraction: 0.5,
  drivenAxle: 'rear',
  dragCoefficient: ALFA_GIULIA_QV_2017_DOC.aero.cd,
  frontalAreaM2: ALFA_GIULIA_QV_2017_DOC.aero.frontalAreaM2,
  brakeTorqueNm: 6400,
  engine: ENGINE_ALFA_690T,
  transmission: torqueConverterTransmission({
    gearRatios: [...ALFA_GIULIA_QV_2017_DOC.transmission.gearRatios],
    finalDrive: ALFA_GIULIA_QV_2017_DOC.transmission.finalDrive,
    efficiency: 0.92,
    elementMaxTorqueNm: 1100,
    converter: { kFactor: 115, stallTorqueRatio: 1.9, couplingSpeedRatio: 0.86, turbineInertiaKgM2: 0.07, lockup: { maxTorqueNm: 860, minGear: 2, engageRatePerS: 7, minTurbineRpm: 1100 } },
    powershift: { torquePhaseS: 0.05, inertiaPhaseMaxS: 0.22, torqueReduction: 0.42, inertiaCapacity: 0.9, downshiftReleaseS: 0.05 },
    autoShift: { wotUpshiftFraction: 0.96, lightUpshiftRpm: 1500, kickdownPedal: 0.9, kickdownRpm: 3500, coastDownshiftRpm: 1000 },
  }),
  tires: { radiusM: rollingRadiusM(285, 30, 19), wheelInertiaKgM2: 1.25, muPeak: 1.35, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.012, optimalTempC: 70, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'dual', headerLengthM: 0.28, headerDiameterMm: 46, collectorDiameterMm: 62, collectorLengthM: 1.7, tailpipeDiameterMm: 62, mufflerAbsorption: 0.4, mufflerChambersM: [0.12, 0.2, 0.28], outputGain: 1.1 }),
  acoustic: modernAcoustic({ intakeGain: 0.6, blockGain: 0.5, exhaustGain: 1.1, turboGain: 0.42, mechanicalNoise: 0.38, transmissionGain: 0.26, gearTeeth: 28 }),
  visual: { bodyStyle: 'alfaGiuliaQv', color: '#b01212', accent: '#101214', lengthM: 4.639, heightM: 1.426, frontOverhangM: 0.85, rideHeightM: 0.12 },
};

export const ALFA_GIULIA_QV_2017_PROVENANCE: Record<string, Provenance> = {
  massKg: 'estimated',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@2500': 'secondary',
  'engine.torqueCurve@6500': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'estimated',
  'engine.firingAnglesDeg': 'secondary',
  'transmission.gearRatios': 'estimated',
  'transmission.finalDrive': 'estimated',
  'transmission.torqueConverter': 'estimated',
  'transmission.powershift': 'calibrated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'secondary',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
