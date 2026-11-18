import { CHAPTER3_CARS } from '../../../../src/data/cars/chapter3/index';
import type { CarConfig } from '../../../../src/data/schema';
import { resolveBuild } from '../../../../src/game/career/tuning/BuildResolver';
import type { BuildResult } from '../../../../src/game/career/tuning/buildCommon';

export const car = (id: string): CarConfig => CHAPTER3_CARS.find((c) => c.id === id)!;
export const Z350 = 'nissan-350z-2006';
export const IS350 = 'lexus-is350-2015';
export const Z370 = 'nissan-370z-2014';
export const C43 = 'mercedes-amg-c43-2017';
export const STINGER = 'kia-stinger-gt-2019';
export const GHIBLI = 'maserati-ghibli-sq4-2015';
export const GIULIA = 'alfa-giulia-qv-2017';
export const GTR = 'nissan-gtr-r35-2015';
export const NA_CARS = [Z350, IS350, Z370];
export const BITURBO_CARS = [C43, STINGER, GHIBLI, GIULIA, GTR];

export type Ok = Extract<BuildResult, { ok: true }>;
export function build(id: string, parts: string[], tune = {}): Ok {
  const r = resolveBuild(car(id), parts, tune, 2);
  if (!r.ok) throw new Error(`${id} ${parts.join('+')}: ${r.errors.join('; ')}`);
  return r;
}
export const errors = (id: string, parts: string[], tune = {}): string[] => {
  const r = resolveBuild(car(id), parts, tune, 2);
  return r.ok ? [] : r.errors;
};
