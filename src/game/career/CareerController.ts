import { findCampaignCar } from '../../data/cars/campaign';
import { CHAPTER2_CARS } from '../../data/cars/chapter2/index';
import { EVENTS, findEvent, type CareerEventDef } from './CareerEvents';
import { isChapterComplete, isChapterUnlocked, isPartUnlocked, canTuneBoost, unlocksOf, unlockedChaptersOf } from './CareerProgression';
import { CHAPTER_1_ID, CHAPTER_2_ID, findChapter, type ChapterId } from './chapters';
import { DEALER_CARS, offerAvailability, resaleValue } from './chapter2/dealer';
import { CareerRepository } from './CareerRepository';
import { computeReward, type Reward } from './CareerRewards';
import {
  MAX_GARAGE,
  MAX_RESULTS,
  STARTER_CARS,
  exportCareer,
  importCareer,
  newCareerSave,
  type CareerRaceResult,
  type CareerSave,
  type OwnedCar,
} from './CareerState';
import { resolveBuild, type ResolverVersion } from './tuning/BuildResolver';
import { findPart, type PartCategory, type UnlockId } from './tuning/parts';

const CHAPTER2_CAR_IDS = new Set(CHAPTER2_CARS.map((c) => c.id));

/**
 * Resolver version a car's build uses. Chapter 2 cars always use version 2 (their gearboxes,
 * AWD and engine families exist only there). A chapter 1 car stays at the version stored with it
 * (1 for every car of an old save) until a part of version 2 is installed; from then on it uses 2.
 * On a chapter 1 build both versions give the identical car (tested), so moving never changes
 * what the player already had.
 */
export function buildVersionFor(car: Pick<OwnedCar, 'baseCarId' | 'buildVersion'>, parts: readonly string[]): ResolverVersion {
  if (CHAPTER2_CAR_IDS.has(car.baseCarId)) return 2;
  if ((car.buildVersion ?? 1) === 2) return 2;
  return parts.some((id) => findPart(id)?.since === 2) ? 2 : 1;
}

/** Unique id for a new garage car (ids of sold cars are never reused within the garage). */
function newCarId(s: CareerSave, baseCarId: string): string {
  for (let i = s.ownedCars.length + 1; ; i++) {
    const id = `car-${i}-${baseCarId}`.slice(0, 64);
    if (!s.ownedCars.some((c) => c.id === id)) return id;
  }
}

const shortName = (name: string): string => name.replace(/^(Volkswagen|Chevrolet|Fiat|Mercedes-Benz|Mitsubishi|Peugeot|Honda|BMW|Audi) /, '').slice(0, 32);

/**
 * Career operations. Every operation validates first (credits, unlocks, the resolved build) and
 * then changes the save in ONE atomic transaction: a purchase never debits without delivering the
 * part, and a race result is applied once per attempt id.
 */
export type OpResult<T = CareerSave> = { ok: true; value: T } | { ok: false; error: string };

export interface RaceRecord {
  save: CareerSave;
  reward: Reward;
  result: CareerRaceResult;
  /** True when this call applied the result (false: the attempt had already been recorded). */
  applied: boolean;
  newUnlocks: UnlockId[];
  chapterCompleted: boolean;
}

