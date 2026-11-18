/** Generates the numbers of docs/CHAPTER3_WORKSHOP.md: npx tsx scripts/chapter3-workshop-report.ts */
import { CHAPTER3_CARS } from '../src/data/cars/chapter3/index';
import { TRACKS } from '../src/data/tracks/index';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { resolveBuild } from '../src/game/career/tuning/BuildResolver';
import { presetsFor } from '../src/game/career/tuning/ProjectRequirements';
import { reliabilityLimits } from '../src/game/career/tuning/EngineReliability';

const track = TRACKS.find((t) => t.id === 'test-track')!;
const f = (x: number | null | undefined, d = 2): string => (x == null ? '—' : x.toFixed(d).replace('.', ','));
console.log('| Carro | Projeto | cv | N·m | 0–100 s | 201 m s | 402 m s | km/h 402 | combustível | óleo | vida no limite s |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const c of CHAPTER3_CARS) {
  const rows: [string, string[]][] = [['original', []], ...presetsFor(c).map((p): [string, string[]] => [p.id, p.parts])];
  for (const [id, parts] of rows) {
    const r = resolveBuild(c, parts, {}, 2);
    if (!r.ok) { console.log(`| ${c.id} | ${id} | RECUSADO: ${r.errors.join('; ')} |`); continue; }
    const t = runAccelerationTest(r.car, track, { speedsKmh: [100], distancesM: [201, 402], maxS: 40 });
    const lim = reliabilityLimits(r.car, parts);
    console.log(`| ${c.id} | ${id} | ${f(r.peakPowerCv, 0)} | ${f(r.peakTorqueNm, 0)} | ${f(t.speedTimes.get(100))} | ${f(t.distanceTimes.get(201))} | ${f(t.distanceTimes.get(402))} | — | ${r.diagnostics?.fuel ? Math.round(r.diagnostics.fuel.margin * 100) + ' %' : '—'} | ${r.diagnostics?.oil ? Math.round(r.diagnostics.oil.margin * 100) + ' %' : '—'} | ${f(lim.enduranceS, 1)} |`);
  }
}
