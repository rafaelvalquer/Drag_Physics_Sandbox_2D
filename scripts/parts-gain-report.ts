/**
 * Workshop gain report: every part on every career car it fits, measured with the real physics
 * against the same build without it (src/game/career/tuning/partGain.ts).
 *
 *   npx tsx scripts/parts-gain-report.ts [car-id] [--fail]
 *
 * --fail prints only the parts that do not gain and exits with code 1 if there is any.
 */
import { CAREER_CARS } from '../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../src/data/cars/chapter2/index';
import { TRACKS } from '../src/data/tracks/index';
import { isGain, measurePartGain } from '../src/game/career/tuning/partGain';
import { ALL_PARTS } from '../src/game/career/tuning/parts';

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const failOnly = args.includes('--fail');
const track = TRACKS.find((t) => t.id === 'test-track')!;
const c2 = new Set(CHAPTER2_CARS.map((c) => c.id));
let bad = 0;
for (const car of CAREER_CARS) {
  if (only && car.id !== only) continue;
  const version = c2.has(car.id) ? 2 : 1;
  for (const p of ALL_PARTS) {
    if (version === 1 && p.since === 2) continue;
    const g = measurePartGain(car, p, track, version);
    if (!g) continue;
    const ok = isGain(g);
    if (!ok) bad++;
    if (failOnly && ok) continue;
    const dEt = g.etAfter - g.etBefore;
    console.log(
      `${ok ? 'ok  ' : 'FALHA'} ${car.id.padEnd(26)} ${p.id.padEnd(24)} ${(g.cvAfter - g.cvBefore >= 0 ? '+' : '') + (g.cvAfter - g.cvBefore).toFixed(1)} cv  ET ${(dEt >= 0 ? '+' : '') + dEt.toFixed(3)} s  0–100 ${(g.t100After - g.t100Before >= 0 ? '+' : '') + (g.t100After - g.t100Before).toFixed(3)} s${g.context.length ? `  [sobre ${g.context.join(' + ')}]` : ''}`,
    );
  }
}
console.log(`\n${bad} peça(s) sem ganho`);
if (failOnly && bad) process.exit(1);
