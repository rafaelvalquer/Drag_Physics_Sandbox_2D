import { describe, expect, it } from 'vitest';
import { isBottleneck, projectLimitations } from '../../../../src/game/career/tuning/ProjectLimitations';
import { build, C43, Z370 } from './_helpers';

describe('project limitations', () => {
  it('lists only measured margins, most limiting first', () => {
    const r = build(Z370, ['turbo-vq37-balanced', 'forged-v6-turbo', 'fuel-v6-highflow', 'clutch-v6-comp']);
    const l = projectLimitations(r);
    expect(l.map((x) => x.id)).toEqual(expect.arrayContaining(['combustivel', 'lubrificacao', 'internos', 'transmissao']));
    for (let i = 1; i < l.length; i++) expect(l[i]!.margin).toBeGreaterThanOrEqual(l[i - 1]!.margin);
  });
  it('flags the oil system of a loaded biturbo and clears it with the race system', () => {
    const parts = ['ecu-biturbo-comp', 'turbo-hybrid-hf', 'downpipe-catless', 'intercooler-comp', 'internals-biturbo-s3', 'fuel-v6-highflow', 'fuel-hp-pump', 'at-upgrade-s2'];
    expect(projectLimitations(build(C43, parts)).filter(isBottleneck).some((x) => x.id === 'lubrificacao')).toBe(true);
    expect(projectLimitations(build(C43, [...parts, 'oil-system-race'])).filter(isBottleneck).some((x) => x.id === 'lubrificacao')).toBe(false);
  });
});
