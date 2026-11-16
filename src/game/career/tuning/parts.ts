import type { TurboConfig } from '../../../data/schema';

/**
 * Career parts. Each part is a discriminated union member by `category` and carries the PHYSICAL
 * change it makes — never a "+x % power" multiplier. The build resolver turns these hardware
 * changes into a new engine/driveline configuration (see BuildResolver.ts and breathingModel.ts).
 *
 * One slot per category: installing a part of an occupied category replaces the previous one
 * (e.g. semi-slick tyres replace sport tyres; nothing stacks).
 */
export type PartCategory = 'intake-filter' | 'intake-manifold' | 'camshaft' | 'exhaust' | 'turbo' | 'clutch' | 'differential' | 'tires';

/** Workshop tabs (the brief's six categories) and the slots they show. */
export const WORKSHOP_TABS: { id: string; label: string; categories: PartCategory[] }[] = [
  { id: 'engine', label: 'Motor', categories: ['camshaft'] },
  { id: 'intake', label: 'Admissão', categories: ['intake-filter', 'intake-manifold'] },
  { id: 'exhaust', label: 'Escape', categories: ['exhaust'] },
  { id: 'transmission', label: 'Transmissão', categories: ['clutch', 'differential'] },
  { id: 'tires', label: 'Pneus', categories: ['tires'] },
  { id: 'turbo', label: 'Turbo', categories: ['turbo'] },
];

/** Order in which the resolver applies the categories (independent of the install order). */
export const CATEGORY_ORDER: readonly PartCategory[] = ['intake-filter', 'intake-manifold', 'camshaft', 'exhaust', 'turbo', 'clutch', 'differential', 'tires'];

export const CATEGORY_LABEL: Record<PartCategory, string> = {
  'intake-filter': 'Filtro de ar',
  'intake-manifold': 'Coletor de admissão',
  camshaft: 'Comando de válvulas',
  exhaust: 'Escapamento',
  turbo: 'Sobrealimentação',
  clutch: 'Embreagem',
  differential: 'Diferencial',
  tires: 'Pneus',
};

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

export type PartDef = FilterPart | ExhaustPart | ManifoldPart | CamPart | TurboPart | ClutchPart | DifferentialPart | TirePart;

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

export const PARTS: readonly PartDef[] = [
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

export function findPart(id: string): PartDef | undefined {
  return PARTS.find((p) => p.id === id);
}
