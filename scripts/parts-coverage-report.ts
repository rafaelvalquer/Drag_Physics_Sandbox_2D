import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAREER_CARS, CHAPTER1_CARS } from '../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../src/data/cars/chapter2/index';
import { TRACKS } from '../src/data/tracks/index';
import { ALL_RIVALS } from '../src/game/career/CareerEvents';
import { rivalBuild } from '../src/game/career/RivalBuildFactory';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { resolveBuild, type BuildResult } from '../src/game/career/tuning/BuildResolver';
import { familyOf, transmissionKindOf } from '../src/game/career/tuning/BuildResolverV2';
import { WORKSHOP_SLOTS, workshopSlotExclusion } from '../src/game/career/tuning/partCoverage';
import { auditPartGain, WORKSHOP_ACCELERATION_LIMIT_S, WORKSHOP_DISTANCE_M } from '../src/game/career/tuning/partGain';
import { ALL_PARTS } from '../src/game/career/tuning/parts';
import { physicalSlotOf, progressionOf } from '../src/game/career/tuning/partProgression';
import { careerResolverVersion } from '../src/game/career/tuning/resolverVersion';

const track = TRACKS.find((item) => item.id === 'test-track')!;
const args = process.argv.slice(2);
const output = args.find((arg) => !arg.startsWith('--')) ?? 'docs/workshop';
const extendedSplits = args.includes('--extended');
const classicIds = new Set(CHAPTER1_CARS.map((car) => car.id));
const leagueIds = new Set(CHAPTER2_CARS.map((car) => car.id));

function baseline(build: Extract<BuildResult, { ok: true }>) {
  const run = runAccelerationTest(build.car, track, {
    speedsKmh: [100, 200], distancesM: [WORKSHOP_DISTANCE_M],
    maxS: WORKSHOP_ACCELERATION_LIMIT_S, stopAtLastSplit: true,
  });
  const t100 = run.speedTimes.get(100) ?? null;
  const t200 = run.speedTimes.get(200) ?? null;
  return {
    resolver: build.version,
    powerCv: build.peakPowerCv,
    torqueNm: build.peakTorqueNm,
    quarterS: run.distanceTimes.get(WORKSHOP_DISTANCE_M) ?? null,
    zeroTo100S: t100,
    hundredTo200S: t100 !== null && t200 !== null ? t200 - t100 : null,
  };
}

const cars = CAREER_CARS.map((car) => {
  const classic = classicIds.has(car.id);
  const version = careerResolverVersion(car.id);
  const factory = resolveBuild(car, [], {}, version);
  if (!factory.ok) throw new Error(`${car.id}: ${factory.errors.join('; ')}`);
  const parts = ALL_PARTS.map((part) => ({
    id: part.id,
    category: part.category,
    slot: physicalSlotOf(part),
    progression: progressionOf(part, familyOf(car), car.id),
    ...auditPartGain(car, part, track, version, extendedSplits),
  }));
  const categories = WORKSHOP_SLOTS.map((slot) => {
    const reason = workshopSlotExclusion(car, slot);
    const compatible = parts.filter((part) => part.slot === slot && part.status !== 'incompatible');
    return {
      slot,
      applicable: reason === null,
      reason,
      compatibleOptions: compatible.length,
      tiers: [...new Set(compatible.flatMap((part) => part.progression ? [part.progression.tier] : []))].sort(),
      optionsWithGain: compatible.filter((part) => part.status === 'gain').length,
    };
  });
  const result = {
    id: car.id,
    name: car.name,
    chapter: classic ? 1 : leagueIds.has(car.id) ? 2 : 3,
    family: familyOf(car),
    induction: car.engine.induction,
    transmission: transmissionKindOf(car),
    drive: car.drivenAxle,
    factory: baseline(factory),
    categories,
    parts,
  };
  console.log(`${car.id}: ${parts.filter((part) => part.status === 'gain').length} upgrades com ganho`);
  return result;
});
const rivals = ALL_RIVALS.map((rival) => ({ id: rival.id, carId: rival.baseCarId, parts: rival.parts, ...baseline(rivalBuild(rival)) }));
const value = (n: number | null): string => n === null ? '—' : n.toFixed(2);
const lines = [
  '# Matriz de cobertura da oficina',
  '',
  `Distância oficial de ${WORKSHOP_DISTANCE_M.toFixed(3)} m, pista de testes e piloto avançado. Os pares de estágios são medidos separadamente no relatório de progressão.`,
  '',
  '| Carro | Cap. | Família | Resolver | cv | N·m | ¼ milha (s) | 0–100 (s) | 100–200 (s) | Categorias cobertas/aplicáveis | Compatíveis | Builds válidos¹ | Sem efeito | Sem ganho² |',
  '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
];
for (const car of cars) {
  const applicable = car.categories.filter((category) => category.applicable);
  const count = (...statuses: string[]): number => car.parts.filter((part) => statuses.includes(part.status)).length;
  const f = car.factory;
  lines.push(`| ${car.name} | ${car.chapter} | ${car.family} | ${f.resolver} | ${value(f.powerCv)} | ${value(f.torqueNm)} | ${value(f.quarterS)} | ${value(f.zeroTo100S)} | ${value(f.hundredTo200S)} | ${applicable.filter((category) => category.compatibleOptions).length}/${applicable.length} | ${car.parts.length - count('incompatible')} | ${count('gain', 'no-gain', 'no-effect', 'simulation-failed')} | ${count('no-effect')} | ${count('no-effect', 'no-gain')} |`);
}
lines.push('', '¹ Inclui builds válidos cuja simulação falhou. ² Conta pares medidos, incluindo peças sem efeito. O JSON discrimina bloqueios por dependência, builds inválidos e falhas de simulação.', '');
for (const car of cars) {
  lines.push(`## ${car.name}`, '', '| Categoria | Opções compatíveis | Com ganho | Estágios | Aplicabilidade |', '|---|---:|---:|---|---|');
  for (const category of car.categories) {
    lines.push(`| ${category.slot} | ${category.compatibleOptions} | ${category.optionsWithGain} | ${category.tiers.join(', ') || '—'} | ${category.reason ?? (category.compatibleOptions ? 'Aplicável' : 'Lacuna')} |`);
  }
  lines.push('');
}
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'parts-coverage.json'), JSON.stringify({
  distanceM: WORKSHOP_DISTANCE_M, extendedSplits, accelerationLimitS: WORKSHOP_ACCELERATION_LIMIT_S, cars, rivals,
}, null, 2) + '\n');
const gaps = cars.flatMap((car) => car.categories.filter((category) => category.applicable && category.tiers.length !== 3)
  .map((category) => `${car.id}/${category.slot}`));
const bad = cars.reduce((sum, car) => sum + car.parts.filter((part) => part.status !== 'gain' && part.status !== 'incompatible').length, 0);
if (gaps.length) console.log(`Categorias com estágios ausentes: ${gaps.join(', ')}`);
console.log(`${bad} combinações compatíveis sem ganho comprovado.`);
if (args.includes('--fail') && (gaps.length || bad)) process.exitCode = 1;
writeFileSync(join(output, 'parts-coverage.md'), lines.join('\n'));
