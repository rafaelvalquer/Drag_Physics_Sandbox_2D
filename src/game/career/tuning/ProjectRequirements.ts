import type { CarConfig } from '../../../data/schema';
import { isPartUnlocked, partStatus, type PartState, type PartStatus } from '../CareerProgression';
import type { CareerSave } from '../CareerState';
import { incompatibility, familyOf } from './BuildResolverV2';
import { resolveBuild, type ResolverVersion } from './BuildResolver';
import type { BuildTune } from './buildCommon';
import { issuesOf, type BuildIssue } from './buildIssues';
import { ALL_PARTS, findPart, type EcuPart, type PartDef } from './parts';
import { reconcileTune } from './TuningCapabilities';

/** The part of the owned car list that planning reads (an OwnedCar fits). */
export interface PlanCar {
  baseCarId: string;
  installedParts: readonly string[];
  tune?: BuildTune;
}

export type PlanSave = Pick<CareerSave, 'completedEventIds' | 'inventoryPartIds' | 'credits'>;

/** One part of an install plan. */
export interface PlanStep {
  partId: string;
  name: string;
  price: number;
  /** In the stock of this car (free to install) or to be bought. */
  source: 'stock' | 'buy';
  state: PartState;
  status: PartStatus;
  /** Installed part of the same slot that goes to the stock. */
  replaces: string | null;
  /** The issue this step resolves (null for the part the player asked for). */
  resolves: BuildIssue | null;
}

export interface InstallPlan {
  /** The final build is valid and every step is unlocked. */
  ok: boolean;
  /** Part list of the car after the plan. */
  parts: string[];
  /** The requested part first, then the parts it needs. */
  steps: PlanStep[];
  /** Credits to spend (stock parts are free). */
  cost: number;
  /** Why the plan cannot run (locked parts, credits). */
  blockers: string[];
  /** Resolver issues still open after the best plan (settings the player must change). */
  openIssues: BuildIssue[];
  /**
   * Set when the requested part cannot work on this car at all (an aspirated remap on a turbo
   * conversion): the plan is for the part that does (`steps[0]`) and `requested` is the original.
   */
  substitutes?: { requested: string; reason: string };
}

const MAX_STEPS = 8;

/** Parts list after installing `partId` (the part of the same slot is replaced). */
export function withPartId(installed: readonly string[], partId: string): { parts: string[]; replaced: string | null } {
  const p = findPart(partId)!;
  const replaced = installed.find((id) => findPart(id)?.category === p.category) ?? null;
  return { parts: [...installed.filter((id) => id !== replaced), partId], replaced };
}

const entry = (partId: string, baseCarId: string): string => `${partId}@${baseCarId}`;

/**
 * Plans the install of `partId` on a car: the part itself and, when the resulting build is not valid,
 * the cheapest parts that fix each reported issue (stock parts first, then unlocked ones, then the
 * cheapest). The search is the resolver itself (nothing is predicted): a candidate is kept only if
 * the build no longer reports that issue. Settings the player must change (knock, pressure range)
 * stay in `openIssues`.
 */
