/** Design rules of the parts catalogue (see docs/PARTS_DESIGN_AUDIT.md). */
import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { ALL_PARTS } from '../../../src/game/career/tuning/parts';

describe('parts design rules', () => {
  it('an internals part never lowers the torque limit below the factory limit of any classic car', () => {
    const internals = ALL_PARTS.filter((p) => p.category === 'engine-internals' && 'mod' in p && p.mod.internalTorqueLimitNm !== undefined);
    expect(internals.length).toBeGreaterThanOrEqual(3);
    for (const car of CAREER_CARS.filter((c) => !c.engine.family)) {
      const stock = Math.max(320, car.transmission.clutch.maxTorqueNm * 1.45); // BuildResolver stockTorqueLimitNm
      for (const p of internals) {
        const lim = (p as unknown as { mod: { internalTorqueLimitNm: number } }).mod.internalTorqueLimitNm;
        expect(lim, `${p.id} on ${car.id}`).toBeGreaterThan(stock);
      }
    }
  });

  it('internals parts rise with their price', () => {
    const lim = (id: string): number => (ALL_PARTS.find((p) => p.id === id) as unknown as { mod: { internalTorqueLimitNm: number } }).mod.internalTorqueLimitNm;
    expect(lim('rods-reinforced')).toBeLessThan(lim('pistons-forged'));
    expect(lim('pistons-forged')).toBeLessThan(lim('forged-kit'));
  });
});
