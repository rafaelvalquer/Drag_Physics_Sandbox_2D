import { findCampaignCar } from '../../data/cars/campaign';
import { resolveBuild } from '../career/tuning/BuildResolver';
import { careerResolverVersion } from '../career/tuning/resolverVersion';
import { failureSpecFor } from '../career/tuning/TuningCapabilities';
import type { OfficialBuild } from './AuthoritativeRace';

export const ONLINE_STARTERS = ['fiat-uno-mille-1995', 'gm-chevette-sl-1988', 'vw-gol-gts-1988'] as const;

export function stockOnlineBuild(baseCarId: string, name: string): OfficialBuild {
  const base = findCampaignCar(baseCarId);
  if (!base) throw new Error(`Modelo desconhecido: ${baseCarId}`);
  const version = careerResolverVersion(base.id);
  const build = resolveBuild(base, [], {}, version);
  if (!build.ok) throw new Error(`Configuração original inválida: ${baseCarId}`);
  return { car: build.car, name, failureSpec: failureSpecFor(base, [], version) };
}
