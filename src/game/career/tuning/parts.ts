import type { TurboConfig } from '../../../data/schema';

/**
 * Career parts. Each part is a discriminated union member by `category` and carries the PHYSICAL
 * change it makes — never a "+x % power" multiplier. The build resolver turns these hardware
 * changes into a new engine/driveline configuration (see BuildResolver.ts and breathingModel.ts).
 *
 * One slot per category: installing a part of an occupied category replaces the previous one
 * (e.g. semi-slick tyres replace sport tyres; nothing stacks).
 */
import { EXPANDED_PARTS } from './expandedParts';

export type PartCategory =
  | 'intake-filter' | 'intake-manifold' | 'intake-throttle' | 'intake-airbox'
  | 'camshaft' | 'engine-head' | 'engine-compression' | 'engine-internals' | 'engine-flywheel'
  | 'exhaust' | 'exhaust-header' | 'exhaust-pipe' | 'exhaust-muffler'
  | 'clutch' | 'differential' | 'transmission-gearbox'
  | 'tires' | 'tires-width' | 'tires-pressure'
  | 'turbo' | 'turbo-turbine' | 'turbo-intercooler' | 'turbo-wastegate' | 'turbo-boost'
  | 'electronics-ecu' | 'electronics-fuel' | 'electronics-ignition'
  | 'cooling-radiator' | 'cooling-oil' | 'cooling-fan'
  | 'chassis-weight' | 'chassis-suspension';

