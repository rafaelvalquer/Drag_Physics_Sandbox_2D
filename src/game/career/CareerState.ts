import { z } from 'zod';
import { CHAPTER_1_ID, CHAPTER_2_ID, CHAPTER_IDS, type ChapterId } from './chapters';
import {
  buildTuneSchema, freeEventDetailsSchema, freeOfferSchema, freeStatsSchema, MAX_FREE_OFFERS,
  MAX_FREE_RESULTS, paintSchema, RECENT_FREE_OPPONENTS,
} from './freeEvents/FreeEventTypes';
import { addFreeStats, freeChapterOf, newFreeStats } from './freeEvents/FreeEventHistory';

/**
 * Career save (one document per slot, so every operation is a single atomic write).
 * Versioned: `version` is the save format; `migrateCareerSave` upgrades older documents.
 *  - v1: chapter 1 only.
 *  - v2: several chapters (unlocked chapters, active chapter, completion per chapter, story
 *    milestones), the build resolver version of every owned car, gearbox preference per car and
 *    the price paid (resale). A v1 save is migrated without losing anything: cars, credits, parts,
 *    reputation, results and seen dialogues are kept; its cars keep resolver version 1.
 *  - v3: Dyno Lab settings per car (cut, launch speed, throttle map, final drive preset, shift
 *    speed, tyre pressure next to the boost). A v2 save is migrated as it is: its boost setting
 *    (the only v2 setting) is kept and the new settings are absent (= hardware default).
 *  - v4: persistent free race boards, dedicated results and cumulative statistics.
 */
export const CAREER_SAVE_VERSION = 4;
export const DEFAULT_SLOT = 'slot-1';
/** Budget the player has to buy the first car. */
export const START_CREDITS = 4500;
/** Results kept in the save (the most recent). */
export const MAX_RESULTS = 120;

export const STARTER_CARS = [
  { baseCarId: 'fiat-uno-mille-1995', price: 800 },
  { baseCarId: 'gm-chevette-sl-1988', price: 1400 },
  { baseCarId: 'vw-gol-gts-1988', price: 2200 },
] as const;

/** Most cars a garage holds. */
export const MAX_GARAGE = 16;

const iso = z.string().min(10).max(40);

export const OwnedCarSchema = z.object({
  id: z.string().min(1).max(64),
  baseCarId: z.string().min(1).max(64),
  nickname: z.string().min(1).max(32),
  paint: paintSchema,
  installedParts: z.array(z.string().min(1).max(64)).max(40),
  /** Dyno settings of the engine tuners (absent = kit / ECU defaults). */
  tune: buildTuneSchema.optional(),
  /**
   * Build resolver version of this car (1: chapter 1 resolver). A car stays at 1 until a part of
   * version 2 is installed; then it moves to 2 for good (on a chapter 1 build both give the same car).
   */
  buildVersion: z.union([z.literal(1), z.literal(2)]).default(1),
  /** Price paid (CR); resale value derives from it. */
  purchasePrice: z.number().int().min(0).optional(),
  /** Set on a car won as the prize of a chapter's final (the event it came from): the trophy badge. */
  prizeEventId: z.string().min(1).max(64).optional(),
  acquiredAt: iso,
});
export type OwnedCar = z.infer<typeof OwnedCarSchema>;

export const ChapterIdSchema = z.enum(CHAPTER_IDS);

