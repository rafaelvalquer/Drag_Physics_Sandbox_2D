import { ALL_EVENTS, eventsOf, type CareerEventDef } from './CareerEvents';
import type { CareerSave } from './CareerState';
import { CHAPTER_1_ID, CHAPTERS, chapterOf, type ChapterId } from './chapters';
import type { PartCategory, PartDef, UnlockId } from './tuning/parts';

type Progress = Pick<CareerSave, 'completedEventIds'>;

/** What the career's progress has unlocked so far (derived from the completed events of every chapter). */
export function unlocksOf(save: Progress): Set<UnlockId> {
  const s = new Set<UnlockId>();
  for (const e of ALL_EVENTS) if (save.completedEventIds.includes(e.id)) for (const u of e.unlocks) s.add(u);
  return s;
}

export function isChapterComplete(save: Progress, chapter: ChapterId = CHAPTER_1_ID): boolean {
  return eventsOf(chapter).every((e) => save.completedEventIds.includes(e.id));
}

/** A chapter opens when the chapter before it is complete (derived; the save mirrors it in unlockedChapters). */
export function isChapterUnlocked(save: Progress, chapter: ChapterId): boolean {
  const c = chapterOf(chapter);
  return !c.after || isChapterComplete(save, c.after);
}

export function unlockedChaptersOf(save: Progress): ChapterId[] {
  return CHAPTERS.filter((c) => isChapterUnlocked(save, c.id)).map((c) => c.id);
}

export type EventStatus = 'locked' | 'available' | 'completed' | 'final';

export function eventStatus(save: Progress, ev: CareerEventDef): EventStatus {
  if (save.completedEventIds.includes(ev.id)) return 'completed';
  if (!isChapterUnlocked(save, ev.chapter)) return 'locked';
  const prev = eventsOf(ev.chapter).find((e) => e.order === ev.order - 1);
  if (prev && !save.completedEventIds.includes(prev.id)) return 'locked';
  if (ev.requires && !unlocksOf(save).has(ev.requires)) return 'locked';
  return ev.finale ? 'final' : 'available';
}

/** The next event of a chapter to race (first not completed and not locked), or null when it is done. */
export function nextEvent(save: Progress, chapter: ChapterId = CHAPTER_1_ID): CareerEventDef | null {
  return (
    eventsOf(chapter).find((e) => {
      const s = eventStatus(save, e);
      return s === 'available' || s === 'final';
    }) ?? null
  );
}

/** Shop requirements of a part: its own unlock plus the workshop it is installed in. */
export function partRequirements(p: PartDef): UnlockId[] {
  const req: UnlockId[] = ['workshop-basic', p.unlock];
  if (p.category === 'clutch' || p.category === 'differential' || p.category === 'transmission-gearbox' || p.category === 'gearbox' || p.category === 'awd')
    req.push('workshop-transmission');
  return [...new Set(req)];
}

/** Highest career chapter whose content exists and is open in this save (slot-catalogue tiers). */
function availableChapterNumber(save: Progress): number {
  return CHAPTERS.filter((c) => isChapterUnlocked(save, c.id)).reduce((n, c) => Math.max(n, c.number), 1);
}

export function isPartUnlocked(save: Progress, p: PartDef): boolean {
  if ('chapter' in p && p.chapter > availableChapterNumber(save)) return false;
  const u = unlocksOf(save);
  return partRequirements(p).every((r) => u.has(r));
}

/** Boost setting of the kit turbo on the dyno (chapter 1 tuners). */
export function canTuneBoost(save: Progress): boolean {
  return unlocksOf(save).has('engine-tuners');
}

export type PartState = 'installed' | 'owned' | 'available' | 'unaffordable' | 'locked' | 'stock';

export interface PartStatus {
  state: PartState;
  /** Short pill text (pt-BR). */
  label: string;
  /** Longer explanation (tooltip / locked reason). */
  detail: string;
}

/** Event that grants an unlock (for "win event N to unlock" messages). */
export function eventUnlocking(u: UnlockId): CareerEventDef | undefined {
  return ALL_EVENTS.find((e) => e.unlocks.includes(u));
}

/** Short label of an event: "Noite 3" in chapter 1, "Etapa 3" in chapter 2. */
export function eventLabel(ev: CareerEventDef): string {
  return `${chapterOf(ev.chapter).eventWord} ${ev.order}`;
}

/**
 * Shop state of a part for one owned car, derived only from the save (installed build, inventory,
 * credits, completed events) — never from a UI flag.
 */
export function partStatus(
  save: Pick<CareerSave, 'completedEventIds' | 'inventoryPartIds' | 'credits'>,
  car: { baseCarId: string; installedParts: readonly string[] },
  p: PartDef,
): PartStatus {
  if (car.installedParts.includes(p.id)) return { state: 'installed', label: 'Em uso', detail: 'Instalada neste carro.' };
  if (save.inventoryPartIds.includes(`${p.id}@${car.baseCarId}`))
    return { state: 'owned', label: 'Comprada', detail: 'No estoque deste carro: instale sem pagar de novo.' };
  if (!isPartUnlocked(save, p)) {
    const chapter = 'chapter' in p ? p.chapter : 1;
    if (chapter > 1) return {
      state: 'locked', label: `Capítulo ${chapter}`,
      detail: `Disponível no capítulo ${chapter}, ainda não implementado na campanha.`,
    };
    const have = unlocksOf(save);
    const missing = partRequirements(p).find((r) => !have.has(r))!;
    const ev = eventUnlocking(missing);
    if (!ev) return { state: 'locked', label: 'Bloqueada', detail: 'Ainda bloqueada.' };
    const what = ev.chapter === CHAPTER_1_ID ? 'a noite' : 'a etapa';
    return { state: 'locked', label: eventLabel(ev), detail: `Vença ${what} ${ev.order} (${ev.title}) para liberar.` };
  }
  const price = `${p.price.toLocaleString('pt-BR')} CR`;
  if (save.credits < p.price)
    return { state: 'unaffordable', label: price, detail: `Faltam ${(p.price - save.credits).toLocaleString('pt-BR')} CR.` };
  return { state: 'available', label: price, detail: 'Disponível para compra.' };
}

/** Shop state of the factory part of a slot: "Em uso" when no modification occupies the slot. */
export function stockStatus(car: { installedParts: readonly string[] }, category: PartCategory, findCategory: (id: string) => PartCategory | undefined): PartStatus {
  const occupied = car.installedParts.some((id) => findCategory(id) === category);
  return occupied
    ? { state: 'stock', label: 'Original', detail: 'Peça de fábrica: grátis, sempre disponível.' }
    : { state: 'installed', label: 'Em uso', detail: 'O carro está com a peça de fábrica neste item.' };
}
