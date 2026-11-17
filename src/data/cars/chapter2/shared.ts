import type { AcousticConfig, AutoShiftConfig, ExhaustConfig, PowershiftConfig, TorqueConverterConfig, TransmissionConfig } from '../../schema';
import { exhaustPreset } from '../../exhaustPresets';
import { ASSISTED_MANUAL_SHIFT, assistedTransmission } from '../campaignShared';

/**
 * Transmission builders of the Chapter 2 cars. The manual cars use exactly the same driving aid
 * as Chapter 1 (automatic clutch + assisted sequential shift). The automatics and dual-clutch
 * gearboxes are physical models (see PowershiftController / TorqueConverter): what is set here
 * are the factory ratios and the calibrated timings of each gearbox family.
 */
export { assistedTransmission as manualTransmission };

export function dualClutchTransmission(t: {
  gearRatios: number[];
  finalDrive: number;
  efficiency: number;
  /** Capacity of each wet clutch pack (N·m). */
  clutchMaxTorqueNm: number;
  launchRpm: number;
  powershift: Omit<PowershiftConfig, 'preselect'>;
  autoShift: AutoShiftConfig;
}): TransmissionConfig {
  return {
    kind: 'dual-clutch',
    gearRatios: t.gearRatios,
    finalDrive: t.finalDrive,
    efficiency: t.efficiency,
    inputInertiaKgM2: 0.012,
    outputInertiaKgM2: 0.012,
    clutch: { maxTorqueNm: t.clutchMaxTorqueNm, engageRatePerS: 6, launchRpm: t.launchRpm, antiStallRpm: 900 },
    shift: structuredClone(ASSISTED_MANUAL_SHIFT),
    powershift: { ...t.powershift, preselect: true },
    autoShift: { ...t.autoShift },
  };
}

export function torqueConverterTransmission(t: {
  gearRatios: number[];
  finalDrive: number;
  efficiency: number;
  /** Capacity of the planetary shift elements referred to the gearbox input (N·m). */
  elementMaxTorqueNm: number;
  converter: TorqueConverterConfig;
  powershift: Omit<PowershiftConfig, 'preselect'>;
  autoShift: AutoShiftConfig;
}): TransmissionConfig {
  return {
    kind: 'torque-converter-auto',
    gearRatios: t.gearRatios,
    finalDrive: t.finalDrive,
    efficiency: t.efficiency,
    inputInertiaKgM2: 0.01,
    outputInertiaKgM2: 0.012,
    // the "clutch" of an automatic is the set of shift elements; launchRpm/antiStall are unused
    clutch: { maxTorqueNm: t.elementMaxTorqueNm, engageRatePerS: 8, launchRpm: 2500, antiStallRpm: 700 },
    shift: structuredClone(ASSISTED_MANUAL_SHIFT),
    torqueConverter: structuredClone(t.converter),
    powershift: { ...t.powershift, preselect: false },
    autoShift: { ...t.autoShift },
  };
}

/** Original exhaust of a modern car (catalyst + front resonator + rear silencer). */
export function modernStockExhaust(o: { layout: 'single' | 'dual'; headerLengthM: number; headerDiameterMm: number } & Partial<ExhaustConfig>): ExhaustConfig {
  const { layout, headerLengthM, headerDiameterMm, ...over } = o;
  return { ...exhaustPreset('stock', { layout, headerPrimaryLengthM: headerLengthM, headerDiameterMm }), ...over };
}

export function modernAcoustic(over: Partial<AcousticConfig>): AcousticConfig {
  return {
    intakeGain: 0.7,
    blockGain: 0.55,
    exhaustGain: 0.9,
    turboGain: 0,
    tireGain: 0.8,
    transmissionGain: 0.35,
    environmentGain: 0.5,
    gearTeeth: 23,
    mechanicalNoise: 0.45,
    ...over,
  };
}
