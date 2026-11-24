/** Classic generic parts (alternative differential, filter, exhaust, cooling, clutch) stay on the classic engines; modern saves get their own Stage 1. */
import { describe, expect, it } from 'vitest';
import { inventoryEntry } from '../../../src/game/career/CareerController';
import { hasClassicOnlyParts, migrateClassicOnlyParts } from '../../../src/game/career/classicPartMigration';
import { newCareerSave, type CareerSave } from '../../../src/game/career/CareerState';
import { ALL_RIVALS } from '../../../src/game/career/CareerEvents';
import { CLASSIC_ONLY_PARTS, CLASSIC_ONLY_REPLACEMENT, incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { findPart } from '../../../src/game/career/tuning/parts';
import { findCampaignCar } from '../../../src/data/cars/campaign';

const owned = (id: string, base: string, parts: string[], buildVersion: 1 | 2 = 2) => ({
  id, baseCarId: base, nickname: base.split('-')[0]!, paint: { color: '#ffffff', accent: '#000000' }, installedParts: parts, tune: {}, buildVersion, acquiredAt: new Date(0).toISOString(),
});

function saveWith(cars: ReturnType<typeof owned>[], inventory: string[] = []): CareerSave {
  const s = newCareerSave();
  s.ownedCars = cars as CareerSave['ownedCars'];
  s.activeCarId = cars[0]!.id;
  s.inventoryPartIds = inventory;
  s.credits = 1000;
  return s;
}

describe('peças genéricas clássicas só nos motores clássicos', () => {
  const diff = findPart('differential-short')!;

  it('cabe nos carros clássicos e não nos modernos', () => {
    expect(incompatibility(findCampaignCar('vw-gol-gts-1988')!, diff)).toBeNull();
    expect(incompatibility(findCampaignCar('bmw-320i-f30-2014')!, diff)).toMatch(/motores clássicos/);
    expect(incompatibility(findCampaignCar('nissan-350z-2006')!, diff)).toMatch(/motores clássicos/);
  });

  it.each([...CLASSIC_ONLY_PARTS])('%s sai dos modernos e o Stage 1 da família cabe no lugar', (id) => {
    const bmw = findCampaignCar('bmw-320i-f30-2014')!;
    const astra = findCampaignCar('gm-astra-2011')!; // manual: the clutch fits it
    const car = id === 'clutch-reinforced' ? astra : bmw;
    expect(incompatibility(car, findPart(id)!)).toMatch(/motores clássicos/);
    expect(incompatibility(findCampaignCar('vw-gol-gts-1988')!, findPart(id)!)).toBeNull();
    const stage1 = findPart(CLASSIC_ONLY_REPLACEMENT[id]!(car.engine.family!))!;
    expect(incompatibility(car, stage1)).toBeNull();
  });

  it('nenhum rival usa a peça em carro moderno, e todo build de rival resolve', () => {
    for (const r of ALL_RIVALS) {
      const base = findCampaignCar(r.baseCarId)!;
      if (base.engine.family) for (const id of CLASSIC_ONLY_PARTS) expect(r.parts, r.id).not.toContain(id);
      expect(resolveBuild(base, r.parts, r.tune ?? {}, r.buildVersion ?? 1).ok, r.id).toBe(true);
    }
  });

  it('instalado em carro moderno vira o Stage 1 da família e devolve a diferença', () => {
    const s = saveWith([owned('c1', 'bmw-320i-f30-2014', ['differential-short', 'tires-sport']), owned('c2', 'vw-gol-gts-1988', ['differential-short'], 1)]);
    expect(hasClassicOnlyParts(s)).toBe(true);
    const notices = migrateClassicOnlyParts(s);
    const bmw = s.ownedCars[0]!;
    expect(bmw.installedParts).toEqual(['tires-sport', 'final-drive-bmw-n20-s1']);
    expect(resolveBuild(findCampaignCar('bmw-320i-f30-2014')!, bmw.installedParts, bmw.tune ?? {}, 2).ok).toBe(true);
    expect(s.credits).toBe(1000 + diff.price - findPart('final-drive-bmw-n20-s1')!.price);
    // the classic Gol keeps its part
    expect(s.ownedCars[1]!.installedParts).toEqual(['differential-short']);
    expect(notices).toHaveLength(1);
    expect(hasClassicOnlyParts(s)).toBe(false);
  });

  it('no estoque de carro moderno vira o Stage 1; no de carro clássico fica', () => {
    const s = saveWith([owned('c1', 'vw-gol-gts-1988', [], 1)], [inventoryEntry('differential-short', 'bmw-320i-f30-2014'), inventoryEntry('differential-short', 'vw-gol-gts-1988')]);
    migrateClassicOnlyParts(s);
    expect(s.inventoryPartIds).toEqual([inventoryEntry('final-drive-bmw-n20-s1', 'bmw-320i-f30-2014'), inventoryEntry('differential-short', 'vw-gol-gts-1988')]);
    expect(s.credits).toBe(1000 + diff.price - findPart('final-drive-bmw-n20-s1')!.price);
  });
});
