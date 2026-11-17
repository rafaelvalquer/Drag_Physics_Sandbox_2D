import type { CareerSave } from '../CareerState';
import { STARTER_CARS } from '../CareerState';
import { isChapterUnlocked, unlocksOf } from '../CareerProgression';
import { CHAPTER_2_ID } from '../chapters';
import type { UnlockId } from '../tuning/parts';

/**
 * Chapter 2 dealer: one offer per model at the chapter's balance prices (fictional, not real
 * market prices). The Evo and the 335i ask for reputation; the 335i is sold only after the final
 * challenge (it stays as a progression reward for free use).
 */
export interface DealerOffer {
  baseCarId: string;
  price: number;
  /** Total career reputation needed. */
  minReputation: number;
  requires?: UnlockId;
}

export const DEALER_CARS: readonly DealerOffer[] = [
  { baseCarId: 'gm-astra-2011', price: 6000, minReputation: 0 },
  { baseCarId: 'peugeot-208-gt-2017', price: 14000, minReputation: 0 },
  { baseCarId: 'vw-golf-gti-mk4-2003', price: 18000, minReputation: 220 },
  { baseCarId: 'audi-a3-18t-2005', price: 20000, minReputation: 240 },
  { baseCarId: 'mercedes-c200-w205-2015', price: 25000, minReputation: 260 },
  { baseCarId: 'bmw-320i-f30-2014', price: 26000, minReputation: 280 },
  { baseCarId: 'honda-civic-si-2008', price: 28000, minReputation: 300 },
  { baseCarId: 'vw-jetta-tsi-2012', price: 33000, minReputation: 320 },
  { baseCarId: 'mitsubishi-evo-x-2012', price: 45000, minReputation: 400 },
  { baseCarId: 'bmw-335i-f30-2013', price: 55000, minReputation: 500, requires: 'c2-dealer-335i' },
];

/** Share of the price paid that a sale returns. */
export const RESALE_SHARE = 0.6;

export type OfferState = { ok: true } | { ok: false; reason: string };

/** Can this save buy the offer now (credits are checked by the purchase)? */
export function offerAvailability(save: Pick<CareerSave, 'completedEventIds' | 'reputation'>, o: DealerOffer): OfferState {
  if (!isChapterUnlocked(save, CHAPTER_2_ID)) return { ok: false, reason: 'Conclua o Capítulo 1 para entrar na Liga.' };
  if (o.requires && !unlocksOf(save).has(o.requires)) return { ok: false, reason: 'Disponível depois do desafio final da Liga.' };
  if (save.reputation < o.minReputation) return { ok: false, reason: `Exige ${o.minReputation} de reputação (você tem ${save.reputation}).` };
  return { ok: true };
}

/** List price of any career car (classifieds of chapter 1 or the chapter 2 dealer). */
export function listPrice(baseCarId: string): number | undefined {
  return STARTER_CARS.find((c) => c.baseCarId === baseCarId)?.price ?? DEALER_CARS.find((c) => c.baseCarId === baseCarId)?.price;
}

export function resaleValue(car: { baseCarId: string; purchasePrice?: number }): number {
  const paid = car.purchasePrice ?? listPrice(car.baseCarId) ?? 0;
  return Math.round((paid * RESALE_SHARE) / 10) * 10;
}
