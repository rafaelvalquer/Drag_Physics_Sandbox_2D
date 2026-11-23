import type { ChapterId } from '../chapters';
import type { Outcome } from '../CareerState';
import type { RaceDistanceId } from '../../race/RaceController';
import type { FreeTier } from './FreeEventTypes';

const BASE: Record<ChapterId, Record<FreeTier, number>> = {
  'chapter-1': { iniciante: 250, rua: 400, preparado: 650, competicao: 850 },
  'chapter-2': { iniciante: 1200, rua: 2200, preparado: 3800, competicao: 5500 },
  'chapter-3': { iniciante: 5000, rua: 9000, preparado: 15000, competicao: 25000 },
};
const DISTANCE = { eighth: 0.8, quarter: 1, km: 1.25 };

export function freeEventPrize(chapter: ChapterId, tier: FreeTier, distance: RaceDistanceId): number {
  return Math.round(BASE[chapter][tier] * DISTANCE[distance] / 10) * 10;
}

export function computeFreeEventReward(prize: number, outcome: Outcome): number {
  return outcome === 'win' ? prize : 0;
}
