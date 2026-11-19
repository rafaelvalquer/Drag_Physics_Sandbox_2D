import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { auditPartGain } from '../../../src/game/career/tuning/partGain';
import { ALL_PARTS } from '../../../src/game/career/tuning/parts';
import { careerResolverVersion } from '../../../src/game/career/tuning/resolverVersion';

/**
 * Every workshop part must gain on the cars it fits: quicker over 402 m, or more power / clutch
 * capacity without losing time — measured with the real physics against the same build without
 * the part. One car per layout here (front, rear, factory turbo, AWD, automatic); the full matrix
 * is `npx tsx scripts/parts-gain-report.ts --fail`.
 */
const SAMPLE = ['vw-gol-gts-1988', 'gm-chevette-sl-1988', 'peugeot-208-gt-2017', 'bmw-320i-f30-2014', 'mitsubishi-evo-x-2012'];
const track = TRACKS.find((t) => t.id === 'test-track')!;
const modern = new Set([...CHAPTER2_CARS, ...CHAPTER3_CARS].map((c) => c.id));

describe('baseline da oficina', () => {
  it.each(CAREER_CARS.map((car) => [car.id, car] as const))('%s usa o resolver adequado de fábrica', (_, car) => {
    const version = careerResolverVersion(car.id);
    expect(version).toBe(modern.has(car.id) ? 2 : 1);
    expect(resolveBuild(car, [], {}, version)).toMatchObject({ ok: true, version });
  });
});

describe('ganho de cada peça da oficina', () => {
  for (const id of SAMPLE) {
    it(`${id}: toda peça compatível ganha desempenho`, () => {
      const car = CAREER_CARS.find((c) => c.id === id)!;
      const version = careerResolverVersion(id);
      const bad: string[] = [];
      let measured = 0;
      for (const p of ALL_PARTS) {
        const audit = auditPartGain(car, p, track, version);
        if (audit.status === 'incompatible') continue;
        if ('reasons' in audit) {
          // Unresolved pairs are reported separately in the full matrix and never counted as gains.
          if (audit.status !== 'dependency-blocked') bad.push(`${p.id}: ${audit.status} — ${audit.reasons.join('; ')}`);
          continue;
        }
        const g = audit.gain;
        measured++;
        if (audit.status !== 'gain') bad.push(`${p.id}: ${(g.cvAfter - g.cvBefore).toFixed(1)} cv, ET ${(g.etAfter - g.etBefore).toFixed(3)} s`);
      }
      expect(measured).toBeGreaterThan(10);
      expect(bad).toEqual([]);
    }, 300_000);
  }
});

describe('textos das peças', () => {
  it('descrição e efeito físico são textos diferentes e não vazios', () => {
    for (const p of ALL_PARTS) {
      expect(p.description.length, p.id).toBeGreaterThan(10);
      expect(p.physics.length, p.id).toBeGreaterThan(10);
      expect(p.physics, p.id).not.toBe(p.description);
    }
  });
});
