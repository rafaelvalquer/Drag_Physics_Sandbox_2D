import { ENGINE_MASERATI_F160 } from '../../engines/chapter3/maseratiF160';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { ZF_8HP_RATIOS } from '../chapter2/bmw320i2014';
import { modernAcoustic, modernStockExhaust, torqueConverterTransmission } from '../chapter2/shared';

/**
 * Maserati Ghibli S Q4 2015, AWD, ZF 8-speed automatic. Kelley Blue Book: 404 hp, 406 lb-ft.
 * Auto-Data sheet: 1,870 kg (4,123 lb), wheelbase 2,998 mm, 4,971 × 1,945 × 1,461 mm,
 * 235/50 R18 front and 275/45 R18 rear, 0–100 km/h in 4.8 s, 284 km/h; no Cd (0.29 estimated).
 * The 8HP ratios are the ZF family ones; the final (3.2) and the Q4 coupling (rear-biased 30:70,
 * the system can send up to half of the torque forward) are ESTIMATED.
 */
export const MASERATI_GHIBLI_SQ4_2015_DOC = {
  market: 'EUA',
  modelYear: 2015,
  version: 'Ghibli S Q4 3.0 V6 biturbo, automático 8',
  sources: ['kbb-ghibli-2015', 'autodata-ghibli-s-q4', 'literature-maserati-q4', 'literature-zf-8hp', 'estimate-chapter3-gearing', 'estimate-chapter3-aero'],
  body: 'sedã 4 portas (M157)',
  dimensions: { lengthMm: 4971, widthMm: 1945, heightMm: 1461, wheelbaseMm: 2998, frontOverhangMm: 930 },
  weights: { runningOrderKg: 1870 },
  tyres: '275/45 R18 (traseiros)',
  aero: { cd: 0.29, frontalAreaM2: 2.35 },
  performance: { accel0to100S: 4.8, topSpeedKmh: 284 },
  transmission: { code: 'ZF 8HP70', kind: 'automático 8 (conversor)', gearRatios: ZF_8HP_RATIOS, finalDrive: 3.2 },
  drive: 'integral (Q4, base traseira)',
};

export const CAR_MASERATI_GHIBLI_SQ4_2015: CarConfig = {
  schemaVersion: 1,
  id: 'maserati-ghibli-sq4-2015',
  name: 'Maserati Ghibli S Q4 2015',
  description: 'F160 3.0 V6 biturbo (404 hp, 406 lb-ft), ZF de oito marchas e tração integral Q4, o mais pesado do capítulo.',
  massKg: MASERATI_GHIBLI_SQ4_2015_DOC.weights.runningOrderKg + 75,
  wheelbaseM: 2.998,
  cgHeightM: 0.54,
  frontWeightFraction: 0.5,
  drivenAxle: 'awd',
  awd: { frontTorqueFraction: 0.3, centerCouplingNm: 1000, transferEfficiency: 0.95 },
  dragCoefficient: MASERATI_GHIBLI_SQ4_2015_DOC.aero.cd,
  frontalAreaM2: MASERATI_GHIBLI_SQ4_2015_DOC.aero.frontalAreaM2,
  brakeTorqueNm: 6200,
  engine: ENGINE_MASERATI_F160,
  transmission: torqueConverterTransmission({
    gearRatios: [...MASERATI_GHIBLI_SQ4_2015_DOC.transmission.gearRatios],
    finalDrive: MASERATI_GHIBLI_SQ4_2015_DOC.transmission.finalDrive,
    efficiency: 0.92,
    elementMaxTorqueNm: 1050,
    converter: { kFactor: 120, stallTorqueRatio: 1.9, couplingSpeedRatio: 0.86, turbineInertiaKgM2: 0.07, lockup: { maxTorqueNm: 800, minGear: 2, engageRatePerS: 6, minTurbineRpm: 1100 } },
    powershift: { torquePhaseS: 0.07, inertiaPhaseMaxS: 0.3, torqueReduction: 0.38, inertiaCapacity: 0.9, downshiftReleaseS: 0.07 },
    autoShift: { wotUpshiftFraction: 0.95, lightUpshiftRpm: 1500, kickdownPedal: 0.92, kickdownRpm: 3500, coastDownshiftRpm: 1000 },
  }),
  tires: { radiusM: rollingRadiusM(275, 45, 18), wheelInertiaKgM2: 1.2, muPeak: 1.1, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.011, optimalTempC: 65, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'dual', headerLengthM: 0.3, headerDiameterMm: 44, collectorDiameterMm: 56, collectorLengthM: 2.4, tailpipeDiameterMm: 55, mufflerAbsorption: 0.45, mufflerChambersM: [0.14, 0.22, 0.32], outputGain: 1.05 }),
  acoustic: modernAcoustic({ intakeGain: 0.55, blockGain: 0.48, exhaustGain: 1.05, turboGain: 0.4, mechanicalNoise: 0.34, transmissionGain: 0.24, gearTeeth: 28 }),
  visual: { bodyStyle: 'maseratiGhibli', color: '#232b3b', accent: '#c9a24a', lengthM: 4.971, heightM: 1.461, frontOverhangM: 0.93, rideHeightM: 0.13 },
};

export const MASERATI_GHIBLI_SQ4_2015_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'estimated',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@4500': 'secondary',
  'engine.torqueCurve@5500': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'estimated',
  'transmission.gearRatios': 'secondary',
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
