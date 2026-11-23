import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import { modernStageRelease } from './modernStageRelease';
import type { EcuPart } from './parts';

interface MapProfile {
  /** Peak Stage 3 ignition efficiency correction. */
  advance: number;
  /** Stage 3 boost increase or zero for naturally aspirated engines. */
  boost: number;
  /** Stage 3 target increase in cutoff speed. */
  redline: number;
}

// Simulation calibrations. The physical limit of the fitted hardware remains authoritative.
const maps: Readonly<Record<string, MapProfile>> = {
  'gm-familia2': { advance: 0.04, boost: 0, redline: 300 },
  'honda-k20': { advance: 0.033, boost: 0, redline: 300 },
  'nissan-vq35de': { advance: 0.036, boost: 0, redline: 300 },
  'toyota-2gr-fse': { advance: 0.002, boost: 0, redline: 160 },
  'nissan-vq37vhr': { advance: 0.03, boost: 0, redline: 260 },
  'psa-prince-thp': { advance: 0.035, boost: 0.32, redline: 120 },
  'vw-ea113': { advance: 0.04, boost: 0.35, redline: 220 },
  'bmw-n20': { advance: 0.036, boost: 0.35, redline: 150 },
  'mb-m274': { advance: 0.034, boost: 0.34, redline: 140 },
  'vw-ea888': { advance: 0.039, boost: 0.35, redline: 180 },
  'mitsubishi-4b11': { advance: 0.039, boost: 0.34, redline: 220 },
  'bmw-n55': { advance: 0.033, boost: 0.32, redline: 150 },
  'mercedes-m276': { advance: 0.033, boost: 0.32, redline: 130 },
  'kia-lambda33': { advance: 0.034, boost: 0.32, redline: 150 },
  'maserati-f160': { advance: 0.034, boost: 0.31, redline: 170 },
  'alfa-690t': { advance: 0.03, boost: 0.3, redline: 140 },
  'nissan-vr38dett': { advance: 0.037, boost: 0.35, redline: 220 },
};
const stages = [
  { tier: 1, level: 'stage1', label: 'Rua', fraction: 0.32, cost: 1950 },
  { tier: 2, level: 'stage2', label: 'Esportivo', fraction: 0.65, cost: 3500 },
  { tier: 3, level: 'stage3', label: 'Competição', fraction: 1, cost: 5350 },
] as const;
const fmt = (value: number): string => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** Pressure the Competition map adds to the factory target (bar). */
const STAGE3_BOOST_ADD_BAR = 0.8;

export const MODERN_ECU_PARTS: readonly EcuPart[] = ([2, 3] as const).flatMap((origin) => {
  const cars = origin === 2 ? CHAPTER2_CARS : CHAPTER3_CARS;
  const unique = new Map(cars.map((car) => [car.engine.family!, car]));
  return [...unique].flatMap(([family, car]) => {
    const profile = maps[family];
    if (!profile) throw new Error(`Falta um mapa de ECU para ${family}`);
    const turbo = car.engine.induction === 'turbo';
    return stages.map((stage): EcuPart => {
      const { tier, fraction } = stage;
      // Competition (tier 3, turbo) reaches the level of the old generic Stage 3 map: +0.8 bar over the factory target
      const competitionTurbo = turbo && tier === 3;
      const boostAddBar = competitionTurbo ? STAGE3_BOOST_ADD_BAR : Math.round(profile.boost * fraction * 100) / 100;
      const ignitionGain = Math.round(profile.advance * fraction * 10000) / 10000;
      const revLimitAddRpm = tier === 1 ? 0 : Math.round(profile.redline * fraction / 10) * 10;
      const fuelTargetScale = (turbo ? [0.994, 0.982, 0.97] : [0.996, 0.99, 0.983])[tier - 1]!;
      const pressure = turbo ? ` A pressão alvo sobe ${fmt(boostAddBar)} bar.` : '';
      return {
        id: `ecu-map-${family}-s${tier}`,
        category: 'ecu',
        level: stage.level,
        name: `Remap ${stage.label} Stage ${tier}`,
        ...modernStageRelease(origin, tier),
        since: 2,
        price: Math.round(stage.cost * Math.sqrt(car.engine.ratedPowerCv / 190) / 50) * 50,
        compat: { families: [family], induction: car.engine.induction },
        progression: { tier, group: turbo ? 'modern-turbo-ecu' : 'modern-na-ecu-map', specialization: turbo ? 'turbo' : 'aspirado' },
        description: turbo
          ? 'Mapa de ignição, mistura, pressão e limite de torque da família.'
          : 'Mapa aspirado de ignição e mistura em plena carga, com corte adequado ao trem de válvulas.',
        physics: `Mistura em plena carga ${fmt((1 - fuelTargetScale) * 100)}% mais rica. Ajuste de ignição de ${fmt(ignitionGain * 100)}% no trabalho indicado. Até ${revLimitAddRpm} rpm a mais de corte onde o trem de válvulas permite.${pressure}`,
        boostAddBar,
        torqueLimitFraction: (turbo ? [0.9, 0.95, 1] : [0.94, 0.97, 1])[tier - 1]!,
        ignitionGain,
        revLimitAddRpm,
        fuelTargetScale,
        ...(turbo ? {
          // pressure the player may set on the dyno, relative to the factory target: grows with the stage
          boostRangeAddBar: ([[0.05, 0.25], [0.05, 0.5], [0.1, 0.8]] as const)[tier - 1] as [number, number],
          // the Competition map has no gain cap of its own: the internals, wastegate and fuel limits decide
          ...(competitionTurbo ? {} : { stockTorqueGainMax: [1.17, 1.29, 1.4][tier - 1]! }),
          ...(tier === 2 ? { minFuelCapacityScale: 1.15 } : {}),
          ...(tier === 3
            ? {
                minFuelCapacityScale: 1.32,
                minIntercoolerEffectiveness: 0.8,
                minInternalsTorqueScale: 1.45,
                minTurboFlowScale: 1.4,
                wastegateHeadroomBar: 0.9,
                requiresParts: [{ ids: ['downpipe-catless', `exhaust-downpipe-${family}-s2`, `exhaust-downpipe-${family}-s3`], label: 'o downpipe sem catalisador' }],
              }
            : {}),
        } : {}),
      };
    });
  });
});
