/** Chapter 3 Stage 3 catalogue: every part is hardware with a physical effect, never a power multiplier. */
import { describe, expect, it } from 'vitest';
import { CHAPTER3_CARS } from '../../../../src/data/cars/chapter3/index';
import { ENGINE_FAMILIES } from '../../../../src/game/career/tuning/chapter2Parts';
import { CHAPTER3_STAGE3_PARTS } from '../../../../src/game/career/tuning/chapter3Stage3Parts';
import { ALL_PARTS, CATEGORY_DESCRIPTION, CATEGORY_LABEL, findPart, UNLOCK_LABEL, WORKSHOP_TABS } from '../../../../src/game/career/tuning/parts';
import { presetsFor } from '../../../../src/game/career/tuning/ProjectRequirements';
import { resolveBuild } from '../../../../src/game/career/tuning/BuildResolver';

describe('Chapter 3 Stage 3 parts', () => {
  it('has unique ids that are not used by any other part', () => {
    const ids = CHAPTER3_STAGE3_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ALL_PARTS.filter((p) => ids.includes(p.id))).toHaveLength(ids.length);
  });

  it('describes the physics, has a known unlock and an existing engine family', () => {
    for (const p of CHAPTER3_STAGE3_PARTS) {
      expect(p.physics.length, p.id).toBeGreaterThan(40);
      expect(UNLOCK_LABEL[p.unlock], p.id).toBeTruthy();
      expect(p.since, p.id).toBe(2);
      expect(p.chapter, p.id).toBe(3);
      for (const f of p.compat?.families ?? []) expect(ENGINE_FAMILIES[f], `${p.id} ${f}`).toBeDefined();
      expect(CATEGORY_LABEL[p.category], p.id).toBeTruthy();
      expect(CATEGORY_DESCRIPTION[p.category], p.id).toBeTruthy();
    }
  });

  it('never scales power: no part carries a power or torque multiplier field', () => {
    const forbidden = /^(power|cv|hp|horsepower|torque)(Scale|Mult|Multiplier|Gain|Add|Bonus|Factor)?$/i;
    for (const p of CHAPTER3_STAGE3_PARTS) for (const k of Object.keys(p)) expect(forbidden.test(k), `${p.id}.${k}`).toBe(false);
  });

  it('keeps the brief prices', () => {
    const price: Record<string, number> = {
      'ecu-v6-na': 3000, 'ecu-vq35-s2': 5500, 'ecu-vq35-comp': 9000, 'filter-v6-flow': 1500, 'filter-v6-dual': 3000,
      'manifold-v6-sport': 3500, 'manifold-v6-comp': 5500, 'pistons-v6-hcr': 5000, 'rods-v6-light': 6500, 'forged-v6-na': 10000,
      'crank-balanced-v6': 7500, 'turbo-hybrid-s3': 12000, 'turbo-hybrid-hf': 18000, 'ecu-biturbo-comp': 10000, 'fuel-v6-injectors': 4500,
      'fuel-v6-highflow': 7000, 'fuel-hp-pump': 6500, 'intercooler-comp': 5000, 'manifold-turbo-hf': 4500, 'internals-biturbo-s3': 12000, 'boost-by-gear': 4000,
    };
    for (const [id, v] of Object.entries(price)) expect(findPart(id)?.price, id).toBe(v);
  });

  it('shows every new category in a workshop tab', () => {
    const shown = new Set(WORKSHOP_TABS.flatMap((t) => t.categories));
    for (const p of CHAPTER3_STAGE3_PARTS) expect(shown.has(p.category), p.id).toBe(true);
  });

  it('never mutates the catalogue cars while resolving every preset', () => {
    const before = JSON.stringify(CHAPTER3_CARS);
    for (const c of CHAPTER3_CARS) for (const pr of presetsFor(c)) resolveBuild(c, pr.parts, {}, 2);
    expect(JSON.stringify(CHAPTER3_CARS)).toBe(before);
  });

  it('keeps every preset valid on its car, without NaN in the curve', () => {
    for (const c of CHAPTER3_CARS) {
      const presets = presetsFor(c);
      expect(presets.length, c.id).toBeGreaterThanOrEqual(4);
      for (const pr of presets) {
        const r = resolveBuild(c, pr.parts, {}, 2);
        expect(r.ok, `${c.id} ${pr.id}: ${r.ok ? '' : r.errors.join('; ')}`).toBe(true);
        if (r.ok) for (const t of r.car.engine.torqueCurve.torqueNm) expect(Number.isFinite(t) && t > 0, `${c.id} ${pr.id}`).toBe(true);
      }
    }
  });
});
