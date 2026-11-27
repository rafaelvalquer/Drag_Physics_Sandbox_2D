import { carToAcousticConfig, type AcousticVehicleConfig } from '../../../src/audio/dsp/AcousticConfig';
import { findCar } from '../../../src/data/cars/index';
import { BUILT_IN_SANDBOX_PRESETS } from '../../../src/data/cars/sandboxPresets';
import type { CarConfig } from '../../../src/data/schema';

export function golTurbo(): CarConfig {
  return BUILT_IN_SANDBOX_PRESETS.find((p) => p.id === 'vw-gol-ap-turbo-sandbox')!.car;
}

export function carById(id: string): CarConfig {
  const c = findCar(id);
  if (!c) throw new Error(`car ${id} missing`);
  return c;
}

/** Copy of a car with lab-only valve / wastegate hardware. */
export function withHardware(car: CarConfig, o: { bov?: 'none' | 'atmosphere' | 'recirculating'; wastegate?: 'internal' | 'external-recirculated' | 'external-open'; intake?: 'airbox' | 'sport-element' | 'cone' | 'open' }): CarConfig {
  const c = structuredClone(car) as CarConfig;
  if (o.bov && c.engine.turbo) {
    c.engine.turbo.bovEnabled = o.bov !== 'none';
    if (o.bov === 'recirculating') c.engine.turbo.bovVent = 'recirculating';
    else delete c.engine.turbo.bovVent;
  }
  if (o.wastegate || o.intake) c.acoustic = { ...c.acoustic, turbo: { ...c.acoustic.turbo, ...(o.wastegate ? { wastegate: o.wastegate } : {}), ...(o.intake ? { intake: o.intake } : {}) } };
  return c;
}

export function v2(car: CarConfig, quality: 'high' | 'low' = 'high', seed = 1): AcousticVehicleConfig {
  return { ...carToAcousticConfig(car, quality, seed), turboModel: 'v2' };
}

export function legacy(car: CarConfig, quality: 'high' | 'low' = 'high', seed = 1): AcousticVehicleConfig {
  return { ...carToAcousticConfig(car, quality, seed), turboModel: 'legacy' };
}

export const rmsOf = (x: ArrayLike<number>, a = 0, b = x.length): number => {
  let s = 0;
  for (let i = a; i < b; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, b - a));
};
export const dB = (x: number): number => 20 * Math.log10(Math.max(1e-12, x));
