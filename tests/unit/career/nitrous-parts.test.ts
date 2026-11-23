/** N₂O kits in the catalogue, the resolver, the unlocks and the save. */
import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { CareerController, inventoryEntry } from '../../../src/game/career/CareerController';
import { CHAPTER2_EVENTS, CHAPTER3_EVENTS, EVENTS } from '../../../src/game/career/CareerEvents';
import { isPartUnlocked } from '../../../src/game/career/CareerProgression';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { newCareerSave, parseCareerSave, exportCareer, importCareer } from '../../../src/game/career/CareerState';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { NITROUS_KITS, findNitrousKit } from '../../../src/game/career/tuning/nitrousParts';
import { nitrousTuneOf } from '../../../src/game/career/tuning/nitrousOverlay';
import { findPart } from '../../../src/game/career/tuning/parts';
import { reconcileTune, validateTune } from '../../../src/game/career/tuning/TuningCapabilities';
import { MemoryStore } from '../../../src/storage/db';

const gol = CAREER_CARS.find((c) => c.id === 'vw-gol-gts-1988')!;
const golf = CAREER_CARS.find((c) => c.id === 'vw-golf-gti-mk4-2003')!;
const ok = (car: typeof gol, parts: string[], tune = {}, v: 1 | 2 = 1) => {
  const r = resolveBuild(car, parts, tune, v);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r;
};

describe('catalogue', () => {
  it('four kits in their own category, one tier each, with growing capacity, flow, mass and price', () => {
    expect(NITROUS_KITS.map((k) => k.id)).toEqual(['nitrous-street', 'nitrous-wet', 'nitrous-progressive', 'nitrous-direct']);
    for (const k of NITROUS_KITS) expect(k.category).toBe('nitrous');
    for (let i = 1; i < NITROUS_KITS.length; i++) {
      const a = NITROUS_KITS[i - 1]!;
      const b = NITROUS_KITS[i]!;
      expect(b.price).toBeGreaterThan(a.price);
      expect(b.kit.capacityKg).toBeGreaterThan(a.kit.capacityKg);
      expect(b.kit.maxFlowKgS).toBeGreaterThan(a.kit.maxFlowKgS);
      expect(b.kit.massKg).toBeGreaterThan(a.kit.massKg);
    }
    expect(NITROUS_KITS.map((k) => k.price)).toEqual([2500, 7500, 15000, 32000]);
    for (const k of NITROUS_KITS) expect(findPart(k.id)).toBe(k);
  });

  it('the full-flow duration is the cylinder over the flow (never a fixed number)', () => {
    for (const k of NITROUS_KITS) {
      const t = k.kit.capacityKg / k.kit.maxFlowKgS;
      expect(t).toBeGreaterThan(6);
      expect(t).toBeLessThan(9);
    }
  });
});

