import type { CareerRaceResult } from '../CareerState';
import { CHAPTER_IDS, type ChapterId } from '../chapters';
import { freeSeed } from './FreeEventCatalog';
import { tuneKey } from '../tuning/buildCommon';
import type { FreeStats, FreeOffer, GeneratedFreeOpponent } from './FreeEventTypes';

export function freeChapterOf(id: string): ChapterId | undefined {
  const match = /^free-([123])-/.exec(id);
  return match ? CHAPTER_IDS[Number(match[1]) - 1] : undefined;
}

export function opponentFingerprint(opponent: Omit<GeneratedFreeOpponent, 'fingerprint'>, race: Pick<FreeOffer, 'trackId' | 'distance'>): string {
  const x = JSON.stringify([
    opponent.baseCarId, opponent.buildVersion, [...opponent.installedParts].sort(), tuneKey(opponent.tune),
    opponent.paint.color, opponent.paint.accent, opponent.skill, race.trackId, race.distance,
  ]);
  return [freeSeed(x), freeSeed(x, 0x9e3779b9)].map((n) => n.toString(16).padStart(8, '0')).join('');
}

export function newFreeStats(): FreeStats {
  return { races: 0, wins: 0, creditsEarned: 0, bestEt: {}, tierRaces: {} };
}

export function addFreeStats(stats: FreeStats, result: CareerRaceResult, details?: Pick<FreeOffer, 'tier' | 'distance'>): void {
  stats.races++;
  if (result.outcome === 'win') stats.wins++;
  stats.creditsEarned += result.creditsAwarded;
  if (!details) return;
  const { distance, tier } = details;
  stats.tierRaces[tier] = (stats.tierRaces[tier] ?? 0) + 1;
  const run = result.playerResult;
  if (run.finished && !run.redLight && !run.dnf && run.et !== null && run.et > 0)
    stats.bestEt[distance] = Math.min(stats.bestEt[distance] ?? Infinity, run.et);
}
