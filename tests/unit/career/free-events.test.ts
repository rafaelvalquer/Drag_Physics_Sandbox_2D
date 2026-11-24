import { describe, expect, it } from 'vitest';
import { CareerController } from '../../../src/game/career/CareerController';
import { CAREER_STORE, CareerRepository } from '../../../src/game/career/CareerRepository';
import { exportCareer, importCareer, newCareerSave, parseCareerSave, type CareerRaceResult, type RunSummary } from '../../../src/game/career/CareerState';
import { eventsOf } from '../../../src/game/career/CareerEvents';
import { availableFreeTiers } from '../../../src/game/career/freeEvents/FreeEventCatalog';
import { freeEventPrize } from '../../../src/game/career/freeEvents/FreeEventRewards';
import { resolveFreeOpponent } from '../../../src/game/career/freeEvents/FreeEventService';
import type { FreeOffer, FreeAttempt } from '../../../src/game/career/freeEvents/FreeEventTypes';
import { MemoryStore } from '../../../src/storage/db';

const SECTION = 'chapter-1';
function run(name: string, et = 17): RunSummary {
  return { name, rt: 0.2, et, total: et + 0.2, trapKmh: 130, redLight: false, finished: true, dnf: false };
}

function record(offer: FreeOffer, attempt: FreeAttempt, outcome: CareerRaceResult['outcome'] = 'win') {
  const rival = resolveFreeOpponent(offer);
  if (!rival?.ok) throw new Error('invalid test offer');
  const clean = run('Você', outcome === 'loss' ? 19 : 16);
  const playerResult = outcome === 'dnf'
    ? { ...clean, et: null, total: null, trapKmh: null, dnf: true, finished: false, dnfReason: 'engine-blown' as const }
    : outcome === 'red-light' ? { ...clean, rt: -0.1, total: 15.9, redLight: true } : clean;
  return {
    attemptId: attempt.id, eventId: offer.id, playerCarId: attempt.carId,
    opponentCarId: rival.car.id, playerResult, opponentResult: run(offer.opponent.driverName),
    outcome, completedAt: new Date(0).toISOString(), buildVersion: attempt.buildVersion,
    playerBuildKey: attempt.buildKey, opponentBuildKey: rival.key,
  };
}

function value<T>(op: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!op.ok) throw new Error(op.error);
  return op.value;
}

async function career(store = new MemoryStore()) {
  const controller = new CareerController(new CareerRepository(store, 'slot-1'));
  value(await controller.newCareer('gm-chevette-sl-1988'));
  await store.update(CAREER_STORE, 'slot-1', () => ({
    ...controller.save!, freeEvents: { ...controller.save!.freeEvents, seed: 24 },
  }));
  await controller.load();
  return controller;
}

describe('free event progression and prizes', () => {
  it('unlocks classes with the chapter milestones and rounds the posted distance prize', () => {
    const progress = { completedEventIds: [] as string[] };
    expect(availableFreeTiers(progress, SECTION)).toEqual(['iniciante']);
    expect(availableFreeTiers(progress, 'chapter-2')).toEqual([]);
    for (const [chapter, orders] of [['chapter-1', [2, 4, 6]], ['chapter-2', [2, 4, 8]], ['chapter-3', [2, 4, 5]]] as const) {
      expect(availableFreeTiers(progress, chapter)).toHaveLength(1);
      for (const [i, order] of orders.entries()) {
        const progressAt = (count: number) => ({ completedEventIds: [...progress.completedEventIds, ...eventsOf(chapter).slice(0, count).map((e) => e.id)] });
        expect(availableFreeTiers(progressAt(order - 1), chapter)).toHaveLength(i + 1);
        expect(availableFreeTiers(progressAt(order), chapter)).toHaveLength(i + 2);
      }
      progress.completedEventIds.push(...eventsOf(chapter).map((e) => e.id));
    }
    expect(freeEventPrize(SECTION, 'preparado', 'eighth')).toBe(520);
    expect(freeEventPrize(SECTION, 'preparado', 'quarter')).toBe(650);
    expect(freeEventPrize('chapter-3', 'competicao', 'km')).toBe(31250);
  });
});

