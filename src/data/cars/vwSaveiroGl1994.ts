import { ENGINE_VW_AP1800_GAS_1994 } from '../engines/vwAp1800Gasoline1994';
import { rollingRadiusM, type Provenance } from '../provenance';
import type { CarConfig } from '../schema';
import { assistedTransmission, periodAcoustic, periodStockExhaust } from './campaignShared';

/**
 * Volkswagen Saveiro GL 1.8 1994 — first-generation PICKUP (cab + open load bed) on the Gol "BX"
 * platform, AP-1800 on petrol, front-wheel drive, longitudinal engine. Factory configuration:
 * this module is the ORIGINAL, naturally aspirated pickup (88 cv). The turbo build of the rival
 * Marcos is assembled by the career build resolver from parts and is never presented as original.
 *
 * Gearing: AP 1800 box published for the Saveiro G3 (Volkspage); assumed for 1994 (unverified).
 * The high drag coefficient (0.52) of the sheet is consistent with the documented 159 km/h top
 * speed and 88 cv (open bed, square cab).
 */
export const SAVEIRO_GL_1994_DOC = {
  sources: ['guiacarros-saveiro-1994', 'volkspage-saveiro-g3'],
  body: 'picape cabine simples com caçamba',
  dimensions: { lengthMm: 4070, widthMm: 1622, heightMm: 1368, wheelbaseMm: 2358, groundClearanceMm: 150 },
  weights: { tareKg: 920, payloadKg: 580 },
  tyres: '175/70 R13',
  aero: { cd: 0.52, frontalAreaM2: null as number | null },
  performance: { accel0to100S: 11.8, topSpeedKmh: 159 },
  transmission: { gearRatios: [3.455, 1.944, 1.286, 0.969, 0.8], reverse: 3.167, finalDrive: 4.111 },
  drive: 'dianteira, motor longitudinal',
};

export const SAVEIRO_GL_1994_MASS = { tareKg: 920, driverKg: 75, fuelKg: 17 } as const;

export const CAR_VW_SAVEIRO_GL_1994: CarConfig = {
  schemaVersion: 1,
  id: 'vw-saveiro-gl-1994',
  name: 'Volkswagen Saveiro GL 1.8 1994',
  description: 'Picape AP-1800 a gasolina (88 cv, 14,9 kgfm), original de fábrica. Caçamba vazia: pouco peso sobre o eixo de trás.',
  massKg: SAVEIRO_GL_1994_MASS.tareKg + SAVEIRO_GL_1994_MASS.driverKg + SAVEIRO_GL_1994_MASS.fuelKg,
  wheelbaseM: 2.358,
  cgHeightM: 0.52,
  frontWeightFraction: 0.63, // estimated: empty bed
  drivenAxle: 'front',
  dragCoefficient: 0.52,
  frontalAreaM2: 1.9, // estimated
  brakeTorqueNm: 2800,
  engine: ENGINE_VW_AP1800_GAS_1994,
  transmission: assistedTransmission({
    gearRatios: [...SAVEIRO_GL_1994_DOC.transmission.gearRatios],
    finalDrive: SAVEIRO_GL_1994_DOC.transmission.finalDrive,
    efficiency: 0.91, // calibrated
    clutchMaxTorqueNm: 235,
    launchRpm: 3300,
    antiStallRpm: 1050,
    inputInertiaKgM2: 0.008,
    outputInertiaKgM2: 0.011,
  }),
  tires: {
    radiusM: rollingRadiusM(175, 70, 13),
    wheelInertiaKgM2: 0.55,
    muPeak: 1.02,
    B: 12,
    C: 1.45,
    E: 0.4,
    rollingResistance: 0.013,
    optimalTempC: 60,
    tempSensitivityPerC: 0.0018,
  },
  exhaust: periodStockExhaust(0.32, 34, { tailpipeDiameterMm: 48, collectorLengthM: 2.2, outputGain: 0.78 }),
  acoustic: periodAcoustic({ exhaustGain: 1.14, intakeGain: 0.85, blockGain: 0.62, mechanicalNoise: 0.72, gearTeeth: 17 }),
  visual: {
    bodyStyle: 'saveiroGl94',
    color: '#e9e9e4',
    accent: '#3b3e42',
    lengthM: 4.07,
    heightM: 1.368,
    frontOverhangM: 0.8,
    rideHeightM: 0.17, // derived: 150 mm ground clearance (sheet) + suspension unladen
  },
};

export const SAVEIRO_GL_1994_PROVENANCE: Record<string, Provenance> = {
  massKg: 'derived',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'estimated',
  'engine.compressionRatio': 'secondary',
  'engine.torqueCurve@3200': 'secondary',
  'engine.torqueCurve@5600': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'secondary',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
