import { ENGINE_GM_FAMILIA2_FLEX20 } from '../../engines/chapter2/gmFamilia2Flex20';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { manualTransmission, modernAcoustic, modernStockExhaust } from './shared';

/**
 * Chevrolet Astra Hatchback 2.0 8V Flexpower 2011, Brazil, ethanol, 5-speed manual (F17),
 * front-wheel drive. Owner's manual MY2011, section 12: hatch 4199 mm long, 1453 mm high,
 * 2614 mm wheelbase, 878 mm front overhang; F17 ratios 3.73/1.96/1.32/0.95/0.76, final 3.94;
 * running-order mass 1225 kg (manual gearbox), 757 kg on the front axle.
 */
export const ASTRA_2011_DOC = {
  market: 'Brasil',
  modelYear: 2011,
  version: 'Astra Hatchback 2.0 8V Flexpower, câmbio manual',
  sources: ['gm-astra-2011-manual', 'estimate-chapter2-aero'],
  body: 'hatch 5 portas',
  dimensions: { lengthMm: 4199, widthMm: 1709, heightMm: 1453, wheelbaseMm: 2614, frontOverhangMm: 878 },
  weights: { runningOrderKg: 1225, frontAxleKg: 757 },
  tyres: '195/60 R15',
  aero: { cd: 0.32, frontalAreaM2: 2.06 },
  performance: { accel0to100S: 9.6, topSpeedKmh: 198 },
  transmission: { code: 'F17 Plus WR', kind: 'manual 5', gearRatios: [3.73, 1.96, 1.32, 0.95, 0.76], reverse: 3.31, finalDrive: 3.94 },
  drive: 'dianteira',
};

/** Running order already includes fuel; + 75 kg driver. */
export const ASTRA_2011_MASS = { tareKg: 1225, driverKg: 75, fuelKg: 0 } as const;

export const CAR_GM_ASTRA_2011: CarConfig = {
  schemaVersion: 1,
  id: 'gm-astra-2011',
  name: 'Chevrolet Astra 2.0 Flexpower 2011',
  description: 'Família II 2.0 8V flex no etanol (140 cv, 19,7 kgfm), câmbio manual de cinco marchas e tração dianteira. O aspirado mais simples da liga.',
  massKg: ASTRA_2011_MASS.tareKg + ASTRA_2011_MASS.driverKg + ASTRA_2011_MASS.fuelKg,
  wheelbaseM: 2.614,
  cgHeightM: 0.53,
  frontWeightFraction: 0.62,
  drivenAxle: 'front',
  dragCoefficient: 0.32,
  frontalAreaM2: 2.06,
  brakeTorqueNm: 3300,
  engine: ENGINE_GM_FAMILIA2_FLEX20,
  transmission: manualTransmission({
    gearRatios: [...ASTRA_2011_DOC.transmission.gearRatios],
    finalDrive: ASTRA_2011_DOC.transmission.finalDrive,
    efficiency: 0.91,
    clutchMaxTorqueNm: 300,
    launchRpm: 3300,
    antiStallRpm: 950,
  }),
  tires: { radiusM: rollingRadiusM(195, 60, 15), wheelInertiaKgM2: 0.72, muPeak: 1.04, B: 11.5, C: 1.45, E: 0.38, rollingResistance: 0.012, optimalTempC: 60, tempSensitivityPerC: 0.0016 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.36, headerDiameterMm: 38, collectorDiameterMm: 50, tailpipeDiameterMm: 50, outputGain: 1.05 }),
  acoustic: modernAcoustic({ intakeGain: 0.85, blockGain: 0.62, exhaustGain: 0.92, mechanicalNoise: 0.55, gearTeeth: 19 }),
  visual: { bodyStyle: 'astra11', color: '#5b6066', accent: '#c9ced3', lengthM: 4.199, heightM: 1.453, frontOverhangM: 0.878, rideHeightM: 0.15 },
};

export const ASTRA_2011_PROVENANCE: Record<string, Provenance> = {
  massKg: 'factory',
  wheelbaseM: 'factory',
  frontWeightFraction: 'factory',
  dragCoefficient: 'estimated',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'factory',
  'engine.strokeMm': 'factory',
  'engine.compressionRatio': 'factory',
  'engine.torqueCurve@2600': 'factory',
  'engine.torqueCurve@5600': 'factory',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.revLimitRpm': 'factory',
  'transmission.gearRatios': 'factory',
  'transmission.finalDrive': 'factory',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'estimated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
