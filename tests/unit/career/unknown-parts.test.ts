/** A save that names parts missing from the catalogue still opens: the unknown parts are dropped. */
import { describe, expect, it } from 'vitest';
import { CareerController } from '../../../src/game/career/CareerController';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { ownedCarConfig } from '../../../src/game/career/RivalBuildFactory';
import { MemoryStore } from '../../../src/storage/db';

describe('unknown parts in a save', () => {
  it('drops them from the car and the stock and keeps the garage openable', async () => {
    const c = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
    const r = await c.newCareer('vw-gol-gts-1988');
    if (!r.ok) throw new Error(r.error);
    await (c as unknown as { commit(f: (s: NonNullable<typeof c.save>) => void): Promise<unknown> }).commit((s) => {
      s.ownedCars[0]!.installedParts = ['turbo-vq37-street', 'filter-sport'];
      s.inventoryPartIds.push('forged-v6-turbo@nissan-370z-2014');
    });
    const again = new CareerController(c.repo);
    await again.load();
    expect(again.activeCar!.installedParts).toEqual(['filter-sport']);
    expect(again.save!.inventoryPartIds).toEqual([]);
    expect(() => ownedCarConfig(again.activeCar!)).not.toThrow();
  });
});
