/** Saves with the old generic ECU maps move to the family maps of the same stage (or get the credits back). */
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { CareerController, inventoryEntry } from '../../../src/game/career/CareerController';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { hasLegacyEcus, migrateLegacyEcus } from '../../../src/game/career/legacyEcuMigration';
import { newCareerSave, type CareerSave } from '../../../src/game/career/CareerState';
import { findPart } from '../../../src/game/career/tuning/parts';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { MemoryStore } from '../../../src/storage/db';

void IDBFactory;
const owned = (id: string, base: string, parts: string[], tune = {}) => ({
  id, baseCarId: base, nickname: base.split('-')[0]!, paint: { color: '#ffffff', accent: '#000000' }, installedParts: parts, tune, buildVersion: 2 as const, acquiredAt: new Date(0).toISOString(),
});

function saveWith(cars: ReturnType<typeof owned>[], inventory: string[] = []): CareerSave {
  const s = newCareerSave();
  s.ownedCars = cars as CareerSave['ownedCars'];
  s.activeCarId = cars[0]!.id;
  s.inventoryPartIds = inventory;
  s.credits = 1000;
  return s;
}

describe('legacy ECU migration', () => {
  it('the old ids are gone from the catalogue and the maps exist for every turbo family', () => {
    for (const id of ['ecu-stage1', 'ecu-stage2', 'ecu-stage3']) expect(findPart(id)).toBeUndefined();
    expect(findPart('ecu-map-bmw-n20-s3')).toBeDefined();
  });

  it('a stock part of the old Stage 3 becomes the same stage of the car family', () => {
    const s = saveWith([owned('c1', 'mitsubishi-evo-x-2012', [])], [inventoryEntry('ecu-stage3', 'mitsubishi-evo-x-2012')]);
    expect(hasLegacyEcus(s)).toBe(true);
    migrateLegacyEcus(s);
    expect(s.inventoryPartIds).toEqual([inventoryEntry('ecu-map-mitsubishi-4b11-s3', 'mitsubishi-evo-x-2012')]);
    expect(hasLegacyEcus(s)).toBe(false);
    expect(s.credits).toBe(1000);
  });

  it('an installed Stage 1 becomes the family map when the car still runs; otherwise the price comes back', () => {
    const s = saveWith([owned('c1', 'bmw-335i-f30-2013', ['ecu-stage1']), owned('c2', 'nissan-gtr-r35-2015', ['ecu-stage2', 'dct-upgrade'])]);
    const notices = migrateLegacyEcus(s);
    const n55 = s.ownedCars[0]!;
    expect(n55.installedParts).toEqual(['ecu-map-bmw-n55-s1']);
    const gtr = s.ownedCars[1]!;
    const ecu = gtr.installedParts.find((p) => p.startsWith('ecu-map-'));
    // the Stage 2 map of the GT-R needs its own fuel system: either it runs, or the 5.500 CR came back
    if (ecu) expect(resolveBuild(findCampaignCar('nissan-gtr-r35-2015')!, gtr.installedParts, gtr.tune ?? {}, 2).ok).toBe(true);
    else expect(s.credits).toBe(1000 + 5500);
    expect(notices.length).toBe(2);
    for (const car of s.ownedCars) expect(car.installedParts.some((p) => p.startsWith('ecu-stage'))).toBe(false);
  });

  it('load() migrates and persists once; importJson validates after the migration', async () => {
    const repo = new CareerRepository(new MemoryStore(), 'slot-1');
    const c = new CareerController(repo);
    await c.newCareer('vw-gol-gts-1988');
    const s = saveWith([owned('c1', 'bmw-335i-f30-2013', ['ecu-stage1'])]);
    s.version = c.save!.version;
    // an import of an old file: the old ids must not make it fail
    const json = JSON.stringify({ format: 'drag-physics-sandbox-2d/career', exportedAt: new Date().toISOString(), save: s });
    const r = await c.importJson(json);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    expect(c.activeCar!.installedParts).toEqual(['ecu-map-bmw-n55-s1']);
    expect(c.migrationNotices.length).toBe(1);
  });
});
