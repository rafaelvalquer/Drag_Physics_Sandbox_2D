import { validateCar, type CarConfig } from '../../../data/schema';
import { exhaustPreset } from '../../../data/exhaustPresets';
import { applyEngineParts, curvePeakCv, engineFuel, powerPeakRpm, TURBO_MAX_COMPRESSION, withStockBreathing, type EngineParts } from './breathingModel';
import { CATEGORY_LABEL, CATEGORY_ORDER_V1, findPart, findPartForVersion, type PartCategory, type PartDef, type TirePart, type FilterPart, type ManifoldPart, type CamPart, type ExhaustPart, type TurboPart, type MechanicalMods } from './parts';
import { applyTuneOverlay, needsOverlay } from './TuningCapabilities';
import { tuneKey, resolverTune, sameTune, applyTyre, applyCoolingHardware, CLUTCH_TORQUE_MARGIN, deepFreeze, workshopFinalDrive, workshopGearRatios, fmtBar, MAX_KNOCK_LOSS, type BuildResult, type BuildTune, type ResolverVersion } from './buildCommon';
import { resolveV2 } from './BuildResolverV2';
import { exhaustPressureAfterSections } from './modernBreathing';

export { CLUTCH_TORQUE_MARGIN, MAX_KNOCK_LOSS, type BuildResult, type BuildTune, type ResolverVersion };

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
/**
 * Latest resolver version. Version 1 is the Chapter 1 resolver and stays byte-for-byte the same:
 * a build stored with version 1 is always resolved by version 1 (old saves are never
 * reinterpreted). Version 2 (Chapter 2) knows the modern parts, gearbox kinds, AWD and engine
 * families; on a Chapter 1 build it produces exactly the version 1 result (tested).
 */
export const BUILD_RESOLVER_VERSION: ResolverVersion = 2;
export const BUILD_RESOLVER_V1: ResolverVersion = 1;

export function buildKey(baseId: string, partIds: readonly string[], tune: BuildTune = {}, version: ResolverVersion = 1): string {
  const k = `${baseId}|${[...new Set(partIds)].sort().join(',')}${tuneKey(tune)}`;
  return version === 1 ? k : `v${version}|${k}`;
}

/** Shared mechanical adjustment limits for workshop and dynamometer. */
export function boostRangeForParts(partIds: readonly string[]): [number, number] | null {
  const kit = partIds.map(findPart).find((p) => p?.category === 'turbo');
  if (!kit) return null;
  const max = 'mod' in kit ? Math.max(1, (kit.mod.turboBoostBar ?? 0.6) + 0.15) : (kit as TurboPart).boostRangeBar[1];
  const waste = partIds.map(findPart).find((p) => p?.category === 'turbo-wastegate');
  const offset = waste && 'mod' in waste ? (waste.mod.wastegateRangeAddBar ?? 0) : 0;
  return [0.4, Math.min(1.8, max + offset)];
}

const cache = new Map<string, BuildResult>();

/** Resolves (and caches) a build with the given resolver version. The returned car is deeply frozen. */
export function resolveBuild(base: CarConfig, partIds: readonly string[], tune: BuildTune = {}, version: ResolverVersion = 1): BuildResult {
  const key = buildKey(base.id, partIds, tune, version);
  const hit = cache.get(key);
  if (hit) return hit;
  const hwTune = resolverTune(tune);
  let r: BuildResult;
  if (!needsOverlay(tune, partIds) && sameTune(hwTune, tune)) r = resolveHardware(base, partIds, tune, version);
  else {
    // the hardware build (boost included) first, then the Dyno Lab settings / parts on top of it
    const hw = resolveHardware(base, partIds, hwTune, version);
    r = hw.ok ? applyTuneOverlay(base, partIds, version, hw, tune, key) : hw;
  }
  if (cache.size > 2000) cache.clear(); // the Dyno Lab previews many settings: keep the cache bounded
  cache.set(key, r);
  return r;
}

const hwCache = new Map<string, BuildResult>();

/**
 * The build of the resolvers alone (hardware + boost setting), without the Dyno Lab overlay. Its
 * key is the plain build key, so a build without settings is exactly what it always was.
 */
export function resolveHardware(base: CarConfig, partIds: readonly string[], tune: BuildTune, version: ResolverVersion): BuildResult {
  const hwTune = resolverTune(tune);
  const key = buildKey(base.id, partIds, hwTune, version);
  const hit = hwCache.get(key);
  if (hit) return hit;
  const r = version === 1 ? resolveUncached(base, partIds, key, hwTune) : resolveV2(base, partIds, key, hwTune, resolveUncached);
  if (hwCache.size > 2000) hwCache.clear();
  hwCache.set(key, r);
  return r;
}

