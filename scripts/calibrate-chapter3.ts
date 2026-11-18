/** Chapter 3 calibration: dyno peaks, standing start, shifts. Usage: npx tsx scripts/calibrate-chapter3.ts [carId] */
import { CHAPTER3_CARS } from '../src/data/cars/chapter3/index';
import { validateCar } from '../src/data/schema';
import { TRACKS } from '../src/data/tracks/index';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { EngineDyno } from '../src/physics/engine/EngineDyno';

const H = 1 / 120;
const only = process.argv[2];
const track = TRACKS.find((t) => t.id === 'test-track')!;
for (const car of CHAPTER3_CARS) {
  if (only && car.id !== only) continue;
  const v = validateCar(car);
  if (!v.ok) {
    console.log(car.id, 'INVALID', v.errors);
    continue;
  }
  const d = new EngineDyno(car.engine);
  d.start();
  let t = { rpm: 0, v: 0 };
  let p = { rpm: 0, v: 0 };
  for (let rpm = 1200; rpm <= car.engine.revLimitRpm; rpm += 100) {
    const m = d.measure(rpm, 1, H, 0.6, 0.15);
    if (m.torqueNm > t.v) t = { rpm, v: m.torqueNm };
    if (m.powerCv > p.v) p = { rpm, v: m.powerCv };
  }
  const t0 = Date.now();
  const r = runAccelerationTest(car, track, { speedsKmh: [100, 200], distancesM: [201, 402], maxS: 120 });
  const f = (x: number | null | undefined) => (x == null ? '—' : x.toFixed(2));
  console.log(
    `${car.id.padEnd(26)} dyno ${t.v.toFixed(0)}Nm@${t.rpm} ${p.v.toFixed(1)}cv@${p.rpm} | 0-100 ${f(r.speedTimes.get(100))} 0-200 ${f(r.speedTimes.get(200))} 201m ${f(r.distanceTimes.get(201))} 402m ${f(r.distanceTimes.get(402))} vmax ${r.topSpeedKmh.toFixed(0)} | shifts ${(r as unknown as { shifts?: { from: number; rpm: number }[] }).shifts?.map((s) => `${s.from}@${s.rpm.toFixed(0)}`).join(' ') ?? ''} (${Date.now() - t0} ms)`,
  );
}
