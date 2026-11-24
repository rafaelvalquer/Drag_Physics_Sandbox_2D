import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { CareerController } from '../../../src/game/career/CareerController';
import { CHAPTER2_EVENTS, EVENTS } from '../../../src/game/career/CareerEvents';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { MODERN_CONVERSION_PARTS } from '../../../src/game/career/tuning/modernConversionParts';
import { tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';
import type { TurboPart } from '../../../src/game/career/tuning/parts';
import { MemoryStore } from '../../../src/storage/db';

const cars = ['gm-astra-2011', 'honda-civic-si-2008', 'nissan-350z-2006', 'nissan-370z-2014'] as const;
const kitFor = (id: string) => {
  const car = findCampaignCar(id)!;
  const kits = MODERN_CONVERSION_PARTS.filter((p): p is TurboPart => 'conversion' in p && !incompatibility(car, p));
  return { car, kits, family: car.engine.family! };
};
const support = (family: string, tier: number): string[] => [
  `conversion-compression-${family}`, `conversion-oil-${family}`, `fuel-${family}-s${tier}`,
  `ignition-${family}-s${tier}`, `rotating-assembly-${family}-s${tier}`, `clutch-${family}-s${tier}`,
];

describe('conversões turbo modernas', () => {
  it.each(cars)('%s instala cada estágio com as próprias peças de apoio', (id) => {
    const { car, kits, family } = kitFor(id);
    expect(kits).toHaveLength(3);
    let lastCv = car.engine.ratedPowerCv;
    let lastIds: string[] = [];
    for (const [index, kit] of kits.entries()) {
      const ids = [...support(family, index + 1), kit.id];
      const build = resolveBuild(car, ids, {}, 2);
      if (!build.ok) throw new Error(`${kit.id}: ${build.errors.join('\n')}`);
      expect(build.car.engine.induction).toBe('turbo');
      expect(build.car.engine.turbo?.maxBoostBar).toBe(kit.turbo.maxBoostBar);
      expect(build.car.engine.fueling!.airFuelRatio).toBe(id === 'gm-astra-2011' ? 7.5 : 11.8);
      expect(build.car.engine.variableCam).toEqual(car.engine.variableCam);
      expect(build.car.engine.compressionRatio).toBeLessThan(car.engine.compressionRatio);
      expect(build.peakPowerCv).toBeGreaterThan(lastCv);
      expect(build.car.visual.mods?.intercooler).toBe(true);
      if (index) expect(CareerController.withPart(lastIds, kit.id).replaced).toBe(kits[index - 1]!.id);
      lastCv = build.peakPowerCv;
      lastIds = ids;
    }
    const capability = tuningCapabilities(car, lastIds, 2).boost;
    expect(capability).toMatchObject({ enabled: true, max: kits[2]!.boostRangeBar[1] });
    const adjusted = resolveBuild(car, lastIds, { boostBar: capability.min }, 2);
    expect(adjusted.ok && adjusted.car.engine.turbo?.maxBoostBar).toBe(capability.min);
    expect(resolveBuild(car, lastIds, { boostBar: capability.max + 0.01 }, 2).ok).toBe(false);
  }, 60_000);

  it('avisa sobre dependências ausentes e recusa o kit de outra família', () => {
    const { car, kits, family } = kitFor('honda-civic-si-2008');
    const kit = kits[2]!;
    const absent = resolveBuild(car, [kit.id], {}, 2);
    expect(absent.ok ? [] : absent.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('taxa de compressão'),
      expect.stringContaining('bomba e injetores'),
      expect.stringContaining('ignição Stage 3'),
      expect.stringContaining('pistões e bielas'),
      expect.stringContaining('óleo'),
    ]));
    expect(resolveBuild(car, [kit.id, ...support(family, 2)], {}, 2).ok).toBe(false);
    expect(resolveBuild(car, [kitFor('nissan-350z-2006').kits[0]!.id], {}, 2).ok).toBe(false);
    expect(resolveBuild(car, ['turbo-basic'], {}, 2).ok).toBe(false);
    const astra = kitFor('gm-astra-2011');
    const full = support(astra.family, 3);
    const originalClutch = resolveBuild(astra.car, [...full.filter((id) => !id.startsWith('clutch-')), astra.kits[2]!.id], {}, 2);
    expect(originalClutch.ok ? [] : originalClutch.errors).toContainEqual(expect.stringContaining('embreagem'));
  });

  it('vende e preserva a primeira conversão do Astra com o progresso normal da oficina', async () => {
    const repo = new CareerRepository(new MemoryStore(), 'slot-1');
    const controller = new CareerController(repo);
    expect((await controller.newCareer('fiat-uno-mille-1995')).ok).toBe(true);
    const current = controller.save!;
    await repo.transact(current.revision, (saved) => ({
      ...saved!,
      credits: 45000,
      completedEventIds: [...EVENTS, CHAPTER2_EVENTS[0]!].map((event) => event.id),
    }));
    await controller.load();
    const { car, family, kits } = kitFor('gm-astra-2011');
    expect((await controller.buyCar(car.id)).ok).toBe(true);
    const acquired = controller.save!.ownedCars.find((item) => item.baseCarId === car.id)!;
    expect((await controller.setActiveCar(acquired.id)).ok).toBe(true);
    const kit = kits[0]!;
    const balance = controller.save!.credits;
    expect((await controller.buyPart(kit.id)).ok).toBe(false);
    expect(controller.save!.credits).toBe(balance);
    for (const part of [...support(family, 1), kit.id]) {
      const bought = await controller.buyPart(part);
      if (!bought.ok) throw new Error(`${part}: ${bought.error}`);
    }
    const reloaded = new CareerController(repo);
    await reloaded.load();
    expect(reloaded.activeCar!.installedParts).toContain(kit.id);
    expect(reloaded.activeCar!.buildVersion).toBe(2);
    expect((await reloaded.buyPart(kits[1]!.id)).ok).toBe(false);
  }, 60_000);
});

