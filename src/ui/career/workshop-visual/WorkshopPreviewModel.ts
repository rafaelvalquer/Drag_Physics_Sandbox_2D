import { findCampaignCar } from '../../../data/cars/campaign';
import { buildVersionFor } from '../../../game/career/CareerController';
import type { CareerSave, OwnedCar } from '../../../game/career/CareerState';
import { resolveBuild, type BuildResult } from '../../../game/career/tuning/BuildResolver';
import type { BuildTune } from '../../../game/career/tuning/buildCommon';
import { findPart } from '../../../game/career/tuning/parts';
import { reconcileTune } from '../../../game/career/tuning/TuningCapabilities';
import { campaignEligibility, campaignPreviewPolicy, campaignSnapshot } from '../../workshop/CareerWorkshopAdapter';
import { previewWorkshop } from '../../workshop/WorkshopPreviewModel';

export { isStockId, stockCategory, STOCK_PREFIX, type PartPreview } from '../../workshop/WorkshopPreviewModel';
export const statusOf = campaignEligibility;

export function keptTune(car: OwnedCar, parts: readonly string[]): BuildTune {
  if (!car.tune) return {};
  return reconcileTune(findCampaignCar(car.baseCarId)!, parts, buildVersionFor(car, parts), car.tune).tune;
}

export function resolveOwned(car: OwnedCar, parts: readonly string[], tune = keptTune(car, parts)): BuildResult {
  return resolveBuild(findCampaignCar(car.baseCarId)!, parts, tune, buildVersionFor(car, parts));
}

export function previewSelection(save: CareerSave, car: OwnedCar, selected: string) {
  const part = findPart(selected);
  return previewWorkshop(campaignSnapshot(save, car, 1), campaignPreviewPolicy(save, car),
    selected, !part || campaignEligibility(save, car, part).state !== 'locked');
}