describe('persistent free offers and results', () => {
  it('retains an attempted offer, pays once, and replaces only the winning slot', async () => {
    const c = await career();
    const initial = c.save!;
    const board = value(await c.freeBoard(null));
    const [offer, second, third] = board;
    const first = value(await c.beginFreeRace(offer!.id));
    expect(first.attempt.buildKey).toBeTruthy();
    expect(first.attempt.installedParts).toEqual([]);
    const lost = record(first.offer, first.attempt, 'loss');
    expect(value(await c.recordFreeRace(lost)).reward.credits).toBe(0);
    expect(value(await c.recordFreeRace(lost)).applied).toBe(false);
    expect(value(await c.freeBoard(null))[0]!.opponent).toEqual(offer!.opponent);
    const rematch = value(await c.beginFreeRace(offer!.id));
    expect(rematch.attempt.id).not.toEqual(first.attempt.id);
    expect(rematch.offer.opponent).toEqual(first.offer.opponent);
    const win = record(rematch.offer, rematch.attempt);
    expect((await c.recordFreeRace({ ...win, playerBuildKey: 'different' })).ok).toBe(false);
    expect((await c.recordFreeRace({ ...win, outcome: 'loss' })).ok).toBe(false);
    expect(value(await c.recordFreeRace(win)).reward.credits).toBe(offer!.rewardCr);
    expect(value(await c.recordFreeRace(win)).applied).toBe(false);
    expect((await c.recordFreeRace({ ...win, attemptId: win.attemptId + 'x' })).ok).toBe(false);
    const next = value(await c.freeBoard(null));
    expect(next[0]!.id).not.toBe(offer!.id);
    expect(next.slice(1)).toEqual([second, third]);
    expect(c.save!.credits).toBe(initial.credits + offer!.rewardCr);
    expect(c.save!.completedEventIds).toEqual(initial.completedEventIds);
    expect(c.save!.unlockedChapters).toEqual(initial.unlockedChapters);
    expect(c.save!.claimedRewardIds).toEqual(initial.claimedRewardIds);
    expect(c.save!.reputation).toBe(initial.reputation);
    expect(c.save!.results).toEqual(initial.results);
    expect(c.save!.freeEvents.results[1]!.details?.paint).toEqual(offer!.paint);
    expect(c.save!.freeEvents.stats[SECTION]).toMatchObject({ races: 2, wins: 1, creditsEarned: offer!.rewardCr, bestEt: { quarter: 16 } });
  });

  it('never pays on a foul or DNF, retains the rival on refresh, and shares the same export', async () => {
    const c = await career();
    const [offer] = value(await c.freeBoard(null));
    for (const outcome of ['red-light', 'dnf'] as const) {
      const { attempt } = value(await c.beginFreeRace(offer!.id));
      expect(value(await c.recordFreeRace(record(offer!, attempt, outcome))).reward.credits).toBe(0);
    }
    const before = structuredClone(c.save!);
    const refreshed = value(await c.freeBoard(null, true));
    expect(refreshed[0]!.id).toBe(offer!.id);
    expect(refreshed[1]!.id).not.toBe(before.freeEvents.offersByChapter[SECTION][1]!.id);
    expect(c.save!.freeEvents.results).toEqual(before.freeEvents.results);
    expect(c.save!.credits).toBe(before.credits);
    const restored = importCareer(exportCareer(c.save!));
    expect(restored).toEqual({ ok: true, save: c.save });
    const explicit = value(await c.freeBoard(null, false, offer!.id));
    expect(explicit[0]!.id).not.toBe(offer!.id);
  });

  it('rejects simultaneous writes and keeps the win available after a failed write', async () => {
    const store = new MemoryStore();
    const c = await career(store);
    const [offer] = value(await c.freeBoard(null));
    const { attempt } = value(await c.beginFreeRace(offer!.id));
    const before = structuredClone(c.save!);
    const win = record(offer!, attempt);
    const update = store.update.bind(store);
    store.update = async () => { throw new Error('storage offline'); };
    expect((await c.recordFreeRace(win)).ok).toBe(false);
    expect(c.save).toEqual(before);
    expect(await c.repo.load()).toEqual(before);
    store.update = update;
    const other = new CareerController(new CareerRepository(store, 'slot-1'));
    await other.load();
    const both = await Promise.all([c.recordFreeRace(win), other.recordFreeRace(win)]);
    expect(both.filter((result) => result.ok)).toHaveLength(1);
    await c.load();
    expect(c.save!.credits).toBe(before.credits + offer!.rewardCr);
    expect(c.save!.freeEvents.results).toHaveLength(1);
  });

  it('migrates v3 credits, garage, tune and both histories without reissuing a prize', async () => {
    const c = await career();
    const initial = c.save!;
    const [offer] = value(await c.freeBoard(null));
    const { attempt } = value(await c.beginFreeRace(offer!.id));
    const result = { ...record(offer!, attempt), creditsAwarded: 250, reputationAwarded: 0 };
    const old = {
      ...initial, version: 3, freeEvents: undefined, freeEventRotation: 91, credits: 2710, reputation: 13,
      results: [{ ...result, eventId: 'free-1-91-bairro' }, { ...result, eventId: 'story-race', attemptId: 'story-attempt' }],
      ownedCars: [{ ...initial.ownedCars[0], tune: { tirePressureKpa: 210 } }],
    };
    const m = parseCareerSave(old);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.save).toMatchObject({ version: 5, credits: 2710, reputation: 13, ownedCars: old.ownedCars });
    expect(m.save.results[0]!.eventId).toBe('story-race');
    expect(m.save.freeEvents.results[0]!.eventId).toBe('free-1-91-bairro');
    expect(m.save.freeEvents.stats[SECTION]).toMatchObject({ races: 1, wins: 1, creditsEarned: 250 });
    expect(m.save.freeEvents.offersByChapter).toEqual(newCareerSave().freeEvents.offersByChapter);
  });
});
