/**
 * Chapter 3 "Elite da Madrugada": chapter unlock, ten events and rivals (eight new cars and two
 * returning ones with prepared builds), the Elite dealer, the workshop of the V6 families, the
 * story and the prize car of the final (Akira's GT-R), and the compatibility of the saves.
 */
import { describe, expect, it } from 'vitest';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { CHAPTER2_EVENTS, CHAPTER3_EVENTS, CHAPTER3_RIVALS, EVENTS, eventsOf, findEvent, rivalOf } from '../../../src/game/career/CareerEvents';
import { CareerController } from '../../../src/game/career/CareerController';
import { eventStatus, isChapterComplete, isChapterUnlocked, nextEvent } from '../../../src/game/career/CareerProgression';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { parseCareerSave, type CareerRaceResult, type RunSummary } from '../../../src/game/career/CareerState';
import { SPEAKER_NAME, STORY_SCENES, pendingScenes } from '../../../src/game/career/CareerStory';
import { CHAPTERS, CHAPTER_1_ID, CHAPTER_2_ID, CHAPTER_3_ID, chapterOf, nextChapterOf } from '../../../src/game/career/chapters';
import { DEALER_CARS, offerAvailability, resaleValue } from '../../../src/game/career/chapter2/dealer';
import { ELITE_CARS } from '../../../src/game/career/chapter3/dealer';
import { prizeClaimId, prizeEvents, prizeState } from '../../../src/game/career/PrizeCars';
import { ownedCarBuild, rivalBuild } from '../../../src/game/career/RivalBuildFactory';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { ALL_PARTS, findPart } from '../../../src/game/career/tuning/parts';
import { MemoryStore } from '../../../src/storage/db';

const run = (): RunSummary => ({ name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false });
let n = 0;
const win = (eventId: string): Omit<CareerRaceResult, 'creditsAwarded' | 'reputationAwarded'> => ({
  attemptId: `attempt-${++n}-c3xx`,
  eventId,
  playerCarId: 'car-1',
  opponentCarId: 'rival',
  playerResult: run(),
  opponentResult: run(),
  outcome: 'win',
  completedAt: new Date().toISOString(),
  buildVersion: 2,
  playerBuildKey: 'k',
  opponentBuildKey: 'k',
});

type Internal = { commit(fn: (s: import('../../../src/game/career/CareerState').CareerSave) => void): Promise<unknown> };

async function career(): Promise<CareerController> {
  const c = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
  const r = await c.newCareer('vw-gol-gts-1988');
  if (!r.ok) throw new Error(r.error);
  return c;
}

async function finish(c: CareerController, evs: readonly { id: string }[]): Promise<void> {
  for (const e of evs) expect((await c.recordRace(win(e.id))).ok, e.id).toBe(true);
}

/** A career that completed chapters 1 and 2 (the way into chapter 3). */
async function atChapter3(): Promise<CareerController> {
  const c = await career();
  await finish(c, EVENTS);
  await c.setActiveChapter(CHAPTER_2_ID);
  await finish(c, CHAPTER2_EVENTS);
  return c;
}

