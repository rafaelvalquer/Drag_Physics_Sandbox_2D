import type { TransmissionKind, TurboConfig } from '../../../data/schema';
import { CHAPTER2_PARTS } from './chapter2Parts';
import { CHAPTER3_PARTS } from './chapter3Parts';
import { MODERN_BREATHING_PARTS } from './modernBreathingParts';
import { MODERN_DRIVELINE_PARTS } from './modernDrivelineParts';
import { MODERN_FUEL_PARTS } from './modernFuelParts';
import { MODERN_TOP_END_PARTS } from './modernTopEndParts';
import { MODERN_INTERNAL_PARTS } from './modernInternalParts';
import { MODERN_IGNITION_PARTS } from './modernIgnitionParts';
import { MODERN_CONVERSION_PARTS } from './modernConversionParts';
import { MODERN_INTERCOOLER_PARTS, MODERN_TURBO_PARTS } from './modernTurboParts';
import type { PartProgression } from './partProgression';

/**
 * Career parts. Each part is a discriminated union member by `category` and carries the PHYSICAL
 * change it makes — never a "+x % power" multiplier. The build resolver turns these hardware
 * changes into a new engine/driveline configuration (see BuildResolver.ts and breathingModel.ts).
 *
 * One slot per category: installing a part of an occupied category replaces the previous one
 * (e.g. semi-slick tyres replace sport tyres; nothing stacks).
 */
import { CELTA_TURBO_COMPRESSION, EXPANDED_PARTS } from './expandedParts';

export type PartCategory =
  | 'intake-filter' | 'intake-manifold' | 'intake-throttle' | 'intake-airbox'
  | 'camshaft' | 'engine-head' | 'engine-compression' | 'engine-internals' | 'engine-flywheel'
  | 'exhaust' | 'exhaust-header' | 'exhaust-pipe' | 'exhaust-muffler'
  | 'clutch' | 'differential' | 'transmission-gearbox'
  | 'tires' | 'tires-width' | 'tires-pressure'
  | 'turbo' | 'turbo-turbine' | 'turbo-intercooler' | 'turbo-wastegate' | 'turbo-boost'
  | 'electronics-ecu' | 'electronics-fuel' | 'electronics-ignition'
  | 'cooling-radiator' | 'cooling-oil' | 'cooling-fan'
  | 'chassis-weight' | 'chassis-suspension'
  | 'engine-valvetrain' | 'electronics-launch'
  | V2Category;

/** Slots of the Chapter 2 parts (BuildResolver v2, modern engine families only). */
export type V2Category =
  | 'ecu'
  | 'intercooler'
  | 'boost-control'
  | 'cylinder-head'
  | 'pistons'
  | 'flywheel'
  | 'gearbox'
  | 'awd'
  | 'suspension';

export const V2_CATEGORIES: readonly V2Category[] = ['cylinder-head', 'pistons', 'flywheel', 'ecu', 'intercooler', 'boost-control', 'gearbox', 'awd', 'suspension'];

/**
 * Slot-catalogue categories that are hardware of the CAR, not of a classic engine (mass, cooling,
 * tyre size and pressure): they also fit the modern engine families (resolver v2), where they open
 * with their own Chapter 2 unlock (`modernUnlock`). The rest of the slot catalogue stays with the
 * classic engines.
 */
export const GENERIC_V2_CATEGORIES: readonly PartCategory[] = ['chassis-weight', 'cooling-radiator', 'cooling-oil', 'cooling-fan', 'tires-width', 'tires-pressure'];

export interface WorkshopTab {
  id: string;
  label: string;
  icon: string;
  description: string;
  categories: PartCategory[];
}
/**
 * Workshop tabs. The Chapter 2 slots sit in the same tabs; a car only shows the slots of its own
 * catalogue (classic engines: the slot catalogue; modern families: the Chapter 2 parts).
 */
