import { findCampaignCar } from '../../data/cars/campaign';
import { CLASSIC_ONLY_PARTS, CLASSIC_ONLY_REPLACEMENT } from './tuning/BuildResolverV2';
import { resolveBuild } from './tuning/BuildResolver';
import { findPart, LEGACY_FAMILY } from './tuning/parts';
import type { CareerSave } from './CareerState';

/**
 * Classic parts that stopped fitting the modern engines (CLASSIC_ONLY_PARTS). A modern car that
 * already had one gets the Stage 1 of its own series for the same system, and the price difference
 * goes back to the credits; when the car does not run with it, the part is removed and fully
 * refunded. Stock entries bound to a modern car are converted the same way.
 */
const REPLACEMENT = CLASSIC_ONLY_REPLACEMENT;

function isModern(baseCarId: string): string | null {
  const family = findCampaignCar(baseCarId)?.engine.family;
  return family && family !== LEGACY_FAMILY ? family : null;
}

function replacementOf(baseCarId: string, partId: string): string | null {
  const family = isModern(baseCarId);
  const id = family ? REPLACEMENT[partId]?.(family) : undefined;
  return id && findPart(id) ? id : null;
}

const priceOf = (id: string): number => findPart(id)?.price ?? 0;
const cr = (v: number): string => `${v.toLocaleString('pt-BR')} CR`;

export function hasClassicOnlyParts(s: Pick<CareerSave, 'ownedCars' | 'inventoryPartIds'>): boolean {
  return (
    s.ownedCars.some((c) => isModern(c.baseCarId) && c.installedParts.some((id) => CLASSIC_ONLY_PARTS.has(id))) ||
    s.inventoryPartIds.some((e) => {
      const at = e.lastIndexOf('@');
      return CLASSIC_ONLY_PARTS.has(e.slice(0, at)) && !!isModern(e.slice(at + 1));
    })
  );
}

/** Mutates the save (a copy inside a transaction, or a freshly imported one). Returns the notices for the player. */
export function migrateClassicOnlyParts(s: CareerSave): string[] {
  const notices: string[] = [];
  for (const car of s.ownedCars) {
    if (!isModern(car.baseCarId)) continue;
    for (const old of car.installedParts.filter((id) => CLASSIC_ONLY_PARTS.has(id))) {
      const name = findPart(old)?.name ?? old;
      const base = findCampaignCar(car.baseCarId);
      const target = replacementOf(car.baseCarId, old);
      const rest = car.installedParts.filter((id) => id !== old);
      const candidate = target ? [...rest, target] : rest;
      const tune = base && resolveBuild(base, candidate, car.tune ?? {}, 2).ok ? car.tune ?? {} : {};
      if (base && target && resolveBuild(base, candidate, tune, 2).ok) {
        const refund = Math.max(0, priceOf(old) - priceOf(target));
        car.installedParts = candidate;
        car.tune = tune;
        car.buildVersion = 2;
        s.credits += refund;
        notices.push(`${car.nickname}: ${name} é só para motores clássicos e virou ${findPart(target)!.name}${refund ? `; devolvemos ${cr(refund)}` : ''}.`);
      } else {
        car.installedParts = rest;
        if (base && !resolveBuild(base, rest, car.tune ?? {}, 2).ok) car.tune = {};
        s.credits += priceOf(old);
        notices.push(`${car.nickname}: ${name} é só para motores clássicos e saiu do carro; devolvemos ${cr(priceOf(old))}.`);
      }
    }
  }
  const kept: string[] = [];
  for (const e of s.inventoryPartIds) {
    const at = e.lastIndexOf('@');
    const id = e.slice(0, at);
    const baseCarId = e.slice(at + 1);
    if (!CLASSIC_ONLY_PARTS.has(id) || !isModern(baseCarId)) {
      kept.push(e);
      continue;
    }
    const target = replacementOf(baseCarId, id);
    const refund = target ? Math.max(0, priceOf(id) - priceOf(target)) : priceOf(id);
    if (target) kept.push(`${target}@${baseCarId}`);
    s.credits += refund;
    notices.push(`Estoque: ${findPart(id)?.name ?? id} ${target ? `virou ${findPart(target)!.name}` : 'saiu do estoque'}${refund ? `; devolvemos ${cr(refund)}` : ''}.`);
  }
  s.inventoryPartIds = kept;
  return notices;
}