export function planInstall(args: { base: CarConfig; car: PlanCar; save: PlanSave; partId: string; versionOf: (parts: readonly string[]) => ResolverVersion }): InstallPlan {
  const { base, car, save, partId, versionOf } = args;
  const family = familyOf(base);
  const tuneOf = (parts: readonly string[]): BuildTune => (car.tune ? reconcileTune(base, parts, versionOf(parts), car.tune).tune : {});
  const resolve = (parts: readonly string[]) => resolveBuild(base, parts, tuneOf(parts), versionOf(parts));
  const fits = (p: PartDef, parts: readonly string[]): boolean => {
    const v = versionOf([...parts, p.id]);
    return !((v === 2 || p.since === 2) && incompatibility(base, p));
  };
  const step = (id: string, replaces: string | null, resolves: BuildIssue | null): PlanStep => {
    const p = findPart(id)!;
    const status = partStatus(save, car, p, family);
    const inStock = save.inventoryPartIds.includes(entry(id, car.baseCarId));
    return { partId: id, name: p.name, price: p.price, source: inStock ? 'stock' : 'buy', state: status.state, status, replaces, resolves };
  };

  let first = withPartId(car.installedParts, partId);
  let parts = first.parts;
  let steps: PlanStep[] = [step(partId, first.replaced, null)];
  let open: BuildIssue[] = [];
  let substitutes: InstallPlan['substitutes'];

  // An aspirated remap on a turbo conversion is refused by design: plan the turbo map of the same
  // stage instead (the closest one when there is no exact match) and keep going from there.
  const req = findPart(partId);
  if (req?.category === 'ecu' && !(req as EcuPart).conversionTier) {
    const r0 = resolve(parts);
    if (!r0.ok && issuesOf(r0.errors).some((x) => x.code === 'na-remap-on-conversion')) {
      const want = ({ stage1: 1, stage2: 2, stage3: 3 } as Record<string, number>)[(req as EcuPart).level] ?? 0;
      const maps = ALL_PARTS.filter((q): q is EcuPart => q.category === 'ecu' && !!(q as EcuPart).conversionTier && fits(q, car.installedParts));
      maps.sort((a, b) => Math.abs(a.conversionTier! - want) - Math.abs(b.conversionTier! - want) || a.conversionTier! - b.conversionTier!);
      const conflicts = (ps: readonly string[]): boolean => {
        const rr = resolve(ps);
        return !rr.ok && issuesOf(rr.errors).some((x) => x.code === 'na-remap-on-conversion');
      };
      const pick = maps.find((m) => !conflicts(withPartId(car.installedParts, m.id).parts));
      if (pick) {
        first = withPartId(car.installedParts, pick.id);
        parts = first.parts;
        steps = [step(pick.id, first.replaced, null)];
        substitutes = { requested: partId, reason: `${req.name} é um remap para motor aspirado e não funciona com a conversão turbo.` };
      }
    }
  }

  for (let i = 0; i < MAX_STEPS; i++) {
    const r = resolve(parts);
    if (r.ok) {
      open = [];
      break;
    }
    const issues = issuesOf(r.errors);
    open = issues;
    const target = issues.find((x) => x.fixCategories.length > 0 || x.code === 'needs-part');
    if (!target) break;
    // ids the ECU asks for (requiresParts) join the candidates of a "needs part" issue
    const ecu = parts.map(findPart).find((p) => p?.category === 'ecu') as EcuPart | undefined;
    const wanted = new Set<string>(target.code === 'needs-part' ? (ecu?.requiresParts ?? []).flatMap((q) => q.ids) : []);
    const cands = ALL_PARTS.filter(
      (p) => !parts.includes(p.id) && (target.fixCategories.includes(p.category) || wanted.has(p.id)) && fits(p, parts) && p.id !== steps[0]!.partId && (target.code !== 'na-remap-on-conversion' || !!(p as EcuPart).conversionTier),
    ).filter((p) => {
      // the NA remap goes to the stock whatever it cost; otherwise never swap out an installed part for a cheaper one
      if (target.code === 'na-remap-on-conversion') return true;
      const cur = parts.map(findPart).find((q) => q?.category === p.category);
      return !cur || p.price > cur.price;
    });
    const rank = (p: PartDef): number[] => {
      const st = partStatus(save, car, p, family);
      return [st.state === 'owned' ? 0 : 1, isPartUnlocked(save, p, family) ? 0 : 1, p.price];
    };
    cands.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      return ra[0]! - rb[0]! || ra[1]! - rb[1]! || ra[2]! - rb[2]!;
    });
    let chosen: { id: string; replaced: string | null; next: string[] } | null = null;
    for (const c of cands) {
      const t = withPartId(parts, c.id);
      const rr = resolve(t.parts);
      const still = rr.ok ? [] : issuesOf(rr.errors);
      const fixed = !still.some((x) => x.code === target.code);
      if (rr.ok || fixed) {
        chosen = { id: c.id, replaced: t.replaced, next: t.parts };
        break;
      }
    }
    if (!chosen) break;
    // a candidate that replaces a part this plan added makes that step pointless
    const dup = steps.findIndex((x, k) => k > 0 && x.partId === chosen!.replaced);
    if (dup > 0) steps.splice(dup, 1);
    steps.push(step(chosen.id, chosen.replaced, target));
    parts = chosen.next;
  }

  const final = resolve(parts);
  if (final.ok) open = [];
  const blockers: string[] = [];
  let cost = 0;
  for (const s of steps) {
    if (s.source === 'buy') cost += s.price;
    if (s.state === 'locked') blockers.push(`${s.name}: ${s.status.detail}`);
  }
  if (cost > save.credits) blockers.push(`Créditos insuficientes: faltam ${(cost - save.credits).toLocaleString('pt-BR')} CR.`);
  return { ok: final.ok && blockers.length === 0, parts, steps, cost, blockers, openIssues: open, ...(substitutes ? { substitutes } : {}) };
}
