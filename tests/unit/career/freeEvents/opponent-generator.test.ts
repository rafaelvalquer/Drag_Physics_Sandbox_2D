import { describe, expect, it } from 'vitest';
import { Prng } from '../../../../src/core/prng';
import { findCareerTrack } from '../../../../src/data/tracks/career';
import { ALL_EVENTS, eventsOf } from '../../../../src/game/career/CareerEvents';
import { isPartUnlocked } from '../../../../src/game/career/CareerProgression';
import { generateFreeBuild, stockFreeBuild } from '../../../../src/game/career/freeEvents/FreeBuildGenerator';
import { FREE_CARS, freeDistances, freeSeed } from '../../../../src/game/career/freeEvents/FreeEventCatalog';
import { estimateFreeTime, freePerformanceBand } from '../../../../src/game/career/freeEvents/FreeEventDifficulty';
import { generateFreeOpponent, type RecentFreeOpponent } from '../../../../src/game/career/freeEvents/FreeOpponentGenerator';
import { generateFreePaint, paintContrast } from '../../../../src/game/career/freeEvents/FreePaintGenerator';
import { freeEligibility, resolveFreeOpponent, validFreeOffer } from '../../../../src/game/career/freeEvents/FreeEventService';
import { FREE_TIERS } from '../../../../src/game/career/freeEvents/FreeEventTypes';
import { CHAPTER_IDS } from '../../../../src/game/career/chapters';
import { familyOf } from '../../../../src/game/career/tuning/BuildResolverV2';
import { findPart } from '../../../../src/game/career/tuning/parts';

const full = { completedEventIds: ALL_EVENTS.map((event) => event.id) };
const initial = { completedEventIds: [] };
const afterFourth = { completedEventIds: eventsOf('chapter-1').slice(0, 4).map((event) => event.id) };

describe('free opponents', () => {
  it.each(CHAPTER_IDS)('uses the existing catalogue, resolver and chapter venues in %s', (chapter) => {
    expect(FREE_CARS[chapter]).toHaveLength(chapter === 'chapter-1' ? 7 : chapter === 'chapter-2' ? 10 : 8);
    const tiers = ['iniciante', 'preparado', 'competicao'] as const;
    for (const [i, distance] of freeDistances(chapter).entries()) {
      const tier = tiers[i]!;
      const seed = freeSeed(`${chapter}/${tier}/${distance}`);
      const offer = generateFreeOpponent(chapter, tier, distance, 0, 1, seed, full)!;
      const rival = resolveFreeOpponent(offer);
      expect(validFreeOffer(offer)).toBe(true);
      expect(rival?.ok).toBe(true);
      expect(FREE_CARS[chapter].some((car) => car.id === offer.opponent.baseCarId)).toBe(true);
      expect(offer.distance).toBe(distance);
      if (distance === 'km') expect(findCareerTrack(offer.trackId).lengthM).toBeGreaterThanOrEqual(1700);
    }
  }, 90_000);

  it('reproduces an offer by seed and avoids the recent signature and the previous paint', () => {
    const recent: RecentFreeOpponent[] = [];
    const seenModels = new Set<string>();
    for (let i = 1; i <= 34; i++) {
      const seed = i <= 2 ? 7 : i * 937;
      const first = generateFreeOpponent('chapter-1', 'iniciante', 'quarter', 0, i, seed, initial, recent)!;
      expect(generateFreeOpponent('chapter-1', 'iniciante', 'quarter', 0, i, seed, initial, recent)).toEqual(first);
      expect(recent.map((r) => r.fingerprint)).not.toContain(first.opponent.fingerprint);
      expect(recent.at(-1)?.color).not.toBe(first.paint.color);
      recent.push({ fingerprint: first.opponent.fingerprint, baseCarId: first.opponent.baseCarId, color: first.paint.color });
      if (recent.length > 30) recent.shift();
      seenModels.add(first.opponent.baseCarId);
    }
    expect(seenModels.size).toBeGreaterThanOrEqual(4);
  });

  it('uses four driving profiles with variation and contrast in generated paints', () => {
    const palettes = new Set<string>();
    let previous: string | undefined;
    for (let i = 1; i <= 60; i++) {
      const { paint } = generateFreePaint(new Prng(i), previous);
      expect(paintContrast(paint.color, paint.accent)).toBeGreaterThanOrEqual(3);
      expect(paint.color).not.toBe(previous);
      previous = paint.color;
      palettes.add(paint.color);
    }
    expect(palettes.size).toBeGreaterThan(10);
    const drivers = FREE_TIERS.map((tier, i) => generateFreeOpponent('chapter-1', tier, 'quarter', 0, i + 1, i + 193, full)!.opponent.skill);
    for (let i = 1; i < drivers.length; i++) expect(drivers[i]!.reactionMeanS).toBeLessThan(drivers[i - 1]!.reactionMeanS);
  }, 30_000);
});

