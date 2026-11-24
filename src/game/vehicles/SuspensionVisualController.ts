import { STANDARD_GRAVITY } from '../../core/units';

/**
 * Visual suspension: a damped spring model of the body on its wheels, driven by the simulated
 * longitudinal acceleration. It only produces what is drawn (pitch, a small heave and the travel
 * at each axle); it never feeds anything back into the physics.
 *
 * Launch → the nose rises and the tail squats; a gear change interrupts the drive force, so the
 * body drops back and recovers when the clutch re-engages; braking pitches the nose down.
 */
export interface SuspensionInput {
  /** Longitudinal acceleration of the vehicle (m/s², from the physics). */
  accel: number;
  /** Road speed (m/s). */
  speed: number;
}

export interface SuspensionParams {
  wheelbaseM: number;
  cgHeightM: number;
  /** Natural frequency of the body on its springs (Hz) and damping ratio. */
  frequencyHz?: number;
  damping?: number;
}

export interface SuspensionState {
  /** Body pitch (rad), positive = nose up. */
  pitch: number;
  /** Vertical displacement of the body centre (m), positive = up. */
  heave: number;
  /** Suspension travel at each axle (m), positive = extended. */
  frontTravel: number;
  rearTravel: number;
}

const MAX_PITCH = 0.075;
const MAX_HEAVE = 0.045;
const MAX_STEP = 1 / 120;

export class SuspensionVisualController {
  private pitch = 0;
  private pitchV = 0;
  private heave = 0;
  private heaveV = 0;
  private readonly wn: number;
  private readonly zeta: number;
  /** Pitch per unit of acceleration (rad per m/s²): softer and taller cars move more. */
  readonly pitchGain: number;
  private readonly wb: number;

  constructor(p: SuspensionParams) {
    this.wn = 2 * Math.PI * (p.frequencyHz ?? 1.5);
    this.zeta = p.damping ?? 0.55;
    this.wb = p.wheelbaseM;
    this.pitchGain = (0.26 * (p.cgHeightM / p.wheelbaseM)) / STANDARD_GRAVITY;
  }

  reset(): void {
    this.pitch = 0;
    this.pitchV = 0;
    this.heave = 0;
    this.heaveV = 0;
  }

  /** A sudden push of the drive (nitrous): velocity added to the spring model, which then settles by itself. */
  kick(pitchRadPerS: number, heaveMPerS: number): void {
    if (Number.isFinite(pitchRadPerS)) this.pitchV += pitchRadPerS;
    if (Number.isFinite(heaveMPerS)) this.heaveV += heaveMPerS;
  }

  update(dt: number, input: SuspensionInput): SuspensionState {
    const a = Number.isFinite(input.accel) ? input.accel : 0;
    const v = Number.isFinite(input.speed) ? input.speed : 0;
    const pitchTarget = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitchGain * a));
    // the springs compress a little under any strong acceleration and with aerodynamic load
    const heaveTarget = Math.max(-MAX_HEAVE, -0.0011 * Math.abs(a) - 4e-6 * v * v);
    let remaining = Math.min(Math.max(dt, 0), 0.25);
    while (remaining > 1e-9) {
      const h = Math.min(MAX_STEP, remaining);
      remaining -= h;
      this.pitchV += (this.wn * this.wn * (pitchTarget - this.pitch) - 2 * this.zeta * this.wn * this.pitchV) * h;
      this.pitch += this.pitchV * h;
      this.heaveV += (this.wn * this.wn * (heaveTarget - this.heave) - 2 * this.zeta * this.wn * this.heaveV) * h;
      this.heave += this.heaveV * h;
    }
    if (!Number.isFinite(this.pitch) || !Number.isFinite(this.heave)) this.reset();
    this.pitch = Math.max(-MAX_PITCH * 1.4, Math.min(MAX_PITCH * 1.4, this.pitch));
    this.heave = Math.max(-MAX_HEAVE * 1.4, Math.min(MAX_HEAVE * 1.4, this.heave));
    return this.state;
  }

  get state(): SuspensionState {
    const half = this.wb / 2;
    return {
      pitch: this.pitch,
      heave: this.heave,
      frontTravel: this.heave + Math.sin(this.pitch) * half,
      rearTravel: this.heave - Math.sin(this.pitch) * half,
    };
  }
}
