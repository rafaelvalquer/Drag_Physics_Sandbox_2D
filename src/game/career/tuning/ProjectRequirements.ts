import type { CarConfig, TransmissionKind } from '../../../data/schema';
import { resolveBuild, type ResolverVersion } from './BuildResolver';
import { incompatibility } from './BuildResolverV2';
import { effectiveInduction } from './ConvertedTurboModel';
import { classifyProject, type EngineProjectId, type EngineSchool } from './EngineProjectClassifier';
import { findPart, type PartDef } from './parts';

/**
 * Project presets and requirements of the Chapter 3 workshop.
 *
 * A preset is a named list of PARTS (never a stage multiplier): choosing it in the workshop buys and
 * installs the whole list in one atomic transaction (CareerController.buyBundle). The lists are
 * data, validated against every car of the chapter by the unit tests, so a preset the resolver
 * would refuse cannot ship.
 */

export interface ProjectPreset {
  id: EngineProjectId;
  school: EngineSchool;
  label: string;
  summary: string;
  /** Parts, in install order, for this car. */
  parts: string[];
}

/**
 * Slots that make up the ENGINE PROJECT of a car (breathing, valve events, ECU, internals, fuel,
 * lubrication, turbo hardware). Installing a project preset replaces the project: the parts of these
 * slots that the preset does not carry go to the stock. Driveline, tyres, chassis and gearbox parts
 * are not part of the project and stay.
 */
export const PROJECT_CATEGORIES: ReadonlySet<string> = new Set([
  'camshaft', 'cylinder-head', 'pistons', 'ecu', 'intake-filter', 'intake-manifold', 'exhaust', 'turbo', 'intercooler', 'boost-control',
  'fuel-system', 'fuel-hp-pump', 'oil-system', 'engine-balancing', 'engine-valvetrain', 'turbo-manifold', 'boost-by-gear',
]);

const NA_FAMILY_KEY: Record<string, 'vq35' | '2gr' | 'vq37'> = { 'nissan-vq35de': 'vq35', 'toyota-2gr-fse': '2gr', 'nissan-vq37vhr': 'vq37' };

/** Driveline parts that carry the new torque: clutch / twin-clutch / automatic, at two levels. */
function driveline(kind: TransmissionKind, level: 'mid' | 'high'): string[] {
  if (kind === 'manual') return [level === 'high' ? 'clutch-v6-comp' : 'clutch-reinforced'];
  if (kind === 'dual-clutch') return [level === 'high' ? 'dct-upgrade-s2' : 'dct-upgrade'];
  return [level === 'high' ? 'at-upgrade-s2' : 'at-upgrade'];
}

const directInjection = (family: string): boolean => ['toyota-2gr-fse', 'mercedes-m276', 'kia-lambda33', 'maserati-f160', 'alfa-690t'].includes(family);

