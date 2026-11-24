export const ONLINE_START_CREDITS = 4_500;
export const ONLINE_START_RP = 1_000;
export const ONLINE_MAX_GARAGE = 25;
export const ONLINE_TERMS_VERSION = 1;

export const ONLINE_REWARD_POLICY = {
  version: 1,
  k: 32,
  rewards: {
    win: { cr: 600, pp: 5 },
    loss: { cr: 300, pp: 3 },
    draw: { cr: 450, pp: 4 },
    forfeit: { cr: 0, pp: 0 },
    cancelled: { cr: 0, pp: 0 },
  },
} as const;

export function eloDelta(rating: number, opponent: number, score: 0 | 0.5 | 1): number {
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400));
  const change = ONLINE_REWARD_POLICY.k * (score - expected);
  return Math.sign(change) * Math.round(Math.abs(change)) || 0;
}

export function rankCategory(rp: number): string {
  if (rp < 800) return 'Iniciante';
  if (rp < 1_100) return 'Street';
  if (rp < 1_400) return 'Preparado';
  if (rp < 1_700) return 'Elite';
  return 'Lenda das Ruas';
}
