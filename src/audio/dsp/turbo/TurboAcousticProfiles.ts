/**
 * Turbo Acoustics 2.0 — data-driven profiles.
 *
 * Base profiles are shared by every engine of a class; engine families only override a few
 * parameters (FAMILY_PATCHES) and the installed hardware is applied on top by TurboProfileResolver.
 * All numbers are DSP calibration parameters chosen by listening and by the spectral lab
 * (docs/audio-turbo/calibration-matrix.md): they are not measured dimensions or acoustic data of
 * the real cars, and no real-car dimension is invented here.
 */
import type { RotorTextureConfig, TurboAcousticProfile, TurboProfileId, TurboProfilePatch } from './TurboAcousticTypes';

export const TURBO_PROFILE_VERSION = 1;

/** Relative order levels and texture candidates for the 2.1 listening comparison. */
export const ROTOR_CALIBRATION: Readonly<Record<TurboProfileId, {
  orders: readonly [number, number, number, number];
  texture: RotorTextureConfig;
}>> = {
  'classic-small-turbo': calibration([.22, .10, .03, .55], .65, .76, .025),
  'classic-medium-turbo': calibration([.25, .11, .035, .51], .62, .78, .032),
  'classic-large-turbo': calibration([.26, .12, .04, .45], .57, .82, .038),
  'modern-small-oem': calibration([.18, .07, .018, .47], .67, .74, .023),
  'modern-medium-oem': calibration([.21, .085, .025, .49], .64, .77, .027),
  'modern-performance-oem': calibration([.23, .10, .03, .54], .63, .78, .028),
  'modern-twin-scroll': calibration([.18, .078, .018, .53], .66, .75, .024),
  'modern-hybrid-turbo': calibration([.24, .11, .028, .58], .61, .79, .030),
  'modern-big-turbo': calibration([.26, .12, .034, .48], .55, .84, .040),
  'modern-na-conversion': calibration([.23, .10, .026, .54], .60, .80, .031),
  'v6-single-conversion': calibration([.24, .11, .027, .50], .57, .82, .034),
  'v6-parallel-twin-oem': calibration([.18, .072, .013, .45], .48, .87, .029),
  'v6-parallel-twin-upgraded': calibration([.20, .086, .021, .51], .44, .90, .036),
};

function calibration(orders: readonly [number, number, number, number], coherentToneMix: number,
  narrowbandNoiseMix: number, bandwidthRatio: number) {
  return {
    orders,
    texture: { coherentToneMix, narrowbandNoiseMix, bandwidthRatio, amplitudeVariation: .10, phaseNoiseDepth: .12 },
  };
}

const p = (id: TurboProfileId, x: Omit<TurboAcousticProfile, 'id' | 'version'>): TurboAcousticProfile => ({ ...x, id, version: TURBO_PROFILE_VERSION });

/** Classic aftermarket kits: exposed compressor, atmospheric valve, audible flutter energy. */
const CLASSIC_SMALL = p('classic-small-turbo', {
  housing: 'single-scroll',
  rotor: { order1Gain: 0.32, order2Gain: 0.5, order3Gain: 0.3, bladePassGain: 0.9, modulationDepth: 0.08, pulseModulation: 0.18, onsetShaft: 0.3, spoolEmphasis: 0.6, level: 1 },
  compressor: { bodyGain: 0.34, turbulenceGain: 0.28, highFrequencyGain: 0.2, spectralTilt: 0.1, bodyHz: [800, 1800], turbulenceHz: [2200, 4200], highHz: [4500, 7500], instabilityGain: 0.4 },
  resonance: [
    { frequencyHz: 1150, q: 3, gain: 0.35 },
    { frequencyHz: 2600, q: 4, gain: 0.22 },
  ],
  blowOff: { gain: 1, attackMs: 3, releaseMs: 110, spectralColor: 0.75, resonanceHz: 2800, tonalGain: 0.35 },
  flutter: { enabled: true, gain: 1, damping: 0.8, basePulseRateHz: 14, bodyHz: 330, attackHz: 2400 },
  wastegate: { gain: 0.6 },
  intakeAttenuation: 0.35,
  overallGain: 1,
});

