/**
 * Prize car of a chapter's final: the loser hands the car over. A copy of the rival's build (same
 * paint, parts, tune and resolver version), once per final, kept by the claim even when sold; a
 * full garage makes it wait; saves that won the final before the prize existed receive it later.
 */
import { describe, expect, it } from 'vitest';
import { CHAPTER2_EVENTS, EVENTS, rivalOf } from '../../../src/game/career/CareerEvents';
import { CareerController } from '../../../src/game/career/CareerController';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { MAX_GARAGE, parseCareerSave, type CareerRaceResult, type RunSummary } from '../../../src/game/career/CareerState';
import { STORY_SCENES, pendingScenes } from '../../../src/game/career/CareerStory';
import { CHAPTER_1_ID, CHAPTER_2_ID } from '../../../src/game/career/chapters';
import { DEALER_CARS, resaleValue } from '../../../src/game/career/chapter2/dealer';
import { prizeClaimId, prizeEvents, prizeState } from '../../../src/game/career/PrizeCars';
import { ownedCarBuild, rivalBuild } from '../../../src/game/career/RivalBuildFactory';
import { MemoryStore } from '../../../src/storage/db';

const run = (): RunSummary => ({ name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false });
let n = 0;
const result = (eventId: string, outcome: CareerRaceResult['outcome'] = 'win', attemptId?: string): Omit<CareerRaceResult, 'creditsAwarded' | 'reputationAwarded'> => ({
  attemptId: attemptId ?? `attempt-${++n}-prize`,
  eventId,
  playerCarId: 'car-1',
  opponentCarId: 'rival',
  playerResult: run(),
  opponentResult: run(),
  outcome,
  completedAt: new Date().toISOString(),
  buildVersion: 1,
  playerBuildKey: 'k',
  opponentBuildKey: 'k',
});

async function career(store = new MemoryStore()): Promise<CareerController> {
  const c = new CareerController(new CareerRepository(store, 'slot-1'));
  const r = await c.newCareer('vw-gol-gts-1988');
  if (!r.ok) throw new Error(r.error);
  return c;
}

const FINAL_1 = EVENTS.find((e) => e.finale)!;
const FINAL_2 = CHAPTER2_EVENTS.find((e) => e.finale)!;

/** Wins every event of a chapter but its final. */
async function winUpToFinal(c: CareerController, events: readonly { id: string; finale?: boolean }[]): Promise<void> {
  for (const e of events) if (!e.finale) expect((await c.recordRace(result(e.id))).ok).toBe(true);
}

