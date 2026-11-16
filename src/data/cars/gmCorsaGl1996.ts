import { ENGINE_GM_FAMILIA1_EFI_14_1996 } from '../engines/gmFamilia1Efi14_1996';
import { rollingRadiusM, type Provenance } from '../provenance';
import type { CarConfig } from '../schema';
import { assistedTransmission, periodAcoustic, periodStockExhaust } from './campaignShared';

/**
 * Chevrolet Corsa GL 1.4 (EFI) 1996, petrol, two-door hatch, front-wheel drive with a TRANSVERSE
 * engine (Revista Auto prints "longitudinal", contradicted by Carros na Web and by the layout of
 * the Corsa B platform: recorded as a divergence; the simulation is not affected because the
 * model is longitudinal-only, but the art and the docs show a transverse FWD car).
 *
 * Gear ratios: Corsa Clube table, row "1.0 Wind E / 1.4 GL 1994" (forum, unverified), long
 * overdrive fifth (0.71) and 4.53 final drive. Amantes de Carros lists 4.29 for the 1.4 EFI with
 * the F15 WR box — not used, kept as divergence.
 */
export const CORSA_GL_1996_DOC = {
  sources: ['revistaauto-corsa-1996', 'carrosnaweb-corsa-1996', 'corsaclube-relacoes'],
  body: 'hatch 2 portas',
  dimensions: { lengthMm: 3729, widthMm: 1608, heightMm: 1388, wheelbaseMm: 2443, trackFrontMm: 1387, trackRearMm: 1388 },
  weights: { tareKg: 865, payloadKg: 470 },
  tyres: '145/80 R13',
  aero: { cd: 0.35, frontalAreaM2: 1.88 },
  performance: { accel0to100S: 15.5, topSpeedKmh: 154 },
  transmission: { code: 'F13', gearRatios: [3.55, 1.96, 1.3, 0.89, 0.71], reverse: 3.31, finalDrive: 4.53, altFinalDrive: 4.29 },
  drive: 'dianteira, motor TRANSVERSAL',
};

export const CORSA_GL_1996_MASS = { tareKg: 865, driverKg: 75, fuelKg: 17 } as const;

export const CAR_GM_CORSA_GL_1996: CarConfig = {
  schemaVersion: 1,
  id: 'gm-corsa-gl-1996',
  name: 'Chevrolet Corsa GL 1.4 1996',
  description: 'Família I 1.4 EFI (60 cv, 11,1 kgfm a 2800 rpm): torque cedo, quinta longa, tração dianteira.',
  massKg: CORSA_GL_1996_MASS.tareKg + CORSA_GL_1996_MASS.driverKg + CORSA_GL_1996_MASS.fuelKg,
  wheelbaseM: 2.443,
  cgHeightM: 0.52,
  frontWeightFraction: 0.62,
  drivenAxle: 'front',
  dragCoefficient: 0.35,
  frontalAreaM2: 1.88,
  brakeTorqueNm: 2400,
  engine: ENGINE_GM_FAMILIA1_EFI_14_1996,
  transmission: assistedTransmission({
    gearRatios: [...CORSA_GL_1996_DOC.transmission.gearRatios],
    finalDrive: CORSA_GL_1996_DOC.transmission.finalDrive,
    efficiency: 0.9, // calibrated
    clutchMaxTorqueNm: 175,
    launchRpm: 3300,
    antiStallRpm: 950,
    inputInertiaKgM2: 0.006,
    outputInertiaKgM2: 0.009,
  }),
  tires: {
    radiusM: rollingRadiusM(145, 80, 13),
    wheelInertiaKgM2: 0.48,
    muPeak: 1.0,
    B: 12,
    C: 1.45,
    E: 0.4,
    rollingResistance: 0.013,
    optimalTempC: 60,
    tempSensitivityPerC: 0.0018,
  },
  exhaust: periodStockExhaust(0.36, 34, { tailpipeDiameterMm: 45, mufflerAbsorption: 0.66, outputGain: 0.8 }),
  acoustic: periodAcoustic({ intakeGain: 0.65, blockGain: 0.6, mechanicalNoise: 0.5, gearTeeth: 19 }),
  visual: {
    bodyStyle: 'corsaGl96',
    color: '#1d4f91',
    accent: '#2a2d31',
    lengthM: 3.729,
    heightM: 1.388,
    frontOverhangM: 0.7,
    rideHeightM: 0.145,
  },
};

export const CORSA_GL_1996_PROVENANCE: Record<string, Provenance> = {
  massKg: 'derived',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'secondary',
  'engine.torqueCurve@2800': 'secondary',
  'engine.torqueCurve@5200': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'secondary',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