export const WORKSHOP_TABS: readonly WorkshopTab[] = [
  { id: 'engine', label: 'Motor', icon: '⚙', description: 'Comando, cabeçote, taxa e internos', categories: ['camshaft', 'engine-head', 'engine-compression', 'engine-internals', 'engine-flywheel', 'cylinder-head', 'pistons', 'flywheel', 'engine-valvetrain'] },
  { id: 'intake', label: 'Admissão', icon: '◉', description: 'Ar limpo, dutos e resposta', categories: ['intake-filter', 'intake-manifold', 'intake-throttle', 'intake-airbox'] },
  { id: 'exhaust', label: 'Escape', icon: '≋', description: 'Contrapressão e acústica', categories: ['exhaust', 'exhaust-header', 'exhaust-pipe', 'exhaust-muffler'] },
  { id: 'transmission', label: 'Transmissão', icon: '⌁', description: 'Relações e embreagem', categories: ['clutch', 'transmission-gearbox', 'differential', 'gearbox', 'awd'] },
  { id: 'tires', label: 'Pneus', icon: '◎', description: 'Composto, largura e pressão', categories: ['tires', 'tires-width', 'tires-pressure'] },
  { id: 'turbo', label: 'Turbo', icon: '◌', description: 'Pressão, spool e temperatura', categories: ['turbo', 'turbo-turbine', 'turbo-intercooler', 'turbo-wastegate', 'turbo-boost', 'intercooler'] },
  { id: 'electronics', label: 'Eletrônica', icon: '⌘', description: 'ECU, combustível e ignição', categories: ['electronics-ecu', 'electronics-fuel', 'electronics-ignition', 'ecu', 'boost-control', 'electronics-launch'] },
  { id: 'cooling', label: 'Arrefecimento', icon: '❄', description: 'Gerenciamento térmico', categories: ['cooling-radiator', 'cooling-oil', 'cooling-fan', 'turbo-intercooler'] },
  { id: 'chassis', label: 'Estrutura', icon: '◇', description: 'Massa e geometria', categories: ['chassis-weight', 'chassis-suspension', 'suspension'] },
];
/** One mechanical slot can appear in more than one navigation tab (intercooler: turbo + cooling).
 * Deduplicate the resolver order so the same physical component is never installed twice. */
export const CATEGORY_ORDER: readonly PartCategory[] = [...new Set(WORKSHOP_TABS.flatMap((t) => t.categories))];

/** Order of the v1 resolver: every slot except the Chapter 2 ones. */
export const CATEGORY_ORDER_V1: readonly PartCategory[] = CATEGORY_ORDER.filter((c) => !(V2_CATEGORIES as readonly string[]).includes(c));

/** Order of the v2 resolver: the v1 slots first, then the Chapter 2 ones. */
export const CATEGORY_ORDER_V2: readonly PartCategory[] = [...CATEGORY_ORDER_V1, ...V2_CATEGORIES];

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
  ecu: 'Central eletrônica (ECU)',
  intercooler: 'Intercooler',
  'boost-control': 'Controle de pressão',
  'cylinder-head': 'Cabeçote',
  pistons: 'Pistões e bielas',
  flywheel: 'Volante do motor',
  gearbox: 'Câmbio automático / dupla embreagem',
  awd: 'Tração integral',
  suspension: 'Suspensão de arrancada',
  'engine-valvetrain': 'Molas de válvula',
  'electronics-launch': 'Controle de largada',
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
  ecu: 'Alvo de pressão, limitador de torque, ignição e corte do motor moderno.', intercooler: 'Temperatura da carga do turbo de fábrica.',
  'boost-control': 'Atuador da wastegate e solenoide de controle.', 'cylinder-head': 'Vazão do cabeçote onde as válvulas estrangulam.',
  pistons: 'Taxa de compressão e limite mecânico de torque.', flywheel: 'Inércia rotacional do motor.',
  gearbox: 'Embreagens e central do câmbio automático ou de dupla embreagem.', awd: 'Acoplamento central da tração integral.',
  suspension: 'Altura efetiva do centro de gravidade na transferência de carga.',
  'engine-valvetrain': 'Rotação em que as válvulas deixam de seguir o comando (flutuação).',
  'electronics-launch': 'Rotação mantida na linha de largada (two-step).',
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
  massRemoveKg?: number; cgHeightDeltaM?: number; drivelineEfficiencyAdd?: number; clutchEngineInertiaScale?: number;
  /** Load transfer towards the driven axle: CG height change, sign chosen by the driven axle. */
  launchCgDeltaM?: number;
  /** Boost the wastegate holds above the target instead of tapering at high flow (bar). */
  wastegateHoldAddBar?: number;
  tireRollingScale?: number;
}

