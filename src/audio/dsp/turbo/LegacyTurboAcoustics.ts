import { Prng } from '../../../core/prng';
import { Biquad, OnePole } from '../Filters';
import { smoothstep } from './TurboRotorWhine';

const TWO_PI = 2 * Math.PI;

/**
 * The turbo sound before Turbo Acoustics 2.0 (formerly inline in AuxAcoustics), kept verbatim as
 * the "legacy" side of the A/B comparison: blade-pass whine only, one fixed 5.2 kHz hiss band,
 * BOV noise ∝ BOV flow and a periodically gated noise "surge" when no BOV is fitted.
 * Only change: it draws from its own noise generator (it used to share one with the transmission
 * clunk / clutch noise, so retuning the turbo changed the gearbox sound).
 */
export class LegacyTurboAcoustics {
  private readonly dt: number;
  private readonly nyq: number;
  private readonly rng: Prng;
  private turboPhase = 0;
  private turboPhase2 = 0;
  private surgePhase = 0;
  private readonly hissBp: Biquad;
  private readonly bovBp: Biquad;
  private readonly bovLp: OnePole;
  private readonly bovDuctLp: OnePole;
  out = 0;

  constructor(
    sampleRate: number,
    seed: number,
    private readonly blades: number,
    private readonly twinTurbo: boolean,
    private readonly bovFitted: boolean,
    private readonly bovRecirculating: boolean,
  ) {
    this.dt = 1 / sampleRate;
    this.nyq = sampleRate / 2;
    this.rng = new Prng(seed);
    this.hissBp = new Biquad(sampleRate).setBandpass(5200, 0.7);
    this.bovBp = new Biquad(sampleRate).setBandpass(2300, 1.1);
    this.bovLp = new OnePole(sampleRate, 6000);
    this.bovDuctLp = new OnePole(sampleRate, 1400);
  }

  process(turboShaftRpm: number, turboShaftRpm2: number | undefined, boostPa: number, throttle: number, bovFlow: number): number {
    const dt = this.dt;
    const rng = this.rng;
    const f = (turboShaftRpm / 60) * this.blades;
    const nyqFade = 1 - smoothstep(this.nyq * 0.8, this.nyq * 0.92, f);
    this.turboPhase += f * dt;
    this.turboPhase -= Math.floor(this.turboPhase);
    const boostBar = Math.max(0, boostPa) / 1e5;
    let whine = Math.sin(TWO_PI * this.turboPhase) * smoothstep(1500, 6000, f) * nyqFade * (0.25 + boostBar);
    if (this.twinTurbo) {
      const f2 = ((turboShaftRpm2 ?? turboShaftRpm) / 60) * this.blades;
      const nyqFade2 = 1 - smoothstep(this.nyq * 0.8, this.nyq * 0.92, f2);
      this.turboPhase2 += f2 * dt;
      this.turboPhase2 -= Math.floor(this.turboPhase2);
      whine = 0.6 * (whine + Math.sin(TWO_PI * this.turboPhase2) * smoothstep(1500, 6000, f2) * nyqFade2 * (0.25 + boostBar));
    }
    const hiss = this.hissBp.process(rng.bipolar()) * boostBar * (0.4 + throttle);
    let bov = 0;
    if (bovFlow > 0.002) {
      bov = this.bovBp.process(this.bovLp.lowpass(rng.bipolar())) * bovFlow * 3.2;
      if (this.bovRecirculating) bov = this.bovDuctLp.lowpass(bov) * 0.35;
    } else if (this.bovRecirculating) this.bovDuctLp.lowpass(0);
    let surge = 0;
    if (!this.bovFitted && boostBar > 0.15 && throttle < 0.12) {
      this.surgePhase += (12 + 10 * boostBar) * dt;
      this.surgePhase -= Math.floor(this.surgePhase);
      const gate = this.surgePhase < 0.35 ? Math.sin((Math.PI * this.surgePhase) / 0.35) : 0;
      surge = this.bovBp.process(rng.bipolar()) * gate * boostBar * 2.5;
    }
    this.out = whine * 0.35 + hiss * 0.8 + bov + surge;
    return this.out;
  }
}
