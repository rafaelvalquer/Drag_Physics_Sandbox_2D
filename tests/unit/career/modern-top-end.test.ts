import { describe, expect, it } from 'vitest';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { MODERN_TOP_END_PARTS } from '../../../src/game/career/tuning/modernTopEndParts';

const cars = [...CHAPTER2_CARS, ...CHAPTER3_CARS];
const categories = ['camshaft', 'cylinder-head', 'intake-manifold'];
const model = (id: string) => cars.find((car) => car.id === id)!;
const legal = (id: string, parts: string[]) => {
  const result = resolveBuild(model(id), parts, {}, 2);
  if (!result.ok) throw new Error(`${id}: ${result.errors.join('; ')}`);
  return result;
};

describe('cabeçote, admissão e comando modernos', () => {
  it.each(cars.map((car) => [car.id, car] as const))('%s tem três estágios específicos em cada categoria', (_, car) => {
    const compatible = MODERN_TOP_END_PARTS.filter((part) => !incompatibility(car, part));
    expect(compatible).toHaveLength(9);
    for (const category of categories)
      expect(compatible.filter((part) => part.category === category).map((part) => part.progression?.tier)).toEqual([1, 2, 3]);
  });

  it('o i-VTEC mantém o lóbulo baixo e modifica apenas o perfil alto', () => {
    const id = 'honda-civic-si-2008';
    const stock = legal(id, []);
    const stage = legal(id, ['cam-profile-honda-k20-s3']);
    expect(stage.car.engine.cam).toEqual(stock.car.engine.cam);
    expect(stage.car.engine.variableCam!.switchRpm).toBe(stock.car.engine.variableCam!.switchRpm);
    expect(stage.car.engine.variableCam!.high.intakeLiftMm).toBeGreaterThan(stock.car.engine.variableCam!.high.intakeLiftMm);
    const remap = legal(id, ['cam-profile-honda-k20-s3', 'ecu-stage1-na']);
    expect(remap.car.engine.revLimitRpm).toBe(stage.car.engine.revLimitRpm);
  });

  it.each([
    ['bmw-320i-f30-2014', 'bmw-n20'],
    ['bmw-335i-f30-2013', 'bmw-n55'],
    ['nissan-370z-2014', 'nissan-vq37vhr'],
  ])('o perfil do %s altera levantamento de admissão sem aumentar o de escape', (id, family) => {
    const stock = legal(id, []);
    const built = legal(id, [`cam-profile-${family}-s3`]);
    expect(built.car.engine.cam.intakeLiftMm).toBeGreaterThan(stock.car.engine.cam.intakeLiftMm);
    expect(built.car.engine.cam.exhaustLiftMm).toBe(stock.car.engine.cam.exhaustLiftMm);
    expect(built.car.engine.torqueCurve).not.toEqual(stock.car.engine.torqueCurve);
  });

  it('o Lexus recebe cabeçote e coletor próprios, sem aceitar um cabeçote do VQ', () => {
    const id = 'lexus-is350-2015';
    const stock = legal(id, []);
    const head = legal(id, ['ported-head-toyota-2gr-fse-s1']);
    const intake = legal(id, ['intake-runners-toyota-2gr-fse-s2']);
    expect(head.peakPowerCv).toBeGreaterThan(stock.peakPowerCv);
    expect(intake.car.engine.intake.runnerDiameterMm).toBeGreaterThan(stock.car.engine.intake.runnerDiameterMm);
    expect(resolveBuild(model(id), ['ported-head-nissan-vq35de-s1'], {}, 2)).toMatchObject({ ok: false });
  });
});
