import { R_AIR } from '../../core/units';

/**
 * Compressible orifice flow (throttle body, blow-off valve).
 *
 * ORIGIN (MIT): port of `GasSystem::flowRate`, `GasSystem::chokedFlowLimit` and
 * `GasSystem::chokedFlowRate` from ange-yaghi/engine-sim (src/gas_system.cpp,
 * include/gas_system.h, commit 85f7c3b959a908ed5232ede4f1a4ac7eafe6b630).
 * CHANGES: engine-sim computes a molar flow with the universal gas constant; here the result is a
 * mass flow (kg/s) using the specific gas constant of air, and `k_flow` is expressed as an
 * effective area (discharge coefficient × geometric area, m²).
 */

export const HEAT_CAPACITY_RATIO_AIR = 1.4;

/** Critical pressure ratio below which the flow is choked: (2/(γ+1))^(γ/(γ−1)). */
export function chokedFlowLimit(hcr = HEAT_CAPACITY_RATIO_AIR): number {
  return Math.pow(2 / (hcr + 1), hcr / (hcr - 1));
}

/** sqrt(γ)·(2/(γ+1))^((γ+1)/(2(γ−1))) */
export function chokedFlowFactor(hcr = HEAT_CAPACITY_RATIO_AIR): number {
  return Math.sqrt(hcr) * Math.pow(2 / (hcr + 1), (hcr + 1) / (2 * (hcr - 1)));
}

const CHOKED_LIMIT = chokedFlowLimit();
const CHOKED_FACTOR = chokedFlowFactor();

/**
 * Mass flow from system 0 to system 1 (negative = reverse flow).
 * @param effectiveArea discharge coefficient × area (m²)
 */
export function orificeMassFlow(
  effectiveArea: number,
  p0: number,
  p1: number,
  t0: number,
  t1: number,
  hcr = HEAT_CAPACITY_RATIO_AIR,
): number {
  if (effectiveArea <= 0) return 0;
  let direction: number;
  let tUp: number;
  let pUp: number;
  let pDown: number;
  if (p0 > p1) {
    direction = 1;
    tUp = t0;
    pUp = p0;
    pDown = p1;
  } else {
    direction = -1;
    tUp = t1;
    pUp = p1;
    pDown = p0;
  }
  if (pUp <= 0) return 0;
  const pRatio = pDown / pUp;
  let flow: number;
  const limit = hcr === HEAT_CAPACITY_RATIO_AIR ? CHOKED_LIMIT : chokedFlowLimit(hcr);
  if (pRatio <= limit) {
    // Choked flow
    const factor = hcr === HEAT_CAPACITY_RATIO_AIR ? CHOKED_FACTOR : chokedFlowFactor(hcr);
    flow = factor / Math.sqrt(R_AIR * tUp);
  } else {
    const s = Math.pow(pRatio, 1 / hcr);
    flow = ((2 * hcr) / (hcr - 1)) * s * (s - pRatio);
    flow = Math.sqrt(Math.max(flow, 0) / (R_AIR * tUp));
  }
  return direction * pUp * flow * effectiveArea;
}

/**
 * Throttle plate effective flow attenuation.
 * ORIGIN: engine-sim `Intake::process` – `flowAttenuation = cos(platePosition · π/2)` where
 * `platePosition = IdleThrottlePlatePosition · m_throttle` and engine-sim's `m_throttle` is the
 * *closed* fraction. Here `opening` is the open fraction 0..1.
 */
export function throttleAttenuation(opening: number, idlePlatePosition: number): number {
  const closed = 1 - (opening < 0 ? 0 : opening > 1 ? 1 : opening);
  return Math.cos(idlePlatePosition * closed * (Math.PI / 2));
}
