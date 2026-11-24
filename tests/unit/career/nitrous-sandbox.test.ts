/** Sandbox presets with an N₂O kit resolve (no rejection) and carry a cylinder; restart refills it. */
import { describe, expect, it } from 'vitest';
import { BUILT_IN_SANDBOX_PRESETS, SANDBOX_PRESET_REJECTIONS } from '../../../src/data/cars/sandboxPresets';
import { TRACKS } from '../../../src/data/tracks/index';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

describe('sandbox nitrous presets', () => {
  it('none was rejected and the kit presets have a cylinder and continuous flow settings', () => {
    expect(SANDBOX_PRESET_REJECTIONS).toEqual([]);
    const kits = BUILT_IN_SANDBOX_PRESETS.filter((p) => p.partIds.some((id) => id.startsWith('nitrous-')));
    expect(kits.length).toBeGreaterThanOrEqual(2);
    for (const p of kits) expect(p.car.nitrous?.capacityKg).toBeGreaterThan(0);
    expect(kits.some((p) => p.car.nitrous?.flow === 0.58)).toBe(true);
  });

  it('a restart gives the cylinder back', () => {
    const p = BUILT_IN_SANDBOX_PRESETS.find((x) => x.partIds.some((id) => id.startsWith('nitrous-')))!;
    const sim = new VehicleSimulation(p.car, TRACKS.find((t) => t.id === 'test-track')!);
    sim.reset();
    expect(sim.nitrous!.remainingFraction).toBe(1);
  });
});