describe('mapas turbo da conversão', () => {
  it.each(cars)('%s: cada mapa rende mais que o anterior sobre o mesmo kit e exige o kit do seu Stage', (id) => {
    const { car, kits, family } = kitFor(id);
    for (const [index, kit] of kits.entries()) {
      const tier = index + 1;
      const ids = [...support(family, tier), kit.id];
      const alone = resolveBuild(car, ids, {}, 2);
      if (!alone.ok) throw new Error(alone.errors.join('\n'));
      let lastCv = alone.peakPowerCv;
      for (const map of [1, 2, 3]) {
        const mapped = resolveBuild(car, [...ids, `ecu-conversion-${family}-s${map}`], {}, 2);
        if (map > tier) {
          expect(mapped.ok ? [] : mapped.errors).toContainEqual(expect.stringContaining(`conversão turbo Stage ${map} ou superior`));
          continue;
        }
        if (!mapped.ok) throw new Error(`${kit.id} + mapa S${map}: ${mapped.errors.join('\n')}`);
        expect(mapped.peakPowerCv).toBeGreaterThan(lastCv);
        expect(mapped.car.engine.turbo!.maxBoostBar).toBeGreaterThan(kit.turbo.maxBoostBar);
        lastCv = mapped.peakPowerCv;
      }
    }
    const top = [...support(family, 3), kits[2]!.id, `ecu-conversion-${family}-s3`];
    const boost = tuningCapabilities(car, top, 2).boost;
    expect(boost.max).toBeCloseTo(kits[2]!.boostRangeBar[1] + 0.22);
    expect(resolveBuild(car, top, { boostBar: boost.max }, 2).ok).toBe(true);
  }, 120_000);

  it('o mapa turbo exige a conversão e o remap aspirado fica de fora com o kit', () => {
    const { car, kits, family } = kitFor('nissan-370z-2014');
    const noKit = resolveBuild(car, [`ecu-conversion-${family}-s1`], {}, 2);
    expect(noKit.ok ? [] : noKit.errors).toContainEqual(expect.stringContaining('exige a conversão turbo instalada'));
    const ids = [...support(family, 1), kits[0]!.id];
    for (const na of ['ecu-v6-na', `ecu-map-${family}-s1`]) {
      const r = resolveBuild(car, [...ids, na], {}, 2);
      expect(r.ok ? [] : r.errors, na).toContainEqual(expect.stringContaining('remova o remap aspirado'));
    }
    expect(resolveBuild(car, [...ids, `ecu-conversion-${family}-s1`], {}, 2).ok).toBe(true);
  });
});
