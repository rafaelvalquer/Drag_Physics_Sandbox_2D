/** Career core: new career, purchases, installs, economy, idempotency, saves, story, evaluator. */
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { CAR_VW_GOL_GTS_1988 } from '../../../src/data/cars/vwGolGts1988';
import { EVENTS, RIVALS, findEvent } from '../../../src/game/career/CareerEvents';
import { CareerController, inventoryEntry } from '../../../src/game/career/CareerController';
import { canTuneBoost, eventStatus, isPartUnlocked, nextEvent, partStatus, stockStatus } from '../../../src/game/career/CareerProgression';
import { CareerConflictError, CareerRepository } from '../../../src/game/career/CareerRepository';
import { evaluateRace } from '../../../src/game/career/CareerResultEvaluator';
import { CHAPTER_REPUTATION_CAP } from '../../../src/game/career/CareerRewards';
import { START_CREDITS, STARTER_CARS, type CareerRaceResult, type RunSummary } from '../../../src/game/career/CareerState';
import { NINA, STORY_SCENES, pendingScenes } from '../../../src/game/career/CareerStory';
import { rivalBuild, rivalCar } from '../../../src/game/career/RivalBuildFactory';
import { BUILD_RESOLVER_VERSION, resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { ownedCarBuild } from '../../../src/game/career/RivalBuildFactory';
import { findPart } from '../../../src/game/career/tuning/parts';
import { MemoryStore, openDatabase, openStore } from '../../../src/storage/db';

const run = (o: Partial<RunSummary> = {}): RunSummary => ({
  name: 'x',
  rt: 0.2,
  et: 12,
  total: 12.2,
  trapKmh: 120,
  redLight: false,
  finished: true,
  dnf: false,
  ...o,
});
let n = 0;
const result = (eventId: string, outcome: CareerRaceResult['outcome'], attemptId = `attempt-${++n}-xxxx`) => ({
  attemptId,
  eventId,
  playerCarId: 'car-1',
  opponentCarId: 'rival',
  playerResult: run({ redLight: outcome === 'red-light', dnf: outcome === 'dnf', finished: outcome === 'win' || outcome === 'loss' }),
  opponentResult: run(),
  outcome,
  completedAt: new Date().toISOString(),
  buildVersion: BUILD_RESOLVER_VERSION,
  playerBuildKey: 'k',
  opponentBuildKey: 'k',
});

async function career(starter = 'vw-gol-gts-1988'): Promise<CareerController> {
  const c = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
  const r = await c.newCareer(starter);
  if (!r.ok) throw new Error(r.error);
  return c;
}

async function winUpTo(c: CareerController, order: number): Promise<void> {
  for (const e of EVENTS.filter((x) => x.order <= order)) {
    const r = await c.recordRace(result(e.id, 'win'));
    expect(r.ok).toBe(true);
  }
}

describe('chapter data', () => {
  it('7 events, 3 regions, the brief prizes and unlock order', () => {
    expect(EVENTS.map((e) => [e.title, e.rewardCr, e.distance, e.trackId])).toEqual([
      ['Primeira Noite', 300, 'eighth', 'distrito-industrial'],
      ['O Pequeno Valente', 400, 'eighth', 'distrito-industrial'],
      ['Acerto de Contas', 600, 'eighth', 'baixada'],
      ['Tração Traseira', 800, 'quarter', 'baixada'],
      ['Respeita o AP', 1000, 'quarter', 'avenida-norte'],
      ['O Aspirado', 1300, 'quarter', 'avenida-norte'],
      ['Rei da Madrugada', 2500, 'quarter', 'avenida-norte'],
    ]);
    expect(EVENTS[0]!.unlocks).toEqual(['workshop-basic', 'part-filter', 'part-exhaust']);
    expect(EVENTS[3]!.unlocks).toEqual(['part-clutch', 'part-differential', 'part-turbo', 'engine-tuners']);
    expect(EVENTS[4]!.unlocks).toEqual(['part-tires-semislick']);
    expect(EVENTS[5]!.unlocks).toEqual(['final-challenge']);
  });

  it('rivals are real cars built by the same resolver; Léo drives the existing Gol', () => {
    const leo = RIVALS.find((r) => r.id === 'leonardo')!;
    expect(leo.baseCarId).toBe(CAR_VW_GOL_GTS_1988.id);
    expect(findCampaignCar(leo.baseCarId)).toBe(CAR_VW_GOL_GTS_1988);
    const marcos = rivalBuild(RIVALS.find((r) => r.id === 'marcos')!);
    expect(marcos.car.engine.induction).toBe('turbo');
    expect(marcos.car.name).toContain('preparado');
    expect(marcos.car.name).not.toMatch(/original/i);
    const paula = rivalCar('paula');
    expect(paula.engine.induction).toBe('NA');
    for (const r of RIVALS) expect(rivalBuild(r).ok).toBe(true);
  });

  it('scripted lines are stored exactly', () => {
    expect(NINA.intro).toBe('Então esse é o seu carro? Dá para fazer muita coisa com ele. Mas antes de pensar em turbina, aprende a colocar essa potência no chão.');
    const lara = RIVALS.find((r) => r.id === 'lara')!;
    expect(lara.lines.before).toBe('É a sua primeira noite? Então vamos ver se você sabe largar.');
    expect(RIVALS.find((r) => r.id === 'marcos')!.lines.win).toBe('Seu carro não é o mais caro daqui. Mas você soube preparar e pilotar. O título é seu.');
  });
});

describe('new career and starter cars', () => {
  it('lists the starter cars from least to most expensive', () => {
    expect(STARTER_CARS.map((s) => [s.baseCarId, s.price])).toEqual([
      ['fiat-uno-mille-1995', 800],
      ['gm-chevette-sl-1988', 1400],
      ['vw-gol-gts-1988', 2200],
    ]);
  });

  it.each(STARTER_CARS.map((s) => [s.baseCarId, s.price]))('%s costs %i CR and comes in factory configuration', async (id, price) => {
    const c = await career(id as string);
    expect(c.save!.credits).toBe(START_CREDITS - (price as number));
    expect(c.activeCar!.baseCarId).toBe(id);
    expect(c.activeCar!.installedParts).toEqual([]);
    expect(nextEvent(c.save!)!.id).toBe('e1-primeira-noite');
  });

  it('refuses to overwrite an existing career unless asked', async () => {
    const c = await career();
    expect((await c.newCareer('fiat-uno-mille-1995')).ok).toBe(false);
    expect((await c.newCareer('fiat-uno-mille-1995', { overwrite: true })).ok).toBe(true);
    expect(c.activeCar!.baseCarId).toBe('fiat-uno-mille-1995');
  });
});

describe('workshop transactions', () => {
  it('unlocks turbo and its Dyno tuning after race 4, allowing a Chevette turbo build', async () => {
    const chevette = await career('gm-chevette-sl-1988');
    await winUpTo(chevette, 3);
    expect(isPartUnlocked(chevette.save!, findPart('turbo-basic')!)).toBe(false);
    expect(canTuneBoost(chevette.save!)).toBe(false);
    const win4 = await chevette.recordRace(result('e4-tracao-traseira', 'win'));
    expect(win4.ok).toBe(true);
    expect(isPartUnlocked(chevette.save!, findPart('turbo-basic')!)).toBe(true);
    expect(isPartUnlocked(chevette.save!, findPart('clutch-reinforced')!)).toBe(true);
    expect(canTuneBoost(chevette.save!)).toBe(true);
    expect(isPartUnlocked(chevette.save!, findPart('tires-semislick')!)).toBe(false);
    expect((await chevette.buyPart('clutch-reinforced')).ok).toBe(true);
    expect((await chevette.buyPart('turbo-basic')).ok).toBe(true);
    const prepared = ownedCarBuild(chevette.activeCar!);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) expect(prepared.car.engine.induction).toBe('turbo');
  });

  let c: CareerController;
  beforeEach(async () => {
    c = await career();
  });

  it('parts are locked until the event that unlocks them', async () => {
    expect(isPartUnlocked(c.save!, findPart('filter-sport')!)).toBe(false);
    expect((await c.buyPart('filter-sport')).ok).toBe(false);
    await winUpTo(c, 1);
    expect(isPartUnlocked(c.save!, findPart('filter-sport')!)).toBe(true);
    expect(isPartUnlocked(c.save!, findPart('manifold-sport')!)).toBe(false);
  });

  it('workshop pill state comes from the save: locked → price → in use → bought → in use', async () => {
    const st = (id: string) => partStatus(c.save!, c.activeCar!, findPart(id)!);
    expect(st('exhaust-sport')).toMatchObject({ state: 'locked', label: 'Noite 1' });
    expect(st('exhaust-sport').detail).toContain('Primeira Noite');
    await winUpTo(c, 1);
    expect(st('exhaust-sport')).toMatchObject({ state: 'available', label: '450 CR' });
    expect((await c.buyPart('exhaust-sport')).ok).toBe(true);
    expect(st('exhaust-sport')).toMatchObject({ state: 'installed', label: 'Em uso' });
    expect((await c.removePart('exhaust-sport')).ok).toBe(true);
    expect(st('exhaust-sport')).toMatchObject({ state: 'owned', label: 'Comprada' });
    expect((await c.installFromInventory('exhaust-sport')).ok).toBe(true);
    expect(st('exhaust-sport').state).toBe('installed');
    // bought for another car: still for sale on this one
    expect(partStatus(c.save!, { baseCarId: 'gm-chevette-sl-1988', installedParts: [] }, findPart('exhaust-sport')!).state).toBe('available');
    // not enough credits
    const poor = await c.repo.transact(c.save!.revision, (x) => ({ ...x!, credits: 100 }));
    c.save = poor;
    expect(st('filter-sport')).toMatchObject({ state: 'unaffordable', label: '250 CR' });
  });

  it('buys and installs atomically; refuses without credits and never goes negative', async () => {
    await winUpTo(c, 1);
    const before = c.save!.credits;
    const r = await c.buyPart('exhaust-sport');
    expect(r.ok).toBe(true);
    expect(c.save!.credits).toBe(before - 450);
    expect(c.activeCar!.installedParts).toEqual(['exhaust-sport']);
    // already installed
    expect((await c.buyPart('exhaust-sport')).ok).toBe(false);
    // no credits: nothing changes
    await winUpTo(c, 6);
    const poor = await c.repo.transact(c.save!.revision, (s) => ({ ...s!, credits: 100 }));
    c.save = poor;
    const fail = await c.buyPart('turbo-basic');
    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.error).toMatch(/créditos insuficientes/);
    expect(c.save!.credits).toBe(100);
    expect(c.activeCar!.installedParts).toEqual(['exhaust-sport']);
  });

  it('an incompatible build is refused before any debit (turbo without the clutch)', async () => {
    await winUpTo(c, 6);
    const credits = c.save!.credits;
    const r = await c.buyPart('turbo-basic');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/incompatível.*embreagem reforçada/);
    expect(c.save!.credits).toBe(credits);
  });

  it('swapping tyres puts the old set in the inventory; reinstalling is free and does not stack', async () => {
    await winUpTo(c, 5);
    expect((await c.buyPart('tires-sport')).ok).toBe(true);
    expect((await c.buyPart('tires-semislick')).ok).toBe(true);
    expect(c.activeCar!.installedParts).toEqual(['tires-semislick']);
    expect(c.save!.inventoryPartIds).toEqual([inventoryEntry('tires-sport', 'vw-gol-gts-1988')]);
    const credits = c.save!.credits;
    expect((await c.buyPart('tires-sport')).ok).toBe(false); // already owned
    expect((await c.installFromInventory('tires-sport')).ok).toBe(true);
    expect(c.save!.credits).toBe(credits);
    expect(c.activeCar!.installedParts).toEqual(['tires-sport']);
    expect(c.save!.inventoryPartIds).toEqual([inventoryEntry('tires-semislick', 'vw-gol-gts-1988')]);
  });

  it('removing restores; removing the clutch under a turbo is refused', async () => {
    await winUpTo(c, 6);
    c.save = await c.repo.transact(c.save!.revision, (s) => ({ ...s!, credits: 20000 }));
    expect((await c.buyPart('clutch-reinforced')).ok).toBe(true);
    expect((await c.buyPart('turbo-basic')).ok).toBe(true);
    const r = await c.removePart('clutch-reinforced');
    expect(r.ok).toBe(false);
    expect((await c.removePart('turbo-basic')).ok).toBe(true);
    expect((await c.removePart('clutch-reinforced')).ok).toBe(true);
    expect(c.activeCar!.installedParts).toEqual([]);
  });

  it('boost tuning needs the engine tuners and a turbo, and respects the knock limit', async () => {
    await winUpTo(c, 6);
    c.save = await c.repo.transact(c.save!.revision, (s) => ({ ...s!, credits: 20000 }));
    expect((await c.setBoost(0.8)).ok).toBe(false); // no turbo yet
    await c.buyPart('clutch-reinforced');
    await c.buyPart('turbo-basic');
    expect((await c.setBoost(0.8)).ok).toBe(true);
    expect(c.activeCar!.tune).toEqual({ boostBar: 0.8 });
    expect((await c.setBoost(1.5)).ok).toBe(false);
  });
});

