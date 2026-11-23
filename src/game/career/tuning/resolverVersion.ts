import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import type { ResolverVersion } from './BuildResolver';
import { findPart } from './parts';

const modernCars = new Set([...CHAPTER2_CARS, ...CHAPTER3_CARS].map((car) => car.id));

/** Selects the minimum version a career build requires, preserving a saved upgrade to v2. */
export function careerResolverVersion(
  baseCarId: string,
  partIds: readonly string[] = [],
  storedVersion: ResolverVersion = 1,
): ResolverVersion {
  return modernCars.has(baseCarId) || storedVersion === 2 || partIds.some((id) => findPart(id)?.since === 2) ? 2 : 1;
}
