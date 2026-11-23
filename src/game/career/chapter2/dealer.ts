import type { CareerSave } from '../CareerState';
import { STARTER_CARS } from '../CareerState';
import { eventLabel, eventUnlocking, isChapterUnlocked, unlocksOf } from '../CareerProgression';
import { CHAPTER_2_ID, CHAPTER_3_ID } from '../chapters';
import { ELITE_CARS } from '../chapter3/dealer';
import type { UnlockId } from '../tuning/parts';

/**
 * Career classifieds/dealers: one offer per model at the chapter's balance prices (fictional, not real
 * market prices). The Evo and the 335i ask for reputation; the 335i is sold only after the final
 * challenge (it stays as a progression reward for free use).
 */
export interface DealerOffer {
  baseCarId: string;
  price: number;
  /** Total career reputation needed. */
  minReputation: number;
  requires?: UnlockId;
  /** Chapter whose classifieds sell it (absent = 2, the league). */
  chapter?: 1 | 2 | 3;
}

/** Chapter 1 classic cars opened by winning their main-story events. */
export const CLASSIC_CARS: readonly DealerOffer[] = [
  { baseCarId: 'gm-celta-2003', price: 1300, minReputation: 0, requires: 'c1-dealer-celta', chapter: 1 },
  { baseCarId: 'gm-corsa-gl-1996', price: 1000, minReputation: 0, requires: 'c1-dealer-corsa', chapter: 1 },
  { baseCarId: 'gm-kadett-sl-1992', price: 2200, minReputation: 0, requires: 'c1-dealer-kadett', chapter: 1 },
];

/** The league dealer of chapter 2. */
export const LEAGUE_CARS: readonly DealerOffer[] = [
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

/** Every dealer offer: the league (chapter 2) and the elite (chapter 3). */
export const DEALER_CARS: readonly DealerOffer[] = [...CLASSIC_CARS, ...LEAGUE_CARS, ...ELITE_CARS];

/** Share of the price paid that a sale returns. */
export const RESALE_SHARE = 0.6;

export type OfferState = { ok: true } | { ok: false; reason: string };

/** Can this save buy the offer now (credits are checked by the purchase)? */
export function offerAvailability(save: Pick<CareerSave, 'completedEventIds' | 'reputation'>, o: DealerOffer): OfferState {
  const chapter = o.chapter ?? 2;
  const elite = chapter === 3;
  if (chapter > 1 && !isChapterUnlocked(save, chapter === 3 ? CHAPTER_3_ID : CHAPTER_2_ID)) return { ok: false, reason: elite ? 'Conclua a Liga da Madrugada para entrar na Elite.' : 'Conclua o Capítulo 1 para entrar na Liga.' };
  if (o.requires && !unlocksOf(save).has(o.requires)) {
    if (chapter === 1) {
      const event = eventUnlocking(o.requires);
      return { ok: false, reason: event ? `Vença ${eventLabel(event)} (${event.title}) para liberar.` : 'Disponível após vencer um evento principal.' };
    }
    return { ok: false, reason: elite ? 'Disponível depois do penúltimo duelo da Elite.' : 'Disponível depois do desafio final da Liga.' };
  }
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
