import type { TrackConfig } from '../schema';

export const TRACKS: readonly TrackConfig[] = [
  {
    id: 'test-track',
    name: 'Test Track',
    theme: 'testTrack',
    surfaceGrip: 1.0,
    rollingResistanceFactor: 1.0,
    surfaceTempC: 32,
    ambientTempC: 24,
    ambientPressurePa: 101325,
    windMs: 0,
    gradePercent: 0,
    lengthM: 1600,
  },
  {
    id: 'desert-strip',
    name: 'Desert Strip',
    theme: 'desert',
    surfaceGrip: 0.92,
    rollingResistanceFactor: 1.15,
    surfaceTempC: 52,
    ambientTempC: 38,
    ambientPressurePa: 95500,
    windMs: -2.5,
    gradePercent: 0,
    lengthM: 1600,
  },
  {
    id: 'night-industrial',
    name: 'Night Industrial',
    theme: 'nightIndustrial',
    surfaceGrip: 0.97,
    rollingResistanceFactor: 1.0,
    surfaceTempC: 18,
    ambientTempC: 15,
    ambientPressurePa: 101800,
    windMs: 0,
    gradePercent: 0,
    lengthM: 1600,
  },
  {
    id: 'airfield',
    name: 'Airfield',
    theme: 'airfield',
    surfaceGrip: 0.95,
    rollingResistanceFactor: 1.05,
    surfaceTempC: 28,
    ambientTempC: 21,
    ambientPressurePa: 100600,
    windMs: 1.5,
    gradePercent: 0,
    lengthM: 2000,
  },
];

export function findTrack(id: string): TrackConfig {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;
}
