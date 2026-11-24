import { z } from 'zod';
import type { EngineRunState } from '../../core/contracts';
import type { CarConfig } from '../../data/schema';
import type { LaneResult, RacePhase } from '../race/RaceController';
import type { TreeLights } from '../scenes/renderTypes';

export const ONLINE_SIMULATION_VERSION = 1;
export const ONLINE_INPUT_HZ = 30;
export const ONLINE_SNAPSHOT_HZ = 20;
export const COMPETITIVE_ROOM = 'competitive_drag';

export interface OnlineLobbyState {
  phase: 'queue' | 'lobby' | 'loading';
  lane: 0 | 1;
  serverTime: number;
  deadline: number | null;
  players: { nickname: string; rp: number; selectedCar: string | null; confirmed: boolean }[];
  cars: { id: string; name: string; powerCv: number; torqueNm: number }[];
  selectedCarId: string | null;
  trackId: string;
  distanceId: 'quarter';
}

export interface OnlineLoadingState {
  matchId: string;
  lane: 0 | 1;
  cars: [CarConfig, CarConfig];
  names: [string, string];
  ownCarId: string;
}

const finite = z.number().finite();
export const OnlineTuneSchema = z.strictObject({
  boostBar: finite.optional(), revLimitRpm: finite.optional(), launchRpm: finite.optional(),
  shiftRpm: finite.optional(), tirePressureKpa: finite.optional(), nitrousFlow: finite.optional(), nitrousRampS: finite.optional(),
  throttleResponse: z.enum(['soft', 'standard', 'sharp']).optional(),
  finalDrive: z.enum(['short', 'standard', 'long']).optional(),
});

export const OnboardingSchema = z.strictObject({
  nickname: z.string().trim().min(3).max(24).regex(/^[\p{L}\p{N}_ -]+$/u),
  baseCarId: z.string().max(80), termsAccepted: z.literal(true), useGoogleAvatar: z.boolean(),
});

const carId = z.uuid();
const partId = z.string().min(1).max(120);
const paint = z.string().regex(/^#[a-f0-9]{6}$/i);
const buildRevision = z.int().min(0);
export const GarageOperationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('buy'), baseCarId: z.string().max(80), paint: paint.optional() }),
  z.strictObject({ kind: z.literal('sell'), carId, confirmed: z.literal(true) }),
  z.strictObject({ kind: z.literal('select'), carId }),
  z.strictObject({ kind: z.literal('paint'), carId, paint }),
  z.strictObject({ kind: z.literal('unlock'), carId, nodeId: z.string().max(80) }),
  z.strictObject({ kind: z.literal('buyPart'), carId, partId }),
  z.strictObject({ kind: z.literal('install'), carId, partId, buildRevision }),
  z.strictObject({ kind: z.literal('remove'), carId, partId, buildRevision }),
  z.strictObject({ kind: z.literal('tune'), carId, tune: OnlineTuneSchema, buildRevision }),
]);

export const GarageRequestSchema = z.strictObject({ operationId: z.uuid(), operation: GarageOperationSchema });
export type Onboarding = z.infer<typeof OnboardingSchema>;
export type GarageRequest = z.infer<typeof GarageRequestSchema>;

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
  audioFrame: number[];
  runState: EngineRunState;
  pedal: number;
  braking: boolean;
  shifting: boolean;
  targetGear: number;
  wheelOmegaDriven: number;
  wheelOmegaFree: number;
  slipRatio: number;
  accel: number;
  nitrous: number;
  result: LaneResult;
}

export interface OnlineRaceSnapshot {
  matchId: string;
  sentAt?: number;
  tick: number;
  phase: RacePhase;
  scheduledGreenTick: number | null;
  lights: TreeLights;
  lanes: [OnlineLaneSnapshot, OnlineLaneSnapshot];
  winner: number | null;
}
