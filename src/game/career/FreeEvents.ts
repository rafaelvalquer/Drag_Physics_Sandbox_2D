import { CHAPTER1_CARS } from '../../data/cars/campaign';
import { CHAPTER2_CARS } from '../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../data/cars/chapter3/index';
import type { CarConfig } from '../../data/schema';
import { AI_PROFILES } from '../ai/DragAI';
import { resolveBuild } from './tuning/BuildResolver';
import { incompatibility } from './tuning/BuildResolverV2';
import { ALL_PARTS, type PartDef } from './tuning/parts';
import { CHAPTER_1_ID, CHAPTER_2_ID, CHAPTER_3_ID, type ChapterId } from './chapters';
import type { CareerEventDef, CareerTrackId, PortraitId, RivalDef } from './CareerEvents';

/**
 * Events are pure functions of the persisted rotation, chapter and tier. A preview and a race
 * therefore use the exact same model, color, hardware and opponent AI, even after a reload.
 * No campaign rival, story unlock or prize is ever involved.
 */
export const FREE_TIERS = ['bairro', 'preparado', 'elite'] as const;
export type FreeTier = (typeof FREE_TIERS)[number];

export interface FreeEventOffer {
  rotation: number;
  tier: FreeTier;
  event: CareerEventDef;
  rival: RivalDef;
  signature: string;
  powerCv: number;
  torqueNm: number;
}

export const FREE_REWARDS: Record<ChapterId, Record<FreeTier, number>> = {
  [CHAPTER_1_ID]: { bairro: 250, preparado: 500, elite: 750 },
  [CHAPTER_2_ID]: { bairro: 1100, preparado: 2100, elite: 3400 },
  [CHAPTER_3_ID]: { bairro: 3800, preparado: 6900, elite: 11000 },
};

const CHAPTER_POOLS: Record<ChapterId, readonly CarConfig[]> = {
  [CHAPTER_1_ID]: CHAPTER1_CARS,
  [CHAPTER_2_ID]: CHAPTER2_CARS,
  [CHAPTER_3_ID]: CHAPTER3_CARS,
};

const TRACK_POOLS: Record<ChapterId, readonly CareerTrackId[]> = {
  [CHAPTER_1_ID]: ['distrito-industrial', 'baixada', 'avenida-norte'],
  [CHAPTER_2_ID]: ['patio-das-torres', 'distrito-financeiro', 'corredor-da-liga'],
  [CHAPTER_3_ID]: ['marginal-alta', 'hangar-executivo', 'pier-elite'],
};

const PAINTS = [
  '#d7383c', '#2b964b', '#267ec0', '#ffe17b', '#e7e9ed', '#222a38',
  '#ad5fcb', '#ee7f39', '#4aafb3', '#a0be49', '#bb2338', '#7081bd',
  '#eac6a5', '#616876', '#f2a7c0', '#3c8a74', '#d6bf47', '#7e4c38',
] as const;
const ACCENTS = ['#191f2c', '#f4f2e9', '#d8dfe8', '#383b42', '#b6c6d4'] as const;
const NAMES = ['Vitor', 'Carol', 'Guilherme', 'Luana', 'Pedro', 'Fernanda', 'Renan', 'Thiago', 'Bia', 'Caio', 'Mateus', 'Lívia'];
const NICKS = ['Rápido', 'Sombra', 'Veneno', 'Falcão', 'Nitro', 'Raio', 'Madruga', 'Sem Medo', 'Torque', 'Veloz', 'Corvo', 'Pistão'];
const PORTRAITS: readonly PortraitId[] = ['eduardo', 'roberto', 'fernando', 'leonardo', 'caio', 'camila', 'ricardo', 'hugo', 'davi', 'renata'];
const TIER_LABEL: Record<FreeTier, string> = {
  bairro: 'Racha de bairro',
  preparado: 'Desafio preparado',
  elite: 'Desafio de elite',
};

const HASH_PRIME = 16777619;
function hashText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), HASH_PRIME);
  return h >>> 0;
}
function randomFrom(seed: number): () => number {
  let state = seed || 0x92a3148f;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}
const pick = <T>(arr: readonly T[], rand: () => number): T => arr[Math.floor(rand() * arr.length)]!;
function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
function chapterNumber(id: ChapterId): number {
  return id === CHAPTER_1_ID ? 1 : id === CHAPTER_2_ID ? 2 : 3;
}
function availableParts(base: CarConfig, chapter: ChapterId, version: 1 | 2): PartDef[] {
  const maxChapter = chapterNumber(chapter);
  return ALL_PARTS.filter((p) =>
    (p.chapter ?? ((p.since ?? 1) === 2 ? 2 : 1)) <= maxChapter &&
    (p.since ?? 1) <= version &&
    incompatibility(base, p) === null
  );
}

