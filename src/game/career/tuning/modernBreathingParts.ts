import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import type { CarConfig } from '../../../data/schema';
import { modernStageRelease } from './modernStageRelease';
import type { PartTier } from './partProgression';
import type { ExpandedPart, MechanicalMods } from './parts';

const tiers = [1, 2, 3] as const;
const number = (value: number): string => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const pct = (scale: number): string => number(Math.abs(scale - 1) * 100);

interface BreathingSpec {
  slot: ExpandedPart['category'];
  name: string;
  description: string;
  basePrice: number;
  changes(car: CarConfig, tier: PartTier): { mod: MechanicalMods; physics: string };
}

// Estimates for workshop hardware. Restriction changes are specified per section at reference flow.
const specs: BreathingSpec[] = [
  {
    slot: 'intake-airbox',
    name: 'Caixa de ar',
    description: 'Entrada e tomada de ar dimensionadas para a vazão do motor.',
    basePrice: 470,
    changes(car, tier) {
      const drop = (car.engine.breathing?.airFilterDropKPa ?? 3) * tiersValue(tier, 0.15, 0.27, 0.4);
      const volume = tiersValue(tier, 1.08, 1.16, 1.24);
      return { mod: { filterDropReductionKPa: drop, airboxVolumeScale: volume }, physics: `Perda de carga diminui até ${number(drop)} kPa no fluxo nominal. O volume da caixa aumenta ${pct(volume)}%.` };
    },
  },
  {
    slot: 'intake-throttle',
    name: 'Corpo de borboleta',
    description: 'Atuação mais rápida, com abertura ampliada conforme o estágio e o motor.',
    basePrice: 690,
    changes(car, tier) {
      const lexusStreet = car.engine.family === 'toyota-2gr-fse' && tier === 1;
      // Small bore changes at the 2GR converter's launch point made this stage slower.
      const bore = lexusStreet ? 0 : Math.round(car.engine.throttle.bodyDiameterMm * tiersValue(tier, 0.03, 0.06, 0.09));
      const response = tiersValue(tier, lexusStreet ? 0.92 : 0.94, 0.87, 0.8);
      const geometry = bore ? `Diâmetro aumenta ${bore} mm.` : 'Diâmetro da peça original.';
      return { mod: { throttleDiameterAddMm: bore, throttleResponseScale: response }, physics: `${geometry} O tempo de resposta da borboleta diminui ${pct(response)}%.` };
    },
  },
  {
    slot: 'exhaust-header',
    name: 'Coletor de escape',
    description: 'Primários de maior seção, mantendo as bancadas e saídas do motor.',
    basePrice: 850,
    changes(car, tier) {
      const drop = sectionDrop(car, tier, 0.08);
      const bore = tiersValue(tier, 1.04, 1.08, 1.12);
      return { mod: { backPressureReductionKPa: drop, headerDiameterScale: bore }, physics: `Primários até ${pct(bore)}% mais largos. A queda de pressão diminui ${number(drop)} kPa no fluxo nominal.` };
    },
  },
  {
    slot: 'exhaust-pipe',
    name: 'Tubulação de escape',
    description: 'Linha de escape mais larga e com transições suaves.',
    basePrice: 730,
    changes(car, tier) {
      const drop = sectionDrop(car, tier, 0.07);
      const bore = tiersValue(tier, 1.05, 1.1, 1.16);
      return { mod: { backPressureReductionKPa: drop, exhaustDiameterScale: bore }, physics: `Linha até ${pct(bore)}% mais larga. A queda de pressão diminui ${number(drop)} kPa no fluxo nominal.` };
    },
  },
  {
    slot: 'exhaust-muffler',
    name: 'Abafador de fluxo direto',
    description: 'Menos restrição no silenciador, com maior presença sonora.',
    basePrice: 610,
    changes(car, tier) {
      const drop = sectionDrop(car, tier, 0.065);
      const absorption = tiersValue(tier, 0.88, 0.76, 0.64);
      return { mod: { backPressureReductionKPa: drop, exhaustAbsorptionScale: absorption }, physics: `A absorção sonora diminui ${pct(absorption)}%. A queda de pressão diminui ${number(drop)} kPa no fluxo nominal.` };
    },
  },
];

function tiersValue(tier: PartTier, first: number, second: number, third: number): number {
  return tier === 1 ? first : tier === 2 ? second : third;
}

function sectionDrop(car: CarConfig, tier: PartTier, budget: number): number {
  return (car.engine.breathing?.exhaustBackPressureKPa ?? 18) * budget * tiersValue(tier, 1, 1.75, 2.5);
}

function forChapter(cars: readonly CarConfig[], origin: 2 | 3): ExpandedPart[] {
  const families = new Map<string, CarConfig>();
  for (const car of cars) {
    const family = car.engine.family;
    if (!family) throw new Error(`Família ausente no carro moderno ${car.id}`);
    if (!families.has(family)) families.set(family, car);
  }
  return [...families].flatMap(([family, car]) => specs.flatMap((spec) => tiers.map((tier): ExpandedPart => ({
    id: `${spec.slot}-${family}-s${tier}`,
    category: spec.slot,
    name: `${spec.name} Stage ${tier}`,
    ...modernStageRelease(origin, tier),
    price: Math.round(spec.basePrice * Math.sqrt(car.engine.ratedPowerCv / 170) * tiersValue(tier, 1, 1.65, 2.5) / 50) * 50,
    since: 2,
    modernBreathing: true,
    compat: { families: [family] },
    progression: { tier, group: `modern-${spec.slot}`, specialization: 'rua' },
    description: spec.description,
    ...spec.changes(car, tier),
  }))));
}

export const MODERN_BREATHING_PARTS = [...forChapter(CHAPTER2_CARS, 2), ...forChapter(CHAPTER3_CARS, 3)];
