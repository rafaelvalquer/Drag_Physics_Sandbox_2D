/**
 * Tuning report: resolves part combinations on every campaign car and measures the result on the
 * EngineDyno (the same physics the race uses).   npx tsx scripts/tuning-report.ts [car-id]
 */
import { CAMPAIGN_CARS } from '../src/data/cars/campaign';
import { resolveBuild } from '../src/game/career/tuning/BuildResolver';
import { EngineDyno } from '../src/physics/engine/EngineDyno';

const only = process.argv[2];
const SETS: [string, string[]][] = [
  ['stock', []],
  ['filtro', ['filter-sport']],
  ['escape', ['exhaust-sport']],
  ['coletor', ['manifold-sport']],
  ['comando', ['cam-sport']],
  ['NA completo', ['filter-sport', 'exhaust-sport', 'manifold-sport', 'cam-sport']],
  ['turbo+emb', ['turbo-basic', 'clutch-reinforced']],
  ['turbo+emb+escape+coletor', ['turbo-basic', 'clutch-reinforced', 'exhaust-sport', 'manifold-sport']],
  ['turbo sem embreagem', ['turbo-basic']],
];
for (const car of CAMPAIGN_CARS) {
  if (only && car.id !== only) continue;
  console.log(`\n${car.name}`);
  for (const [label, ids] of SETS) {
    const t0 = performance.now();
    const r = resolveBuild(car, ids);
    const ms = performance.now() - t0;
    if (!r.ok) {
      console.log(`  ${label.padEnd(26)} REJEITADO: ${r.errors.join('; ')}`);
      continue;
    }
    const d = new EngineDyno(r.car.engine);
    d.start();
    let t = { rpm: 0, v: 0 };
    let p = { rpm: 0, v: 0 };
    const lo = { r2500: 0 };
    for (let rpm = 1600; rpm <= r.car.engine.revLimitRpm; rpm += 200) {
      const m = d.measure(rpm, 1, 1 / 120, 1.2, 0.2);
      if (rpm === 2600) lo.r2500 = m.torqueNm;
      if (m.torqueNm > t.v) t = { rpm, v: m.torqueNm };
      if (m.powerCv > p.v) p = { rpm, v: m.powerCv };
    }
    const boost = r.steadyBoostBar.length ? ` boost máx ${Math.max(...r.steadyBoostBar.map((b) => b.bar)).toFixed(2)} bar` : '';
    console.log(
      `  ${label.padEnd(26)} curva ${r.peakTorqueNm.toFixed(1)} N·m/${r.peakPowerCv.toFixed(1)} cv · dyno ${t.v.toFixed(1)} N·m@${t.rpm} ${p.v.toFixed(1)} cv@${p.rpm} · 2600: ${lo.r2500.toFixed(1)}${boost} (${ms.toFixed(0)} ms)`,
    );
  }
}
