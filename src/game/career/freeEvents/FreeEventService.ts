import { findCareerTrack } from '../../../data/tracks/career';
import type { CareerSave, Outcome, OwnedCar, RunSummary } from '../CareerState';
import { CHAPTER_IDS, chapterOf } from '../chapters';
import { resolveBuild, type BuildResult } from '../tuning/BuildResolver';
import { availableFreeTiers, FREE_CARS, FREE_TRACKS, freeSeed } from './FreeEventCatalog';
import { estimateFreeTime, freePerformanceBand } from './FreeEventDifficulty';
import { FREE_SKILL_LABEL } from './FreeDriverGenerator';
import { opponentFingerprint } from './FreeEventHistory';
import { generateFreeOpponent } from './FreeOpponentGenerator';
import { RECENT_FREE_OPPONENTS, FREE_TIER_LABEL, type FreeOffer, type FreeTier, type FreeRaceOffer } from './FreeEventTypes';

interface Placement { tier: FreeTier; slot: number }
export interface FreeBoardRequest {
  save: CareerSave;
  filter: FreeTier | null;
  refresh: boolean;
  replaceId?: string;
}

export function freeBoardPlacements(save: CareerSave, filter: FreeTier | null): Placement[] {
  const tiers = availableFreeTiers(save, save.chapterId);
  if (filter) return tiers.includes(filter) ? [0, 1, 2].map((slot) => ({ tier: filter, slot })) : [];
  const visible = tiers.slice(-3).reverse();
  return Array.from({ length: visible.length ? 3 : 0 }, (_, index) => ({
    tier: visible[index % visible.length]!,
    slot: index,
  }));
}

export function findFreeOffer(save: CareerSave, id: string): FreeOffer | undefined {
  return save.freeEvents.offersByChapter[save.chapterId].find((offer) => offer.id === id);
}

export function resolveFreeOpponent(offer: FreeOffer) {
  const base = FREE_CARS[offer.chapter].find((car) => car.id === offer.opponent.baseCarId);
  return base && resolveBuild(base, offer.opponent.installedParts, offer.opponent.tune, offer.opponent.buildVersion);
}

export function validFreeOffer(offer: FreeOffer): boolean {
  const build = resolveFreeOpponent(offer);
  return !!build?.ok && FREE_TRACKS[offer.chapter].includes(offer.trackId) &&
    (offer.distance !== 'km' || (offer.chapter === 'chapter-3' && findCareerTrack(offer.trackId).lengthM >= 1700)) &&
    offer.opponent.paint.color === offer.paint.color && offer.opponent.paint.accent === offer.paint.accent &&
    offer.opponent.fingerprint === opponentFingerprint(offer.opponent, offer);
}

/** Fill a vacancy in a draft save. The caller commits the offer and signature together. */
export function fillFreeOffer(save: CareerSave, { tier, slot }: Placement): FreeOffer | null {
  const chapter = save.chapterId;
  const free = save.freeEvents;
  const randomShort = Boolean(freeSeed(`${free.seed}/${free.nextSequence}/distance`) & 1);
  const distance = slot === 0 ? 'quarter' : slot === 1 ? 'eighth' :
    chapter === 'chapter-3' ? 'km' : randomShort ? 'eighth' : 'quarter';
  const active = new Set(Object.values(free.offersByChapter).flat().map((o) => o.opponent.fingerprint));
  const sequence = free.nextSequence++;
  const seed = freeSeed(`${free.seed}/${chapter}/${sequence}/${tier}/${distance}`);
  const offer = generateFreeOpponent(chapter, tier, distance, slot, sequence, seed, save, free.recentFingerprints, active);
  if (!offer) return null;
  free.offersByChapter[chapter].push(offer);
  const { fingerprint, baseCarId, paint } = offer.opponent;
  free.recentFingerprints.push({ fingerprint, baseCarId, color: paint.color });
  free.recentFingerprints = free.recentFingerprints.slice(-RECENT_FREE_OPPONENTS);
  return offer;
}

