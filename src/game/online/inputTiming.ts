import { PHYSICS_DT } from '../SimulationRunner';

export const MAX_INPUT_DELAY_TICKS = 12;

/** Equalize part of the round-trip difference at reception, without rewinding physics. */
export function inputDelayTicks(rttMs: number | undefined, opponentRttMs: number | undefined): number {
  if (rttMs === undefined || opponentRttMs === undefined) return 0;
  return Math.min(MAX_INPUT_DELAY_TICKS, Math.max(0, Math.round((opponentRttMs - rttMs) / (2_000 * PHYSICS_DT))));
}
