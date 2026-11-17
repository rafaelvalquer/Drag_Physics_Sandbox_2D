import { strainLevelHyst, type StrainLevel } from '../../physics/engine/EngineOverrevFailure';

/** Visual filter of the risk bar (s). Display only: the failure model keeps the real exposure. */
export const RISK_DISPLAY_TAU_S = 0.25;
/** Shortest time between two critical warning beeps (s). */
export const WARNING_COOLDOWN_S = 4;

export type RiskAlert = null | 'RPM EXCESSIVO' | 'TROQUE DE MARCHA!' | 'REDUZA O GIRO!';

export interface RiskInput {
  /** Real accumulated exposure 0..1. */
  exposure: number;
  broken: boolean;
  /** Filtered speed over the safe speed right now. */
  overrev: boolean;
  /** A gear is engaged and a higher one exists (a shift helps). */
  canUpshift: boolean;
}

export interface RiskView {
  /** Bar fill 0..1 (filtered for display). */
  shown: number;
  level: StrainLevel | 'broken';
  alert: RiskAlert;
  /** True on the frame the gauge enters the critical band (once per cooldown). */
  beep: boolean;
}

/**
 * HUD state of the blown-engine risk: the bar shows the accumulated exposure through a
 * frame-rate independent first-order filter, the bands use hysteresis (no flicker at a
 * threshold) and the over-rev alert is separate from the bar.
 */
export class StrainDisplay {
  private shown = 0;
  private level: StrainLevel = 'normal';
  private sinceBeep = Infinity;

  reset(): void {
    this.shown = 0;
    this.level = 'normal';
    this.sinceBeep = Infinity;
  }

  update(dtS: number, i: RiskInput): RiskView {
    const dt = Math.min(0.25, Math.max(0, dtS));
    this.sinceBeep += dt;
    if (i.broken) {
      this.shown = 1;
      return { shown: 1, level: 'broken', alert: null, beep: false };
    }
    this.shown += (i.exposure - this.shown) * (1 - Math.exp(-dt / RISK_DISPLAY_TAU_S));
    const prev = this.level;
    this.level = strainLevelHyst(i.exposure, prev);
    let beep = false;
    if (this.level === 'critical' && prev !== 'critical' && this.sinceBeep >= WARNING_COOLDOWN_S) {
      beep = true;
      this.sinceBeep = 0;
    }
    let alert: RiskAlert = null;
    if (i.overrev) alert = this.level === 'high' || this.level === 'critical' ? (i.canUpshift ? 'TROQUE DE MARCHA!' : 'REDUZA O GIRO!') : 'RPM EXCESSIVO';
    return { shown: this.shown, level: this.level, alert, beep };
  }
}
