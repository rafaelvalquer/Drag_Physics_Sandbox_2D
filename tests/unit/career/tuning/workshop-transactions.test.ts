/** Atomic project purchases, reversible school switch, unlocks computed from the history. */
import { describe, expect, it } from 'vitest';
import { CareerController, inventoryEntry } from '../../../../src/game/career/CareerController';
import { CHAPTER3_EVENTS, CHAPTER2_EVENTS, EVENTS } from '../../../../src/game/career/CareerEvents';
import { isPartUnlocked, unlocksOf } from '../../../../src/game/career/CareerProgression';
import { CareerRepository } from '../../../../src/game/career/CareerRepository';
import type { OwnedCar } from '../../../../src/game/career/CareerState';
import { findPart } from '../../../../src/game/career/tuning/parts';
import { MemoryStore } from '../../../../src/storage/db';
import { Z370 } from './_helpers';

type Internal = { commit(fn: (s: NonNullable<CareerController['save']>) => void): Promise<unknown> };

async function garage(credits = 500000, done: string[] = [...EVENTS, ...CHAPTER2_EVENTS, ...CHAPTER3_EVENTS].map((e) => e.id)): Promise<CareerController> {
  const c = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
  const r = await c.newCareer('vw-gol-gts-1988');
  if (!r.ok) throw new Error(r.error);
  await (c as unknown as Internal).commit((s) => {
    s.credits = credits;
    s.completedEventIds = done;
    const car: OwnedCar = {
      id: 'car-z', baseCarId: Z370, nickname: '370Z', paint: { color: '#d97a1a', accent: '#16181b' }, installedParts: [], buildVersion: 2, purchasePrice: 0, acquiredAt: s.createdAt,
    };
    s.ownedCars.push(car);
    s.activeCarId = car.id;
  });
  return c;
}

describe('atomic project purchase', () => {
  it('buys a whole project in one transaction and debits the sum once', async () => {
    const c = await garage();
    const before = c.save!.credits;
    const preset = c.presetsOf().find((p) => p.id === 'na-high-rpm')!;
    const plan = c.planBundle(c.activeCar!, preset.parts);
    expect('error' in plan).toBe(false);
    const r = await c.buyBundle(preset.parts);
    expect(r.ok).toBe(true);
    expect(c.activeCar!.installedParts.sort()).toEqual([...preset.parts].sort());
    expect(c.save!.credits).toBe(before - preset.parts.reduce((s, id) => s + findPart(id)!.price, 0));
  });
  it('changes nothing when the credits are short', async () => {
    const c = await garage(1000);
    const snap = JSON.stringify(c.save);
    const r = await c.buyBundle(c.presetsOf().find((p) => p.id === 'na-competition')!.parts);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(c.save)).toBe(snap);
  });
  it('changes nothing when the combination is invalid (a part that needs another one)', async () => {
    const c = await garage();
    const snap = JSON.stringify(c.save);
    const r = await c.buyBundle(['ecu-vq37-s2']);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/exige a admissão/);
    expect(JSON.stringify(c.save)).toBe(snap);
    // together with what it needs, the same part is accepted
    expect((await c.buyBundle(['ecu-vq37-s2', 'filter-v6-flow', 'exhaust-v6-sport'])).ok).toBe(true);
  });
  it('refuses parts the career has not unlocked yet', async () => {
    const c = await garage(500000, []);
    const r = await c.buyBundle(['turbo-vq37-street']);
    expect(r.ok).toBe(false);
  });
});

describe('reversible school switch', () => {
  it('moves the parts the new school does not take to the stock and gets them back for free', async () => {
    const c = await garage();
    expect((await c.applyPreset('na-high-rpm')).ok).toBe(true);
    const manifold = 'manifold-v6-sport';
    expect(c.activeCar!.installedParts).toContain(manifold);
    const credits = c.save!.credits;
    const sw = await c.applyPreset('turbo-street');
    expect(sw.ok, !sw.ok ? sw.error : '').toBe(true);
    const car = c.activeCar!;
    expect(car.installedParts).toContain('turbo-vq37-street');
    expect(car.installedParts).not.toContain(manifold); // NA-only manifold left the turbo car
    expect(c.save!.inventoryPartIds).toContain(inventoryEntry(manifold, Z370));
    expect(c.save!.credits).toBeLessThan(credits); // the turbo parts were paid
    const back = c.save!.credits;
    expect((await c.applyPreset('na-high-rpm')).ok).toBe(true);
    expect(c.activeCar!.installedParts).toContain(manifold);
    expect(c.activeCar!.installedParts).not.toContain('turbo-vq37-street');
    // nothing the player owned is paid twice: only parts never bought cost something
    const spent = back - c.save!.credits;
    expect(spent).toBeLessThan(preset('na-high-rpm', c).reduce((s, id) => s + findPart(id)!.price, 0));
  });
  it('the sheet of the car is untouched by any of it', async () => {
    const c = await garage();
    await c.applyPreset('turbo-street');
    expect(c.activeCar!.baseCarId).toBe(Z370);
  });
});

function preset(id: string, c: CareerController): string[] {
  return c.presetsOf().find((p) => p.id === id)!.parts;
}

describe('unlocks follow the chapter history', () => {
  const ids = (n: number) => [...EVENTS, ...CHAPTER2_EVENTS].map((e) => e.id).concat(CHAPTER3_EVENTS.filter((e) => e.order <= n).map((e) => e.id));
  it('opens the project parts along the chapter events', () => {
    const u = (n: number) => unlocksOf({ completedEventIds: ids(n) });
    expect(u(1).has('c3-v6-parts')).toBe(true);
    expect(u(1).has('c3-na-head')).toBe(false);
    expect(u(2).has('c3-na-head')).toBe(true);
    expect(u(3).has('c3-na-high-rpm')).toBe(false);
    expect(u(4).has('c3-na-high-rpm')).toBe(true);
    expect(u(5).has('c3-turbo-street') && u(5).has('c3-stage3')).toBe(true);
    expect(u(6).has('c3-high-flow')).toBe(false);
    expect(u(7).has('c3-high-flow')).toBe(true);
    expect(u(8).has('c3-competition')).toBe(false);
    expect(u(9).has('c3-competition')).toBe(true);
  });
  it('an old save that already passed those events gets them without migration', () => {
    const done = { completedEventIds: ids(9) };
    for (const id of ['turbo-vq37-street', 'turbo-vq37-twin-comp', 'ecu-vq37-comp', 'oil-system-race', 'boost-by-gear']) expect(isPartUnlocked(done, findPart(id)!, 'nissan-vq37vhr'), id).toBe(true);
    expect(isPartUnlocked({ completedEventIds: ids(3) }, findPart('turbo-vq37-street')!, 'nissan-vq37vhr')).toBe(false);
  });
});
