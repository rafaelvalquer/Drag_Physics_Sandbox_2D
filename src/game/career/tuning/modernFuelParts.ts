import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import { modernStageRelease } from './modernStageRelease';
import type { FuelSystemPart } from './parts';

const stages = [
  { tier: 1, capacity: 1.15, label: 'Bomba e injetores de rua', price: 900 },
  { tier: 2, capacity: 1.32, label: 'Bomba e injetores de alta vazão', price: 1580 },
  { tier: 3, capacity: 1.55, label: 'Alimentação de competição', price: 2600 },
] as const;

export const MODERN_FUEL_PARTS: readonly FuelSystemPart[] = ([2, 3] as const).flatMap((origin) => {
  const cars = origin === 2 ? CHAPTER2_CARS : CHAPTER3_CARS;
  const unique = new Map(cars.map((car) => [car.engine.family!, car]));
  return [...unique].flatMap(([family, car]) => stages.map((stage): FuelSystemPart => ({
    id: `fuel-${family}-s${stage.tier}`,
    category: 'electronics-fuel',
    name: `${stage.label} Stage ${stage.tier}`,
    ...modernStageRelease(origin, stage.tier),
    price: Math.round(stage.price * Math.sqrt(car.engine.ratedPowerCv / 170) / 50) * 50,
    since: 2,
    compat: { families: [family] },
    progression: { tier: stage.tier, group: 'modern-fuel', specialization: 'rua' },
    fuelCapacityScale: stage.capacity,
    description: 'Bomba e injetores dimensionados para sustentar a mistura sob carga.',
    physics: `A vazão contínua de combustível aumenta ${Math.round((stage.capacity - 1) * 100)}% sobre a estimativa de fábrica. A proteção reduz a combustão se o conjunto não sustentar a mistura-alvo.`,
  })));
});
