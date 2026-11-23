import { expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { runAccelerationTest } from '../../../src/game/race/accelerationTest';

it('responde ao acelerador progressivo sem perder o kickdown na largada do IS 350', () => {
  const car = findCampaignCar('lexus-is350-2015')!;
  const track = TRACKS.find((item) => item.id === 'test-track')!;
  const distance = 402.336;
  const stock = resolveBuild(car, [], {}, 2);
  const filter = resolveBuild(car, ['filter-sport'], {}, 2);
  if (!stock.ok || !filter.ok) throw new Error('Montagem de referência inválida');
  const options = { speedsKmh: [100], distancesM: [distance], stopAtLastSplit: true, maxS: 45 };
  const before = runAccelerationTest(stock.car, track, options);
  const after = runAccelerationTest(filter.car, track, options);
  expect(after.shifts.map((shift) => shift.from).slice(0, 4)).toEqual([1, 2, 3, 2]);
  expect(after.shifts[2]!.t).toBeLessThan(2);
  expect(after.distanceTimes.get(distance)).toBeLessThan(before.distanceTimes.get(distance)!);
});
