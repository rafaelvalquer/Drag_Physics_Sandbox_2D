import { z } from 'zod';
import type { LaneResult, RacePhase } from '../race/RaceController';
import type { TreeLights } from '../scenes/renderTypes';

export const ONLINE_SIMULATION_VERSION = 1;
export const ONLINE_INPUT_HZ = 30;
export const ONLINE_SNAPSHOT_HZ = 20;

export const RaceInputSchema = z.strictObject({
  matchId: z.uuid(),
  sequence: z.int().min(0).max(2_147_483_647),
  observedTick: z.int().min(0),
  throttle: z.number().min(0).max(1),
  shift: z.union([z.literal(-1), z.literal(1)]).optional(),
  nitrous: z.boolean().optional(),
});

export type RaceInput = z.infer<typeof RaceInputSchema>;

export interface OnlineLaneSnapshot {
  x: number;
  speed: number;
  rpm: number;
  gear: number;
  pitch: number;
  wheelAngleDriven: number;
  wheelAngleFree: number;
  boostBar: number;
  result: LaneResult;
}

export interface OnlineRaceSnapshot {
  matchId: string;
  tick: number;
  phase: RacePhase;
  scheduledGreenTick: number | null;
  lights: TreeLights;
  lanes: [OnlineLaneSnapshot, OnlineLaneSnapshot];
  winner: number | null;
}
