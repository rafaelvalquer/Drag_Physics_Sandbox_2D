/**
 * Workshop gain report: every part on every career car it fits, measured with the real physics
 * against the same build without it (src/game/career/tuning/partGain.ts).
 *
 *   npx tsx scripts/parts-gain-report.ts [car-id] [--fail]
 *
 * --fail prints only the parts that do not gain and exits with code 1 if there is any.
 */
import { CAREER_CARS } from '../src/data/cars/campaign';
import { TRACKS } from '../src/data/tracks/index';
import { auditPartGain, WORKSHOP_DISTANCE_M } from '../src/game/career/tuning/partGain';
import { ALL_PARTS } from '../src/game/career/tuning/parts';
import { careerResolverVersion } from '../src/game/career/tuning/resolverVersion';

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const failOnly = args.includes('--fail');
const track = TRACKS.find((t) => t.id === 'test-track')!;
if (only && !CAREER_CARS.some((car) => car.id === only)) throw new Error(`Carro desconhecido: ${only}`);
console.log(`Distância oficial: ${WORKSHOP_DISTANCE_M} m`);
let bad = 0;
for (const car of CAREER_CARS) {
  if (only && car.id !== only) continue;
  const version = careerResolverVersion(car.id);
  for (const p of ALL_PARTS) {
    const audit = auditPartGain(car, p, track, version);
    if (audit.status === 'incompatible') continue;
    const ok = audit.status === 'gain';
    if (!ok) bad++;
    if (failOnly && ok) continue;
    if ('reasons' in audit) {
      console.log(`${audit.status} ${car.id} ${p.id}: ${audit.reasons.join('; ')}`);
      continue;
    }
    const g = audit.gain;
    const dEt = g.etAfter - g.etBefore;
    console.log(
      `${ok ? 'ok  ' : 'FALHA'} ${car.id.padEnd(26)} ${p.id.padEnd(24)} ${(g.cvAfter - g.cvBefore >= 0 ? '+' : '') + (g.cvAfter - g.cvBefore).toFixed(1)} cv  ET ${(dEt >= 0 ? '+' : '') + dEt.toFixed(3)} s  0–100 ${(g.t100After - g.t100Before >= 0 ? '+' : '') + (g.t100After - g.t100Before).toFixed(3)} s${g.context.length ? `  [sobre ${g.context.join(' + ')}]` : ''}`,
    );
  }
}
console.log(`\n${bad} combinação(ões) compatível(is) sem ganho comprovado`);
if (failOnly && bad) process.exit(1);
