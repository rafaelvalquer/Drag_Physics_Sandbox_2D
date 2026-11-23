/** Rival builds with N₂O: same rules as the player, never strong in the early game, rare, always valid. */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../../../src/core/prng';
import { ALL_EVENTS } from '../../../../src/game/career/CareerEvents';
import { generateFreeBuild } from '../../../../src/game/career/freeEvents/FreeBuildGenerator';
import { FREE_CARS } from '../../../../src/game/career/freeEvents/FreeEventCatalog';
import { FREE_TIERS } from '../../../../src/game/career/freeEvents/FreeEventTypes';
import { CHAPTER_IDS } from '../../../../src/game/career/chapters';

const full = { completedEventIds: ALL_EVENTS.map((e) => e.id) };

describe('free builds with nitrous', () => {
  const kits = new Map<string, number>();
  const seen = { total: 0, withKit: 0 };
  for (const chapter of CHAPTER_IDS) {
    for (const [i, base] of FREE_CARS[chapter].entries()) {
      for (const tier of FREE_TIERS) {
        for (let s = 0; s < 1; s++) {
          const b = generateFreeBuild(base, chapter, tier, full, new Prng(900 + s * 131 + i * 17));
          seen.total++;
          const kit = b.installedParts.find((p) => p.startsWith('nitrous-'));
          if (!kit) continue;
          seen.withKit++;
          kits.set(`${chapter}/${tier}/${kit}`, (kits.get(`${chapter}/${tier}/${kit}`) ?? 0) + 1);
          it(`${chapter} ${tier} ${base.id} #${s}: the kit resolves into a car with a cylinder`, () => {
            expect(b.resolved.car.nitrous).toBeDefined();
            expect(b.resolved.car.nitrous!.capacityKg).toBeGreaterThan(0);
            expect(b.installedParts.filter((p) => p.startsWith('nitrous-'))).toHaveLength(1);
          });
        }
      }
    }
  }

  it('is rare and never in the beginner tier', () => {
    expect(seen.withKit).toBeLessThan(seen.total * 0.2);
    for (const key of kits.keys()) expect(key.split('/')[1]).not.toBe('iniciante');
  });

  it('the strong kits stay out of the first chapter', () => {
    for (const key of kits.keys()) {
      if (key.startsWith('chapter-1/')) expect(key.endsWith('nitrous-street')).toBe(true);
    }
  });
});
