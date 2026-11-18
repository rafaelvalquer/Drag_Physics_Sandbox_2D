import type { CarConfig } from '../../../data/schema';
import { curvePeakCv } from './breathingModel';
import type { OilSystemPart } from './parts';

/**
 * Simplified, verifiable lubrication model (Chapter 3 workshop). Two margins, both ratios of what
 * the system delivers to what the build asks for, relative to the FACTORY engine (margin 1.15 for
 * the pump and 1.35 for the heat rejection by design, so a factory engine never starves):
 *
 *   flow    demand ∝ (T_peak / T_peak,0)^0.6 · (n_cut / n_cut,0)^0.5   (bearing load and speed)
 *   thermal demand ∝ f_oil · P_brake                                    (heat the oil must carry:
 *           friction, piston-cooling jets and, with a turbo, the turbine bearing)
 *
 * margin = min(flow, thermal). Below 1 the engine lasts less at its mechanical limit (the
 * endurance falls with margin²); below MIN_MARGIN the build is refused (oil starvation). The
 * fractions f_oil are estimates (aspirated 5 %, boosted 6 % of the brake power), flagged as such
 * in the report. A part only helps a build whose demand outgrew the factory system.
 */
export const OIL_FLOW_RESERVE = 1.15;
export const OIL_THERMAL_RESERVE = 1.35;
export const OIL_HEAT_FRACTION = { aspirated: 0.05, boosted: 0.06 } as const;
/** Below this margin the oil system cannot keep the engine alive: the build is refused. */
export const OIL_MIN_MARGIN = 0.68;

export interface OilCheck {
  flowMargin: number;
  thermalMargin: number;
  margin: number;
  limiter: 'bomba' | 'resfriamento';
  /** Factor on the endurance (seconds at the mechanical limit); 1 when the margin holds. */
  enduranceScale: number;
  ok: boolean;
}

/** Margins of a resolved engine against the factory engine of `base`. */
export function oilCheck(base: CarConfig, built: CarConfig, oil?: OilSystemPart): OilCheck {
  const e0 = base.engine;
  const e1 = built.engine;
  const peak0 = Math.max(...e0.torqueCurve.torqueNm);
  const peak1 = Math.max(...e1.torqueCurve.torqueNm.filter((_, i) => e1.torqueCurve.rpm[i]! <= e1.revLimitRpm));
  const p0 = curvePeakCv(e0.torqueCurve, e0.revLimitRpm);
  const p1 = curvePeakCv(e1.torqueCurve, e1.revLimitRpm);
  const f0 = OIL_HEAT_FRACTION[e0.induction === 'turbo' ? 'boosted' : 'aspirated'];
  const f1 = OIL_HEAT_FRACTION[e1.induction === 'turbo' ? 'boosted' : 'aspirated'];
  const flowDemand = Math.pow(Math.max(1e-6, peak1 / peak0), 0.6) * Math.pow(e1.revLimitRpm / e0.revLimitRpm, 0.5);
  const thermalDemand = (f1 * p1) / (f0 * p0);
  const flowMargin = (OIL_FLOW_RESERVE * (oil?.pumpFlowScale ?? 1)) / flowDemand;
  const thermalMargin = (OIL_THERMAL_RESERVE * (oil?.coolerScale ?? 1)) / thermalDemand;
  const margin = Math.min(flowMargin, thermalMargin);
  return {
    flowMargin,
    thermalMargin,
    margin,
    limiter: flowMargin <= thermalMargin ? 'bomba' : 'resfriamento',
    enduranceScale: margin >= 1 ? 1 : Math.max(0.4, margin * margin),
    ok: margin >= OIL_MIN_MARGIN,
  };
}

export function oilErrorMessage(c: OilCheck): string {
  const what = c.limiter === 'bomba' ? 'a vazão da bomba de óleo' : 'a troca térmica do óleo';
  return `lubrificação insuficiente: ${what} cobre ${(c.margin * 100).toFixed(0)} % do que o projeto pede; instale o sistema de lubrificação (bomba, cárter e radiador de óleo)`;
}
