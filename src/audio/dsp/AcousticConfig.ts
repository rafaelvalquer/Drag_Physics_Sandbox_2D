import type { AcousticConfig, CarConfig, EngineConfig, ExhaustConfig } from '../../data/schema';
import type { TurboAcousticModel } from './turbo/TurboAcousticTypes';

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

/**
 * Everything the acoustic model needs about a vehicle, as plain serializable data (sent to the
 * AudioWorklet in `processorOptions` / config messages). Derived from the same CarConfig the
 * physics uses, so geometry, firing order, cam timing and exhaust are shared, not duplicated.
 */
export interface AcousticVehicleConfig {
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
  /** Turbo sound model (A/B comparison). Absent = 'v2'. */
  turboModel?: TurboAcousticModel;
  /** Dev isolation of the Turbo Acoustics 2.0 layers (TURBO_LAYER bits). Absent = all. */
  turboLayers?: number;
}

let defaultTurboModel: TurboAcousticModel = 'v2';
let defaultTurboLayers: number | undefined;

/** Dev A/B switch: the turbo model (and layer mask) every new voice configuration uses. */
export function setTurboAcousticDefaults(model: TurboAcousticModel, layers?: number): void {
  defaultTurboModel = model;
  defaultTurboLayers = layers;
}

export function turboAcousticDefaults(): { model: TurboAcousticModel; layers: number | undefined } {
  return { model: defaultTurboModel, layers: defaultTurboLayers };
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
    turboModel: defaultTurboModel,
    ...(defaultTurboLayers !== undefined ? { turboLayers: defaultTurboLayers } : {}),
  };
}
