import { clamp01 } from '../../core/math';
import type { EngineConfig } from '../../data/schema';
import { engineGeometry } from './EngineGeometry';

/** Warm starting conditions and lumped heat capacities for the coolant/block and oil circuit. */
export class EngineThermalModel {
  coolantC = 88;
  oilC = 94;
  private readonly liters: number;

  constructor(private readonly config: EngineConfig, displacementM3 = engineGeometry(config).displacement) {
    this.liters = displacementM3 * 1000;
  }

  reset(): void {
    this.coolantC = 88;
    this.oilC = 94;
  }

  step(dt: number, indicatedPowerW: number, ambientC: number, speedMps: number): void {
    const cooling = this.config.cooling;
    const flow = Math.min(1.4, Math.abs(speedMps) / 25);
    const thermostat = clamp01((this.coolantC - 82) / 12);
    const fan = clamp01((this.coolantC - 91) / 7);
    const airSide = 0.16 + 0.6 * flow;
    const fanSide = 0.44 * fan * (cooling?.fanFlowScale ?? 1) / (1 + 2 * flow);
    const coolantOut = thermostat * this.liters * 245 * (cooling?.radiatorScale ?? 1) *
      (airSide + fanSide) * Math.max(0, this.coolantC - ambientC);
    const oilOut = this.liters * 38 * (cooling?.oilCoolerScale ?? 1) *
      (0.45 + 0.5 * flow) * Math.max(0, this.oilC - ambientC);
    const oilToCoolant = this.liters * 55 * (this.oilC - this.coolantC);
    this.coolantC += dt * (0.40 * indicatedPowerW + oilToCoolant - coolantOut) / (this.liters * 31000);
    this.oilC += dt * (0.11 * indicatedPowerW - oilToCoolant - oilOut) / (this.liters * 10500);
  }

  /** Spark protection begins above the normal operating range, without changing the cold map. */
  get torqueFraction(): number {
    const excess = Math.max(this.coolantC - 112, (this.oilC - 137) * 0.65);
    return 1 - 0.32 * clamp01(excess / 28);
  }
}
