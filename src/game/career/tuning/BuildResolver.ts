import { validateCar, type CarConfig } from '../../../data/schema';
import { exhaustPreset } from '../../../data/exhaustPresets';
import { applyEngineParts, curvePeakCv, engineFuel, powerPeakRpm, TURBO_MAX_COMPRESSION, withStockBreathing, type EngineParts } from './breathingModel';
import { CATEGORY_LABEL, CATEGORY_ORDER, findPart, type PartCategory, type PartDef, type TirePart, type FilterPart, type ManifoldPart, type CamPart, type ExhaustPart, type TurboPart, type MechanicalMods } from './parts';

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
export const BUILD_RESOLVER_VERSION = 2;

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
  const mod: MechanicalMods = {};
  const compound = new Set(['knockRetardScale', 'coolingKnockScale', 'coolingFrictionScale']);
  const additive = new Set(['backPressureReductionKPa', 'filterDropReductionKPa', 'intercoolerEffectivenessAdd', 'intercoolerMassAddKg']);
  for (const p of parts) if ('mod' in p) {
    for (const [k, v] of Object.entries(p.mod)) {
      if (v === undefined) continue;
      mod[k] = mod[k] === undefined ? v : compound.has(k) ? mod[k]! * v : additive.has(k) ? mod[k]! + v : v;
    }
  }
  const kitInstalled = bySlot.has('turbo');
  if (!kitInstalled && parts.some((p) => 'requiresTurbo' in p && p.requiresTurbo))
    errors.push('turbina, intercooler, wastegate e pressão exigem um kit turbo instalado');
  if (mod.boostTargetBar !== undefined && !kitInstalled)
    errors.push('ajuste de pressão exige kit turbo');
  if (errors.length) return { ok: false, errors };

  const car: CarConfig = structuredClone(base);
  const get = (c: PartCategory): PartDef | undefined => bySlot.get(c);
  const legacy = (c: PartCategory): PartDef | undefined => {
    const p = get(c);
    return p && !('mod' in p) ? p : undefined;
  };
  const kit = get('turbo');
  const baseKit = findPart('turbo-basic') as TurboPart;
  const turbo: TurboPart | undefined = kit
    ? 'mod' in kit
      ? {
          ...baseKit, id: kit.id, name: kit.name, price: kit.price, unlock: kit.unlock,
          turbo: {
            ...baseKit.turbo,
            maxBoostBar: mod.turboBoostBar ?? baseKit.turbo.maxBoostBar,
            spoolTimeS: baseKit.turbo.spoolTimeS * (mod.turboSpoolScale ?? 1),
          },
          massAddKg: mod.turboMassAddKg ?? baseKit.massAddKg,
          intercoolerEffectiveness: mod.intercoolerEffectiveness ?? baseKit.intercoolerEffectiveness,
          boostRangeBar: [0.4, Math.max(1, (mod.turboBoostBar ?? 0) + 0.15)],
        }
      : kit as TurboPart
    : undefined;

  // ---- engine hardware; advanced slots provide additional operating parameters ----
  const engineParts: EngineParts = {
    filter: legacy('intake-filter') as FilterPart | undefined,
    manifold: legacy('intake-manifold') as ManifoldPart | undefined,
    cam: legacy('camshaft') as CamPart | undefined,
    exhaust: legacy('exhaust') as ExhaustPart | undefined,
    turbo,
    boostBar: tune.boostBar,
    mod,
  };
  if (tune.boostBar !== undefined) {
    const t = engineParts.turbo;
    if (!t) return { ok: false, errors: ['ajuste de pressão sem turbo instalado'] };
    const [lo, max] = t.boostRangeBar;
    const hi = Math.min(2, max + (mod.wastegateRangeAddBar ?? 0));
    if (!(tune.boostBar >= lo && tune.boostBar <= hi))
      return { ok: false, errors: [`pressão fora da faixa do kit (${fmtBar(lo)} a ${fmtBar(hi)} bar)`] };
  }
  if (engineParts.turbo) {
    const fuel = engineFuel(base.engine);
    const max = TURBO_MAX_COMPRESSION[fuel];
    const compressionRatio = base.engine.compressionRatio + (mod.compressionRatioDelta ?? 0);
    if (compressionRatio > max)
      return {
        ok: false,
        errors: [
          `taxa de compressão ${compressionRatio.toFixed(1).replace('.', ',')}:1 ${fuel === 'ethanol' ? 'a etanol' : 'a gasolina'} não aceita o kit turbo sem detonar (máximo ${max.toFixed(1).replace('.', ',')}:1)`,
        ],
      };
  }
  const ratedRpm = powerPeakRpm(base.engine.torqueCurve, base.engine.revLimitRpm);
  const stockEngine = withStockBreathing(base.engine, ratedRpm);
  let steadyBoostBar: { rpm: number; bar: number }[] = [];
  let knockLoss = 0;
  if (parts.length || tune.boostBar !== undefined) {
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

  const turboInstalled = engineParts.turbo;
  if (turboInstalled) {
    car.massKg += turboInstalled.massAddKg + (mod.intercoolerMassAddKg ?? 0); // charging hardware
    car.acoustic = { ...car.acoustic, turboGain: Math.max(car.acoustic.turboGain, 0.7) };
  }
  const exhaust = engineParts.exhaust;
  if (exhaust || mod.headerDiameterScale || mod.exhaustDiameterScale || mod.exhaustAbsorptionScale) {
    // new geometry: wider primaries, the acoustic preset of a free-flowing system
    const acousticBase = exhaust ? exhaustPreset(exhaust.acousticPreset, {
      layout: base.exhaust.layout,
      headerPrimaryLengthM: base.exhaust.headerPrimaryLengthM,
      headerDiameterMm: Math.min(base.exhaust.headerDiameterMm * exhaust.headerDiameterScale, 70),
    }) : structuredClone(base.exhaust);
    car.exhaust = {
      ...acousticBase,
      headerDiameterMm: Math.min(70, acousticBase.headerDiameterMm * (mod.headerDiameterScale ?? 1)),
      tailpipeDiameterMm: Math.min(120, acousticBase.tailpipeDiameterMm * (mod.exhaustDiameterScale ?? 1)),
      mufflerAbsorption: Math.max(0, acousticBase.mufflerAbsorption * (mod.exhaustAbsorptionScale ?? 1)),
      outputGain: base.exhaust.outputGain,
    };
  }

  // ---- driveline ----
  const clutch = legacy('clutch') as Extract<PartDef, {category: 'clutch'}> | undefined;
  if (clutch || mod.clutchCapacityScale) {
    const c = car.transmission.clutch;
    c.maxTorqueNm = Math.round(c.maxTorqueNm * (clutch?.capacityScale ?? mod.clutchCapacityScale ?? 1));
    c.engageRatePerS = Math.min(50, c.engageRatePerS * (clutch?.engageRateScale ?? mod.clutchEngageRateScale ?? 1));
    c.launchRpm = Math.min(c.launchRpm + (clutch?.launchRpmAdd ?? mod.clutchLaunchAddRpm ?? 0), car.engine.redlineRpm - 800);
  }
  const diff = legacy('differential') as Extract<PartDef, {category: 'differential'}> | undefined;
  if (diff || mod.finalDriveScale) car.transmission.finalDrive = Math.round(car.transmission.finalDrive * (diff?.finalDriveScale ?? mod.finalDriveScale ?? 1) * 1000) / 1000;
  if (mod.gearSpreadScale) {
    // Preserve first gear and smoothly bring intermediate ratios closer to the last gear.
    const ratios = base.transmission.gearRatios;
    const first = ratios[0]!;
    car.transmission.gearRatios = ratios.map((r, i) => Math.max(0.4, Math.min(6, i === 0 ? first : first * Math.pow(r / first, mod.gearSpreadScale!))));
  }

  // ---- tyres (replace the compound, keep the size) ----
  const tyre = legacy('tires') as TirePart | undefined;
  if (tyre) applyTyre(car, base, tyre);
  if (mod.tireMuScale) car.tires.muPeak = Math.min(2.5, car.tires.muPeak * mod.tireMuScale);
  if (mod.tireInertiaAddKgM2) car.tires.wheelInertiaKgM2 += mod.tireInertiaAddKgM2;
  if (mod.tireOptimalTempC !== undefined) car.tires.optimalTempC = mod.tireOptimalTempC;
  if (mod.tireTempSensitivity !== undefined) car.tires.tempSensitivityPerC = mod.tireTempSensitivity;
  if (mod.tireStiffnessScale) car.tires.B = Math.min(25, car.tires.B * mod.tireStiffnessScale);
  if (mod.tireTempSensitivityScale) car.tires.tempSensitivityPerC *= mod.tireTempSensitivityScale;
  if (mod.massRemoveKg) car.massKg = Math.max(500, car.massKg - mod.massRemoveKg);
  if (mod.cgHeightDeltaM) car.cgHeightM = Math.max(0.25, car.cgHeightM + mod.cgHeightDeltaM);

  // ---- visible parts ----
  car.visual = {
    ...car.visual,
    mods: { intercooler: !!turboInstalled, sportTip: !!exhaust || !!mod.exhaustDiameterScale || !!mod.exhaustAbsorptionScale, tyre: mod.tireMuScale && mod.tireMuScale > 1.4 ? 'semiSlick' : tyre?.grade ?? 'stock' },
  };
  if (parts.length) {
    car.name = `${base.name} (preparado)`.slice(0, 64);
  }

  // ---- validation ----
  if (turboInstalled && mod.fuelBoostLimitBar !== undefined && (tune.boostBar ?? mod.boostTargetBar ?? turboInstalled.turbo.maxBoostBar) > mod.fuelBoostLimitBar) {
    errors.push('alimentação de combustível insuficiente para a pressão configurada');
  }
  if (turboInstalled && (tune.boostBar ?? mod.boostTargetBar ?? turboInstalled.turbo.maxBoostBar) > 0.95 && !mod.fuelBoostLimitBar) {
    errors.push('pressão superior a 0,95 bar exige bicos ou bomba de maior vazão');
  }
  const stockTorqueLimitNm = Math.max(320, base.transmission.clutch.maxTorqueNm * 1.45);
  if (turboInstalled && peakTorqueNm > (mod.internalTorqueLimitNm ?? stockTorqueLimitNm)) {
    errors.push('torque excede o limite mecânico dos internos; instale bielas e pistões reforçados');
  }
  if (turboInstalled && car.transmission.clutch.maxTorqueNm < peakTorqueNm * CLUTCH_TORQUE_MARGIN) {
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
