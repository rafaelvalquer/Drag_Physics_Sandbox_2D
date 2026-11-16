import { ENGINE_GM_CHEVETTE_16S_1988 } from '../engines/gmChevette16S_1988';
import { rollingRadiusM, type Provenance } from '../provenance';
import type { CarConfig } from '../schema';
import { assistedTransmission, periodAcoustic, periodStockExhaust } from './campaignShared';

/**
 * Chevrolet Chevette SL 1.6/S 1988, ETHANOL, two-door SEDAN (three-box body with a boot),
 * longitudinal engine and REAR-wheel drive with a live axle — the only rear-driven car of the
 * chapter.
 *
 * Power by version (divergence investigated): 72 cv @ 5600 / 12.3 kgfm @ 3200 (fichacompleta,
 * used) vs 73 cv @ 5800 / 12.8 kgfm @ 3400 (jkcarros). Five-speed gearbox ratios and the 3.90
 * final drive of the sedan/hatch: Chevetteiros Curitiba technical data (enthusiast literature).
 * Length 4193 mm as printed by fichacompleta (the sedan's boot makes it the longest car here
 * after the Saveiro).
 */
export const CHEVETTE_SL_1988_DOC = {
  sources: ['fichacompleta-chevette-1988', 'jkcarros-chevette-1988', 'chevetteiros-dados'],
  body: 'sedã 2 portas (três volumes)',
  dimensions: { lengthMm: 4193, widthMm: 1570, heightMm: 1324, wheelbaseMm: 2395 },
  weights: { tareKg: 945 },
  tyres: '175/70 R13',
  aero: { cd: null as number | null, frontalAreaM2: null as number | null },
  performance: { accel0to100S: 16.9, topSpeedKmh: 150 },
  transmission: { gearRatios: [3.746, 2.157, 1.378, 1.0, 0.84], reverse: 3.815, finalDrive: 3.9 },
  drive: 'TRASEIRA, eixo rígido, motor longitudinal',
};

export const CHEVETTE_SL_1988_MASS = { tareKg: 945, driverKg: 75, fuelKg: 18 } as const;

export const CAR_GM_CHEVETTE_SL_1988: CarConfig = {
  schemaVersion: 1,
  id: 'gm-chevette-sl-1988',
  name: 'Chevrolet Chevette SL 1.6/S 1988',
  description: 'Sedã de tração traseira com o 1.6/S a etanol (72 cv, 12,3 kgfm). A transferência de carga ajuda na largada.',
  massKg: CHEVETTE_SL_1988_MASS.tareKg + CHEVETTE_SL_1988_MASS.driverKg + CHEVETTE_SL_1988_MASS.fuelKg,
  wheelbaseM: 2.395,
  cgHeightM: 0.5,
  frontWeightFraction: 0.53, // estimated: longitudinal engine behind the front axle line, RWD
  drivenAxle: 'rear',
  dragCoefficient: 0.45, // estimated (not in the sheets): upright 1970s three-box body, rain gutters
  frontalAreaM2: 1.8, // estimated
  brakeTorqueNm: 2500,
  engine: ENGINE_GM_CHEVETTE_16S_1988,
  transmission: assistedTransmission({
    gearRatios: [...CHEVETTE_SL_1988_DOC.transmission.gearRatios],
    finalDrive: CHEVETTE_SL_1988_DOC.transmission.finalDrive,
    efficiency: 0.88, // calibrated: longitudinal gearbox + propeller shaft + hypoid live axle
    clutchMaxTorqueNm: 195,
    launchRpm: 3300,
    antiStallRpm: 1000,
    inputInertiaKgM2: 0.008,
    outputInertiaKgM2: 0.018, // estimated: propeller shaft + live axle
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
  exhaust: periodStockExhaust(0.42, 34, { tailpipeDiameterMm: 45, collectorLengthM: 2.1, outputGain: 0.8 }),
  acoustic: periodAcoustic({ intakeGain: 0.78, blockGain: 0.64, mechanicalNoise: 0.7, transmissionGain: 0.6, gearTeeth: 16 }),
  visual: {
    bodyStyle: 'chevetteSl88',
    color: '#d8c79a',
    accent: '#3a2f26',
    lengthM: 4.193,
    heightM: 1.324,
    frontOverhangM: 0.78,
    rideHeightM: 0.15,
  },
};

export const CHEVETTE_SL_1988_PROVENANCE: Record<string, Provenance> = {
  massKg: 'derived',
  wheelbaseM: 'secondary',
  'visual.lengthM': 'secondary',
  dragCoefficient: 'estimated',
  frontalAreaM2: 'estimated',
  frontWeightFraction: 'estimated',
  drivenAxle: 'secondary',
  'engine.torqueCurve@3200': 'secondary',
  'engine.torqueCurve@5600': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'secondary',
  'transmission.efficiency': 'calibrated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
