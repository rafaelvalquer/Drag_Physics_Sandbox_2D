import type { Prng } from '../../../core/prng';
import type { CarConfig } from '../../../data/schema';
import { partRequirements, unlocksOf } from '../CareerProgression';
import type { CareerSave } from '../CareerState';
import { chapterOf, type ChapterId } from '../chapters';
import { resolveBuild, type BuildResult, type BuildTune, type ResolverVersion } from '../tuning/BuildResolver';
import { familyOf, incompatibility } from '../tuning/BuildResolverV2';
import { tuningCapabilities, type RangeControl } from '../tuning/TuningCapabilities';
import { ALL_PARTS, type PartDef } from '../tuning/parts';
import { pick } from './FreeEventCatalog';
import type { FreeTier } from './FreeEventTypes';

export interface FreeBuild {
  installedParts: string[];
  buildVersion: ResolverVersion;
  tune: BuildTune;
  preparation: string;
  resolved: Extract<BuildResult, { ok: true }>;
}

const TARGET_PARTS: Record<FreeTier, readonly [min: number, max: number]> = {
  iniciante: [1, 2], rua: [2, 4], preparado: [4, 7], competicao: [7, 12],
};
const ENGINE_SUPPORT = ['clutch', 'gearbox', 'pistons', 'boost-control'] as const;
const VARIATION_PRIORITY = new Set(['intake-filter', 'exhaust', 'camshaft', 'tires', 'intake-manifold', 'differential', 'suspension', 'chassis-weight']);

export function stockFreeBuild(base: CarConfig): FreeBuild {
  const buildVersion = base.engine.family ? 2 : 1;
  const resolved = resolveBuild(base, [], {}, buildVersion);
  if (!resolved.ok) throw new Error(`O carro original ${base.id} tem um build inválido.`);
  return { installedParts: [], buildVersion, tune: {}, preparation: 'Original', resolved };
}

/** A mechanical project is resolved as a package, including parts mutually dependent on the ECU. */
function withProject(
  anchor: PartDef, candidates: readonly PartDef[], base: CarConfig, version: ResolverVersion,
): { parts: PartDef[]; resolved: FreeBuild['resolved'] } | null {
  const parts = [anchor];
  const add = (p: PartDef | undefined): void => {
    if (p && !parts.some((other) => other.category === p.category)) parts.push(p);
  };
  if (anchor.category === 'ecu') {
    for (const req of anchor.requiresParts ?? []) add(candidates.find((p) => req.ids.includes(p.id)));
  } else if (anchor.category === 'turbo' && 'upgrade' in anchor) {
    add(candidates.find((p) => p.category === 'ecu' && p.level === 'programmable'));
  }
  const resolve = () => resolveBuild(base, parts.map((p) => p.id), {}, version);
  let resolved = resolve();
  if (!resolved.ok || anchor.category === 'turbo') {
    for (const slot of ENGINE_SUPPORT) add(candidates.find((p) =>
      p.category === slot && (slot !== 'pistons' || p.id === 'pistons-forged-modern')));
    resolved = resolve();
  }
  return resolved.ok ? { parts, resolved } : null;
}

/**
 * A rival's N₂O kit follows the same rules as the player's (one kit, a full cylinder per race, no refill),
 * and the kit tier follows the event tier: nothing for beginners, only the mild kit on the street, the
 * strong direct-port kit only in competition. Rare even where it is allowed.
 */
const NITROUS_TIER_KITS: Record<FreeTier, readonly string[]> = {
  iniciante: [],
  rua: ['nitrous-street'],
  preparado: ['nitrous-street', 'nitrous-wet', 'nitrous-progressive'],
  competicao: ['nitrous-street', 'nitrous-wet', 'nitrous-progressive', 'nitrous-direct'],
};
function nitrousAllowed(id: string, tier: FreeTier, rng: Prng): boolean {
  return NITROUS_TIER_KITS[tier].includes(id) && rng.next() < 0.18;
}

