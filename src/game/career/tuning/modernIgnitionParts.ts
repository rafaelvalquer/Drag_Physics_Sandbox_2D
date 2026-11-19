import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import { modernStageRelease } from './modernStageRelease';
import type { IgnitionPart } from './parts';

const stages = [
  { tier: 1, name: 'Velas e bobinas de rua', burn: 0.992, retard: 0.97, price: 630 },
  { tier: 2, name: 'Ignição de alta energia', burn: 0.981, retard: 0.93, price: 1120 },
  { tier: 3, name: 'Ignição de competição', burn: 0.966, retard: 0.87, price: 1770 },
] as const;
const format = (value: number): string => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export const MODERN_IGNITION_PARTS: readonly IgnitionPart[] = ([2, 3] as const).flatMap((origin) => {
  const cars = origin === 2 ? CHAPTER2_CARS : CHAPTER3_CARS;
  const families = new Map(cars.map((car) => [car.engine.family!, car]));
  return [...families].flatMap(([family, car]) => stages.map((stage): IgnitionPart => {
    const turbo = car.engine.induction === 'turbo';
    // These converter schedules are sensitive to small changes in launch torque.
    const burnDurationScale = family === 'toyota-2gr-fse' ? [0.997, 0.9945, 0.992][stage.tier - 1]!
      : family === 'alfa-690t' ? [0.992, 0.986, 0.981][stage.tier - 1]! : stage.burn;
    const knockRetardScale = turbo ? stage.retard : 1;
    const reduction = format((1 - burnDurationScale) * car.engine.combustion.burnDurationDeg);
    const retard = turbo ? ` A perda por atraso de centelha em pressão diminui ${format((1 - knockRetardScale) * 100)}%.` : '';
    return {
      id: `ignition-${family}-s${stage.tier}`,
      category: 'electronics-ignition',
      name: `${stage.name} Stage ${stage.tier}`,
      ...modernStageRelease(origin, stage.tier),
      price: Math.round(stage.price * Math.sqrt(car.engine.ratedPowerCv / 170) / 50) * 50,
      since: 2,
      compat: { families: [family] },
      progression: { tier: stage.tier, group: 'modern-ignition', specialization: 'rua' },
      description: turbo
        ? 'Velas e bobinas dimensionadas para manter a centelha sob pressão de cilindro.'
        : 'Velas e bobinas calibradas para regularidade de centelha em alta carga.',
      physics: `A duração efetiva da queima diminui ${reduction}° de virabrequim.${retard}`,
      burnDurationScale,
      knockRetardScale,
    };
  }));
});
