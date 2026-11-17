/** Dyno Lab draft controller: debounce, cache, stale results discarded, commit/discard. */
import { describe, expect, it } from 'vitest';
import { DynoTuningController } from '../../../src/ui/career/dyno/DynoTuningController';

function fakeTimers() {
  const q: (() => void)[] = [];
  return { setTimer: (fn: () => void) => (q.push(fn), q.length - 1), clearTimer: (h: unknown) => (q[h as number] = () => {}), flush: () => q.splice(0).forEach((f) => f()) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('DynoTuningController', () => {
  it('debounces edits, measures only the last draft, caches results', async () => {
    const t = fakeTimers();
    const got: number[] = [];
    let gate: (() => void) | null = null;
    const c = new DynoTuningController<number>({
      saved: {},
      compute: async (tune) => {
        await new Promise<void>((r) => (gate = r));
        return tune.revLimitRpm ?? 0;
      },
      onResult: (r) => got.push(r),
      ...t,
    });
    c.set('revLimitRpm', 7000);
    c.set('revLimitRpm', 7200);
    expect(c.dirty).toBe(true);
    t.flush();
    await tick();
    // a newer edit while measuring: the running one is stale
    c.set('revLimitRpm', 7400);
    gate!();
    await tick();
    t.flush();
    await tick();
    gate!();
    await tick();
    expect(got).toEqual([7400]);
    expect(c.stats.discarded).toBe(1);
    c.set('revLimitRpm', 7400);
    t.flush();
    await tick();
    expect(c.stats.cacheHits).toBe(1);
    c.commit();
    expect(c.dirty).toBe(false);
    c.set('revLimitRpm', 6000);
    c.discard();
    expect(c.dirty).toBe(false);
    c.dispose();
  });

  it('cache is bounded', async () => {
    const t = fakeTimers();
    const c = new DynoTuningController<number>({ saved: {}, compute: async () => 1, onResult: () => {}, cacheSize: 3, ...t });
    for (let i = 0; i < 8; i++) {
      c.set('revLimitRpm', 6000 + i * 100);
      t.flush();
      await tick();
    }
    expect(c.cacheSize).toBe(3);
  });
});
