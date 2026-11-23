import type { MechanicalMods, PartCategory, PartDef } from './parts';

const supportedSlots: readonly PartCategory[] = [
  'intake-airbox', 'intake-throttle', 'exhaust-header', 'exhaust-pipe', 'exhaust-muffler',
];

export function isModernBreathingPart(part: PartDef): boolean {
  return 'modernBreathing' in part && part.modernBreathing === true && part.since === 2 &&
    !!part.compat?.families?.length && supportedSlots.includes(part.category);
}

/** A complete system overlaps its sections. The legacy catless package keeps its saved behavior. */
export function exhaustPressureAfterSections(
  stockKPa: number,
  presetKPa: number,
  legacyCatlessPackage: boolean,
  mod: MechanicalMods,
  downpipeReduction = 0,
): number {
  const presetReduction = stockKPa - Math.min(stockKPa, presetKPa);
  const sectionReduction = mod.backPressureReductionKPa ?? 0;
  return stockKPa - (legacyCatlessPackage
    ? Math.max(presetReduction, downpipeReduction) + sectionReduction
    : Math.max(presetReduction, sectionReduction) + downpipeReduction);
}
