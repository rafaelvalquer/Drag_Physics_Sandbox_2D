/** Fuel supply: limits and rejects builds; the factory system carries the factory car. */
import { describe, expect, it } from 'vitest';
import { checkFuel, fuelCapacity, fuelErrorMessage, factoryFuelFlowGs, isDirectInjection } from '../../../../src/game/career/tuning/FuelSystemModel';
import { findPart, type FuelHpPumpPart, type FuelSystemPart } from '../../../../src/game/career/tuning/parts';
import { BITURBO_CARS, build, car, errors, GTR, IS350, NA_CARS, C43, Z370 } from './_helpers';

const inj = (id: string) => findPart(id) as FuelSystemPart;

describe('fuel system model', () => {
  it('carries every factory car with its design margin', () => {
    for (const id of [...NA_CARS, ...BITURBO_CARS]) {
      const c = car(id);
      const r = build(id, []);
      const f = checkFuel(c, {}, r.peakPowerCv, c.engine.induction === 'turbo');
      expect(f.ok, id).toBe(true);
      expect(f.margin, id).toBeGreaterThan(1);
    }
  });
  it('capacity scales with injectors and pump, and the smallest of them limits', () => {
    const c = car(Z370);
    const f0 = factoryFuelFlowGs(c);
    expect(fuelCapacity(c).capacityGs).toBeCloseTo(f0, 6);
    expect(fuelCapacity(c, { injectors: inj('fuel-v6-highflow') }).capacityGs).toBeGreaterThan(fuelCapacity(c, { injectors: inj('fuel-v6-injectors') }).capacityGs);
    const half: FuelSystemPart = { ...inj('fuel-v6-highflow'), pumpScale: 1 };
    expect(fuelCapacity(c, { injectors: half }).limiter).toBe('pump');
  });
  it('direct injection is limited by the high-pressure pump until it is replaced', () => {
    expect(isDirectInjection('toyota-2gr-fse')).toBe(true);
    expect(isDirectInjection('nissan-vr38dett')).toBe(false);
    const c = car(C43);
    const big = inj('fuel-v6-highflow');
    expect(fuelCapacity(c, { injectors: big }).limiter).toBe('hp-pump');
    const hp = findPart('fuel-hp-pump') as FuelHpPumpPart;
    expect(fuelCapacity(c, { injectors: big, hpPump: hp }).capacityGs).toBeGreaterThan(fuelCapacity(c, { injectors: big }).capacityGs);
  });
  it('limits the build: a turbo kit without bigger injectors is refused with the number', () => {
    const e = errors(Z370, ['turbo-vq37-balanced', 'forged-v6-turbo', 'clutch-v6-comp', 'oil-system-street']).join(' ');
    expect(e).toMatch(/alimentação insuficiente.*sustentam \d+ cv e o projeto pede \d+ cv/);
  });
  it('the hybrid turbines of the biturbo need fuel and the high-pressure pump on a direct-injection engine', () => {
    const parts = ['ecu-stage3', 'turbo-hybrid-s3', 'downpipe-catless', 'intercooler-race', 'pistons-forged-modern', 'at-upgrade'];
    expect(errors(C43, parts).join(' ')).toMatch(/alimentação insuficiente/);
    expect(errors(C43, [...parts, 'fuel-v6-injectors', 'fuel-hp-pump']).length).toBe(0);
    // the GT-R has port injection: no high-pressure pump to wait for
    expect(fuelCapacity(car(GTR), { injectors: inj('fuel-v6-highflow') }).limiter).not.toBe('hp-pump');
  });
  it('explains which part fixes it', () => {
    const c = car(IS350);
    const msg = fuelErrorMessage(checkFuel(c, { injectors: inj('fuel-v6-highflow') }, 900, true));
    expect(msg).toMatch(/bomba de alta pressão/);
  });
});
