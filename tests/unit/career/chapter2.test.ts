/**
 * Chapter 2 "Liga da Madrugada": resolver v2 equivalence and compatibility, save migration v1 → v2,
 * chapter progression, dealer, sale, programmable ECU and the story scenes of the chapter.
 */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CARS, findCampaignCar } from '../../../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER2_EVENTS, CHAPTER2_RIVALS, EVENTS, RIVALS, eventsOf } from '../../../src/game/career/CareerEvents';
import { CareerController, buildVersionFor, inventoryEntry } from '../../../src/game/career/CareerController';
import { eventStatus, isChapterComplete, isChapterUnlocked, nextEvent, partStatus } from '../../../src/game/career/CareerProgression';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { CAREER_SAVE_VERSION, parseCareerSave, type CareerRaceResult, type RunSummary } from '../../../src/game/career/CareerState';
import { STORY_SCENES, pendingScenes } from '../../../src/game/career/CareerStory';
import { CHAPTER_1_ID, CHAPTER_2_ID, chapterOf } from '../../../src/game/career/chapters';
import { DEALER_CARS, RESALE_SHARE } from '../../../src/game/career/chapter2/dealer';
import { ownedCarBuild, rivalBuild } from '../../../src/game/career/RivalBuildFactory';
import { clearBuildCache, resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { PARTS, findPart } from '../../../src/game/career/tuning/parts';
import { MemoryStore } from '../../../src/storage/db';

const run = (): RunSummary => ({ name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false });
let n = 0;
const win = (eventId: string): Omit<CareerRaceResult, 'creditsAwarded' | 'reputationAwarded'> => ({
  attemptId: `attempt-${++n}-c2xx`,
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

async function career(): Promise<CareerController> {
  const c = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
  const r = await c.newCareer('vw-gol-gts-1988');
  if (!r.ok) throw new Error(r.error);
  return c;
}

async function finishChapter1(c: CareerController): Promise<void> {
  for (const e of EVENTS) expect((await c.recordRace(win(e.id))).ok).toBe(true);
}

/** Every chapter 1 build worth checking: each single part, the rivals' builds, and full builds. */
function chapter1Builds(): { car: string; parts: string[]; tune?: { boostBar: number } }[] {
  const out: { car: string; parts: string[]; tune?: { boostBar: number } }[] = [];
  for (const car of CAMPAIGN_CARS) {
    out.push({ car: car.id, parts: [] });
    for (const p of PARTS) out.push({ car: car.id, parts: [p.id] });
    out.push({ car: car.id, parts: ['filter-sport', 'exhaust-sport', 'manifold-sport', 'cam-sport', 'tires-semislick', 'differential-short', 'clutch-reinforced'] });
    out.push({ car: car.id, parts: ['turbo-basic', 'clutch-reinforced', 'exhaust-sport', 'tires-semislick'], tune: { boostBar: 0.8 } });
  }
  for (const r of RIVALS) out.push({ car: r.baseCarId, parts: r.parts, tune: r.tune?.boostBar !== undefined ? { boostBar: r.tune.boostBar } : undefined });
  return out;
}

describe('build resolver v2', () => {
  it('gives exactly the version 1 result on every chapter 1 car and build', () => {
    clearBuildCache();
    let compared = 0;
    for (const b of chapter1Builds()) {
      const base = findCampaignCar(b.car)!;
      const v1 = resolveBuild(base, b.parts, b.tune ?? {}, 1);
      const v2 = resolveBuild(base, b.parts, b.tune ?? {}, 2);
      expect(v2.ok, `${b.car} ${b.parts.join('+')}`).toBe(v1.ok);
      if (v1.ok && v2.ok) {
        expect(v2.car).toEqual(v1.car);
        expect(v2.peakPowerCv).toBe(v1.peakPowerCv);
        expect(v2.peakTorqueNm).toBe(v1.peakTorqueNm);
        expect(v2.steadyBoostBar).toEqual(v1.steadyBoostBar);
        expect(v1.version).toBe(1);
        compared++;
      } else if (!v1.ok && !v2.ok) expect(v2.errors).toEqual(v1.errors);
    }
    expect(compared).toBeGreaterThan(60);
  });

  it('keeps old build keys and marks version 2 keys', () => {
    const base = findCampaignCar('vw-gol-gts-1988')!;
    const v1 = resolveBuild(base, ['filter-sport'], {}, 1);
    const v2 = resolveBuild(base, ['filter-sport'], {}, 2);
    expect(v1.ok && v1.key).toBe('vw-gol-gts-1988|filter-sport');
    expect(v2.ok && v2.key).toBe('v2|vw-gol-gts-1988|filter-sport');
  });

  it('never installs a part of another engine family, induction, gearbox or axle', () => {
    const car = (id: string) => CHAPTER2_CARS.find((c) => c.id === id)!;
    const n55 = car('bmw-335i-f30-2013');
    const jetta = car('vw-jetta-tsi-2012');
    const golf = car('vw-golf-gti-mk4-2003');
    const civic = car('honda-civic-si-2008');
    const evo = car('mitsubishi-evo-x-2012');
    expect(incompatibility(n55, findPart('cam-k20')!)).toMatch(/não é feita/);
    expect(incompatibility(n55, findPart('cam-sport')!)).not.toBeNull(); // chapter 1 AP-style cam
    expect(incompatibility(jetta, findPart('clutch-reinforced')!)).not.toBeNull(); // manual clutch on a DSG
    expect(incompatibility(golf, findPart('dct-upgrade')!)).not.toBeNull();
    expect(incompatibility(golf, findPart('at-upgrade')!)).not.toBeNull();
    expect(incompatibility(golf, findPart('awd-center-tune')!)).not.toBeNull();
    expect(incompatibility(civic, findPart('ecu-stage1')!)).not.toBeNull(); // turbo map on an NA engine
    expect(incompatibility(civic, findPart('turbo-basic')!)).not.toBeNull(); // chapter 1 kit is for the old engines
    expect(incompatibility(evo, findPart('awd-center-tune')!)).toBeNull();
    expect(incompatibility(civic, findPart('cam-k20')!)).toBeNull();
    const r = resolveBuild(n55, ['cam-k20'], {}, 2);
    expect(r.ok).toBe(false);
  });

  it('derives Stage 1 from the physics: different gains per engine, never a fixed power', () => {
    const gains = CHAPTER2_CARS.filter((c) => c.engine.induction === 'turbo').map((c) => {
      const s = resolveBuild(c, [], {}, 2);
      const st1 = resolveBuild(c, ['ecu-stage1'], {}, 2);
      if (!s.ok || !st1.ok) throw new Error(c.id);
      expect(st1.peakPowerCv).toBeGreaterThan(s.peakPowerCv);
      expect(st1.car.massKg).toBe(s.car.massKg);
      return st1.peakPowerCv / s.peakPowerCv;
    });
    expect(Math.max(...gains) - Math.min(...gains)).toBeGreaterThan(0.03);
  });

  it('the hybrid turbo needs the programmable ECU and the boost stays within the ECU range', () => {
    const n55 = CHAPTER2_CARS.find((c) => c.id === 'bmw-335i-f30-2013')!;
    expect(resolveBuild(n55, ['turbo-hybrid'], {}, 2).ok).toBe(false);
    const b0 = n55.engine.turbo!.maxBoostBar;
    const ok = resolveBuild(n55, ['ecu-programmable', 'boost-control'], { boostBar: b0 + 0.5 }, 2);
    expect(ok.ok).toBe(true);
    expect(resolveBuild(n55, ['ecu-programmable', 'boost-control'], { boostBar: b0 + 1.2 }, 2).ok).toBe(false);
  });

  it('every chapter 2 rival build is valid and resolved by version 2', () => {
    for (const r of CHAPTER2_RIVALS) {
      const b = rivalBuild(r);
      expect(b.version, r.id).toBe(2);
      expect(r.parts.every((id) => findPart(id))).toBe(true);
    }
  });
});

describe('chapter 2 data', () => {
  it('has the ten events of the script in order, with rivals, cars and distances', () => {
    expect(CHAPTER2_EVENTS.map((e) => [e.order, e.title, CHAPTER2_RIVALS.find((r) => r.id === e.rivalId)!.baseCarId, e.distance])).toEqual([
      [1, 'Portas Abertas', 'gm-astra-2011', 'eighth'],
      [2, 'Turbo Francês', 'peugeot-208-gt-2017', 'eighth'],
      [3, 'A Lenda do GTI', 'vw-golf-gti-mk4-2003', 'quarter'],
      [4, 'Quatro Argolas', 'audi-a3-18t-2005', 'quarter'],
      [5, 'Precisão Alemã', 'mercedes-c200-w205-2015', 'quarter'],
      [6, 'Tração Traseira', 'bmw-320i-f30-2014', 'quarter'],
      [7, 'VTEC', 'honda-civic-si-2008', 'quarter'],
      [8, 'Troca Perfeita', 'vw-jetta-tsi-2012', 'quarter'],
      [9, 'Tração Total', 'mitsubishi-evo-x-2012', 'quarter'],
      [10, 'O Dono da Liga', 'bmw-335i-f30-2013', 'quarter'],
    ]);
    expect(CHAPTER2_EVENTS.every((e) => e.chapter === CHAPTER_2_ID)).toBe(true);
    expect(EVENTS.every((e) => e.chapter === CHAPTER_1_ID)).toBe(true);
    expect(new Set(CHAPTER2_EVENTS.map((e) => e.trackId))).toEqual(new Set(['patio-das-torres', 'distrito-financeiro', 'corredor-da-liga']));
  });

  it('keeps the script lines', () => {
    const line = (id: string) => CHAPTER2_RIVALS.find((r) => r.id === id)!.lines;
    expect(line('guga').before).toBe('Fiquei sabendo que você venceu o Marcos. Quero ver se consegue manter o ritmo.');
    expect(line('lucas').before).toBe('Você tem turbo. Eu tenho giro. Vamos ver quem faz o melhor tempo.');
    expect(line('victor').win).toBe('Você não venceu por sorte. Esse carro foi construído para chegar até aqui.');
  });

  it('dealer prices are the balance prices of the plan', () => {
    expect(DEALER_CARS.map((d) => [d.baseCarId, d.price])).toEqual([
      ['gm-astra-2011', 6000],
      ['peugeot-208-gt-2017', 14000],
      ['vw-golf-gti-mk4-2003', 18000],
      ['audi-a3-18t-2005', 20000],
      ['mercedes-c200-w205-2015', 25000],
      ['bmw-320i-f30-2014', 26000],
      ['honda-civic-si-2008', 28000],
      ['vw-jetta-tsi-2012', 33000],
      ['mitsubishi-evo-x-2012', 45000],
      ['bmw-335i-f30-2013', 55000],
    ]);
  });

  it('chapter 2 story: Caio is introduced, scenes belong to their chapter', () => {
    const intro = STORY_SCENES.find((s) => s.id === 'c2-intro')!;
    expect(intro.lines.some((l) => l.speaker === 'caio')).toBe(true);
    expect(pendingScenes('start', [], undefined, CHAPTER_2_ID).map((s) => s.id)).toEqual(['c2-intro']);
    expect(pendingScenes('start', [], undefined, CHAPTER_1_ID).map((s) => s.id)).toEqual(['intro']);
    expect(pendingScenes('completion', [], undefined, CHAPTER_2_ID).map((s) => s.id)).toEqual(['c2-completion']);
  });
});

describe('save v2 and migration', () => {
  const v1Doc = (complete: boolean) => {
    const ids = complete ? EVENTS.map((e) => e.id) : EVENTS.slice(0, 3).map((e) => e.id);
    return {
      version: 1,
      slotId: 'slot-1',
      chapterId: 'chapter-1',
      revision: 9,
      credits: 5120,
      reputation: complete ? 200 : 45,
      ownedCars: [
        { id: 'car-1-vw-gol-gts-1988', baseCarId: 'vw-gol-gts-1988', nickname: 'Gol', paint: { color: '#c8322b', accent: '#222222' }, installedParts: ['filter-sport', 'turbo-basic', 'clutch-reinforced'], tune: { boostBar: 0.7 }, acquiredAt: '2026-01-01T00:00:00.000Z' },
      ],
      activeCarId: 'car-1-vw-gol-gts-1988',
      inventoryPartIds: ['exhaust-sport@vw-gol-gts-1988'],
      completedEventIds: ids,
      claimedRewardIds: ids.map((i) => `${i}:first`),
      seenStorySceneIds: ['intro', 'completion'],
      results: [],
      chapterCompletedAt: complete ? '2026-02-01T00:00:00.000Z' : null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
  };

  it('migrates a finished chapter 1 save: nothing is lost, chapter 2 opens, cars keep resolver 1', () => {
    const r = parseCareerSave(v1Doc(true));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.save;
    expect(s.version).toBe(CAREER_SAVE_VERSION);
    expect(s.chapterId).toBe(CHAPTER_1_ID);
    expect(s.unlockedChapters).toEqual([CHAPTER_1_ID, CHAPTER_2_ID]);
    expect(s.chapterCompletions[CHAPTER_1_ID]).toBe('2026-02-01T00:00:00.000Z');
    expect(s.credits).toBe(5120);
    expect(s.reputation).toBe(200);
    expect(s.inventoryPartIds).toEqual(['exhaust-sport@vw-gol-gts-1988']);
    expect(s.ownedCars[0]!.buildVersion).toBe(1);
    expect(s.ownedCars[0]!.tune).toEqual({ boostBar: 0.7 });
    expect(s.seenStorySceneIds).toEqual(['intro', 'completion']);
    // the build resolves exactly as with the chapter 1 resolver
    const b = ownedCarBuild(s.ownedCars[0]!);
    const v1 = resolveBuild(findCampaignCar('vw-gol-gts-1988')!, ['filter-sport', 'turbo-basic', 'clutch-reinforced'], { boostBar: 0.7 }, 1);
    expect(b.ok && v1.ok && b.key === v1.key).toBe(true);
  });

  it('migrates an unfinished save without opening chapter 2', () => {
    const r = parseCareerSave(v1Doc(false));
    expect(r.ok && r.save.unlockedChapters).toEqual([CHAPTER_1_ID]);
  });

  it('rejects an active chapter that is not unlocked', () => {
    const doc = { ...v1Doc(false), version: 2, chapterId: CHAPTER_2_ID, unlockedChapters: [CHAPTER_1_ID], chapterCompletions: {}, storyMilestones: [] };
    expect(parseCareerSave(doc).ok).toBe(false);
  });
});

describe('chapter 2 progression and economy', () => {
  it('chapter 2 is locked until chapter 1 is complete, then opens on its first event', async () => {
    const c = await career();
    expect(isChapterUnlocked(c.save!, CHAPTER_2_ID)).toBe(false);
    expect(eventStatus(c.save!, CHAPTER2_EVENTS[0]!)).toBe('locked');
    expect((await c.setActiveChapter(CHAPTER_2_ID)).ok).toBe(false);
    expect((await c.recordRace(win(CHAPTER2_EVENTS[0]!.id))).ok).toBe(false); // a locked chapter takes no result
    await finishChapter1(c);
    expect(c.save!.unlockedChapters).toContain(CHAPTER_2_ID);
    expect(c.save!.chapterCompletions[CHAPTER_1_ID]).toBeTruthy();
    expect((await c.setActiveChapter(CHAPTER_2_ID)).ok).toBe(true);
    expect(c.save!.chapterId).toBe(CHAPTER_2_ID);
    expect(c.save!.storyMilestones).toContain('chapter-2-started');
    expect(nextEvent(c.save!, CHAPTER_2_ID)!.order).toBeGreaterThanOrEqual(1);
    // chapter 1 progress untouched
    expect(isChapterComplete(c.save!, CHAPTER_1_ID)).toBe(true);
  });

  it('events unlock in order; the final needs the final-challenge unlock; completion is recorded', async () => {
    const c = await career();
    await finishChapter1(c);
    const evs = eventsOf(CHAPTER_2_ID);
    expect(eventStatus(c.save!, evs[1]!)).toBe('locked');
    for (const e of evs.slice(0, 9)) expect((await c.recordRace(win(e.id))).ok).toBe(true);
    expect(eventStatus(c.save!, evs[9]!)).toBe('final');
    const last = await c.recordRace(win(evs[9]!.id));
    expect(last.ok && last.value.chapterCompleted).toBe(true);
    expect(isChapterComplete(c.save!, CHAPTER_2_ID)).toBe(true);
    expect(c.save!.chapterCompletions[CHAPTER_2_ID]).toBeTruthy();
    expect(c.save!.reputation).toBeLessThanOrEqual(chapterOf(CHAPTER_2_ID).reputationCap);
  });

  it('dealer: requirements, one car per model, credits debited once, no duplicate on reload', async () => {
    const c = await career();
    expect((await c.buyCar('gm-astra-2011')).ok).toBe(false); // chapter 2 not open
    await finishChapter1(c);
    // rich enough for the test
    await (c as unknown as { commit: (f: (s: { credits: number }) => void) => Promise<unknown> }).commit((s) => void (s.credits = 100000));
    const before = c.save!.credits;
    expect((await c.buyCar('gm-astra-2011')).ok).toBe(true);
    expect(c.save!.credits).toBe(before - 6000);
    expect((await c.buyCar('gm-astra-2011')).ok).toBe(false);
    expect((await c.buyCar('bmw-335i-f30-2013')).ok).toBe(false); // after the final challenge only
    expect((await c.buyCar('mitsubishi-evo-x-2012')).ok).toBe(false); // reputation
    const astra = c.save!.ownedCars.find((x) => x.baseCarId === 'gm-astra-2011')!;
    expect(astra.buildVersion).toBe(2);
    expect(astra.purchasePrice).toBe(6000);
    // reload from the repository: the same garage, no duplicate
    const again = new CareerController(c.repo);
    await again.load();
    expect(again.save!.ownedCars.filter((x) => x.baseCarId === 'gm-astra-2011')).toHaveLength(1);
  });

  it('selling: confirmation is the UI, here the rules: share of the price, parts to stock, never the last car', async () => {
    const c = await career();
    expect((await c.sellCar(c.activeCar!.id)).ok).toBe(false);
    await finishChapter1(c);
    await (c as unknown as { commit: (f: (s: { credits: number }) => void) => Promise<unknown> }).commit((s) => void (s.credits = 20000));
    await c.buyCar('gm-astra-2011');
    const astra = c.save!.ownedCars.find((x) => x.baseCarId === 'gm-astra-2011')!;
    await c.setActiveCar(astra.id);
    expect((await c.buyPart('filter-sport')).ok).toBe(true);
    const credits = c.save!.credits;
    const r = await c.sellCar(astra.id);
    expect(r.ok).toBe(true);
    expect(c.save!.credits).toBe(credits + Math.round((6000 * RESALE_SHARE) / 10) * 10);
    expect(c.save!.inventoryPartIds).toContain(inventoryEntry('filter-sport', 'gm-astra-2011'));
    expect(c.save!.ownedCars.some((x) => x.id === astra.id)).toBe(false);
    expect(c.save!.activeCarId).toBe(c.save!.ownedCars[0]!.id);
  });

  it('a chapter 1 car moves to resolver 2 only when a version 2 part is installed, keeping its performance', async () => {
    const c = await career();
    await finishChapter1(c);
    const car = c.activeCar!;
    expect(buildVersionFor(car, car.installedParts)).toBe(1);
    expect(car.buildVersion).toBe(1);
    expect(buildVersionFor(car, ['flywheel-light'])).toBe(2);
  });

  it('chapter 2 parts show their stage when locked', async () => {
    const c = await career();
    await finishChapter1(c);
    const astra = { baseCarId: 'gm-astra-2011', installedParts: [] as string[] };
    const st = partStatus(c.save!, astra, findPart('ecu-stage1-na')!);
    expect(st.state).toBe('locked');
    expect(st.label).toBe('Etapa 1');
  });
});
