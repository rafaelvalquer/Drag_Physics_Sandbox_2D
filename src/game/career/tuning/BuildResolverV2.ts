import { validateCar, type CarConfig, type TransmissionKind } from '../../../data/schema';
import { exhaustPreset } from '../../../data/exhaustPresets';
import { applyEngineParts, curvePeakCv, engineFuel, powerPeakRpm, TURBO_MAX_COMPRESSION, withStockBreathing, type EngineParts } from './breathingModel';
import { applyCoolingHardware, applyGenericChassisMods, applyTyre, CLUTCH_TORQUE_MARGIN, combineMods, deepFreeze, fmtBar, workshopFinalDrive, workshopGearRatios, MAX_KNOCK_LOSS, type BuildResult, type BuildTune } from './buildCommon';
import { ENGINE_FAMILIES } from './chapter2Parts';
import { applyFactoryTurboParts, factoryChargeTemperatureK, wastegateMaxBar } from './factoryTurboModel';
import { factoryFuelSupply, fuelMixtureRatio, peakFuelDemandKgS } from './fuelDelivery';
import { exhaustPressureAfterSections, isModernBreathingPart } from './modernBreathing';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER_V2,
  findPartForVersion,
  GENERIC_V2_CATEGORIES,
  LEGACY_FAMILY,
  type CamPart,
  type PartCategory,
  type PartDef,
  type TurboPart,
  type TurboUpgradePart,
} from './parts';

/**
 * Vehicle Build Resolver, version 2 (Chapter 2). Same contract as version 1 (pure, order
 * independent, idempotent, one part per category, the base is never mutated, invalid builds are
 * rejected in pt-BR) plus:
 *  - explicit hardware compatibility: engine family, induction, gearbox kind, driven axle;
 *  - factory-turbo engines are tuned through the ECU / turbo / intercooler / wastegate model
 *    (factoryTurboModel.ts); NA engines through the breathing model (head, pistons, remap added);
 *  - gearbox kinds: manual clutch, twin-clutch packs and torque-converter automatics each have their
 *    own capacity check and their own upgrade; AWD centre coupling; drag suspension per drive;
 *  - a Chapter 1 build (engine without family, only version 1 parts) resolves to exactly the
 *    version 1 car: the v1 resolver is called for it.
 */

/** Twin-clutch packs need this margin over the peak torque; automatics' shift elements the next one. */
export const DCT_TORQUE_MARGIN = 1.15;
export const AT_TORQUE_MARGIN = 1.1;
/** Highest compression ratio an NA engine takes on pump fuel (98 RON / E100). */
export const NA_MAX_COMPRESSION: Record<'gasoline' | 'ethanol', number> = { gasoline: 12.5, ethanol: 14 };

type V1Resolver = (base: CarConfig, partIds: readonly string[], key: string, tune: BuildTune) => BuildResult;

export function familyOf(car: CarConfig): string {
  return car.engine.family ?? LEGACY_FAMILY;
}

export function transmissionKindOf(car: CarConfig): TransmissionKind {
  return car.transmission.kind ?? 'manual';
}