export interface WorkshopTab {
  id: string;
  label: string;
  icon: string;
  description: string;
  categories: PartCategory[];
}
export const WORKSHOP_TABS: readonly WorkshopTab[] = [
  { id: 'engine', label: 'Motor', icon: '⚙', description: 'Comando, cabeçote, taxa e internos', categories: ['camshaft', 'engine-head', 'engine-compression', 'engine-internals', 'engine-flywheel'] },
  { id: 'intake', label: 'Admissão', icon: '◉', description: 'Ar limpo, dutos e resposta', categories: ['intake-filter', 'intake-manifold', 'intake-throttle', 'intake-airbox'] },
  { id: 'exhaust', label: 'Escape', icon: '≋', description: 'Contrapressão e acústica', categories: ['exhaust', 'exhaust-header', 'exhaust-pipe', 'exhaust-muffler'] },
  { id: 'transmission', label: 'Transmissão', icon: '⌁', description: 'Relações e embreagem', categories: ['clutch', 'transmission-gearbox', 'differential'] },
  { id: 'tires', label: 'Pneus', icon: '◎', description: 'Composto, largura e pressão', categories: ['tires', 'tires-width', 'tires-pressure'] },
  { id: 'turbo', label: 'Turbo', icon: '◌', description: 'Pressão, spool e temperatura', categories: ['turbo', 'turbo-turbine', 'turbo-intercooler', 'turbo-wastegate', 'turbo-boost'] },
  { id: 'electronics', label: 'Eletrônica', icon: '⌘', description: 'ECU, combustível e ignição', categories: ['electronics-ecu', 'electronics-fuel', 'electronics-ignition'] },
  { id: 'cooling', label: 'Arrefecimento', icon: '❄', description: 'Gerenciamento térmico', categories: ['cooling-radiator', 'cooling-oil', 'cooling-fan'] },
  { id: 'chassis', label: 'Estrutura', icon: '◇', description: 'Massa e geometria', categories: ['chassis-weight', 'chassis-suspension'] },
];
export const CATEGORY_ORDER: readonly PartCategory[] = WORKSHOP_TABS.flatMap((t) => t.categories);
export const CATEGORY_LABEL: Record<PartCategory, string> = {
  'intake-filter': 'Filtro de ar', 'intake-manifold': 'Coletor de admissão',
  'intake-throttle': 'Corpo de borboleta', 'intake-airbox': 'Caixa de ar',
  camshaft: 'Comando de válvulas', 'engine-head': 'Cabeçote', 'engine-compression': 'Taxa de compressão',
  'engine-internals': 'Internos do motor', 'engine-flywheel': 'Volante do motor',
  exhaust: 'Escape completo', 'exhaust-header': 'Coletor de escape',
  'exhaust-pipe': 'Tubulação de escape', 'exhaust-muffler': 'Abafador',
  clutch: 'Embreagem', differential: 'Relação final', 'transmission-gearbox': 'Câmbio',
  tires: 'Composto', 'tires-width': 'Largura', 'tires-pressure': 'Pressão e setup',
  turbo: 'Kit turbo', 'turbo-turbine': 'Turbina', 'turbo-intercooler': 'Intercooler',
  'turbo-wastegate': 'Wastegate', 'turbo-boost': 'Pressão de turbo',
  'electronics-ecu': 'ECU', 'electronics-fuel': 'Combustível', 'electronics-ignition': 'Ignição',
  'cooling-radiator': 'Radiador', 'cooling-oil': 'Óleo', 'cooling-fan': 'Ventoinha',
  'chassis-weight': 'Alívio de peso', 'chassis-suspension': 'Suspensão',
};
export const CATEGORY_DESCRIPTION: Record<PartCategory, string> = {
  'intake-filter': 'Restrição do filtro de ar em alta vazão.', 'intake-manifold': 'Comprimento e área dos dutos de admissão.',
  'intake-throttle': 'Diâmetro e tempo de abertura da borboleta.', 'intake-airbox': 'Volume e perda de carga da caixa de ar.',
  camshaft: 'Abertura, levantamento e cruzamento de válvulas.', 'engine-head': 'Fluxo nos dutos e sedes.',
  'engine-compression': 'Rendimento e limite para sobrealimentação.', 'engine-internals': 'Resistência mecânica do conjunto.',
  'engine-flywheel': 'Inércia rotacional e resposta do motor.',
  exhaust: 'Geometria global e contrapressão.', 'exhaust-header': 'Primários e coleta dos gases.',
  'exhaust-pipe': 'Diâmetro e restrição da linha.', 'exhaust-muffler': 'Silenciamento versus fluxo.',
  clutch: 'Capacidade de torque e engate.', differential: 'Multiplicação final da transmissão.',
  'transmission-gearbox': 'Escalonamento e recuperação de giro.',
  tires: 'Aderência e janela térmica.', 'tires-width': 'Área de contato e inércia.', 'tires-pressure': 'Rigidez e sensibilidade térmica.',
  turbo: 'Conjunto de sobrealimentação.', 'turbo-turbine': 'Compromisso entre spool e vazão.',
  'turbo-intercooler': 'Temperatura da carga comprimida.', 'turbo-wastegate': 'Limites de controle de pressão.',
  'turbo-boost': 'Pressão-alvo da wastegate.',
  'electronics-ecu': 'Estratégia de combustão e proteção.', 'electronics-fuel': 'Capacidade de alimentação sob boost.',
  'electronics-ignition': 'Estabilidade e atraso de centelha.',
  'cooling-radiator': 'Troca térmica do circuito.', 'cooling-oil': 'Atrito e temperatura do óleo.',
  'cooling-fan': 'Demanda parasita de refrigeração.',
  'chassis-weight': 'Massa total e inércia longitudinal.', 'chassis-suspension': 'Centro de gravidade e transferência de carga.',
};

/** Numeric mechanical changes use SI units or the documented suffix (Bar, KPa, Mm, Rpm).
 * Values are applied to hardware / operating conditions, never to advertised horsepower. */
