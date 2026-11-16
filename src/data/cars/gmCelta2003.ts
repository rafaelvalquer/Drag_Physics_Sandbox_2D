import { ENGINE_GM_FAMILIA1_VHC_10_2003 } from '../engines/gmFamilia1Vhc10_2003';
import { rollingRadiusM, type Provenance } from '../provenance';
import type { CarConfig } from '../schema';
import { assistedTransmission, periodAcoustic, periodStockExhaust } from './campaignShared';

/**
 * Chevrolet Celta 1.0 (VHC) 2003, petrol, two-door hatch, front-wheel drive, transverse engine.
 * Gear ratios and final drive: VRUM sheet of the same model year (4.87 final drive; the 3.94 that
 * appears in the 2004 owner's manual belongs to the 1.4 column). Drag coefficient not published
 * in the consulted sheets: estimated.
 */
export const CELTA_2003_DOC = {
  sources: ['revistaauto-celta-2003', 'vrum-celta-2003'],
  body: 'hatch 2 portas',
  dimensions: { lengthMm: 3748, widthMm: 1608, heightMm: 1429, wheelbaseMm: 2443 },
  weights: { tareKg: 864 },
  tyres: '165/70 R13',
  aero: { cd: null as number | null, frontalAreaM2: null as number | null },
  performance: { accel0to100S: 13.1, topSpeedKmh: 155 },
  transmission: { gearRatios: [4.27, 2.35, 1.48, 1.05, 0.8], reverse: 3.31, finalDrive: 4.87 },
  drive: 'dianteira, motor transversal',
};

export const CELTA_2003_MASS = { tareKg: 864, driverKg: 75, fuelKg: 20 } as const;

export const CAR_GM_CELTA_2003: CarConfig = {
  schemaVersion: 1,
  id: 'gm-celta-2003',
  name: 'Chevrolet Celta 1.0 2003',
  description: 'Família I 1.0 VHC com injeção multiponto (70 cv a 6400 rpm), câmbio curto e tração dianteira. Gira alto e sai esperto.',
  massKg: CELTA_2003_MASS.tareKg + CELTA_2003_MASS.driverKg + CELTA_2003_MASS.fuelKg,
  wheelbaseM: 2.443,
  cgHeightM: 0.53,
  frontWeightFraction: 0.62,
  drivenAxle: 'front',
  dragCoefficient: 0.37, // estimated (not in the sheets): tall 2000s hatch with roof rails absent
  frontalAreaM2: 1.98, // estimated from width × height × 0.86
  brakeTorqueNm: 2400,
  engine: ENGINE_GM_FAMILIA1_VHC_10_2003,
  transmission: assistedTransmission({
    gearRatios: [...CELTA_2003_DOC.transmission.gearRatios],
    finalDrive: CELTA_2003_DOC.transmission.finalDrive,
    efficiency: 0.9, // calibrated
    clutchMaxTorqueNm: 145,
    launchRpm: 4000,
    antiStallRpm: 950,
    inputInertiaKgM2: 0.005,
    outputInertiaKgM2: 0.008,
  }),
  tires: {
    radiusM: rollingRadiusM(165, 70, 13),
    wheelInertiaKgM2: 0.5,
    muPeak: 1.02,
    B: 12,
    C: 1.45,
    E: 0.4,
    rollingResistance: 0.011,
    optimalTempC: 60,
    tempSensitivityPerC: 0.0018,
  },
  exhaust: periodStockExhaust(0.34, 32, { tailpipeDiameterMm: 44, mufflerAbsorption: 0.66, outputGain: 0.78 }),
  acoustic: periodAcoustic({ intakeGain: 0.7, blockGain: 0.58, mechanicalNoise: 0.5, gearTeeth: 19 }),
  visual: {
    bodyStyle: 'celta03',
    color: '#c21d24',
    accent: '#26292d',
    lengthM: 3.748,
    heightM: 1.429,
    frontOverhangM: 0.72,
    rideHeightM: 0.15,
  },
};

export const CELTA_2003_PROVENANCE: Record<string, Provenance> = {
  massKg: 'derived',
  wheelbaseM: 'secondary',
  dragCoefficient: 'estimated',
  frontalAreaM2: 'estimated',
  'engine.torqueCurve@3000': 'secondary',
  'engine.torqueCurve@6400': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.revLimitRpm': 'estimated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'secondary',
  'transmission.efficiency': 'calibrated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
