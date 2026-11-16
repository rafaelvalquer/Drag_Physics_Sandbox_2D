import { ENGINE_GM_FAMILIA2_18_1992 } from '../engines/gmFamilia2_18_1992';
import { rollingRadiusM, type Provenance } from '../provenance';
import type { CarConfig } from '../schema';
import { assistedTransmission, periodAcoustic, periodStockExhaust } from './campaignShared';

/**
 * Chevrolet Kadett SL 1.8 1992, petrol, two-door hatch, front-wheel drive, transverse engine.
 * The gear ratios of the SL 1.8 1992 were not found; the F16 set published for the Kadett GS 1990
 * (Quatro Rodas, quoted on a forum) is used and flagged as "other version": the top speed of the
 * SL (167 km/h) validates the overall gearing.
 */
export const KADETT_SL_1992_DOC = {
  sources: ['revistaauto-kadett-1992', 'fichacompleta-kadett-1992', 'quatrorodas-kadett-gs'],
  body: 'hatch 2 portas',
  dimensions: { lengthMm: 3998, widthMm: 1663, heightMm: 1390, wheelbaseMm: 2520 },
  weights: { tareKg: 1010 },
  tyres: '165/70 R13',
  aero: { cd: 0.32, frontalAreaM2: 1.96 },
  performance: { accel0to100S: 12.3, topSpeedKmh: 167 },
  transmission: { code: 'F16', gearRatios: [3.55, 2.16, 1.48, 1.12, 0.89], reverse: 3.33, finalDrive: 3.72 },
  drive: 'dianteira, motor transversal',
};

export const KADETT_SL_1992_MASS = { tareKg: 1010, driverKg: 75, fuelKg: 18 } as const;

export const CAR_GM_KADETT_SL_1992: CarConfig = {
  schemaVersion: 1,
  id: 'gm-kadett-sl-1992',
  name: 'Chevrolet Kadett SL 1.8 1992',
  description: 'Família II 1.8 a gasolina com carburador de corpo duplo (98 cv, 14,6 kgfm). Hatch aerodinâmico (Cx 0,32) e tração dianteira.',
  massKg: KADETT_SL_1992_MASS.tareKg + KADETT_SL_1992_MASS.driverKg + KADETT_SL_1992_MASS.fuelKg,
  wheelbaseM: 2.52,
  cgHeightM: 0.52,
  frontWeightFraction: 0.62,
  drivenAxle: 'front',
  dragCoefficient: 0.32,
  frontalAreaM2: 1.96,
  brakeTorqueNm: 2900,
  engine: ENGINE_GM_FAMILIA2_18_1992,
  transmission: assistedTransmission({
    gearRatios: [...KADETT_SL_1992_DOC.transmission.gearRatios],
    finalDrive: KADETT_SL_1992_DOC.transmission.finalDrive,
    efficiency: 0.9, // calibrated
    clutchMaxTorqueNm: 230,
    launchRpm: 3400,
    antiStallRpm: 1000,
  }),
  tires: {
    radiusM: rollingRadiusM(165, 70, 13),
    wheelInertiaKgM2: 0.52,
    muPeak: 1.02,
    B: 12,
    C: 1.45,
    E: 0.4,
    rollingResistance: 0.013,
    optimalTempC: 62,
    tempSensitivityPerC: 0.0018,
  },
  exhaust: periodStockExhaust(0.34, 36, { tailpipeDiameterMm: 48, outputGain: 0.8 }),
  acoustic: periodAcoustic({ intakeGain: 0.8, blockGain: 0.62, mechanicalNoise: 0.55, gearTeeth: 18 }),
  visual: {
    bodyStyle: 'kadettSl92',
    color: '#1f2a33',
    accent: '#9aa3ab',
    lengthM: 3.998,
    heightM: 1.39,
    frontOverhangM: 0.82,
    rideHeightM: 0.14,
  },
};

export const KADETT_SL_1992_PROVENANCE: Record<string, Provenance> = {
  massKg: 'derived',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'secondary',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@3600': 'secondary',
  'engine.torqueCurve@5800': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'secondary',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
