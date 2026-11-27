import { familyOf } from '../../game/career/tuning/BuildResolverV2';
import { physicalSlotOf, physicalSlotOfCategory, progressionOf, type PartProgression } from '../../game/career/tuning/partProgression';
import { findPart, type PartCategory, type PartDef } from '../../game/career/tuning/parts';
import { CATEGORY_HELP } from './WorkshopCopy';
import type { WorkshopEligibility, WorkshopSnapshot } from './WorkshopAdapter';
import { workshopCategories, workshopCategoryOf, workshopLocation, workshopSlotLabel } from './WorkshopSlotMapping';

export interface CatalogPart {
  part: PartDef;
  status: WorkshopEligibility;
  progression?: PartProgression;
  searchText: string;
}
export interface CatalogGroup {
  category: PartCategory;
  label: string;
  stockLabel: string;
  stockInUse: boolean;
  parts: CatalogPart[];
}
export interface CatalogTab {
  id: string;
  label: string;
  icon: string;
  installed: number;
  groups: CatalogGroup[];
}
export interface Catalog {
  tabs: CatalogTab[];
  byId: Map<string, CatalogPart>;
  tabOf(category: PartCategory): string | undefined;
}

function stockLabel(slot: PartCategory, turbo: boolean): string {
  if (slot === 'nitrous') return 'Sem nitro';
  if (slot === 'turbo') return 'Sem kit turbo';
  if (!turbo && slot === 'turbo-intercooler') return 'Sem intercooler';
  if (!turbo && (slot === 'turbo-turbine' || slot === 'turbo-wastegate' || slot === 'turbo-boost')) return 'Sem preparação de turbo';
  return `${workshopSlotLabel(slot)} original`;
}

export function makeWorkshopCatalog(s: WorkshopSnapshot, parts: readonly PartDef[], eligibility: (part: PartDef) => WorkshopEligibility): Catalog {
  const family = familyOf(s.baseCar);
  const turbo = s.baseCar.engine.induction === 'turbo';
  const grouped = new Map<PartCategory, CatalogPart[]>();
  const byId = new Map<string, CatalogPart>();
  for (const part of parts) {
    if (byId.has(part.id)) continue;
    const { category, slot } = workshopLocation(part);
    const progression = progressionOf(part, family, s.baseCar.id);
    const label = workshopCategories.find((tab) => tab.id === category)?.label;
    const searchText = [part.name, workshopSlotLabel(slot), CATEGORY_HELP[part.category], label, progression && `stage ${progression.tier} ${progression.specialization}`, part.id].filter(Boolean).join(' ');
    const item = { part, status: eligibility(part), progression, searchText };
    byId.set(part.id, item);
    const entries = grouped.get(slot);
    if (entries) entries.push(item);
    else grouped.set(slot, [item]);
  }
  const occupied = new Set(s.installedParts.map(findPart).filter((p): p is PartDef => !!p).map(physicalSlotOf));
  const tabs = workshopCategories.flatMap((tab): CatalogTab[] => {
    const slots = [...new Set(tab.categories.map(physicalSlotOfCategory))];
    const groups = slots.filter((slot) => grouped.has(slot) && workshopCategoryOf(slot) === tab.id).map((category) => ({
      category, label: workshopSlotLabel(category), stockLabel: stockLabel(category, turbo), stockInUse: !occupied.has(category),
      parts: grouped.get(category)!.sort((a, b) => (a.progression?.tier ?? Infinity) - (b.progression?.tier ?? Infinity)),
    }));
    if (!groups.length) return [];
    return [{ id: tab.id, label: tab.label, icon: tab.icon, installed: groups.filter((g) => !g.stockInUse).length, groups }];
  });
  return { tabs, byId, tabOf: (c) => tabs.find((t) => t.id === workshopCategoryOf(c))?.id };
}