describe('free builds and difficulty', () => {
  it('offers stock and prepared builds with unlocked, compatible hardware and resolved tunes', () => {
    let tuned = 0;
    let prepared = 0;
    for (const chapter of CHAPTER_IDS) {
      for (const [i, base] of FREE_CARS[chapter].entries()) {
        const stock = stockFreeBuild(base);
        const original = structuredClone(base);
        const build = generateFreeBuild(base, chapter, 'competicao', full, new Prng(3457 + i * 321));
        expect(stock.installedParts).toEqual([]);
        expect(stock.tune).toEqual({});
        const parts = build.installedParts.map((id) => findPart(id)!);
        expect(new Set(parts.map((part) => part.category)).size).toBe(parts.length);
        for (const part of parts) {
          expect(part).toBeDefined();
          expect(isPartUnlocked(full, part, familyOf(base))).toBe(true);
        }
        expect(build.resolved.car.id).toBe(base.id);
        expect(base).toEqual(original);
        if (Object.keys(build.tune).length) tuned++;
        if (parts.length >= 5) prepared++;
      }
    }
    const gol = FREE_CARS['chapter-1'][0]!;
    expect(generateFreeBuild(gol, 'chapter-1', 'competicao', initial, new Prng(7)).installedParts).toEqual([]);
    expect(tuned).toBeGreaterThan(2);
    expect(prepared).toBeGreaterThan(7);
  }, 60_000);

  it('selects a timed performance interval and protects low tiers from far faster or future cars', () => {
    const offer = generateFreeOpponent('chapter-1', 'preparado', 'quarter', 0, 1, 7, afterFourth)!;
    const rival = resolveFreeOpponent(offer);
    if (!rival?.ok) throw new Error('expected a valid rival');
    const track = findCareerTrack(offer.trackId);
    const [fast, slow] = freePerformanceBand(offer.chapter, offer.distance, offer.tier);
    expect(offer.estimatedS).toBeGreaterThanOrEqual(fast);
    expect(offer.estimatedS).toBeLessThanOrEqual(slow);
    expect(estimateFreeTime(rival, track, offer.distance, offer.opponent.skill)).toBe(offer.estimatedS);
    const nextChapter = stockFreeBuild(FREE_CARS['chapter-2'][0]!);
    const record = { id: 'test-car', baseCarId: nextChapter.resolved.car.id, nickname: 'Astra', paint: offer.paint, installedParts: [], buildVersion: 2 as const, acquiredAt: new Date(0).toISOString() };
    expect(freeEligibility(offer, record, nextChapter.resolved)).toMatch(/capítulo/);
    // A build's next race uses the resolved physics, including changed mass/gearing and time, rather than its model badge.
    const fastClassic = { ...nextChapter.resolved, car: { ...nextChapter.resolved.car, massKg: 850 }, key: 'test-very-fast' };
    expect(freeEligibility({ ...offer, tier: 'iniciante' }, { ...record, baseCarId: 'vw-gol-gts-1988' }, fastClassic)).toMatch(/rápida demais/);
  });
});