export interface MechanicalMods {
  [key: string]: number | undefined;
  filterDropKPa?: number; filterDropReductionKPa?: number; airboxVolumeScale?: number;
  runnerLengthScale?: number; runnerDiameterAddMm?: number; plenumScale?: number;
  throttleDiameterAddMm?: number; throttleResponseScale?: number;
  camIvoDeltaDeg?: number; camIvcDeltaDeg?: number; camEvoDeltaDeg?: number;
  camEvcDeltaDeg?: number; camLiftAddMm?: number; revLimitAddRpm?: number;
  headFlowScale?: number; compressionRatioDelta?: number;
  internalTorqueLimitNm?: number; flywheelInertiaScale?: number;
  backPressureKPa?: number; backPressureReductionKPa?: number;
  headerDiameterScale?: number; exhaustDiameterScale?: number; exhaustAbsorptionScale?: number;
  clutchCapacityScale?: number; clutchEngageRateScale?: number; clutchLaunchAddRpm?: number;
  finalDriveScale?: number; gearSpreadScale?: number;
  tireMuScale?: number; tireInertiaAddKgM2?: number; tireOptimalTempC?: number;
  tireTempSensitivity?: number; tireStiffnessScale?: number; tireTempSensitivityScale?: number;
  turboBoostBar?: number; turboSpoolScale?: number; turboFlowScale?: number;
  turboMassAddKg?: number; intercoolerEffectiveness?: number;
  intercoolerEffectivenessAdd?: number; intercoolerMassAddKg?: number;
  wastegateRangeAddBar?: number; boostTargetBar?: number; fuelBoostLimitBar?: number;
  knockRetardScale?: number; burnDurationScale?: number;
  coolingFrictionScale?: number; coolingKnockScale?: number;
  massRemoveKg?: number; cgHeightDeltaM?: number;
}

interface PartBase {
  id: string;
  name: string;
  price: number;
  /** Career unlock that makes the part available in the shop. */
  unlock: UnlockId;
  description: string;
  /** What the part physically changes (shown in the workshop). */
  physics: string;
}

export interface FilterPart extends PartBase {
  category: 'intake-filter';
  /** Air filter + airbox pressure drop at the engine's reference flow (kPa). */
  airFilterDropKPa: number;
  intakeGainDelta: number;
}

export interface ExhaustPart extends PartBase {
  category: 'exhaust';
  /** Back pressure at the reference flow (kPa). */
  backPressureKPa: number;
  /** Acoustic geometry preset of the new system (lengths, diameters, chambers). */
  acousticPreset: 'sport';
  /** Diameter scale of the primaries (header). */
  headerDiameterScale: number;
}

export interface ManifoldPart extends PartBase {
  category: 'intake-manifold';
  runnerLengthScale: number;
  runnerDiameterAddMm: number;
  plenumScale: number;
}

export interface CamPart extends PartBase {
  category: 'camshaft';
  /** Valve event changes in crank degrees (later = positive). */
  ivoDeltaDeg: number;
  ivcDeltaDeg: number;
  evoDeltaDeg: number;
  evcDeltaDeg: number;
  liftAddMm: number;
  /** Valve-train limit gained with the stiffer springs of the kit. */
  revLimitAddRpm: number;
}

export interface TurboPart extends PartBase {
  category: 'turbo';
  turbo: TurboConfig;
  /** Throttle/charge-pipe response of the pressurised carburettor/TBI (s). */
  chargePipeVolumeL: number;
  /** Ignition retard needed against knock: fraction of indicated torque lost per bar of boost
   *  and per compression-ratio point above 7:1 (estimated; ethanol's octane and charge cooling
   *  make it far less knock-prone than petrol). */
  knockLossPerBarPetrol: number;
  knockLossPerBarEthanol: number;
  /** Wastegate range the engine tuners can set on the dyno (bar). */
  boostRangeBar: [number, number];
  /** Mass of the kit: turbine, cast manifold, intercooler and piping (kg). */
  massAddKg: number;
  /** Intercooler effectiveness (fraction of the compressor temperature rise removed). */
  intercoolerEffectiveness: number;
}

export interface ClutchPart extends PartBase {
  category: 'clutch';
  capacityScale: number;
  engageRateScale: number;
  launchRpmAdd: number;
}

export interface DifferentialPart extends PartBase {
  category: 'differential';
  /** Shorter crown-and-pinion: multiplies the final drive. */
  finalDriveScale: number;
}

