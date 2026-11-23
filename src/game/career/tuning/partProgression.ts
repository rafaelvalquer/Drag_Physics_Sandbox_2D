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
  'cam-turbo-street': { tier: 1, group: 'classic-turbo-cam', specialization: 'turbo' },
  'cam-turbo-sport': { tier: 2, group: 'classic-turbo-cam', specialization: 'turbo' },
  'cam-turbo': { tier: 3, group: 'classic-turbo-cam', specialization: 'turbo' },
  'wastegate-basic': { tier: 1, group: 'classic-wastegate', specialization: 'turbo' },
  'wastegate-adjust': { tier: 2, group: 'classic-wastegate', specialization: 'turbo' },
  'wastegate-race': { tier: 3, group: 'classic-wastegate', specialization: 'turbo' },
  'boost-street': { tier: 1, group: 'classic-boost-control', specialization: 'turbo' },
  'boost-classic-sport': { tier: 2, group: 'classic-boost-control', specialization: 'turbo' },
  'boost-race': { tier: 3, group: 'classic-boost-control', specialization: 'turbo' },
  'ecu-remap': { tier: 1, group: 'classic-ecu', specialization: 'rua' },
  'ecu-street': { tier: 2, group: 'classic-ecu', specialization: 'rua' },
  'ecu-race': { tier: 3, group: 'classic-ecu', specialization: 'rua' },
  'tires-sport': { tier: 1, group: 'tire-compound', specialization: 'rua' },
  'tires-semislick': { tier: 2, group: 'tire-compound', specialization: 'rua' },
  'tires-slick': { tier: 3, group: 'tire-compound', specialization: 'rua' },
  'tires-classic-slick': { tier: 3, group: 'tire-compound', specialization: 'rua' },
  'tires-width-1': { tier: 1, group: 'tire-width', specialization: 'rua' },
  'tires-width-2': { tier: 2, group: 'tire-width', specialization: 'rua' },
  'tires-width-3': { tier: 3, group: 'tire-width', specialization: 'rua' },
  'tires-pressure-street': { tier: 1, group: 'tire-pressure', specialization: 'rua' },
  'tires-pressure-sport': { tier: 2, group: 'tire-pressure', specialization: 'rua' },
  'tires-pressure-track': { tier: 3, group: 'tire-pressure', specialization: 'rua' },
  'weight-light': { tier: 1, group: 'weight-reduction', specialization: 'rua' },
  'weight-medium': { tier: 2, group: 'weight-reduction', specialization: 'rua' },
  'weight-race': { tier: 3, group: 'weight-reduction', specialization: 'rua' },
  'suspension-classic-street': { tier: 1, group: 'launch-suspension', specialization: 'rua' },
  'suspension-drag': { tier: 2, group: 'launch-suspension', specialization: 'rua' },
  'suspension-classic-race': { tier: 3, group: 'launch-suspension', specialization: 'rua' },
  'header-4x1': { tier: 1, group: 'classic-exhaust-header', specialization: 'rua' },
  'header-421': { tier: 2, group: 'classic-exhaust-header', specialization: 'rua' },
  'header-classic-race': { tier: 3, group: 'classic-exhaust-header', specialization: 'rua' },
  'pipe-sport': { tier: 1, group: 'classic-exhaust-pipe', specialization: 'rua' },
  'pipe-classic-flow': { tier: 2, group: 'classic-exhaust-pipe', specialization: 'rua' },
  'pipe-race': { tier: 3, group: 'classic-exhaust-pipe', specialization: 'rua' },
  'muffler-sport': { tier: 1, group: 'classic-exhaust-muffler', specialization: 'rua' },
  'muffler-classic-flow': { tier: 2, group: 'classic-exhaust-muffler', specialization: 'rua' },
  'muffler-straight': { tier: 3, group: 'classic-exhaust-muffler', specialization: 'rua' },
  'exhaust-sport': { tier: 1, group: 'classic-exhaust-system', specialization: 'rua' },
  'fuel-classic-regulation': { tier: 1, group: 'classic-fuel', specialization: 'rua' },
  injectors: { tier: 2, group: 'classic-fuel', specialization: 'rua' },
  'fuel-pump': { tier: 3, group: 'classic-fuel', specialization: 'rua' },
  'ignition-street': { tier: 1, group: 'classic-ignition', specialization: 'rua' },
  'ignition-classic-sport': { tier: 2, group: 'classic-ignition', specialization: 'rua' },
  'ignition-race': { tier: 3, group: 'classic-ignition', specialization: 'rua' },
  'valve-springs': { tier: 2, group: 'classic-valve-springs', specialization: 'rua' },
  'clutch-reinforced': { tier: 1, group: 'classic-clutch', specialization: 'rua' },
  'clutch-ceramic-street': { tier: 2, group: 'classic-clutch', specialization: 'rua' },
  'clutch-ceramic-race': { tier: 3, group: 'classic-clutch', specialization: 'rua' },
  'differential-short': { tier: 1, group: 'classic-final-drive', specialization: 'rua' },
  'diff-short-strong': { tier: 2, group: 'classic-final-drive', specialization: 'rua' },
  'diff-classic-race': { tier: 3, group: 'classic-final-drive', specialization: 'rua' },
  'gearbox-classic-sport': { tier: 1, group: 'classic-manual-gearbox', specialization: 'rua' },
  'gearbox-street': { tier: 2, group: 'classic-manual-gearbox', specialization: 'rua' },
  'gearbox-race': { tier: 3, group: 'classic-manual-gearbox', specialization: 'rua' },
  'ecu-stage1': { tier: 1, group: 'factory-turbo-ecu', specialization: 'turbo' },
  'ecu-stage2': { tier: 2, group: 'factory-turbo-ecu', specialization: 'turbo' },
  'ecu-stage3': { tier: 3, group: 'factory-turbo-ecu', specialization: 'turbo' },
};

// Shared original parts belong to classic series only. They remain standalone options on modern cars.
const sharedClassicSeries = new Set(['filter-sport', 'exhaust-sport', 'valve-springs', 'clutch-reinforced', 'differential-short']);

export function progressionOf(part: PartDef, family?: string): PartProgression | undefined {
  if (family && family !== 'legacy' && sharedClassicSeries.has(part.id)) return undefined;
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
