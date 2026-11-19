import { describe, expect, it } from 'vitest';
import { CHAPTER1_CARS } from '../../../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { CareerController } from '../../../src/game/career/CareerController';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { type CareerRaceResult, type RunSummary, parseCareerSave } from '../../../src/game/career/CareerState';
import { freeChapterOf, FREE_REWARDS, FREE_TIERS, availableFreeOffers, makeFreeEvent } from '../../../src/game/career/FreeEvents';
import { CHAPTER_1_ID, CHAPTER_2_ID, CHAPTER_3_ID } from '../../../src/game/career/chapters';
import { rivalBuild } from '../../../src/game/career/RivalBuildFactory';
import { MemoryStore } from '../../../src/storage/db';

const sampleRun = (name: string): RunSummary => ({
  name, rt: 0.2, et: 17, total: 17.2, trapKmh: 130,
  redLight: false, finished: true, dnf: false,
});
function race(offer: ReturnType<typeof makeFreeEvent>, playerId: string, attemptId: string, outcome: CareerRaceResult['outcome'] = 'win') {
  const resolved = rivalBuild(offer.rival);
  return {
    attemptId, eventId: offer.event.id, playerCarId: playerId,
    opponentCarId: resolved.car.id,
    playerResult: sampleRun('Você'),
    opponentResult: sampleRun(offer.rival.name + ' "' + offer.rival.nickname + '"'),
    outcome, completedAt: new Date().toISOString(),
    buildVersion: 1 as const, playerBuildKey: 'player-build', opponentBuildKey: resolved.key,
  };
}

const pools = [[CHAPTER_1_ID, CHAPTER1_CARS], [CHAPTER_2_ID, CHAPTER2_CARS], [CHAPTER_3_ID, CHAPTER3_CARS]] as const;
const rotations = pools.flatMap(([chapter, pool]) =>
  [1, 2, 3, 4].map((rotation) => [chapter, rotation, pool.map((car) => car.id)] as const));

describe('procedural free races', () => {
  it.each(rotations)('%s rotation %i uses chapter cars and valid hardware', (chapter, rotation, carIds) => {
    const offers = availableFreeOffers(chapter, rotation);
    expect(offers.map((o) => o.tier)).toEqual([...FREE_TIERS]);
    for (const o of offers) {
      expect(carIds).toContain(o.rival.baseCarId);
      expect(o.event.chapter).toBe(chapter);
      expect(o.event.rewardCr).toBe(FREE_REWARDS[chapter][o.tier]);
      expect(o.rival.paint.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(o.rival.paint.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(rivalBuild(o.rival).peakPowerCv).toBeGreaterThan(0);
      expect(o.powerCv).toBeGreaterThan(0);
      expect(o.rival.parts.length).toBeLessThanOrEqual(14);
      expect(makeFreeEvent(chapter, rotation, o.tier)).toEqual(o);
      expect(freeChapterOf(o.event.id)).toBe(chapter);
    }
  });

  it('refreshing changes the offer ID, without changing any campaign event', () => {
    const a = availableFreeOffers(CHAPTER_1_ID, 29);
    const b = availableFreeOffers(CHAPTER_1_ID, 30);
    expect(a.map((o) => o.event.id)).not.toEqual(b.map((o) => o.event.id));
    expect(a.map((o) => o.signature)).not.toEqual(b.map((o) => o.signature));
    expect(freeChapterOf('e1-primeira-noite')).toBeNull();
  });

  it('pays once, rotates offers, keeps chapter progression unchanged and rejects stale attempts', async () => {
    const store = new MemoryStore();
    const c = new CareerController(new CareerRepository(store, 'slot-1'));
    const started = await c.newCareer('gm-chevette-sl-1988');
    expect(started.ok).toBe(true);
    const save = c.save!;
    const first = makeFreeEvent(CHAPTER_1_ID, save.freeEventRotation, 'elite');
    const result = race(first, c.activeCar!.id, 'attempt-free-event-0001');
    const paid = await c.recordFreeRace(result, first);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.value.applied).toBe(true);
    expect(paid.value.reward.credits).toBe(750);
    expect(c.save!.credits).toBe(save.credits + 750);
    expect(c.save!.completedEventIds).toEqual([]);
    expect(c.save!.claimedRewardIds).toEqual([]);
    expect(c.save!.reputation).toBe(0);
    expect(c.save!.freeEventRotation).toBe(save.freeEventRotation + 1);
    const repeat = await c.recordFreeRace(result, first);
    expect(repeat.ok).toBe(true);
    if (repeat.ok) expect(repeat.value.applied).toBe(false);
    expect(c.save!.credits).toBe(save.credits + 750);
    const forgedAttempt = await c.recordFreeRace(race(first, c.activeCar!.id, 'attempt-free-event-0002'), first);
    expect(forgedAttempt.ok).toBe(false);
    const loaded = new CareerController(new CareerRepository(store, 'slot-1'));
    await loaded.load();
    expect(loaded.save!.freeEventRotation).toBe(c.save!.freeEventRotation);
    expect(loaded.save!.credits).toBe(c.save!.credits);
    expect(parseCareerSave({ ...loaded.save, freeEventRotation: undefined }).ok).toBe(true);
  });

  it('offers a repeatable no-fee way to earn enough for a turbo and clutch', async () => {
    const c = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
    const started = await c.newCareer('gm-chevette-sl-1988');
    expect(started.ok).toBe(true);
    const initial = c.save!.credits;
    for (let i = 0; i < 7; i++) {
      const offer = makeFreeEvent(CHAPTER_1_ID, c.save!.freeEventRotation, 'elite');
      const recorded = await c.recordFreeRace(race(offer, c.activeCar!.id, 'attempt-farm-' + i + '-xxxx'), offer);
      expect(recorded.ok).toBe(true);
    }
    expect(c.save!.credits - initial).toBe(5250);
    expect(c.save!.completedEventIds).toHaveLength(0);
  });

  it('never grants credits for defeats, red lights or DNFs', async () => {
    const c = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
    await c.newCareer('fiat-uno-mille-1995');
    const initial = c.save!.credits;
    for (const outcome of ['loss', 'red-light', 'dnf'] as const) {
      const offer = makeFreeEvent(CHAPTER_1_ID, c.save!.freeEventRotation, 'bairro');
      const result = await c.recordFreeRace(race(offer, c.activeCar!.id, 'attempt-free-' + outcome + '-xxx', outcome), offer);
      expect(result.ok).toBe(true);
      expect(c.save!.credits).toBe(initial);
    }
  });
});