export interface TirePart extends PartBase {
  category: 'tires';
  grade: 'sport' | 'semiSlick';
  muPeak: number;
  B: number;
  C: number;
  E: number;
  wheelInertiaAddKgM2: number;
  rollingResistanceAdd: number;
  optimalTempC: number;
  tempSensitivityPerC: number;
}

export interface ExpandedPart extends PartBase {
  category: PartCategory;
  chapter: 1 | 2 | 3;
  mod: MechanicalMods;
  /** This part is only meaningful with a turbo kit already installed. */
  requiresTurbo?: boolean;
}
export type PartDef = FilterPart | ExhaustPart | ManifoldPart | CamPart | TurboPart | ClutchPart | DifferentialPart | TirePart | ExpandedPart;

/** Things the career unlocks (event wins). */
export type UnlockId =
  | 'workshop-basic'
  | 'part-filter'
  | 'part-exhaust'
  | 'part-manifold'
  | 'part-tires-sport'
  | 'part-cam'
  | 'workshop-transmission'
  | 'part-clutch'
  | 'part-differential'
  | 'part-tires-semislick'
  | 'engine-tuners'
  | 'part-turbo'
  | 'final-challenge';

export const UNLOCK_LABEL: Record<UnlockId, string> = {
  'workshop-basic': 'Oficina básica',
  'part-filter': 'Filtro esportivo',
  'part-exhaust': 'Escape esportivo',
  'part-manifold': 'Coletor de admissão',
  'part-tires-sport': 'Pneus esportivos',
  'part-cam': 'Comando esportivo',
  'workshop-transmission': 'Oficina de transmissão',
  'part-clutch': 'Embreagem reforçada',
  'part-differential': 'Diferencial alternativo',
  'part-tires-semislick': 'Pneus semi-slick',
  'engine-tuners': 'Preparadores de motor (dinamômetro da oficina)',
  'part-turbo': 'Kit turbo básico',
  'final-challenge': 'Desafio final',
};

