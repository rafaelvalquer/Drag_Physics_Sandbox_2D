import { z } from 'zod';
import { CHAPTER_1_ID } from './CareerEvents';

/**
 * Career save (one document per slot, so every operation is a single atomic write).
 * Versioned: `version` is the save format; `migrateCareerSave` upgrades older documents.
 */
export const CAREER_SAVE_VERSION = 1;
export const DEFAULT_SLOT = 'slot-1';
/** Budget the player has to buy the first car. */
export const START_CREDITS = 4500;
/** Results kept in the save (the most recent). */
export const MAX_RESULTS = 120;

export const STARTER_CARS = [
  { baseCarId: 'vw-gol-gts-1988', price: 800 },
  { baseCarId: 'gm-chevette-sl-1988', price: 1400 },
  { baseCarId: 'fiat-uno-mille-1995', price: 2200 },
] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const iso = z.string().min(10).max(40);

export const OwnedCarSchema = z.object({
  id: z.string().min(1).max(64),
  baseCarId: z.string().min(1).max(64),
  nickname: z.string().min(1).max(32),
  paint: z.object({ color: hex, accent: hex }),
  installedParts: z.array(z.string().min(1).max(64)).max(40),
  /** Dyno settings of the engine tuners (absent = kit defaults). */
  tune: z.object({ boostBar: z.number().min(0.3).max(1.8).optional() }).optional(),
  acquiredAt: iso,
});
export type OwnedCar = z.infer<typeof OwnedCarSchema>;

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

export const CareerSaveSchema = z
  .object({
    version: z.literal(CAREER_SAVE_VERSION),
    slotId: z.string().min(1).max(32),
    chapterId: z.literal(CHAPTER_1_ID),
    /** Optimistic-concurrency counter: every write increments it. */
    revision: z.number().int().min(0),
    credits: z.number().int().min(0),
    reputation: z.number().int().min(0),
    ownedCars: z.array(OwnedCarSchema).max(12),
    activeCarId: z.string().nullable(),
    inventoryPartIds: z.array(z.string()).max(256),
    completedEventIds: z.array(z.string()),
    claimedRewardIds: z.array(z.string()),
    seenStorySceneIds: z.array(z.string()),
    results: z.array(CareerRaceResultSchema).max(MAX_RESULTS),
    chapterCompletedAt: iso.nullable(),
    createdAt: iso,
    updatedAt: iso,
  })
  .superRefine((s, ctx) => {
    if (s.activeCarId !== null && !s.ownedCars.some((c) => c.id === s.activeCarId))
      ctx.addIssue({ code: 'custom', message: 'carro ativo não está na garagem' });
    const ids = s.ownedCars.map((c) => c.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'carros com o mesmo id' });
    const att = s.results.map((r) => r.attemptId);
    if (new Set(att).size !== att.length) ctx.addIssue({ code: 'custom', message: 'tentativas repetidas' });
  });
export type CareerSave = z.infer<typeof CareerSaveSchema>;

export function newCareerSave(slotId = DEFAULT_SLOT, now = new Date()): CareerSave {
  const t = now.toISOString();
  return {
    version: CAREER_SAVE_VERSION,
    slotId,
    chapterId: CHAPTER_1_ID,
    revision: 0,
    credits: START_CREDITS,
    reputation: 0,
    ownedCars: [],
    activeCarId: null,
    inventoryPartIds: [],
    completedEventIds: [],
    claimedRewardIds: [],
    seenStorySceneIds: [],
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

/** Upgrades older save formats. Version 1 is the first one: nothing to migrate yet. */
export function migrateCareerSave(input: unknown): unknown {
  return input;
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
