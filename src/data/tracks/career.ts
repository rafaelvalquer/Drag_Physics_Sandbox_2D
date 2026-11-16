import type { TrackConfig } from '../schema';

/**
 * Night street venues of the career (chapter 1). Kept apart from the Sandbox TRACKS list: the
 * existing tracks are untouched. Night air is cool and dense; old asphalt grips a little less than
 * a prepared strip.
 */
export const CAREER_TRACKS: readonly TrackConfig[] = [
  {
    id: 'distrito-industrial',
    name: 'Distrito Industrial',
    theme: 'distritoIndustrial',
    surfaceGrip: 0.93, // worn asphalt, rubber dust
    rollingResistanceFactor: 1.05,
    surfaceTempC: 19,
    ambientTempC: 17,
    ambientPressurePa: 101300,
    windMs: 0,
    gradePercent: 0,
    lengthM: 900,
  },
  {
    id: 'baixada',
    name: 'Baixada',
    theme: 'baixada',
    surfaceGrip: 0.95, // concrete under the viaduct
    rollingResistanceFactor: 1.0,
    surfaceTempC: 17,
    ambientTempC: 15,
    ambientPressurePa: 101600,
    windMs: -0.8,
    gradePercent: 0,
    lengthM: 900,
  },
  {
    id: 'avenida-norte',
    name: 'Avenida Norte',
    theme: 'avenidaNorte',
    surfaceGrip: 0.97, // smooth avenue asphalt
    rollingResistanceFactor: 1.0,
    surfaceTempC: 18,
    ambientTempC: 16,
    ambientPressurePa: 101400,
    windMs: 0.5,
    gradePercent: 0,
    lengthM: 1000,
  },
];

export function findCareerTrack(id: string): TrackConfig {
  const t = CAREER_TRACKS.find((x) => x.id === id);
  if (!t) throw new Error(`pista da campanha desconhecida: ${id}`);
  return t;
}