describe('economy and idempotency', () => {
  it('first win pays in full once; repeats pay less; loss is limited; red light and DNF pay nothing', async () => {
    const c = await career();
    const start = c.save!.credits;
    const e1 = findEvent('e1-primeira-noite')!;
    const first = await c.recordRace(result(e1.id, 'win'));
    expect(first.ok && first.value.reward.kind).toBe('first-win');
    expect(c.save!.credits).toBe(start + 300);
    expect(c.save!.reputation).toBe(e1.reputation);
    const rep = await c.recordRace(result(e1.id, 'win'));
    expect(rep.ok && rep.value.reward.credits).toBe(110);
    const loss = await c.recordRace(result(e1.id, 'loss'));
    expect(loss.ok && loss.value.reward.credits).toBe(30);
    const red = await c.recordRace(result(e1.id, 'red-light'));
    expect(red.ok && red.value.reward.credits).toBe(0);
    const dnf = await c.recordRace(result(e1.id, 'dnf'));
    expect(dnf.ok && dnf.value.reward.credits).toBe(0);
    expect(c.save!.credits).toBe(start + 300 + 110 + 30);
    expect(c.save!.claimedRewardIds).toEqual(['e1-primeira-noite:first']);
  });

  it('the same attempt id is applied once (double click, reload)', async () => {
    const c = await career();
    const start = c.save!.credits;
    const r = result('e1-primeira-noite', 'win', 'attempt-dup-0001');
    const a = await c.recordRace(r);
    const b = await c.recordRace(r);
    expect(a.ok && a.value.applied).toBe(true);
    expect(b.ok && b.value.applied).toBe(false);
    const reloaded = new CareerController(c.repo);
    await reloaded.load();
    const again = await reloaded.recordRace(r);
    expect(again.ok && again.value.applied).toBe(false);
    expect(reloaded.save!.credits).toBe(start + 300);
    expect(reloaded.save!.results).toHaveLength(1);
  });

  it('reputation is capped and cannot be bought', async () => {
    const c = await career();
    await winUpTo(c, 7);
    for (let i = 0; i < 30; i++) await c.recordRace(result('e7-rei-da-madrugada', 'win'));
    expect(c.save!.reputation).toBeLessThanOrEqual(CHAPTER_REPUTATION_CAP);
  });

  it('defeat and rematch; the final unlocks only after event 6; completion is recorded', async () => {
    const c = await career();
    await c.recordRace(result('e1-primeira-noite', 'loss'));
    expect(eventStatus(c.save!, EVENTS[0]!)).toBe('available');
    await winUpTo(c, 5);
    expect(eventStatus(c.save!, EVENTS[6]!)).toBe('locked');
    const w6 = await c.recordRace(result('e6-o-aspirado', 'win'));
    expect(w6.ok && w6.value.newUnlocks).toEqual(['final-challenge']);
    expect(eventStatus(c.save!, EVENTS[6]!)).toBe('final');
    const fin = await c.recordRace(result('e7-rei-da-madrugada', 'win'));
    expect(fin.ok && fin.value.chapterCompleted).toBe(true);
    expect(c.save!.chapterCompletedAt).not.toBeNull();
    expect(nextEvent(c.save!)).toBeNull();
  });
});

