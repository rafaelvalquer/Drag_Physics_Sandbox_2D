import { ALL_EVENTS, rivalOf, type CareerEventDef } from './CareerEvents';
import { MAX_GARAGE, type CareerSave, type OwnedCar } from './CareerState';

/**
 * Prize car of a chapter's final: the loser hands the car over. The player gets a copy of the
 * rival's build (same paint, parts and tune, resolved by the same build resolver), once per final:
 * the claim id stays in `claimedRewardIds` even if the car is sold later.
 */
export function prizeClaimId(eventId: string): string {
  return `${eventId}:prize-car`;
}

/** Finals that hand a car over, in chapter order. */
export function prizeEvents(): CareerEventDef[] {
  return ALL_EVENTS.filter((e) => e.finale && rivalOf(e).prize);
}

export type PrizeState = 'not-won' | 'delivered' | 'ready' | 'garage-full';

/** Where the prize of a final stands for this save. */
export function prizeState(save: Pick<CareerSave, 'completedEventIds' | 'claimedRewardIds' | 'ownedCars'>, ev: CareerEventDef): PrizeState {
  if (!ev.finale || !rivalOf(ev).prize || !save.completedEventIds.includes(ev.id)) return 'not-won';
  if (save.claimedRewardIds.includes(prizeClaimId(ev.id))) return 'delivered';
  return save.ownedCars.length >= MAX_GARAGE ? 'garage-full' : 'ready';
}

/** The car the player wins: a copy of the rival's build. */
export function prizeCarOf(ev: CareerEventDef, id: string, now: string): OwnedCar {
  const r = rivalOf(ev);
  const p = r.prize!;
  return {
    id,
    baseCarId: r.baseCarId,
    nickname: p.nickname.slice(0, 32),
    paint: { color: r.paint.color, accent: r.paint.accent },
    installedParts: [...r.parts],
    ...(r.tune ? { tune: { ...r.tune } } : {}),
    buildVersion: r.buildVersion ?? 1,
    purchasePrice: p.value,
    prizeEventId: ev.id,
    acquiredAt: now,
  };
}

/**
 * Delivers the prize of a won final inside a save transaction: adds the car and registers the claim.
 * With a full garage nothing is claimed (the car waits until there is room). `idFor` picks the
 * garage id of the new car.
 */
export function grantPrizeCar(save: CareerSave, ev: CareerEventDef, idFor: (s: CareerSave, baseCarId: string) => string, now: string): { state: PrizeState; car: OwnedCar | null } {
  const state = prizeState(save, ev);
  if (state !== 'ready') return { state, car: null };
  const car = prizeCarOf(ev, idFor(save, rivalOf(ev).baseCarId), now);
  save.ownedCars.push(car);
  save.claimedRewardIds.push(prizeClaimId(ev.id));
  return { state: 'delivered', car };
}