function aspiratedPresets(car: CarConfig): ProjectPreset[] {
  const fam = car.engine.family!;
  const k = NA_FAMILY_KEY[fam]!;
  const kind = car.transmission.kind ?? 'manual';
  const cam = k === 'vq35' ? 'cam-vq35-s2' : k === 'vq37' ? 'vvel-370z-s1' : 'vvti-2gr-s1';
  const camComp = k === 'vq35' ? 'cam-vq35-s2' : k === 'vq37' ? 'vvel-370z-comp' : 'vvti-2gr-s1';
  const head = k === '2gr' ? 'head-2gr-ported' : 'head-v6-ported';
  const headComp = k === '2gr' ? 'head-2gr-ported' : 'head-v6-comp';
  const base = (id: EngineProjectId, label: string, parts: string[]): ProjectPreset => ({ id, school: 'aspirated', label, summary: classifyProject(car, parts).summary, parts });
  const kits = (profile: 'street' | 'highflow' | 'balanced'): string => `turbo-${k}-${profile}`;
  const turbo = (id: EngineProjectId, label: string, parts: string[]): ProjectPreset => ({ id, school: 'turbo-conversion', label, summary: classifyProject(car, parts).summary, parts });
  const dsl = driveline(kind, 'mid');
  const dslHigh = driveline(kind, 'high');
  const out: ProjectPreset[] = [
    base('na-street', 'Aspirado Street', ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na']),
    base('na-high-rpm', 'Aspirado High RPM', ['filter-v6-dual', 'exhaust-v6-sport', `ecu-${k}-s2`, 'manifold-v6-sport', 'valve-springs-v6-comp', cam, head, 'rods-v6-light']),
    base('na-competition', 'Aspirado Competition', [
      'filter-v6-dual', 'exhaust-v6-race', `ecu-${k}-comp`, 'manifold-v6-comp', 'valve-springs-v6-comp', camComp, headComp, 'forged-v6-na', 'crank-balanced-v6', 'oil-system-street', ...dsl,
    ]),
    turbo('turbo-street', 'Turbo Street', [kits('street'), 'forged-v6-turbo', 'fuel-v6-injectors', 'oil-system-street', ...dsl, ...(directInjection(fam) ? ['fuel-hp-pump'] : [])]),
    turbo('turbo-balanced', 'Turbo Balanced', [kits('balanced'), 'forged-v6-turbo', 'fuel-v6-highflow', 'oil-system-street', ...dslHigh, ...(directInjection(fam) ? ['fuel-hp-pump'] : [])]),
    turbo('turbo-high-flow', 'Turbo High Flow', [kits('highflow'), 'forged-v6-turbo', 'fuel-v6-highflow', 'oil-system-race', 'filter-v6-dual', 'exhaust-v6-sport', `ecu-${k}-comp`, 'intercooler-comp', ...dslHigh, ...(directInjection(fam) ? ['fuel-hp-pump'] : [])]),
  ];
  if (k === 'vq37')
    out.push(turbo('turbo-twin-competition', 'Twin Turbo Competition', ['turbo-vq37-twin-comp', 'forged-v6-turbo', 'fuel-v6-highflow', 'oil-system-race', 'filter-v6-dual', 'exhaust-v6-sport', 'ecu-vq37-comp', 'intercooler-comp', 'crank-balanced-v6', ...dslHigh]));
  return out;
}

function biturboPresets(car: CarConfig): ProjectPreset[] {
  const fam = car.engine.family!;
  const kind = car.transmission.kind ?? 'manual';
  const di = directInjection(fam);
  const make = (id: EngineProjectId, label: string, parts: string[]): ProjectPreset => ({ id, school: 'factory-turbo', label, summary: classifyProject(car, parts).summary, parts });
  return [
    make('biturbo-stage1', 'Biturbo Stage 1', ['ecu-stage1', 'intake-direct-turbo']),
    make('biturbo-stage2', 'Biturbo Stage 2', ['ecu-stage2', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', ...driveline(kind, 'mid')]),
    make('biturbo-stage3', 'Biturbo Stage 3', [
      'ecu-stage3', 'turbo-hybrid-s3', 'downpipe-catless', 'intercooler-race', 'pistons-forged-modern', 'intake-direct-turbo', 'fuel-v6-injectors', ...driveline(kind, 'mid'), ...(di ? ['fuel-hp-pump'] : []),
    ]),
    make('biturbo-competition', 'Biturbo Competition', [
      'ecu-biturbo-comp', 'turbo-hybrid-hf', 'downpipe-catless', 'intercooler-comp', 'manifold-turbo-hf', 'internals-biturbo-s3', 'fuel-v6-highflow', 'oil-system-race', 'crank-balanced-v6', 'boost-by-gear',
      'intake-direct-turbo', ...driveline(kind, 'high'), ...(di ? ['fuel-hp-pump'] : []),
    ]),
  ];
}

/** The project presets of one car (empty for cars outside Chapter 3). */
export function presetsFor(car: CarConfig): ProjectPreset[] {
  const fam = car.engine.family;
  if (!fam) return [];
  if (NA_FAMILY_KEY[fam]) return aspiratedPresets(car);
  if (car.engine.induction === 'turbo' && ['mercedes-m276', 'kia-lambda33', 'maserati-f160', 'alfa-690t', 'nissan-vr38dett'].includes(fam)) return biturboPresets(car);
  return [];
}

/**
 * Parts list after applying a preset on top of the installed ones: the preset's parts replace
 * whatever occupies their slots (the displaced parts are NOT lost: the controller keeps them in stock).
 */
export function applyPreset(installed: readonly string[], preset: ProjectPreset): { parts: string[]; replaced: string[]; added: string[] } {
  const cat = (id: string): string | undefined => findPart(id)?.category;
  const incoming = preset.parts.filter((id) => !installed.includes(id));
  const incomingCats = new Set(incoming.map(cat));
  const replaced = installed.filter((id) => incomingCats.has(cat(id)));
  const kept = installed.filter((id) => !replaced.includes(id));
  return { parts: [...kept, ...preset.parts.filter((id, i, a) => a.indexOf(id) === i)], replaced, added: incoming };
}

/** Why a part cannot be installed on this build now (pt-BR), or null when the hardware accepts it. */
export function partBlockReason(base: CarConfig, installed: readonly string[], part: PartDef, version: ResolverVersion = 2): string | null {
  const parts = installed.map(findPart).filter((p): p is PartDef => !!p);
  const why = incompatibility(base, part, effectiveInduction(base, parts));
  if (why) return why;
  const slotMate = installed.find((id) => findPart(id)?.category === part.category);
  const next = [...installed.filter((id) => id !== slotMate), part.id];
  const r = resolveBuild(base, next, {}, version);
  return r.ok ? null : r.errors.join('; ');
}

/** Requirements of a part that the installed hardware still lacks (labels, pt-BR). */
export function missingRequirementLabels(installed: readonly string[], part: PartDef): string[] {
  return (part.requiresParts ?? []).filter((req) => !req.ids.some((id) => installed.includes(id))).map((r) => r.label);
}

/** Total price of the parts of a preset that the player does not already have (installed or in stock). */
export function bundleCost(partIds: readonly string[], have: (id: string) => boolean): number {
  return partIds.filter((id) => !have(id)).reduce((s, id) => s + (findPart(id)?.price ?? 0), 0);
}