function generateParts(base: CarConfig, chapter: ChapterId, tier: FreeTier, rand: () => number): { ids: string[]; version: 1 | 2 } {
  const version: 1 | 2 = base.engine.family ? 2 : 1;
  if (tier === 'bairro' && rand() < 0.55) return { ids: [], version };
  const limit = tier === 'bairro' ? 2 : tier === 'preparado' ? 6 : 14;
  const candidates = availableParts(base, chapter, version);
  let ids: string[] = [];
  const slots = new Set<string>();
  const add = (p: PartDef | undefined): void => {
    if (!p || slots.has(p.category) || ids.length >= limit) return;
    const result = resolveBuild(base, [...ids, p.id], {}, version);
    if (result.ok) { ids = [...ids, p.id]; slots.add(p.category); }
  };
  // An occasional fully boosted classic is possible, but only with a valid engine + clutch.
  if (!base.engine.family && tier === 'elite' && rand() < 0.65) {
    add(candidates.find((p) => p.id === 'clutch-reinforced'));
    add(candidates.find((p) => p.id === 'turbo-basic'));
  }
  const shuffledParts = shuffled(candidates, rand);
  // Prefer upper-level physical upgrades at high difficulty, but preserve random combinations.
  if (tier === 'elite') {
    const scored = shuffledParts.map((p) => ({ p, score: Math.log1p(p.price) * 0.65 + rand() * 5 }));
    scored.sort((a, b) => b.score - a.score);
    shuffledParts.splice(0, shuffledParts.length, ...scored.map((x) => x.p));
  }
  for (const part of shuffledParts) add(part);
  return { ids, version };
}

export function freeEventId(chapter: ChapterId, rotation: number, tier: FreeTier): string {
  return 'free-' + chapterNumber(chapter) + '-' + rotation + '-' + tier;
}

export function freeChapterOf(id: string): ChapterId | null {
  if (id.startsWith('free-1-')) return CHAPTER_1_ID;
  if (id.startsWith('free-2-')) return CHAPTER_2_ID;
  if (id.startsWith('free-3-')) return CHAPTER_3_ID;
  return null;
}

/** Generates one selectable offer; no permanent car or parts are granted to the player. */
export function makeFreeEvent(chapter: ChapterId, rotation: number, tier: FreeTier): FreeEventOffer {
  if (!FREE_TIERS.includes(tier)) throw new Error('nível de evento livre inválido');
  if (!Number.isSafeInteger(rotation) || rotation < 0) throw new Error('rotação inválida');
  const rand = randomFrom(hashText(chapter + '/' + rotation + '/' + tier));
  const base = pick(CHAPTER_POOLS[chapter], rand);
  const { ids, version } = generateParts(base, chapter, tier, rand);
  const resolved = resolveBuild(base, ids, {}, version);
  if (!resolved.ok) throw new Error('gerador retornou build inválido: ' + resolved.errors.join('; '));
  const paint = { color: pick(PAINTS, rand), accent: pick(ACCENTS, rand) };
  const name = pick(NAMES, rand);
  const nickname = pick(NICKS, rand);
  const skillKey: 'beginner' | 'intermediate' | 'advanced' = tier === 'bairro' ? 'beginner' : tier === 'preparado' ? 'intermediate' : 'advanced';
  const id = freeEventId(chapter, rotation, tier);
  const tracks = TRACK_POOLS[chapter];
  const trackId: CareerTrackId = chapter === CHAPTER_3_ID && tier === 'elite'
    ? pick(['hangar-executivo', 'pier-elite'] as const, rand)
    : pick(tracks, rand);
  const distance = tier === 'bairro' ? 'eighth' : chapter === CHAPTER_3_ID && tier === 'elite' ? 'km' : 'quarter';
  const rival: RivalDef = {
    id: 'rival-' + id,
    name, nickname, portrait: pick(PORTRAITS, rand),
    baseCarId: base.id, buildId: 'build-' + id,
    buildVersion: version, parts: ids, paint,
    skill: AI_PROFILES[skillKey], skillLabel: tier === 'bairro' ? 'Iniciante' : tier === 'preparado' ? 'Experiente' : 'Elite',
    lines: {
      before: 'A pista está livre. Vamos ver como sua preparação anda!',
      win: 'Boa corrida. Quero ver essa máquina de novo.',
      lose: 'Gostei do desafio. Na próxima você pode levar essa!',
    },
  };
  const event: CareerEventDef = {
    id, chapter, order: 0, title: TIER_LABEL[tier], rivalId: rival.id,
    trackId, regionLabel: trackId.replace(/-/g, ' '), distance,
    rewardCr: FREE_REWARDS[chapter][tier], reputation: 0, unlocks: [],
  };
  const signature = [base.id, paint.color, paint.accent, ...ids.slice().sort()].join('|');
  return { rotation, tier, event, rival, signature, powerCv: resolved.peakPowerCv, torqueNm: resolved.peakTorqueNm };
}

export function availableFreeOffers(chapter: ChapterId, rotation: number): FreeEventOffer[] {
  return FREE_TIERS.map((tier) => makeFreeEvent(chapter, rotation, tier));
}
