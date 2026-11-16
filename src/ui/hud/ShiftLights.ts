import type { CarConfig } from '../../data/schema';
import { optimalShiftRpms } from '../../game/ai/DragAI';

/**
 * Progressive shift lights. The target of each gear is the engine speed where the next gear
 * starts to pull harder at the wheels – computed from that car's torque curve and gear ratios –
 * so every car lights up at its own points. In top gear there is nothing to shift into.
 */
export const SHIFT_LIGHT_COUNT = 9;

export interface ShiftLightState {
  /** Number of lights lit (0..SHIFT_LIGHT_COUNT). */
  lit: number;
  /** All lights flash: shift now. */
  flash: boolean;
}

/** Best upshift speed for each gear (index 0 = first gear); null where no upshift exists. */
export function shiftTargets(car: CarConfig): (number | null)[] {
  const pts = optimalShiftRpms(car);
  return car.transmission.gearRatios.map((_, i) => (i < car.transmission.gearRatios.length - 1 ? (pts[i] ?? null) : null));
}

/** Width of the window (rpm) below the target over which the lights come on one by one. */
export function shiftWindow(targetRpm: number): number {
  return Math.max(900, targetRpm * 0.17);
}

export function shiftLightState(rpm: number, targetRpm: number | null): ShiftLightState {
  if (targetRpm === null || !Number.isFinite(rpm)) return { lit: 0, flash: false };
  if (rpm >= targetRpm) return { lit: SHIFT_LIGHT_COUNT, flash: true };
  const span = shiftWindow(targetRpm);
  const t = (rpm - (targetRpm - span)) / span;
  return { lit: Math.max(0, Math.min(SHIFT_LIGHT_COUNT - 1, Math.floor(t * SHIFT_LIGHT_COUNT))), flash: false };
}

export class ShiftLights {
  readonly el: HTMLElement;
  private readonly leds: HTMLElement[] = [];
  private lastKey = '';

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'shift-lights';
    this.el.setAttribute('data-testid', 'shift-lights');
    for (let i = 0; i < SHIFT_LIGHT_COUNT; i++) {
      const led = document.createElement('span');
      led.className = `led ${i < 4 ? 'g' : i < 7 ? 'a' : 'r'}`;
      this.leds.push(led);
      this.el.append(led);
    }
  }

  update(state: ShiftLightState, timeS: number): void {
    // the flash blinks at 8 Hz
    const blinkOn = !state.flash || Math.floor(timeS * 16) % 2 === 0;
    const key = `${state.lit}|${state.flash ? (blinkOn ? 'f1' : 'f0') : ''}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.leds.forEach((led, i) => led.classList.toggle('on', i < state.lit && blinkOn));
    this.el.classList.toggle('flash', state.flash);
    this.el.dataset.lit = String(state.lit);
  }
}
