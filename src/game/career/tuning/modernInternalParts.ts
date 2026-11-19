import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import type { CarConfig } from '../../../data/schema';
import { modernStageRelease } from './modernStageRelease';
import type { CompressionPart, PistonPart, ValveSpringPart } from './parts';

// Chamber targets depend on knock margin and factory compression, not on displacement alone.
const naCompressionIncreases: Readonly<Record<string, readonly [number, number, number]>> = {
  'gm-familia2': [0.25, 0.55, 0.85],
  'honda-k20': [0.22, 0.48, 0.75],
  'nissan-vq35de': [0.25, 0.52, 0.8],
  'toyota-2gr-fse': [0.01, 0.04, 0.064],
  'nissan-vq37vhr': [0.2, 0.44, 0.68],
};

const internals = [
  { tier: 1, name: 'Conjunto alternado balanceado', inertiaScale: 0.975, frictionScale: 0.99, enduranceScale: 1.15 },
  { tier: 2, name: 'Pistões e bielas reforçados', inertiaScale: 0.945, frictionScale: 0.975, enduranceScale: 1.35 },
  { tier: 3, name: 'Conjunto forjado de competição', inertiaScale: 0.91, frictionScale: 0.96, enduranceScale: 1.6 },
] as const;
const format = (value: number): string => value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

type InternalPart = PistonPart | CompressionPart | ValveSpringPart;

function forFamily(car: CarConfig, origin: 2 | 3, family: string): InternalPart[] {
  const { induction, revLimitRpm, ratedPowerCv } = car.engine;
  const turbo = induction === 'turbo';
  const increases = naCompressionIncreases[family];
  const price = (base: number, multiplier: number): number =>
    Math.round(base * Math.sqrt(ratedPowerCv / 170) * multiplier / 50) * 50;
  const compat = { families: [family], induction };
  return internals.flatMap((stage): InternalPart[] => {
    const { tier, name, enduranceScale } = stage;
    // Keep the 2GR on the same automatic launch behavior measured with the original car.
    const lexus = family === 'toyota-2gr-fse';
    const inertiaScale = lexus ? [0.999, 0.997, 0.99][tier - 1]! : stage.inertiaScale;
    const frictionScale = lexus ? [0.999, 0.997, 0.995][tier - 1]! : stage.frictionScale;
    const release = modernStageRelease(origin, tier);
    const torqueLimitScale = turbo ? [1.12, 1.3, 1.48][tier - 1]! : [1.1, 1.2, 1.35][tier - 1]!;
    const safeRpmReserve = Math.round(revLimitRpm * 0.018 * tier / 10) * 10;
    const piston: PistonPart = {
      id: `rotating-assembly-${family}-s${tier}`,
      category: 'pistons',
      name: `${name} Stage ${tier}`,
      ...release,
      price: price(2700, [1, 1.65, 2.7][tier - 1]!),
      since: 2,
      compat,
      progression: { tier, group: 'modern-rotating-assembly', specialization: 'rua' },
      description: 'Pistões, bielas e anéis calibrados como conjunto para este motor, com a taxa de fábrica.',
      physics: `Capacidade de torque +${format((torqueLimitScale - 1) * 100)}%, inércia −${format((1 - inertiaScale) * 100)}% e reserva mecânica de ${safeRpmReserve} rpm.`,
      compressionAdd: 0,
      torqueLimitScale,
      revLimitAddRpm: 0,
      safeRpmReserve,
      enduranceScale,
      inertiaScale,
      frictionScale,
    };
    const safeRpmAdd = Math.round(revLimitRpm * 0.027 * tier / 10) * 10;
    const spring: ValveSpringPart = {
      id: `valve-springs-${family}-s${tier}`,
      category: 'engine-valvetrain',
      name: `Molas e pratos Stage ${tier}`,
      ...release,
      price: price(620, [1, 1.65, 2.5][tier - 1]!),
      since: 2,
      compat,
      progression: { tier, group: 'modern-valve-springs', specialization: 'rua' },
      description: 'Molas e pratos dimensionados para evitar a flutuação das válvulas em alta rotação.',
      physics: `A reserva mecânica sobe ${safeRpmAdd} rpm. A ECU continua definindo o corte.`,
      safeRpmAdd,
    };
    if (!increases) return [piston, spring];
    const compressionAdd = increases[tier - 1];
    const compression: CompressionPart = {
      id: `compression-chamber-${family}-s${tier}`,
      category: 'engine-compression',
      name: `Câmara de alta compressão Stage ${tier}`,
      ...release,
      price: price(980, [1, 1.65, 2.5][tier - 1]!),
      since: 2,
      compat,
      progression: { tier, group: 'modern-na-compression', specialization: 'aspirado' },
      description: 'Câmaras usinadas com volume aferido para a taxa desejada em motor aspirado.',
      physics: `Taxa de compressão +${format(compressionAdd)}:1. A eficiência térmica é calculada para a nova taxa.`,
      compressionAdd,
    };
    return [piston, spring, compression];
  });
}

export const MODERN_INTERNAL_PARTS = ([2, 3] as const).flatMap((origin) => {
  const cars = origin === 2 ? CHAPTER2_CARS : CHAPTER3_CARS;
  const families = new Map(cars.map((car) => [car.engine.family!, car]));
  return [...families].flatMap(([family, car]) => forFamily(car, origin, family));
});