/** Pseudo-family of the engines that carry no `family` (Chapter 1 cars and the sandbox cars). */
export const LEGACY_FAMILY = 'legacy';

/**
 * Hardware compatibility, checked by the v2 resolver only (the v1 resolver keeps the Chapter 1
 * rules exactly as they were). An absent list means "fits everything".
 */
export interface PartCompat {
  /** Vehicle-specific fitment when a family or architecture alone is too broad. */
  cars?: readonly string[];
  /** Engine families the part is made for (LEGACY_FAMILY = engines without a family). */
  families?: readonly string[];
  /** Induction the part needs. */
  induction?: 'NA' | 'turbo';
  /** Gearbox kinds the part fits. */
  transmissions?: readonly TransmissionKind[];
  /** Driven axles the part is for. */
  drives?: readonly ('front' | 'rear' | 'awd')[];
  /**
   * Cylinder layouts the part is made for (e.g. a V8 header). Future premium engines (flat-six,
   * V8, V12) get their own parts by declaring their family/layout here; the resolver is unchanged.
   */
  layouts?: readonly string[];
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
  progression?: PartProgression;
  /** Career chapter whose shop sells the part (absent = the chapter of its unlock). */
  chapter?: 1 | 2 | 3;
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
  /** Factory turbo: a freer path after the turbine lets it reach speed sooner (spool time scale). */
  spoolTimeScale?: number;
  /** A downpipe changes its own section and can coexist with the rest of the exhaust. */
  section?: 'downpipe';
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
  /** Override for systems that change intake lift independently of the exhaust valves. */
  exhaustLiftAddMm?: number;
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
  /** Minimum supporting hardware for a modern NA conversion. */
  conversion?: {
    maxCompressionRatio: number;
    minFuelCapacityScale: number;
    minInternalsTorqueScale: number;
    minIgnitionTier: 1 | 2 | 3;
  };
}

export interface ClutchPart extends PartBase {
  category: 'clutch';
  capacityScale: number;
  engageRateScale: number;
  launchRpmAdd: number;
  /** Lighter disc and pressure plate: scale of the gearbox input inertia. */
  inputInertiaScale?: number;
  /** Lighter pressure plate bolted to the flywheel: scale of the engine inertia. */
  engineInertiaScale?: number;
}

export interface DifferentialPart extends PartBase {
  category: 'differential';
  /** Shorter crown-and-pinion: multiplies the final drive. */
  finalDriveScale: number;
  /** New gears and bearings: gearbox/driveline efficiency gained (fraction). */
  efficiencyAdd?: number;
}

export interface ManualGearsetPart extends PartBase {
  category: 'transmission-gearbox';
  /** Target spread for the intermediate gears, relative to the original ratios. */
  gearSpreadScale: number;
  efficiencyAdd: number;
}

export interface FuelSystemPart extends PartBase {
  category: 'electronics-fuel';
  /** Continuous metered fuel delivery relative to the factory hardware estimate. */
  fuelCapacityScale: number;
}

