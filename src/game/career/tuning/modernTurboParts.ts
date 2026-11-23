import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import { modernStageRelease } from './modernStageRelease';
import type { IntercoolerPart, TurboUpgradePart } from './parts';

interface TurboProfile {
  /** Stage 3 compressor flow increase relative to the original set. */
  flow: number;
  /** Stage 3 turbine pressure-drop recovery at reference flow. */
  recovery: number;
  /** Stage 3 increased exhaust flow required for full shaft speed. */
  spoolFlow: number;
}

const profiles: Readonly<Record<string, TurboProfile>> = {
  'psa-prince-thp': { flow: 0.44, recovery: 5.8, spoolFlow: 0.025 },
  'vw-ea113': { flow: 0.53, recovery: 6.7, spoolFlow: 0.035 },
  'bmw-n20': { flow: 0.48, recovery: 6.3, spoolFlow: 0.025 },
  'mb-m274': { flow: 0.46, recovery: 6.1, spoolFlow: 0.026 },
  'vw-ea888': { flow: 0.51, recovery: 6.6, spoolFlow: 0.028 },
  'mitsubishi-4b11': { flow: 0.56, recovery: 7.0, spoolFlow: 0.032 },
  'bmw-n55': { flow: 0.49, recovery: 6.5, spoolFlow: 0.024 },
  'mercedes-m276': { flow: 0.47, recovery: 6.2, spoolFlow: 0.024 },
  'kia-lambda33': { flow: 0.48, recovery: 6.4, spoolFlow: 0.025 },
  'maserati-f160': { flow: 0.49, recovery: 6.4, spoolFlow: 0.027 },
  'alfa-690t': { flow: 0.48, recovery: 6.1, spoolFlow: 0.015 },
  'nissan-vr38dett': { flow: 0.65, recovery: 7.5, spoolFlow: 0.033 },
};
const stages = [
  { tier: 1, name: 'Rotor e carcaça revisados', fraction: 0.28, spoolTime: 0.9, efficiency: 0.67, mass: 0.5, cost: 3250 },
  { tier: 2, name: 'Conjunto híbrido', fraction: 0.61, spoolTime: 0.85, efficiency: 0.7, mass: 2.1, cost: 6050 },
  { tier: 3, name: 'Conjunto de competição', fraction: 1, spoolTime: 0.79, efficiency: 0.73, mass: 4.2, cost: 9450 },
] as const;
const fmt = (value: number): string => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const chapters = [
  [2, CHAPTER2_CARS], [3, CHAPTER3_CARS],
] as const;
const applications = chapters.flatMap(([origin, cars]) => {
  const families = new Map(cars.filter((car) => car.engine.induction === 'turbo').map((car) => [car.engine.family!, car]));
  return [...families].map(([family, car]) => ({ origin, family, car }));
});

export const MODERN_TURBO_PARTS: readonly TurboUpgradePart[] = applications.flatMap(({ origin, family, car }) => {
  const profile = profiles[family];
  if (!profile) throw new Error(`Falta um perfil de turbina para ${family}`);
  const pair = car.engine.turbo?.layout === 'parallel-twin';
  return stages.map((stage): TurboUpgradePart => {
    const { tier, fraction } = stage;
    const flow = profile.flow * fraction;
    const reduction = profile.recovery * fraction;
    const spoolFlowScale = tier === 1 ? 0.985 : tier === 2 ? 1 : 1 + profile.spoolFlow;
    const name = family === 'nissan-vr38dett'
      ? (['Conjunto híbrido', 'Turbinas de maior diâmetro', 'Conjunto de competição'] as const)[tier - 1]
      : stage.name;
    return {
      id: `factory-turbo-${family}-s${tier}`,
      category: 'turbo',
      upgrade: true,
      name: `${name} ${pair ? 'biturbo ' : ''}Stage ${tier}`,
      ...modernStageRelease(origin, tier),
      since: 2,
      price: Math.round(stage.cost * Math.sqrt(car.engine.ratedPowerCv / 220) * (pair ? 1.18 : 1) / 50) * 50,
      compat: { families: [family], induction: 'turbo' },
      progression: { tier, group: 'modern-factory-turbo', specialization: 'turbo' },
      factoryTurboStage: tier,
      description: pair ? 'Par casado de turbinas, uma em cada bancada.' : 'Rotor e carcaça dimensionados para o fluxo deste motor.',
      physics: `Vazão máxima +${fmt(flow * 100)}%, eficiência do compressor de ${fmt(stage.efficiency * 100)}% e redução de ${fmt(reduction)} kPa na contrapressão de referência.`,
      flowScale: 1 + flow,
      backPressureReductionKPa: reduction,
      spoolFlowScale,
      spoolTimeScale: stage.spoolTime,
      compressorEfficiency: stage.efficiency,
      compressorBlades: tier === 1 ? car.engine.turbo!.compressorBlades : tier === 2 ? 7 : 8,
      massAddKg: stage.mass * (pair ? 2 : 1),
    };
  });
});

export const MODERN_INTERCOOLER_PARTS: readonly IntercoolerPart[] = applications.flatMap(({ origin, family, car }) => {
  const pair = car.engine.turbo?.layout === 'parallel-twin';
  return stages.map(({ tier }): IntercoolerPart => {
    const effectiveness = [0.69, 0.8, 0.86][tier - 1]!;
    const volumeAddL = [0.55, 1.15, 1.85][tier - 1]! * (pair ? 1.4 : 1);
    return {
      id: `charge-cooler-${family}-s${tier}`,
      category: 'intercooler',
      name: `Intercooler Stage ${tier}`,
      ...modernStageRelease(origin, tier),
      since: 2,
      price: Math.round([1250, 2150, 3400][tier - 1]! * (pair ? 1.2 : 1) * Math.sqrt(car.engine.ratedPowerCv / 220) / 50) * 50,
      compat: { families: [family], induction: 'turbo' },
      progression: { tier, group: 'modern-intercooler', specialization: 'turbo' },
      description: 'Colmeia e tubulação dimensionadas para resfriar a carga sob pressão.',
      physics: `Remove ${fmt(effectiveness * 100)}% do aquecimento do compressor. O circuito acrescenta ${fmt(volumeAddL)} L ao volume dos dutos.`,
      effectiveness,
      volumeAddL,
      massAddKg: [1.5, 3.1, 4.8][tier - 1]! * (pair ? 1.3 : 1),
    };
  });
});
