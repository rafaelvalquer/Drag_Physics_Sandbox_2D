/**
 * When do the driven tyres visibly slide? Pure helper shared by the particle system and the
 * tests. Both conditions are needed: a slip ratio well past the traction peak AND a real sliding
 * speed – full throttle with gripping tyres produces neither smoke nor marks.
 */
export const SMOKE_SLIP_RATIO = [0.18, 0.65] as const;
export const SMOKE_SLIP_SPEED = [1.0, 7] as const;

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** 0..1: how hard the driven tyres are sliding. */
export function slipIntensity(slipRatio: number, slipSpeed: number): number {
  return smoothstep(SMOKE_SLIP_RATIO[0], SMOKE_SLIP_RATIO[1], Math.abs(slipRatio)) * smoothstep(SMOKE_SLIP_SPEED[0], SMOKE_SLIP_SPEED[1], Math.abs(slipSpeed));
}