export const RunSummarySchema = z.object({
  name: z.string().max(64),
  rt: z.number().nullable(),
  et: z.number().nullable(),
  /** Time from the green light to the finish line (RT + ET). */
  total: z.number().nullable(),
  trapKmh: z.number().nullable(),
  redLight: z.boolean(),
  finished: z.boolean(),
  dnf: z.boolean(),
  /** Why the run did not finish (absent in results of older versions). */
  dnfReason: z.enum(['timeout', 'engine-blown']).optional(),
  /** Engine speed when the engine broke (rpm). */
  blownAtRpm: z.number().optional(),
  /** Measured times from the stage beam at the official splits (s), by split id: 'eighth' (201 m), 'quarter' (402 m), 'km'. Absent in older results. */
  splitsS: z.record(z.string().max(16), z.number()).optional(),
  /** Highest engine speed of the run (rpm). */
  maxRpm: z.number().optional(),
  /** Gears used in the run, ascending. */
  gearsUsed: z.array(z.number().int().min(0).max(12)).max(12).optional(),
  launchRpm: z.number().optional(),
  maxSlipRatio: z.number().optional(),
  wheelspinS: z.number().optional(),
  shiftRpms: z.array(z.number()).optional(),
  clutchSlipS: z.number().optional(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const OutcomeSchema = z.enum(['win', 'loss', 'red-light', 'dnf']);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const CareerRaceResultSchema = z.object({
  attemptId: z.string().min(8).max(80),
  eventId: z.string(),
  playerCarId: z.string(),
  opponentCarId: z.string(),
  playerResult: RunSummarySchema,
  opponentResult: RunSummarySchema,
  outcome: OutcomeSchema,
  completedAt: iso,
  /** Build resolver version and the resolved build keys of both cars. */
  buildVersion: z.number().int(),
  playerBuildKey: z.string().max(1200),
  opponentBuildKey: z.string().max(1200),
  creditsAwarded: z.number().int().min(0),
  reputationAwarded: z.number().int().min(0),
});
export type CareerRaceResult = z.infer<typeof CareerRaceResultSchema>;

export const FreeRaceResultSchema = CareerRaceResultSchema.extend({
  chapter: ChapterIdSchema,
  /** Earlier free races did not store their track, paint or installed parts. */
  details: freeEventDetailsSchema.optional(),
});
export type FreeRaceResult = z.infer<typeof FreeRaceResultSchema>;

const FreeEventsStateSchema = z.object({
  seed: z.number().int().min(0).max(0xffffffff),
  nextSequence: z.number().int().positive(),
  offersByChapter: z.record(ChapterIdSchema, z.array(freeOfferSchema).max(MAX_FREE_OFFERS)),
  recentFingerprints: z.array(z.object({
    fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
    baseCarId: z.string().min(1).max(64),
    color: paintSchema.shape.color,
  })).max(RECENT_FREE_OPPONENTS),
  results: z.array(FreeRaceResultSchema).max(MAX_FREE_RESULTS),
  stats: z.record(ChapterIdSchema, freeStatsSchema),
}).superRefine((state, ctx) => {
  const offers = CHAPTER_IDS.flatMap((chapter) => {
    const board = state.offersByChapter[chapter];
    if (board.some((offer) => offer.chapter !== chapter || freeChapterOf(offer.id) !== chapter ||
        Number(offer.id.split('-').at(-1)) >= state.nextSequence) ||
        new Set(board.map((offer) => `${offer.tier}/${offer.slot}`)).size !== board.length)
      ctx.addIssue({ code: 'custom', message: 'quadro de eventos livres inválido' });
    return board;
  });
  if (new Set(offers.map((offer) => offer.id)).size !== offers.length ||
      new Set(offers.map((offer) => offer.opponent.fingerprint)).size !== offers.length)
    ctx.addIssue({ code: 'custom', message: 'ofertas livres repetidas' });
  if (state.results.some((result) => result.chapter !== freeChapterOf(result.eventId) || result.reputationAwarded !== 0) ||
      CHAPTER_IDS.some((chapter) => state.stats[chapter].wins > state.stats[chapter].races))
    ctx.addIssue({ code: 'custom', message: 'resultado livre inválido' });
});
export type FreeEventsState = z.infer<typeof FreeEventsStateSchema>;

function newFreeEvents(seed: number): FreeEventsState {
  return {
    seed, nextSequence: 1,
    offersByChapter: { 'chapter-1': [], 'chapter-2': [], 'chapter-3': [] },
    recentFingerprints: [], results: [],
    stats: { 'chapter-1': newFreeStats(), 'chapter-2': newFreeStats(), 'chapter-3': newFreeStats() },
  };
}

export const CareerSaveSchema = z
  .object({
    version: z.literal(CAREER_SAVE_VERSION),
    slotId: z.string().min(1).max(32),
    /** Active chapter (the one the garage and the map show). */
    chapterId: ChapterIdSchema,
    unlockedChapters: z.array(ChapterIdSchema).min(1),
    /** Completion time of each completed chapter. */
    chapterCompletions: z.record(z.string(), iso),
    /** Optimistic-concurrency counter: every write increments it. */
    revision: z.number().int().min(0),
    credits: z.number().int().min(0),
    freeEvents: FreeEventsStateSchema,
    reputation: z.number().int().min(0),
    ownedCars: z.array(OwnedCarSchema).max(MAX_GARAGE),
    activeCarId: z.string().nullable(),
    inventoryPartIds: z.array(z.string()).max(256),
    completedEventIds: z.array(z.string()),
    claimedRewardIds: z.array(z.string()),
    seenStorySceneIds: z.array(z.string()),
    /** Story milestones (chapter started, characters met, titles won). */
    storyMilestones: z.array(z.string().max(64)).max(64),
    results: z.array(CareerRaceResultSchema).max(MAX_RESULTS),
    /** Completion of chapter 1 (kept from v1; chapterCompletions holds every chapter). */
    chapterCompletedAt: iso.nullable(),
    createdAt: iso,
    updatedAt: iso,
  })
  .superRefine((s, ctx) => {
    if (s.activeCarId !== null && !s.ownedCars.some((c) => c.id === s.activeCarId))
      ctx.addIssue({ code: 'custom', message: 'carro ativo não está na garagem' });
    const ids = s.ownedCars.map((c) => c.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'carros com o mesmo id' });
    const att = [...s.results, ...s.freeEvents.results].map((r) => r.attemptId);
    if (new Set(att).size !== att.length) ctx.addIssue({ code: 'custom', message: 'tentativas repetidas' });
    if (!s.unlockedChapters.includes(s.chapterId)) ctx.addIssue({ code: 'custom', message: 'capítulo ativo não está liberado' });
    for (const k of Object.keys(s.chapterCompletions))
      if (!(CHAPTER_IDS as readonly string[]).includes(k)) ctx.addIssue({ code: 'custom', message: `capítulo desconhecido: ${k}` });
  });
export type CareerSave = z.infer<typeof CareerSaveSchema>;

export function newCareerSave(slotId = DEFAULT_SLOT, now = new Date()): CareerSave {
  const t = now.toISOString();
  return {
    version: CAREER_SAVE_VERSION,
    slotId,
    chapterId: CHAPTER_1_ID,
    unlockedChapters: [CHAPTER_1_ID],
    chapterCompletions: {},
    revision: 0,
    credits: START_CREDITS,
    freeEvents: newFreeEvents(Math.floor(Math.random() * 0x100000000)),
    reputation: 0,
    ownedCars: [],
    activeCarId: null,
    inventoryPartIds: [],
    completedEventIds: [],
    claimedRewardIds: [],
    seenStorySceneIds: [],
    storyMilestones: [],
    results: [],
    chapterCompletedAt: null,
    createdAt: t,
    updatedAt: t,
  };
}

export type ParseResult = { ok: true; save: CareerSave } | { ok: false; errors: string[] };

/** Validates (and migrates) an unknown document into a career save. */
export function parseCareerSave(input: unknown): ParseResult {
  const migrated = migrateCareerSave(input);
  const r = CareerSaveSchema.safeParse(migrated);
  if (r.success) return { ok: true, save: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`) };
}

/**
 * Upgrades older save formats, one version at a time. Never drops data: an unknown or newer
 * document is returned as it is and the schema rejects it with a message.
 */
export function migrateCareerSave(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  let doc = input as Record<string, unknown>;
  if (doc.version === 1) doc = migrateV1toV2(doc);
  if (doc.version === 2) doc = migrateV2toV3(doc);
  if (doc.version === 3) doc = migrateV3toV4(doc);
  return doc;
}

/**
 * v1 → v2. The chapter id of v1 ("chapter-1") stays the active chapter; a career that already
 * completed chapter 1 gets chapter 2 unlocked (the player opens it from the garage). Owned cars
 * keep resolver version 1, so their builds resolve exactly as before.
 */
function migrateV1toV2(v1: Record<string, unknown>): Record<string, unknown> {
  const completedAt = typeof v1.chapterCompletedAt === 'string' ? v1.chapterCompletedAt : null;
  const cars = Array.isArray(v1.ownedCars) ? v1.ownedCars : [];
  const chapter: ChapterId = v1.chapterId === CHAPTER_1_ID ? CHAPTER_1_ID : (v1.chapterId as ChapterId);
  return {
    ...v1,
    version: 2,
    chapterId: chapter,
    unlockedChapters: completedAt ? [CHAPTER_1_ID, CHAPTER_2_ID] : [CHAPTER_1_ID],
    chapterCompletions: completedAt ? { [CHAPTER_1_ID]: completedAt } : {},
    storyMilestones: completedAt ? ['chapter-1-complete'] : [],
    ownedCars: cars.map((c) => (c && typeof c === 'object' ? { ...(c as object), buildVersion: 1 } : c)),
  };
}

/** v2 → v3: the settings format only grew (every new field is optional): nothing else changes. */
function migrateV2toV3(v2: Record<string, unknown>): Record<string, unknown> {
  return { ...v2, version: 3 };
}

export function migrateV3toV4(v3: Record<string, unknown>): Record<string, unknown> {
  const seed = typeof v3.freeEventRotation === 'number' ? v3.freeEventRotation >>> 0 : 0;
  const freeEvents = newFreeEvents(seed);
  const results = Array.isArray(v3.results) ? v3.results.filter((value: unknown) => {
    const parsed = CareerRaceResultSchema.safeParse(value);
    if (!parsed.success) return true; // the final schema still reports invalid legacy data
    const r = parsed.data;
    const chapter = freeChapterOf(r.eventId);
    if (!chapter) return true;
    freeEvents.results.push({ ...r, chapter });
    addFreeStats(freeEvents.stats[chapter], r);
    return false;
  }) : v3.results;
  return { ...v3, version: 4, results, freeEvents };
}

/** Export file: the save wrapped with a format tag. */
export const EXPORT_FORMAT = 'drag-physics-sandbox-2d/career';

export function exportCareer(save: CareerSave): string {
  return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), save }, null, 2);
}

export function importCareer(text: string): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['arquivo não é JSON válido'] };
  }
  if (!doc || typeof doc !== 'object' || (doc as { format?: unknown }).format !== EXPORT_FORMAT)
    return { ok: false, errors: ['arquivo não é um save de campanha deste jogo'] };
  return parseCareerSave((doc as { save?: unknown }).save);
}
