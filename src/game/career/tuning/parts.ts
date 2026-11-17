import type { TransmissionKind, TurboConfig } from '../../../data/schema';
import { CHAPTER2_PARTS } from './chapter2Parts';

/**
 * Career parts. Each part is a discriminated union member by `category` and carries the PHYSICAL
 * change it makes — never a "+x % power" multiplier. The build resolver turns these hardware
 * changes into a new engine/driveline configuration (see BuildResolver.ts and breathingModel.ts).
 *
 * One slot per category: installing a part of an occupied category replaces the previous one
 * (e.g. semi-slick tyres replace sport tyres; nothing stacks).
 */
export type PartCategory =
  | 'intake-filter'
  | 'intake-manifold'
  | 'camshaft'
  | 'exhaust'
  | 'turbo'
  | 'clutch'
  | 'differential'
  | 'tires'
  // Chapter 2 (BuildResolver v2)
  | 'ecu'
  | 'intercooler'
  | 'boost-control'
  | 'cylinder-head'
  | 'pistons'
  | 'flywheel'
  | 'gearbox'
  | 'awd'
  | 'suspension';

/** Workshop tabs (the brief's six categories) and the slots they show. */
export const WORKSHOP_TABS: { id: string; label: string; categories: PartCategory[] }[] = [
  { id: 'engine', label: 'Motor', categories: ['camshaft', 'cylinder-head', 'pistons', 'flywheel'] },
  { id: 'intake', label: 'Admissão', categories: ['intake-filter', 'intake-manifold'] },
  { id: 'exhaust', label: 'Escape', categories: ['exhaust'] },
  { id: 'electronics', label: 'Eletrônica', categories: ['ecu', 'boost-control'] },
  { id: 'transmission', label: 'Transmissão', categories: ['clutch', 'gearbox', 'differential', 'awd'] },
  { id: 'tires', label: 'Pneus e suspensão', categories: ['tires', 'suspension'] },
  { id: 'turbo', label: 'Turbo', categories: ['turbo', 'intercooler'] },
];

/** Order in which the resolver applies the categories (independent of the install order). */
export const CATEGORY_ORDER: readonly PartCategory[] = ['intake-filter', 'intake-manifold', 'camshaft', 'exhaust', 'turbo', 'clutch', 'differential', 'tires'];

/** Order of the v2 resolver: the v1 categories first, then the Chapter 2 ones. */
export const CATEGORY_ORDER_V2: readonly PartCategory[] = [
  ...CATEGORY_ORDER,
  'cylinder-head',
  'pistons',
  'flywheel',
  'ecu',
  'intercooler',
  'boost-control',
  'gearbox',
  'awd',
  'suspension',
];

export const CATEGORY_LABEL: Record<PartCategory, string> = {
  'intake-filter': 'Filtro de ar',
  'intake-manifold': 'Coletor de admissão',
  camshaft: 'Comando de válvulas',
  exhaust: 'Escapamento',
  turbo: 'Sobrealimentação',
  clutch: 'Embreagem',
  differential: 'Diferencial',
  tires: 'Pneus',
  ecu: 'Central eletrônica (ECU)',
  intercooler: 'Intercooler',
  'boost-control': 'Controle de pressão',
  'cylinder-head': 'Cabeçote',
  pistons: 'Pistões e bielas',
  flywheel: 'Volante do motor',
  gearbox: 'Câmbio automático / dupla embreagem',
  awd: 'Tração integral',
  suspension: 'Suspensão',
};

/** Pseudo-family of the engines that carry no `family` (Chapter 1 cars and the sandbox cars). */
export const LEGACY_FAMILY = 'legacy';

/**
 * Hardware compatibility, checked by the v2 resolver only (the v1 resolver keeps the Chapter 1
 * rules exactly as they were). An absent list means "fits everything".
 */
export interface PartCompat {
  /** Engine families the part is made for (LEGACY_FAMILY = engines without a family). */
  families?: readonly string[];
  /** Induction the part needs. */
  induction?: 'NA' | 'turbo';
  /** Gearbox kinds the part fits. */
  transmissions?: readonly TransmissionKind[];
  /** Driven axles the part is for. */
  drives?: readonly ('front' | 'rear' | 'awd')[];
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
  /** First resolver version that knows the part (absent = 1). */
  since?: 1 | 2;
  compat?: PartCompat;
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
  grade: 'sport' | 'semiSlick' | 'slick';
  muPeak: number;
  B: number;
  C: number;
  E: number;
  wheelInertiaAddKgM2: number;
  rollingResistanceAdd: number;
  optimalTempC: number;
  tempSensitivityPerC: number;
}

/**
 * Engine control unit. Never a power multiplier: it sets the boost target the wastegate control
 * aims at, the torque limiter of the engine's torque model, the ignition margin and the rev limit.
 */
export interface EcuPart extends PartBase {
  category: 'ecu';
  level: 'stage1' | 'programmable';
  /** Boost target added to the factory target (bar); programmable maps follow the tune instead. */
  boostAddBar: number;
  /** Torque limiter as a fraction of the mechanical limit of the pistons/rods. */
  torqueLimitFraction: number;
  /** Ignition advance gained with the map, as an indicated-torque fraction (98 RON fuel). */
  ignitionGain: number;
  /** Rev limit raise (only where the valve train allows it). */
  revLimitAddRpm: number;
  /** Boost range the tuner can set on the dyno (programmable only, bar above the factory target). */
  boostRangeAddBar?: [number, number];
}