describe('saves', () => {
  it('save and continue through IndexedDB (v3 migration keeps the old stores)', async () => {
    const factory = new IDBFactory();
    const v2 = await openDatabase(factory, 'drag-physics-sandbox-2d', 2);
    v2.transaction('presets', 'readwrite').objectStore('presets').put({ id: 'keep', name: 'antigo' });
    await new Promise((r) => setTimeout(r, 10));
    v2.close();
    const store = await openStore(factory);
    expect(store.persistent).toBe(true);
    expect(await store.get('presets', 'keep')).toEqual({ id: 'keep', name: 'antigo' });
    const c = new CareerController(new CareerRepository(store, 'slot-1'));
    await c.newCareer('gm-chevette-sl-1988');
    await c.recordRace(result('e1-primeira-noite', 'win'));
    const c2 = new CareerController(new CareerRepository(store, 'slot-1'));
    const s = await c2.load();
    expect(s!.completedEventIds).toEqual(['e1-primeira-noite']);
    expect(s!.ownedCars[0]!.baseCarId).toBe('gm-chevette-sl-1988');
    store.close();
  });

  it('a second tab writing the same slot makes the stale copy fail instead of overwriting', async () => {
    const store = new MemoryStore();
    const tabA = new CareerController(new CareerRepository(store, 'slot-1'));
    await tabA.newCareer('vw-gol-gts-1988');
    const tabB = new CareerController(new CareerRepository(store, 'slot-1'));
    await tabB.load();
    await tabB.recordRace(result('e1-primeira-noite', 'win'));
    await expect(tabA.repo.transact(tabA.save!.revision, (s) => s!)).rejects.toBeInstanceOf(CareerConflictError);
    const r = await tabA.recordRace(result('e1-primeira-noite', 'win'));
    expect(r.ok).toBe(false);
  });

  it('export / import round trip; invalid files never touch the current save', async () => {
    const c = await career();
    await winUpTo(c, 2);
    const json = c.exportJson();
    const other = await career('fiat-uno-mille-1995');
    const bad = await other.importJson('{"format":"x"}');
    expect(bad.ok).toBe(false);
    const tampered = JSON.parse(json);
    tampered.save.credits = -50;
    expect((await other.importJson(JSON.stringify(tampered))).ok).toBe(false);
    expect(other.activeCar!.baseCarId).toBe('fiat-uno-mille-1995');
    const good = await other.importJson(json);
    expect(good.ok).toBe(true);
    expect(other.save!.completedEventIds).toEqual(['e1-primeira-noite', 'e2-pequeno-valente']);
    expect(other.activeCar!.baseCarId).toBe('vw-gol-gts-1988');
  });
});

