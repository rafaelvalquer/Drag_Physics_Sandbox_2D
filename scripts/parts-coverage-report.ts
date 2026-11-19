import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAREER_CARS, CHAPTER1_CARS } from '../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../src/data/cars/chapter2/index';
import type { CarConfig } from '../src/data/schema';
import { TRACKS } from '../src/data/tracks/index';
import { ALL_RIVALS } from '../src/game/career/CareerEvents';
import { rivalBuild } from '../src/game/career/RivalBuildFactory';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { resolveBuild, type BuildResult } from '../src/game/career/tuning/BuildResolver';
import { familyOf, transmissionKindOf } from '../src/game/career/tuning/BuildResolverV2';
import { auditPartGain, WORKSHOP_DISTANCE_M } from '../src/game/career/tuning/partGain';
import { ALL_PARTS, CATEGORY_ORDER, type PartCategory } from '../src/game/career/tuning/parts';
import { physicalSlotOf, physicalSlotOfCategory, progressionOf } from '../src/game/career/tuning/partProgression';
import { careerResolverVersion } from '../src/game/career/tuning/resolverVersion';

const track = TRACKS.find((item) => item.id === 'test-track')!;
const output = process.argv[2] ?? 'docs/workshop';
const classicIds = new Set(CHAPTER1_CARS.map((car) => car.id));
const leagueIds = new Set(CHAPTER2_CARS.map((car) => car.id));

const slots = [...new Set(CATEGORY_ORDER.map(physicalSlotOfCategory))];

/** Applicability is independent of whether the present catalogue happens to cover the slot. */
function notApplicable(car: CarConfig, slot: PartCategory, classic: boolean): string | null {
  if (slot === 'awd' && car.drivenAxle !== 'awd') return 'Veículo sem tração integral.';
  if ((slot === 'engine-flywheel' || slot === 'clutch') && transmissionKindOf(car) !== 'manual')
    return 'Componente de câmbio manual. A preparação compatível pertence ao slot do câmbio.';
  if (slot === 'turbo' && car.engine.induction === 'turbo') return 'Turbo de fábrica. O upgrade pertence ao slot da turbina.';
  if (!classic && car.engine.induction !== 'turbo' && ['turbo-turbine', 'turbo-intercooler', 'turbo-wastegate', 'turbo-boost'].includes(slot))
    return 'Sem turbo de fábrica. Componentes dependem de um projeto de conversão.';
  return null;
}

function baseline(build: Extract<BuildResult, { ok: true }>) {
  const run = runAccelerationTest(build.car, track, { speedsKmh: [100, 200], distancesM: [WORKSHOP_DISTANCE_M], maxS: 45 });
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
    progression: progressionOf(part),
    ...auditPartGain(car, part, track, version),
  }));
  const categories = slots.map((slot) => {
    const reason = notApplicable(car, slot, classic);
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
  `Distância oficial de ${WORKSHOP_DISTANCE_M.toFixed(3)} m, pista de testes e piloto avançado. Opções do catálogo atual ainda não representam estágios validados.`,
  '',
  '| Carro | Cap. | Família | Resolver | cv | N·m | ¼ milha (s) | 0–100 (s) | Categorias cobertas/aplicáveis | Compatíveis | Builds válidos¹ | Sem efeito | Sem ganho² |',
  '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
];
for (const car of cars) {
  const applicable = car.categories.filter((category) => category.applicable);
  const count = (...statuses: string[]): number => car.parts.filter((part) => statuses.includes(part.status)).length;
  const f = car.factory;
  lines.push(`| ${car.name} | ${car.chapter} | ${car.family} | ${f.resolver} | ${value(f.powerCv)} | ${value(f.torqueNm)} | ${value(f.quarterS)} | ${value(f.zeroTo100S)} | ${applicable.filter((category) => category.compatibleOptions).length}/${applicable.length} | ${car.parts.length - count('incompatible')} | ${count('gain', 'no-gain', 'no-effect', 'simulation-failed')} | ${count('no-effect')} | ${count('no-effect', 'no-gain')} |`);
}
lines.push('', '¹ Inclui builds válidos cuja simulação falhou. ² Conta pares medidos, incluindo peças sem efeito. O JSON discrimina bloqueios por dependência, builds inválidos e falhas de simulação.', '');
for (const car of cars) {
  lines.push(`## ${car.name}`, '', '| Categoria | Opções compatíveis | Com ganho | Aplicabilidade |', '|---|---:|---:|---|');
  for (const category of car.categories) {
    lines.push(`| ${category.slot} | ${category.compatibleOptions} | ${category.optionsWithGain} | ${category.reason ?? (category.compatibleOptions ? 'Aplicável' : 'Lacuna')} |`);
  }
  lines.push('');
}
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'parts-coverage.json'), JSON.stringify({ distanceM: WORKSHOP_DISTANCE_M, cars, rivals }, null, 2) + '\n');
writeFileSync(join(output, 'parts-coverage.md'), lines.join('\n'));
