import type { PartTier } from './partProgression';
import type { UnlockId } from './parts';

type Release = { chapter: 2 | 3; unlock: UnlockId };
const liga: Record<PartTier, Release> = {
  1: { chapter: 2, unlock: 'c2-workshop-street' },
  2: { chapter: 2, unlock: 'c2-workshop-sport' },
  3: { chapter: 3, unlock: 'c3-workshop-sport' },
};
const elite: Record<PartTier, Release> = {
  1: { chapter: 3, unlock: 'c3-workshop-street' },
  2: { chapter: 3, unlock: 'c3-workshop-sport' },
  3: { chapter: 3, unlock: 'c3-workshop-race' },
};

export function modernStageRelease(origin: 2 | 3, tier: PartTier): Release {
  return (origin === 2 ? liga : elite)[tier];
}
