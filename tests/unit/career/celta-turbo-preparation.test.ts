import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild, MAX_KNOCK_LOSS } from '../../../src/game/career/tuning/BuildResolver';
import { CELTA_TURBO_COMPRESSION } from '../../../src/game/career/tuning/expandedParts';
import { auditPartStages } from '../../../src/game/career/tuning/partGain';

const celta = findCampaignCar('gm-celta-2003')!;
const gol = findCampaignCar('vw-gol-gts-1988')!;
const stage1 = CELTA_TURBO_COMPRESSION[0]!.id;

describe('preparação turbo do Celta VHC', () => {
  it('instala os pistões antes do kit e preserva a exigência de baixa compressão', () => {
    const prep = resolveBuild(celta, [stage1], {}, 1);
    if (!prep.ok) throw new Error(prep.errors.join('; '));
    expect(prep.car.engine.compressionRatio).toBeCloseTo(10.4, 6);
    expect(prep.car.engine.induction).toBe('NA');
    expect(resolveBuild(celta, ['turbo-basic', 'clutch-reinforced'], {}, 1)).toMatchObject({ ok: false });
    const ready = resolveBuild(celta, [stage1, 'turbo-basic', 'clutch-reinforced'], {}, 1);
    if (!ready.ok) throw new Error(ready.errors.join('; '));
    expect(ready.car.engine.induction).toBe('turbo');
    expect(ready.knockLoss).toBeLessThan(MAX_KNOCK_LOSS);
    expect(celta.engine.compressionRatio).toBe(12.6);
    expect(resolveBuild(gol, [stage1], {}, 1)).toMatchObject({ ok: false });
    expect(resolveBuild(gol, [stage1], {}, 2)).toMatchObject({ ok: false });
  });

  it('verifica o envelope de pressão com o mesmo kit, ignição e transmissão', () => {
    const track = TRACKS.find((item) => item.id === 'test-track')!;
    const tested = auditPartStages(celta, CELTA_TURBO_COMPRESSION, track, 1);
    expect(tested.map(({ audit }) => audit.status)).toEqual(['gain', 'gain', 'gain']);
    const ranges = tested.map(({ audit }) => {
      if (!('gain' in audit)) throw new Error(audit.reasons.join('; '));
      return audit.gain.boostHeadroom!;
    });
    expect(ranges[0]!.beforeBar).toBe(0);
    expect(ranges[1]!.beforeBar).toBe(ranges[0]!.afterBar);
    expect(ranges[2]!.beforeBar).toBe(ranges[1]!.afterBar);
    expect(ranges[2]!.afterBar).toBeGreaterThanOrEqual(1.35);
  }, 60_000);
});
