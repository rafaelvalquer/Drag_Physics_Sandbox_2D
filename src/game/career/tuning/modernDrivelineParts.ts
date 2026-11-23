import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import type { CarConfig, TransmissionKind } from '../../../data/schema';
import { modernStageRelease } from './modernStageRelease';
import type { PartTier } from './partProgression';
import type { PartDef } from './parts';

type DrivelinePart = Extract<PartDef, { category: 'clutch' | 'differential' | 'transmission-gearbox' | 'gearbox' | 'awd' | 'flywheel' }>;
type Hardware = {
  kind: TransmissionKind;
  stage: PartTier;
  family: string;
  awd: boolean;
};
type Series = { slug: string; label: string; cost: number };

const tiers = [1, 2, 3] as const;
const rate = (v: number) => Math.round(v * 100);
const stageValue = (tier: PartTier, values: readonly [number, number, number]): number => values[tier - 1]!;
// Benchmarks on the factory shift schedules: small loss changes can move a torque-converter shift.
const finalDriveEfficiency: Readonly<Record<string, readonly [number, number, number]>> = {
  'toyota-2gr-fse': [0.016, 0.019, 0.022],
  'alfa-690t': [0.006, 0.016, 0.017],
};

function partsAtStage(car: CarConfig, origin: 2 | 3, hardware: Hardware): DrivelinePart[] {
  const { kind, stage, family, awd } = hardware;
  const tierValue = (first: number, second: number, third: number) => stageValue(stage, [first, second, third]);
  const common = (system: Series) => ({
    id: `${system.slug}-${family}-s${stage}`,
    name: `${system.label} Stage ${stage}`,
    price: Math.round(system.cost * Math.sqrt(car.engine.ratedPowerCv / 170) * tierValue(1, 1.55, 2.2) / 50) * 50,
    since: 2 as const,
    ...modernStageRelease(origin, stage),
    compat: { families: [family], transmissions: [kind] },
    progression: { tier: stage, group: `modern-${system.slug}`, specialization: 'rua' as const },
  });
  const parts: DrivelinePart[] = [];
  if (kind === 'manual') {
    const strength = tierValue(1.12, 1.25, 1.4);
    parts.push({
      ...common({ slug: 'clutch', label: 'Embreagem reforçada', cost: 1050 }),
      category: 'clutch',
      capacityScale: strength,
      engageRateScale: tierValue(1.04, 1.08, 1.12),
      launchRpmAdd: 0,
      inputInertiaScale: tierValue(0.98, 0.95, 0.92),
      description: 'Material de atrito e platô dimensionados para o torque deste motor.',
      physics: `Capacidade da embreagem aumenta ${rate(strength - 1)}%. O disco mais leve reduz a inércia no eixo de entrada.`,
    });
    const spread = tierValue(0.96, 0.92, 0.88);
    const efficiency = tierValue(0.006, 0.012, 0.018);
    parts.push({
      ...common({ slug: 'manual-gearset', label: 'Engrenagens do câmbio manual', cost: 1350 }),
      category: 'transmission-gearbox',
      gearSpreadScale: spread,
      efficiencyAdd: efficiency,
      description: 'Engrenagens intermediárias com escalonamento selecionado para a curva do motor e rolamentos com menor perda.',
      physics: `O escalonamento é avaliado em torno da faixa proposta, com primeira e última marchas preservadas. A eficiência pode aumentar até ${(efficiency * 100).toLocaleString('pt-BR')} ponto percentual.`,
    });
    const inertia = tierValue(0.975, 0.95, 0.92);
    const mass = tierValue(1.5, 3.5, 5.5);
    parts.push({
      ...common({ slug: 'flywheel', label: 'Volante aliviado', cost: 590 }),
      category: 'flywheel',
      inertiaScale: inertia,
      massRemoveKg: mass,
      description: 'Volante manual com menor massa periférica.',
      physics: `Redução de ${mass.toLocaleString('pt-BR')} kg no conjunto e de ${((1 - inertia) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% na inércia efetiva do motor.`,
    });
  } else {
    const dualClutch = kind === 'dual-clutch';
    const strength = dualClutch ? tierValue(1.16, 1.31, 1.46) : tierValue(1.14, 1.27, 1.4);
    const shift = tierValue(0.92, 0.83, 0.74);
    const lockup = tierValue(1.12, 1.25, 1.4);
    parts.push({
      ...common({ slug: dualClutch ? 'dual-clutch' : 'automatic', label: dualClutch ? 'Pacotes de embreagem e TCU' : 'Conversor e TCU', cost: dualClutch ? 1950 : 1750 }),
      category: 'gearbox',
      capacityScale: strength,
      shiftTimeScale: shift,
      launchRpmAdd: 0,
      ...(dualClutch ? { efficiencyAdd: tierValue(0.004, 0.008, 0.012) } : { lockupScale: lockup }),
      description: dualClutch
        ? 'Pacotes de embreagem de maior capacidade e calibração da transição entre os dois eixos.'
        : 'Conversor com embreagem de travamento reforçada e recalibração das trocas.',
      physics: `Capacidade de torque aumenta ${rate(strength - 1)}%. As fases de troca duram até ${rate(1 - shift)}% menos.${dualClutch ? '' : ` O travamento do conversor suporta ${rate(lockup - 1)}% mais torque.`}`,
    });
  }
  const efficiency = stageValue(stage, finalDriveEfficiency[family] ?? [0.006, 0.012, 0.019]);
  parts.push({
    ...common({ slug: 'final-drive', label: 'Relação final e rolamentos', cost: 850 }),
    category: 'differential',
    finalDriveScale: tierValue(1.03, 1.06, 1.09),
    efficiencyAdd: efficiency,
    description: 'Coroa e pinhão selecionados para a arrancada com rolamentos de menor perda.',
    physics: `O modelo seleciona a relação final em função da aceleração do conjunto. Os rolamentos acrescentam até ${(efficiency * 100).toLocaleString('pt-BR')} ponto percentual de eficiência.`,
  });
  if (awd) {
    const coupling = tierValue(1.15, 1.3, 1.45);
    const efficiency = tierValue(0.008, 0.016, 0.024);
    const spec = common({ slug: 'awd-coupling', label: 'Acoplamento central AWD', cost: 1600 });
    parts.push({
      ...spec,
      compat: { ...spec.compat, drives: ['awd'] },
      category: 'awd',
      couplingScale: coupling,
      frontFractionDelta: 0,
      transferEfficiencyAdd: efficiency,
      description: 'Acoplamento de maior capacidade para sustentar a transferência de torque entre eixos.',
      physics: `A capacidade do acoplamento aumenta ${rate(coupling - 1)}%. A eficiência da caixa de transferência aumenta até ${(efficiency * 100).toLocaleString('pt-BR')} ponto percentual.`,
    });
  }
  return parts;
}

function chapterParts(cars: readonly CarConfig[], origin: 2 | 3): DrivelinePart[] {
  const configurations = new Map<string, CarConfig>();
  for (const car of cars) {
    const key = `${car.engine.family}|${car.transmission.kind ?? 'manual'}|${car.drivenAxle === 'awd'}`;
    if (!configurations.has(key)) configurations.set(key, car);
  }
  return [...configurations.values()].flatMap((car) => tiers.flatMap((stage) => partsAtStage(car, origin, {
    kind: car.transmission.kind ?? 'manual',
    stage,
    family: car.engine.family!,
    awd: car.drivenAxle === 'awd',
  })));
}

export const MODERN_DRIVELINE_PARTS = [...chapterParts(CHAPTER2_CARS, 2), ...chapterParts(CHAPTER3_CARS, 3)];
