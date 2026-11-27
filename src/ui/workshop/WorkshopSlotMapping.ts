import { physicalSlotOf, physicalSlotOfCategory } from '../../game/career/tuning/partProgression';
import { CATEGORY_LABEL, WORKSHOP_TABS, type PartCategory, type PartDef } from '../../game/career/tuning/parts';

const order = ['engine', 'intake', 'exhaust', 'turbo', 'electronics', 'transmission', 'tires', 'cooling', 'nitrous', 'chassis'];
export const workshopCategories = order.map((id) => WORKSHOP_TABS.find((tab) => tab.id === id)!);

const locations = new Map<PartCategory, string>();
for (const tab of workshopCategories) {
  for (const category of tab.categories) {
    const slot = physicalSlotOfCategory(category);
    if (!locations.has(slot)) locations.set(slot, tab.id);
  }
}

/** Modern factory turbos share a mechanical category with conversion kits, but are a different displayed slot. */
export function workshopLocation(part: PartDef): { category: string; slot: PartCategory } {
  const slot = physicalSlotOf(part);
  return { slot, category: workshopCategoryOf(slot) };
}

export function workshopCategoryOf(category: PartCategory): string {
  const slot = physicalSlotOfCategory(category);
  const tab = locations.get(slot);
  if (!tab) throw new Error(`Slot ausente no catálogo da oficina: ${slot}`);
  return tab;
}

export const workshopSlotLabel = (slot: PartCategory): string => CATEGORY_LABEL[slot];
