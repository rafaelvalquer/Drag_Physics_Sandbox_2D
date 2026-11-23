import { z } from 'zod';
import { CHAPTER_IDS } from '../chapters';
import type { CareerEventDef, RivalDef } from '../CareerEvents';

export const FREE_TIERS = ['iniciante', 'rua', 'preparado', 'competicao'] as const;
export type FreeTier = (typeof FREE_TIERS)[number];
export const FREE_TIER_LABEL: Record<FreeTier, string> = {
  iniciante: 'Iniciante', rua: 'Rua', preparado: 'Preparado', competicao: 'Competição',
};
export const FREE_DISTANCES = ['eighth', 'quarter', 'km'] as const;
export const FREE_DISTANCE_LABEL = { eighth: '201 m', quarter: '402 m', km: '1.000 m' };
export const MAX_FREE_RESULTS = 120;
export const RECENT_FREE_OPPONENTS = 30;
export const MAX_FREE_OFFERS = FREE_TIERS.length * 3;

export const paintSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const buildTuneSchema = z.object({
  boostBar: z.number().min(0.3).max(2.2).optional(),
  revLimitRpm: z.number().int().min(2000).max(13000).optional(),
  launchRpm: z.number().int().min(800).max(12000).optional(),
  throttleResponse: z.enum(['soft', 'standard', 'sharp']).optional(),
  finalDrive: z.enum(['short', 'standard', 'long']).optional(),
  shiftRpm: z.number().int().min(1500).max(13000).optional(),
  tirePressureKpa: z.number().int().min(100).max(320).optional(),
  nitrousMode: z.enum(['single', 'dual']).optional(),
  nitrousShare: z.number().min(0.2).max(0.8).optional(),
  nitrousFlow1: z.number().min(0.25).max(1).optional(),
  nitrousRamp1: z.number().min(0).max(3).optional(),
  nitrousFlow2: z.number().min(0.25).max(1).optional(),
  nitrousRamp2: z.number().min(0).max(3).optional(),
});

const id = z.string().min(1).max(64);
const version = z.union([z.literal(1), z.literal(2)]);
const installedParts = z.array(id).max(40);
const counter = z.number().int().nonnegative();
const buildSnapshot = z.object({ buildVersion: version, installedParts, tune: buildTuneSchema });
const aiProfile = z.object({
  reactionMeanS: z.number().min(0).max(2),
  reactionJitterS: z.number().min(0).max(1),
  traction: z.object({
    slipFraction: z.number().positive().max(4),
    forceFraction: z.number().positive().max(2),
    trimGain: z.number().positive().max(10),
    updateHz: z.number().positive().max(120),
  }).nullable(),
  shiftOffsetRpm: z.number().min(-2000).max(500),
  shiftJitterRpm: z.number().min(0).max(1000),
  jumpStartChance: z.number().min(0).max(1),
});
export const freeTrackIds = [
  'distrito-industrial', 'baixada', 'avenida-norte',
  'patio-das-torres', 'distrito-financeiro', 'corredor-da-liga',
  'marginal-alta', 'hangar-executivo', 'pier-elite',
] as const;
export const FREE_PORTRAITS = ['eduardo', 'roberto', 'fernando', 'leonardo', 'caio', 'camila', 'ricardo', 'hugo', 'davi', 'renata'] as const;

export const freeEventDetailsSchema = z.object({
  tier: z.enum(FREE_TIERS),
  trackId: z.enum(freeTrackIds),
  distance: z.enum(FREE_DISTANCES),
  paintName: z.string().min(1).max(48),
  paint: paintSchema,
  preparation: z.string().min(1).max(64),
  carName: z.string().min(1).max(64),
});

const opponentSchema = buildSnapshot.extend({
  seed: counter.max(0xffffffff),
  generatorVersion: z.number().int().positive(),
  baseCarId: id,
  paint: paintSchema,
  driverName: id,
  driverNickname: id,
  portrait: z.enum(FREE_PORTRAITS),
  skill: aiProfile,
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
});

export const freeAttemptSchema = buildSnapshot.extend({
  id: z.string().min(8).max(80),
  carId: id,
  baseCarId: id,
  buildKey: z.string().min(1).max(1200),
});
export type FreeAttempt = z.infer<typeof freeAttemptSchema>;

export const freeOfferSchema = freeEventDetailsSchema.extend({
  id: id.regex(/^free-[123]-v4-[0-9]+$/),
  chapter: z.enum(CHAPTER_IDS),
  slot: z.number().int().min(0).max(2),
  rewardCr: counter,
  estimatedS: z.number().positive().max(120),
  opponent: opponentSchema,
  attemptsStarted: counter,
  pendingAttempt: freeAttemptSchema.optional(),
});
export type FreeOffer = z.infer<typeof freeOfferSchema>;
export type GeneratedFreeOpponent = FreeOffer['opponent'];

/** Adapter for the shared confrontation, race and result screens. */
export interface FreeRaceOffer {
  offer: FreeOffer;
  event: CareerEventDef;
  rival: RivalDef;
}

export const freeStatsSchema = z.object({
  races: counter,
  wins: counter,
  creditsEarned: counter,
  bestEt: z.partialRecord(z.enum(FREE_DISTANCES), z.number().positive()),
  tierRaces: z.partialRecord(z.enum(FREE_TIERS), counter),
});
export type FreeStats = z.infer<typeof freeStatsSchema>;
