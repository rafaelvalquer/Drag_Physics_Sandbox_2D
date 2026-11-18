import type { DealerOffer } from '../chapter2/dealer';

/**
 * Chapter 3 dealer "ELITE — CAPÍTULO 3": one offer per model at the balance prices of the chapter
 * (fictional credits, not market prices). Reputation opens the models in the order of the
 * chapter: the least reputation the chapter-2 path leaves (≈ 600) already opens the first, and
 * the GT-R asks for the reputation of the penultimate duel and for the unlock of that duel.
 * The GT-R of the final boss is a separate car: the prize of the last duel (see PrizeCars).
 */
export const ELITE_CARS: readonly DealerOffer[] = [
  { baseCarId: 'nissan-350z-2006', price: 45000, minReputation: 600, chapter: 3 },
  { baseCarId: 'lexus-is350-2015', price: 58000, minReputation: 650, chapter: 3 },
  { baseCarId: 'nissan-370z-2014', price: 70000, minReputation: 720, chapter: 3 },
  { baseCarId: 'mercedes-amg-c43-2017', price: 105000, minReputation: 810, chapter: 3 },
  { baseCarId: 'kia-stinger-gt-2019', price: 115000, minReputation: 890, chapter: 3 },
  { baseCarId: 'maserati-ghibli-sq4-2015', price: 145000, minReputation: 970, chapter: 3 },
  { baseCarId: 'alfa-giulia-qv-2017', price: 190000, minReputation: 1090, chapter: 3 },
  { baseCarId: 'nissan-gtr-r35-2015', price: 250000, minReputation: 1230, chapter: 3, requires: 'c3-dealer-gtr' },
];
