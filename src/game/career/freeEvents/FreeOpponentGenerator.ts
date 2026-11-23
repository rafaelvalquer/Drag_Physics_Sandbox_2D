import { Prng } from '../../../core/prng';
import { findCareerTrack } from '../../../data/tracks/career';
import type { CareerSave } from '../CareerState';
import { chapterOf, type ChapterId } from '../chapters';
import type { RaceDistanceId } from '../../race/RaceController';
import { generateFreeBuild, stockFreeBuild, type FreeBuild } from './FreeBuildGenerator';
import { FREE_CARS, FREE_TRACKS, freeSeed, pick } from './FreeEventCatalog';
import { generateFreeDriver } from './FreeDriverGenerator';
import { estimateFreeTime, freePerformanceBand } from './FreeEventDifficulty';
import { opponentFingerprint } from './FreeEventHistory';
import { freeEventPrize } from './FreeEventRewards';
import { generateFreePaint } from './FreePaintGenerator';
import type { FreeOffer, FreeTier } from './FreeEventTypes';

export interface RecentFreeOpponent {
  fingerprint: string;
  baseCarId: string;
  color: string;
}

export function generateFreeOpponent(
  chapter: ChapterId, tier: FreeTier, distance: RaceDistanceId, slot: number, sequence: number, seed: number,
  progress: Pick<CareerSave, 'completedEventIds'>, recent: readonly RecentFreeOpponent[] = [],
  activeFingerprints: ReadonlySet<string> = new Set(),
): FreeOffer | null {
  const rng = new Prng(seed);
  const tracks = distance === 'km' ? FREE_TRACKS[chapter].filter((id) => findCareerTrack(id).lengthM >= 1700) : FREE_TRACKS[chapter];
  if (!tracks.length) return null;
  const trackId = pick(tracks, rng);
  const track = findCareerTrack(trackId);
  const driver = generateFreeDriver(tier, rng);
  const [fast, slow] = freePerformanceBand(chapter, distance, tier);
  const target = fast + (0.15 + rng.next() * 0.7) * (slow - fast);
  const pool = [...FREE_CARS[chapter]];
  const recentCars = recent.slice(-5).map((r) => r.baseCarId);
  const ordered = pool.map((car) => ({
    car,
    priority: rng.next() + recentCars.filter((id) => id === car.id).length * 0.28 +
      recentCars.filter((id) => id.split('-')[0] === car.id.split('-')[0]).length * 0.08,
  })).sort((a, b) => a.priority - b.priority).map(({ car }) => car);

  let best: { build: FreeBuild; estimatedS: number; score: number } | undefined;
  const consider = (build: FreeBuild, index: number): void => {
    const estimatedS = estimateFreeTime(build.resolved, track, distance, driver.skill);
    const outside = Math.max(fast - estimatedS, estimatedS - slow, 0);
    const varietyPenalty = index * 0.1;
    const stockPenalty = !build.installedParts.length && tier === 'competicao' ? 1.2 : 0;
    const score = Math.abs(estimatedS - target) + outside * 4 + varietyPenalty + stockPenalty + rng.next() * 0.35;
    if (!best || score < best.score) best = { build, estimatedS, score };
  };
  ordered.slice(0, 4).forEach((base, index) => consider(generateFreeBuild(base, chapter, tier, progress, rng), index));
  // Retain a legal baseline when progression or the available hardware limits the candidate pool.
  if (!best || best.estimatedS < fast || best.estimatedS > slow) {
    ordered.slice(4, 6).forEach((base, index) => consider(generateFreeBuild(base, chapter, tier, progress, rng), index + 4));
    ordered.forEach((base, index) => consider(stockFreeBuild(base), index));
  }
  if (!best) return null;
  const { build, estimatedS } = best;
  const car = build.resolved.car;
  // Older signatures are relaxed only if the bounded retry space is exhausted.
  for (let attempt = 0; attempt < 64; attempt++) {
    const { name, paint } = generateFreePaint(rng, recent.at(-1)?.color);
    const candidate = {
      seed, generatorVersion: 1, baseCarId: car.id, buildVersion: build.buildVersion,
      installedParts: build.installedParts, tune: build.tune, paint, ...driver,
      ...(attempt > 0 ? generateFreeDriver(tier, new Prng(freeSeed(`${seed}/${attempt}`))) : {}),
    };
    const fingerprint = opponentFingerprint(candidate, { trackId, distance });
    const window = recent.slice(Math.max(0, attempt - 32));
    if (activeFingerprints.has(fingerprint) || window.some((r) => r.fingerprint === fingerprint)) continue;

    return {
      id: `free-${chapterOf(chapter).number}-v4-${sequence}`,
      chapter, tier, distance, trackId, slot, paint, paintName: name,
      estimatedS: attempt ? estimateFreeTime(build.resolved, track, distance, candidate.skill) : estimatedS,
      carName: pool.find((base) => base.id === car.id)!.name, preparation: build.preparation,
      rewardCr: freeEventPrize(chapter, tier, distance),
      opponent: { ...candidate, fingerprint },
      attemptsStarted: 0,
    };
  }
  return null;
}
