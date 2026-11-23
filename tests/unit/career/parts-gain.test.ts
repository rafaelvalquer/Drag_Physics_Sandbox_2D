import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { familyOf, incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { WORKSHOP_SLOTS, workshopSlotExclusion } from '../../../src/game/career/tuning/partCoverage';
import { auditPartGain } from '../../../src/game/career/tuning/partGain';
import { physicalSlotOf, progressionOf } from '../../../src/game/career/tuning/partProgression';
import { ALL_PARTS, findPart, type PartDef } from '../../../src/game/career/tuning/parts';
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

describe('sequências de estágios', () => {
  it('têm IDs únicos e cada carro aceita apenas uma opção por estágio e grupo', () => {
    expect(new Set(ALL_PARTS.map((part) => part.id)).size).toBe(ALL_PARTS.length);
    for (const car of CAREER_CARS) {
      const sequences = new Map<string, PartDef[]>();
      for (const part of ALL_PARTS) {
        const progression = progressionOf(part, familyOf(car), car.id);
        if (!progression || incompatibility(car, part)) continue;
        const sequence = sequences.get(progression.group) ?? [];
        sequence.push(part);
        sequences.set(progression.group, sequence);
      }
      for (const [group, sequence] of sequences) {
        const label = `${car.id}/${group}`;
        expect(new Set(sequence.map((part) => progressionOf(part)!.tier)).size, label).toBe(sequence.length);
        expect(sequence, label).toHaveLength(3);
        expect(new Set(sequence.map(physicalSlotOf)).size, label).toBe(1);
        expect(new Set(sequence.map((part) => progressionOf(part)!.specialization)).size, label).toBe(1);
      }
    }
  });

  it.each(CAREER_CARS.map((car) => [car.id, car] as const))('%s cobre todas as categorias aplicáveis', (_, car) => {
    const parts = ALL_PARTS.filter((part) => !incompatibility(car, part));
    for (const slot of WORKSHOP_SLOTS) {
      if (workshopSlotExclusion(car, slot)) continue;
      const tiers = parts.filter((part) => physicalSlotOf(part) === slot)
        .map((part) => progressionOf(part, familyOf(car), car.id)?.tier);
      expect([...new Set(tiers.filter((tier) => tier !== undefined))].sort(), `${car.id}/${slot}`).toEqual([1, 2, 3]);
    }
  });
});

describe('aceleração além do quarto de milha', () => {
  it.each([
    ['nissan-gtr-r35-2015', 'compression-chamber-nissan-vr38dett-s1', true],
    ['fiat-uno-mille-1995', 'filter-sport', false],
  ] as const)('%s só registra 100–200 km/h se alcançar a velocidade final', (id, partId, canReach) => {
    const car = CAREER_CARS.find((item) => item.id === id)!;
    const options = [car, findPart(partId)!, track, careerResolverVersion(id)] as const;
    const short = auditPartGain(...options);
    const extended = auditPartGain(...options, true);
    if (!('gain' in short) || !('gain' in extended)) throw new Error(`${id}: simulação indisponível`);
    expect(short.gain.hundredTo200AfterS).toBeNull();
    expect(extended.gain.etAfter).toBe(short.gain.etAfter);
    expect(extended.gain.t100After).toBe(short.gain.t100After);
    if (canReach) expect(extended.gain.hundredTo200AfterS).toBeGreaterThan(0);
    else expect(extended.gain.hundredTo200AfterS).toBeNull();
  });
});
