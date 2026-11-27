/**
 * Turbo build matrix for the acoustic lab and the regression tests: every turbocharged car of the
 * catalogue, plus the classic kits, turbine sizes and boost settings, the modern factory-turbo
 * stages and the NA → turbo conversions. Only combinations the mechanical resolver ACCEPTS are
 * returned (invalid ones are listed in `rejected`, never forced).
 */
import { CAMPAIGN_CARS } from '../../data/cars/campaign';
import { CHAPTER2_CARS } from '../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../data/cars/chapter3/index';
import { CARS, findCar } from '../../data/cars/index';
import { BUILT_IN_SANDBOX_PRESETS } from '../../data/cars/sandboxPresets';
import type { CarConfig } from '../../data/schema';
import { BUILD_RESOLVER_VERSION, boostRangeForParts, resolveBuild } from '../../game/career/tuning/BuildResolver';
import { familyOf, incompatibility, transmissionKindOf } from '../../game/career/tuning/BuildResolverV2';
import type { BuildTune } from '../../game/career/tuning/buildCommon';
import { MODERN_CONVERSION_PARTS } from '../../game/career/tuning/modernConversionParts';

export interface TurboBuild {
  /** Stable id: `<car>/<label>`. */
  id: string;
  carId: string;
  label: string;
  partIds: string[];
  tune: BuildTune;
  car: CarConfig;
  group: 'classic' | 'factory' | 'conversion' | 'twin' | 'sandbox-preset' | 'lab';
}

export const CLASSIC_TURBO_CARS = [
  'vw-gol-gts-1988',
  'vw-saveiro-gl-1994',
  'fiat-uno-mille-1995',
  'gm-chevette-sl-1988',
  'gm-celta-2003',
  'gm-corsa-gl-1996',
  'gm-kadett-sl-1992',
] as const;

/** Heavy supporting hardware so every classic kit/turbine fits (same context as the workshop audit). */
function classicSupport(carId: string): string[] {
  return ['clutch-ceramic-race', 'fuel-pump', 'forged-kit', 'ecu-race', 'ignition-race', ...(carId === 'gm-celta-2003' ? ['compression-celta-turbo-s3'] : [])];
}

function supportedTransmission(car: CarConfig): string {
  const kind = transmissionKindOf(car);
  const clutch = car.engine.family ? `clutch-${familyOf(car)}-s3` : 'clutch-reinforced';
  return kind === 'manual' ? clutch : kind === 'dual-clutch' ? 'dct-upgrade' : 'at-upgrade';
}

function conversionSupport(car: CarConfig): string[] {
  const family = familyOf(car);
  const chamber = MODERN_CONVERSION_PARTS.find((part) => part.category === 'engine-compression' && !incompatibility(car, part));
  return [...(chamber ? [chamber.id] : []), `conversion-oil-${family}`, `fuel-${family}-s3`, `ignition-${family}-s3`, `rotating-assembly-${family}-s3`, supportedTransmission(car)];
}

export interface TurboBuildMatrix {
  builds: TurboBuild[];
  rejected: { id: string; errors: string[] }[];
}

const allCars = (): CarConfig[] => {
  const seen = new Set<string>();
  return [...CARS, ...CAMPAIGN_CARS, ...CHAPTER2_CARS, ...CHAPTER3_CARS].filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
};

