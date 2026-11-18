/** The project is derived from the installed hardware; there is no stage variable. */
import { describe, expect, it } from 'vitest';
import { classifyProject } from '../../../../src/game/career/tuning/EngineProjectClassifier';
import { presetsFor } from '../../../../src/game/career/tuning/ProjectRequirements';
import { inductionState } from '../../../../src/game/career/tuning/ConvertedTurboModel';
import { findPart, type PartDef } from '../../../../src/game/career/tuning/parts';
import { BITURBO_CARS, C43, car, NA_CARS, Z370 } from './_helpers';

describe('engine project classifier', () => {
  it('classifies the stock car as original, per school', () => {
    expect(classifyProject(car(Z370), []).id).toBe('original');
    expect(classifyProject(car(Z370), []).school).toBe('aspirated');
    expect(classifyProject(car(C43), []).school).toBe('factory-turbo');
  });

  it('reads every preset back as the project it was built for', () => {
    for (const id of [...NA_CARS, ...BITURBO_CARS]) for (const p of presetsFor(car(id))) expect(classifyProject(car(id), p.parts).id, `${id} ${p.id}`).toBe(p.id);
  });

  it('depends only on the parts: same parts, any order, same project', () => {
    const p = presetsFor(car(Z370)).find((x) => x.id === 'na-high-rpm')!;
    expect(classifyProject(car(Z370), [...p.parts].reverse()).id).toBe(classifyProject(car(Z370), p.parts).id);
  });

  it('keeps the factory induction and derives the current one from the hardware', () => {
    const parts = (ids: string[]): PartDef[] => ids.map((i) => findPart(i)!);
    const stock = inductionState(car(Z370), []);
    expect(stock).toMatchObject({ factoryInduction: 'NA', currentInduction: 'NA', converted: false });
    const conv = inductionState(car(Z370), parts(['turbo-vq37-street']));
    expect(conv).toMatchObject({ factoryInduction: 'NA', currentInduction: 'turbo', converted: true, turboLayout: 'single' });
    expect(inductionState(car(Z370), parts(['turbo-vq37-twin-comp'])).turboLayout).toBe('twin');
    expect(inductionState(car(C43), [])).toMatchObject({ factoryInduction: 'turbo', currentInduction: 'turbo', converted: false });
    expect(car(Z370).engine.induction).toBe('NA'); // the catalogue sheet never changes
  });
});