/** Inventory entries are bound to the car model they were bought for: `<part>@<baseCarId>`. */
export function inventoryEntry(partId: string, baseCarId: string): string {
  return `${partId}@${baseCarId}`;
}
export function parseInventoryEntry(e: string): { partId: string; baseCarId: string } {
  const i = e.indexOf('@');
  return { partId: e.slice(0, i), baseCarId: e.slice(i + 1) };
}

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export class CareerController {
  save: CareerSave | null = null;

  constructor(readonly repo: CareerRepository) {}

  async load(): Promise<CareerSave | null> {
    this.save = await this.repo.load();
    return this.save;
  }

  get activeCar(): OwnedCar | null {
    const s = this.save;
    return s?.ownedCars.find((c) => c.id === s.activeCarId) ?? null;
  }

  private async commit(fn: (s: CareerSave) => void): Promise<CareerSave> {
    const s = this.save;
    if (!s) throw new Error('nenhuma campanha carregada');
    this.save = await this.repo.transact(s.revision, (cur) => {
      const next = cur!;
      fn(next);
      return next;
    });
    return this.save;
  }

  /** New career: replaces any save of the slot only when `overwrite` is set. */
  async newCareer(starterCarId: string, opts: { overwrite?: boolean; nickname?: string; now?: Date } = {}): Promise<OpResult> {
    const starter = STARTER_CARS.find((c) => c.baseCarId === starterCarId);
    const base = findCampaignCar(starterCarId);
    if (!starter || !base) return fail('carro inicial inválido');
    const existing = await this.repo.load().catch(() => null);
    if (existing && !opts.overwrite) return fail('já existe uma campanha neste espaço');
    const s = newCareerSave(this.repo.slotId, opts.now);
    s.credits -= starter.price;
    const car: OwnedCar = {
      id: `car-1-${starterCarId}`.slice(0, 64),
      baseCarId: starterCarId,
      nickname: opts.nickname?.trim() || shortName(base.name),
      paint: { color: base.visual.color, accent: base.visual.accent },
      installedParts: [],
      buildVersion: 1,
      purchasePrice: starter.price,
      acquiredAt: s.createdAt,
    };
    s.ownedCars.push(car);
    s.activeCarId = car.id;
    this.save = existing ? await this.repo.replace(s) : await this.repo.transact(null, () => s);
    return { ok: true, value: this.save };
  }

  /** Validates a hypothetical part list on a car (shop preview and every install). */
  checkBuild(car: OwnedCar, parts: string[], tune = car.tune ?? {}): OpResult<true> {
    const base = findCampaignCar(car.baseCarId);
    if (!base) return fail('carro base desconhecido');
    const r = resolveBuild(base, parts, tune, buildVersionFor(car, parts));
    return r.ok ? { ok: true, value: true } : fail(r.errors.join('; '));
  }

  /** Parts list after installing `partId` (replacing the part of the same category). */
  static withPart(installed: readonly string[], partId: string): { parts: string[]; replaced: string | null } {
    const p = findPart(partId)!;
    const replaced = installed.find((id) => findPart(id)?.category === p.category) ?? null;
    return { parts: [...installed.filter((id) => id !== replaced), partId], replaced };
  }

  async buyPart(partId: string): Promise<OpResult> {
    const s = this.save;
    const car = this.activeCar;
    const p = findPart(partId);
    if (!s || !car) return fail('nenhum carro ativo');
    if (!p) return fail(`peça desconhecida: ${partId}`);
    if (!isPartUnlocked(s, p)) return fail(`${p.name} ainda não está liberada`);
    if (car.installedParts.includes(partId)) return fail(`${p.name} já está instalada neste carro`);
    if (s.inventoryPartIds.includes(inventoryEntry(partId, car.baseCarId))) return fail(`${p.name} já está no seu estoque: instale de lá`);
    if (s.credits < p.price) return fail(`créditos insuficientes: ${p.name} custa ${p.price} CR, você tem ${s.credits} CR`);
    const { parts, replaced } = CareerController.withPart(car.installedParts, partId);
    const chk = this.checkBuild(car, parts, tuneFor(car, parts));
    if (!chk.ok) return fail(`incompatível: ${chk.error}`);
    try {
      const v = await this.commit((n) => {
        if (n.credits < p.price) throw new Error('créditos insuficientes');
        const c = n.ownedCars.find((x) => x.id === car.id)!;
        n.credits -= p.price;
        c.installedParts = parts;
        c.tune = tuneFor(c, parts);
          c.buildVersion = buildVersionFor(c, parts);
        if (replaced) n.inventoryPartIds.push(inventoryEntry(replaced, c.baseCarId));
      });
      return { ok: true, value: v };
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  async installFromInventory(partId: string): Promise<OpResult> {
    const s = this.save;
    const car = this.activeCar;
    if (!s || !car) return fail('nenhum carro ativo');
    const entry = inventoryEntry(partId, car.baseCarId);
    if (!s.inventoryPartIds.includes(entry)) return fail('a peça não está no estoque deste carro');
    if (car.installedParts.includes(partId)) return fail('a peça já está instalada');
    const { parts, replaced } = CareerController.withPart(car.installedParts, partId);
    const chk = this.checkBuild(car, parts, tuneFor(car, parts));
    if (!chk.ok) return fail(`incompatível: ${chk.error}`);
    try {
      return {
        ok: true,
        value: await this.commit((n) => {
          const c = n.ownedCars.find((x) => x.id === car.id)!;
          n.inventoryPartIds.splice(n.inventoryPartIds.indexOf(entry), 1);
          if (replaced) n.inventoryPartIds.push(inventoryEntry(replaced, c.baseCarId));
          c.installedParts = parts;
          c.tune = tuneFor(c, parts);
          c.buildVersion = buildVersionFor(c, parts);
        }),
      };
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  async removePart(partId: string): Promise<OpResult> {
    const car = this.activeCar;
    if (!this.save || !car) return fail('nenhum carro ativo');
    if (!car.installedParts.includes(partId)) return fail('a peça não está instalada');
    const parts = car.installedParts.filter((id) => id !== partId);
    const chk = this.checkBuild(car, parts, tuneFor(car, parts));
    if (!chk.ok) return fail(`não dá para remover: ${chk.error}`);
    try {
      return {
        ok: true,
        value: await this.commit((n) => {
          const c = n.ownedCars.find((x) => x.id === car.id)!;
          c.installedParts = parts;
          c.tune = tuneFor(c, parts);
          c.buildVersion = buildVersionFor(c, parts);
          n.inventoryPartIds.push(inventoryEntry(partId, c.baseCarId));
        }),
      };
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  /**
   * Puts the factory part back in one slot (category), or in every slot when `category` is omitted.
   * The factory part is free and always available: it is simply the absence of a modification, so
   * the resolver returns the factory physics for that slot. The removed parts go to the stock of
   * this car (nothing is sold or lost) and can be reinstalled later.
   */
  async restoreStock(category?: PartCategory): Promise<OpResult> {
    const car = this.activeCar;
    if (!this.save || !car) return fail('nenhum carro ativo');
    const removed = car.installedParts.filter((id) => category === undefined || findPart(id)?.category === category);
    if (!removed.length) return fail(category ? 'a peça original já está em uso' : 'o carro já está original');
    const parts = car.installedParts.filter((id) => !removed.includes(id));
    const chk = this.checkBuild(car, parts, tuneFor(car, parts));
    if (!chk.ok) return fail(`não dá para voltar ao original: ${chk.error}`);
    try {
      return {
        ok: true,
        value: await this.commit((n) => {
          const c = n.ownedCars.find((x) => x.id === car.id)!;
          c.installedParts = parts;
          c.tune = tuneFor(c, parts);
          c.buildVersion = buildVersionFor(c, parts);
          for (const id of removed) n.inventoryPartIds.push(inventoryEntry(id, c.baseCarId));
        }),
      };
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  /** Engine tuners: wastegate setting on the dyno (undefined = kit default). */
  async setBoost(boostBar: number | undefined): Promise<OpResult> {
    const s = this.save;
    const car = this.activeCar;
    if (!s || !car) return fail('nenhum carro ativo');
    const programmable = car.installedParts.includes('ecu-programmable');
    if (!programmable && !canTuneBoost(s)) return fail('os preparadores de motor ainda não trabalham para você');
    if (!programmable && !car.installedParts.some((id) => findPart(id)?.category === 'turbo'))
      return fail('sem turbo (ou sem ECU programável) não há pressão para ajustar');
    const tune = boostBar === undefined ? {} : { boostBar: Math.round(boostBar * 100) / 100 };
    const chk = this.checkBuild(car, car.installedParts, tune);
    if (!chk.ok) return fail(chk.error);
    try {
      return {
        ok: true,
        value: await this.commit((n) => {
          n.ownedCars.find((x) => x.id === car.id)!.tune = tune;
        }),
      };
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  /**
   * Buys a car: the chapter 1 classifieds (starter models) or the chapter 2 dealer (one per model,
   * with its reputation / progress requirements). Credits are debited in the same transaction
   * that delivers the car; a failed write changes nothing.
   */
  async buyCar(baseCarId: string): Promise<OpResult> {
    const s = this.save;
    const starter = STARTER_CARS.find((c) => c.baseCarId === baseCarId);
    const dealer = DEALER_CARS.find((c) => c.baseCarId === baseCarId);
    const base = findCampaignCar(baseCarId);
    if (!s || !base || (!starter && !dealer)) return fail('carro indisponível');
    if (dealer) {
      const a = offerAvailability(s, dealer);
      if (!a.ok) return fail(a.reason);
      if (s.ownedCars.some((c) => c.baseCarId === baseCarId)) return fail('você já tem este modelo na garagem');
    }
    const price = (dealer ?? starter)!.price;
    if (s.credits < price) return fail(`créditos insuficientes: ${price.toLocaleString('pt-BR')} CR`);
    if (s.ownedCars.length >= MAX_GARAGE) return fail('garagem cheia');
    try {
      return {
        ok: true,
        value: await this.commit((n) => {
          if (n.credits < price) throw new Error('créditos insuficientes');
          if (dealer && n.ownedCars.some((c) => c.baseCarId === baseCarId)) throw new Error('você já tem este modelo na garagem');
          n.credits -= price;
          n.ownedCars.push({
            id: newCarId(n, baseCarId),
            baseCarId,
            nickname: shortName(base.name),
            paint: { color: base.visual.color, accent: base.visual.accent },
            installedParts: [],
            buildVersion: CHAPTER2_CAR_IDS.has(baseCarId) ? 2 : 1,
            purchasePrice: price,
            acquiredAt: new Date().toISOString(),
          });
        }),
      };
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  /**
   * Sells a car for a share of the price paid. Its installed parts go to the stock of that model
   * (nothing is lost); the last car of the garage cannot be sold. The active car moves to another.
   */
  async sellCar(carId: string): Promise<OpResult<{ save: CareerSave; credits: number }>> {
    const s = this.save;
    const car = s?.ownedCars.find((c) => c.id === carId);
    if (!s || !car) return fail('carro não encontrado');
    if (s.ownedCars.length <= 1) return fail('você não pode vender o único carro da garagem');
    const value = resaleValue(car);
    try {
      const v = await this.commit((n) => {
        const i = n.ownedCars.findIndex((c) => c.id === carId);
        if (i < 0) throw new Error('carro não encontrado');
        const c = n.ownedCars[i]!;
        for (const id of c.installedParts) n.inventoryPartIds.push(inventoryEntry(id, c.baseCarId));
        n.ownedCars.splice(i, 1);
        n.credits += value;
        if (n.activeCarId === carId) n.activeCarId = n.ownedCars[0]!.id;
      });
      return { ok: true, value: { save: v, credits: value } };
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  /** Opens a chapter (it must be unlocked). The first time also records the milestone. */
  async setActiveChapter(chapter: ChapterId): Promise<OpResult> {
    const s = this.save;
    if (!s) return fail('nenhuma campanha carregada');
    if (!findChapter(chapter)) return fail('capítulo desconhecido');
    if (!isChapterUnlocked(s, chapter)) return fail('capítulo ainda bloqueado');
    try {
      return {
        ok: true,
        value: await this.commit((n) => {
          n.chapterId = chapter;
          if (!n.unlockedChapters.includes(chapter)) n.unlockedChapters.push(chapter);
          const m = `${chapter}-started`;
          if (!n.storyMilestones.includes(m)) n.storyMilestones.push(m);
        }),
      };
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  async setActiveCar(id: string): Promise<OpResult> {
    if (!this.save?.ownedCars.some((c) => c.id === id)) return fail('carro não encontrado');
    return { ok: true, value: await this.commit((n) => void (n.activeCarId = id)) };
  }

  async setPaint(color: string): Promise<OpResult> {
    const car = this.activeCar;
    if (!car || !/^#[0-9a-fA-F]{6}$/.test(color)) return fail('cor inválida');
    return { ok: true, value: await this.commit((n) => void (n.ownedCars.find((x) => x.id === car.id)!.paint.color = color)) };
  }

  async markScenesSeen(ids: string[]): Promise<void> {
    const s = this.save;
    if (!s) return;
    const fresh = ids.filter((id) => !s.seenStorySceneIds.includes(id));
    if (!fresh.length) return;
    await this.commit((n) => {
      for (const id of fresh) if (!n.seenStorySceneIds.includes(id)) n.seenStorySceneIds.push(id);
    });
  }

  /**
   * Applies a race result once. A second call with the same attempt id (double click, reload,
   * retry after an error) returns the stored result without paying again.
   */
  async recordRace(r: Omit<CareerRaceResult, 'creditsAwarded' | 'reputationAwarded'>): Promise<OpResult<RaceRecord>> {
    const s = this.save;
    if (!s) return fail('nenhuma campanha carregada');
    const ev: CareerEventDef | undefined = findEvent(r.eventId);
    if (!ev) return fail('evento desconhecido');
    if (!isChapterUnlocked(s, ev.chapter)) return fail('este capítulo ainda está bloqueado');
    const prior = s.results.find((x) => x.attemptId === r.attemptId);
    if (prior) {
      return {
        ok: true,
        value: { save: s, result: prior, applied: false, reward: { credits: prior.creditsAwarded, reputation: prior.reputationAwarded, claimId: null, kind: 'none' }, newUnlocks: [], chapterCompleted: false },
      };
    }
    const before = unlocksOf(s);
    const wasComplete = isChapterComplete(s, ev.chapter);
    let reward: Reward = { credits: 0, reputation: 0, claimId: null, kind: 'none' };
    let stored: CareerRaceResult | null = null;
    let applied = true;
    try {
      await this.commit((n) => {
        if (n.results.some((x) => x.attemptId === r.attemptId)) {
          applied = false;
          return;
        }
        reward = computeReward(n, ev, r.outcome);
        n.credits = Math.max(0, n.credits + reward.credits);
        n.reputation = Math.max(0, n.reputation + reward.reputation);
        if (reward.claimId && !n.claimedRewardIds.includes(reward.claimId)) n.claimedRewardIds.push(reward.claimId);
        if (r.outcome === 'win' && !n.completedEventIds.includes(ev.id)) n.completedEventIds.push(ev.id);
        stored = { ...r, creditsAwarded: reward.credits, reputationAwarded: reward.reputation };
        n.results.push(stored);
        if (n.results.length > MAX_RESULTS) n.results.splice(0, n.results.length - MAX_RESULTS);
        if (isChapterComplete(n, ev.chapter) && !n.chapterCompletions[ev.chapter]) {
          n.chapterCompletions[ev.chapter] = r.completedAt;
          const m = `${ev.chapter}-complete`;
          if (!n.storyMilestones.includes(m)) n.storyMilestones.push(m);
        }
        if (!n.chapterCompletedAt && isChapterComplete(n, CHAPTER_1_ID)) n.chapterCompletedAt = r.completedAt;
        for (const c of unlockedChaptersOf(n)) if (!n.unlockedChapters.includes(c)) n.unlockedChapters.push(c);
      });
    } catch (e) {
      return fail((e as Error).message);
    }
    const after = unlocksOf(this.save!);
    const newUnlocks = [...after].filter((u) => !before.has(u));
    return {
      ok: true,
      value: {
        save: this.save!,
        reward,
        result: stored ?? this.save!.results.find((x) => x.attemptId === r.attemptId)!,
        applied,
        newUnlocks,
        chapterCompleted: !wasComplete && isChapterComplete(this.save!, ev.chapter),
      },
    };
  }

  exportJson(): string {
    if (!this.save) throw new Error('nenhuma campanha carregada');
    return exportCareer(this.save);
  }

  /** Validates the whole file before touching the current save. */
  async importJson(text: string): Promise<OpResult> {
    const r = importCareer(text);
    if (!r.ok) return fail(`importação recusada: ${r.errors.slice(0, 3).join('; ')}`);
    for (const c of r.save.ownedCars) {
      if (!findCampaignCar(c.baseCarId)) return fail(`importação recusada: carro desconhecido ${c.baseCarId}`);
      const chk = this.checkBuild(c, c.installedParts);
      if (!chk.ok) return fail(`importação recusada: build inválido em ${c.nickname}: ${chk.error}`);
    }
    for (const id of r.save.completedEventIds) if (!findEvent(id)) return fail(`importação recusada: evento desconhecido ${id}`);
    this.save = await this.repo.replace(r.save);
    return { ok: true, value: this.save };
  }
}

/** The boost setting survives only while something can hold it: the kit turbo or a programmable ECU. */
function tuneFor(car: OwnedCar, parts: string[]): OwnedCar['tune'] {
  return parts.includes('ecu-programmable') || parts.some((id) => findPart(id)?.category === 'turbo') ? (car.tune ?? {}) : {};
}

export { EVENTS, CHAPTER_2_ID };
export type { PartCategory };