/** Full matrix (or the cars in `only`). */
export function turboBuildMatrix(only?: readonly string[]): TurboBuildMatrix {
  const builds: TurboBuild[] = [];
  const rejected: { id: string; errors: string[] }[] = [];
  const want = (id: string): boolean => !only || only.includes(id);
  const tryBuild = (base: CarConfig, label: string, partIds: string[], tune: BuildTune, group: TurboBuild['group']): void => {
    const id = `${base.id}/${label}`;
    const r = resolveBuild(base, partIds, tune, BUILD_RESOLVER_VERSION);
    if (!r.ok) {
      rejected.push({ id, errors: r.errors });
      return;
    }
    if (r.car.engine.induction !== 'turbo') return;
    builds.push({ id, carId: base.id, label, partIds, tune, car: r.car, group });
  };
  for (const base of allCars()) {
    if (!want(base.id)) continue;
    // factory turbo (stock) and parallel twins
    if (base.engine.induction === 'turbo') {
      const twin = base.engine.turbo?.layout === 'parallel-twin';
      builds.push({ id: `${base.id}/stock`, carId: base.id, label: 'stock', partIds: [], tune: {}, car: base, group: twin ? 'twin' : base.engine.family ? 'factory' : 'lab' });
      if (base.engine.family) {
        const fam = familyOf(base);
        const ctx = ['ecu-programmable', 'intercooler-race', `fuel-${fam}-s3`, `rotating-assembly-${fam}-s3`, supportedTransmission(base)];
        for (const tier of [1, 2, 3]) tryBuild(base, `turbo-s${tier}`, [...ctx, `factory-turbo-${fam}-s${tier}`], {}, twin ? 'twin' : 'factory');
        tryBuild(base, 'intake-s3', [`intake-filter-${fam}-s3`], {}, twin ? 'twin' : 'factory');
      }
    }
    // classic kits × turbines × boost
    if ((CLASSIC_TURBO_CARS as readonly string[]).includes(base.id)) {
      const sup = classicSupport(base.id);
      for (const kit of ['turbo-basic', 'turbo-street', 'turbo-medium', 'turbo-strong']) tryBuild(base, kit, [...sup, kit], {}, 'classic');
      // rotor sizes on the medium kit (the kit that takes every turbine)
      for (const turbine of ['turbine-small', 'turbine-medium', 'turbine-large']) tryBuild(base, `turbo-medium+${turbine}`, [...sup, 'turbo-medium', turbine], {}, 'classic');
      const range = boostRangeForParts([...sup, 'turbo-medium']);
      if (range) {
        tryBuild(base, 'turbo-medium@min', [...sup, 'turbo-medium'], { boostBar: range[0] }, 'classic');
        tryBuild(base, 'turbo-medium@max', [...sup, 'turbo-medium'], { boostBar: Math.min(range[1], 1.3) }, 'classic');
      }
      tryBuild(base, 'turbo-basic+filter-sport', [...sup, 'turbo-basic', 'filter-sport'], {}, 'classic');
      tryBuild(base, 'turbo-basic+filter-direct', [...sup, 'turbo-basic', 'filter-direct'], {}, 'classic');
      tryBuild(base, 'turbo-strong+wastegate-race', [...sup, 'turbo-strong', 'wastegate-race'], {}, 'classic');
    }
    // modern NA → turbo conversions
    if (base.engine.induction === 'NA' && base.engine.family) {
      const kits = MODERN_CONVERSION_PARTS.filter((p) => p.category === 'turbo' && !incompatibility(base, p));
      if (kits.length) {
        const sup = conversionSupport(base);
        for (const kit of kits) tryBuild(base, kit.id.replace(/^conversion-turbo-[^]*-s/, 'conversion-s'), [...sup, kit.id], {}, 'conversion');
      }
    }
  }
  for (const p of BUILT_IN_SANDBOX_PRESETS) {
    if (!want(p.baseCarId) || p.car.engine.induction !== 'turbo') continue;
    builds.push({ id: `${p.baseCarId}/preset:${p.id}`, carId: p.baseCarId, label: `preset:${p.id}`, partIds: [...p.partIds], tune: { ...p.tune }, car: p.car, group: 'sandbox-preset' });
  }
  return { builds, rejected };
}

/** A single resolved build (throws when the resolver refuses it). */
export function resolveTurboBuild(carId: string, partIds: string[], tune: BuildTune = {}): CarConfig {
  const base = findCar(carId);
  if (!base) throw new Error(`car ${carId} missing`);
  const r = resolveBuild(base, partIds, tune, BUILD_RESOLVER_VERSION);
  if (!r.ok) throw new Error(`build ${carId} [${partIds.join(',')}] refused: ${r.errors.join('; ')}`);
  return r.car;
}

/**
 * One representative build per turbo-capable car (fast: lab defaults, tests): the factory turbo as
 * delivered, the Sandbox presets of the Gol and of Marcos' Saveiro, the medium kit on the other
 * classics and the Stage 2 conversion on the modern NA engines.
 */
export function referenceTurboBuilds(only?: readonly string[]): TurboBuild[] {
  const out: TurboBuild[] = [];
  const want = (id: string): boolean => !only || only.includes(id);
  for (const base of allCars()) {
    if (!want(base.id)) continue;
    if (base.engine.induction === 'turbo') {
      out.push({ id: `${base.id}/stock`, carId: base.id, label: 'stock', partIds: [], tune: {}, car: base, group: base.engine.turbo?.layout === 'parallel-twin' ? 'twin' : base.engine.family ? 'factory' : 'lab' });
      continue;
    }
    const preset = BUILT_IN_SANDBOX_PRESETS.find((p) => p.baseCarId === base.id && p.car.engine.induction === 'turbo');
    if (preset) {
      out.push({ id: `${base.id}/preset:${preset.id}`, carId: base.id, label: `preset:${preset.id}`, partIds: [...preset.partIds], tune: { ...preset.tune }, car: preset.car, group: 'sandbox-preset' });
      continue;
    }
    let parts: string[] | undefined;
    let group: TurboBuild['group'] = 'classic';
    let label = 'turbo-medium';
    if ((CLASSIC_TURBO_CARS as readonly string[]).includes(base.id)) parts = [...classicSupport(base.id), 'turbo-medium'];
    else if (base.engine.family) {
      const kit = MODERN_CONVERSION_PARTS.find((p) => p.category === 'turbo' && p.progression?.tier === 2 && !incompatibility(base, p));
      if (kit) {
        parts = [...conversionSupport(base), kit.id];
        group = 'conversion';
        label = 'conversion-s2';
      }
    }
    if (!parts) continue;
    const r = resolveBuild(base, parts, {}, BUILD_RESOLVER_VERSION);
    if (r.ok && r.car.engine.induction === 'turbo') out.push({ id: `${base.id}/${label}`, carId: base.id, label, partIds: parts, tune: {}, car: r.car, group });
  }
  return out;
}