const CLASSIC_MEDIUM = p('classic-medium-turbo', {
  ...CLASSIC_SMALL,
  rotor: { ...CLASSIC_SMALL.rotor, order1Gain: 0.3, order2Gain: 0.55, order3Gain: 0.35, bladePassGain: 0.85, pulseModulation: 0.2, onsetShaft: 0.38, spoolEmphasis: 0.7, level: 1.05 },
  compressor: { ...CLASSIC_SMALL.compressor, bodyGain: 0.38, turbulenceGain: 0.3, highFrequencyGain: 0.19, spectralTilt: 0, bodyHz: [750, 1700], turbulenceHz: [2100, 4000], highHz: [4300, 7200] },
  resonance: [
    { frequencyHz: 1000, q: 3, gain: 0.35 },
    { frequencyHz: 2300, q: 4, gain: 0.22 },
  ],
  blowOff: { ...CLASSIC_SMALL.blowOff, gain: 1.1, releaseMs: 140, spectralColor: 0.7, resonanceHz: 2500 },
  flutter: { ...CLASSIC_SMALL.flutter, gain: 1.1, damping: 0.82, basePulseRateHz: 12, bodyHz: 290, attackHz: 2200 },
});

const CLASSIC_LARGE = p('classic-large-turbo', {
  ...CLASSIC_MEDIUM,
  rotor: { ...CLASSIC_MEDIUM.rotor, order1Gain: 0.28, order2Gain: 0.6, order3Gain: 0.4, bladePassGain: 0.75, pulseModulation: 0.22, onsetShaft: 0.48, spoolEmphasis: 0.8, level: 1.1 },
  compressor: { ...CLASSIC_MEDIUM.compressor, bodyGain: 0.44, turbulenceGain: 0.33, highFrequencyGain: 0.17, spectralTilt: -0.15, bodyHz: [700, 1600], turbulenceHz: [2000, 3800] },
  resonance: [
    { frequencyHz: 880, q: 3, gain: 0.4 },
    { frequencyHz: 2000, q: 4, gain: 0.22 },
  ],
  blowOff: { ...CLASSIC_MEDIUM.blowOff, gain: 1.25, releaseMs: 180, spectralColor: 0.65, resonanceHz: 2200 },
  flutter: { ...CLASSIC_MEDIUM.flutter, gain: 1.2, damping: 0.85, basePulseRateHz: 9.5, bodyHz: 250, attackHz: 2000 },
});

/** Factory turbos: airbox, recirculating diverter valve, more isolation. */
const MODERN_SMALL = p('modern-small-oem', {
  housing: 'single-scroll',
  rotor: { order1Gain: 0.25, order2Gain: 0.4, order3Gain: 0.25, bladePassGain: 0.7, modulationDepth: 0.05, pulseModulation: 0.12, onsetShaft: 0.3, spoolEmphasis: 0.45, level: 0.8 },
  compressor: { bodyGain: 0.3, turbulenceGain: 0.24, highFrequencyGain: 0.16, spectralTilt: 0, bodyHz: [800, 1800], turbulenceHz: [2200, 4200], highHz: [4500, 7500], instabilityGain: 0.25 },
  resonance: [{ frequencyHz: 1250, q: 2.5, gain: 0.25 }],
  blowOff: { gain: 0.7, attackMs: 10, releaseMs: 70, spectralColor: 0.3, resonanceHz: 1800, tonalGain: 0.1 },
  flutter: { enabled: true, gain: 0.5, damping: 0.68, basePulseRateHz: 17, bodyHz: 360, attackHz: 2500 },
  wastegate: { gain: 0.4 },
  intakeAttenuation: 0.55,
  // factory turbos (airbox, recirculating valve) sit ~4-6 dBA under an open aftermarket kit
  overallGain: 1.5,
});

