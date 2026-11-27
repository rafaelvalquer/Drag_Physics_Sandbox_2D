import { TURBO_LAYER } from './TurboAcousticTypes';

/**
 * Output scale of Turbo Acoustics 2.0 into the existing `turbo` channel (before CHANNEL_NORM and
 * the car's turboGain). Calibrated with scripts/audio-turbo-calibrate.ts so that a steady full-load
 * operating point has the same channel RMS as the legacy model (±1.5 dB): the A/B comparison is
 * level-matched and the existing mix balance of every car is preserved.
 */
export const TURBO_V2_OUTPUT = 0.78;

/** Energy normalization of a parallel twin: two incoherent rotors at 1/√2 keep the total power. */
export const TWIN_ROTOR_GAIN = Math.SQRT1_2;

/**
 * Sums the turbo layers into the single `turbo` channel. Inlet-side sources (rotor tones, whoosh,
 * flutter, recirculated valve) go through the duct path; the atmospheric valve and the wastegate
 * radiate directly. `mask` (TURBO_LAYER bits) isolates layers for the dev panel and the lab.
 */
export class TurboAcousticMixer {
  constructor(
    public mask: number = TURBO_LAYER.all,
    private readonly overall = 1,
  ) {}

  inlet(rotor: number, rotorAm: number, whoosh: number, flutter: number, recirculatedBov: number): number {
    const m = this.mask;
    return (
      (m & TURBO_LAYER.rotor ? rotor * rotorAm : 0) +
      (m & TURBO_LAYER.whoosh ? whoosh : 0) +
      (m & TURBO_LAYER.flutter ? flutter : 0) +
      (m & TURBO_LAYER.bov ? recirculatedBov : 0)
    );
  }

  output(ductOut: number, dryInlet: number, directBov: number, wastegate: number): number {
    const m = this.mask;
    const inlet = m & TURBO_LAYER.resonance ? ductOut : dryInlet;
    return (inlet + (m & TURBO_LAYER.bov ? directBov : 0) + (m & TURBO_LAYER.wastegate ? wastegate : 0)) * this.overall * TURBO_V2_OUTPUT;
  }
}
