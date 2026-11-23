/**
 * N₂O balancing: every kit on the reference cars, with the real physics and the game's driver.
 *
 *   npx tsx scripts/nitrous-balance.ts [car-id]
 *
 * Per car and kit: time and trap speed at 201 / 402 / 1000 m with no nitro and with it (every stage),
 * the gain, the cylinder spent and the injection time. A kit that does not pay, or one that makes a
 * weak-grip car slower, shows up here.
 */
import { CAREER_CARS, findCampaignCar } from '../src/data/cars/campaign';
import { TRACKS } from '../src/data/tracks/index';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { resolveBuild } from '../src/game/career/tuning/BuildResolver';
import { NITROUS_KITS } from '../src/game/career/tuning/nitrousParts';
import { careerResolverVersion } from '../src/game/career/tuning/resolverVersion';

const REFERENCE: Record<number, string[]> = {
  1: ['fiat-uno-mille-1995', 'gm-chevette-sl-1988', 'vw-gol-gts-1988', 'vw-saveiro-gl-1994'],
  2: ['vw-golf-gti-mk4-2003', 'bmw-320i-f30-2014', 'mitsubishi-evo-x-2012'],
  3: ['nissan-350z-2006', 'nissan-370z-2014', 'kia-stinger-gt-2019', 'nissan-gtr-r35-2015'],
};
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const track = TRACKS.find((t) => t.id === 'test-track')!;
const D = [201.168, 402.336, 1000];

const fmt = (n: number | null | undefined): string => (n == null ? '  -  ' : n.toFixed(2).padStart(6));
const row = (label: string, t: (number | null)[]): string => `${label.padEnd(30)}${t.map(fmt).join(' ')}`;

for (const [ch, ids] of Object.entries(REFERENCE)) {
  for (const id of ids) {
    if (only && id !== only) continue;
    const base = findCampaignCar(id) ?? CAREER_CARS.find((c) => c.id.startsWith(id.split('-').slice(0, 2).join('-')));
    if (!base) {
      console.log(`? carro não encontrado: ${id}`);
      continue;
    }
    const version = careerResolverVersion(base.id);
    const run = (car: typeof base, nitrous: 'off' | 'all') => runAccelerationTest(car, track, { distancesM: D, speedsKmh: [100], maxS: 90, nitrous });
    const plain = run(base, 'off');
    console.log(`\n== Capítulo ${ch}: ${base.name} (${base.id}) — 201 m / 402 m / 1000 m (s)`);
    console.log(row('sem kit', D.map((d) => plain.distanceTimes.get(d) ?? null)));
    for (const kit of NITROUS_KITS) {
      for (const mode of ['single', 'dual'] as const) {
        const r = resolveBuild(base, [kit.id], mode === 'dual' ? { nitrousMode: 'dual', nitrousShare: 0.4 } : {}, version);
        if (!r.ok) {
          console.log(`${kit.id.padEnd(30)}inválido: ${r.errors[0]}`);
          continue;
        }
        const res = run(r.car, 'all');
        const t = D.map((d) => res.distanceTimes.get(d) ?? null);
        const gain = plain.distanceTimes.get(D[1]!)! - (t[1] ?? NaN);
        console.log(
          `${row(`${kit.id} ${mode}`, t)}   402 m: ${gain >= 0 ? '-' : '+'}${Math.abs(gain).toFixed(2)} s · gastou ${(res.nitrousUsedKg * 1000).toFixed(0)}/${((r.car.nitrous?.capacityKg ?? 0) * 1000).toFixed(0)} g em ${res.nitrousActiveS.toFixed(1)} s · patinação ${res.wheelspinS.toFixed(1)} s`,
        );
      }
    }
  }
}
