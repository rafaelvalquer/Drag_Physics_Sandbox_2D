import { validateCar, type CarConfig, type TransmissionKind } from '../../../data/schema';
import { exhaustPreset } from '../../../data/exhaustPresets';
import { applyEngineParts, curvePeakCv, engineFuel, powerPeakRpm, TURBO_MAX_COMPRESSION, withStockBreathing, type EngineParts } from './breathingModel';
import { applyTyre, CLUTCH_TORQUE_MARGIN, deepFreeze, fmtBar, workshopFinalDrive, MAX_KNOCK_LOSS, type BuildResult, type BuildTune } from './buildCommon';
import { ENGINE_FAMILIES } from './chapter2Parts';
import { applyFactoryTurboParts, wastegateMaxBar } from './factoryTurboModel';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER_V2,
  findPartForVersion,
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
  if ('mod' in p && fam !== LEGACY_FAMILY) return `${p.name} é do catálogo dos motores clássicos`;
  if ((p.since ?? 1) === 2 && fam === LEGACY_FAMILY) return `${p.name} é para motores modernos`;
  const c = p.compat;
  if (!c) return null;
  if (c.families && !c.families.includes(fam)) {
    const label = ENGINE_FAMILIES[fam]?.label ?? 'este motor';
    return `${p.name} não é feita para ${label}`;
  }
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

  // Chapter 1 hardware: the version 1 resolver is the reference (identical result, v2 key)
  if (fam === LEGACY_FAMILY && parts.every((p) => (p.since ?? 1) === 1)) {
    const r = resolveV1(base, partIds, key, tune);
    return r.ok ? { ...r, key, version: 2 } : r;
  }

  const car: CarConfig = structuredClone(base);
  const get = <C extends PartCategory>(c: C): Extract<PartDef, { category: C }> | undefined => bySlot.get(c) as Extract<PartDef, { category: C }> | undefined;
  const ecu = get('ecu');
  const turboSlot = get('turbo');
  const turboKit = turboSlot && !('upgrade' in turboSlot) ? (turboSlot as TurboPart) : undefined;
  const turboUp = turboSlot && 'upgrade' in turboSlot ? (turboSlot as TurboUpgradePart) : undefined;
  const ratedRpm = powerPeakRpm(base.engine.torqueCurve, base.engine.revLimitRpm);
  const stockEngine = withStockBreathing(base.engine, ratedRpm);
  let steadyBoostBar: { rpm: number; bar: number }[] = [];
  let knockLoss = 0;

  // ---- engine ----
  const factoryTurbo = base.engine.induction === 'turbo' && fam !== LEGACY_FAMILY;
  if (factoryTurbo) {
    const family = ENGINE_FAMILIES[fam];
    if (!family) return { ok: false, errors: [`família de motor sem dados de preparação: ${fam}`] };
    if (turboUp && ecu?.level !== 'programmable') return { ok: false, errors: ['a turbina de maior fluxo exige ECU programável'] };
    if (tune.boostBar !== undefined) {
      if (ecu?.level !== 'programmable') return { ok: false, errors: ['ajuste de pressão exige ECU programável'] };
      const b0 = base.engine.turbo!.maxBoostBar;
      const [lo, hi] = ecu.boostRangeAddBar ?? [0, 0];
      if (!(tune.boostBar >= b0 + lo - 1e-9 && tune.boostBar <= b0 + hi + 1e-9))
        return { ok: false, errors: [`pressão fora da faixa da ECU (${fmtBar(b0 + lo)} a ${fmtBar(b0 + hi)} bar)`] };
      const wg = wastegateMaxBar(stockEngine, get('boost-control'));
      if (tune.boostBar > wg + 1e-9) return { ok: false, errors: [`a wastegate não segura ${fmtBar(tune.boostBar)} bar (máximo ${fmtBar(wg)} bar): instale o controle de pressão`] };
    }
    const anyEngine = ecu || turboUp || get('intercooler') || get('boost-control') || get('pistons') || get('intake-filter') || get('exhaust');
    if (anyEngine) {
      const r = applyFactoryTurboParts(stockEngine, {
        family,
        filter: get('intake-filter'),
        exhaust: get('exhaust'),
        ecu,
        turbo: turboUp,
        intercooler: get('intercooler'),
        boostControl: get('boost-control'),
        pistons: get('pistons'),
        boostBar: tune.boostBar,
      });
      car.engine = r.engine;
      steadyBoostBar = r.steadyBoostBar;
      knockLoss = r.knockLoss;
    } else car.engine = structuredClone(stockEngine);
  } else {
    // NA engine (or a Chapter 1 engine with a v2 part): breathing model
    if (tune.boostBar !== undefined && !turboKit) return { ok: false, errors: ['ajuste de pressão sem turbo instalado'] };
    if (turboKit) {
      const fuel = engineFuel(base.engine);
      const max = TURBO_MAX_COMPRESSION[fuel];
      if (base.engine.compressionRatio > max) return { ok: false, errors: [`taxa de compressão ${base.engine.compressionRatio.toFixed(1).replace('.', ',')}:1 não aceita o kit turbo sem detonar`] };
      if (tune.boostBar !== undefined) {
        const [lo, hi] = turboKit.boostRangeBar;
        if (!(tune.boostBar >= lo && tune.boostBar <= hi)) return { ok: false, errors: [`pressão fora da faixa do kit (${fmtBar(lo)} a ${fmtBar(hi)} bar)`] };
      }
    }
    const pistons = get('pistons');
    if (pistons && pistons.compressionAdd > 0) {
      const fuel = engineFuel(base.engine);
      const cr = base.engine.compressionRatio + pistons.compressionAdd;
      if (cr > NA_MAX_COMPRESSION[fuel] + 1e-9)
        return { ok: false, errors: [`taxa ${cr.toFixed(1).replace('.', ',')}:1 detona com ${fuel === 'ethanol' ? 'etanol' : 'gasolina'} (máximo ${NA_MAX_COMPRESSION[fuel].toFixed(1).replace('.', ',')}:1)`] };
    }
    const family = ENGINE_FAMILIES[fam];
    const engineParts: EngineParts = {
      filter: get('intake-filter'),
      manifold: get('intake-manifold'),
      cam: get('camshaft'),
      exhaust: get('exhaust'),
      turbo: turboKit,
      boostBar: tune.boostBar,
      head: get('cylinder-head'),
      compressionAdd: pistons?.compressionAdd,
      ignitionGain: ecu?.ignitionGain,
      revLimitAddRpm: ecu ? Math.min(ecu.revLimitAddRpm, family?.valvetrainRevAddRpm ?? 0) : undefined,
      mod: pistons?.frictionScale ? { coolingFrictionScale: pistons.frictionScale } : undefined,
    };
    const any = Object.values(engineParts).some((v) => v !== undefined);
    if (any) {
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
            exhaustLiftMm: vc.high.exhaustLiftMm + cam.liftAddMm,
          },
        };
      }
      // mechanical limit of the NA internals
      if (family) {
        const lim = family.internalsTorqueNm * (pistons?.torqueLimitScale ?? 1);
        car.engine.torqueCurve = { ...car.engine.torqueCurve, torqueNm: car.engine.torqueCurve.torqueNm.map((t) => Math.min(t, lim)) };
      }
    } else car.engine = structuredClone(stockEngine);
  }
  const fly = get('flywheel');
  if (fly) car.engine.inertiaKgM2 = Math.round(car.engine.inertiaKgM2 * fly.inertiaScale * 10000) / 10000;
  // lighter reciprocating/rotating parts of a forged set
  const pist = get('pistons');
  if (pist?.inertiaScale) car.engine.inertiaKgM2 = Math.round(car.engine.inertiaKgM2 * pist.inertiaScale * 10000) / 10000;

  const peakTorqueNm = Math.max(...car.engine.torqueCurve.torqueNm.filter((_, i) => car.engine.torqueCurve.rpm[i]! <= car.engine.revLimitRpm));
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
  const exhaust = get('exhaust');
  if (exhaust) {
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
  if (susp?.massRemoveKg) car.massKg = Math.max(500, car.massKg - susp.massRemoveKg);
  if (fly?.massRemoveKg) car.massKg = Math.max(500, car.massKg - fly.massRemoveKg);
  // crown and pinion chosen for the finished car (engine, tyres, mass above)
  if (diff) {
    car.transmission.finalDrive = workshopFinalDrive(car, base.transmission.finalDrive, diff.finalDriveScale);
    if (diff.efficiencyAdd) car.transmission.efficiency = Math.min(0.97, Math.round((car.transmission.efficiency + diff.efficiencyAdd) * 1000) / 1000);
  }
  if (gb?.efficiencyAdd) car.transmission.efficiency = Math.min(0.97, Math.round((car.transmission.efficiency + gb.efficiencyAdd) * 1000) / 1000);
  if (fly?.launchRpmAdd) car.transmission.clutch.launchRpm = Math.min(car.transmission.clutch.launchRpm + fly.launchRpmAdd, car.engine.redlineRpm - 800);
  if (awd?.transferEfficiencyAdd && car.awd) car.awd = { ...car.awd, transferEfficiency: Math.min(1, car.awd.transferEfficiency + awd.transferEfficiencyAdd) };

  // ---- visible parts ----
  car.visual = { ...car.visual, mods: { intercooler: !!(turboKit || ic || turboUp), sportTip: !!exhaust, tyre: tyre?.grade ?? 'stock' } };
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
  if (knockLoss > MAX_KNOCK_LOSS)
    errors.push(`detonação: este motor perde ${(knockLoss * 100).toFixed(0)} % do torque em atraso de ignição nesta pressão; baixe a pressão`);
  const v = validateCar(car);
  if (!v.ok) errors.push(...v.errors);
  if (errors.length) return { ok: false, errors };
  return { ok: true, car: deepFreeze(v.value!), parts, key, peakTorqueNm, peakPowerCv, steadyBoostBar, knockLoss, version: 2 };
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
