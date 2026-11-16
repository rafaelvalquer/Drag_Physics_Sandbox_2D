import type { CarConfig } from '../../data/schema';
import { CARS, LAB_CARS } from '../../data/cars/index';
import { CAMPAIGN_CARS } from '../../data/cars/campaign';
import { BUILT_IN_SANDBOX_PRESETS } from '../../data/cars/sandboxPresets';

export type CalibrationVariant = 'stock' | 'aspirated-build' | 'turbo-build';
export type CalibrationScope = 'general' | 'campaign' | 'fictional' | 'lab' | 'all';

export interface AudioCalibrationCase {
  id: string;
  baseCarId: string;
  car: CarConfig;
  variant: CalibrationVariant;
  description: string;
  catalog: 'campaign' | 'fictional' | 'experimental';
}

/** Registry shared by offline tools; prepared engines use exactly the game's BuildResolver. */
export const CALIBRATION_CASES: readonly AudioCalibrationCase[] = [
  ...LAB_CARS.map((car): AudioCalibrationCase => ({
    id: car.id, baseCarId: car.id, car, variant: 'stock',
    description: car.engine.name,
    catalog: CAMPAIGN_CARS.some((c) => c.id === car.id) ? 'campaign'
      : CARS.some((c) => c.id === car.id) ? 'fictional' : 'experimental',
  })),
  ...BUILT_IN_SANDBOX_PRESETS.map((preset): AudioCalibrationCase => ({
    id: preset.id, baseCarId: preset.baseCarId, car: preset.car,
    variant: preset.car.engine.induction === 'turbo' ? 'turbo-build' : 'aspirated-build',
    description: preset.label, catalog: 'campaign',
  })),
];

export function listCalibrationCases(filters: {
  scope?: CalibrationScope;
  car?: string;
  variant?: CalibrationVariant | 'all';
} = {}): AudioCalibrationCase[] {
  const scope = filters.scope ?? 'general';
  return CALIBRATION_CASES.filter((c) => {
    if (filters.car && filters.car !== 'all' && filters.car !== c.id && filters.car !== c.baseCarId) return false;
    if (filters.variant && filters.variant !== 'all' && filters.variant !== c.variant) return false;
    if (scope === 'campaign') return c.catalog === 'campaign';
    if (scope === 'fictional') return c.catalog === 'fictional';
    if (scope === 'general') return CARS.some((b) => b.id === c.id);
    if (scope === 'lab') return c.variant === 'stock';
    return true;
  });
}
