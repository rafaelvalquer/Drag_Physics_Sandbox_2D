import type { CarConfig } from '../data/schema';
import type { RenderVehicle } from '../game/scenes/RaceScene';
import type { RunnerVehicle } from '../game/SimulationRunner';
import { artSignature } from '../game/vehicles/VehicleSpriteAssembler';

/** Distance of the listener from the near lane (m): a trackside microphone next to the player. */
export const LISTENER_OFFSET_M = 7;
const LANE_GAP_M = 1.9;
/** Afterfire is a single-step event in the physics; the flame sprite is held for this long. */
const FLAME_HOLD_S = 0.09;

/** Converts runner vehicles to scene render records and keeps per-vehicle visual timers. */
export class VehicleViews {
  private flame = new Map<string, number>();
  private artKeys = new Map<string, { sig: string; key: string }>();
  private keyCounter = 0;
  /** Optional display names per vehicle id (e.g. "IA avançado"). */
  readonly names = new Map<string, string>();

  /** Call once per physics step (after the step) to latch one-step events. */
  latch(vs: readonly RunnerVehicle[]): void {
    for (const v of vs) if (v.sim.engine.afterfire) this.flame.set(v.id, FLAME_HOLD_S);
  }

  render(vs: readonly RunnerVehicle[], dtS: number): RenderVehicle[] {
    return vs.map((v) => {
      const s = v.sim;
      const t = Math.max(0, (this.flame.get(v.id) ?? 0) - dtS);
      this.flame.set(v.id, t);
      return {
        id: v.id,
        car: s.car,
        x: s.x,
        lane: v.lane >= 1 ? 1 : 0,
        pitch: s.pitch,
        wheelAngleDriven: s.wheelAngleDriven,
        wheelAngleFree: s.wheelAngleFree,
        wheelOmegaDriven: s.driveline.v,
        wheelOmegaFree: s.speed / s.car.tires.radiusM,
        slipSpeed: s.driveline.v * s.car.tires.radiusM - s.speed,
        slipRatio: s.telemetry.slipRatio,
        speed: s.speed,
        accel: s.telemetry.acceleration,
        afterfire: t > 0,
        isPlayer: v.isPlayer,
        artKey: this.artKey(v.id, s.car),
        rpm: s.engine.rpm,
        running: s.engine.runState === 'RUNNING',
        cranking: s.engine.runState === 'CRANKING',
        braking: s.controls.autoBrake || s.controls.holdBrake,
        shifting: s.shift.active,
        load: s.engine.load,
        name: v.isPlayer ? 'Você' : (this.names.get(v.id) ?? s.car.name),
      };
    });
  }

  /** A new texture key whenever the art inputs change (edited visual config, wheels, wheelbase). */
  private artKey(id: string, car: CarConfig): string {
    const sig = artSignature(car);
    const k = this.artKeys.get(id);
    if (k && k.sig === sig) return k.key;
    const key = `${car.id}-${++this.keyCounter}`;
    this.artKeys.set(id, { sig, key });
    return key;
  }

  /**
   * Places every voice relative to a listener that travels with the reference vehicle (the
   * player), LISTENER_OFFSET_M beside the near lane. Opponents get distance attenuation, panning
   * and Doppler from the changing propagation delay; the player's own car stays centred.
   */
  spatialize(vs: readonly RunnerVehicle[], rampS: number): void {
    const ref = vs.find((v) => v.isPlayer) ?? vs[0];
    if (!ref) return;
    for (const v of vs) {
      if (!v.sound) continue;
      const dx = v.sim.x - v.sim.car.wheelbaseM * 0.5 - (ref.sim.x - ref.sim.car.wheelbaseM * 0.5);
      const dz = LISTENER_OFFSET_M + (v.lane >= 1 ? LANE_GAP_M : 0);
      v.sound.setSpatial(dx, Math.hypot(dx, dz), rampS);
    }
  }
}
