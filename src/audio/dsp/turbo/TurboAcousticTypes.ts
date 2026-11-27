/**
 * Turbo Acoustics 2.0 — shared types.
 *
 * Everything here is acoustic only: no field is read by the physics, and nothing in this module
 * changes shaft speed, boost, flow or torque. Values marked "estimate" are derived for the sound
 * from the telemetry the physics really computes (shaft rpm, boost, BOV flow, throttle, load,
 * engine speed, EGT); they are NOT measurements of compressor flow, surge or wastegate position.
 */

/** Where the blow-off / diverter valve vents. */
export type BovVentType = 'atmosphere' | 'recirculating' | 'none';
/** Wastegate topology (only the types defined by fitted hardware are ever resolved for a car). */
export type WastegateType = 'internal' | 'external-recirculated' | 'external-open';
/** Acoustic path between the compressor inlet and the outside. */
export type IntakePath = 'airbox' | 'sport-element' | 'cone' | 'open';
/** Turbine housing: twin-scroll is ONE rotor with a divided turbine inlet (not a biturbo). */
export type TurbineHousing = 'single-scroll' | 'twin-scroll';
/** Turbo engine selection for A/B comparisons. */
export const TURBO_MODELS = ['legacy', 'v2', 'reduced', 'hybrid'] as const;
export type TurboAcousticModel = (typeof TURBO_MODELS)[number];

export interface RotorTextureConfig {
  coherentToneMix: number;
  narrowbandNoiseMix: number;
  bandwidthRatio: number;
  amplitudeVariation: number;
  phaseNoiseDepth: number;
}

export interface TurboDiagnostics {
  order1?: number;
  order2?: number;
  order3?: number;
  bladePass?: number;
  narrowband?: number;
  coherent?: number;
  amplitude?: number;
  exhaustPulse?: number;
  whoosh?: number;
  resonances?: readonly number[];
  texture?: Partial<RotorTextureConfig>;
}

export const TURBO_PROFILE_IDS = [
  'classic-small-turbo',
  'classic-medium-turbo',
  'classic-large-turbo',
  'modern-small-oem',
  'modern-medium-oem',
  'modern-performance-oem',
  'modern-twin-scroll',
  'modern-hybrid-turbo',
  'modern-big-turbo',
  'modern-na-conversion',
  'v6-single-conversion',
  'v6-parallel-twin-oem',
  'v6-parallel-twin-upgraded',
] as const;
export type TurboProfileId = (typeof TURBO_PROFILE_IDS)[number];

export interface TurboResonance {
  frequencyHz: number;
  q: number;
  /** Linear gain of the resonant band added to the dry path. */
  gain: number;
}

/** Data-driven acoustic signature of a compressor / turbine / installation (no DSP code per car). */
export interface TurboAcousticProfile {
  id: string;
  version: number;
  housing: TurbineHousing;
  rotor: {
    /** Relative levels of the shaft orders (1X imbalance, 2X, 3X) and of the blade-pass order. */
    order1Gain: number;
    order2Gain: number;
    order3Gain: number;
    bladePassGain: number;
    /** Slow random amplitude modulation depth (0..0.3). */
    modulationDepth: number;
    /** Amplitude modulation by the exhaust pulses at the firing frequency (0..0.4); lower on twin-scroll. */
    pulseModulation: number;
    /** Normalized shaft speed (0..1 of max) around which the whistle becomes clearly audible. */
    onsetShaft: number;
    /** Extra tonal emphasis while the rotor accelerates under load (spool), 0..1. */
    spoolEmphasis: number;
    /** Overall level of the rotor tones. */
    level: number;
  };
  compressor: {
    bodyGain: number;
    turbulenceGain: number;
    highFrequencyGain: number;
    /** −1 (darker) … +1 (brighter): tilts the three bands. */
    spectralTilt: number;
    /** Centre frequency ranges (Hz) of the three noise bands (calibration parameters, not measurements). */
    bodyHz: [number, number];
    turbulenceHz: [number, number];
    highHz: [number, number];
    /** Low-flow / high-pressure-ratio "near surge" noise (estimate), relative level. */
    instabilityGain: number;
  };
  resonance: TurboResonance[];
  blowOff: {
    gain: number;
    attackMs: number;
    releaseMs: number;
    /** 0 = dark / muffled … 1 = bright "pssh". */
    spectralColor: number;
    /** Valve body resonance (Hz). */
    resonanceHz: number;
    /** Level of the short tonal component of the valve (0..1). */
    tonalGain: number;
  };
  flutter: {
    /** The compressor can flutter audibly at all (hardware-dependent energy is computed at run time). */
    enabled: boolean;
    gain: number;
    /** Energy kept from one pulse to the next (0..1). */
    damping: number;
    basePulseRateHz: number;
    /** "TU" body resonance and "ST" attack band (Hz). */
    bodyHz: number;
    attackHz: number;
  };
  wastegate: { gain: number };
  /** High-frequency attenuation of the stock intake path (0 = none … 1 = strong). */
  intakeAttenuation: number;
  overallGain: number;
}

