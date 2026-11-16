import { validateCar, type CarConfig } from '../../../data/schema';
import { exhaustPreset } from '../../../data/exhaustPresets';
import { applyEngineParts, curvePeakCv, engineFuel, powerPeakRpm, TURBO_MAX_COMPRESSION, withStockBreathing, type EngineParts } from './breathingModel';
import { CATEGORY_LABEL, CATEGORY_ORDER, findPart, type PartCategory, type PartDef, type TirePart } from './parts';

/**
 * Vehicle Build Resolver: base car + installed part ids → the CarConfig the physics runs.
 *  - order independent (parts are applied by category, never in install order);
 *  - idempotent (the same id twice counts once);
 *  - removing a part returns exactly the base value (the base is never mutated; every build is
 *    derived from the frozen base again);
 *  - one part per category: tyres REPLACE tyres, nothing stacks;
 *  - an invalid build is rejected with a message in pt-BR, never silently "fixed".
 * Every effect is physical (see breathingModel.ts for the engine, and the comments below).
 */
export const BUILD_RESOLVER_VERSION = 1;

/** A turbocharged build needs a clutch with this margin over the engine's peak torque. */
export const CLUTCH_TORQUE_MARGIN = 1.2;
/** Largest ignition-retard loss a tuner accepts before calling the boost setting unsafe. */
export const MAX_KNOCK_LOSS = 0.25;

/** Settings made on the dyno by the engine tuners (career unlock). */
export interface BuildTune {
  boostBar?: number;
}

export type BuildResult =
  | {
      ok: true;
      car: CarConfig;
      parts: PartDef[];
      key: string;
      peakTorqueNm: number;
      peakPowerCv: number;
      steadyBoostBar: { rpm: number; bar: number }[];
      knockLoss: number;
    }
  | { ok: false; errors: string[] };

export function buildKey(baseId: string, partIds: readonly string[], tune: BuildTune = {}): string {
  return `${baseId}|${[...new Set(partIds)].sort().join(',')}${tune.boostBar !== undefined ? `|b${tune.boostBar.toFixed(2)}` : ''}`;
}

const cache = new Map<string, BuildResult>();

/** Resolves (and caches) a build. The returned car is deeply frozen. */
export function resolveBuild(base: CarConfig, partIds: readonly string[], tune: BuildTune = {}): BuildResult {
  const key = buildKey(base.id, partIds, tune);
  const hit = cache.get(key);
  if (hit) return hit;
  const r = resolveUncached(base, partIds, key, tune);
  cache.set(key, r);
  return r;
}

/** Same as resolveBuild but throws on an invalid build (rivals, tests). */
export function resolveBuildOrThrow(base: CarConfig, partIds: readonly string[], tune: BuildTune = {}): CarConfig {
  const r = resolveBuild(base, partIds, tune);
  if (!r.ok) throw new Error(`build inválido (${base.id}): ${r.errors.join('; ')}`);
  return r.car;
}

export function clearBuildCache(): void {
  cache.clear();
}

