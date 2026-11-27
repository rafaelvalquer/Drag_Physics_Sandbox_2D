/**
 * Hash of every audio channel of a fixed physics-driven render (regression of the non-turbo
 * channels). Run on the commit before Turbo Acoustics 2.0 and compared by
 * tests/unit/audio/turbo-acoustics-regression.test.ts.
 *   npx tsx scripts/audio-turbo-channel-hash.ts --out=docs/audio-turbo/before/channel-hash.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { CHANNELS } from '../src/audio/dsp/AcousticConfig';
import { fnvFloat32 as fnv, HASH_CARS, HASH_PHASES, HASH_TURBO_BUILDS, renderTurboPhysics } from '../src/audio/analysis/turboPhysics';
import { referenceTurboBuilds } from '../src/audio/analysis/turboBuilds';
import { findCar } from '../src/data/cars/index';


const out = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1] ?? 'docs/audio-turbo/before/channel-hash.json';
const res: Record<string, Record<string, string>> = {};
const cars = [...HASH_CARS.map((id) => ({ id: `${id}/stock`, car: findCar(id)! })), ...referenceTurboBuilds(HASH_TURBO_BUILDS).map((b) => ({ id: b.id, car: b.car }))];
for (const { id, car } of cars) {
  const r = renderTurboPhysics(car, 48000, { phases: HASH_PHASES, acoustic: (c) => ({ ...c, turboModel: 'legacy' }) });
  res[id] = Object.fromEntries(CHANNELS.map((c, k) => [c, fnv(r.ch[k]!)]));
  console.log(id, JSON.stringify(res[id]));
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(res, null, 1));