/** Deep partial for profile overrides (family / hardware modifiers). */
export type TurboProfilePatch = {
  [K in keyof TurboAcousticProfile]?: TurboAcousticProfile[K] extends (infer U)[]
    ? U[]
    : TurboAcousticProfile[K] extends object
      ? Partial<TurboAcousticProfile[K]>
      : TurboAcousticProfile[K];
};

/** Profile + the installed hardware it was resolved for: everything the DSP needs. */
export interface ResolvedTurboProfile extends TurboAcousticProfile {
  reducedOrders: readonly [number, number, number, number];
  texture: RotorTextureConfig;
  baseId: TurboProfileId;
  /** Human readable resolution chain (for reports and the dev panel). */
  chain: string[];
  ventType: BovVentType;
  wastegateType: WastegateType;
  intakePath: IntakePath;
  /** 0 (stock airbox) … 1 (open inlet). */
  intakeExposure: number;
  /** Charge-air volume added by intercooler / piping (L), shifts the duct resonances. */
  chargeVolumeAddL: number;
  twin: boolean;
  blades: number;
  maxShaftRpm: number;
  maxBoostPa: number;
  /** BOV vent time constant of the physics (s): a slower valve relieves the compressor less. */
  bovVentTimeS: number;
}

/**
 * Hardware hints written by the build resolvers into `car.acoustic.turbo` (all optional: absent =
 * the car as delivered). Purely descriptive; physics never reads them.
 */
export interface TurboAcousticHints {
  /** Base profile override (lab / editor). */
  profile?: string;
  /** Classic kit or modern stage that produced the turbo. */
  kit?: 'basic' | 'street' | 'medium' | 'strong' | 'conversion' | 'factory';
  /** Stage of a factory-turbo upgrade or conversion (1..3). */
  stage?: number;
  /** Classic turbine (rotor) option. */
  turbine?: 'small' | 'medium' | 'medium-high' | 'large';
  intake?: IntakePath;
  /** 0..1 (overrides the default exposure of `intake`). */
  intakeExposure?: number;
  chargeVolumeAddL?: number;
  wastegate?: WastegateType;
}

/** Control values for one sample (from the interpolated telemetry). */
export interface TurboAcousticControl {
  shaftRpm: number;
  shaftRpm2: number;
  boostPa: number;
  throttle: number;
  engineLoad: number;
  bovFlow: number;
  /** Engine speed (rad/s) – exhaust pulse rate and flow estimate. */
  omega: number;
  exhaustTempK: number;
  engineRunning: boolean;
}

/** Bit mask of turbo layers (dev isolation / lab exports). */
export const TURBO_LAYER = {
  rotor: 1,
  whoosh: 2,
  bov: 4,
  flutter: 8,
  wastegate: 16,
  resonance: 32,
  all: 63,
} as const;

/** Acoustic-only estimates exposed for diagnostics (never fed back to the physics). */
export interface TurboAcousticEstimates {
  shaftNorm: number;
  boostNorm: number;
  pressureRatio: number;
  /** d(shaftNorm)/dt (1/s), filtered. */
  shaftAccel: number;
  /** d(boostNorm)/dt (1/s), filtered. */
  boostRate: number;
  /** d(throttle)/dt (1/s), filtered. */
  throttleRate: number;
  /** Compressor air flow, 0..~1 of the reference (estimate). */
  compressorFlow: number;
  /** Turbine gas flow, 0..~1 (estimate). */
  turbineFlow: number;
  /** Wastegate opening 0..1 (estimate from the shaft speed cap of the physics model). */
  wastegateOpening: number;
  /** Low-flow / high-pressure-ratio indicator 0..1 (estimate, not a surge-map result). */
  instability: number;
}
