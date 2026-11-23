import { CHAPTER1_CARS } from '../../../data/cars/campaign';
import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import type { CarConfig } from '../../../data/schema';
import { Prng } from '../../../core/prng';
import { eventsOf, type CareerTrackId } from '../CareerEvents';
import { isChapterUnlocked } from '../CareerProgression';
import type { CareerSave } from '../CareerState';
import { CHAPTER_1_ID, CHAPTER_2_ID, CHAPTER_3_ID, type ChapterId } from '../chapters';
import { FREE_DISTANCES, FREE_TIERS, type FreeTier } from './FreeEventTypes';

export const FREE_CARS: Record<ChapterId, readonly CarConfig[]> = {
  [CHAPTER_1_ID]: CHAPTER1_CARS,
  [CHAPTER_2_ID]: CHAPTER2_CARS,
  [CHAPTER_3_ID]: CHAPTER3_CARS,
};

export const FREE_TRACKS: Record<ChapterId, readonly CareerTrackId[]> = {
  [CHAPTER_1_ID]: ['distrito-industrial', 'baixada', 'avenida-norte'],
  [CHAPTER_2_ID]: ['patio-das-torres', 'distrito-financeiro', 'corredor-da-liga'],
  [CHAPTER_3_ID]: ['marginal-alta', 'hangar-executivo', 'pier-elite'],
};

export const FREE_CLASS_GATES: Record<ChapterId, Record<FreeTier, number>> = {
  [CHAPTER_1_ID]: { iniciante: 0, rua: 2, preparado: 4, competicao: 6 },
  [CHAPTER_2_ID]: { iniciante: 0, rua: 2, preparado: 4, competicao: 8 },
  [CHAPTER_3_ID]: { iniciante: 0, rua: 2, preparado: 4, competicao: 5 },
};

export function availableFreeTiers(save: Pick<CareerSave, 'completedEventIds'>, chapter: ChapterId): FreeTier[] {
  if (!isChapterUnlocked(save, chapter)) return [];
  return FREE_TIERS.filter((tier) => {
    const order = FREE_CLASS_GATES[chapter][tier];
    return order === 0 || eventsOf(chapter).some((event) => event.order === order && save.completedEventIds.includes(event.id));
  });
}

export function freeDistances(chapter: ChapterId): readonly (typeof FREE_DISTANCES)[number][] {
  return chapter === CHAPTER_3_ID ? FREE_DISTANCES : ['eighth', 'quarter'];
}

export function pick<T>(items: readonly T[], rng: Prng): T {
  return items[Math.floor(rng.next() * items.length)]!;
}

export function freeSeed(text: string, initial = 2166136261): number {
  let hash = initial;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}