/** Larger-flow (hybrid) turbocharger for a factory-turbo engine. */
export interface TurboUpgradePart extends PartBase {
  category: 'turbo';
  upgrade: true;
  /** Compressor flow capacity relative to the factory unit. */
  flowScale: number;
  /** Exhaust flow needed for full shaft speed relative to the factory unit (lag). */
  spoolFlowScale: number;
  spoolTimeScale: number;
  compressorBlades: number;
  massAddKg: number;
}

export interface IntercoolerPart extends PartBase {
  category: 'intercooler';
  /** Fraction of the compressor temperature rise the core removes. */
  effectiveness: number;
  /** Charge pipe + core volume added (throttle response), litres. */
  volumeAddL: number;
  massAddKg: number;
}

/** Wastegate actuator + electronic boost control solenoid. */
export interface BoostControlPart extends PartBase {
  category: 'boost-control';
  /** Highest boost the wastegate can hold above the factory target (bar); the stock one holds 0.35. */
  wastegateHeadroomBar: number;
  spoolTimeScale: number;
}

/** Ported cylinder head (flow capacity where the valves choke). */
export interface HeadPart extends PartBase {
  category: 'cylinder-head';
  flowGain: number;
}

/** Pistons / rods: compression ratio and the mechanical torque limit. */
export interface PistonPart extends PartBase {
  category: 'pistons';
  compressionAdd: number;
  /** Mechanical torque limit relative to the family's factory internals. */
  torqueLimitScale: number;
  revLimitAddRpm: number;
}

export interface FlywheelPart extends PartBase {
  category: 'flywheel';
  inertiaScale: number;
}

/** Clutch packs / shift elements and the gearbox control unit of an automatic or a twin-clutch. */
export interface GearboxPart extends PartBase {
  category: 'gearbox';
  capacityScale: number;
  shiftTimeScale: number;
  launchRpmAdd: number;
  /** Torque converter: lockup capacity and K factor (lower K = higher stall) scales. */
  lockupScale?: number;
  converterKScale?: number;
}

/** Centre coupling / active centre differential calibration. */
export interface AwdPart extends PartBase {
  category: 'awd';
  couplingScale: number;
  frontFractionDelta: number;
}

/** Drag suspension: effective centre-of-gravity height seen by the load transfer. */
export interface SuspensionPart extends PartBase {
  category: 'suspension';
  cgHeightDeltaM: number;
}

export type PartDef =
  | FilterPart
  | ExhaustPart
  | ManifoldPart
  | CamPart
  | TurboPart
  | ClutchPart
  | DifferentialPart
  | TirePart
  | EcuPart
  | TurboUpgradePart
  | IntercoolerPart
  | BoostControlPart
  | HeadPart
  | PistonPart
  | FlywheelPart
  | GearboxPart
  | AwdPart
  | SuspensionPart;

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
  | 'final-challenge'
  // Chapter 2 — Liga da Madrugada
  | 'c2-ecu'
  | 'c2-intercooler'
  | 'c2-engine-family'
  | 'c2-gearbox'
  | 'c2-suspension'
  | 'c2-boost-control'
  | 'c2-programmable'
  | 'c2-turbo-hybrid'
  | 'c2-internals'
  | 'c2-tires-slick'
  | 'c2-awd'
  | 'c2-final-challenge'
  | 'c2-dealer-335i';

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
  'c2-ecu': 'Remap Stage 1 (Caio)',
  'c2-intercooler': 'Intercooler de maior capacidade',
  'c2-engine-family': 'Peças por família de motor (cabeçote, comandos, pistões, volante)',
  'c2-gearbox': 'Upgrades de câmbio automático e dupla embreagem',
  'c2-suspension': 'Suspensão de arrancada',
  'c2-boost-control': 'Controle eletrônico de pressão',
  'c2-programmable': 'ECU programável',
  'c2-turbo-hybrid': 'Turbina de maior fluxo',
  'c2-internals': 'Pistões e bielas forjados',
  'c2-tires-slick': 'Pneus slick',
  'c2-awd': 'Calibração da tração integral',
  'c2-final-challenge': 'Desafio final da Liga',
  'c2-dealer-335i': 'BMW 335i à venda',
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
    compat: { families: [LEGACY_FAMILY] },
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
    compat: { families: [LEGACY_FAMILY] },
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
    compat: { transmissions: ['manual'] },
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
    compat: { families: [LEGACY_FAMILY], induction: 'NA' },
    chargePipeVolumeL: 2.4,
    knockLossPerBarPetrol: 0.1,
    knockLossPerBarEthanol: 0.025,
    boostRangeBar: [0.4, 1.0],
    massAddKg: 18,
    intercoolerEffectiveness: 0.6,
  },
];

/** Every part of every resolver version (ids are unique across versions). */
export const ALL_PARTS: readonly PartDef[] = [...PARTS, ...CHAPTER2_PARTS];

export function findPart(id: string): PartDef | undefined {
  return ALL_PARTS.find((p) => p.id === id);
}

/** Part lookup of one resolver version: v1 only knows the Chapter 1 catalogue. */
export function findPartForVersion(id: string, version: 1 | 2): PartDef | undefined {
  const p = findPart(id);
  return p && (p.since ?? 1) <= version ? p : undefined;
}
