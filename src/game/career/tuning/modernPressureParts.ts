import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import { modernStageRelease } from './modernStageRelease';
import type { BoostControlPart, WastegatePart } from './parts';

const stages = [
  { tier: 1, headroom: 0.48, response: 0.96, actuatorPrice: 820, controllerPrice: 690 },
  { tier: 2, headroom: 0.64, response: 0.92, actuatorPrice: 1400, controllerPrice: 1150 },
  { tier: 3, headroom: 0.8, response: 0.875, actuatorPrice: 2120, controllerPrice: 1790 },
] as const;

type PressurePart = BoostControlPart | WastegatePart;
const fmt = (value: number): string => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export const MODERN_PRESSURE_PARTS: readonly PressurePart[] = ([2, 3] as const).flatMap((origin) => {
  const cars = origin === 2 ? CHAPTER2_CARS : CHAPTER3_CARS;
  const families = new Map(cars.filter((car) => car.engine.induction === 'turbo').map((car) => [car.engine.family!, car]));
  return [...families].flatMap(([family, car]) => {
    const twin = car.engine.turbo?.layout === 'parallel-twin';
    const price = (base: number) => Math.round(base * Math.sqrt(car.engine.ratedPowerCv / 220) / 50) * 50;
    return stages.flatMap((stage): PressurePart[] => {
      const { tier } = stage;
      // On the 690T, small changes during spool can move the first automatic shift.
      const response = family === 'alfa-690t' ? [0.96, 0.91, 0.85][tier - 1]! : stage.response;
      const common = { ...modernStageRelease(origin, tier), since: 2 as const, compat: { families: [family], induction: 'turbo' as const } };
      return [
        {
          ...common,
          id: `wastegate-${family}-s${tier}`,
          category: 'turbo-wastegate',
          name: `Atuador de wastegate Stage ${tier}`,
          price: price(stage.actuatorPrice * (twin ? 1.55 : 1)),
          progression: { tier, group: 'modern-wastegate', specialization: 'turbo' },
          description: twin
            ? 'Par de atuadores com molas e diafragmas calibrados para as duas bancadas.'
            : 'Atuador com mola e diafragma calibrados para a pressão de trabalho.',
          physics: `Sustenta até ${fmt(stage.headroom)} bar acima do alvo original, dentro da faixa da ECU e dos limites do motor.`,
          actuatorHeadroomBar: stage.headroom,
        },
        {
          ...common,
          id: `boost-solenoid-${family}-s${tier}`,
          category: 'boost-control',
          name: `Solenoide de pressão Stage ${tier}`,
          price: price(stage.controllerPrice),
          progression: { tier, group: 'modern-boost-control', specialization: 'turbo' },
          description: 'Solenoide com resposta mais rápida para manter a válvula fechada durante o enchimento.',
          physics: `Reduz em ${fmt((1 - response) * 100)}% a constante de tempo de enchimento. A pressão alvo segue a ECU e o limite do atuador.`,
          spoolTimeScale: response,
        },
      ];
    });
  });
});
