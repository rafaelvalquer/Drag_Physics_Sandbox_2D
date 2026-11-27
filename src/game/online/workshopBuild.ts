import { physicalSlotOf } from '../career/tuning/partProgression';
import { findPart, type PartCategory } from '../career/tuning/parts';
import { PREPARATION_TREES } from './preparation';

export function onlineWorkshopTree(baseCarId: string, version: number) {
  const tree = PREPARATION_TREES.get(baseCarId);
  return tree?.version === version ? tree : undefined;
}

export function replaceOnlinePart(installed: readonly string[], partId: string): { parts: string[]; replaced: string | null } {
  const slot = physicalSlotOf(findPart(partId)!);
  const replaced = installed.find((id) => physicalSlotOf(findPart(id)!) === slot) ?? null;
  return { parts: [...installed.filter((id) => id !== replaced), partId], replaced };
}

export function restoreOnlineSlots(installed: readonly string[], slots: readonly (PartCategory | string)[]) {
  const removed = installed.filter((id) => slots.includes(physicalSlotOf(findPart(id)!)));
  return { removed, parts: installed.filter((id) => !removed.includes(id)) };
}
