import { findCampaignCar } from '../../data/cars/campaign';
import type { CarConfig } from '../../data/schema';
import { findRival, type RivalDef } from './CareerEvents';
import type { OwnedCar } from './CareerState';
import { resolveBuild, type BuildResult } from './tuning/BuildResolver';
import { buildVersionFor } from './CareerController';

/**
 * Cars of the career, built by the same resolver for rivals and for the player: the rival's
 * advantage is its parts (bought by the same rules), never a hidden factor.
 */
function painted(car: CarConfig, paint: { color: string; accent: string }, nickname?: string): CarConfig {
  return Object.freeze({ ...car, name: nickname ? `${nickname} — ${car.name}`.slice(0, 64) : car.name, visual: { ...car.visual, color: paint.color, accent: paint.accent } });
}

export function rivalBuild(r: RivalDef): Extract<BuildResult, { ok: true }> {
  const base = findCampaignCar(r.baseCarId);
  if (!base) throw new Error(`carro base desconhecido: ${r.baseCarId}`);
  const b = resolveBuild(base, r.parts, r.tune ?? {}, r.buildVersion ?? 1);
  if (!b.ok) throw new Error(`build do rival ${r.id} inválido: ${b.errors.join('; ')}`);
  return b;
}

export function rivalCar(rivalId: string | RivalDef): CarConfig {
  const r = typeof rivalId === 'string' ? findRival(rivalId) : rivalId;
  if (!r) throw new Error(`rival desconhecido: ${rivalId}`);
  return painted(rivalBuild(r).car, r.paint);
}

export function ownedCarBuild(o: OwnedCar): BuildResult {
  const base = findCampaignCar(o.baseCarId);
  if (!base) return { ok: false, errors: [`carro base desconhecido: ${o.baseCarId}`] };
  return resolveBuild(base, o.installedParts, o.tune ?? {}, buildVersionFor(o, o.installedParts));
}

/**
 * The car as it looks in lists and thumbnails: its build when it resolves, otherwise the painted
 * catalogue car, so an invalid build (e.g. a part from a newer version) never loses the picture.
 */
export function ownedCarLook(o: OwnedCar): CarConfig | null {
  const b = ownedCarBuild(o);
  if (b.ok) return painted(b.car, o.paint);
  const base = findCampaignCar(o.baseCarId);
  return base ? painted(base, o.paint) : null;
}

export function ownedCarConfig(o: OwnedCar): CarConfig {
  const b = ownedCarBuild(o);
  if (!b.ok) throw new Error(b.errors.join('; '));
  return painted(b.car, o.paint);
}
