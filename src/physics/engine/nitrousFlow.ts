/** Shortest entry ramp, even when the tune specifies zero. */
export const MIN_NITROUS_RAMP_S = 0.06;

/** Integral of the smoothstep ramp, followed by steady flow, in seconds at full flow. */
export function nitrousFlowIntegral(timeS: number, rampS: number): number {
  const ramp = Math.max(MIN_NITROUS_RAMP_S, rampS);
  const x = Math.min(1, Math.max(0, timeS / ramp));
  return ramp * x ** 3 * (1 - x / 2) + Math.max(0, timeS - ramp);
}

/** Continuous spray duration for a given mass and current point on the entry ramp. */
export function nitrousDurationS(massKg: number, flowKgS: number, rampS: number, elapsedS = 0): number {
  if (massKg <= 0 || flowKgS <= 0) return 0;
  const ramp = Math.max(MIN_NITROUS_RAMP_S, rampS);
  const target = nitrousFlowIntegral(elapsedS, ramp) + massKg / flowKgS;
  if (target >= ramp / 2) return ramp / 2 + target - elapsedS;
  let lo = elapsedS;
  let hi = ramp;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (nitrousFlowIntegral(mid, ramp) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2 - elapsedS;
}