function resolveUncached(base: CarConfig, partIds: readonly string[], key: string, tune: BuildTune): BuildResult {
  const errors: string[] = [];
  const bySlot = new Map<PartCategory, PartDef>();
  for (const id of new Set(partIds)) {
    const p = findPart(id);
    if (!p) {
      errors.push(`peça desconhecida: ${id}`);
      continue;
    }
    const prev = bySlot.get(p.category);
    if (prev) errors.push(`só cabe uma peça em ${CATEGORY_LABEL[p.category]}: ${prev.name} e ${p.name}`);
    else bySlot.set(p.category, p);
  }
  if (errors.length) return { ok: false, errors };
  const parts = CATEGORY_ORDER.map((c) => bySlot.get(c)).filter((p): p is PartDef => !!p);

  const car: CarConfig = structuredClone(base);
  const get = <C extends PartCategory>(c: C): Extract<PartDef, { category: C }> | undefined =>
    bySlot.get(c) as Extract<PartDef, { category: C }> | undefined;

  // ---- engine (filter, manifold, cam, exhaust, turbo) ----
  const engineParts: EngineParts = {
    filter: get('intake-filter'),
    manifold: get('intake-manifold'),
    cam: get('camshaft'),
    exhaust: get('exhaust'),
    turbo: get('turbo'),
    boostBar: tune.boostBar,
  };
  if (tune.boostBar !== undefined) {
    const t = engineParts.turbo;
    if (!t) return { ok: false, errors: ['ajuste de pressão sem turbo instalado'] };
    const [lo, hi] = t.boostRangeBar;
    if (!(tune.boostBar >= lo && tune.boostBar <= hi))
      return { ok: false, errors: [`pressão fora da faixa do kit (${fmtBar(lo)} a ${fmtBar(hi)} bar)`] };
  }
  if (engineParts.turbo) {
    const fuel = engineFuel(base.engine);
    const max = TURBO_MAX_COMPRESSION[fuel];
    if (base.engine.compressionRatio > max)
      return {
        ok: false,
        errors: [
          `taxa de compressão ${base.engine.compressionRatio.toFixed(1).replace('.', ',')}:1 ${fuel === 'ethanol' ? 'a etanol' : 'a gasolina'} não aceita o kit turbo sem detonar (máximo ${max.toFixed(1).replace('.', ',')}:1)`,
        ],
      };
  }
  const ratedRpm = powerPeakRpm(base.engine.torqueCurve, base.engine.revLimitRpm);
  const stockEngine = withStockBreathing(base.engine, ratedRpm);
  let steadyBoostBar: { rpm: number; bar: number }[] = [];
  let knockLoss = 0;
  if (Object.values(engineParts).some(Boolean)) {
    const r = applyEngineParts(stockEngine, engineParts);
    car.engine = r.engine;
    steadyBoostBar = r.steadyBoostBar;
    knockLoss = r.knockLoss;
  } else {
    car.engine = structuredClone(stockEngine);
  }
  const peakTorqueNm = Math.max(...car.engine.torqueCurve.torqueNm.filter((_, i) => car.engine.torqueCurve.rpm[i]! <= car.engine.revLimitRpm));
  const peakPowerCv = curvePeakCv(car.engine.torqueCurve, car.engine.revLimitRpm);
  car.engine.ratedPowerCv = Math.round(peakPowerCv);

  const turbo = engineParts.turbo;
  if (turbo) {
    car.massKg += turbo.massAddKg; // kit hardware
    car.acoustic = { ...car.acoustic, turboGain: Math.max(car.acoustic.turboGain, 0.7) };
  }
  const exhaust = engineParts.exhaust;
  if (exhaust) {
    // new geometry: wider primaries, the acoustic preset of a free-flowing system
    car.exhaust = {
      ...exhaustPreset(exhaust.acousticPreset, {
        layout: base.exhaust.layout,
        headerPrimaryLengthM: base.exhaust.headerPrimaryLengthM,
        headerDiameterMm: Math.min(base.exhaust.headerDiameterMm * exhaust.headerDiameterScale, 80),
      }),
      outputGain: base.exhaust.outputGain,
    };
  }

  // ---- driveline ----
  const clutch = get('clutch');
  if (clutch) {
    const c = car.transmission.clutch;
    c.maxTorqueNm = Math.round(c.maxTorqueNm * clutch.capacityScale);
    c.engageRatePerS = Math.min(50, c.engageRatePerS * clutch.engageRateScale);
    c.launchRpm = Math.min(c.launchRpm + clutch.launchRpmAdd, car.engine.redlineRpm - 800);
  }
  const diff = get('differential');
  if (diff) car.transmission.finalDrive = Math.round(car.transmission.finalDrive * diff.finalDriveScale * 1000) / 1000;

  // ---- tyres (replace the compound, keep the size) ----
  const tyre = get('tires');
  if (tyre) applyTyre(car, base, tyre);

  // ---- visible parts ----
  car.visual = {
    ...car.visual,
    mods: { intercooler: !!turbo, sportTip: !!exhaust, tyre: tyre?.grade ?? 'stock' },
  };
  if (parts.length) {
    car.name = `${base.name} (preparado)`.slice(0, 64);
  }

  // ---- validation ----
  if (turbo && car.transmission.clutch.maxTorqueNm < peakTorqueNm * CLUTCH_TORQUE_MARGIN) {
    errors.push(
      `o torque do turbo (${peakTorqueNm.toFixed(0)} N·m) passa do que a embreagem segura com folga (${car.transmission.clutch.maxTorqueNm} N·m): instale a embreagem reforçada`,
    );
  }
  if (knockLoss > MAX_KNOCK_LOSS) {
    errors.push(
      `detonação: a ${fmtBar(Math.max(...steadyBoostBar.map((b) => b.bar)))} bar este motor precisa de tanto atraso de ignição que perde ${(knockLoss * 100).toFixed(0)} % do torque; baixe a pressão`,
    );
  }
  const v = validateCar(car);
  if (!v.ok) errors.push(...v.errors);
  if (errors.length) return { ok: false, errors };
  return { ok: true, car: deepFreeze(v.value!), parts, key, peakTorqueNm, peakPowerCv, steadyBoostBar, knockLoss };
}

const fmtBar = (b: number): string => b.toFixed(2).replace('.', ',');

function applyTyre(car: CarConfig, base: CarConfig, t: TirePart): void {
  car.tires = {
    ...base.tires,
    muPeak: t.muPeak,
    B: t.B,
    C: t.C,
    E: t.E,
    wheelInertiaKgM2: base.tires.wheelInertiaKgM2 + t.wheelInertiaAddKgM2,
    rollingResistance: base.tires.rollingResistance + t.rollingResistanceAdd,
    optimalTempC: t.optimalTempC,
    tempSensitivityPerC: t.tempSensitivityPerC,
  };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
