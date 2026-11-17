import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CARS, findCampaignCar } from '../../../src/data/cars/campaign';
import { CAR_GROUPS, CARS, LAB_CARS, SANDBOX_CARS, findCar, cloneCar } from '../../../src/data/cars/index';
import { BUILT_IN_SANDBOX_PRESETS, SANDBOX_PRESET_REJECTIONS } from '../../../src/data/cars/sandboxPresets';
import { findRival } from '../../../src/game/career/CareerEvents';
import { rivalBuild } from '../../../src/game/career/RivalBuildFactory';
import { validateCar } from '../../../src/data/schema';

const NEW_IDS = [
  'fiat-uno-mille-1995', 'gm-celta-2003', 'gm-chevette-sl-1988',
  'gm-corsa-gl-1996', 'gm-kadett-sl-1992', 'vw-saveiro-gl-1994',
];

describe('unified free-mode vehicle catalogue', () => {
  it('includes all six campaign cars in Sandbox, quick race, dyno and garage, by canonical identity', () => {
    for (const id of NEW_IDS) {
      const base = findCampaignCar(id);
      expect(base).toBeDefined();
      expect(findCar(id)).toBe(base);
      expect(SANDBOX_CARS.find((car) => car.id === id)).toBe(base);
      expect(LAB_CARS.find((car) => car.id === id)).toBe(base);
      expect(validateCar(base!).ok).toBe(true);
    }
  });
  it('deduplicates the Gol and every other ID across free-play groups', () => {
    expect(SANDBOX_CARS.filter((c) => c.id === 'vw-gol-gts-1988')).toHaveLength(1);
    expect(LAB_CARS.filter((c) => c.id === 'vw-gol-gts-1988')).toHaveLength(1);
    expect(new Set(LAB_CARS.map((c) => c.id)).size).toBe(LAB_CARS.length);
    expect(CAR_GROUPS.flatMap((g) => g.cars.map((c) => c.id)).sort()).toEqual(LAB_CARS.map((c) => c.id).sort());
    expect(CARS.find((c) => c.id === 'vw-gol-gts-1988')).toBe(findCampaignCar('vw-gol-gts-1988'));
  });
  it('does not mutate any factory car when editing a freely selected clone', () => {
    const car = cloneCar(findCar('vw-saveiro-gl-1994')!);
    car.acoustic.intakeGain = 0.1;
    car.visual.color = '#abcdef';
    expect(findCampaignCar(car.id)?.acoustic.intakeGain).not.toBe(0.1);
    expect(findCampaignCar(car.id)?.visual.color).not.toBe('#abcdef');
    expect(CAMPAIGN_CARS).toHaveLength(7);
  });
});

describe('resolver-backed built-in preparations', () => {
  it('Marcos uses the exact campaign rival parts and car mechanics, not a duplicate engine', () => {
    const rival = findRival('marcos')!;
    const built = rivalBuild(rival);
    const preset = BUILT_IN_SANDBOX_PRESETS.find((p) => p.id === 'vw-saveiro-marcos-turbo-sandbox');
    expect(preset).toBeDefined();
    expect(preset!.baseCarId).toBe('vw-saveiro-gl-1994');
    expect(preset!.partIds).toEqual(rival.parts);
    expect(preset!.car.engine).toEqual(built.car.engine);
    expect(preset!.car.engine.induction).toBe('turbo');
    expect(preset!.car.id).toBe(preset!.baseCarId);
  });
  it('all offered builds pass physical compatibility and preserve the factory for reset', () => {
    for (const p of BUILT_IN_SANDBOX_PRESETS) {
      expect(validateCar(p.car).ok, p.id).toBe(true);
      expect(findCampaignCar(p.baseCarId)).toBeDefined();
      expect(p.car.id).toBe(p.baseCarId);
    }
    expect(SANDBOX_PRESET_REJECTIONS.find((r) => r.id === 'vw-saveiro-marcos-turbo-sandbox')).toBeUndefined();
  });
});