export function generateFreeBuild(
  base: CarConfig, chapter: ChapterId, tier: FreeTier, progress: Pick<CareerSave, 'completedEventIds'>, rng: Prng,
): FreeBuild {
  const stock = stockFreeBuild(base);
  const { buildVersion } = stock;
  const unlocks = unlocksOf(progress);
  const candidates = ALL_PARTS.filter((p) =>
    (p.chapter ?? p.since ?? 1) <= chapterOf(chapter).number &&
    (p.since ?? 1) <= buildVersion &&
    incompatibility(base, p) === null &&
    partRequirements(p, familyOf(base)).every((unlock) => unlocks.has(unlock)));
  if (!candidates.length || rng.next() < (tier === 'iniciante' ? 0.67 : tier === 'rua' ? 0.18 : 0.04)) return stock;

  const [min, max] = TARGET_PARTS[tier];
  const limit = min + Math.floor(rng.next() * (max - min + 1));
  const strong = tier === 'competicao' || tier === 'preparado';
  // Power projects get their prerequisites as a unit. Aspirated projects use the same
  // hardware path, so new valve-train parts and compatible catalogue kits join the pool.
  const anchors = candidates.filter((p) =>
    p.category === 'camshaft' ||
    (p.category === 'ecu' && (strong || p.level === 'stage1')) ||
    (p.category === 'turbo' && strong && (tier === 'competicao' || rng.next() < 0.35)));
  const anchor = anchors.length && rng.next() < (strong ? 0.86 : 0.4) ? pick(anchors, rng) : undefined;
  const project = anchor && withProject(anchor, candidates, base, buildVersion);
  const parts = project && project.parts.length <= max ? project.parts : [];
  let resolved = parts.length && project ? project.resolved : stock.resolved;
  const variations = candidates
    .map((part) => ({ part, priority: rng.next() + (VARIATION_PRIORITY.has(part.category) ? 0.35 : 0) }))
    .sort((a, b) => b.priority - a.priority);
  const extra: PartDef[] = [];
  const hasTurbo = base.engine.induction === 'turbo' || parts.some((part) => part.category === 'turbo');
  for (const { part } of variations) {
    if (parts.length + extra.length >= limit) break;
    if ([...parts, ...extra].some((p) => p.category === part.category)) continue;
    if (part.category === 'turbo' || part.category === 'ecu') continue; // installed as projects
    if (part.category === 'nitrous' && !nitrousAllowed(part.id, tier, rng)) continue;
    if ('requiresTurbo' in part && part.requiresTurbo && !hasTurbo) continue;
    extra.push(part);
  }
  // Validate combinations as a unit. Roll back optional variations to the known valid project.
  while (extra.length) {
    const trial = resolveBuild(base, [...parts, ...extra].map((p) => p.id), {}, buildVersion);
    if (trial.ok) {
      parts.push(...extra);
      resolved = trial;
      break;
    }
    extra.pop();
  }
  if (!parts.length) return stock;

  const installedParts = parts.map((p) => p.id).sort();
  let tune: BuildTune = {};
  if (strong || rng.next() < 0.23) {
    const caps = tuningCapabilities(base, installedParts, buildVersion, { tunersUnlocked: unlocks.has('engine-tuners') });
    const adjust = (key: keyof Pick<BuildTune, 'boostBar' | 'launchRpm' | 'revLimitRpm' | 'shiftRpm' | 'tirePressureKpa'>, control: RangeControl): void => {
      if (!control.enabled || control.min > control.max || rng.next() > 0.45) return;
      const center = Math.max(control.min, Math.min(control.default, control.max));
      const underLoad = key === 'boostBar' || key === 'revLimitRpm';
      const range = underLoad && tier === 'competicao' ? control.max - center : Math.min(control.step * 3, control.max - control.min);
      const raw = center + (underLoad && tier === 'competicao' ? rng.next() : rng.bipolar()) * range;
      const value = Math.max(control.min, Math.min(control.max, Math.round(raw / control.step) * control.step));
      tune = { ...tune, [key]: key === 'boostBar' ? Number(value.toFixed(2)) : value };
    };
    adjust('boostBar', caps.boost);
    adjust('revLimitRpm', caps.revLimit);
    adjust('launchRpm', caps.launch);
    adjust('shiftRpm', caps.shift);
    adjust('tirePressureKpa', caps.tirePressure);
    const presets: BuildTune = {
      ...tune,
      ...(caps.finalDrive.enabled && rng.next() < 0.55 ? { finalDrive: pick(['short', 'long'] as const, rng) } : {}),
      ...(caps.throttle.enabled && rng.next() < 0.45 ? { throttleResponse: pick(['soft', 'sharp'] as const, rng) } : {}),
    };
    const trial = resolveBuild(base, installedParts, presets, buildVersion);
    if (trial.ok) { tune = presets; resolved = trial; }
    else tune = {};
  }
  const ecu = parts.find((p) => p.category === 'ecu');
  const kit = parts.find((p) => p.category === 'turbo');
  const preparation = ecu && ['stage1', 'stage2', 'stage3'].includes(ecu.level)
    ? ecu.name
    : kit || base.engine.induction === 'turbo'
      ? kit ? kit.name : 'Turbo de fábrica preparado'
      : parts.length <= 3 ? 'Aspirado leve' : parts.length <= 6 ? 'Aspirado esportivo' : 'Aspirado de competição';
  return { installedParts, buildVersion, tune, resolved, preparation };
}