describe('story and debrief', () => {
  it('scenes are data with triggers and do not repeat once seen', async () => {
    const c = await career();
    expect(pendingScenes('start', c.save!.seenStorySceneIds).map((s) => s.id)).toEqual(['intro']);
    await c.markScenesSeen(['intro']);
    expect(pendingScenes('start', c.save!.seenStorySceneIds)).toEqual([]);
    expect(STORY_SCENES.some((s) => s.trigger === 'completion')).toBe(true);
    expect(pendingScenes('victory', [], 'e1-primeira-noite').map((s) => s.id)).toEqual(['first-win', 'win-e1-primeira-noite']);
  });

  it('Nina comments the measured symptoms, deterministically', () => {
    const car = CAR_VW_GOL_GTS_1988;
    const base = { playerCar: car, playerPowerCv: 99, opponentPowerCv: 140, opponent: run() };
    expect(evaluateRace({ ...base, outcome: 'red-light', player: run({ redLight: true, rt: -0.05 }) })[0]!.id).toBe('red-light');
    const spin = evaluateRace({ ...base, outcome: 'loss', player: run({ wheelspinS: 1.6, maxSlipRatio: 0.7 }) });
    expect(spin[0]!.id).toBe('wheelspin');
    const late = evaluateRace({ ...base, outcome: 'loss', player: run({ shiftRpms: [car.engine.revLimitRpm, car.engine.revLimitRpm - 20] }) });
    expect(late.map((x) => x.id)).toContain('late-shift');
    const clutch = evaluateRace({ ...base, outcome: 'loss', player: run({ clutchSlipS: 1.2 }) });
    expect(clutch[0]!.id).toBe('clutch-slip');
    const low = evaluateRace({ ...base, outcome: 'loss', player: run({ rt: 0.18, wheelspinS: 0.1 }) });
    expect(low[0]!.id).toBe('good-launch-low-power');
    const bog = evaluateRace({ ...base, outcome: 'loss', player: run({ launchRpm: 1500 }) });
    expect(bog.map((x) => x.id)).toContain('bog');
    // same input → same comments
    expect(evaluateRace({ ...base, outcome: 'loss', player: run({ wheelspinS: 1.6, maxSlipRatio: 0.7 }) })).toEqual(spin);
  });
});

