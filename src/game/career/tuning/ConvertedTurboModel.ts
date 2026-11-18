import type { CarConfig } from '../../../data/schema';
import { engineFuel, TURBO_MAX_COMPRESSION } from './breathingModel';
import type { PartDef, PistonPart, TurboConversionSpec, TurboPart } from './parts';

/**
 * Turbo conversion of an aspirated engine (Chapter 3). The torque of a converted engine comes from
 * the same breathing model as every other build (`applyEngineParts`: charge density through a
 * compressor and an intercooler, Willans line at the boosted MAP, ignition retard against knock);
 * this module holds what is specific to a CONVERSION:
 *
 *  - the induction of the build is the one of the HARDWARE installed (`effectiveInduction`), not the
 *    one in the factory sheet: the catalogue car is never mutated, and removing the kit restores it;
 *  - a kit is made for a compression ratio; the pistons can lower the engine's (forged low-compression
 *    set), a kit never lowers it by itself;
 *  - the compressor has a flow capacity (kg/s): above it the pressure it can hold falls with rpm
 *    (the turbo "runs out"), which is what separates a small turbo from a big one;
 *  - the factory internals take their torque with a margin; a converted engine is refused above it
 *    (the aspirated clamp that silently hides torque does not apply).
 */

export type Induction = 'NA' | 'turbo';

export function isConversionKit(p: PartDef | undefined): p is TurboPart & { conversion: TurboConversionSpec } {
  return !!p && p.category === 'turbo' && !('upgrade' in p) && 'conversion' in p && !!p.conversion;
}

/** Induction of the installed hardware: the factory one, or turbo when a conversion kit is fitted. */
export function effectiveInduction(base: CarConfig, parts: readonly PartDef[]): Induction {
  return base.engine.induction === 'turbo' || parts.some(isConversionKit) ? 'turbo' : 'NA';
}

/** Factory sheet induction vs what the hardware has now (Oficina, Dyno Lab and the report read both). */
export interface InductionState {
  factoryInduction: Induction;
  currentInduction: Induction;
  /** Layout of the turbo now (null when aspirated). */
  turboLayout: 'single' | 'twin' | null;
  converted: boolean;
}

export function inductionState(base: CarConfig, parts: readonly PartDef[]): InductionState {
  const kit = parts.find(isConversionKit);
  const factory = base.engine.induction;
  const current = effectiveInduction(base, parts);
  const layout = kit ? (kit.conversion.layout === 'twin-parallel' ? 'twin' : 'single') : factory === 'turbo' ? (base.engine.turbo?.layout === 'parallel-twin' ? 'twin' : 'single') : null;
  return { factoryInduction: factory, currentInduction: current, turboLayout: layout, converted: !!kit };
}

/** Compression ratio of the engine with the pistons of the build. */
export function compressionWith(base: CarConfig, pistons?: PistonPart): number {
  return base.engine.compressionRatio + (pistons?.compressionAdd ?? 0);
}

/** pt-BR error when the engine's compression does not take the kit (null when it does). */
export function conversionCompressionError(base: CarConfig, kit: TurboPart, pistons?: PistonPart): string | null {
  const cr = compressionWith(base, pistons);
  // a conversion kit carries its own limit (its charge cooling and calibration); the old kit uses the generic one
  const max = kit.conversion?.maxCompression ?? TURBO_MAX_COMPRESSION[engineFuel(base.engine)];
  if (cr <= max + 1e-9) return null;
  const f = (x: number): string => x.toFixed(1).replace('.', ',');
  if (!kit.conversion) return `taxa de compressão ${f(base.engine.compressionRatio)}:1 não aceita o kit turbo sem detonar`;
  return `taxa de compressão ${f(cr)}:1 não aceita ${kit.name} sem detonar (máximo ${f(max)}:1): instale os pistões forjados de baixa compressão`;
}

/** The factory internals tolerate this much over their sane-margin torque on a converted engine. */
export const CONVERSION_INTERNALS_TOLERANCE = 1.12;

export function conversionInternalsError(peakTorqueNm: number, familyInternalsNm: number, pistons?: PistonPart): string | null {
  const limit = familyInternalsNm * (pistons?.torqueLimitScale ?? 1) * CONVERSION_INTERNALS_TOLERANCE;
  if (peakTorqueNm <= limit + 1e-9) return null;
  return `o torque (${peakTorqueNm.toFixed(0)} N·m) passa do que pistões e bielas aguentam (${limit.toFixed(0)} N·m): instale o kit forjado`;
}
