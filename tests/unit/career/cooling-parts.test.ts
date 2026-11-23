import { describe, expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { COOLING_PARTS } from '../../../src/game/career/tuning/coolingParts';
import { auditPartGain } from '../../../src/game/career/tuning/partGain';
import { findPart } from '../../../src/game/career/tuning/parts';
import { careerResolverVersion } from '../../../src/game/career/tuning/resolverVersion';
import { EngineDyno } from '../../../src/physics/engine/EngineDyno';
import { EngineThermalModel } from '../../../src/physics/engine/EngineThermalModel';

describe('arrefecimento da oficina', () => {
  it.each(CAREER_CARS.map((car) => [car.id, car] as const))('%s instala três estágios por circuito', (_, car) => {
    const version = careerResolverVersion(car.id);
    const parts = COOLING_PARTS.filter((part) => !incompatibility(car, part));
    const stock = resolveBuild(car, [], {}, version);
    if (!stock.ok) throw new Error(stock.errors.join('\n'));
    expect(parts).toHaveLength(9);
    for (const category of ['cooling-radiator', 'cooling-oil', 'cooling-fan']) {
      const speed = category === 'cooling-fan' ? 0 : 20;
      const temperature = (engine: typeof car.engine): number => {
        const model = new EngineThermalModel(engine);
        for (let i = 0; i < 100; i++) model.step(1, car.engine.ratedPowerCv * 735.5 * 1.15, 30, speed);
        return category === 'cooling-oil' ? model.oilC : model.coolantC;
      };
      let previous = temperature(stock.car.engine);
      let mass = stock.car.massKg;
      for (const part of parts.filter((part) => part.category === category)) {
        const next = resolveBuild(car, [part.id], {}, version);
        if (!next.ok) throw new Error(next.errors.join('\n'));
        const cooler = temperature(next.car.engine);
        expect(cooler).toBeLessThan(previous);
        expect(next.car.massKg).toBeGreaterThan(mass);
        expect(next.car.engine.torqueCurve).toEqual(stock.car.engine.torqueCurve);
        mass = next.car.massKg;
        previous = cooler;
      }
    }
  });

  it('aquece sob carga, reduz torque quando supera o limite e restaura a partida aquecida', () => {
    const car = CAREER_CARS.find((part) => part.id === 'bmw-320i-f30-2014')!;
    const bench = new EngineDyno(car.engine);
    expect(bench.start()).toBe(true);
    const warm = bench.measure(4200, 1);
    expect(bench.engine.thermal.coolantC).toBeGreaterThan(88);
    expect(bench.engine.thermal.torqueFraction).toBe(1);
    bench.engine.thermal.coolantC = 135;
    const hot = bench.measure(4200, 1, 1 / 120, 0.5, 0.4);
    expect(hot.torqueNm).toBeLessThan(0.9 * warm.torqueNm);
    bench.engine.reset();
    expect(bench.engine.thermal.coolantC).toBe(88);
    expect(bench.engine.thermal.oilC).toBe(94);
  });

  it.each(['radiator-large', 'oil-cooler', 'fan-upgrade'])('%s reduz a temperatura sob carga no C43', (partId) => {
    const car = CAREER_CARS.find((item) => item.engine.family === 'mercedes-m276')!;
    const track = TRACKS.find((item) => item.id === 'test-track')!;
    const audit = auditPartGain(car, findPart(partId)!, track, 2);
    if (!('gain' in audit) || !audit.gain.sustainedTemperature) throw new Error('Medição térmica indisponível');
    expect(audit.status).toBe('gain');
    expect(audit.gain.sustainedTemperature.afterC).toBeLessThan(audit.gain.sustainedTemperature.beforeC);
  });
});
