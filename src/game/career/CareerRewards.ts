import type { CareerEventDef } from './CareerEvents';
import type { CareerSave, Outcome } from './CareerState';
import { chapterOf } from './chapters';

/**
 * Prize rules. Credits (CR) and reputation are separate progressions; reputation is never bought.
 *  - first win of an event: full prize and full reputation, once (claim id `<event>:first`);
 *  - repeated win: 35 % of the prize and 1 reputation point, until the event's repeat cap;
 *  - a finished loss: 10 % of the prize (max 100 CR) as fuel money, no reputation;
 *  - red light or DNF: nothing.
 * Reputation is capped per chapter (cumulative cap of the event's chapter), balances never go negative, and a result is applied once
 * per attempt id (see CareerController.recordRace).
 */
export const REPEAT_SHARE = 0.35;
export const LOSS_SHARE = 0.1;
export const LOSS_MAX_CR = 100;
export const REPEAT_REPUTATION = 1;
/** Repeat wins of one event that still earn reputation. */
export const REPEAT_REPUTATION_CAP = 5;
/** Reputation cap at the end of chapter 1 (each chapter has its cumulative cap, see chapters.ts). */
export const CHAPTER_REPUTATION_CAP = 250;

export interface Reward {
  credits: number;
  reputation: number;
  /** Claim registered by this reward (first win), if any. */
  claimId: string | null;
  kind: 'first-win' | 'repeat-win' | 'loss' | 'none';
}

const round10 = (v: number): number => Math.round(v / 10) * 10;

export function firstWinClaimId(eventId: string): string {
  return `${eventId}:first`;
}

export function computeReward(save: CareerSave, ev: CareerEventDef, outcome: Outcome): Reward {
  if (outcome === 'red-light' || outcome === 'dnf') return { credits: 0, reputation: 0, claimId: null, kind: 'none' };
  if (outcome === 'loss') return { credits: Math.min(LOSS_MAX_CR, round10(ev.rewardCr * LOSS_SHARE)), reputation: 0, claimId: null, kind: 'loss' };
  const claim = firstWinClaimId(ev.id);
  const room = Math.max(0, chapterOf(ev.chapter).reputationCap - save.reputation);
  if (!save.claimedRewardIds.includes(claim)) {
    return { credits: ev.rewardCr, reputation: Math.min(ev.reputation, room), claimId: claim, kind: 'first-win' };
  }
  const repeats = save.results.filter((r) => r.eventId === ev.id && r.outcome === 'win').length - 1;
  const rep = repeats < REPEAT_REPUTATION_CAP ? Math.min(REPEAT_REPUTATION, room) : 0;
  return { credits: round10(ev.rewardCr * REPEAT_SHARE), reputation: rep, claimId: null, kind: 'repeat-win' };
}
