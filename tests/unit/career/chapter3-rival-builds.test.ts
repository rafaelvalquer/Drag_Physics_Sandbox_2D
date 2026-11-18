/**
 * Chapter 3: the ten rivals are prepared with real workshop parts, resolved by the player's own
 * resolver. Power lands in the planned ranges (initial balance targets), aspirated V6 stay
 * aspirated, nothing is exclusive to a rival, and the GT-R prize copies Akira's prepared build.
 */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { CHAPTER3_RIVALS, findRival } from '../../../src/game/career/CareerEvents';
import { rivalBuild } from '../../../src/game/career/RivalBuildFactory';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { ALL_PARTS, findPart } from '../../../src/game/career/tuning/parts';
import { CHAPTER3_PARTS } from '../../../src/game/career/tuning/chapter3Parts';

/** [min, max] cv of each rival's build (the plan's initial targets). */
const POWER_CV: Record<string, [number, number]> = {
  'ricardo-elite': [230, 270],
  hugo: [315, 330],
  renata: [320, 340],
  bruno: [350, 370],
  davi: [430, 475],
  valentina: [465, 525],
  maya: [465, 530],
  'bianca-elite': [430, 490],
  dante: [575, 660],
  akira: [650, 710],
};

describe('rival builds', () => {
  it('each rival power is inside its target range and above the factory car', () => {
    for (const r of CHAPTER3_RIVALS) {
      const b = rivalBuild(r);
      const stock = resolveBuild(findCampaignCar(r.baseCarId)!, [], {}, 2);
      const [lo, hi] = POWER_CV[r.id]!;
      expect(b.peakPowerCv, r.id).toBeGreaterThanOrEqual(lo);
      expect(b.peakPowerCv, r.id).toBeLessThanOrEqual(hi);
      expect(stock.ok && b.peakPowerCv > stock.peakPowerCv, r.id).toBe(true);
      expect(r.parts.length, r.id).toBeGreaterThan(0);
    }
  });

  it('the aspirated V6 stay aspirated and use the family V6 parts', () => {
    for (const id of ['hugo', 'renata', 'bruno']) {
      const r = findRival(id)!;
      const b = rivalBuild(r);
      expect(b.car.engine.induction, id).toBe('NA');
      for (const p of ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na']) expect(r.parts, id).toContain(p);
    }
  });

  it('no part exists only for a rival: every rival part is a normal catalogue part, compatible with the car', () => {
    for (const r of CHAPTER3_RIVALS) {
      const base = findCampaignCar(r.baseCarId)!;
      for (const id of r.parts) {
        const p = findPart(id);
        expect(p, `${r.id}: ${id}`).toBeTruthy();
        expect(ALL_PARTS.includes(p!)).toBe(true);
        expect(incompatibility(base, p!), `${r.id}: ${id}`).toBeNull();
      }
    }
  });

  it('the V6 parts are family-specific and the chapter 2 engine parts are still refused by the V6', () => {
    const z = findCampaignCar('nissan-350z-2006')!;
    const is = findCampaignCar('lexus-is350-2015')!;
    const z34 = findCampaignCar('nissan-370z-2014')!;
    expect(incompatibility(z, findPart('cam-vq35-s1')!)).toBeNull();
    expect(incompatibility(z34, findPart('cam-vq35-s1')!)).not.toBeNull();
    expect(incompatibility(z34, findPart('cam-vq37-s1')!)).toBeNull();
    expect(incompatibility(is, findPart('cam-vq35-s1')!)).not.toBeNull();
    expect(incompatibility(is, findPart('head-v6-ported')!)).not.toBeNull(); // 2GR-FSE: conservative selection only
    for (const id of ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na']) expect(incompatibility(is, findPart(id)!), id).toBeNull();
    expect(incompatibility(z, findPart('head-ported')!)).not.toBeNull();
    expect(incompatibility(findCampaignCar('mercedes-amg-c43-2017')!, findPart('ecu-v6-na')!)).not.toBeNull();
  });

  it('V6 parts raise the power through physics and are available to the player', () => {
    const z = findCampaignCar('nissan-350z-2006')!;
    const stock = resolveBuild(z, [], {}, 2);
    const s1 = resolveBuild(z, ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na'], {}, 2);
    const s2 = resolveBuild(z, ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na', 'cam-vq35-s1'], {}, 2);
    expect(stock.ok && s1.ok && s2.ok).toBe(true);
    if (stock.ok && s1.ok && s2.ok) {
      expect(s1.peakPowerCv).toBeGreaterThan(stock.peakPowerCv * 1.04);
      expect(s2.peakPowerCv).toBeGreaterThan(s1.peakPowerCv);
      expect(s2.peakPowerCv / stock.peakPowerCv).toBeLessThan(1.25); // moderate gains, not a turbo
    }
    for (const p of CHAPTER3_PARTS) expect(p.unlock, p.id).toBe('c3-v6-parts');
  });

  it("Akira's GT-R is a prepared Stage 2", () => {
    const akira = findRival('akira')!;
    expect(akira.parts).toContain('ecu-stage2');
    const stock = resolveBuild(findCampaignCar(akira.baseCarId)!, [], {}, 2);
    expect(stock.ok && rivalBuild(akira).peakPowerCv > stock.peakPowerCv * 1.2).toBe(true);
  });
});
