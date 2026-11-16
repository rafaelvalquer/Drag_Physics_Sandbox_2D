import type { AcousticConfig, ExhaustConfig, ShiftConfig, TransmissionConfig } from '../schema';
import { exhaustPreset } from '../exhaustPresets';

/**
 * Pieces shared by the campaign cars that are NOT vehicle data: the driving aids of the game
 * (automatic clutch timings, shift phases) and the acoustic channel defaults. Every real car has
 * a manual gearbox with a pedal clutch; these timings are the same calibrated assistance the Gol
 * GTS uses, so no car gets a quicker "shifter" than another.
 */
export const ASSISTED_MANUAL_SHIFT: ShiftConfig = {
  torqueCutTimeS: 0.04,
  upshiftFreeFallMaxS: 0.05,
  clutchDisengageTimeS: 0.04,
  gearChangeTimeS: 0.09,
  clutchEngageTimeS: 0.13,
  revMatch: { enabled: true, gain: 1.3, toleranceRpm: 250, maxBlipThrottle: 0.55, timeoutS: 0.4, leadTimeS: 0.16 },
  overRevProtection: 'block',
  maxDownshiftRpmFraction: 0.97,
};

export function assistedTransmission(t: {
  gearRatios: number[];
  finalDrive: number;
  efficiency: number;
  clutchMaxTorqueNm: number;
  launchRpm: number;
  antiStallRpm: number;
  inputInertiaKgM2?: number;
  outputInertiaKgM2?: number;
}): TransmissionConfig {
  return {
    gearRatios: t.gearRatios,
    finalDrive: t.finalDrive,
    efficiency: t.efficiency,
    inputInertiaKgM2: t.inputInertiaKgM2 ?? 0.007,
    outputInertiaKgM2: t.outputInertiaKgM2 ?? 0.01,
    clutch: { maxTorqueNm: t.clutchMaxTorqueNm, engageRatePerS: 4.5, launchRpm: t.launchRpm, antiStallRpm: t.antiStallRpm },
    shift: structuredClone(ASSISTED_MANUAL_SHIFT),
  };
}

/** Original exhaust of a small period car: geometry from the stock preset, calibrated by ear. */
export function periodStockExhaust(headerLengthM: number, headerDiameterMm: number, over: Partial<ExhaustConfig> = {}): ExhaustConfig {
  return { ...exhaustPreset('stock', { layout: 'single', headerPrimaryLengthM: headerLengthM, headerDiameterMm }), outputGain: 0.8, ...over };
}

export function periodAcoustic(over: Partial<AcousticConfig> = {}): AcousticConfig {
  return {
    intakeGain: 0.75,
    blockGain: 0.6,
    exhaustGain: 0.95,
    turboGain: 0,
    tireGain: 0.8,
    transmissionGain: 0.45,
    environmentGain: 0.5,
    gearTeeth: 17,
    mechanicalNoise: 0.65,
    ...over,
  };
}
