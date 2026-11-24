/**
 * N₂O balancing: every kit on the reference cars, with the real physics and the game's driver.
 *
 *   npx tsx scripts/nitrous-balance.ts [car-id]
 *
 * Compare the same kit and cylinder at four flows with continuous and strategic use.
 */
import { CAREER_CARS, findCampaignCar } from '../src/data/cars/campaign';
import { TRACKS } from '../src/data/tracks/index';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { resolveBuild } from '../src/game/career/tuning/BuildResolver';
import { NITROUS_KITS } from '../src/game/career/tuning/nitrousParts';
import { careerResolverVersion } from '../src/game/career/tuning/resolverVersion';
import { failureSpecFor } from '../src/game/career/tuning/TuningCapabilities';

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
    const run = (car: typeof base, nitrous: 'off' | 'continuous' | 'strategic', parts: string[] = []) =>
      runAccelerationTest(car, track, {
        distancesM: D, speedsKmh: [], maxS: 90, stopAtLastSplit: true, nitrous,
        failureSpec: failureSpecFor(base, parts, version) ?? undefined,
      });
    const plain = run(base, 'off');
    console.log(`\n== Capítulo ${ch}: ${base.name} (${base.id}) — 201 m / 402 m / 1000 m (s)`);
    console.log(row('sem kit', D.map((d) => plain.distanceTimes.get(d) ?? null)));
    for (const kit of NITROUS_KITS) {
      const parts = [kit.id];
      const reference = resolveBuild(base, parts, {}, version);
      if (!reference.ok) {
        console.log(`${kit.id.padEnd(30)}inválido: ${reference.errors[0]}`);
        continue;
      }
      const report = (label: string, result: ReturnType<typeof run>): void => {
        const times = D.map((d) => result.distanceTimes.get(d) ?? null);
        const traps = D.map((d) => fmt(result.distanceSpeedsKmh.get(d))).join(' / ');
        console.log(`${row(label, times)} · km/h ${traps} · ${(result.nitrousUsedKg * 1000).toFixed(1)} g / ${result.nitrousActiveS.toFixed(2)} s · +${result.nitrousPeakPowerCv.toFixed(1)} cv / +${result.nitrousPeakTorqueNm.toFixed(1)} N·m · patinação ${result.wheelspinS.toFixed(2)} s · ${result.engineFailed ? 'quebra' : 'sem quebra'}`);
      };
      report(`${kit.id} desligado`, run(reference.car, 'off', parts));
      for (const flow of [0.25, 0.5, 0.75, 1]) {
        const build = resolveBuild(base, parts, { nitrousFlow: flow }, version);
        if (!build.ok) throw new Error(build.errors.join(', '));
        for (const mode of ['continuous', 'strategic'] as const) {
          report(`${kit.id} ${flow * 100}% ${mode}`, run(build.car, mode, parts));
        }
      }
    }
  }
}
