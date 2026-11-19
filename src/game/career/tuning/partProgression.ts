import type { PartCategory, PartDef } from './parts';

export type PartTier = 1 | 2 | 3;

export interface PartProgression {
  tier: PartTier;
  group: string;
  specialization: 'rua' | 'aspirado' | 'turbo' | 'competição';
  /** Preparation that increases a safe operating envelope rather than torque at fixed settings. */
  objective?: 'boost-headroom';
}

/** Labels for established sequences. Existing parts retain their IDs, effects and unlocks. */
const existing: Readonly<Record<string, PartProgression>> = {
  'filter-sport': { tier: 1, group: 'classic-filter', specialization: 'rua' },
  'filter-cone': { tier: 2, group: 'classic-filter', specialization: 'rua' },
  'filter-direct': { tier: 3, group: 'classic-filter', specialization: 'rua' },
  'manifold-sport': { tier: 1, group: 'classic-manifold', specialization: 'aspirado' },
  'manifold-highflow': { tier: 2, group: 'classic-manifold', specialization: 'aspirado' },
  'manifold-classic-race': { tier: 3, group: 'classic-manifold', specialization: 'aspirado' },
  'throttle-rework': { tier: 1, group: 'classic-throttle', specialization: 'rua' },
  'throttle-large': { tier: 2, group: 'classic-throttle', specialization: 'rua' },
  'throttle-classic-competition': { tier: 3, group: 'classic-throttle', specialization: 'rua' },
  'airbox-performance': { tier: 1, group: 'classic-airbox', specialization: 'rua' },
  'airbox-classic-sport': { tier: 2, group: 'classic-airbox', specialization: 'rua' },
  'airbox-race': { tier: 3, group: 'classic-airbox', specialization: 'rua' },
  'head-classic-street': { tier: 1, group: 'classic-head', specialization: 'aspirado' },
  'head-street': { tier: 2, group: 'classic-head', specialization: 'aspirado' },
  'head-race': { tier: 3, group: 'classic-head', specialization: 'aspirado' },
  'flywheel-light': { tier: 1, group: 'classic-flywheel', specialization: 'rua' },
  'flywheel-classic-balanced': { tier: 2, group: 'classic-flywheel', specialization: 'rua' },
  'flywheel-sport': { tier: 3, group: 'classic-flywheel', specialization: 'rua' },
  'cam-sport': { tier: 1, group: 'classic-na-cam', specialization: 'aspirado' },
  'cam-street-strong': { tier: 2, group: 'classic-na-cam', specialization: 'aspirado' },
  'cam-na-race': { tier: 3, group: 'classic-na-cam', specialization: 'aspirado' },
  'cam-turbo': { tier: 1, group: 'classic-turbo-cam', specialization: 'turbo' },
  'wastegate-basic': { tier: 1, group: 'classic-wastegate', specialization: 'turbo' },
  'wastegate-adjust': { tier: 2, group: 'classic-wastegate', specialization: 'turbo' },
  'wastegate-race': { tier: 3, group: 'classic-wastegate', specialization: 'turbo' },
  'boost-street': { tier: 1, group: 'classic-boost-control', specialization: 'turbo' },
  'boost-classic-sport': { tier: 2, group: 'classic-boost-control', specialization: 'turbo' },
  'boost-race': { tier: 3, group: 'classic-boost-control', specialization: 'turbo' },
  'ecu-remap': { tier: 1, group: 'classic-ecu', specialization: 'rua' },
  'ecu-street': { tier: 2, group: 'classic-ecu', specialization: 'rua' },
  'ecu-race': { tier: 3, group: 'classic-ecu', specialization: 'rua' },
  'ecu-stage1': { tier: 1, group: 'factory-turbo-ecu', specialization: 'turbo' },
  'ecu-stage2': { tier: 2, group: 'factory-turbo-ecu', specialization: 'turbo' },
  'ecu-stage3': { tier: 3, group: 'factory-turbo-ecu', specialization: 'turbo' },
};

export function progressionOf(part: PartDef, family?: string): PartProgression | undefined {
  // The original sport filter is shared with modern cars as a standalone option.
  if (part.id === 'filter-sport' && family && family !== 'legacy') return undefined;
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
