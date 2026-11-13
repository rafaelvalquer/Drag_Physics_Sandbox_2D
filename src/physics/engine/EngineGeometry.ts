import type { EngineConfig } from '../../data/schema';

/**
 * Slider-crank kinematics and displacement.
 *
 * ORIGIN (MIT): ange-yaghi/engine-sim `placeRod` and `Engine::calculateDisplacement`
 * (src/engine.cpp) place the wrist pin on the cylinder axis by solving
 *   (bank.x + bank.dx·s − p_x)² + (bank.y + bank.dy·s − p_y)² = rodLength²
 * for the piston travel `s`, and integrate the swept volume numerically. For a cylinder whose
 * axis passes through the crank centre this has the closed form used below:
 *   s(α) = r·cos α + sqrt(l² − r²·sin² α)
 * (engine-sim itself notes that a closed form exists; it approximated it with 1000 samples).
 */
export interface Geometry {
  crankRadius: number; // m
  rodLength: number; // m
  boreArea: number; // m²
  sweptVolumePerCylinder: number; // m³
  displacement: number; // m³
  clearanceVolume: number; // m³ per cylinder
}

export function engineGeometry(e: Pick<EngineConfig, 'boreMm' | 'strokeMm' | 'rodLengthMm' | 'compressionRatio' | 'cylinders'>): Geometry {
  const bore = e.boreMm / 1000;
  const stroke = e.strokeMm / 1000;
  const r = stroke / 2;
  const area = (Math.PI * bore * bore) / 4;
  const swept = area * stroke;
  return {
    crankRadius: r,
    rodLength: e.rodLengthMm / 1000,
    boreArea: area,
    sweptVolumePerCylinder: swept,
    displacement: swept * e.cylinders,
    clearanceVolume: swept / (e.compressionRatio - 1),
  };
}

/** Distance from crank centre to wrist pin for crank angle α measured from TDC. */
export function pistonPinDistance(alpha: number, r: number, l: number): number {
  const s = Math.sin(alpha);
  return r * Math.cos(alpha) + Math.sqrt(l * l - r * r * s * s);
}

/** Piston displacement from TDC (m), 0 at TDC, 2r at BDC. */
export function pistonTravel(alpha: number, r: number, l: number): number {
  return r + l - pistonPinDistance(alpha, r, l);
}

/** Cylinder volume (m³) at crank angle α. */
export function cylinderVolume(alpha: number, g: Geometry): number {
  return g.clearanceVolume + g.boreArea * pistonTravel(alpha, g.crankRadius, g.rodLength);
}

/**
 * Numerical displacement exactly as engine-sim computes it (min/max travel over a revolution),
 * kept to cross-check the closed form in tests.
 */
export function numericalDisplacement(g: Geometry, cylinders: number, resolution = 1000): number {
  let minS = Infinity;
  let maxS = -Infinity;
  for (let j = 0; j < resolution; j++) {
    const a = 2 * (j / resolution) * Math.PI;
    const s = pistonPinDistance(a, g.crankRadius, g.rodLength);
    if (s < minS) minS = s;
    if (s > maxS) maxS = s;
  }
  return g.boreArea * (maxS - minS) * cylinders;
}
