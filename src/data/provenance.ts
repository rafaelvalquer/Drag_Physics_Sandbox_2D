/**
 * Provenance of real-vehicle data.
 *
 * Source hierarchy (highest first): manufacturer manual > factory catalogue > period instrumented
 * test > technical sheet with the version and fuel identified > technical literature > documented
 * estimate. Every source is listed with its URL, page (when there is one), the model year it
 * describes and its nature, so a value can always be traced back.
 *
 * - factory:    the manufacturer's own document (owner's manual, catalogue).
 * - secondary:  a technical sheet, press test or enthusiast reference (not the manufacturer).
 * - derived:    computed from other documented values (displacement, firing angles, radius…).
 * - estimated:  plausible engineering value without a document for this vehicle.
 * - calibrated: adjusted so the simulation reproduces documented behaviour.
 */
export type Provenance = 'factory' | 'secondary' | 'derived' | 'estimated' | 'calibrated';

export type SourceNature = 'manual' | 'catalogue' | 'instrumented-test' | 'technical-sheet' | 'literature' | 'forum';

export interface SourceRef {
  id: string;
  title: string;
  url: string;
  /** Page / section inside the source, when applicable. */
  page?: string;
  /** Model year the source describes (may differ from the car: see `note`). */
  modelYear: number | string;
  nature: SourceNature;
  /** Date this project consulted the source. */
  accessed: string;
  note?: string;
}

/** A documented value: number, unit as written in the source, the source and its nature. */
export interface Documented<T = number> {
  value: T;
  unit?: string;
  source: string;
  provenance: Provenance;
  note?: string;
}

export const KGFM_TO_NM = 9.80665;
export const CV_TO_KW = 0.73549875;

/** Air density of the standard atmosphere used for the reference flows (kg/m³, 25 °C). */
const RHO_REF = 1.184;

/**
 * Estimated wide-open-throttle air mass flow (kg/s) at a speed, for the breathing reference:
 *   ṁ = VE · ρ · V_d · n / 2   (four-stroke)
 * Used only to place the quadratic restriction laws (filter, exhaust) at a sensible flow.
 */
export function ratedAirFlowKgS(displacementCm3: number, rpm: number, ve = 0.85): number {
  return Math.round(ve * RHO_REF * displacementCm3 * 1e-6 * (rpm / 120) * 10000) / 10000;
}

/** Rounded torque (N·m) at `rpm` that gives `cv` of power: T = P/ω. */
export function torqueForPower(cv: number, rpm: number): number {
  return Math.round(((cv * CV_TO_KW * 1000) / ((rpm * 2 * Math.PI) / 60)) * 100) / 100;
}

/** Dynamic rolling radius (m) from an ISO tyre size, with the usual ≈ 3 % deflection under load. */
export function rollingRadiusM(widthMm: number, aspectPct: number, rimInch: number, deflection = 0.03): number {
  const r = (rimInch * 25.4) / 2 + (widthMm * aspectPct) / 100;
  return Math.round((r / 1000) * (1 - deflection) * 1000) / 1000;
}
