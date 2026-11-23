import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { EVENTS } from '../../../src/game/career/CareerEvents';
import { isPartUnlocked } from '../../../src/game/career/CareerProgression';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { familyOf, transmissionKindOf } from '../../../src/game/career/tuning/BuildResolverV2';
import { auditPartGain } from '../../../src/game/career/tuning/partGain';
import { findPart } from '../../../src/game/career/tuning/parts';
import { careerResolverVersion } from '../../../src/game/career/tuning/resolverVersion';
import { tuningCapabilities } from '../../../src/game/career/tuning/TuningCapabilities';

const partIds = ['launch-control-street', 'launch-control', 'launch-control-pro'];
const supported = CAREER_CARS.filter((car) => transmissionKindOf(car) !== 'torque-converter-auto');

describe('controle de largada por estágio', () => {
  it.each(supported.map((car) => [car.id, car] as const))('%s aplica o alvo à embreagem e aceita ajuste dentro do limite', (_, car) => {
    const version = careerResolverVersion(car.id);
    const stockRpm = car.transmission.clutch.launchRpm;
    for (const [index, id] of partIds.entries()) {
      const parts = [id];
      const caps = tuningCapabilities(car, parts, version).launch;
      const expected = Math.min(stockRpm + [200, 400, 550][index]!, car.engine.redlineRpm - 800);
      expect(caps.enabled).toBe(true);
      expect(caps.step).toBe(index === 2 ? 50 : 100);
      const defaultBuild = resolveBuild(car, parts, {}, version);
      if (!defaultBuild.ok) throw new Error(defaultBuild.errors.join('\n'));
      expect(caps.default).toBe(expected);
      expect(defaultBuild.car.transmission.clutch.launchRpm).toBe(expected);
      const adjusted = resolveBuild(car, parts, { launchRpm: caps.min + caps.step }, version);
      if (!adjusted.ok) throw new Error(adjusted.errors.join('\n'));
      expect(adjusted.car.transmission.clutch.launchRpm).toBe(caps.min + caps.step);
      expect(resolveBuild(car, parts, { launchRpm: caps.max + caps.step }, version).ok).toBe(false);
    }
  });

  it('preserva o estol do conversor automático', () => {
    const converter = CAREER_CARS.find((car) => transmissionKindOf(car) === 'torque-converter-auto')!;
    expect(tuningCapabilities(converter, [], 2).launch.enabled).toBe(false);
    for (const id of partIds) expect(resolveBuild(converter, [id], {}, 2).ok).toBe(false);
  });

  it('libera a opção de competição na sexta noite pelos eventos já salvos', () => {
    const family = familyOf(supported[0]!);
    const afterNight = (night: number) => ({ completedEventIds: EVENTS.slice(0, night).map((event) => event.id) });
    expect(isPartUnlocked(afterNight(4), findPart('launch-control')!, family)).toBe(true);
    expect(isPartUnlocked(afterNight(5), findPart('launch-control-pro')!, family)).toBe(false);
    expect(isPartUnlocked(afterNight(6), findPart('launch-control-pro')!, family)).toBe(true);
  });

  it('mede o controle de competição do 208 GT com o mesmo pneu nos dois builds', () => {
    const car = CAREER_CARS.find((item) => item.engine.family === 'psa-prince-thp')!;
    const track = TRACKS.find((item) => item.id === 'test-track')!;
    const audit = auditPartGain(car, findPart('launch-control-pro')!, track, 2);
    if (!('gain' in audit)) throw new Error(audit.reasons.join('\n'));
    expect(audit.status).toBe('gain');
    expect(audit.gain.context).toEqual(['tires-sport']);
    expect(audit.gain.etAfter).toBeLessThan(audit.gain.etBefore);
  });
});
