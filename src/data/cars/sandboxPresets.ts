import type { CarConfig } from '../schema';
import { findCampaignCar } from './campaign';
import { findRival } from '../../game/career/CareerEvents';
import { resolveBuild } from '../../game/career/tuning/BuildResolver';
import type { BuildTune } from '../../game/career/tuning/buildCommon';

/** A named free-play build is a recipe, NOT a second factory car. */
export interface SandboxPreparedPreset {
  id: string;
  label: string;
  baseCarId: string;
  partIds: readonly string[];
  tune: BuildTune;
  car: CarConfig;
}

const RECIPES = [
  { id: 'vw-saveiro-marcos-turbo-sandbox', label: 'Saveiro GL AP 1.8 — Marcos Turbo', rival: 'marcos' },
  { id: 'vw-gol-ap-preparado-sandbox', label: 'Gol GTS AP — Léo Aspirado', rival: 'leonardo' },
  { id: 'fiat-uno-preparado-sandbox', label: 'Uno Mille — Preparado', baseCarId: 'fiat-uno-mille-1995', parts: ['filter-sport'] },
  { id: 'gm-celta-preparado-sandbox', label: 'Celta — Preparado', baseCarId: 'gm-celta-2003', parts: ['filter-sport'] },
  { id: 'gm-chevette-preparado-sandbox', label: 'Chevette — Nando', rival: 'fernando' },
  { id: 'gm-corsa-preparado-sandbox', label: 'Corsa — Beto', rival: 'roberto' },
  { id: 'gm-kadett-preparado-sandbox', label: 'Kadett — Paula', rival: 'paula' },
  { id: 'vw-gol-ap-turbo-sandbox', label: 'Gol GTS AP — Turbo de teste', baseCarId: 'vw-gol-gts-1988', parts: ['turbo-basic', 'clutch-reinforced', 'exhaust-sport', 'tires-sport'], tune: { boostBar: 0.5 } },
  { id: 'vw-gol-nitro-street-sandbox', label: 'Gol GTS AP — Street Shot (N₂O)', baseCarId: 'vw-gol-gts-1988', parts: ['nitrous-street'], tune: {} as BuildTune },
  { id: 'gm-chevette-nitro-wet-sandbox', label: 'Chevette — Wet Performance', baseCarId: 'gm-chevette-sl-1988', parts: ['nitrous-wet'], tune: { nitrousFlow: 0.58, nitrousRampS: 0.72 } as BuildTune },
] as const;

const valid: SandboxPreparedPreset[] = [];
/** A rejected recipe is reported rather than bypassing detonation/clutch/fuel checks. */
export const SANDBOX_PRESET_REJECTIONS: { id: string; errors: string[] }[] = [];
for (const recipe of RECIPES) {
  const rival = 'rival' in recipe ? findRival(recipe.rival) : undefined;
  const baseCarId = rival?.baseCarId ?? ('baseCarId' in recipe ? recipe.baseCarId : '');
  const base = findCampaignCar(baseCarId);
  const parts: readonly string[] = rival?.parts ?? ('parts' in recipe ? recipe.parts : []);
  const tune = rival?.tune ?? ('tune' in recipe ? recipe.tune : {});
  if (!base) {
    SANDBOX_PRESET_REJECTIONS.push({ id: recipe.id, errors: [`base desconhecida: ${baseCarId}`] });
    continue;
  }
  const built = resolveBuild(base, parts, tune);
  if (!built.ok) {
    SANDBOX_PRESET_REJECTIONS.push({ id: recipe.id, errors: built.errors });
    continue;
  }
  const painted = rival?.paint;
  valid.push({
    id: recipe.id, label: recipe.label, baseCarId, partIds: parts, tune,
    car: {
      ...built.car,
      id: base.id, // preserve the canonical car ID for factory restore
      name: recipe.label,
      visual: { ...built.car.visual, ...(painted ? { color: painted.color, accent: painted.accent } : {}) },
    },
  });
}
export const BUILT_IN_SANDBOX_PRESETS: readonly SandboxPreparedPreset[] = valid;
export function findSandboxPreset(id: string): SandboxPreparedPreset | undefined {
  return BUILT_IN_SANDBOX_PRESETS.find((p) => p.id === id);
}
