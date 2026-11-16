/**
 * Calibration report of the campaign cars: dyno peaks (measured on EngineDyno) and the
 * factory-style standing-start test (0–100 km/h, top speed) against the documented targets.
 *
 *   npx tsx scripts/calibrate-campaign.ts [car-id]
 *
 * Nothing here changes a car: it only measures.
 */
import { CAMPAIGN_CARS } from '../src/data/cars/campaign';
import { CAMPAIGN_TARGETS } from '../src/data/cars/campaignTargets';
import { TRACKS } from '../src/data/tracks/index';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { EngineDyno } from '../src/physics/engine/EngineDyno';

const only = process.argv[2];
const track = TRACKS.find((t) => t.id === 'test-track')!;
const pct = (s: number, t: number): string => `${(((s - t) / t) * 100).toFixed(1)} %`;

for (const car of CAMPAIGN_CARS) {
  if (only && car.id !== only) continue;
  const tg = CAMPAIGN_TARGETS[car.id];
  if (!tg) continue;
  const d = new EngineDyno(car.engine);
  d.start();
  let tMax = { rpm: 0, v: 0 };
  let pMax = { rpm: 0, v: 0 };
  for (let rpm = 1500; rpm <= car.engine.revLimitRpm; rpm += 100) {
    const p = d.measure(rpm, 1, 1 / 120, 0.8, 0.2);
    if (p.torqueNm > tMax.v) tMax = { rpm, v: p.torqueNm };
    if (p.powerCv > pMax.v) pMax = { rpm, v: p.powerCv };
  }
  const r = runAccelerationTest(car, track, { speedsKmh: [100], distancesM: [201, 402], maxS: 150, payloadKg: tg.testPayloadKg });
  const t100 = r.speedTimes.get(100) ?? null;
  console.log(`\n${car.name}`);
  console.log(`  torque  ${tMax.v.toFixed(1)} N·m @ ${tMax.rpm}  (meta ${tg.torqueNm} @ ${tg.torqueRpm}, ${pct(tMax.v, tg.torqueNm)})`);
  console.log(`  potência ${pMax.v.toFixed(1)} cv @ ${pMax.rpm}  (meta ${tg.powerCv} @ ${tg.powerRpm}, ${pct(pMax.v, tg.powerCv)})`);
  console.log(`  0–100   ${t100?.toFixed(2) ?? '—'} s  (meta ${tg.accel0to100S}${t100 ? `, ${pct(t100, tg.accel0to100S)}` : ''})`);
  console.log(`  vmáx    ${r.topSpeedKmh.toFixed(1)} km/h @ ${r.topSpeedRpm.toFixed(0)} rpm ${r.topSpeedGear}ª  (meta ${tg.topSpeedKmh}, ${pct(r.topSpeedKmh, tg.topSpeedKmh)})`);
  console.log(`  201 m ${r.distanceTimes.get(201)?.toFixed(2)} s · 402 m ${r.distanceTimes.get(402)?.toFixed(2)} s · patinagem máx ${(r.maxSlipRatio * 100).toFixed(0)} % (${r.wheelspinS.toFixed(2)} s)`);
  console.log(`  trocas ${r.shifts.map((s) => `${s.from}→${s.from + 1}@${s.rpm.toFixed(0)}`).join(' ')}`);
}