/** Why a part does not fit a car (pt-BR), or null when it fits. */
export function incompatibility(base: CarConfig, p: PartDef): string | null {
  const fam = familyOf(base);
  // two catalogues: the slot catalogue (v1, classic engines) and the family parts (v2, modern engines)
  // car hardware of the slot catalogue (mass, cooling, tyre size/pressure) fits every car
  if ('mod' in p && fam !== LEGACY_FAMILY && !GENERIC_V2_CATEGORIES.includes(p.category) && !isModernBreathingPart(p))
    return `${p.name} é do catálogo dos motores clássicos`;
  if ((p.since ?? 1) === 2 && fam === LEGACY_FAMILY) return `${p.name} é para motores modernos`;
  const c = p.compat;
  if (!c) return null;
  if (c.cars && !c.cars.includes(base.id)) return `${p.name} não é feita para este carro`;
  if (c.families && !c.families.includes(fam)) {
    const label = ENGINE_FAMILIES[fam]?.label ?? 'este motor';
    return `${p.name} não é feita para ${label}`;
  }
  if (c.layouts && !c.layouts.includes(base.engine.architecture)) return `${p.name} não é feita para este tipo de motor`;
  if (c.induction && c.induction !== base.engine.induction)
    return c.induction === 'turbo' ? `${p.name} é para motor turbo` : `${p.name} é para motor aspirado`;
  if (c.transmissions && !c.transmissions.includes(transmissionKindOf(base))) {
    const kinds: Record<TransmissionKind, string> = { manual: 'câmbio manual', 'dual-clutch': 'câmbio de dupla embreagem', 'torque-converter-auto': 'câmbio automático' };
    return `${p.name} só serve em ${c.transmissions.map((k) => kinds[k]).join(' ou ')}`;
  }
  if (c.drives && !c.drives.includes(base.drivenAxle)) {
    const d = { front: 'tração dianteira', rear: 'tração traseira', awd: 'tração integral' } as const;
    return `${p.name} é para ${c.drives.map((x) => d[x]).join(' ou ')}`;
  }
  return null;
}

