import { ENGINE_BMW_N55 } from '../../engines/chapter2/bmwN55';
import { rollingRadiusM, type Provenance } from '../../provenance';
import type { CarConfig } from '../../schema';
import { modernAcoustic, modernStockExhaust, torqueConverterTransmission } from './shared';
import { ZF_8HP_RATIOS } from './bmw320i2014';

/**
 * BMW 335i M Sport F30 2013, Brazil, gasoline, ZF 8-speed automatic, rear drive, M light-alloy
 * 19" wheels (BMW Brazil sheet: 306 hp, 400/1200, Aut/8, traseira, "M - Liga leve aro 19").
 * Staggered tyres 225/40 R19 front / 255/35 R19 rear: the model has one tyre size, the driven
 * rear one. Top speed electronically limited to 250 km/h (not modelled: the simulation is
 * checked to reach at least the limiter speed).
 */
export const BMW_335I_2013_DOC = {
  market: 'Brasil',
  modelYear: 2013,
  version: '335i M Sport (F30) 3.0 TwinPower Turbo, automático 8',
  sources: ['bmw-serie3-2013-ficha', 'km77-335i-2013', 'literature-bmw-f30', 'literature-zf-8hp'],
  body: 'sedã 4 portas (F30, pacote M Sport)',
  dimensions: { lengthMm: 4633, widthMm: 1811, heightMm: 1429, wheelbaseMm: 2810, frontOverhangMm: 780 },
  weights: { runningOrderKg: 1585 },
  tyres: '255/35 R19 (traseiros)',
  aero: { cd: 0.29, frontalAreaM2: 2.18 },
  performance: { accel0to100S: 5.5, topSpeedKmh: 250, topSpeedLimited: true },
  transmission: { code: 'ZF 8HP45', kind: 'automático 8 (conversor)', gearRatios: ZF_8HP_RATIOS, finalDrive: 3.08 },
  drive: 'traseira',
};

export const BMW_335I_2013_MASS = { tareKg: 1585, driverKg: 75, fuelKg: 0 } as const;

export const CAR_BMW_335I_2013: CarConfig = {
  schemaVersion: 1,
  id: 'bmw-335i-f30-2013',
  name: 'BMW 335i M Sport F30 2013',
  description: 'N55 3.0 seis em linha TwinPower Turbo (306 hp, 400 N·m de 1200 a 5000 rpm), ZF de oito marchas, tração traseira e rodas M aro 19.',
  massKg: BMW_335I_2013_MASS.tareKg + BMW_335I_2013_MASS.driverKg + BMW_335I_2013_MASS.fuelKg,
  wheelbaseM: 2.81,
  cgHeightM: 0.5,
  frontWeightFraction: 0.51,
  drivenAxle: 'rear',
  dragCoefficient: 0.29,
  frontalAreaM2: 2.18,
  brakeTorqueNm: 5000,
  engine: ENGINE_BMW_N55,
  transmission: torqueConverterTransmission({
    gearRatios: [...ZF_8HP_RATIOS],
    finalDrive: BMW_335I_2013_DOC.transmission.finalDrive,
    efficiency: 0.92,
    elementMaxTorqueNm: 1050,
    converter: { kFactor: 122, stallTorqueRatio: 1.9, couplingSpeedRatio: 0.86, turbineInertiaKgM2: 0.07, lockup: { maxTorqueNm: 720, minGear: 2, engageRatePerS: 6, minTurbineRpm: 1100 } },
    powershift: { torquePhaseS: 0.07, inertiaPhaseMaxS: 0.3, torqueReduction: 0.38, inertiaCapacity: 0.9, downshiftReleaseS: 0.07 },
    autoShift: { wotUpshiftFraction: 0.95, lightUpshiftRpm: 1600, kickdownPedal: 0.92, kickdownRpm: 3600, coastDownshiftRpm: 1050 },
  }),
  tires: { radiusM: rollingRadiusM(255, 35, 19), wheelInertiaKgM2: 1.15, muPeak: 1.12, B: 11, C: 1.52, E: 0.32, rollingResistance: 0.011, optimalTempC: 65, tempSensitivityPerC: 0.0015 },
  exhaust: modernStockExhaust({ layout: 'single', headerLengthM: 0.34, headerDiameterMm: 42, collectorDiameterMm: 70, collectorLengthM: 2.4, tailpipeDiameterMm: 70, mufflerAbsorption: 0.6, mufflerChambersM: [0.13, 0.21, 0.29], outputGain: 1.0 }),
  acoustic: modernAcoustic({ intakeGain: 0.6, blockGain: 0.52, exhaustGain: 1.0, turboGain: 0.45, mechanicalNoise: 0.36, transmissionGain: 0.24, gearTeeth: 29 }),
  visual: { bodyStyle: 'bmw335iF30', color: '#1d3b78', accent: '#11151b', lengthM: 4.633, heightM: 1.429, frontOverhangM: 0.78, rideHeightM: 0.12 },
};

export const BMW_335I_2013_PROVENANCE: Record<string, Provenance> = {
  massKg: 'secondary',
  wheelbaseM: 'secondary',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'estimated',
  'engine.boreMm': 'secondary',
  'engine.strokeMm': 'secondary',
  'engine.torqueCurve@1200': 'factory',
  'engine.torqueCurve@5800': 'secondary',
  'engine.torqueCurve(other points)': 'estimated',
  'engine.turbo': 'calibrated',
  'transmission.gearRatios': 'secondary',
  'transmission.finalDrive': 'estimated',
  'transmission.torqueConverter': 'estimated',
  'transmission.powershift': 'calibrated',
  'tires.radiusM': 'derived',
  'tires.muPeak/B/C/E': 'calibrated',
  'performance.accel0to100S': 'secondary',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
};