describe('factory parts (back to original)', () => {
  const spec = (c: CareerController) => {
    const b = ownedCarBuild(c.activeCar!);
    if (!b.ok) throw new Error(b.errors.join('; '));
    return { car: JSON.stringify(b.car), power: b.peakPowerCv, torque: b.peakTorqueNm, key: b.key };
  };
  const factory = (baseId: string) => {
    const b = resolveBuild(findCampaignCar(baseId)!, []);
    if (!b.ok) throw new Error('factory');
    return { car: JSON.stringify(b.car), power: b.peakPowerCv, torque: b.peakTorqueNm, key: b.key };
  };
  const cat = (id: string) => findPart(id)?.category;

  it('installing a part and going back to the original gives the identical factory build; the part stays in stock', async () => {
    const store = new MemoryStore();
    const c = new CareerController(new CareerRepository(store, 'slot-1'));
    expect((await c.newCareer('vw-gol-gts-1988')).ok).toBe(true);
    await winUpTo(c, 1);
    expect(stockStatus(c.activeCar!, 'exhaust', cat)).toMatchObject({ state: 'installed', label: 'Em uso' });
    expect(spec(c)).toEqual(factory('vw-gol-gts-1988'));
    expect((await c.buyPart('exhaust-sport')).ok).toBe(true);
    expect(spec(c)).not.toEqual(factory('vw-gol-gts-1988'));
    expect(stockStatus(c.activeCar!, 'exhaust', cat)).toMatchObject({ state: 'stock', label: 'Original' });
    const credits = c.save!.credits;

    expect((await c.restoreStock('exhaust')).ok).toBe(true);
    expect(c.activeCar!.installedParts).toEqual([]);
    expect(spec(c)).toEqual(factory('vw-gol-gts-1988'));
    expect(stockStatus(c.activeCar!, 'exhaust', cat).label).toBe('Em uso');
    expect(c.save!.inventoryPartIds).toEqual(['exhaust-sport@vw-gol-gts-1988']);
    expect(partStatus(c.save!, c.activeCar!, findPart('exhaust-sport')!).label).toBe('Comprada');
    expect(c.save!.credits).toBe(credits); // free
    // already original: nothing to do
    expect((await c.restoreStock('exhaust')).ok).toBe(false);

    // the choice is in the save: a fresh controller on the same store sees it
    const again = new CareerController(new CareerRepository(store, 'slot-1'));
    await again.load();
    expect(again.activeCar!.installedParts).toEqual([]);
    expect(again.save!.inventoryPartIds).toEqual(['exhaust-sport@vw-gol-gts-1988']);
    expect(spec(again)).toEqual(factory('vw-gol-gts-1988'));

    // and the bought part can be reinstalled without paying again
    expect((await again.installFromInventory('exhaust-sport')).ok).toBe(true);
    expect(again.save!.credits).toBe(credits);
    expect(again.save!.inventoryPartIds).toEqual([]);
  });

  it('restore all puts every slot back to factory, keeps every part in stock, and respects build rules per slot', async () => {
    const c = await career();
    await winUpTo(c, 6);
    await c.repo.transact(c.save!.revision, (x) => ({ ...x!, credits: 20000 })).then((n) => (c.save = n));
    for (const id of ['filter-sport', 'exhaust-sport', 'tires-sport', 'clutch-reinforced', 'turbo-basic']) expect((await c.buyPart(id)).ok).toBe(true);
    // the turbo needs the reinforced clutch: the original clutch alone is refused, nothing changes
    const before = c.activeCar!.installedParts.slice();
    const r = await c.restoreStock('clutch');
    expect(r.ok).toBe(false);
    expect(c.activeCar!.installedParts).toEqual(before);
    // the whole car back to factory
    expect((await c.restoreStock()).ok).toBe(true);
    expect(c.activeCar!.installedParts).toEqual([]);
    expect(c.activeCar!.tune ?? {}).toEqual({});
    expect(spec(c)).toEqual(factory('vw-gol-gts-1988'));
    expect([...c.save!.inventoryPartIds].sort()).toEqual(before.map((id) => `${id}@vw-gol-gts-1988`).sort());
    expect((await c.restoreStock()).ok).toBe(false);
  });
});