export function resolveV2(base: CarConfig, partIds: readonly string[], key: string, tune: BuildTune, resolveV1: V1Resolver): BuildResult {
  const errors: string[] = [];
  const bySlot = new Map<PartCategory, PartDef>();
  for (const id of new Set(partIds)) {
    const p = findPartForVersion(id, 2);
    if (!p) {
      errors.push(`peça desconhecida: ${id}`);
      continue;
    }
    const prev = bySlot.get(p.category);
    if (prev) errors.push(`só cabe uma peça em ${CATEGORY_LABEL[p.category]}: ${prev.name} e ${p.name}`);
    else bySlot.set(p.category, p);
  }
  if (errors.length) return { ok: false, errors };
  for (const p of bySlot.values()) {
    const why = incompatibility(base, p);
    if (why) errors.push(why);
  }
  if (errors.length) return { ok: false, errors };

  const parts = CATEGORY_ORDER_V2.map((c) => bySlot.get(c)).filter((p): p is PartDef => !!p);
  const fam = familyOf(base);
  // generic slot-catalogue hardware on a modern car (cooling, mass, tyre size/pressure)
  const genericMod = fam === LEGACY_FAMILY ? {} : combineMods(parts);
  const sectionParts = parts.filter(isModernBreathingPart);
  const sectionMod = combineMods(sectionParts);

  // Chapter 1 hardware: the version 1 resolver is the reference (identical result, v2 key)
  if (fam === LEGACY_FAMILY && parts.every((p) => (p.since ?? 1) === 1)) {
    const r = resolveV1(base, partIds, key, tune);
    return r.ok ? { ...r, key, version: 2 } : r;
  }

  const car: CarConfig = structuredClone(base);
  const get = <C extends PartCategory>(c: C): Extract<PartDef, { category: C }> | undefined => bySlot.get(c) as Extract<PartDef, { category: C }> | undefined;
  const ecu = get('ecu');
  const pistons = get('pistons');
  const ignition = get('electronics-ignition');
  const ignitionMod = ignition && { burnDurationScale: ignition.burnDurationScale, knockRetardScale: ignition.knockRetardScale };
  const exhaust = get('exhaust');
  const fuelSupply = get('electronics-fuel');
  const meteredFuel = fuelSupply || ecu?.fuelTargetScale !== undefined;
  const ratedRpm = powerPeakRpm(base.engine.torqueCurve, base.engine.revLimitRpm);
  // Meter the new supply against the air demand before any previous fuel cut.
  const stockInput = meteredFuel && base.engine.fueling ? { ...base.engine, fueling: undefined } : base.engine;
  const stockEngine = withStockBreathing(stockInput, ratedRpm);
  const stockBackPressure = stockEngine.breathing!.exhaustBackPressureKPa;
  const exhaustMod = sectionMod.backPressureReductionKPa === undefined ? sectionMod : {
    ...sectionMod,
    // The NA model applies the computed pressure once, including any complete system.
    backPressureKPa: exhaustPressureAfterSections(
      stockBackPressure,
      exhaust?.backPressureKPa ?? stockBackPressure,
      exhaust?.section === 'downpipe',
      sectionMod,
    ),
    backPressureReductionKPa: undefined,
  };
  const turboSlot = get('turbo');
  const turboKit = turboSlot && !('upgrade' in turboSlot) ? (turboSlot as TurboPart) : undefined;
  const conversion = turboKit?.conversion;
  const turboUp = turboSlot && 'upgrade' in turboSlot ? (turboSlot as TurboUpgradePart) : undefined;
  const compressionAdd = (pistons?.compressionAdd ?? 0) + (get('engine-compression')?.compressionAdd ?? 0);
  let steadyBoostBar: { rpm: number; bar: number }[] = [];
  let knockLoss = 0;
  let exhaustRestrictionKPa: number | undefined;
  let chargeTemperatureAtTargetK: number | undefined;
  let wastegateLimitBar: number | undefined;
  let mappedTorqueLimitNm: number | undefined;
  let engineModified = false;

  // ---- engine ----
  const factoryTurbo = base.engine.induction === 'turbo' && fam !== LEGACY_FAMILY;
  if (factoryTurbo) {
    const family = ENGINE_FAMILIES[fam];
    if (!family) return { ok: false, errors: [`família de motor sem dados de preparação: ${fam}`] };
    const boostControl = get('boost-control');
    const wastegate = get('turbo-wastegate');
    const wg = wastegateMaxBar(stockEngine, boostControl, ecu, wastegate);
    wastegateLimitBar = wg;
    const matchedHybrid = turboUp?.factoryTurboStage === 2 && ecu?.level === 'stage2' && ecu.fuelTargetScale !== undefined;
    if (turboUp && turboUp.factoryTurboStage !== 1 && !matchedHybrid && ecu?.level !== 'programmable' && ecu?.level !== 'stage3')
      errors.push('a turbina de maior fluxo exige ECU programável ou remap compatível');
    if (turboUp?.factoryTurboStage === 3) {
      if ((pistons?.torqueLimitScale ?? 1) < 1.45) errors.push('a turbina de competição exige pistões e bielas forjados');
      if ((get('intercooler')?.effectiveness ?? 0.6) < 0.8) errors.push('a turbina de competição exige intercooler de maior capacidade');
      if ((fuelSupply?.fuelCapacityScale ?? 1) < 1.32) errors.push('a turbina de competição exige alimentação de maior vazão');
    }
    if (tune.boostBar !== undefined) {
      if (ecu?.level !== 'programmable') return { ok: false, errors: ['ajuste de pressão exige ECU programável'] };
      const b0 = base.engine.turbo!.maxBoostBar;
      const [lo, hi] = ecu.boostRangeAddBar ?? [0, 0];
      if (!(tune.boostBar >= b0 + lo - 1e-9 && tune.boostBar <= b0 + hi + 1e-9))
        return { ok: false, errors: [`pressão fora da faixa da ECU (${fmtBar(b0 + lo)} a ${fmtBar(b0 + hi)} bar)`] };
      if (tune.boostBar > wg + 1e-9) return { ok: false, errors: [`a wastegate não segura ${fmtBar(tune.boostBar)} bar (máximo ${fmtBar(wg)} bar): instale o controle de pressão`] };
    }
    // a map calibrated for given hardware (Stage 2/3) refuses the build without it
    for (const req of ecu?.requiresParts ?? [])
      if (!req.ids.some((id) => partIds.includes(id))) errors.push(`${ecu!.name} exige ${req.label}`);
    if (ecu?.minInternalsTorqueScale && (pistons?.torqueLimitScale ?? 1) < ecu.minInternalsTorqueScale)
      errors.push(`${ecu.name} exige pistões e bielas forjados`);
    if (ecu?.minTurboFlowScale && (turboUp?.flowScale ?? 1) < ecu.minTurboFlowScale)
      errors.push(`${ecu.name} exige a turbina de maior fluxo`);
    if (ecu?.minIntercoolerEffectiveness && (get('intercooler')?.effectiveness ?? 0.6) < ecu.minIntercoolerEffectiveness)
      errors.push(`${ecu.name} exige o intercooler de maior capacidade`);
    if (ecu?.minFuelCapacityScale && (fuelSupply?.fuelCapacityScale ?? 1) < ecu.minFuelCapacityScale)
      errors.push(`${ecu.name} exige alimentação de maior vazão`);
    if (errors.length) return { ok: false, errors };
    const cam = get('camshaft');
    const head = get('cylinder-head');
    const manifold = get('intake-manifold');
    const anyEngine = genericMod.coolingFrictionScale || genericMod.coolingKnockScale || ignition || ecu || turboUp || get('intercooler') || boostControl || pistons || get('intake-filter') || exhaust || cam || head || manifold || sectionParts.length > 0;
    if (anyEngine) {
      engineModified = true;
      const r = applyFactoryTurboParts(stockEngine, {
        family,
        filter: get('intake-filter'),
        exhaust,
        ecu,
        turbo: turboUp,
        intercooler: get('intercooler'),
        boostControl,
        wastegate,
        pistons,
        cam,
        head,
        manifold,
        boostBar: tune.boostBar,
        mod: {
          coolingFrictionScale: genericMod.coolingFrictionScale,
          coolingKnockScale: genericMod.coolingKnockScale,
          ...exhaustMod,
          ...ignitionMod,
        },
      });
      car.engine = r.engine;
      steadyBoostBar = r.steadyBoostBar;
      knockLoss = r.knockLoss;
      exhaustRestrictionKPa = r.exhaustRestrictionKPa;
      chargeTemperatureAtTargetK = r.chargeTemperatureAtTargetK;
      if (Number.isFinite(r.torqueLimitNm)) mappedTorqueLimitNm = r.torqueLimitNm;
    } else {
      car.engine = structuredClone(stockEngine);
      chargeTemperatureAtTargetK = factoryChargeTemperatureK(stockEngine.turbo!.maxBoostBar);
    }
  } else {
    // NA engine (or a Chapter 1 engine with a v2 part): breathing model
    if (tune.boostBar !== undefined && !turboKit) return { ok: false, errors: ['ajuste de pressão sem turbo instalado'] };
    if (turboKit) {
      if (conversion && ecu?.fuelTargetScale !== undefined && ecu.compat?.induction === 'NA')
        errors.push('a conversão turbo exige remover o remap aspirado');
      const fuel = engineFuel(base.engine);
      const max = Math.min(TURBO_MAX_COMPRESSION[fuel], conversion?.maxCompressionRatio ?? Infinity);
      const cr = base.engine.compressionRatio + compressionAdd;
      if (cr > max + 1e-9) errors.push(`o kit turbo exige taxa de compressão até ${fmtBar(max)}:1 para limitar a detonação`);
      if (conversion) {
        if ((fuelSupply?.fuelCapacityScale ?? 1) < conversion.minFuelCapacityScale)
          errors.push('a conversão exige bomba e injetores de maior vazão');
        if ((ignition?.progression?.tier ?? 0) < conversion.minIgnitionTier)
          errors.push(`a conversão exige ignição Stage ${conversion.minIgnitionTier} ou superior`);
        if ((pistons?.torqueLimitScale ?? 1) < conversion.minInternalsTorqueScale)
          errors.push('a conversão exige pistões e bielas com maior capacidade de torque');
        if (!bySlot.has('cooling-oil')) errors.push('a conversão exige arrefecimento de óleo reforçado');
      }
      if (tune.boostBar !== undefined) {
        const [lo, hi] = turboKit.boostRangeBar;
        if (!(tune.boostBar >= lo && tune.boostBar <= hi)) return { ok: false, errors: [`pressão fora da faixa do kit (${fmtBar(lo)} a ${fmtBar(hi)} bar)`] };
      }
      if (errors.length) return { ok: false, errors };
    }
    if (compressionAdd > 0) {
      const fuel = engineFuel(base.engine);
      const cr = base.engine.compressionRatio + compressionAdd;
      if (cr > NA_MAX_COMPRESSION[fuel] + 1e-9)
        return { ok: false, errors: [`taxa ${cr.toFixed(1).replace('.', ',')}:1 detona com ${fuel === 'ethanol' ? 'etanol' : 'gasolina'} (máximo ${NA_MAX_COMPRESSION[fuel].toFixed(1).replace('.', ',')}:1)`] };
    }
    const family = ENGINE_FAMILIES[fam];
    const cam = get('camshaft');
    const ecuRevAdd = ecu ? Math.min(ecu.revLimitAddRpm, family?.valvetrainRevAddRpm ?? 0) : undefined;
    const engineParts: EngineParts = {
      filter: get('intake-filter'),
      manifold: get('intake-manifold'),
      cam,
      exhaust,
      turbo: turboKit,
      boostBar: tune.boostBar,
      head: get('cylinder-head'),
      compressionAdd: compressionAdd || undefined,
      ignitionGain: ecu?.ignitionGain,
      // New profiles include the spring limit. A remap may use the larger safe range, not add a second spring kit.
      revLimitAddRpm: cam?.progression && ecuRevAdd !== undefined ? Math.max(0, ecuRevAdd - cam.revLimitAddRpm) : ecuRevAdd,
      mod: sectionParts.length || ignition || pistons?.frictionScale || genericMod.coolingFrictionScale || genericMod.coolingKnockScale
        ? {
            ...exhaustMod,
            ...ignitionMod,
            ...(genericMod.coolingFrictionScale || pistons?.frictionScale ? { coolingFrictionScale: (genericMod.coolingFrictionScale ?? 1) * (pistons?.frictionScale ?? 1) } : {}),
            ...(genericMod.coolingKnockScale ? { coolingKnockScale: genericMod.coolingKnockScale } : {}),
          }
        : undefined,
    };
    const any = Object.values(engineParts).some((v) => v !== undefined);
    if (any) {
      engineModified = true;
      const r = applyEngineParts(stockEngine, engineParts);
      car.engine = r.engine;
      steadyBoostBar = r.steadyBoostBar;
      knockLoss = r.knockLoss;
      // switchable cam lobes (i-VTEC): a cam kit changes the high lobes; below the switch speed the
      // engine runs on the untouched low lobes, so the low-speed part of the curve is the one
      // without the cam kit
      const vc = base.engine.variableCam;
      if (vc && engineParts.cam) {
        const noCam = applyEngineParts(stockEngine, { ...engineParts, cam: undefined });
        const cam = engineParts.cam as CamPart;
        const tq = car.engine.torqueCurve;
        const low = noCam.engine.torqueCurve;
        car.engine.torqueCurve = {
          rpm: tq.rpm,
          torqueNm: tq.rpm.map((rpm, i) => (rpm < vc.switchRpm ? interp(low.rpm, low.torqueNm, rpm) : tq.torqueNm[i]!)),
        };
        car.engine.cam = { ...base.engine.cam };
        car.engine.variableCam = {
          ...vc,
          high: {
            evoDeg: vc.high.evoDeg + cam.evoDeltaDeg,
            evcDeg: vc.high.evcDeg + cam.evcDeltaDeg,
            ivoDeg: vc.high.ivoDeg + cam.ivoDeltaDeg,
            ivcDeg: vc.high.ivcDeg + cam.ivcDeltaDeg,
            intakeLiftMm: vc.high.intakeLiftMm + cam.liftAddMm,
            exhaustLiftMm: vc.high.exhaustLiftMm + (cam.exhaustLiftAddMm ?? cam.liftAddMm),
          },
        };
      }
      // mechanical limit of the NA internals
      if (family && !conversion) {
        const mapLimit = ecu?.fuelTargetScale !== undefined ? ecu.torqueLimitFraction : 1;
        const lim = family.internalsTorqueNm * (pistons?.torqueLimitScale ?? 1) * mapLimit;
        if (ecu) mappedTorqueLimitNm = lim;
        car.engine.torqueCurve = { ...car.engine.torqueCurve, torqueNm: car.engine.torqueCurve.torqueNm.map((t) => Math.min(t, lim)) };
      }
    } else car.engine = structuredClone(stockEngine);
  }
  const fly = get('flywheel');
  if (fly) car.engine.inertiaKgM2 = Math.round(car.engine.inertiaKgM2 * fly.inertiaScale * 10000) / 10000;
  // lighter reciprocating/rotating parts of a forged set
  if (pistons?.inertiaScale) car.engine.inertiaKgM2 = Math.round(car.engine.inertiaKgM2 * pistons.inertiaScale * 10000) / 10000;

  if (meteredFuel) {
    const original = factoryFuelSupply(base.engine);
    const maxFuelKgS = original.maxFuelKgS * (fuelSupply?.fuelCapacityScale ?? 1);
    const airFuelRatio = (conversion ? fuelMixtureRatio(car.engine) : original.airFuelRatio) * (ecu?.fuelTargetScale ?? 1);
    if (engineModified && peakFuelDemandKgS(car.engine, airFuelRatio) > maxFuelKgS)
      errors.push('Alimentação insuficiente para a mistura em plena carga. Instale uma bomba e injetores com maior vazão.');
    car.engine.fueling = { airFuelRatio, maxFuelKgS };
  }

  const peakTorqueNm = Math.max(...car.engine.torqueCurve.torqueNm.filter((_, i) => car.engine.torqueCurve.rpm[i]! <= car.engine.revLimitRpm));
  if (conversion && peakTorqueNm > ENGINE_FAMILIES[fam]!.internalsTorqueNm * (pistons?.torqueLimitScale ?? 1))
    errors.push('o torque da conversão exige um conjunto alternado de maior capacidade ou pressão menor');
  const peakPowerCv = curvePeakCv(car.engine.torqueCurve, car.engine.revLimitRpm);
  car.engine.ratedPowerCv = Math.round(peakPowerCv);

  // ---- hardware mass and sound ----
  if (turboKit) {
    car.massKg += turboKit.massAddKg;
    car.acoustic = { ...car.acoustic, turboGain: Math.max(car.acoustic.turboGain, 0.7) };
  }
  if (turboUp) {
    car.massKg += turboUp.massAddKg;
    car.acoustic = { ...car.acoustic, turboGain: Math.min(1.2, car.acoustic.turboGain * 1.15) };
  }
  const ic = get('intercooler');
  if (ic) car.massKg += ic.massAddKg;
  if (exhaust || sectionMod.headerDiameterScale || sectionMod.exhaustDiameterScale || sectionMod.exhaustAbsorptionScale) {
    const acousticBase = exhaust
      ? exhaustPreset(exhaust.acousticPreset, {
        layout: base.exhaust.layout,
        headerPrimaryLengthM: base.exhaust.headerPrimaryLengthM,
        headerDiameterMm: Math.min(base.exhaust.headerDiameterMm * exhaust.headerDiameterScale, 80),
      })
      : base.exhaust;
    car.exhaust = {
      ...acousticBase,
      headerDiameterMm: sectionMod.headerDiameterScale
        ? Math.min(70, Math.max(acousticBase.headerDiameterMm, base.exhaust.headerDiameterMm * sectionMod.headerDiameterScale))
        : acousticBase.headerDiameterMm,
      tailpipeDiameterMm: sectionMod.exhaustDiameterScale
        ? Math.min(120, Math.max(acousticBase.tailpipeDiameterMm, base.exhaust.tailpipeDiameterMm * sectionMod.exhaustDiameterScale))
        : acousticBase.tailpipeDiameterMm,
      mufflerAbsorption: sectionMod.exhaustAbsorptionScale
        ? Math.max(0, Math.min(acousticBase.mufflerAbsorption, base.exhaust.mufflerAbsorption * sectionMod.exhaustAbsorptionScale))
        : acousticBase.mufflerAbsorption,
      outputGain: base.exhaust.outputGain,
    };
  }

  // ---- driveline ----
  const kind = transmissionKindOf(base);
  const clutch = get('clutch');
  if (clutch) {
    const c = car.transmission.clutch;
    c.maxTorqueNm = Math.round(c.maxTorqueNm * clutch.capacityScale);
    c.engageRatePerS = Math.min(50, c.engageRatePerS * clutch.engageRateScale);
    c.launchRpm = Math.min(c.launchRpm + clutch.launchRpmAdd, car.engine.redlineRpm - 800);
    if (clutch.inputInertiaScale) car.transmission.inputInertiaKgM2 = Math.max(0.001, car.transmission.inputInertiaKgM2 * clutch.inputInertiaScale);
    if (clutch.engineInertiaScale) car.engine.inertiaKgM2 = Math.round(car.engine.inertiaKgM2 * clutch.engineInertiaScale * 10000) / 10000;
  }
  const gb = get('gearbox');
  if (gb) {
    const t = car.transmission;
    t.clutch.maxTorqueNm = Math.round(t.clutch.maxTorqueNm * gb.capacityScale);
    t.clutch.launchRpm = Math.min(t.clutch.launchRpm + gb.launchRpmAdd, car.engine.redlineRpm - 800);
    if (t.powershift) {
      t.powershift = {
        ...t.powershift,
        torquePhaseS: Math.max(0.02, t.powershift.torquePhaseS * gb.shiftTimeScale),
        inertiaPhaseMaxS: Math.max(0.05, t.powershift.inertiaPhaseMaxS * gb.shiftTimeScale),
        downshiftReleaseS: Math.max(0.02, t.powershift.downshiftReleaseS * gb.shiftTimeScale),
      };
    }
    if (t.torqueConverter) {
      t.torqueConverter = {
        ...t.torqueConverter,
        kFactor: Math.round(t.torqueConverter.kFactor * (gb.converterKScale ?? 1)),
        lockup: { ...t.torqueConverter.lockup, maxTorqueNm: Math.round(t.torqueConverter.lockup.maxTorqueNm * (gb.lockupScale ?? 1)) },
      };
    }
  }
  const diff = get('differential');
  const awd = get('awd');
  if (awd && car.awd) {
    car.awd = {
      ...car.awd,
      centerCouplingNm: Math.round(car.awd.centerCouplingNm * awd.couplingScale),
      frontTorqueFraction: Math.min(0.7, Math.max(0.3, car.awd.frontTorqueFraction + awd.frontFractionDelta)),
    };
  }
  const susp = get('suspension');
  if (susp) car.cgHeightM = Math.round((car.cgHeightM + susp.cgHeightDeltaM) * 1000) / 1000;
  const tyre = get('tires');
  if (tyre) applyTyre(car, base, tyre);
  applyGenericChassisMods(car, genericMod);
  applyCoolingHardware(car, genericMod);
  if (susp?.massRemoveKg) car.massKg = Math.max(500, car.massKg - susp.massRemoveKg);
  if (fly?.massRemoveKg) car.massKg = Math.max(500, car.massKg - fly.massRemoveKg);
  const gearset = get('transmission-gearbox');
  if (gearset) {
    car.transmission.gearRatios = workshopGearRatios(car, base.transmission.gearRatios, gearset.gearSpreadScale);
    car.transmission.efficiency = Math.min(0.97, Math.round((car.transmission.efficiency + gearset.efficiencyAdd) * 1000) / 1000);
  }
  // crown and pinion chosen for the finished car (engine, tyres, mass above)
  if (diff) {
    car.transmission.finalDrive = workshopFinalDrive(car, base.transmission.finalDrive, diff.finalDriveScale);
    if (diff.efficiencyAdd) car.transmission.efficiency = Math.min(0.97, Math.round((car.transmission.efficiency + diff.efficiencyAdd) * 1000) / 1000);
  }
  if (gb?.efficiencyAdd) car.transmission.efficiency = Math.min(0.97, Math.round((car.transmission.efficiency + gb.efficiencyAdd) * 1000) / 1000);
  if (fly?.launchRpmAdd) car.transmission.clutch.launchRpm = Math.min(car.transmission.clutch.launchRpm + fly.launchRpmAdd, car.engine.redlineRpm - 800);
  if (awd?.transferEfficiencyAdd && car.awd) car.awd = { ...car.awd, transferEfficiency: Math.min(1, car.awd.transferEfficiency + awd.transferEfficiencyAdd) };

  // ---- visible parts ----
  car.visual = { ...car.visual, mods: { intercooler: !!(turboKit || ic || turboUp), sportTip: !!(exhaust || sectionMod.exhaustDiameterScale || sectionMod.exhaustAbsorptionScale), tyre: tyre?.grade ?? 'stock' } };
  if (parts.length) car.name = `${base.name} (preparado)`.slice(0, 64);

  // ---- validation: every gearbox kind carries the new torque or the build is refused ----
  const cap = car.transmission.clutch.maxTorqueNm;
  const modern = fam !== LEGACY_FAMILY;
  if (kind === 'manual' && (turboKit || modern) && cap < peakTorqueNm * CLUTCH_TORQUE_MARGIN)
    errors.push(`o torque (${peakTorqueNm.toFixed(0)} N·m) passa do que a embreagem segura com folga (${cap} N·m): instale a embreagem reforçada`);
  if (kind === 'dual-clutch' && cap < peakTorqueNm * DCT_TORQUE_MARGIN)
    errors.push(`as embreagens do câmbio de dupla embreagem (${cap} N·m) não seguram ${peakTorqueNm.toFixed(0)} N·m com folga: instale o upgrade DSG/SST`);
  if (kind === 'torque-converter-auto' && cap < peakTorqueNm * AT_TORQUE_MARGIN)
    errors.push(`os elementos do câmbio automático (${cap} N·m) não seguram ${peakTorqueNm.toFixed(0)} N·m com folga: instale o upgrade do automático`);
  if (factoryTurbo && ecu?.forgedAboveFraction && (pistons?.torqueLimitScale ?? 1) < 1.45) {
    const lim = ENGINE_FAMILIES[fam]!.internalsTorqueNm * ecu.forgedAboveFraction * (pistons?.torqueLimitScale ?? 1);
    if (peakTorqueNm > lim) errors.push(`o torque (${peakTorqueNm.toFixed(0)} N·m) passa do que pistões e bielas de fábrica aguentam com folga (${lim.toFixed(0)} N·m): instale pistões e bielas forjados`);
  }
  if (knockLoss > MAX_KNOCK_LOSS)
    errors.push(`detonação: este motor perde ${(knockLoss * 100).toFixed(0)} % do torque em atraso de ignição nesta pressão; baixe a pressão`);
  const v = validateCar(car);
  if (!v.ok) errors.push(...v.errors);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true, car: deepFreeze(v.value!), parts, key, peakTorqueNm, peakPowerCv, steadyBoostBar, knockLoss,
    exhaustRestrictionKPa, chargeTemperatureAtTargetK, wastegateLimitBar, mappedTorqueLimitNm, version: 2,
  };
}

function interp(xs: readonly number[], ys: readonly number[], x: number): number {
  if (x <= xs[0]!) return ys[0]!;
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]!) {
      const t = (x - xs[i - 1]!) / (xs[i]! - xs[i - 1]!);
      return ys[i - 1]! + (ys[i]! - ys[i - 1]!) * t;
    }
  }
  return ys[ys.length - 1]!;
}