export interface IgnitionPart extends PartBase {
  category: 'electronics-ignition';
  /** Effective burn duration with the calibrated plug, gap and coil. */
  burnDurationScale: number;
  /** Residual torque loss from protective spark retard under boost. */
  knockRetardScale: number;
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
  level: 'stage1' | 'stage2' | 'stage3' | 'programmable';
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
  /** Boost-control solenoid that comes with the map: wastegate headroom over the factory target (bar). */
  wastegateHeadroomBar?: number;
  /** Hardware the map is calibrated for: the build is refused without one of the ids of each entry. */
  requiresParts?: readonly { ids: readonly string[]; label: string }[];
  /** Minimum relative torque rating of the fitted rotating assembly. */
  minInternalsTorqueScale?: number;
  /** Minimum compressor capacity of the turbo hardware required by this map. */
  minTurboFlowScale?: number;
  /** Minimum fraction of the compressor heat that the charge cooler must remove. */
  minIntercoolerEffectiveness?: number;
  /** Above this fraction of the factory internals' torque, forged pistons/rods are required. */
  forgedAboveFraction?: number;
  /** Staged map: torque target at most this multiple of the factory peak torque. */
  stockTorqueGainMax?: number;
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
  /** Larger turbine housing: exhaust back pressure removed at the reference flow (kPa). */
  backPressureReductionKPa?: number;
  /** Compressor isentropic efficiency in this operating range. */
  compressorEfficiency?: number;
  /** Stage-specific supporting hardware. The legacy hybrid keeps its prior requirements. */
  factoryTurboStage?: 1 | 2 | 3;
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
  /** Boost held above the target at high flow, where the factory wastegate lets it taper (bar). */
  holdAddBar?: number;
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
  /** Lighter, low-friction rings and skirts: scale of the engine's friction torque. */
  frictionScale?: number;
  /** Lighter pistons and rods: scale of the engine's rotating inertia. */
  inertiaScale?: number;
  /** Safe speed gained by reducing reciprocating loads, with the factory cut unchanged. */
  safeRpmReserve?: number;
  /** Relative exposure time allowed above the new safe speed. */
  enduranceScale?: number;
}

export interface CompressionPart extends PartBase {
  category: 'engine-compression';
  /** Change in compression ratio from machining the combustion chambers to a measured volume. */
  compressionAdd: number;
  conversionPreparation?: true;
}

export interface FlywheelPart extends PartBase {
  category: 'flywheel';
  inertiaScale: number;
  /** Launch speed raised to make up for the energy the lighter flywheel no longer stores (rpm). */
  launchRpmAdd?: number;
  /** Mass saved against the factory (dual-mass) flywheel (kg). */
  massRemoveKg?: number;
}

/** Clutch packs / shift elements and the gearbox control unit of an automatic or a twin-clutch. */
export interface GearboxPart extends PartBase {
  category: 'gearbox';
  capacityScale: number;
  shiftTimeScale: number;
  launchRpmAdd: number;
  /** Torque converter: lockup capacity and K factor (higher K = higher stall at the same torque) scales. */
  lockupScale?: number;
  converterKScale?: number;
  /** Efficiency gained by the new clutch packs / pump (fraction). */
  efficiencyAdd?: number;
}

/** Centre coupling / active centre differential calibration. */
export interface AwdPart extends PartBase {
  category: 'awd';
  couplingScale: number;
  frontFractionDelta: number;
  /** Less preload in the coupling: transfer-case efficiency gained (fraction). */
  transferEfficiencyAdd?: number;
}

/** Drag suspension: effective centre-of-gravity height seen by the load transfer. */
export interface SuspensionPart extends PartBase {
  category: 'suspension';
  cgHeightDeltaM: number;
  /** Aluminium springs/dampers: unsprung and total mass removed (kg). */
  massRemoveKg?: number;
}

/**
 * Reinforced valve springs (and retainers): the valves follow the cam to a higher speed before they
 * float, so the speed the engine tolerates rises. They do not move the ignition cut and add no
 * power by themselves: the gain is the mechanical headroom used by EngineReliability / Dyno Lab.
 */
export interface ValveSpringPart extends PartBase {
  category: 'engine-valvetrain';
  /** Recommended and mechanical safe speed added (rpm). */
  safeRpmAdd: number;
  modernUnlock?: UnlockId;
}

/**
 * Launch control (two-step): the ECU holds the engine at a set speed on the line with a soft spark
 * cut, so the launch clutch (manual automatic clutch / twin-clutch pack) bites at that speed.
 */
