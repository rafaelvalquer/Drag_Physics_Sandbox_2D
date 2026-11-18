import type { CarConfig } from '../../../data/schema';
import { curvePeakCv } from './breathingModel';
import type { FuelHpPumpPart, FuelSystemPart } from './parts';

/**
 * Fuel supply of a build (Chapter 3 workshop). The factory injectors and pumps are sized for the
 * rated power of the factory engine with a design margin; a conversion or a richer map demands more
 * fuel mass flow than that and the build is refused (or limited) until the supply is bigger.
 *
 *   demand   ṁ_f = P_brake · BSFC            (kg/kWh at wide-open throttle, with enrichment)
 *   injector ṁ_inj = n · Q_cc/min · ρ · duty  (static flow, 85 % maximum duty)
 *   pump     ṁ_pump = the pump's delivered flow at rail pressure
 *   supply   min(injectors, low-pressure pump, high-pressure pump of a direct-injection engine)
 *
 * The factory capacity is derived from the factory curve (power × BSFC × margin), so no table of
 * injector sizes has to be invented per car: the figures are estimates and are marked as such in
 * the report (docs/CHAPTER3_WORKSHOP.md). Nothing here scales torque: the supply only limits or
 * rejects the build the breathing model produced.
 */

/** Brake specific fuel consumption at wide-open throttle (kg/kWh): lean-ish aspirated / rich boosted. */
export const BSFC_KG_KWH = { aspirated: 0.3, boosted: 0.36 } as const;
/** Design margin of the factory supply over the rated fuel flow. */
export const FACTORY_FUEL_MARGIN = { aspirated: 1.12, boosted: 1.15 } as const;
/** High-pressure pump of a direct-injection engine: the tightest link of the factory chain. */
export const FACTORY_HP_PUMP_MARGIN = 1.05;
/** Highest injector duty cycle for stable metering. */
export const MAX_INJECTOR_DUTY = 0.85;

/** Engine families with direct injection (a high-pressure pump limits them). */
export const DIRECT_INJECTION_FAMILIES: ReadonlySet<string> = new Set(['toyota-2gr-fse', 'mercedes-m276', 'kia-lambda33', 'maserati-f160', 'alfa-690t']);

/**
 * Toyota D-4S has direct AND port injectors: the port injectors carry part of the fuel at high load,
 * so the high-pressure pump alone limits less than on a pure direct-injection engine.
 */
export const DUAL_INJECTION_HP_SHARE: Readonly<Record<string, number>> = { 'toyota-2gr-fse': 1.45 };

export function isDirectInjection(family: string | undefined): boolean {
  return !!family && DIRECT_INJECTION_FAMILIES.has(family);
}

export interface FuelParts {
  injectors?: FuelSystemPart;
  hpPump?: FuelHpPumpPart;
}

export interface FuelCapacity {
  /** Fuel mass flow the supply sustains (g/s). */
  capacityGs: number;
  injectorGs: number;
  pumpGs: number;
  /** Direct-injection engines only (g/s). */
  hpPumpGs: number | null;
  limiter: 'injectors' | 'pump' | 'hp-pump';
}

export interface FuelCheck extends FuelCapacity {
  /** Fuel flow the build asks for at its peak power (g/s). */
  demandGs: number;
  /** Peak brake power the supply sustains with this BSFC (cv). */
  supportCv: number;
  peakPowerCv: number;
  /** capacity / demand: > 1 holds, < 1 starves. */
  margin: number;
  ok: boolean;
}

const KW_PER_CV = 0.73549875;

/** Fuel mass flow the supply of the FACTORY car sustains (g/s), derived from its rated curve. */
export function factoryFuelFlowGs(base: CarConfig): number {
  const stockCv = curvePeakCv(base.engine.torqueCurve, base.engine.revLimitRpm);
  const kind = base.engine.induction === 'turbo' ? 'boosted' : 'aspirated';
  return (stockCv * KW_PER_CV * BSFC_KG_KWH[kind] * FACTORY_FUEL_MARGIN[kind]) / 3.6;
}

export function fuelCapacity(base: CarConfig, parts: FuelParts = {}): FuelCapacity {
  const f0 = factoryFuelFlowGs(base);
  const injectorGs = f0 * (parts.injectors?.injectorScale ?? 1);
  const pumpGs = f0 * (parts.injectors?.pumpScale ?? 1);
  const direct = isDirectInjection(base.engine.family);
  const hpPumpGs = direct
    ? (f0 / (base.engine.induction === 'turbo' ? FACTORY_FUEL_MARGIN.boosted : FACTORY_FUEL_MARGIN.aspirated)) *
      FACTORY_HP_PUMP_MARGIN *
      (DUAL_INJECTION_HP_SHARE[base.engine.family ?? ''] ?? 1) *
      (parts.hpPump?.hpPumpScale ?? 1)
    : null;
  let capacityGs = injectorGs;
  let limiter: FuelCapacity['limiter'] = 'injectors';
  if (pumpGs < capacityGs) {
    capacityGs = pumpGs;
    limiter = 'pump';
  }
  if (hpPumpGs !== null && hpPumpGs < capacityGs) {
    capacityGs = hpPumpGs;
    limiter = 'hp-pump';
  }
  return { capacityGs, injectorGs, pumpGs, hpPumpGs, limiter };
}

/** Fuel check of a resolved build: `boosted` is the CURRENT induction of the hardware. */
export function checkFuel(base: CarConfig, parts: FuelParts, peakPowerCv: number, boosted: boolean): FuelCheck {
  const cap = fuelCapacity(base, parts);
  const bsfc = BSFC_KG_KWH[boosted ? 'boosted' : 'aspirated'];
  const demandGs = (peakPowerCv * KW_PER_CV * bsfc) / 3.6;
  const supportCv = (cap.capacityGs * 3.6) / bsfc / KW_PER_CV;
  const margin = cap.capacityGs / Math.max(1e-9, demandGs);
  return { ...cap, demandGs, supportCv, peakPowerCv, margin, ok: margin >= 1 - 1e-9 };
}

const LIMITER_TEXT: Record<FuelCapacity['limiter'], string> = {
  injectors: 'os injetores',
  pump: 'a bomba de combustível',
  'hp-pump': 'a bomba de alta pressão',
};

/** pt-BR reason of a failed check, with the part that fixes it. */
export function fuelErrorMessage(c: FuelCheck): string {
  const fix = c.limiter === 'hp-pump' ? 'instale a bomba de alta pressão' : 'instale injetores e bomba de maior vazão';
  return `alimentação insuficiente: ${LIMITER_TEXT[c.limiter]} sustentam ${Math.floor(c.supportCv)} cv e o projeto pede ${Math.ceil(c.peakPowerCv)} cv (${c.demandGs.toFixed(1).replace('.', ',')} g/s de combustível contra ${c.capacityGs.toFixed(1).replace('.', ',')} g/s); ${fix}`;
}