/** Same as resolveBuild but throws on an invalid build (rivals, tests). */
export function resolveBuildOrThrow(base: CarConfig, partIds: readonly string[], tune: BuildTune = {}, version: ResolverVersion = 1): CarConfig {
  const r = resolveBuild(base, partIds, tune, version);
  if (!r.ok) throw new Error(`build inválido (${base.id}): ${r.errors.join('; ')}`);
  return r.car;
}

export function clearBuildCache(): void {
  cache.clear();
  hwCache.clear();
}

/** Version 1 (Chapter 1). Do not change: saved builds of version 1 must resolve exactly as before. */
function resolveUncached(base: CarConfig, partIds: readonly string[], key: string, tune: BuildTune): BuildResult {
  const errors: string[] = [];
  const bySlot = new Map<PartCategory, PartDef>();
  for (const id of new Set(partIds)) {
    const p = findPartForVersion(id, 1);
    if (!p) {
      errors.push(`peça desconhecida: ${id}`);
      continue;
    }
    if (p.compat?.cars && !p.compat.cars.includes(base.id)) {
      errors.push(`${p.name} não é feita para este carro`);
      continue;
    }
    const prev = bySlot.get(p.category);
    if (prev) errors.push(`só cabe uma peça em ${CATEGORY_LABEL[p.category]}: ${prev.name} e ${p.name}`);
    else bySlot.set(p.category, p);
  }
  if (errors.length) return { ok: false, errors };
  const parts = CATEGORY_ORDER_V1.map((c) => bySlot.get(c)).filter((p): p is PartDef => !!p);
  const mod: MechanicalMods = {};
  const compound = new Set(['knockRetardScale', 'coolingKnockScale', 'coolingFrictionScale', 'burnDurationScale', 'turboSpoolScale', 'tireRollingScale']);
  const additive = new Set(['backPressureReductionKPa', 'filterDropReductionKPa', 'intercoolerEffectivenessAdd', 'intercoolerMassAddKg', 'wastegateHoldAddBar', 'drivelineEfficiencyAdd', 'massRemoveKg', 'coolingMassAddKg']);
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
            spoolTimeS: baseKit.turbo.spoolTimeS,
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
    const [lo, hi] = boostRangeForParts(partIds)!;
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
  const exhaust = engineParts.exhaust;
  let steadyBoostBar: { rpm: number; bar: number }[] = [];
  let knockLoss = 0;
  // Non-engine upgrades (clutch, tyres, mass, suspension, internals) must not resample
  // the engine curve: restoring them keeps factory motor physics byte-for-byte.
  const nonEnginePrefix = /^(clutch|finalDrive|gearSpread|driveline|tire|massRemove|cgHeight|launchCg|internalTorqueLimit|fuelBoostLimit|radiatorArea|oilCoolerArea|fanFlow|coolingMass)/;
  const engineMods = Object.entries(mod).filter(([key]) => !nonEnginePrefix.test(key));
  const changesEngine = !!(engineParts.filter || engineParts.manifold || engineParts.cam || engineParts.exhaust || engineParts.turbo)
    || engineMods.length > 0;
  if (changesEngine) {
    const engineMod: MechanicalMods = Object.fromEntries(engineMods);
    if (exhaust) {
      const sectionReduction = parts.reduce((sum, part) => {
        const section = part.category === 'exhaust-header' || part.category === 'exhaust-pipe' || part.category === 'exhaust-muffler';
        return sum + (section && 'mod' in part ? part.mod.backPressureReductionKPa ?? 0 : 0);
      }, 0);
      engineMod.backPressureKPa = exhaustPressureAfterSections(
        stockEngine.breathing!.exhaustBackPressureKPa, exhaust.backPressureKPa, false,
        { backPressureReductionKPa: sectionReduction },
      );
      // A turbine's relief is independent of the overlapping work on the exhaust line.
      engineMod.backPressureReductionKPa = Math.max(0, (mod.backPressureReductionKPa ?? 0) - sectionReduction);
    }
    const r = applyEngineParts(stockEngine, { ...engineParts, mod: engineMod });
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
  if (exhaust || mod.headerDiameterScale || mod.exhaustDiameterScale || mod.exhaustAbsorptionScale) {
    // new geometry: wider primaries, the acoustic preset of a free-flowing system
    const acousticBase = exhaust ? exhaustPreset(exhaust.acousticPreset, {
      layout: base.exhaust.layout,
      headerPrimaryLengthM: base.exhaust.headerPrimaryLengthM,
      headerDiameterMm: Math.min(base.exhaust.headerDiameterMm * exhaust.headerDiameterScale, 70),
    }) : structuredClone(base.exhaust);
    car.exhaust = {
      ...acousticBase,
      headerDiameterMm: Math.min(70, Math.max(acousticBase.headerDiameterMm, base.exhaust.headerDiameterMm * (mod.headerDiameterScale ?? 1))),
      tailpipeDiameterMm: Math.min(120, Math.max(acousticBase.tailpipeDiameterMm * (exhaust?.tailpipeDiameterScale ?? 1), base.exhaust.tailpipeDiameterMm * (mod.exhaustDiameterScale ?? 1))),
      mufflerAbsorption: Math.max(0, Math.min(acousticBase.mufflerAbsorption * (exhaust?.mufflerAbsorptionScale ?? 1), base.exhaust.mufflerAbsorption * (mod.exhaustAbsorptionScale ?? 1))),
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
    if (clutch?.inputInertiaScale) car.transmission.inputInertiaKgM2 = Math.max(0.001, car.transmission.inputInertiaKgM2 * clutch.inputInertiaScale);
    const plate = clutch?.engineInertiaScale ?? mod.clutchEngineInertiaScale;
    if (plate) car.engine.inertiaKgM2 = Math.round(car.engine.inertiaKgM2 * plate * 10000) / 10000;
  }
  const diff = legacy('differential') as Extract<PartDef, {category: 'differential'}> | undefined;

  // ---- tyres (replace the compound, keep the size) ----
  const tyre = legacy('tires') as TirePart | undefined;
  if (tyre) applyTyre(car, base, tyre);
  if (mod.tireMuScale) car.tires.muPeak = Math.min(2.5, car.tires.muPeak * mod.tireMuScale);
  if (mod.tireInertiaAddKgM2) car.tires.wheelInertiaKgM2 += mod.tireInertiaAddKgM2;
  if (mod.tireOptimalTempC !== undefined) car.tires.optimalTempC = mod.tireOptimalTempC;
  if (mod.tireTempSensitivity !== undefined) car.tires.tempSensitivityPerC = mod.tireTempSensitivity;
  if (mod.tireStiffnessScale) car.tires.B = Math.min(25, car.tires.B * mod.tireStiffnessScale);
  if (mod.tireTempSensitivityScale) car.tires.tempSensitivityPerC *= mod.tireTempSensitivityScale;
  if (mod.tireRollingScale) car.tires.rollingResistance = Math.max(0.005, car.tires.rollingResistance * mod.tireRollingScale);
  if (mod.massRemoveKg) car.massKg = Math.max(500, car.massKg - mod.massRemoveKg);
  applyCoolingHardware(car, mod);
  if (mod.cgHeightDeltaM) car.cgHeightM = Math.max(0.25, car.cgHeightM + mod.cgHeightDeltaM);
  // drag suspension: load transfer towards the driven axle (front drive: less, rear drive: more)
  if (mod.launchCgDeltaM) car.cgHeightM = Math.max(0.25, car.cgHeightM + (base.drivenAxle === 'front' ? -1 : 1) * mod.launchCgDeltaM);

  // ---- gearing, chosen for the finished car (engine, tyres and mass above) ----
  // close-ratio box: first and top stay; the intermediate gears close in (see workshopGearRatios)
  if (mod.gearSpreadScale) car.transmission.gearRatios = workshopGearRatios(car, base.transmission.gearRatios, mod.gearSpreadScale);
  if (diff || mod.finalDriveScale)
    car.transmission.finalDrive = workshopFinalDrive(car, base.transmission.finalDrive, diff?.finalDriveScale ?? mod.finalDriveScale ?? 1);
  // new gears/bearings run with less loss than the worn factory set
  const effAdd = (diff?.efficiencyAdd ?? 0) + (mod.drivelineEfficiencyAdd ?? 0);
  if (effAdd) car.transmission.efficiency = Math.min(0.97, Math.round((car.transmission.efficiency + effAdd) * 1000) / 1000);

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
  return { ok: true, car: deepFreeze(v.value!), parts, key, peakTorqueNm, peakPowerCv, steadyBoostBar, knockLoss, version: 1 };
}

