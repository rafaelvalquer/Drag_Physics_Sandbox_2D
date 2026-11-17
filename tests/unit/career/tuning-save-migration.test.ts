/** Save v2 → v3: tunes keep the boost, the new settings are optional and validated. */
import { describe, expect, it } from 'vitest';
import { CAREER_SAVE_VERSION, migrateCareerSave, newCareerSave, parseCareerSave } from '../../../src/game/career/CareerState';
const owned = (tune: object) => ({ id: 'c1', baseCarId: 'vw-gol-gts-1988', nickname: 'Gol', paint: { color: '#ffffff', accent: '#000000' }, installedParts: [], tune, acquiredAt: new Date(0).toISOString() });
import { tuneKey } from '../../../src/game/career/tuning/buildCommon';

describe('tuning save migration', () => {
  it('v2 save with a boost tune migrates to v3 unchanged otherwise', () => {
    const s = newCareerSave() as unknown as Record<string, unknown>;
    const cars = [{ ...owned({ boostBar: 0.6 }), buildVersion: 1 }];
    const v2 = { ...s, version: 2, ownedCars: cars };
    const m = migrateCareerSave(v2) as Record<string, unknown>;
    expect(m.version).toBe(3);
    expect(CAREER_SAVE_VERSION).toBe(3);
    const p = parseCareerSave(m);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.save.ownedCars[0]!.tune).toEqual({ boostBar: 0.6 });
  });

  it('v3 accepts the new fields and rejects invalid presets', () => {
    const s = newCareerSave();
    const good = { ...s, ownedCars: [owned({ revLimitRpm: 7000, finalDrive: 'short', throttleResponse: 'sharp', tirePressureKpa: 180 })] };
    expect(parseCareerSave(good).ok).toBe(true);
    const bad = { ...s, ownedCars: [owned({ finalDrive: 'warp' })] };
    expect(parseCareerSave(bad).ok).toBe(false);
  });

  it('tune key keeps the old boost-only format and covers every field', () => {
    expect(tuneKey({ boostBar: 0 })).toContain('b0.00');
    expect(tuneKey({ finalDrive: 'short' })).not.toBe(tuneKey({ finalDrive: 'long' }));
    expect(tuneKey({ tirePressureKpa: 180 })).not.toBe(tuneKey({}));
  });
});
