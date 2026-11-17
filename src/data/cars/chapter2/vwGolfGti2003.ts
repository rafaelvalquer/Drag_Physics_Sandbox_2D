import { ENGINE_VW_EA113_18T_GOLF } from '../../engines/chapter2/vwEa11318T';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { manualTransmission, modernAcoustic, modernStockExhaust } from './shared';

/**
 * Volkswagen Golf GTI Mk4 (A4/1J) 1.8T 20V 180 cv 2003, Brazil, gasoline, five-door hatch,
 * manual gearbox, front-wheel drive. Mk4 body (not Mk5/Mk7). Gearbox: VW 02J five-speed family
 * (ratios from the 02J literature, flagged as estimated for this exact version).
 */
export const GOLF_GTI_2003_DOC = {
  market: 'Brasil',
  modelYear: 2003,
  version: 'Golf GTI 1.8 20V Turbo 180 cv, 4 portas, manual',
  sources: ['olhonocarro-golf-gti-2003', 'literature-vw-02j', 'estimate-chapter2-aero'],
  body: 'hatch 5 portas (Mk4)',
  dimensions: { lengthMm: 4149, widthMm: 1735, heightMm: 1444, wheelbaseMm: 2511, frontOverhangMm: 870 },
  weights: { runningOrderKg: 1265 },
  tyres: '205/55 R16',
  aero: { cd: 0.32, frontalAreaM2: 2.11 },
  performance: { accel0to100S: 7.9, topSpeedKmh: 222 },
  transmission: { code: 'VW 02J', kind: 'manual 5', gearRatios: [3.3, 1.944, 1.308, 1.034, 0.838], finalDrive: 3.94 },
  drive: 'dianteira',
};

export const GOLF_GTI_2003_MASS = { tareKg: 1265, driverKg: 75, fuelKg: 0 } as const;

export const CAR_VW_GOLF_GTI_2003: CarConfig = {
  schemaVersion: 1,
  id: 'vw-golf-gti-mk4-2003',
  name: 'Volkswagen Golf GTI 1.8T 2003',
  description: 'EA113 1.8 20V turbo de cinco válvulas por cilindro (180 cv, 235 N·m de 1950 a 5000 rpm), manual e tração dianteira. A carroceria Mk4.',
  massKg: GOLF_GTI_2003_MASS.tareKg + GOLF_GTI_2003_MASS.driverKg + GOLF_GTI_2003_MASS.fuelKg,
  wheelbaseM: 2.511,
  cgHeightM: 0.53,
  frontWeightFraction: 0.62,
  drivenAxle: 'front',
  dragCoefficient: 0.32,
  frontalAreaM2: 2.11,
  brakeTorqueNm: 3700,
  engine: ENGINE_VW_EA113_18T_GOLF,
  transmission: manualTransmission({
    gearRatios: [...GOLF_GTI_2003_DOC.transmission.gearRatios],
    finalDrive: GOLF_GTI_2003_DOC.transmission.finalDrive,
    efficiency: 0.91,
    clutchMaxTorqueNm: 340,
    launchRpm: 3300,
    antiStallRpm: 950,
  }),
  tires: { radiusM: rollingRadiusM(205, 55, 16), wheelInertiaKgM2: 0.82, muPeak: 1.06, B: 11.5, C: 1.47, E: 0.36, rollingResistance: 0.012, optimalTempC: 62, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.24, headerDiameterMm: 38, collectorDiameterMm: 57, tailpipeDiameterMm: 63, outputGain: 1.05, mufflerAbsorption: 0.56 }),
  acoustic: modernAcoustic({ intakeGain: 0.78, blockGain: 0.56, exhaustGain: 0.95, turboGain: 0.62, mechanicalNoise: 0.5, gearTeeth: 20 }),
  visual: { bodyStyle: 'golfGtiMk4', color: '#2b2f36', accent: '#c41e24', lengthM: 4.149, heightM: 1.444, frontOverhangM: 0.87, rideHeightM: 0.13 },
};

export const GOLF_GTI_2003_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@1950': 'secondary',
  'engine.torqueCurve@5500': 'secondary',
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
