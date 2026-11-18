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
  // ---- chapter 2: "Liga da Madrugada"
  {
    id: 'patio-das-torres',
    name: 'Pátio das Torres',
    theme: 'patioDasTorres',
    surfaceGrip: 0.96, // car-park asphalt, swept
    rollingResistanceFactor: 1.0,
    surfaceTempC: 18,
    ambientTempC: 16,
    ambientPressurePa: 101300,
    windMs: 0,
    gradePercent: 0,
    lengthM: 900,
  },
  {
    id: 'distrito-financeiro',
    name: 'Distrito Financeiro',
    theme: 'distritoFinanceiro',
    surfaceGrip: 0.98, // new avenue asphalt
    rollingResistanceFactor: 1.0,
    surfaceTempC: 17,
    ambientTempC: 15,
    ambientPressurePa: 101500,
    windMs: -0.5,
    gradePercent: 0,
    lengthM: 1000,
  },
  // ---- chapter 3: "Elite da Madrugada"
  {
    id: 'marginal-alta',
    name: 'Marginal Alta',
    theme: 'marginalAlta',
    surfaceGrip: 1.0, // elevated expressway, freshly closed and swept
    rollingResistanceFactor: 1.0,
    surfaceTempC: 16,
    ambientTempC: 15,
    ambientPressurePa: 101200,
    windMs: 0.5,
    gradePercent: 0,
    lengthM: 1000,
  },
  {
    id: 'hangar-executivo',
    name: 'Hangar Executivo',
    theme: 'hangarExecutivo',
    surfaceGrip: 1.02, // runway concrete prepared for launches
    rollingResistanceFactor: 1.0,
    surfaceTempC: 17,
    ambientTempC: 15,
    ambientPressurePa: 101400,
    windMs: -0.5,
    gradePercent: 0,
    lengthM: 1000,
  },
  {
    id: 'pier-elite',
    name: 'Pier Elite',
    theme: 'pierElite',
    surfaceGrip: 1.0,
    rollingResistanceFactor: 1.0,
    surfaceTempC: 18,
    ambientTempC: 17,
    ambientPressurePa: 101300,
    windMs: 1,
    gradePercent: 0,
    lengthM: 1000,
  },
  {
    id: 'corredor-da-liga',
    name: 'Corredor da Liga',
    theme: 'corredorDaLiga',
    surfaceGrip: 1.0, // the league preps the launch area
    rollingResistanceFactor: 1.0,
    surfaceTempC: 19,
    ambientTempC: 16,
    ambientPressurePa: 101400,
    windMs: 0,
    gradePercent: 0,
    lengthM: 1000,
  },
];

export function findCareerTrack(id: string): TrackConfig {
  const t = CAREER_TRACKS.find((x) => x.id === id);
  if (!t) throw new Error(`pista da campanha desconhecida: ${id}`);
  return t;
}
