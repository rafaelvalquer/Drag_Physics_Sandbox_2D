/** Raster body styles: registration and the lamp / exhaust metadata they imply (pure, no canvas). */
import { describe, expect, it } from 'vitest';
import { CAR_FIAT_UNO_MILLE_1995 } from '../../../src/data/cars/fiatUnoMille1995';
import { CAR_GM_CHEVETTE_SL_1988 } from '../../../src/data/cars/gmChevetteSl1988';
import { rasterBodyFor, rasterMetaFor } from '../../../src/game/vehicles/art/raster';
import { chevetteSl88Meta } from '../../../src/game/vehicles/art/raster/chevetteSl88';

describe('raster body styles', () => {
  it('the Chevette SL and the Uno are registered, other campaign cars keep the vector art', () => {
    expect(rasterBodyFor('chevetteSl88')).toBeTypeOf('function');
    expect(rasterBodyFor('unoMille95')).toBeTypeOf('function');
    expect(rasterBodyFor('celta03')).toBeUndefined();
    expect(rasterBodyFor('corsaGl96')).toBeUndefined();
  });

  it('Chevette metadata sits on the car geometry (front axle = origin, lamps at the ends, exhaust behind the rear axle)', () => {
    const car = CAR_GM_CHEVETTE_SL_1988;
    const m = chevetteSl88Meta(car);
    const rearAxle = -car.wheelbaseM;
    expect(rasterMetaFor(car)).toEqual(m);
    // headlight / turn signal at the nose, in front of the front axle and within the front overhang
    expect(m.headlight.x).toBeGreaterThan(0);
    expect(m.headlight.x).toBeLessThanOrEqual(car.visual.frontOverhangM + 1e-6);
    // tail lamp at the rear end, behind the rear axle and inside the body length
    expect(m.taillight.x).toBeLessThan(rearAxle);
    expect(m.taillight.x).toBeGreaterThanOrEqual(-(car.visual.lengthM - car.visual.frontOverhangM) - 1e-6);
    // exhaust leaves under the rear bumper, low and behind the rear axle
    expect(m.exhausts).toHaveLength(1);
    expect(m.exhausts[0]!.x).toBeLessThan(rearAxle);
    expect(m.exhausts[0]!.y).toBeGreaterThan(0);
    expect(m.exhausts[0]!.y).toBeLessThan(0.45);
    // lamps sit between the sill and the roof
    for (const l of [m.headlight, m.taillight]) {
      expect(l.y).toBeGreaterThan(0.4);
      expect(l.y).toBeLessThan(car.visual.heightM);
    }
  });

  it('the metadata follows the car data when overhangs change (no fixed photo coordinates)', () => {
    const longer = { ...CAR_GM_CHEVETTE_SL_1988, visual: { ...CAR_GM_CHEVETTE_SL_1988.visual, lengthM: 4.4, frontOverhangM: 0.9 } };
    const a = chevetteSl88Meta(CAR_GM_CHEVETTE_SL_1988);
    const b = chevetteSl88Meta(longer);
    expect(b.headlight.x).toBeGreaterThan(a.headlight.x);
    expect(b.taillight.x).toBeLessThan(a.taillight.x);
  });

  it('the Uno metadata sits on its geometry too', () => {
    const car = CAR_FIAT_UNO_MILLE_1995;
    const m = rasterMetaFor(car)!;
    expect(m.headlight.x).toBeGreaterThan(0);
    expect(m.taillight.x).toBeLessThan(-car.wheelbaseM);
    expect(m.exhausts[0]!.x).toBeLessThan(-car.wheelbaseM);
  });
});