export interface LaunchControlPart extends PartBase {
  category: 'electronics-launch';
  /** Default launch speed added over the clutch logic's (rpm). */
  launchRpmAdd: number;
  modernUnlock?: UnlockId;
}

/** Slot-catalogue part (classic engines, BuildResolver v1): hardware changes in `mod`. */
export interface ExpandedPart extends PartBase {
  category: Exclude<PartCategory, V2Category>;
  chapter: 1 | 2 | 3;
  mod: MechanicalMods;
  /** This part is only meaningful with a turbo kit already installed. */
  requiresTurbo?: boolean;
  /** Extra career unlock this part needs on a modern engine family (generic categories only). */
  modernUnlock?: UnlockId;
  /** Modern hardware with an explicit application path in resolver 2. */
  modernBreathing?: true;
}

export type PartDef =
  | FilterPart
  | ExhaustPart
  | ManifoldPart
  | CamPart
  | TurboPart
  | ClutchPart
  | DifferentialPart
  | ManualGearsetPart
  | FuelSystemPart
  | IgnitionPart
  | TirePart
  | ExpandedPart
  | EcuPart
  | TurboUpgradePart
  | IntercoolerPart
  | BoostControlPart
  | HeadPart
  | PistonPart
  | CompressionPart
  | FlywheelPart
  | GearboxPart
  | AwdPart
  | SuspensionPart
  | ValveSpringPart
  | LaunchControlPart;

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
  | 'c2-dealer-335i'
  | 'c2-generic-tires'
  | 'c2-generic-chassis'
  | 'c2-stage2'
  | 'c2-workshop-street'
  | 'c2-workshop-sport'
  | 'c3-stage3'
  // Chapter 3 — Elite da Madrugada
  | 'c3-v6-parts'
  | 'c3-workshop-street'
  | 'c3-workshop-sport'
  | 'c3-workshop-race'
  | 'c3-dealer-gtr'
  | 'c3-final-challenge';

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
  'c2-generic-tires': 'Largura e pressão de pneus nos carros modernos',
  'c2-generic-chassis': 'Alívio de peso e arrefecimento nos carros modernos',
  'c2-stage2': 'Stage 2 do turbo de fábrica (downpipe, admissão direta, mapa Stage 2)',
  'c2-workshop-street': 'Oficina da Liga · Stage 1',
  'c2-workshop-sport': 'Oficina da Liga · Stage 2',
  'c3-stage3': 'Stage 3 do turbo de fábrica',
  'c3-v6-parts': 'Peças dos V6 aspirados (admissão, escape, comandos, remap, cabeçotes)',
  'c3-workshop-street': 'Oficina da Elite · Stage 1',
  'c3-workshop-sport': 'Oficina da Elite · Stage 2 e Stage 3 da Liga',
  'c3-workshop-race': 'Oficina da Elite · Stage 3',
  'c3-dealer-gtr': 'GT-R à venda na revenda Elite',
  'c3-final-challenge': 'Duelo final da Elite',
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
    physics: 'Capacidade de torque +50 %, engate 30 % mais rápido, largada +100 rpm; disco cerâmico e platô de alumínio mais leves: inércia na entrada do câmbio −15 % e do motor −4 %. Não cria torque: deixa de patinar e o giro sobe mais rápido.',
    compat: { transmissions: ['manual'] },
    capacityScale: 1.5,
    engageRateScale: 1.3,
    launchRpmAdd: 100,
    inputInertiaScale: 0.85,
    engineInertiaScale: 0.96,
  },
  {
    id: 'tires-sport',
    category: 'tires',
    grade: 'sport',
    name: 'Pneus esportivos',
    price: 1000,
    unlock: 'part-tires-sport',
    description: 'Pneus de rua de alto desempenho, mesma medida externa.',
    physics: 'μ de pico ≈ 1,13 (no mínimo +6 % sobre o pneu original já na largada), carcaça mais rígida, mesma roda.',
    muPeak: 1.13,
    B: 11,
    C: 1.5,
    E: 0.35,
    wheelInertiaAddKgM2: 0,
    rollingResistanceAdd: 0,
    optimalTempC: 70,
    tempSensitivityPerC: 0.002,
  },
  {
    id: 'differential-short',
    category: 'differential',
    name: 'Diferencial alternativo',
    price: 1200,
    unlock: 'part-differential',
    description: 'Jogo de coroa e pinhão novo, com relação escolhida para o carro.',
    physics: 'A oficina escolhe a relação final entre 3 % mais longa e 12 % mais curta, a que leva o carro mais rápido aos 402 m; rolamentos e engrenagens novos: eficiência da transmissão +1 ponto.',
    finalDriveScale: 1.12,
    efficiencyAdd: 0.01,
  },
  {
    id: 'tires-semislick',
    category: 'tires',
    grade: 'semiSlick',
    name: 'Pneus semi-slick',
    price: 1600,
    unlock: 'part-tires-semislick',
    description: 'Composto macio de competição homologado para rua. Precisa de temperatura.',
    physics: 'μ de pico ≈ 1,32 a 85 °C (no mínimo +16 % sobre o pneu original já na largada, ainda frio), perde aderência fora da temperatura; montado em roda forjada leve: −0,03 kg·m².',
    muPeak: 1.32,
    B: 10,
    C: 1.55,
    E: 0.2,
    wheelInertiaAddKgM2: -0.03,
    rollingResistanceAdd: 0,
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

/** Dyno Lab hardware: fits the classic and the modern engines (the parts are not engine specific). */
const DYNO_LAB_PARTS: readonly PartDef[] = [
  {
    id: 'valve-springs',
    category: 'engine-valvetrain',
    name: 'Molas de válvula reforçadas',
    price: 700,
    unlock: 'part-cam',
    modernUnlock: 'c2-engine-family',
    description: 'Molas duplas de carga maior com pratos de cromo-molibdênio: as válvulas param de flutuar mais alto.',
    physics:
      'Rotação recomendada e limite mecânico +400 rpm (o motor aguenta girar mais antes de as válvulas baterem). Não muda o corte nem a potência: o corte só sobe na ECU programável, dentro do novo limite.',
    safeRpmAdd: 400,
  },
  {
    id: 'launch-control',
    category: 'electronics-launch',
    name: 'Controle de largada (two-step)',
    price: 900,
    unlock: 'part-clutch',
    modernUnlock: 'c2-gearbox',
    compat: { transmissions: ['manual', 'dual-clutch'] },
    description: 'Módulo two-step: segura o motor numa rotação fixa na linha com corte de centelha suave.',
    physics:
      'A embreagem automática (ou o pacote da dupla embreagem) morde a +400 rpm sobre a rotação de largada original, e a rotação de largada passa a ser ajustável no Dyno Lab. No automático com conversor não existe: lá a largada é o estol do conversor.',
    launchRpmAdd: 400,
  },
];

export const PARTS: readonly PartDef[] = [...BASE_PARTS, ...EXPANDED_PARTS, ...DYNO_LAB_PARTS, ...CELTA_TURBO_COMPRESSION];

/** Every part of every resolver version (ids are unique across versions). */
export const ALL_PARTS: readonly PartDef[] = [
  ...PARTS, ...CHAPTER2_PARTS, ...CHAPTER3_PARTS, ...MODERN_BREATHING_PARTS,
  ...MODERN_DRIVELINE_PARTS, ...MODERN_FUEL_PARTS, ...MODERN_TOP_END_PARTS, ...MODERN_INTERNAL_PARTS,
  ...MODERN_IGNITION_PARTS,
  ...MODERN_CONVERSION_PARTS,
  ...MODERN_TURBO_PARTS, ...MODERN_INTERCOOLER_PARTS,
];

export function findPart(id: string): PartDef | undefined {
  return ALL_PARTS.find((p) => p.id === id);
}

/** Part lookup of one resolver version: v1 only knows the Chapter 1 catalogue. */
export function findPartForVersion(id: string, version: 1 | 2): PartDef | undefined {
  const p = findPart(id);
  return p && (p.since ?? 1) <= version ? p : undefined;
}
