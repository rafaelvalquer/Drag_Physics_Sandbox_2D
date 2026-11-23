import type { EngineConfig } from '../../../data/schema';
import { EngineModel } from '../../../physics/engine/EngineModel';
import { engineFuel, powerPeakRpm, withStockBreathing } from './breathingModel';

type Supply = NonNullable<EngineConfig['fueling']>;
const originalSupplies = new WeakMap<EngineConfig, Supply>();

/** Fuel rate needed to hold the commanded mixture near the top of the operating range. */
export function peakFuelDemandKgS(engine: EngineConfig, airFuelRatio: number): number {
  const model = new EngineModel(engine.fueling ? { ...engine, fueling: undefined } : engine);
  const points = engine.torqueCurve.rpm.filter((rpm) => rpm <= engine.revLimitRpm);
  points.push(engine.revLimitRpm);
  return Math.max(...points.map((rpm) => model.wotOperatingPoint(rpm).flow)) / airFuelRatio;
}

export function fuelMixtureRatio(engine: EngineConfig): number {
  const boosted = engine.induction === 'turbo';
  return engineFuel(engine) === 'ethanol' ? (boosted ? 7.5 : 8.1) : (boosted ? 11.8 : 12.8);
}

/** Estimated production capacity based on the original air curve and an injector duty reserve. */
export function factoryFuelSupply(engine: EngineConfig): Supply {
  if (engine.fueling) return engine.fueling;
  const cached = originalSupplies.get(engine);
  if (cached) return cached;
  const airFuelRatio = fuelMixtureRatio(engine);
  const stock = withStockBreathing(engine, powerPeakRpm(engine.torqueCurve, engine.revLimitRpm));
  const maxFuelKgS = peakFuelDemandKgS(stock, airFuelRatio) * 1.12;
  const supply = { maxFuelKgS, airFuelRatio };
  originalSupplies.set(engine, supply);
  return supply;
}