const MODERN_MEDIUM = p('modern-medium-oem', {
  ...MODERN_SMALL,
  rotor: { ...MODERN_SMALL.rotor, order2Gain: 0.45, bladePassGain: 0.75, onsetShaft: 0.34, level: 0.85 },
  compressor: { ...MODERN_SMALL.compressor, bodyGain: 0.33, turbulenceGain: 0.26 },
  resonance: [{ frequencyHz: 1150, q: 2.5, gain: 0.25 }],
  intakeAttenuation: 0.5,
});

const MODERN_PERFORMANCE = p('modern-performance-oem', {
  ...MODERN_MEDIUM,
  rotor: { order1Gain: 0.3, order2Gain: 0.55, order3Gain: 0.35, bladePassGain: 0.9, modulationDepth: 0.06, pulseModulation: 0.16, onsetShaft: 0.4, spoolEmphasis: 0.7, level: 1 },
  compressor: { ...MODERN_MEDIUM.compressor, bodyGain: 0.4, turbulenceGain: 0.33, highFrequencyGain: 0.23, spectralTilt: 0.1 },
  resonance: [
    { frequencyHz: 1050, q: 3, gain: 0.3 },
    { frequencyHz: 2400, q: 3.5, gain: 0.2 },
  ],
  blowOff: { gain: 0.9, attackMs: 6, releaseMs: 90, spectralColor: 0.45, resonanceHz: 2200, tonalGain: 0.2 },
  flutter: { ...MODERN_MEDIUM.flutter, gain: 0.7 },
  intakeAttenuation: 0.4,
  overallGain: 1.3,
});

const MODERN_TWIN_SCROLL = p('modern-twin-scroll', {
  ...MODERN_MEDIUM,
  housing: 'twin-scroll',
  rotor: { ...MODERN_MEDIUM.rotor, order1Gain: 0.22, order2Gain: 0.45, order3Gain: 0.3, bladePassGain: 0.8, pulseModulation: 0.07, onsetShaft: 0.3, spoolEmphasis: 0.55 },
  intakeAttenuation: 0.55,
  overallGain: 1.6,
});

const MODERN_HYBRID = p('modern-hybrid-turbo', {
  ...MODERN_PERFORMANCE,
  rotor: { ...MODERN_PERFORMANCE.rotor, order2Gain: 0.55, bladePassGain: 0.95, onsetShaft: 0.38, spoolEmphasis: 0.75, level: 1.05 },
  compressor: { ...MODERN_PERFORMANCE.compressor, bodyGain: 0.42, turbulenceGain: 0.35, highFrequencyGain: 0.24 },
  flutter: { ...MODERN_PERFORMANCE.flutter, gain: 0.8, damping: 0.74 },
  intakeAttenuation: 0.45,
});

const MODERN_BIG = p('modern-big-turbo', {
  ...MODERN_HYBRID,
  rotor: { ...MODERN_HYBRID.rotor, order1Gain: 0.28, order2Gain: 0.6, order3Gain: 0.42, bladePassGain: 0.8, onsetShaft: 0.5, spoolEmphasis: 0.85, level: 1.1 },
  compressor: { ...MODERN_HYBRID.compressor, bodyGain: 0.47, turbulenceGain: 0.37, highFrequencyGain: 0.2, spectralTilt: -0.1, bodyHz: [700, 1600] },
  resonance: [
    { frequencyHz: 950, q: 3, gain: 0.32 },
    { frequencyHz: 2150, q: 3.5, gain: 0.2 },
  ],
  flutter: { ...MODERN_HYBRID.flutter, gain: 0.95, damping: 0.78, basePulseRateHz: 11, bodyHz: 270, attackHz: 2100 },
});

/** Aftermarket conversion kits on modern NA engines (atmospheric valve as fitted by the physics). */
const MODERN_NA_CONVERSION = p('modern-na-conversion', {
  ...CLASSIC_MEDIUM,
  rotor: { ...CLASSIC_MEDIUM.rotor, order2Gain: 0.55, bladePassGain: 0.9, onsetShaft: 0.4, spoolEmphasis: 0.7, level: 1, pulseModulation: 0.16 },
  blowOff: { ...CLASSIC_MEDIUM.blowOff, gain: 1, releaseMs: 130, spectralColor: 0.7 },
  flutter: { ...CLASSIC_MEDIUM.flutter, gain: 1, damping: 0.75, basePulseRateHz: 13 },
  intakeAttenuation: 0.35,
  overallGain: 1,
});

