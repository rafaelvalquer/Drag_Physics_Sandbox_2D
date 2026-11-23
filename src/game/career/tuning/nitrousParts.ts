import type { NitrousKitPart } from './parts';

/**
 * Energy released per kilogram of N₂O that can be burnt with the right amount of fuel (J/kg).
 * Reference: ≈ 100 hp ↔ 0.006 kg/s of N₂O plus the fuel to burn its oxygen. The kits below are
 * sized from it: nominal power = maxFlowKgS × this × ENGINE_EFFICIENCY_REF.
 */
export const NITROUS_ENERGY_J_PER_KG = 12.3e6;

/** Lowest / highest flow fraction a tune may ask for (of the kit's maximum). */
export const NITROUS_FLOW_MIN = 0.25;
export const NITROUS_FLOW_MAX = 1;
/** Ramp-in range of a stage (s). */
export const NITROUS_RAMP_MAX_S = 3;
/** Share of the cylinder that stage 1 may take in the dual mode (stage 2 gets the rest). */
export const NITROUS_SHARE_MIN = 0.2;
export const NITROUS_SHARE_MAX = 0.8;
export const NITROUS_SHARE_STEP = 0.05;

const hp = (cv: number): number => cv * 735.5;

/** Flow (kg/s) that gives `cv` of extra power at the reference energy. */
const flowFor = (cv: number): number => Math.round((hp(cv) / NITROUS_ENERGY_J_PER_KG) * 1e5) / 1e5;

/**
 * Four kits, one per tier. The duration at full flow is ≈ 7–8 s for every kit (capacity ÷ flow): the
 * stronger kits carry a bigger cylinder, not a longer run. A lower flow lasts longer and pushes less.
 */
export const NITROUS_KITS: readonly NitrousKitPart[] = [
  {
    id: 'nitrous-street',
    category: 'nitrous',
    name: 'Street Shot',
    price: 2500,
    unlock: 'nitrous-street',
    description: 'Kit de N₂O básico: um injetor seco e um cilindro pequeno, para um empurrão curto.',
    physics: 'Até +45 cv no pico de vazão, cilindro de 0,02 kg (≈ 7 s a plena vazão), 6 kg a mais no carro. Uma descarga ou duas.',
    chapter: 1,
    kit: { level: 1, maxPowerCvRef: 45, capacityKg: 0.02, maxFlowKgS: flowFor(45), massKg: 6, fuelNeed: 1, minRpm: 3200, rampControl: 0.5 },
  },
  {
    id: 'nitrous-wet',
    category: 'nitrous',
    name: 'Wet Performance',
    price: 7500,
    unlock: 'nitrous-wet',
    description: 'Sistema úmido: o combustível entra junto com o N₂O, com mais vazão e um cilindro maior.',
    physics: 'Até +90 cv no pico de vazão, cilindro de 0,04 kg (≈ 7,5 s a plena vazão), 9 kg a mais. Pede mais combustível que o Street Shot.',
    chapter: 2,
    kit: { level: 2, maxPowerCvRef: 90, capacityKg: 0.04, maxFlowKgS: flowFor(90), massKg: 9, fuelNeed: 1.1, minRpm: 3000, rampControl: 0.75 },
  },
  {
    id: 'nitrous-progressive',
    category: 'nitrous',
    name: 'Progressive Race',
    price: 15000,
    unlock: 'nitrous-progressive',
    description: 'Controlador progressivo: a vazão sobe em rampa, sem chicotear a tração, e cada estágio é regulado.',
    physics: 'Até +160 cv no pico de vazão, cilindro de 0,075 kg (≈ 7,8 s a plena vazão), 12 kg a mais. Rampas precisas de 0 a 3 s.',
    chapter: 2,
    kit: { level: 3, maxPowerCvRef: 160, capacityKg: 0.075, maxFlowKgS: flowFor(160), massKg: 12, fuelNeed: 1.25, minRpm: 2800, rampControl: 1 },
  },
  {
    id: 'nitrous-direct',
    category: 'nitrous',
    name: 'Direct Port Competition',
    price: 32000,
    unlock: 'nitrous-direct',
    description: 'Injeção direta nos dutos: a maior vazão do catálogo e controle de competição.',
    physics: 'Até +250 cv no pico de vazão, cilindro de 0,115 kg (≈ 7,7 s a plena vazão), 16 kg a mais. Exige alimentação e internos de competição.',
    chapter: 3,
    kit: { level: 4, maxPowerCvRef: 250, capacityKg: 0.115, maxFlowKgS: flowFor(250), massKg: 16, fuelNeed: 1.4, minRpm: 2800, rampControl: 1 },
  },
];

export const NITROUS_KIT_IDS: ReadonlySet<string> = new Set(NITROUS_KITS.map((k) => k.id));

export const isNitrousKitId = (id: string): boolean => NITROUS_KIT_IDS.has(id);

export function findNitrousKit(id: string): NitrousKitPart | undefined {
  return NITROUS_KITS.find((k) => k.id === id);
}