describe('chapter 3 definition', () => {
  it('is the third chapter: after the league, with its own words, title and cap', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([CHAPTER_1_ID, CHAPTER_2_ID, CHAPTER_3_ID]);
    const c = chapterOf(CHAPTER_3_ID);
    expect(c.title).toBe('Elite da Madrugada');
    expect(c.after).toBe(CHAPTER_2_ID);
    expect(c.championTitle).toBe('Campeão da Elite');
    expect(c.completionScene).toBe('c3-completion');
    expect(c.unit).toBe('duelos');
    expect(c.reputationCap).toBeGreaterThan(chapterOf(CHAPTER_2_ID).reputationCap);
    expect(nextChapterOf(CHAPTER_2_ID)?.id).toBe(CHAPTER_3_ID);
    expect(nextChapterOf(CHAPTER_3_ID)).toBeUndefined();
  });

  it('is locked until chapter 2 is complete, then opens on its first event', async () => {
    const c = await career();
    expect(isChapterUnlocked(c.save!, CHAPTER_3_ID)).toBe(false);
    expect((await c.setActiveChapter(CHAPTER_3_ID)).ok).toBe(false);
    expect((await c.recordRace(win(CHAPTER3_EVENTS[0]!.id))).ok).toBe(false);
    await finish(c, EVENTS);
    expect(isChapterUnlocked(c.save!, CHAPTER_3_ID)).toBe(false); // chapter 1 alone does not open it
    await c.setActiveChapter(CHAPTER_2_ID);
    await finish(c, CHAPTER2_EVENTS);
    expect(isChapterUnlocked(c.save!, CHAPTER_3_ID)).toBe(true);
    expect(c.save!.unlockedChapters).toContain(CHAPTER_3_ID);
    expect((await c.setActiveChapter(CHAPTER_3_ID)).ok).toBe(true);
    expect(c.save!.storyMilestones).toContain('chapter-3-started');
    expect(nextEvent(c.save!, CHAPTER_3_ID)?.id).toBe(CHAPTER3_EVENTS[0]!.id);
    expect(eventStatus(c.save!, CHAPTER3_EVENTS[0]!)).toBe('available');
    expect(eventStatus(c.save!, CHAPTER3_EVENTS[1]!)).toBe('locked');
  });

  it('completing the ten events completes the chapter once and does not touch chapters 1 and 2', async () => {
    const c = await atChapter3();
    await c.setActiveChapter(CHAPTER_3_ID);
    const before = { ch1: c.save!.chapterCompletions[CHAPTER_1_ID], ch2: c.save!.chapterCompletions[CHAPTER_2_ID] };
    expect(isChapterComplete(c.save!, CHAPTER_3_ID)).toBe(false);
    const last = CHAPTER3_EVENTS[CHAPTER3_EVENTS.length - 1]!;
    for (const e of CHAPTER3_EVENTS) {
      const r = await c.recordRace(win(e.id));
      expect(r.ok && r.value.chapterCompleted).toBe(e.id === last.id);
    }
    expect(isChapterComplete(c.save!, CHAPTER_3_ID)).toBe(true);
    expect(c.save!.chapterCompletions[CHAPTER_3_ID]).toBeTruthy();
    expect(c.save!.chapterCompletions[CHAPTER_1_ID]).toBe(before.ch1);
    expect(c.save!.chapterCompletions[CHAPTER_2_ID]).toBe(before.ch2);
    expect(c.save!.storyMilestones).toContain('chapter-3-complete');
    expect(c.save!.reputation).toBeLessThanOrEqual(chapterOf(CHAPTER_3_ID).reputationCap);
  });
});