const V6_SINGLE_CONVERSION = p('v6-single-conversion', {
  ...MODERN_NA_CONVERSION,
  rotor: { ...MODERN_NA_CONVERSION.rotor, onsetShaft: 0.45, level: 1.05, pulseModulation: 0.12 },
  compressor: { ...MODERN_NA_CONVERSION.compressor, bodyGain: 0.42, bodyHz: [700, 1600] },
  resonance: [
    { frequencyHz: 920, q: 3, gain: 0.35 },
    { frequencyHz: 2100, q: 4, gain: 0.2 },
  ],
  flutter: { ...MODERN_NA_CONVERSION.flutter, basePulseRateHz: 12, bodyHz: 270 },
});

/** Parallel twins: values per rotor (the mixer normalizes the pair). */
const V6_TWIN_OEM = p('v6-parallel-twin-oem', {
  ...MODERN_MEDIUM,
  rotor: { order1Gain: 0.22, order2Gain: 0.42, order3Gain: 0.26, bladePassGain: 0.7, modulationDepth: 0.05, pulseModulation: 0.12, onsetShaft: 0.3, spoolEmphasis: 0.5, level: 0.8 },
  compressor: { ...MODERN_MEDIUM.compressor, bodyGain: 0.32, turbulenceGain: 0.26, highFrequencyGain: 0.16 },
  resonance: [{ frequencyHz: 1100, q: 2.5, gain: 0.25 }],
  intakeAttenuation: 0.55,
  overallGain: 1.7,
});

const V6_TWIN_UPGRADED = p('v6-parallel-twin-upgraded', {
  ...V6_TWIN_OEM,
  rotor: { ...V6_TWIN_OEM.rotor, order2Gain: 0.52, order3Gain: 0.34, bladePassGain: 0.85, onsetShaft: 0.36, spoolEmphasis: 0.7, level: 1 },
  compressor: { ...V6_TWIN_OEM.compressor, bodyGain: 0.38, turbulenceGain: 0.31, highFrequencyGain: 0.2 },
  flutter: { ...V6_TWIN_OEM.flutter, gain: 0.7, damping: 0.72 },
  intakeAttenuation: 0.45,
  overallGain: 1,
});

export const BASE_TURBO_PROFILES: Readonly<Record<TurboProfileId, TurboAcousticProfile>> = {
  'classic-small-turbo': CLASSIC_SMALL,
  'classic-medium-turbo': CLASSIC_MEDIUM,
  'classic-large-turbo': CLASSIC_LARGE,
  'modern-small-oem': MODERN_SMALL,
  'modern-medium-oem': MODERN_MEDIUM,
  'modern-performance-oem': MODERN_PERFORMANCE,
  'modern-twin-scroll': MODERN_TWIN_SCROLL,
  'modern-hybrid-turbo': MODERN_HYBRID,
  'modern-big-turbo': MODERN_BIG,
  'modern-na-conversion': MODERN_NA_CONVERSION,
  'v6-single-conversion': V6_SINGLE_CONVERSION,
  'v6-parallel-twin-oem': V6_TWIN_OEM,
  'v6-parallel-twin-upgraded': V6_TWIN_UPGRADED,
};

/** How an engine family maps to a base profile when it is turbocharged as delivered / converted. */
export interface FamilyAcoustics {
  /** Base profile of the factory turbo (factory-turbo engines). */
  factory?: TurboProfileId;
  /** Base profile of a conversion kit (NA families). */
  conversion?: TurboProfileId;
  /** Stage 2 / Stage 3 hardware of a factory turbo. */
  upgraded?: [TurboProfileId, TurboProfileId];
  patch?: TurboProfilePatch;
  /** Label for reports. */
  label: string;
}

