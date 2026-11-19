import type { MechanicalMods, PartCategory, PartDef } from './parts';

const supportedSlots: readonly PartCategory[] = [
  'intake-airbox', 'intake-throttle', 'exhaust-header', 'exhaust-pipe', 'exhaust-muffler',
];

export function isModernBreathingPart(part: PartDef): boolean {
  return 'modernBreathing' in part && part.modernBreathing === true && part.since === 2 &&
    !!part.compat?.families?.length && supportedSlots.includes(part.category);
}

/** Section work and a complete system overlap. Downpipe restriction is separate. */
export function exhaustPressureAfterSections(
  stockKPa: number,
  presetKPa: number,
  independentDownpipe: boolean,
  mod: MechanicalMods,
): number {
  const presetReduction = stockKPa - Math.min(stockKPa, presetKPa);
  const sectionReduction = mod.backPressureReductionKPa ?? 0;
  return stockKPa - (independentDownpipe ? presetReduction + sectionReduction : Math.max(presetReduction, sectionReduction));
}
