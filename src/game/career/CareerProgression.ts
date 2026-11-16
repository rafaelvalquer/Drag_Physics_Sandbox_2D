import { EVENTS, type CareerEventDef } from './CareerEvents';
import type { CareerSave } from './CareerState';
import type { PartDef, UnlockId } from './tuning/parts';

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
