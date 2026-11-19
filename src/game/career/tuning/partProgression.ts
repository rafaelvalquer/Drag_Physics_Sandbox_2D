import type { PartCategory, PartDef } from './parts';

export type PartTier = 1 | 2 | 3;

export interface PartProgression {
  tier: PartTier;
  group: string;
  specialization: 'rua' | 'aspirado' | 'turbo' | 'competição';
}

/** Labels for established sequences. Existing parts retain their IDs, effects and unlocks. */
const existing: Readonly<Record<string, PartProgression>> = {
  'cam-sport': { tier: 1, group: 'classic-na-cam', specialization: 'aspirado' },
  'cam-street-strong': { tier: 2, group: 'classic-na-cam', specialization: 'aspirado' },
  'cam-na-race': { tier: 3, group: 'classic-na-cam', specialization: 'aspirado' },
  'cam-turbo': { tier: 1, group: 'classic-turbo-cam', specialization: 'turbo' },
  'ecu-stage1': { tier: 1, group: 'factory-turbo-ecu', specialization: 'turbo' },
  'ecu-stage2': { tier: 2, group: 'factory-turbo-ecu', specialization: 'turbo' },
  'ecu-stage3': { tier: 3, group: 'factory-turbo-ecu', specialization: 'turbo' },
  'ecu-stage1-na': { tier: 1, group: 'modern-na-ecu', specialization: 'aspirado' },
};

export function progressionOf(part: PartDef): PartProgression | undefined {
  return part.progression ?? existing[part.id];
}

const equivalentSlots: Partial<Record<PartCategory, PartCategory>> = {
  'cylinder-head': 'engine-head',
  pistons: 'engine-internals',
  flywheel: 'engine-flywheel',
  ecu: 'electronics-ecu',
  intercooler: 'turbo-intercooler',
  'boost-control': 'turbo-boost',
  gearbox: 'transmission-gearbox',
  suspension: 'chassis-suspension',
};

export function physicalSlotOfCategory(category: PartCategory): PartCategory {
  return equivalentSlots[category] ?? category;
}

/** Physical taxonomy for audits. Legacy resolver occupancy is still defined by its category. */
export function physicalSlotOf(part: PartDef): PartCategory {
  if (part.category === 'turbo' && 'upgrade' in part) return 'turbo-turbine';
  return physicalSlotOfCategory(part.category);
}
