import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { powerPeakRpm, withStockBreathing } from '../../../src/game/career/tuning/breathingModel';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { ENGINE_FAMILIES } from '../../../src/game/career/tuning/chapter2Parts';
import { applyFactoryTurboParts } from '../../../src/game/career/tuning/factoryTurboModel';
import { findPart } from '../../../src/game/career/tuning/parts';

describe('admissão e comando de motores turbo de fábrica', () => {
  const car = findCampaignCar('bmw-320i-f30-2014')!;
  const n20 = car.engine;
  const stock = withStockBreathing(n20, powerPeakRpm(n20.torqueCurve, n20.revLimitRpm));
  const family = ENGINE_FAMILIES['bmw-n20']!;
  // Existing NA parts are convenient fixtures for the model. They retain their NA-only catalogue compatibility.
  const cam = findPart('cam-k20');
  const head = findPart('head-ported');
  const manifold = findPart('manifold-k20-rbc');
  if (!cam || cam.category !== 'camshaft' || !('ivoDeltaDeg' in cam) ||
      !head || head.category !== 'cylinder-head' ||
      !manifold || manifold.category !== 'intake-manifold' || !('runnerLengthScale' in manifold)) {
    throw new Error('Fixtures para calibração não encontradas');
  }
  const reference = applyFactoryTurboParts(stock, { family });
  const camBuild = applyFactoryTurboParts(stock, { family, cam });
  const headBuild = applyFactoryTurboParts(stock, { family, head });
  const intakeBuild = applyFactoryTurboParts(stock, { family, manifold });
  const torque = (engine: typeof stock, rpm: number): number => engine.torqueCurve.torqueNm[engine.torqueCurve.rpm.indexOf(rpm)]!;

  it('mantém a curva de referência e registra os eventos das válvulas para o motor e o áudio', () => {
    expect(resolveBuild(car, [], {}, 2)).toMatchObject({ ok: true, car: { engine: { torqueCurve: n20.torqueCurve } } });
    expect(camBuild.engine.cam.ivcDeg).toBe(stock.cam.ivcDeg + cam.ivcDeltaDeg);
    expect(camBuild.engine.cam.intakeLiftMm).toBe(stock.cam.intakeLiftMm + cam.liftAddMm);
    const low = reference.engine.torqueCurve.rpm.find((rpm) => rpm >= 2000)!;
    expect(torque(camBuild.engine, low)).toBeLessThan(torque(reference.engine, low));
  });

  it('mede ganho no alto giro com maior vazão de cabeçote e altera a geometria do coletor', () => {
    const high = reference.engine.torqueCurve.rpm.filter((rpm) => rpm >= 5300 && rpm <= stock.revLimitRpm);
    expect(high.some((rpm) => torque(headBuild.engine, rpm) > torque(reference.engine, rpm))).toBe(true);
    expect(intakeBuild.engine.intake.runnerDiameterMm).toBe(stock.intake.runnerDiameterMm + manifold.runnerDiameterAddMm);
    expect(intakeBuild.engine.intake.manifoldVolumeL).toBe(stock.intake.manifoldVolumeL * manifold.plenumScale);
    expect(intakeBuild.engine.torqueCurve).not.toEqual(reference.engine.torqueCurve);
  });
});
