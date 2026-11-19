import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { applyFactoryTurboParts } from '../../../src/game/career/tuning/factoryTurboModel';
import { ENGINE_FAMILIES } from '../../../src/game/career/tuning/chapter2Parts';
import { auditPartStages } from '../../../src/game/career/tuning/partGain';
import { findPart } from '../../../src/game/career/tuning/parts';

describe('auditoria de comandos clássicos e remaps legados', () => {
  it('exige o turbo para os novos comandos e conserva o ID do perfil original de competição', () => {
    const gol = findCampaignCar('vw-gol-gts-1988')!;
    const support = ['turbo-basic', 'clutch-reinforced'];
    let previous = 0;
    for (const id of ['cam-turbo-street', 'cam-turbo-sport', 'cam-turbo']) {
      const turbo = resolveBuild(gol, [...support, id], {}, 1);
      if (!turbo.ok) throw new Error(turbo.errors.join('\n'));
      expect(turbo.car.engine.cam.intakeLiftMm).toBeGreaterThan(previous);
      previous = turbo.car.engine.cam.intakeLiftMm;
    }
    expect(resolveBuild(gol, ['cam-turbo-street'], {}, 1).ok).toBe(false);
    expect(resolveBuild(gol, ['cam-turbo-sport'], {}, 1).ok).toBe(false);
  });

  it('mede o Stage 3 legado com a turbina híbrida só no conjunto que exige essa peça', () => {
    const bmw = findCampaignCar('bmw-320i-f30-2014')!;
    const track = TRACKS.find((entry) => entry.id === 'test-track')!;
    const stages = ['ecu-stage1', 'ecu-stage2', 'ecu-stage3'].map((id) => findPart(id)!);
    const results = auditPartStages(bmw, stages, track, 2);
    expect(results.map(({ audit }) => audit.status)).toEqual(['gain', 'gain', 'gain']);
    const figures = results.map(({ audit }) => {
      if (!('gain' in audit)) throw new Error(audit.reasons.join('\n'));
      return audit.gain;
    });
    expect(figures[0]!.context).not.toContain('turbo-hybrid');
    expect(figures[1]!.context).not.toContain('turbo-hybrid');
    expect(figures[2]!.context).toContain('turbo-hybrid');
  }, 60_000);

  it('mantém cópias independentes dos resultados térmicos e mecânicos reutilizados', () => {
    const bmw = findCampaignCar('bmw-320i-f30-2014')!;
    const ecu = findPart('ecu-stage1');
    if (ecu?.category !== 'ecu') throw new Error('Remap legado ausente');
    const parts = { family: ENGINE_FAMILIES['bmw-n20']!, ecu };
    const first = applyFactoryTurboParts(bmw.engine, parts);
    const reference = first.engine.torqueCurve.torqueNm[0]!;
    first.engine.torqueCurve.torqueNm[0] = -100;
    const next = applyFactoryTurboParts(bmw.engine, parts);
    expect(next.engine.torqueCurve.torqueNm[0]).toBe(reference);
    expect(next.engine).not.toBe(first.engine);
  });
});
