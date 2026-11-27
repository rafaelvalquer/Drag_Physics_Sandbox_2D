import type { AcousticVehicleConfig } from '../AcousticConfig';
import { turboProfileOf } from './TurboAcoustics';
import { TURBO_MODELS, type TurboAcousticModel } from './TurboAcousticTypes';
import { TURBO_COMPARISON_DB } from './TurboComparisonLevels';

/** Offline A-weighted corrections from the report's common drive, used only by the Sandbox panel. */
export function comparisonGain(config: AcousticVehicleConfig, model: TurboAcousticModel): number {
  const profile = turboProfileOf(config);
  if (!profile) return 1;
  const key = `${config.quality}/${profile.baseId}`;
  const db = TURBO_COMPARISON_DB[`${key}/${config.engine.id}`] ?? TURBO_COMPARISON_DB[key];
  return 10 ** ((db?.[TURBO_MODELS.indexOf(model)] ?? 0) / 20);
}
