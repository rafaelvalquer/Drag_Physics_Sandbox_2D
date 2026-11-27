import { describe, expect, it } from 'vitest';
import { carToAcousticConfig } from '../../../src/audio/dsp/AcousticConfig';
import { BASE_TURBO_PROFILES } from '../../../src/audio/dsp/turbo/TurboAcousticProfiles';
import { resolveTurboProfile } from '../../../src/audio/dsp/turbo/TurboProfileResolver';
import { turboProfileOf } from '../../../src/audio/dsp/turbo/TurboAcoustics';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { BUILD_RESOLVER_VERSION, resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { turboAcousticHints } from '../../../src/game/career/tuning/turboAcousticHints';
import { carById, golTurbo } from './turboTestUtils';

const prof = (car: Parameters<typeof carToAcousticConfig>[0]) => turboProfileOf(carToAcousticConfig(car, 'high', 1))!;
const CLASSIC_SUPPORT = ['clutch-ceramic-race', 'fuel-pump', 'forged-kit', 'ecu-race', 'ignition-race'];
const build = (id: string, parts: string[], tune = {}) => {
  const r = resolveBuild(carById(id), parts, tune, BUILD_RESOLVER_VERSION);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.car;
};

describe('Turbo Acoustics 2.0 — profile resolver', () => {
  it('every factory turbo of chapters 2 and 3 resolves to a known base profile', () => {
    for (const car of [...CHAPTER2_CARS, ...CHAPTER3_CARS].filter((c) => c.engine.induction === 'turbo')) {
      const p = prof(car);
      expect(BASE_TURBO_PROFILES[p.baseId], car.id).toBeDefined();
      expect(p.twin, car.id).toBe(car.engine.turbo!.layout === 'parallel-twin');
      expect(p.ventType, car.id).toBe('recirculating');
    }
  });

  it('twin-scroll is one rotor, the parallel twins are two', () => {
    expect(prof(carById('bmw-320i-f30-2014')).housing).toBe('twin-scroll');
    expect(prof(carById('bmw-335i-f30-2013')).housing).toBe('twin-scroll');
    expect(prof(carById('bmw-335i-f30-2013')).twin).toBe(false);
    for (const id of ['mercedes-amg-c43-2017', 'kia-stinger-gt-2019', 'maserati-ghibli-sq4-2015', 'alfa-giulia-qv-2017', 'nissan-gtr-r35-2015']) expect(prof(carById(id)).twin, id).toBe(true);
  });

  it('N20 and N55 share the compressor class but not the final signature', () => {
    const a = prof(carById('bmw-320i-f30-2014'));
    const b = prof(carById('bmw-335i-f30-2013'));
    expect(a.baseId).toBe(b.baseId);
    expect(JSON.stringify(a.rotor)).not.toBe(JSON.stringify(b.rotor));
  });

  it('Golf GTI and A3 (same EA113 hardware) get the same turbo profile — no brand-only distinction', () => {
    const a = prof(carById('vw-golf-gti-mk4-2003'));
    const b = prof(carById('audi-a3-18t-2005'));
    const strip = (p: ReturnType<typeof prof>) => JSON.stringify({ ...p, chain: [] });
    expect(strip(a)).toBe(strip(b));
  });

  it('classic kits map to small / medium / large and the turbine option modifies the class', () => {
    const basic = prof(build('vw-gol-gts-1988', [...CLASSIC_SUPPORT, 'turbo-basic']));
    const medium = prof(build('vw-gol-gts-1988', [...CLASSIC_SUPPORT, 'turbo-medium']));
    const strong = prof(build('vw-gol-gts-1988', [...CLASSIC_SUPPORT, 'turbo-strong']));
    expect([basic.baseId, medium.baseId, strong.baseId]).toEqual(['classic-small-turbo', 'classic-medium-turbo', 'classic-large-turbo']);
    const large = prof(build('vw-gol-gts-1988', [...CLASSIC_SUPPORT, 'turbo-medium', 'turbine-large']));
    expect(large.rotor.onsetShaft).toBeGreaterThan(medium.rotor.onsetShaft);
    expect(large.chain.join(' ')).toContain('turbina large');
  });

  it('intake parts change the exposure; external wastegate parts change the topology', () => {
    const stock = prof(build('vw-gol-gts-1988', [...CLASSIC_SUPPORT, 'turbo-basic']));
    const open = prof(build('vw-gol-gts-1988', [...CLASSIC_SUPPORT, 'turbo-basic', 'filter-direct']));
    expect(open.intakePath).toBe('open');
    expect(open.intakeAttenuation).toBeLessThan(stock.intakeAttenuation * 0.3);
    const wg = prof(build('vw-gol-gts-1988', [...CLASSIC_SUPPORT, 'turbo-strong', 'wastegate-race']));
    expect(wg.wastegateType).toBe('external-recirculated');
  });

  it('the same build gives the same signature on every resolve (deterministic, no shared mutation)', () => {
    const snapshot = JSON.stringify(BASE_TURBO_PROFILES);
    const a = JSON.stringify(prof(golTurbo()));
    for (let i = 0; i < 3; i++) prof(build('vw-gol-gts-1988', [...CLASSIC_SUPPORT, 'turbo-medium', 'turbine-small', 'filter-cone']));
    expect(JSON.stringify(prof(golTurbo()))).toBe(a);
    expect(JSON.stringify(BASE_TURBO_PROFILES)).toBe(snapshot);
  });

  it('stock cars carry no hints (byte-identical to the catalogue) and an NA build never gets a turbo profile', () => {
    expect(carById('bmw-320i-f30-2014').acoustic.turbo).toBeUndefined();
    expect(turboAcousticHints(carById('vw-gol-gts-1988'), ['filter-sport'])).toBeUndefined();
    expect(turboProfileOf(carToAcousticConfig(carById('vw-gol-gts-1988')))).toBeUndefined();
    // removing every part restores the original car
    const back = build('vw-gol-gts-1988', []);
    expect(back.acoustic.turbo).toBeUndefined();
  });

  it('factory Stage 2/3 turbos switch to the upgraded class; Stage 1 keeps the factory one', () => {
    const fam = 'bmw-n20';
    const base = prof(carById('bmw-320i-f30-2014'));
    const mk = (stage: number) => resolveTurboProfile({ engineId: 'bmw-n20b20-184', family: fam, turbo: carById('bmw-320i-f30-2014').engine.turbo!, hints: { kit: 'factory', stage } });
    expect(mk(1).baseId).toBe(base.baseId);
    expect(mk(2).baseId).toBe('modern-hybrid-turbo');
    expect(mk(3).baseId).toBe('modern-big-turbo');
  });

  it('a conversion on a V6 uses ONE rotor (no second turbo is introduced)', () => {
    const p = resolveTurboProfile({ engineId: 'nissan-vq37vhr-332', family: 'nissan-vq37vhr', turbo: { maxBoostBar: 0.6, spoolTimeS: 0.6, fullBoostFlowFraction: 0.7, maxShaftRpm: 164000, compressorBlades: 6, bovEnabled: true, bovVentTimeS: 0.14 }, hints: { kit: 'conversion', stage: 2 } });
    expect(p.baseId).toBe('v6-single-conversion');
    expect(p.twin).toBe(false);
  });
});
