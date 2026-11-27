import type { AcousticConfig, CarConfig, EngineConfig, ExhaustConfig } from '../../data/schema';
import type { TurboAcousticModel, TurboDiagnostics } from './turbo/TurboAcousticTypes';

/** Mixer channels produced by each vehicle voice (one mono AudioWorklet output each). */
export const CHANNELS = ['intake', 'block', 'exhaust', 'turbo', 'tire', 'transmission', 'environment'] as const;
export type ChannelId = (typeof CHANNELS)[number];
export const CH = {
  intake: 0,
  block: 1,
  exhaust: 2,
  turbo: 3,
  tire: 4,
  transmission: 5,
  environment: 6,
} as const satisfies Record<ChannelId, number>;
export const CHANNEL_COUNT = CHANNELS.length;

export type AcousticQuality = 'high' | 'low';

export interface TurboAudioOptions {
  /** Absent = hybrid. */
  turboModel?: TurboAcousticModel;
  turboLayers?: number;
  turboDiagnostics?: TurboDiagnostics;
  /** Listening comparison only. Applies to the turbo channel of any model. */
  turboComparisonGain?: number;
}

/** Serializable voice configuration derived from the same CarConfig used by the simulation. */
export interface AcousticVehicleConfig extends TurboAudioOptions {
  engine: Pick<
    EngineConfig,
    | 'id'
    | 'family'
    | 'cylinders'
    | 'firingAnglesDeg'
    | 'bankOfCylinder'
    | 'bankAngleDeg'
    | 'crankType'
    | 'boreMm'
    | 'strokeMm'
    | 'rodLengthMm'
    | 'compressionRatio'
    | 'reciprocatingMassKg'
    | 'cam'
    | 'variableCam'
    | 'combustion'
    | 'intake'
    | 'idleRpm'
    | 'redlineRpm'
    | 'induction'
    | 'turbo'
    | 'egt'
    | 'throttle'
  >;
  exhaust: ExhaustConfig;
  acoustic: AcousticConfig;
  gearRatios: number[];
  finalDrive: number;
  tireRadiusM: number;
  quality: AcousticQuality;
  /** Seed of the noise generators (deterministic rendering for tests). */
  seed: number;
}

export function carToAcousticConfig(car: CarConfig, quality: AcousticQuality = 'high', seed = 1): AcousticVehicleConfig {
  const e = car.engine;
  return {
    engine: {
      id: e.id,
      family: e.family,
      cylinders: e.cylinders,
      firingAnglesDeg: [...e.firingAnglesDeg],
      bankOfCylinder: [...e.bankOfCylinder],
      bankAngleDeg: e.bankAngleDeg,
      crankType: e.crankType,
      boreMm: e.boreMm,
      strokeMm: e.strokeMm,
      rodLengthMm: e.rodLengthMm,
      compressionRatio: e.compressionRatio,
      reciprocatingMassKg: e.reciprocatingMassKg,
      cam: { ...e.cam },
      variableCam: e.variableCam ? { ...e.variableCam, high: { ...e.variableCam.high } } : undefined,
      combustion: { ...e.combustion },
      intake: { ...e.intake },
      idleRpm: e.idleRpm,
      redlineRpm: e.redlineRpm,
      induction: e.induction,
      turbo: e.turbo ? { ...e.turbo } : undefined,
      egt: { ...e.egt },
      throttle: { ...e.throttle },
    },
    exhaust: { ...car.exhaust, mufflerChambersM: [...car.exhaust.mufflerChambersM] },
    acoustic: { ...car.acoustic, ...(car.acoustic.turbo ? { turbo: { ...car.acoustic.turbo } } : {}) },
    gearRatios: [...car.transmission.gearRatios],
    finalDrive: car.transmission.finalDrive,
    tireRadiusM: car.tires.radiusM,
    quality,
    seed,
  };
}
