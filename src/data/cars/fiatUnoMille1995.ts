import { ENGINE_FIAT_FIASA_10_1995 } from '../engines/fiatFiasa10_1995';
import { rollingRadiusM, type Provenance } from '../provenance';
import type { CarConfig } from '../schema';
import { assistedTransmission, periodAcoustic, periodStockExhaust } from './campaignShared';

/**
 * Fiat Uno Mille Electronic 1.0, model year 1995, petrol, two-door hatch, front-wheel drive with a
 * transverse engine. Original factory spec.
 *
 * Divergences investigated (sources in campaignSources.ts):
 *  - body: guiacarros does not identify the doors; fichacompleta's sheet is the 4-door. The game
 *    uses the 2-door ("Mille" base body) and the guiacarros mass of 830 kg (4-door: 860 kg).
 *  - tyres: 145/80 R13 (guiacarros) vs 165/70 R13 (fichacompleta, 4-door). 145/80 R13 used.
 *  - top speed: 144 km/h (guiacarros) vs 149 km/h (fichacompleta). The 4-door figure belongs to
 *    the other body; 144 km/h is the target, the tolerance covers both.
 *  - fuel: petrol in both sheets (the 1.0 Electronic was not sold on ethanol in 1995 per sources).
 */
export const UNO_MILLE_1995_DOC = {
  sources: ['guiacarros-uno-1995', 'fichacompleta-uno-1995', 'oficinabrasil-uno-elx', 'vrum-uno-fire'],
  body: 'hatch 2 portas, 5 lugares',
  dimensions: { lengthMm: 3644, widthMm: 1548, heightMm: 1445, wheelbaseMm: 2361, trackFrontMm: 1337, trackRearMm: 1362 },
  weights: { tareKg: 830, tareKg4Door: 860, payloadKg: 400 },
  tyres: '145/80 R13',
  aero: { cd: 0.36, frontalAreaM2: 1.9 },
  performance: { accel0to100S: 18.2, topSpeedKmh: 144, topSpeedKmhAlt: 149 },
  transmission: {
    code: 'C506',
    gearRatios: [3.909, 2.238, 1.52, 1.156, 0.959],
    finalDrive: 4.071,
    note:
      '5ª = 0,959 (Oficina Brasil, Electronic). 1ª–4ª e diferencial: valores da família C506 Fiasa citados em literatura de reparação, NÃO confirmados por manual — marcados como estimados; validados pela velocidade máxima.',
  },
  drive: 'dianteira, motor transversal',
} as const;

export const UNO_MILLE_1995_MASS = { tareKg: 830, driverKg: 75, fuelKg: 18 } as const;
export const UNO_MILLE_1995_RADIUS_M = rollingRadiusM(145, 80, 13);

export const CAR_FIAT_UNO_MILLE_1995: CarConfig = {
  schemaVersion: 1,
  id: 'fiat-uno-mille-1995',
  name: 'Fiat Uno Mille Electronic 1.0 1995',
  description: 'Fiasa 1.0 a gasolina (56 cv, 8,2 kgfm), 5 marchas, tração dianteira. Leve, curto e valente — o menor motor do grid.',
  massKg: UNO_MILLE_1995_MASS.tareKg + UNO_MILLE_1995_MASS.driverKg + UNO_MILLE_1995_MASS.fuelKg,
  wheelbaseM: 2.361,
  cgHeightM: 0.52,
  frontWeightFraction: 0.62,
  drivenAxle: 'front',
  dragCoefficient: 0.36,
  frontalAreaM2: 1.9,
  brakeTorqueNm: 2200,
  engine: ENGINE_FIAT_FIASA_10_1995,
  transmission: assistedTransmission({
    gearRatios: [...UNO_MILLE_1995_DOC.transmission.gearRatios],
    finalDrive: UNO_MILLE_1995_DOC.transmission.finalDrive,
    efficiency: 0.9, // calibrated: period transaxle + CV joints at full load
    clutchMaxTorqueNm: 135,
    launchRpm: 3800,
    antiStallRpm: 950,
    inputInertiaKgM2: 0.005,
    outputInertiaKgM2: 0.008,
  }),
  tires: {
    radiusM: UNO_MILLE_1995_RADIUS_M,
    wheelInertiaKgM2: 0.48, // estimated: 13" steel wheel + narrow tyre
    muPeak: 1.0, // calibrated: narrow period radial
    B: 12,
    C: 1.45,
    E: 0.4,
    rollingResistance: 0.013, // estimated: narrow period radial (grows with speed; constant in the model)
    optimalTempC: 60,
    tempSensitivityPerC: 0.0018,
  },
  exhaust: periodStockExhaust(0.28, 30, { tailpipeDiameterMm: 42, outputGain: 0.85 }),
  acoustic: periodAcoustic({ exhaustGain: 1.06, intakeGain: 0.8, blockGain: 0.66, mechanicalNoise: 0.8, gearTeeth: 15 }),
  visual: {
    bodyStyle: 'unoMille95',
    color: '#c8ccd0',
    accent: '#2f3236',
    lengthM: 3.644,
    heightM: 1.445,
    frontOverhangM: 0.7, // estimated from photographs
    rideHeightM: 0.14,
  },
};

export const UNO_MILLE_1995_PROVENANCE: Record<string, Provenance> = {
  massKg: 'derived',
  wheelbaseM: 'secondary',
  'visual.lengthM': 'secondary',
  'visual.heightM': 'secondary',
  cgHeightM: 'estimated',
  frontWeightFraction: 'estimated',
  drivenAxle: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'secondary',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.compressionRatio': 'secondary',
  'engine.torqueCurve@3250': 'secondary',
  'engine.torqueCurve@6000': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.redlineRpm': 'estimated',
  'engine.revLimitRpm': 'estimated',
  'engine.cam': 'estimated',
  'engine.intake': 'estimated',
  'engine.breathing': 'estimated',
  'transmission.gearRatios[4]': 'secondary',
  'transmission.gearRatios[0..3]': 'estimated',
  'transmission.finalDrive': 'estimated',
  'transmission.efficiency': 'calibrated',
  'transmission.clutch.maxTorqueNm': 'estimated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
