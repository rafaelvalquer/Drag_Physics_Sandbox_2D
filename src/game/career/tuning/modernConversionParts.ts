import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import { modernStageRelease } from './modernStageRelease';
import type { CompressionPart, ExpandedPart, TurboPart } from './parts';

interface ConversionProfile {
  pressure: readonly [number, number, number];
  spool: number;
  chargeVolumeL: number;
  compression: number;
}

// Turbo sizing and compression targets are estimates for these workshop builds.
const profiles: Readonly<Record<string, ConversionProfile>> = {
  'gm-familia2': { pressure: [0.35, 0.5, 0.65], spool: 0.48, chargeVolumeL: 2, compression: 10.1 },
  'honda-k20': { pressure: [0.32, 0.45, 0.58], spool: 0.52, chargeVolumeL: 2.3, compression: 10 },
  'nissan-vq35de': { pressure: [0.3, 0.44, 0.57], spool: 0.55, chargeVolumeL: 2.8, compression: 10 },
  'nissan-vq37vhr': { pressure: [0.29, 0.42, 0.55], spool: 0.58, chargeVolumeL: 3, compression: 9.9 },
};
const tiers = [1, 2, 3] as const;
const fuelCapacity = [1.32, 1.44, 1.58] as const;
const fmt = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function conversionFuelCapacity(family: string, tier: 1 | 2 | 3): number | undefined {
  return profiles[family] ? fuelCapacity[tier - 1] : undefined;
}

export const MODERN_CONVERSION_PARTS = ([2, 3] as const).flatMap((chapter) => {
  const cars = chapter === 2 ? CHAPTER2_CARS : CHAPTER3_CARS;
  return cars.flatMap((car): (TurboPart | CompressionPart | ExpandedPart)[] => {
    const family = car.engine.family!;
    const profile = profiles[family];
    if (!profile) return [];
    const compat = { families: [family], induction: 'NA' as const };
    const price = (base: number) => Math.round(base * Math.sqrt(car.engine.ratedPowerCv / 170) / 50) * 50;
    const compressionAdd = Math.round((profile.compression - car.engine.compressionRatio) * 100) / 100;
    const oil: ExpandedPart = {
      id: `conversion-oil-${family}`,
      category: 'cooling-oil',
      name: 'Circuito de óleo para conversão',
      ...modernStageRelease(chapter, 1),
      price: price(1350),
      since: 2,
      compat,
      description: 'Radiador de óleo com linhas e adaptadores calibrados para a família do motor.',
      physics: 'Reduz em 3,5% o torque de atrito interno estimado na faixa de trabalho.',
      mod: { coolingFrictionScale: 0.965 },
    };
    const chamber: CompressionPart = {
      id: `conversion-compression-${family}`,
      category: 'engine-compression',
      name: 'Câmara para conversão turbo',
      ...modernStageRelease(chapter, 1),
      price: price(1350),
      since: 2,
      compat,
      description: 'Câmara de maior volume usinada para a taxa prevista na conversão sobrealimentada.',
      physics: `A taxa passa para ${fmt(profile.compression)}:1 com os pistões originais. A taxa mais baixa abre margem de detonação sob pressão.`,
      compressionAdd,
      conversionPreparation: true,
    };
    const kits = tiers.map((tier): TurboPart => {
      const pressure = profile.pressure[tier - 1];
      const intercoolerEffectiveness = [0.62, 0.69, 0.76][tier - 1]!;
      const spoolTimeS = profile.spool * [1, 1.13, 1.28][tier - 1]!;
      return {
        id: `conversion-turbo-${family}-s${tier}`,
        category: 'turbo',
        name: `Conversão turbo Stage ${tier}`,
        ...modernStageRelease(chapter, tier),
        price: price([4800, 7250, 10500][tier - 1]!),
        since: 2,
        compat,
        progression: { tier, group: 'modern-na-turbo-conversion', specialization: 'turbo' },
        description: 'Kit completo de turbocompressor, coletor, intercooler, gerenciamento da pressão e alimentação e retorno de óleo.',
        physics: `Alvo de ${fmt(pressure)} bar com intercooler de ${fmt(intercoolerEffectiveness * 100)}% e resposta do rotor de ${fmt(spoolTimeS)} s. A oficina confere taxa, alimentação, ignição, óleo e capacidade de torque dos internos e da transmissão.`,
        turbo: {
          maxBoostBar: pressure,
          spoolTimeS,
          fullBoostFlowFraction: [0.68, 0.74, 0.8][tier - 1]!,
          maxShaftRpm: [177000, 164000, 151000][tier - 1]!,
          compressorBlades: tier === 3 ? 7 : 6,
          bovEnabled: true,
          bovVentTimeS: 0.14,
        },
        chargePipeVolumeL: profile.chargeVolumeL + (tier - 1) * 0.3,
        knockLossPerBarPetrol: 0.078,
        knockLossPerBarEthanol: 0.023,
        boostRangeBar: [Math.max(0.15, pressure - 0.15), pressure],
        massAddKg: (car.engine.architecture === 'V6' ? 23 : 18) + (tier - 1) * 3,
        intercoolerEffectiveness,
        conversion: {
          maxCompressionRatio: profile.compression + 0.05,
          minFuelCapacityScale: fuelCapacity[tier - 1],
          minInternalsTorqueScale: [1.1, 1.2, 1.35][tier - 1]!,
          minIgnitionTier: tier,
        },
      };
    });
    return [...(compressionAdd < 0 ? [chamber] : []), oil, ...kits];
  });
});