describe('resolver', () => {
  it('a build without a kit is exactly what it was (no nitrous on the car)', () => {
    expect(ok(gol, []).car.nitrous).toBeUndefined();
    expect(ok(golf, [], {}, 2).car.nitrous).toBeUndefined();
  });

  it('the kit adds its mass and the nitrous setup, and nothing else: the engine curve and power stay', () => {
    for (const [car, v] of [[gol, 1], [golf, 2]] as const) {
      const plain = ok(car, [], {}, v);
      for (const kit of NITROUS_KITS) {
        const r = ok(car, [kit.id], {}, v);
        expect(r.car.massKg).toBeCloseTo(plain.car.massKg + kit.kit.massKg, 1);
        expect(r.car.engine.torqueCurve).toEqual(plain.car.engine.torqueCurve);
        expect(r.peakPowerCv).toBe(plain.peakPowerCv); // at rest the curve has no nitro in it
        expect(r.car.nitrous!.kitId).toBe(kit.id);
        expect(r.car.nitrous!.capacityKg).toBe(kit.kit.capacityKg);
        expect(Object.isFrozen(r.car)).toBe(true);
      }
    }
  });

  it('every campaign car takes every kit, with its turbo or not', () => {
    for (const car of CAREER_CARS) {
      const v = car.engine.family ? 2 : 1;
      for (const kit of NITROUS_KITS) {
        const r = resolveBuild(car, [kit.id], {}, v);
        expect(r.ok, `${car.id} ${kit.id}`).toBe(true);
      }
    }
  }, 120_000);

  it('the cache tells the settings apart (one or two stages, the split, flow and ramp)', () => {
    const kit = 'nitrous-progressive';
    const single = ok(gol, [kit], { nitrousMode: 'single', nitrousFlow1: 0.6 }).car.nitrous!;
    const dual40 = ok(gol, [kit], { nitrousMode: 'dual', nitrousShare: 0.4, nitrousFlow1: 0.8, nitrousFlow2: 0.5 }).car.nitrous!;
    const dual60 = ok(gol, [kit], { nitrousMode: 'dual', nitrousShare: 0.6, nitrousFlow1: 0.8, nitrousFlow2: 0.5 }).car.nitrous!;
    expect(single.mode).toBe('single');
    expect(single.stage1Share).toBe(1);
    expect(dual40.stage1Share).toBeCloseTo(0.4, 6);
    expect(dual60.stage1Share).toBeCloseTo(0.6, 6);
    expect(dual40.stage1Flow).toBe(0.8);
    expect(dual40.stage2Flow).toBe(0.5);
    expect(ok(gol, [kit], { nitrousRamp1: 2 }).car.nitrous!.stage1RampS).toBe(2);
  });

  it('settings outside what the kit allows are refused; without a kit they are refused too', () => {
    expect(resolveBuild(gol, ['nitrous-street'], { nitrousFlow1: 1.4 }, 1).ok).toBe(false);
    expect(resolveBuild(gol, ['nitrous-street'], { nitrousRamp1: 3 }, 1).ok).toBe(false); // coarse controller: shorter ramp range
    expect(resolveBuild(gol, ['nitrous-progressive'], { nitrousRamp1: 3 }, 1).ok).toBe(true);
    expect(validateTune(gol, [], 1, { nitrousFlow1: 0.5 }).join()).toMatch(/exige um kit de nitro/);
    expect(nitrousTuneOf(findNitrousKit('nitrous-street')!, {}).flow1).toBe(0.7);
  });

  it('a better fuel system and forged internals are read from the build (the nitro asks for them)', () => {
    const weak = ok(gol, ['nitrous-direct']).car.nitrous!;
    const fed = ok(gol, ['nitrous-direct', 'fuel-pump']).car.nitrous!;
    expect(fed.fuelSupply).toBeGreaterThan(weak.fuelSupply);
    expect(weak.fuelSupply).toBe(1);
    const forged = ok(gol, ['nitrous-direct', 'fuel-pump', 'forged-kit', 'turbo-basic', 'clutch-reinforced']);
    expect(forged.car.nitrous!.torqueLimitNm).toBeGreaterThan(weak.torqueLimitNm);
  });
});