const BASE_PARTS: readonly PartDef[] = [
  {
    id: 'filter-sport',
    category: 'intake-filter',
    name: 'Filtro esportivo',
    price: 250,
    unlock: 'part-filter',
    description: 'Elemento de algodão de alto fluxo na caixa original, com tomada de ar mais livre.',
    physics: 'Queda de pressão no filtro de ≈ 3 kPa para 1 kPa no fluxo nominal: o coletor enche mais em alta rotação.',
    airFilterDropKPa: 1.0,
    intakeGainDelta: 0.18,
  },
  {
    id: 'exhaust-sport',
    category: 'exhaust',
    name: 'Escape dimensionado',
    price: 450,
    unlock: 'part-exhaust',
    description: 'Coletor 4×1 de tubos dimensionados, tubulação de 2" e um só abafador de fluxo direto.',
    physics: 'Contrapressão de ≈ 18 kPa para 7 kPa no fluxo nominal: menos perda de bombeamento e menos gás residual. Muda a geometria acústica.',
    backPressureKPa: 7,
    acousticPreset: 'sport',
    headerDiameterScale: 1.08,
  },
  {
    id: 'manifold-sport',
    category: 'intake-manifold',
    name: 'Coletor de admissão',
    price: 650,
    unlock: 'part-manifold',
    description: 'Coletor de dutos mais curtos e largos, plenum maior.',
    physics: 'Dutos 18 % mais curtos e 4 mm mais largos: a sintonia de Helmholtz sobe de rotação e a perda de carga cai. Perde um pouco embaixo.',
    runnerLengthScale: 0.82,
    runnerDiameterAddMm: 4,
    plenumScale: 1.3,
  },
  {
    id: 'cam-sport',
    category: 'camshaft',
    name: 'Comando esportivo',
    price: 900,
    unlock: 'part-cam',
    description: 'Comando de maior duração e levantamento, com molas reforçadas.',
    physics: 'Fechamento da admissão 12° mais tarde, cruzamento +14°, levantamento +1,3 mm; limite de giro +400 rpm. Ganha em cima, perde embaixo.',
    ivoDeltaDeg: -6,
    ivcDeltaDeg: 12,
    evoDeltaDeg: -8,
    evcDeltaDeg: 8,
    liftAddMm: 1.3,
    revLimitAddRpm: 400,
  },
  {
    id: 'clutch-reinforced',
    category: 'clutch',
    name: 'Embreagem reforçada',
    price: 900,
    unlock: 'part-clutch',
    description: 'Platô de carga maior e disco de cerâmica.',
    physics: 'Capacidade de torque +50 %, engate 30 % mais rápido. Não cria torque: só deixa de patinar.',
    capacityScale: 1.5,
    engageRateScale: 1.3,
    launchRpmAdd: 200,
  },
  {
    id: 'tires-sport',
    category: 'tires',
    grade: 'sport',
    name: 'Pneus esportivos',
    price: 1000,
    unlock: 'part-tires-sport',
    description: 'Pneus de rua de alto desempenho, mesma medida externa.',
    physics: 'μ de pico ≈ 1,13, carcaça mais rígida; roda 0,08 kg·m² mais pesada.',
    muPeak: 1.13,
    B: 11,
    C: 1.5,
    E: 0.35,
    wheelInertiaAddKgM2: 0.08,
    rollingResistanceAdd: 0.001,
    optimalTempC: 70,
    tempSensitivityPerC: 0.002,
  },
  {
    id: 'differential-short',
    category: 'differential',
    name: 'Diferencial alternativo',
    price: 1200,
    unlock: 'part-differential',
    description: 'Coroa e pinhão mais curtos (≈ 12 %).',
    physics: 'Relação final × 1,12: mais força nas rodas e mais patinação; menos velocidade final. Não é melhoria universal.',
    finalDriveScale: 1.12,
  },
  {
    id: 'tires-semislick',
    category: 'tires',
    grade: 'semiSlick',
    name: 'Pneus semi-slick',
    price: 1600,
    unlock: 'part-tires-semislick',
    description: 'Composto macio de competição homologado para rua. Precisa de temperatura.',
    physics: 'μ de pico ≈ 1,32 a 85 °C, perde mais aderência fora da temperatura; roda 0,15 kg·m² mais pesada.',
    muPeak: 1.32,
    B: 10,
    C: 1.55,
    E: 0.2,
    wheelInertiaAddKgM2: 0.15,
    rollingResistanceAdd: 0.002,
    optimalTempC: 85,
    tempSensitivityPerC: 0.0032,
  },
  {
    id: 'turbo-basic',
    category: 'turbo',
    name: 'Kit turbo básico',
    price: 4000,
    unlock: 'part-turbo',
    description: 'Turbina pequena de mercado, coletor de ferro fundido, válvula de alívio, intercooler frontal e carburador/TBI pressurizado. Pressão de trabalho 0,6 bar.',
    physics:
      'Sobrealimentação real: o turbo só enche com fluxo de escape (spool), a pressão sobe com a rotação até a wastegate. A curva é recalculada pelo fluxo de ar comprimido, com atraso de ignição contra detonação. Exige embreagem que aguente o torque.',
    turbo: {
      maxBoostBar: 0.6,
      spoolTimeS: 0.7,
      fullBoostFlowFraction: 0.72,
      maxShaftRpm: 170000,
      compressorBlades: 6,
      bovEnabled: true,
      bovVentTimeS: 0.14,
    },
    chargePipeVolumeL: 2.4,
    knockLossPerBarPetrol: 0.1,
    knockLossPerBarEthanol: 0.025,
    boostRangeBar: [0.4, 1.0],
    massAddKg: 18,
    intercoolerEffectiveness: 0.6,
  },
];

export const PARTS: readonly PartDef[] = [...BASE_PARTS, ...EXPANDED_PARTS];

export function findPart(id: string): PartDef | undefined {
  return PARTS.find((p) => p.id === id);
}
