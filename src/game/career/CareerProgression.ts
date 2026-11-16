import { EVENTS, type CareerEventDef } from './CareerEvents';
import type { CareerSave } from './CareerState';
import type { PartCategory, PartDef, UnlockId } from './tuning/parts';

/** What the chapter's progress has unlocked so far (derived from the completed events). */
export function unlocksOf(save: Pick<CareerSave, 'completedEventIds'>): Set<UnlockId> {
  const s = new Set<UnlockId>();
  for (const e of EVENTS) if (save.completedEventIds.includes(e.id)) for (const u of e.unlocks) s.add(u);
  return s;
}

export type EventStatus = 'locked' | 'available' | 'completed' | 'final';

export function eventStatus(save: Pick<CareerSave, 'completedEventIds'>, ev: CareerEventDef): EventStatus {
  if (save.completedEventIds.includes(ev.id)) return 'completed';
  const prev = EVENTS.find((e) => e.order === ev.order - 1);
  if (prev && !save.completedEventIds.includes(prev.id)) return 'locked';
  if (ev.requires && !unlocksOf(save).has(ev.requires)) return 'locked';
  return ev.finale ? 'final' : 'available';
}

/** The next event to race (first not completed and not locked), or null when the chapter is done. */
export function nextEvent(save: Pick<CareerSave, 'completedEventIds'>): CareerEventDef | null {
  return EVENTS.find((e) => {
    const s = eventStatus(save, e);
    return s === 'available' || s === 'final';
  }) ?? null;
}

export function isChapterComplete(save: Pick<CareerSave, 'completedEventIds'>): boolean {
  return EVENTS.every((e) => save.completedEventIds.includes(e.id));
}

/** Shop requirements of a part: its own unlock plus the workshop it is installed in. */
export function partRequirements(p: PartDef): UnlockId[] {
  const req: UnlockId[] = ['workshop-basic', p.unlock];
  if (p.category === 'clutch' || p.category === 'differential') req.push('workshop-transmission');
  return [...new Set(req)];
}

export function isPartUnlocked(save: Pick<CareerSave, 'completedEventIds'>, p: PartDef): boolean {
  const u = unlocksOf(save);
  return partRequirements(p).every((r) => u.has(r));
}

export function canTuneBoost(save: Pick<CareerSave, 'completedEventIds'>): boolean {
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
    const have = unlocksOf(save);
    const missing = partRequirements(p).find((r) => !have.has(r))!;
    const ev = EVENTS.find((e) => e.unlocks.includes(missing));
    return { state: 'locked', label: ev ? `Noite ${ev.order}` : 'Bloqueada', detail: ev ? `Vença a noite ${ev.order} (${ev.title}) para liberar.` : 'Ainda bloqueada.' };
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