describe('unlocks and save', () => {
  const ch1 = EVENTS.map((e) => e.id);
  const up2 = (k: number) => [...ch1, ...CHAPTER2_EVENTS.filter((e) => e.order <= k).map((e) => e.id)];
  const up3 = (k: number) => [...up2(10), ...CHAPTER3_EVENTS.filter((e) => e.order <= k).map((e) => e.id)];
  const open = (id: string, done: string[]) => isPartUnlocked({ completedEventIds: done }, findPart(id)!, 'legacy');

  it('the kits open along the campaign', () => {
    const e = (n: number) => EVENTS.filter((x) => x.order <= n).map((x) => x.id);
    expect(open('nitrous-street', e(4))).toBe(false);
    expect(open('nitrous-street', e(5))).toBe(true);
    expect(open('nitrous-wet', up2(3))).toBe(false);
    expect(open('nitrous-wet', up2(4))).toBe(true);
    expect(open('nitrous-progressive', up2(7))).toBe(false);
    expect(open('nitrous-progressive', up2(8))).toBe(true);
    expect(open('nitrous-direct', up3(4))).toBe(false);
    expect(open('nitrous-direct', up3(5))).toBe(true);
  });

  it('the settings are saved, exported and imported; the cylinder and the stage are not part of the save', () => {
    const s = newCareerSave();
    const tune = { nitrousMode: 'dual' as const, nitrousShare: 0.4, nitrousFlow1: 0.8, nitrousRamp1: 0.5, nitrousFlow2: 0.5, nitrousRamp2: 1.5 };
    s.ownedCars = [{ id: 'c1', baseCarId: 'vw-gol-gts-1988', nickname: 'Gol', paint: { color: '#ffffff', accent: '#000000' }, installedParts: ['nitrous-street'], tune, buildVersion: 1, acquiredAt: new Date(0).toISOString() }];
    s.activeCarId = 'c1';
    const p = parseCareerSave(JSON.parse(JSON.stringify(s)));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.save.ownedCars[0]!.tune).toEqual(tune);
    const back = importCareer(exportCareer(s));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.save.ownedCars[0]!.tune).toEqual(tune);
    const text = exportCareer(s);
    expect(text).not.toMatch(/remaining|consumed|STAGE_|DEPLETED/);
  });

  it('removing the kit drops its settings; swapping the kit keeps only what the new one allows', () => {
    const tune = { nitrousMode: 'dual' as const, nitrousShare: 0.4, nitrousFlow1: 0.8, nitrousRamp1: 2.5 };
    const none = reconcileTune(gol, [], 1, tune);
    expect(none.tune).toEqual({});
    expect(none.dropped).toContain('nitrousMode');
    const street = reconcileTune(gol, ['nitrous-street'], 1, tune); // coarse controller: 2.5 s ramp is out
    expect(street.tune.nitrousMode).toBe('dual');
    expect(street.tune.nitrousRamp1).toBeUndefined();
    expect(street.dropped).toContain('nitrousRamp1');
    const prog = reconcileTune(gol, ['nitrous-progressive'], 1, tune);
    expect(prog.tune.nitrousRamp1).toBe(2.5);
  });

  it('buying and installing a kit charges once and never charges to use it', async () => {
    const c = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
    const r = await c.newCareer('vw-gol-gts-1988');
    if (!r.ok) throw new Error(r.error);
    for (const e of EVENTS.filter((x) => x.order <= 5)) {
      const res = await c.recordRace({
        attemptId: `${e.id}-n`, eventId: e.id, playerCarId: c.activeCar!.id, opponentCarId: 'r', outcome: 'win', completedAt: new Date().toISOString(), buildVersion: 1, playerBuildKey: 'k', opponentBuildKey: 'k',
        playerResult: { name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false },
        opponentResult: { name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false },
      });
      if (!res.ok) throw new Error(res.error);
    }
    await (c as unknown as { commit(f: (s: { credits: number }) => void): Promise<unknown> }).commit((s) => void (s.credits = 20000));
    const kit = findNitrousKit('nitrous-street')!;
    const before = c.save!.credits;
    const buy = await c.buyPart('nitrous-street');
    expect(buy.ok, buy.ok ? '' : buy.error).toBe(true);
    expect(before - c.save!.credits).toBe(kit.price);
    expect(c.activeCar!.installedParts).toContain('nitrous-street');
    // a better kit replaces it: the old one goes to the stock, nothing is added up
    await (c as unknown as { commit(f: (s: { credits: number }) => void): Promise<unknown> }).commit((s) => void (s.credits = 90000));
    const w = CareerController.withPart(['nitrous-street'], 'nitrous-wet');
    expect(w).toEqual({ parts: ['nitrous-wet'], replaced: 'nitrous-street' });
    expect(inventoryEntry('nitrous-street', 'vw-gol-gts-1988')).toBe('nitrous-street@vw-gol-gts-1988');
  });
});