export function planFreeBoard({ save, filter, refresh, replaceId }: FreeBoardRequest) {
  const board = save.freeEvents.offersByChapter[save.chapterId];
  return freeBoardPlacements(save, filter).map((place) => {
    const current = board.find((offer) => offer.tier === place.tier && offer.slot === place.slot);
    const replace = current && (current.id === replaceId || (refresh && current.attemptsStarted === 0));
    return { place, current, generate: !current || replace || !validFreeOffer(current) };
  });
}

export function generateFreeBoard(request: FreeBoardRequest) {
  const { save } = request;
  const board = save.freeEvents.offersByChapter[save.chapterId];
  const offers: FreeOffer[] = [];
  for (const { place, current, generate } of planFreeBoard(request)) {
    const next = generate ? fillFreeOffer(save, place) : null;
    if (next) {
      if (current) board.splice(board.indexOf(current), 1);
      offers.push(next);
    } else if (current && validFreeOffer(current)) {
      offers.push(current);
    }
  }
  return { offers, freeEvents: save.freeEvents };
}

export type FreeBoardResponse = ReturnType<typeof generateFreeBoard>;

export function toFreeRaceOffer(offer: FreeOffer): FreeRaceOffer {
  const o = offer.opponent;
  const rivalId = `rival-${offer.id}`;
  return {
    offer,
    event: {
      id: offer.id, chapter: offer.chapter, order: 0, rivalId,
      title: `Desafio da Madrugada · ${FREE_TIER_LABEL[offer.tier]}`,
      trackId: offer.trackId, regionLabel: findCareerTrack(offer.trackId).name,
      distance: offer.distance, rewardCr: offer.rewardCr, reputation: 0, unlocks: [],
    },
    rival: {
      id: rivalId, name: o.driverName, nickname: o.driverNickname, portrait: o.portrait,
      baseCarId: o.baseCarId, buildId: o.fingerprint, buildVersion: o.buildVersion,
      parts: o.installedParts, tune: o.tune, paint: o.paint, skill: o.skill, skillLabel: FREE_SKILL_LABEL[offer.tier],
      lines: { before: 'A pista está livre. Vamos ver como sua preparação anda!', win: 'Boa corrida. Quero ver essa máquina de novo.', lose: 'Gostei do desafio. Na próxima você pode levar essa!' },
    },
  };
}

export function freeEligibility(offer: FreeOffer, car: OwnedCar, build: BuildResult): string | null {
  const chapter = CHAPTER_IDS.find((id) => FREE_CARS[id].some((base) => base.id === car.baseCarId));
  if (!chapter || chapterOf(offer.chapter).number < chapterOf(chapter).number)
    return 'Escolha um carro deste capítulo ou de um capítulo anterior.';
  if (!build.ok) return 'A preparação atual não é válida.';
  if (offer.tier === 'competicao') return null;
  const [fast] = freePerformanceBand(offer.chapter, offer.distance, offer.tier);
  const time = estimateFreeTime(build, findCareerTrack(offer.trackId), offer.distance);
  // Players can grow into a clear advantage within a class. Restrict large mismatches only.
  if (time < fast - Math.max(0.65, fast * 0.065)) return 'A preparação atual é rápida demais para esta classe. Escolha uma classe superior ou outro carro.';
  return null;
}

/** Match RaceController's terminal classification and require actual finish-line measurements. */
export function freeRaceOutcome(player: RunSummary, rival: RunSummary): Outcome | null {
  const terminal = (run: RunSummary): boolean => {
    if (run.finished === run.dnf) return false;
    if (run.redLight ? run.rt === null || run.rt >= 0 : run.rt !== null && run.rt < 0) return false;
    if (run.dnf) return run.et === null && run.total === null;
    return run.et !== null && run.et > 0 && run.rt !== null && run.total !== null &&
      Math.abs(run.total - (run.et + run.rt)) <= 0.002;
  };
  if (!terminal(player) || !terminal(rival)) return null;
  if (player.redLight) return 'red-light';
  if (player.dnf) return 'dnf';
  return rival.dnf || rival.redLight || player.total! <= rival.total! ? 'win' : 'loss';
}