/**
 * Keyed by `engine.family` (modern engines) or by an engine-id prefix (classic / sandbox engines,
 * matched with `startsWith`). Shared hardware shares the entry: Golf GTI and A3 use the same EA113
 * entry; their differences come from the car's own acoustic gains, exhaust and parts.
 */
export const FAMILY_ACOUSTICS: Readonly<Record<string, FamilyAcoustics>> = {
  // ---- classic (aftermarket kits) — key = engine id prefix
  'vw-ap': { label: 'VW AP 1.8', patch: {} },
  'fiat-fiasa': {
    label: 'Fiat Fiasa 1.0',
    patch: { rotor: { level: 0.95 }, compressor: { bodyGain: 0.3 }, resonance: [{ frequencyHz: 1250, q: 3, gain: 0.33 }, { frequencyHz: 2800, q: 4, gain: 0.22 }], flutter: { basePulseRateHz: 18 } },
  },
  'gm-chevette': {
    label: 'GM Chevette 1.6/S',
    patch: { rotor: { pulseModulation: 0.22 }, resonance: [{ frequencyHz: 1050, q: 3, gain: 0.36 }, { frequencyHz: 2400, q: 4, gain: 0.22 }] },
  },
  'gm-familia1-vhc': {
    label: 'GM Família I VHC 1.0',
    patch: { rotor: { level: 0.95 }, compressor: { bodyGain: 0.31 }, resonance: [{ frequencyHz: 1200, q: 3, gain: 0.33 }, { frequencyHz: 2700, q: 4, gain: 0.2 }], flutter: { basePulseRateHz: 17 } },
  },
  'gm-familia1-efi': { label: 'GM Família I 1.4', patch: { resonance: [{ frequencyHz: 1100, q: 3, gain: 0.34 }, { frequencyHz: 2500, q: 4, gain: 0.22 }] } },
  'gm-familia2-18': { label: 'GM Família II 1.8', patch: { resonance: [{ frequencyHz: 980, q: 3, gain: 0.36 }, { frequencyHz: 2250, q: 4, gain: 0.22 }] } },
  // ---- sandbox engines
  'vetra-i4': { label: 'Vetra 2.0 Turbo', factory: 'modern-performance-oem', upgraded: ['modern-hybrid-turbo', 'modern-big-turbo'] },
  'orion-i6': { label: 'Orion 3.0 I6 Turbo', factory: 'modern-big-turbo', upgraded: ['modern-big-turbo', 'modern-big-turbo'], patch: { rotor: { pulseModulation: 0.1 } } },
  // ---- Chapter 2 factory turbos — key = engine.family
  'psa-prince-thp': { label: 'PSA/BMW Prince THP 1.6', factory: 'modern-small-oem', upgraded: ['modern-hybrid-turbo', 'modern-big-turbo'], patch: { blowOff: { gain: 0.55 } } },
  'vw-ea113': { label: 'VW EA113 1.8T', factory: 'modern-medium-oem', upgraded: ['modern-hybrid-turbo', 'modern-big-turbo'] },
  'vw-ea888': { label: 'VW EA888 2.0 TSI', factory: 'modern-medium-oem', upgraded: ['modern-hybrid-turbo', 'modern-big-turbo'], patch: { resonance: [{ frequencyHz: 1180, q: 2.5, gain: 0.25 }] } },
  'mb-m274': { label: 'Mercedes M274', factory: 'modern-small-oem', upgraded: ['modern-hybrid-turbo', 'modern-big-turbo'], patch: { intakeAttenuation: 0.7, overallGain: 1.25 } },
  'bmw-n20': { label: 'BMW N20 (twin-scroll)', factory: 'modern-twin-scroll', upgraded: ['modern-hybrid-turbo', 'modern-big-turbo'], patch: { housing: 'twin-scroll' } },
  'bmw-n55': {
    label: 'BMW N55 (twin-scroll I6)',
    factory: 'modern-twin-scroll',
    upgraded: ['modern-hybrid-turbo', 'modern-big-turbo'],
    patch: {
      housing: 'twin-scroll',
      rotor: { order1Gain: 0.2, order2Gain: 0.5, order3Gain: 0.34, bladePassGain: 0.72, pulseModulation: 0.06, onsetShaft: 0.32 },
      resonance: [{ frequencyHz: 980, q: 3, gain: 0.25 }, { frequencyHz: 2150, q: 3, gain: 0.18 }],
    },
  },
  'mitsubishi-4b11': { label: 'Mitsubishi 4B11T', factory: 'modern-performance-oem', upgraded: ['modern-hybrid-turbo', 'modern-big-turbo'] },
  // ---- Chapter 2/3 NA families with turbo conversions
  'gm-familia2': { label: 'GM Família II 2.0 Flex', conversion: 'modern-na-conversion' },
  'honda-k20': { label: 'Honda K20Z3', conversion: 'modern-na-conversion', patch: { resonance: [{ frequencyHz: 1300, q: 3, gain: 0.33 }, { frequencyHz: 2700, q: 4, gain: 0.2 }] } },
  'nissan-vq35de': { label: 'Nissan VQ35DE', conversion: 'v6-single-conversion' },
  'nissan-vq37vhr': { label: 'Nissan VQ37VHR', conversion: 'v6-single-conversion', patch: { rotor: { onsetShaft: 0.47 }, resonance: [{ frequencyHz: 900, q: 3, gain: 0.35 }, { frequencyHz: 2050, q: 4, gain: 0.2 }] } },
  // Lexus IS 350 (2GR-FSE) stays NA in this project: a future conversion maps here.
  'toyota-2gr-fse': { label: 'Toyota 2GR-FSE (sem conversão)', conversion: 'v6-single-conversion' },
  // ---- Chapter 3 parallel twins
  'mercedes-m276': { label: 'Mercedes M276 biturbo', factory: 'v6-parallel-twin-oem', upgraded: ['v6-parallel-twin-upgraded', 'v6-parallel-twin-upgraded'], patch: { blowOff: { gain: 0.6 }, overallGain: 1.6 } },
  'kia-lambda33': { label: 'Kia Lambda II 3.3 T-GDi', factory: 'v6-parallel-twin-oem', upgraded: ['v6-parallel-twin-upgraded', 'v6-parallel-twin-upgraded'], patch: { resonance: [{ frequencyHz: 1080, q: 2.5, gain: 0.26 }] } },
  'maserati-f160': { label: 'Maserati F160', factory: 'v6-parallel-twin-oem', upgraded: ['v6-parallel-twin-upgraded', 'v6-parallel-twin-upgraded'], patch: { intakeAttenuation: 0.6, overallGain: 1.4 } },
  'alfa-690t': { label: 'Alfa Romeo 690T', factory: 'v6-parallel-twin-oem', upgraded: ['v6-parallel-twin-upgraded', 'v6-parallel-twin-upgraded'], patch: { rotor: { onsetShaft: 0.26, spoolEmphasis: 0.65, level: 0.9 } } },
  'nissan-vr38dett': {
    label: 'Nissan VR38DETT',
    factory: 'v6-parallel-twin-oem',
    upgraded: ['v6-parallel-twin-upgraded', 'v6-parallel-twin-upgraded'],
    patch: { rotor: { order2Gain: 0.48, bladePassGain: 0.8, level: 0.95 }, blowOff: { gain: 0.75 }, intakeAttenuation: 0.5 },
  },
};

/** Applies a patch (objects merged one level deep, arrays replaced). Never mutates its inputs. */
export function patchProfile<T extends TurboAcousticProfile>(base: T, patch: TurboProfilePatch | undefined): T {
  if (!patch) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const cur = out[k];
    if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === 'object' && x ? { ...x } : x));
    else if (v && typeof v === 'object' && cur && typeof cur === 'object' && !Array.isArray(cur)) out[k] = { ...(cur as object), ...(v as object) };
    else out[k] = v;
  }
  return out as T;
}