describe('the ten events and rivals', () => {
  it('ten events of the chapter, in three venues: 201 m, 402 m and, from the sixth on, three 1 km duels', () => {
    expect(CHAPTER3_EVENTS).toHaveLength(10);
    expect(eventsOf(CHAPTER_3_ID)).toBe(CHAPTER3_EVENTS);
    expect(CHAPTER3_EVENTS.map((e) => e.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(CHAPTER3_EVENTS.map((e) => e.distance)).toEqual(['eighth', 'eighth', 'quarter', 'quarter', 'quarter', 'km', 'quarter', 'km', 'quarter', 'km']);
    // the ids of the existing events never change
    expect(CHAPTER3_EVENTS.map((e) => e.id)).toEqual(['c3e1-a-volta-do-gti', 'c3e2-primeira-elite', 'c3e3-silencio-refinado', 'c3e4-zeta-de-verdade', 'c3e5-peso-pesado', 'c3e6-salao-italiano', 'c3e7-biturbo-alemao', 'c3e8-a-volta-da-evo', 'c3e9-o-trevo-vermelho', 'c3e10-elite-da-madrugada']);
    expect(new Set(CHAPTER3_EVENTS.map((e) => e.trackId))).toEqual(new Set(['marginal-alta', 'hangar-executivo', 'pier-elite']));
    expect(CHAPTER3_EVENTS.filter((e) => e.finale).map((e) => e.id)).toEqual(['c3e10-elite-da-madrugada']);
    expect(CHAPTER3_EVENTS.every((e) => e.chapter === CHAPTER_3_ID)).toBe(true);
    expect(findEvent('c3e5-peso-pesado')?.unlocks).toContain('c3-stage3');
    // prizes and reputation grow along the chapter
    for (let i = 1; i < CHAPTER3_EVENTS.length; i++) {
      expect(CHAPTER3_EVENTS[i]!.rewardCr).toBeGreaterThan(CHAPTER3_EVENTS[i - 1]!.rewardCr);
      expect(CHAPTER3_EVENTS[i]!.reputation).toBeGreaterThan(CHAPTER3_EVENTS[i - 1]!.reputation);
    }
  });

  it('eight new rivals drive the eight new cars, two come back with chapter 2 cars', () => {
    expect(CHAPTER3_RIVALS).toHaveLength(10);
    const ids = CHAPTER3_EVENTS.map((e) => rivalOf(e).baseCarId);
    for (const c of CHAPTER3_CARS) expect(ids.filter((x) => x === c.id), c.id).toHaveLength(1);
    expect(ids.filter((x) => x === 'vw-golf-gti-mk4-2003')).toHaveLength(1);
    expect(ids.filter((x) => x === 'mitsubishi-evo-x-2012')).toHaveLength(1);
    const ricardo = CHAPTER3_RIVALS.find((r) => r.id === 'ricardo-elite')!;
    const bianca = CHAPTER3_RIVALS.find((r) => r.id === 'bianca-elite')!;
    expect(ricardo.portrait).toBe('ricardo');
    expect(bianca.portrait).toBe('bianca');
    expect(rivalOf(CHAPTER3_EVENTS[CHAPTER3_EVENTS.length - 1]!).baseCarId).toBe('nissan-gtr-r35-2015');
    expect(new Set(CHAPTER3_RIVALS.map((r) => r.id)).size).toBe(10);
    expect(new Set(CHAPTER3_RIVALS.map((r) => r.buildId)).size).toBe(10);
  });

  it('every rival build resolves with the same resolver (version 2): the build is valid and compatible', () => {
    for (const r of CHAPTER3_RIVALS) {
      const base = findCampaignCar(r.baseCarId)!;
      expect(r.buildVersion, r.id).toBe(2);
      for (const id of r.parts) {
        expect(findPart(id), `${r.id}: ${id}`).toBeTruthy();
        expect(incompatibility(base, findPart(id)!), `${r.id}: ${id}`).toBeNull();
      }
      const b = rivalBuild(r);
      expect(b.ok).toBe(true);
      expect(b.version).toBe(2);
    }
  });

  it('no hidden power: every rival build is exactly what the player resolver produces from the same parts and tune', () => {
    for (const r of CHAPTER3_RIVALS) {
      const direct = resolveBuild(findCampaignCar(r.baseCarId)!, r.parts, r.tune ?? {}, 2);
      const b = rivalBuild(r);
      expect(direct.ok, r.id).toBe(true);
      expect(b.peakPowerCv, r.id).toBe(direct.ok ? direct.peakPowerCv : -1);
      expect(b.peakTorqueNm, r.id).toBe(direct.ok ? direct.peakTorqueNm : -1);
      expect(b.car.massKg, r.id).toBe(direct.ok ? direct.car.massKg : -1);
    }
  });

  it('Ricardo comes back with a Golf Stage 2 and Bianca with a much more prepared Evo X', () => {
    const ricardo = CHAPTER3_RIVALS.find((r) => r.id === 'ricardo-elite')!;
    const bianca = CHAPTER3_RIVALS.find((r) => r.id === 'bianca-elite')!;
    expect(ricardo.parts).toContain('ecu-map-vw-ea113-s2');
    for (const need of ['downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'clutch-vw-ea113-s1', 'suspension-drag-fwd']) expect(ricardo.parts).toContain(need);
    const golf0 = resolveBuild(findCampaignCar('vw-golf-gti-mk4-2003')!, [], {}, 2);
    const rb = rivalBuild(ricardo);
    expect(golf0.ok).toBe(true);
    if (golf0.ok) {
      expect(rb.peakPowerCv).toBeGreaterThan(golf0.peakPowerCv * 1.2);
      expect(rb.peakTorqueNm).toBeGreaterThan(golf0.peakTorqueNm * 1.2);
    }
    for (const need of ['ecu-map-mitsubishi-4b11-s3', 'turbo-hybrid', 'pistons-forged-modern', 'intercooler-race', 'dct-upgrade', 'awd-center-tune', 'tires-slick', 'suspension-drag-awd']) expect(bianca.parts).toContain(need);
    const evo2 = CHAPTER3_RIVALS.find((r) => r.id === 'bianca-elite')!;
    const evoCh2 = rivalBuild(rivalOf(findEvent('c2e9-tracao-total')!));
    expect(rivalBuild(evo2).peakPowerCv).toBeGreaterThan(evoCh2.peakPowerCv * 1.25);
    expect(rivalBuild(evo2).car.massKg).toBeGreaterThan(1500);
  });

  it('every character has a name and the lines of its scenes', () => {
    for (const r of CHAPTER3_RIVALS) {
      expect(SPEAKER_NAME[r.portrait], r.id).toBeTruthy();
      expect(r.lines.before.length).toBeGreaterThan(20);
      expect(r.lines.win.length).toBeGreaterThan(20);
      expect(r.skillLabel.length).toBeGreaterThan(10);
    }
    // the elite driver is the sharpest
    const reaction = CHAPTER3_RIVALS.map((r) => r.skill.reactionMeanS);
    expect(Math.min(...reaction)).toBe(CHAPTER3_RIVALS.find((r) => r.id === 'akira')!.skill.reactionMeanS);
  });
});

describe('the Elite dealer', () => {
  const prices: Record<string, number> = {
    'nissan-350z-2006': 45000,
    'lexus-is350-2015': 58000,
    'nissan-370z-2014': 70000,
    'mercedes-amg-c43-2017': 105000,
    'kia-stinger-gt-2019': 115000,
    'maserati-ghibli-sq4-2015': 145000,
    'alfa-giulia-qv-2017': 190000,
    'nissan-gtr-r35-2015': 250000,
  };

  it('sells the eight cars at the prices of the plan, all of chapter 3', () => {
    expect(ELITE_CARS).toHaveLength(8);
    for (const o of ELITE_CARS) {
      expect(o.chapter).toBe(3);
      expect(o.price).toBe(prices[o.baseCarId]);
      expect(DEALER_CARS.filter((d) => d.baseCarId === o.baseCarId)).toHaveLength(1);
      expect(findCampaignCar(o.baseCarId)).toBeTruthy();
    }
    // reputation opens them in the order of the chapter
    for (let i = 1; i < ELITE_CARS.length; i++) expect(ELITE_CARS[i]!.minReputation).toBeGreaterThan(ELITE_CARS[i - 1]!.minReputation);
  });

  it('is closed before chapter 3, opens by reputation and the GT-R needs the unlock of the penultimate duel', async () => {
    const c = await career();
    expect(offerAvailability(c.save!, ELITE_CARS[0]!).ok).toBe(false);
    const c2 = await atChapter3();
    const first = ELITE_CARS[0]!;
    // the least reputation chapter 2 leaves still opens the cheapest car
    expect(c2.save!.reputation).toBeGreaterThanOrEqual(first.minReputation);
    expect(offerAvailability(c2.save!, first).ok).toBe(true);
    const gtr = ELITE_CARS.find((o) => o.baseCarId === 'nissan-gtr-r35-2015')!;
    const a = offerAvailability(c2.save!, gtr);
    expect(a.ok).toBe(false);
    expect(!a.ok && a.reason).toMatch(/Elite/);
    await c2.setActiveChapter(CHAPTER_3_ID);
    await finish(c2, CHAPTER3_EVENTS.slice(0, 8));
    expect(offerAvailability(c2.save!, gtr).ok).toBe(false); // the unlock comes with the 9th duel
    await finish(c2, CHAPTER3_EVENTS.slice(8, 9));
    expect(c2.save!.reputation).toBeGreaterThanOrEqual(gtr.minReputation);
    expect(offerAvailability(c2.save!, gtr).ok).toBe(true);
  });

  it('buys with confirmation by the controller, once per model, and resells at 60 %', async () => {
    const c = await atChapter3();
    await (c as unknown as Internal).commit((s) => void (s.credits = 120000));
    const first = ELITE_CARS[0]!;
    const buy = await c.buyCar(first.baseCarId);
    expect(buy.ok).toBe(true);
    expect(c.save!.credits).toBe(120000 - first.price);
    const car = c.save!.ownedCars.find((x) => x.baseCarId === first.baseCarId)!;
    expect(car.buildVersion).toBe(2);
    expect(car.purchasePrice).toBe(first.price);
    expect((await c.buyCar(first.baseCarId)).ok).toBe(false); // one per model
    expect(c.save!.credits).toBe(120000 - first.price);
    const sold = await c.sellCar(car.id);
    expect(sold.ok && sold.value.credits).toBe(Math.round((first.price * 0.6) / 10) * 10);
    expect(resaleValue({ baseCarId: first.baseCarId, purchasePrice: first.price })).toBe(27000);
    // the car resolves on its own (no parts: the factory car)
    const again = await c.buyCar(first.baseCarId);
    expect(again.ok).toBe(true);
    const b = ownedCarBuild(c.save!.ownedCars.find((x) => x.baseCarId === first.baseCarId)!);
    expect(b.ok).toBe(true);
  });

  it('refuses when the credits are short and when the reputation is not enough', async () => {
    const c = await atChapter3();
    await (c as unknown as Internal).commit((s) => void (s.credits = 1000));
    expect((await c.buyCar(ELITE_CARS[0]!.baseCarId)).ok).toBe(false);
    await (c as unknown as Internal).commit((s) => void (s.credits = 999999));
    expect((await c.buyCar('nissan-gtr-r35-2015')).ok).toBe(false); // locked by reputation and by the unlock
    expect(c.save!.credits).toBe(999999);
  });
});

describe('workshop of the V6 families', () => {
  const car = (id: string) => findCampaignCar(id)!;
  const part = (id: string) => findPart(id)!;

  it('aspirated V6: no boost parts, no remap of other engines, but the generic parts fit', () => {
    for (const id of ['nissan-350z-2006', 'lexus-is350-2015', 'nissan-370z-2014']) {
      for (const p of ['ecu-map-bmw-n20-s1', 'ecu-map-bmw-n20-s2', 'turbo-hybrid', 'boost-control', 'intercooler-race', 'ecu-programmable']) expect(incompatibility(car(id), part(p)), `${id} ${p}`).not.toBeNull();
      for (const p of ['cam-k20', 'cam-familia2', 'manifold-k20-rbc', 'head-ported', 'ecu-stage1-na']) expect(incompatibility(car(id), part(p)), `${id} ${p}`).not.toBeNull();
      for (const p of ['tires-semislick', 'weight-light', 'suspension-drag-rwd']) expect(incompatibility(car(id), part(p)), `${id} ${p}`).toBeNull();
    }
  });

  it('biturbo V6: the whole turbo tree fits, and the gearbox parts only the right gearbox', () => {
    for (const id of ['mercedes-amg-c43-2017', 'kia-stinger-gt-2019', 'maserati-ghibli-sq4-2015', 'alfa-giulia-qv-2017', 'nissan-gtr-r35-2015']) {
      const fam = car(id).engine.family;
      for (const p of ['ecu-map-' + fam + '-s1', 'ecu-map-' + fam + '-s2', 'ecu-map-' + fam + '-s3', 'turbo-hybrid', 'boost-control', 'intercooler-race', 'pistons-forged-modern', 'downpipe-catless']) expect(incompatibility(car(id), part(p)), `${id} ${p}`).toBeNull();
    }
    expect(incompatibility(car('nissan-gtr-r35-2015'), part('dct-upgrade'))).toBeNull();
    expect(incompatibility(car('nissan-gtr-r35-2015'), part('at-upgrade'))).not.toBeNull();
    expect(incompatibility(car('alfa-giulia-qv-2017'), part('at-upgrade'))).toBeNull();
    expect(incompatibility(car('alfa-giulia-qv-2017'), part('awd-center-tune'))).not.toBeNull(); // rear drive
    expect(incompatibility(car('maserati-ghibli-sq4-2015'), part('awd-center-tune'))).toBeNull();
    expect(ALL_PARTS.filter((p) => p.compat?.families?.some((f) => f.startsWith('vw-ap')))).toHaveLength(0);
  });

  it('a Stage 1 on a twin turbo raises the power with the same engine model (no multiplier)', () => {
    const base = resolveBuild(car('alfa-giulia-qv-2017'), [], {}, 2);
    const s1 = resolveBuild(car('alfa-giulia-qv-2017'), ['ecu-map-alfa-690t-s1'], {}, 2);
    expect(base.ok && s1.ok).toBe(true);
    if (base.ok && s1.ok) {
      expect(s1.peakPowerCv).toBeGreaterThan(base.peakPowerCv * 1.05);
      expect(s1.peakPowerCv).toBeLessThan(base.peakPowerCv * 1.3);
      expect(s1.car.engine.turbo?.layout).toBe('parallel-twin');
      expect(s1.steadyBoostBar.length).toBeGreaterThan(0);
    }
  });

  it('a Stage 2 map refuses to be installed without the hardware it needs', () => {
    const r = resolveBuild(car('nissan-gtr-r35-2015'), ['ecu-map-nissan-vr38dett-s2'], {}, 2);
    expect(r.ok).toBe(false);
  });
});

describe('story of chapter 3', () => {
  it('has its intro, workshop, defeat, final and completion scenes, and the final is not the one of chapter 2', () => {
    const ids = STORY_SCENES.filter((s) => s.chapter === CHAPTER_3_ID).map((s) => s.id);
    for (const id of ['c3-intro', 'c3-workshop', 'c3-first-defeat', 'c3-final-challenge', 'c3-completion', 'prize-c3e10-elite-da-madrugada']) expect(ids).toContain(id);
    for (const e of CHAPTER3_EVENTS) {
      expect(ids).toContain(`pre-${e.id}`);
      expect(ids).toContain(`win-${e.id}`);
    }
    const done = STORY_SCENES.find((s) => s.id === 'c3-completion')!;
    expect(done.lines.map((l) => l.text).join(' ')).toMatch(/Elite da Madrugada/);
    expect(done.lines.map((l) => l.text).join(' ')).not.toMatch(/Dono da Liga/);
    expect(pendingScenes('start', [], undefined, CHAPTER_3_ID).map((s) => s.id)).toEqual(['c3-intro']);
    expect(pendingScenes('completion', [], undefined, CHAPTER_3_ID).map((s) => s.id)).toEqual(['c3-completion']);
    // chapters do not leak into each other
    expect(pendingScenes('start', [], undefined, CHAPTER_2_ID).map((s) => s.id)).not.toContain('c3-intro');
  });

  it('the boss hands the GT-R over: the loser gives the car and says so before the race', () => {
    const scene = STORY_SCENES.find((s) => s.id === 'prize-c3e10-elite-da-madrugada')!;
    expect(scene.lines[0]!.speaker).toBe('akira');
    expect(scene.lines[0]!.text).toMatch(/quem perde/i);
    const stake = pendingScenes('final-challenge', [], undefined, CHAPTER_3_ID).flatMap((s) => s.lines.map((l) => l.text)).join(' ');
    expect(stake).toMatch(/quem perde o último duelo entrega o carro/);
  });
});

describe('prize of the final: the GT-R of the boss', () => {
  const FINAL = CHAPTER3_EVENTS[CHAPTER3_EVENTS.length - 1]!;

  it('is one of the finals that hand a car over (chapters 1, 2 and 3)', () => {
    expect(prizeEvents().map((e) => e.id)).toEqual(['e7-rei-da-madrugada', 'c2e10-dono-da-liga', FINAL.id]);
    expect(rivalOf(FINAL).prize!.nickname).toBe('GT-R do Akira');
    expect(rivalOf(FINAL).prize!.value).toBe(250000);
  });

  it('winning the final puts a copy of Akira\'s car in the garage once, with the same build', async () => {
    const c = await atChapter3();
    await c.setActiveChapter(CHAPTER_3_ID);
    await finish(c, CHAPTER3_EVENTS.slice(0, 9));
    expect(c.save!.ownedCars.some((x) => x.prizeEventId === FINAL.id)).toBe(false);
    const r = await c.recordRace(win(FINAL.id));
    expect(r.ok && r.value.prizeCar?.nickname).toBe('GT-R do Akira');
    const car = c.save!.ownedCars.find((x) => x.prizeEventId === FINAL.id)!;
    const rv = rivalOf(FINAL);
    expect(car.baseCarId).toBe('nissan-gtr-r35-2015');
    expect(car.paint).toEqual(rv.paint);
    expect(car.installedParts).toEqual(rv.parts);
    expect(car.buildVersion).toBe(2);
    expect(car.purchasePrice).toBe(250000);
    const mine = ownedCarBuild(car);
    expect(mine.ok && mine.key).toBe(rivalBuild(rv).key);
    expect(c.save!.claimedRewardIds).toContain(prizeClaimId(FINAL.id));
    // once: a rematch and the retroactive claim give nothing more
    const again = await c.recordRace(win(FINAL.id));
    expect(again.ok && again.value.prizeCar).toBeUndefined();
    expect((await c.claimPendingPrizes()).ok).toBe(true);
    expect(c.save!.ownedCars.filter((x) => x.prizeEventId === FINAL.id)).toHaveLength(1);
    expect(prizeState(c.save!, FINAL)).toBe('delivered');
    // it can be used and sold afterwards (60 % of the list price)
    expect(resaleValue(car)).toBe(150000);
    expect((await c.setActiveCar(car.id)).ok).toBe(true);
    const sold = await c.sellCar(car.id);
    expect(sold.ok && sold.value.credits).toBe(150000);
    expect((await c.claimPendingPrizes()).ok && c.save!.ownedCars.some((x) => x.prizeEventId === FINAL.id)).toBe(false);
  });
});

describe('saves', () => {
  it('a save of chapter 2 (version 2, before chapter 3) stays valid and gets chapter 3 when chapter 2 is complete', async () => {
    const c = await atChapter3();
    const doc = JSON.parse(JSON.stringify(c.save));
    doc.unlockedChapters = doc.unlockedChapters.filter((x: string) => x !== CHAPTER_3_ID); // as written before chapter 3
    expect(parseCareerSave(doc).ok).toBe(true);
    // loading it and winning anything of a chapter re-syncs the unlocked chapters
    const store = new MemoryStore();
    await store.put('career', doc);
    const old = new CareerController(new CareerRepository(store, 'slot-1'));
    await old.load();
    expect(isChapterUnlocked(old.save!, CHAPTER_3_ID)).toBe(true); // by the completion of chapter 2, not by the stored list
    expect((await old.setActiveChapter(CHAPTER_3_ID)).ok).toBe(true);
    expect(old.save!.unlockedChapters).toContain(CHAPTER_3_ID);
    expect(old.save!.credits).toBe(c.save!.credits);
    expect(old.save!.ownedCars).toEqual(c.save!.ownedCars);
    expect(old.save!.completedEventIds).toEqual(c.save!.completedEventIds);
  });

  it('an unknown chapter id is still refused', async () => {
    const c = await career();
    const doc = JSON.parse(JSON.stringify(c.save));
    doc.chapterId = 'chapter-4';
    expect(parseCareerSave(doc).ok).toBe(false);
  });
});

describe('the eight new cars as owned cars', () => {
  it('each one resolves as an owned car of resolver 2 with its own factory numbers', () => {
    for (const car of CHAPTER3_CARS) {
      const b = ownedCarBuild({ id: 'x', baseCarId: car.id, nickname: 'x', paint: { color: '#112233', accent: '#445566' }, installedParts: [], buildVersion: 1, acquiredAt: '2026-01-01T00:00:00.000Z' });
      expect(b.ok, car.id).toBe(true);
      if (b.ok) {
        expect(b.version).toBe(2);
        expect(b.peakPowerCv).toBeGreaterThan(300);
      }
    }
  });
});
