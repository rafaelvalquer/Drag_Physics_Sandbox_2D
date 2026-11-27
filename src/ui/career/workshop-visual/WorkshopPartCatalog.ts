import type { CareerSave, OwnedCar } from '../../../game/career/CareerState';
import type { PartDef } from '../../../game/career/tuning/parts';
import { campaignParts, campaignSnapshot } from '../../workshop/CareerWorkshopAdapter';
import { makeWorkshopCatalog } from '../../workshop/WorkshopCatalogModel';
import type { WorkshopEligibility } from '../../workshop/WorkshopAdapter';
import { resolveOwned } from './WorkshopPreviewModel';
import { withPartId } from '../../../game/career/tuning/ProjectRequirements';

export const visiblePartsOf = campaignParts;

export function buildCatalog(save: CareerSave, car: OwnedCar, statusOf: (part: PartDef) => WorkshopEligibility) {
  return makeWorkshopCatalog(campaignSnapshot(save, car, 1), campaignParts(car), statusOf);
}

export function fitsCar(car: OwnedCar, part: PartDef): boolean {
  return resolveOwned(car, car.installedParts.includes(part.id) ? car.installedParts : withPartId(car.installedParts, part.id).parts).ok;
}
