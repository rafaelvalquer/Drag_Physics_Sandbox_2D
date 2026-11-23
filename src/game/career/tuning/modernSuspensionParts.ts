import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import { modernStageRelease } from './modernStageRelease';
import type { SuspensionPart } from './parts';

const profiles = {
  front: { label: 'dianteira', deltas: [-0.012, -0.025, -0.04], description: 'O acerto conserva carga nas rodas dianteiras quando o carro acelera.' },
  rear: { label: 'traseira', deltas: [0.022, 0.04, 0.059], description: 'O acerto transfere mais carga para as rodas traseiras na largada.' },
  awd: { label: 'integral', deltas: [0.009, 0.019, 0.03], description: 'O acerto transfere carga moderadamente para trás, conservando tração na dianteira.' },
} as const;

export const MODERN_SUSPENSION_PARTS: readonly SuspensionPart[] = ([2, 3] as const).flatMap((origin) => {
  const cars = origin === 2 ? CHAPTER2_CARS : CHAPTER3_CARS;
  const applications = new Map(cars.map((car) => [car.engine.family!, car]));
  return [...applications].flatMap(([family, car]) => ([1, 2, 3] as const).map((tier): SuspensionPart => {
    const profile = profiles[car.drivenAxle];
    const deltas = family === 'toyota-2gr-fse' ? [0.010, 0.016, 0.022] as const : profile.deltas;
    const cgHeightDeltaM = deltas[tier - 1];
    const massRemoveKg = [2, 5, 9][tier - 1]!;
    return {
      id: `launch-suspension-${family}-s${tier}`,
      name: `Suspensão ${profile.label} Stage ${tier}`,
      since: 2,
      category: 'suspension',
      ...modernStageRelease(origin, tier),
      price: Math.round([1250, 2130, 3350][tier - 1]! * Math.sqrt(car.massKg / 1250) / 50) * 50,
      compat: { families: [family], drives: [car.drivenAxle] },
      progression: { tier, group: 'launch-suspension', specialization: 'rua' },
      description: profile.description,
      physics: `Altura efetiva de transferência de carga ${cgHeightDeltaM > 0 ? '+' : '−'}${Math.round(Math.abs(cgHeightDeltaM) * 1000)} mm. Massa do conjunto −${massRemoveKg} kg.`,
      cgHeightDeltaM,
      massRemoveKg,
    };
  }));
});