describe('prize car of the final', () => {
  it('both chapters hand a car over: the rival of each final has a prize', () => {
    expect(prizeEvents().map((e) => e.id)).toEqual([FINAL_1.id, FINAL_2.id]);
    expect(rivalOf(FINAL_1).prize!.nickname).toBe('Saveiro do Marcos');
    expect(rivalOf(FINAL_2).prize!.nickname).toBe('335i do Victor');
    for (const e of prizeEvents()) expect(rivalOf(e).prize!.nickname.length).toBeLessThanOrEqual(32);
  });

  it('winning the chapter 1 final puts a copy of the rival car in the garage', async () => {
    const c = await career();
    await winUpToFinal(c, EVENTS);
    expect(c.save!.ownedCars).toHaveLength(1);
    const r = await c.recordRace(result(FINAL_1.id));
    expect(r.ok && r.value.prizeCar?.nickname).toBe('Saveiro do Marcos');
    const rv = rivalOf(FINAL_1);
    const car = c.save!.ownedCars.find((x) => x.prizeEventId === FINAL_1.id)!;
    expect(c.save!.ownedCars).toHaveLength(2);
    expect(car.baseCarId).toBe(rv.baseCarId);
    expect(car.installedParts).toEqual(rv.parts);
    expect(car.paint).toEqual(rv.paint);
    expect(car.tune).toEqual(rv.tune);
    expect(car.buildVersion).toBe(rv.buildVersion ?? 1);
    expect(c.save!.claimedRewardIds).toContain(prizeClaimId(FINAL_1.id));
    // the build is exactly the one that raced: same key, same peak numbers
    const mine = ownedCarBuild(car);
    const theirs = rivalBuild(rv);
    expect(mine.ok && mine.key).toBe(theirs.key);
    expect(mine.ok && mine.peakPowerCv).toBe(theirs.peakPowerCv);
    expect(mine.ok && mine.peakTorqueNm).toBe(theirs.peakTorqueNm);
    // the active car stays the one the player was driving
    expect(c.activeCar!.baseCarId).toBe('vw-gol-gts-1988');
    expect(parseCareerSave(JSON.parse(JSON.stringify(c.save))).ok).toBe(true);
  });

  it('is delivered once: a repeated win, a replayed attempt and a lost race give nothing more', async () => {
    const c = await career();
    await winUpToFinal(c, EVENTS);
    const first = result(FINAL_1.id);
    await c.recordRace(first);
    const again = await c.recordRace(first); // same attempt id
    expect(again.ok && again.value.prizeCar).toBeUndefined();
    const repeat = await c.recordRace(result(FINAL_1.id)); // a rematch won later
    expect(repeat.ok && repeat.value.prizeCar).toBeUndefined();
    expect(c.save!.ownedCars.filter((x) => x.prizeEventId === FINAL_1.id)).toHaveLength(1);
    expect(c.save!.ownedCars).toHaveLength(2);
  });

  it('a lost final and the other events give no car', async () => {
    const c = await career();
    await winUpToFinal(c, EVENTS);
    const lost = await c.recordRace(result(FINAL_1.id, 'loss'));
    expect(lost.ok && lost.value.prizeCar).toBeUndefined();
    expect(c.save!.ownedCars).toHaveLength(1);
    expect(prizeState(c.save!, FINAL_1)).toBe('not-won');
    expect(EVENTS.filter((e) => !e.finale).every((e) => !rivalOf(e).prize)).toBe(true);
  });

  it('chapter 2: Victor hands over the 335i with his build (resolver 2), sellable for 60 % of the list price', async () => {
    const c = await career();
    for (const e of EVENTS) await c.recordRace(result(e.id));
    await c.setActiveChapter(CHAPTER_2_ID);
    await winUpToFinal(c, CHAPTER2_EVENTS);
    const r = await c.recordRace(result(FINAL_2.id));
    expect(r.ok && r.value.prizeCar?.nickname).toBe('335i do Victor');
    const car = c.save!.ownedCars.find((x) => x.prizeEventId === FINAL_2.id)!;
    expect(car.baseCarId).toBe('bmw-335i-f30-2013');
    expect(car.buildVersion).toBe(2);
    expect(car.installedParts).toEqual(rivalOf(FINAL_2).parts);
    const b = ownedCarBuild(car);
    expect(b.ok && b.key).toBe(rivalBuild(rivalOf(FINAL_2)).key);
    const list = DEALER_CARS.find((d) => d.baseCarId === 'bmw-335i-f30-2013')!.price;
    expect(rivalOf(FINAL_2).prize!.value).toBe(list);
    expect(resaleValue(car)).toBe(33000);
    // the dealer's one-per-model rule: the player already has this 335i
    const buy = await c.buyCar('bmw-335i-f30-2013');
    expect(buy.ok).toBe(false);
  });

  it('selling the trophy pays the resale and does not hand a second car over', async () => {
    const c = await career();
    await winUpToFinal(c, EVENTS);
    await c.recordRace(result(FINAL_1.id));
    const car = c.save!.ownedCars.find((x) => x.prizeEventId === FINAL_1.id)!;
    const credits = c.save!.credits;
    const sold = await c.sellCar(car.id);
    expect(sold.ok && sold.value.credits).toBe(2100);
    expect(c.save!.credits).toBe(credits + 2100);
    expect(c.save!.ownedCars.some((x) => x.prizeEventId)).toBe(false);
    const rematch = await c.recordRace(result(FINAL_1.id));
    expect(rematch.ok && rematch.value.prizeCar).toBeUndefined();
    expect((await c.claimPendingPrizes()).ok).toBe(true);
    expect(c.save!.ownedCars.some((x) => x.prizeEventId)).toBe(false);
    expect(prizeState(c.save!, FINAL_1)).toBe('delivered');
  });

  it('a full garage keeps the prize waiting and nothing is lost; it arrives when there is room', async () => {
    const c = await career();
    await winUpToFinal(c, EVENTS);
    // fill the garage (the schema limit) with copies of the starter car
    const s = c.save!;
    const store = c.repo.store;
    const doc = JSON.parse(JSON.stringify(s));
    while (doc.ownedCars.length < MAX_GARAGE) doc.ownedCars.push({ ...doc.ownedCars[0], id: `car-fill-${doc.ownedCars.length}` });
    await store.put('career', doc);
    await c.load();
    expect(c.save!.ownedCars).toHaveLength(MAX_GARAGE);
    const r = await c.recordRace(result(FINAL_1.id));
    expect(r.ok && r.value.prizeCar).toBeUndefined();
    expect(r.ok && r.value.prizeGarageFull).toBe(true);
    expect(c.save!.completedEventIds).toContain(FINAL_1.id); // the win itself counts
    expect(prizeState(c.save!, FINAL_1)).toBe('garage-full');
    expect(c.save!.claimedRewardIds).not.toContain(prizeClaimId(FINAL_1.id));
    // still full: nothing is delivered, nothing breaks
    const none = await c.claimPendingPrizes();
    expect(none.ok && none.value).toEqual([]);
    // room opens: the car arrives
    await c.sellCar('car-fill-1');
    const given = await c.claimPendingPrizes();
    expect(given.ok && given.value.map((x) => x.nickname)).toEqual(['Saveiro do Marcos']);
    expect(prizeState(c.save!, FINAL_1)).toBe('delivered');
    expect((await c.claimPendingPrizes()).ok && c.save!.ownedCars.filter((x) => x.prizeEventId).length).toBe(1);
  });

  it('a save that won the final before the prize existed receives it afterwards, once', async () => {
    const store = new MemoryStore();
    const c = await career(store);
    await winUpToFinal(c, EVENTS);
    await c.recordRace(result(FINAL_1.id));
    // rewrite the stored save as it was before the prize: no car, no claim
    const doc = JSON.parse(JSON.stringify(c.save));
    doc.ownedCars = doc.ownedCars.filter((x: { prizeEventId?: string }) => !x.prizeEventId);
    doc.claimedRewardIds = doc.claimedRewardIds.filter((x: string) => x !== prizeClaimId(FINAL_1.id));
    await store.put('career', doc);
    const old = new CareerController(new CareerRepository(store, 'slot-1'));
    await old.load();
    expect(prizeState(old.save!, FINAL_1)).toBe('ready');
    const given = await old.claimPendingPrizes();
    expect(given.ok && given.value).toHaveLength(1);
    expect(old.save!.ownedCars.filter((x) => x.prizeEventId === FINAL_1.id)).toHaveLength(1);
    const again = await old.claimPendingPrizes();
    expect(again.ok && again.value).toEqual([]);
    expect(old.save!.ownedCars).toHaveLength(2);
  });
});

describe('prize texts', () => {
  it('each final has a hand-over scene by the loser and the stake is announced before the race', () => {
    for (const [ev, chapter] of [[FINAL_1, CHAPTER_1_ID], [FINAL_2, CHAPTER_2_ID]] as const) {
      const rv = rivalOf(ev);
      const scene = STORY_SCENES.find((x) => x.id === `prize-${ev.id}`)!;
      expect(scene.trigger).toBe('prize');
      expect(scene.chapter).toBe(chapter);
      expect(scene.lines[0]!.speaker).toBe(rv.portrait);
      expect(scene.lines[0]!.text).toMatch(/quem perde/i);
      expect(pendingScenes('prize', [], ev.id, chapter)).toHaveLength(1);
      expect(pendingScenes('prize', [scene.id], ev.id, chapter)).toHaveLength(0);
      const stake = pendingScenes('final-challenge', [], undefined, chapter).flatMap((x) => x.lines.map((l) => l.text)).join(' ');
      expect(stake).toMatch(/quem perde (a última etapa )?entrega o carro/);
    }
  });
});
