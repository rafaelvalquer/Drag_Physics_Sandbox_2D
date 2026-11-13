import type { TransmissionConfig } from '../../data/schema';

/**
 * Sequential gearbox: gear 0 = neutral, 1..n forward gears. The dog engagement is binary;
 * while `engaged` is false the gearbox output is decoupled from the clutch (neutral path).
 *
 * The overall reduction between the clutch disc and the driven wheels is
 *   G = gearRatio · finalDrive
 * so that  ω_clutchDisc = G · ω_wheel  and  T_wheel = G · T_clutch (minus mesh losses).
 */
export class Gearbox {
  gear = 0;
  engaged = false;

  constructor(public cfg: TransmissionConfig) {}

  get gearCount(): number {
    return this.cfg.gearRatios.length;
  }

  ratioOf(gear: number): number {
    if (gear <= 0 || gear > this.cfg.gearRatios.length) return 0;
    return this.cfg.gearRatios[gear - 1]!;
  }

  /** Overall ratio of a gear (gear × final drive). 0 for neutral. */
  overallRatio(gear: number): number {
    return this.ratioOf(gear) * this.cfg.finalDrive;
  }

  /** Overall ratio currently transmitting (0 when disengaged / neutral). */
  get activeRatio(): number {
    return this.engaged ? this.overallRatio(this.gear) : 0;
  }

  /** Inertia reflected to the driven wheels by the gearbox input shaft + clutch disc. */
  reflectedInputInertia(): number {
    const g = this.activeRatio;
    return this.cfg.inputInertiaKgM2 * g * g;
  }

  reset(): void {
    this.gear = 0;
    this.engaged = false;
  }
}
