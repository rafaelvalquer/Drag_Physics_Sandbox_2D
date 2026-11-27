import type { CarConfig } from '../../data/schema';
import { findCareerTrack } from '../../data/tracks/career';
import { runAccelerationTest } from '../../game/race/accelerationTest';
import type { Estimate } from './WorkshopComparisonPanel';

globalThis.addEventListener('message', ({ data }: MessageEvent<{ key: string; car: CarConfig }[]>) => {
  const track = findCareerTrack('avenida-norte');
  const results = data.map(({ key, car }): [string, Estimate] => {
    const run = runAccelerationTest(car, track, { speedsKmh: [100], distancesM: [201, 402, 1000], maxS: 45 });
    return [key, {
      t100: run.speedTimes.get(100) ?? null,
      t201: run.distanceTimes.get(201) ?? null,
      t402: run.distanceTimes.get(402) ?? null,
      t1000: run.distanceTimes.get(1000) ?? null,
    }];
  });
  postMessage(results);
});
