import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import { modernStageRelease } from './modernStageRelease';
import type { ExpandedPart, MechanicalMods } from './parts';

const stages = [1, 2, 3] as const;
const sections = [
  { category: 'cooling-radiator', key: 'radiatorAreaScale', label: 'Radiador', metric: 'Área efetiva de troca térmica', ratios: [1.16, 1.36, 1.6], kg: [0.6, 1.4, 2.5], price: 890, description: 'Colmeia com mais área para dissipar calor no circuito de água.' },
  { category: 'cooling-oil', key: 'oilCoolerAreaScale', label: 'Resfriador de óleo', metric: 'Capacidade de troca térmica do óleo', ratios: [1.2, 1.48, 1.78], kg: [0.45, 1, 1.7], price: 760, description: 'Trocador com maior área para resfriar o óleo de lubrificação.' },
  { category: 'cooling-fan', key: 'fanFlowScale', label: 'Ventoinha', metric: 'Vazão de ar assistida', ratios: [1.24, 1.54, 1.9], kg: [0.18, 0.38, 0.7], price: 530, description: 'Ventoinha com maior vazão quando o termostato fecha o circuito elétrico.' },
] as const;

function partsFor(family: string, origin: 1 | 2 | 3, powerCv: number): ExpandedPart[] {
  return sections.flatMap((section) => stages.map((tier): ExpandedPart => {
    const scale = section.ratios[tier - 1];
    const mass = section.kg[tier - 1] * (powerCv >= 300 ? 1.3 : 1);
    const mod: MechanicalMods = { [section.key]: scale, coolingMassAddKg: mass };
    return {
      id: `${section.category}-${family}-s${tier}`,
      category: section.category,
      name: `${section.label} Stage ${tier}`,
      ...(origin === 1 ? { chapter: tier, unlock: 'part-cam' as const } : modernStageRelease(origin, tier)),
      since: origin === 1 ? 1 : 2,
      price: Math.round(section.price * Math.sqrt(powerCv / 150) * [1, 1.62, 2.42][tier - 1]! / 50) * 50,
      compat: { families: [family] },
      progression: { tier, group: section.category, specialization: 'rua' },
      description: section.description,
      physics: `${section.metric} +${Math.round((scale - 1) * 100)}%. O conjunto acrescenta ${mass.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg.`,
      mod,
    };
  }));
}

export const COOLING_PARTS: readonly ExpandedPart[] = [
  ...partsFor('legacy', 1, 90),
  ...([2, 3] as const).flatMap((origin) => {
    const cars = origin === 2 ? CHAPTER2_CARS : CHAPTER3_CARS;
    const families = new Map(cars.map((car) => [car.engine.family!, car.engine.ratedPowerCv]));
    return [...families].flatMap(([family, power]) => partsFor(family, origin, power));
  }),
];
