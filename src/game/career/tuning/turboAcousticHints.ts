import type { AcousticConfig, CarConfig } from '../../../data/schema';

type Hints = NonNullable<AcousticConfig['turbo']>;

const CLASSIC_KITS: Readonly<Record<string, Hints['kit']>> = {
  'turbo-basic': 'basic',
  'turbo-street': 'street',
  'turbo-medium': 'medium',
  'turbo-strong': 'strong',
};
const TURBINES: Readonly<Record<string, Hints['turbine']>> = {
  'turbine-small': 'small',
  'turbine-medium': 'medium',
  'turbine-medium-high': 'medium-high',
  'turbine-large': 'large',
};

/**
 * Turbo Acoustics 2.0 hardware hints of a resolved build (written into `car.acoustic.turbo` by the
 * build resolvers). Descriptive only — taken from the parts actually installed, never invented:
 * - kit / stage / turbine size from the turbo parts;
 * - intake path from the filter / airbox parts (element in the stock box, cone, direct inlet);
 * - charge-air volume from the intercooler parts that declare one (`volumeAddL`);
 * - wastegate topology: the classic wastegate parts are external valves (their description says so)
 *   and are treated as plumbed back into the exhaust; nothing in the catalogue is an open-dump
 *   "screamer", so 'external-open' is never produced here (lab configurations only).
 * Returns undefined for an NA build or a car with no relevant part (stock cars stay byte-identical).
 */
export function turboAcousticHints(car: CarConfig, partIds: readonly string[], volumeOf: (id: string) => number | undefined = () => undefined): Hints | undefined {
  if (car.engine.induction !== 'turbo') return undefined;
  const h: Hints = {};
  for (const id of partIds) {
    if (CLASSIC_KITS[id]) h.kit = CLASSIC_KITS[id];
    else if (TURBINES[id]) h.turbine = TURBINES[id];
    else if (id.startsWith('conversion-turbo-')) {
      h.kit = 'conversion';
      h.stage = Number(id.slice(-1)) || 1;
    } else if (id.startsWith('factory-turbo-')) {
      h.kit = 'factory';
      h.stage = Number(id.slice(-1)) || 1;
    } else if (id === 'turbo-hybrid') {
      h.kit = 'factory';
      h.stage = 2;
    } else if (id === 'filter-direct' || id === 'intake-direct-turbo') h.intake = 'open';
    else if (id === 'filter-cone') h.intake = 'cone';
    else if (id === 'filter-sport' || id === 'filter-v6-flow' || id.startsWith('intake-filter-') || id.startsWith('airbox-') || id.startsWith('intake-airbox-')) {
      if (h.intake !== 'open' && h.intake !== 'cone') h.intake = 'sport-element';
      const tier = Number(id.match(/-s(\d)$/)?.[1] ?? 0);
      if (tier) h.intakeExposure = Math.max(h.intakeExposure ?? 0, 0.1 * tier);
    } else if (id === 'wastegate-basic' || id === 'wastegate-adjust' || id === 'wastegate-race') h.wastegate = 'external-recirculated';
    const v = volumeOf(id);
    if (v && v > 0) h.chargeVolumeAddL = Math.round(((h.chargeVolumeAddL ?? 0) + v) * 100) / 100;
  }
  return Object.keys(h).length ? h : undefined;
}
