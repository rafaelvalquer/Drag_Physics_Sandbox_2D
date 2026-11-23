import { findCampaignCar } from '../../data/cars/campaign';
import type { BuildTune } from './tuning/buildCommon';
import { resolveBuild } from './tuning/BuildResolver';
import { findPart } from './tuning/parts';
import type { CareerSave } from './CareerState';

/**
 * The generic ECU maps of the first modern catalogue (`ecu-stage1/2/3`, one map for every turbo car)
 * were replaced by one map per engine family (`ecu-map-<family>-sN`, same stage). Saves that still
 * name the old ids are moved to the new part of the same stage; when the car does not run with it
 * (the new maps ask for their own fuel / intercooler / internals) the part is removed and its price
 * goes back to the credits, so nothing is lost.
 */
export const LEGACY_ECU: Readonly<Record<string, { tier: 1 | 2 | 3; price: number; name: string }>> = {
  'ecu-stage1': { tier: 1, price: 2500, name: 'Remap Stage 1' },
  'ecu-stage2': { tier: 2, price: 5500, name: 'Remap Stage 2' },
  'ecu-stage3': { tier: 3, price: 9000, name: 'Remap Stage 3' },
};

const entry = (partId: string, baseCarId: string): string => `${partId}@${baseCarId}`;

function targetOf(baseCarId: string, legacyId: string): string | null {
  const family = findCampaignCar(baseCarId)?.engine.family;
  const id = family ? `ecu-map-${family}-s${LEGACY_ECU[legacyId]!.tier}` : null;
  return id && findPart(id) ? id : null;
}

export function hasLegacyEcus(s: Pick<CareerSave, 'ownedCars' | 'inventoryPartIds'>): boolean {
  return s.ownedCars.some((c) => c.installedParts.some((id) => id in LEGACY_ECU)) || s.inventoryPartIds.some((e) => e.slice(0, e.lastIndexOf('@')) in LEGACY_ECU);
}

/** Mutates the save (a copy inside a transaction, or a freshly imported one). Returns the notices for the player. */
export function migrateLegacyEcus(s: CareerSave): string[] {
  const notices: string[] = [];
  for (const car of s.ownedCars) {
    const legacy = car.installedParts.find((id) => id in LEGACY_ECU);
    if (!legacy) continue;
    const info = LEGACY_ECU[legacy]!;
    const base = findCampaignCar(car.baseCarId);
    const target = targetOf(car.baseCarId, legacy);
    const rest = car.installedParts.filter((id) => id !== legacy);
    let placed = false;
    if (base && target) {
      const candidate = [...rest, target];
      const tunes: BuildTune[] = [car.tune ?? {}, withoutBoost(car.tune), {}];
      for (const tune of tunes) {
        if (!resolveBuild(base, candidate, tune, 2).ok) continue;
        car.installedParts = candidate;
        car.tune = tune;
        car.buildVersion = 2;
        notices.push(`${car.nickname}: ${info.name} agora é ${findPart(target)!.name}.`);
        placed = true;
        break;
      }
    }
    if (!placed) {
      car.installedParts = rest;
      s.credits += info.price;
      notices.push(`${car.nickname}: ${info.name} saiu do catálogo e o mapa novo exige outras peças; devolvemos ${info.price.toLocaleString('pt-BR')} CR.`);
    }
  }
  const kept: string[] = [];
  for (const e of s.inventoryPartIds) {
    const at = e.lastIndexOf('@');
    const id = e.slice(0, at);
    if (!(id in LEGACY_ECU)) {
      kept.push(e);
      continue;
    }
    const baseCarId = e.slice(at + 1);
    const target = targetOf(baseCarId, id);
    if (target) {
      kept.push(entry(target, baseCarId));
      notices.push(`Estoque: ${LEGACY_ECU[id]!.name} agora é ${findPart(target)!.name}.`);
    } else s.credits += LEGACY_ECU[id]!.price;
  }
  s.inventoryPartIds = kept;
  return notices;
}

function withoutBoost(tune: BuildTune | undefined): BuildTune {
  if (!tune) return {};
  const { boostBar: _boost, ...rest } = tune;
  return rest;
}
