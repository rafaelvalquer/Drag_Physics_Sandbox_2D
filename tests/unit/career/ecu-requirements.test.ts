/** ECU requirements: the install planner explains a turbo map vs an aspirated remap and the conversion it needs. */
import { describe, expect, it } from 'vitest';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { classifyError } from '../../../src/game/career/tuning/buildIssues';
import { planInstall } from '../../../src/game/career/tuning/ProjectRequirements';

const civic = [...CHAPTER2_CARS, ...CHAPTER3_CARS].find((c) => c.engine.family === 'honda-k20')!;
const converted = [
  'conversion-turbo-honda-k20-s1', 'conversion-compression-honda-k20', 'conversion-oil-honda-k20',
  'fuel-honda-k20-s1', 'ignition-honda-k20-s1', 'rotating-assembly-honda-k20-s1', 'clutch-honda-k20-s3',
];
const rich = { completedEventIds: [] as string[], inventoryPartIds: [] as string[], credits: 9_999_999 };
const plan = (installed: string[], partId: string) => planInstall({ base: civic, car: { baseCarId: civic.id, installedParts: installed }, save: rich, partId, versionOf: () => 2 });

describe('ECU install requirements', () => {
  it('classifies the conversion / map messages with a fix', () => {
    expect(classifyError('com a conversão turbo, use um Mapa turbo (Stage 1–3): remova o remap aspirado')).toMatchObject({ code: 'na-remap-on-conversion', fixCategories: ['ecu'] });
    expect(classifyError('Mapa turbo Esportivo Stage 2 exige a conversão turbo instalada')).toMatchObject({ code: 'needs-turbo-kit', fixCategories: ['turbo'] });
    expect(classifyError('Mapa turbo Esportivo Stage 2 exige a conversão turbo Stage 2 ou superior')).toMatchObject({ code: 'needs-turbo-kit' });
  });

  it('an aspirated remap on a converted car is replaced by the turbo map of the same stage', () => {
    const p = plan(converted, 'ecu-map-honda-k20-s2');
    expect(p.substitutes?.requested).toBe('ecu-map-honda-k20-s2');
    expect(p.steps[0]!.partId).toBe('ecu-conversion-honda-k20-s2');
    expect(p.parts).not.toContain('ecu-map-honda-k20-s2');
    // the final build is valid with the listed parts
    expect(resolveBuild(civic, p.parts, {}, 2).ok).toBe(p.openIssues.length === 0);
    // every extra step says what it fixes (the conversion stage the map needs, for instance)
    for (const st of p.steps.slice(1)) expect(st.resolves).not.toBeNull();
  });

  it('a turbo map without the conversion lists the conversion it needs', () => {
    const p = plan([], 'ecu-conversion-honda-k20-s1');
    expect(p.substitutes).toBeUndefined();
    expect(p.steps.map((s) => s.partId)).toContain('conversion-turbo-honda-k20-s1');
  });

  it('the conversion kit swaps an installed aspirated remap for a turbo map and sends it to the stock', () => {
    const p = plan(['ecu-map-honda-k20-s1'], 'conversion-turbo-honda-k20-s1');
    const swap = p.steps.find((s) => s.resolves?.code === 'na-remap-on-conversion');
    expect(swap, JSON.stringify(p.steps.map((s) => s.partId))).toBeDefined();
    expect(swap!.replaces).toBe('ecu-map-honda-k20-s1');
    expect(p.parts).not.toContain('ecu-map-honda-k20-s1');
  });
});
