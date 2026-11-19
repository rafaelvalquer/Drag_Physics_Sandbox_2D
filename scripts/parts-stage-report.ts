import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAREER_CARS } from '../src/data/cars/campaign';
import { TRACKS } from '../src/data/tracks/index';
import { familyOf, incompatibility } from '../src/game/career/tuning/BuildResolverV2';
import { auditPartStages, WORKSHOP_DISTANCE_M } from '../src/game/career/tuning/partGain';
import { physicalSlotOf, progressionOf, type PartTier } from '../src/game/career/tuning/partProgression';
import { ALL_PARTS, type PartDef } from '../src/game/career/tuning/parts';
import { careerResolverVersion } from '../src/game/career/tuning/resolverVersion';

const args = process.argv.slice(2);
const carId = args.find((arg) => arg.startsWith('--car='))?.slice('--car='.length);
const selectedGroups = new Set(args.find((arg) => arg.startsWith('--groups='))?.slice('--groups='.length).split(/[,\s]+/).filter(Boolean) ?? []);
const output = args.find((arg) => arg.startsWith('--out='))?.slice('--out='.length) ?? 'docs/workshop';
const cars = CAREER_CARS.filter((car) => !carId || car.id === carId);
if (!cars.length) throw new Error(`Carro desconhecido: ${carId}`);
const track = TRACKS.find((item) => item.id === 'test-track')!;
const tiers: PartTier[] = [1, 2, 3];
const rows = cars.flatMap((car) => {
  const groups = new Map<string, Map<PartTier, PartDef>>();
  for (const part of ALL_PARTS) {
    const progression = progressionOf(part);
    if (!progression || (selectedGroups.size && !selectedGroups.has(progression.group)) || incompatibility(car, part)) continue;
    const group = groups.get(progression.group) ?? new Map<PartTier, PartDef>();
    if (group.has(progression.tier)) throw new Error(`${car.id}: ${progression.group} tem mais de uma peça compatível no Stage ${progression.tier}.`);
    group.set(progression.tier, part);
    groups.set(progression.group, group);
  }
  return [...groups].map(([group, levels]) => {
    const stages = [...levels].sort(([a], [b]) => a - b).map(([, part]) => part);
    const contiguous = stages.filter((part, index) => progressionOf(part)!.tier === index + 1);
    return {
      carId: car.id,
      family: familyOf(car),
      group,
      slot: physicalSlotOf(stages[0]!),
      specialization: progressionOf(stages[0]!)!.specialization,
      missingTiers: tiers.filter((tier) => !levels.has(tier)),
      comparisons: auditPartStages(car, contiguous, track, careerResolverVersion(car.id)),
    };
  });
});

const delta = (before: number, after: number): string => Number.isFinite(after - before) ? (after - before).toFixed(3) : '—';
const restrictionDelta = (before: number | null, after: number | null): string =>
  before !== null && after !== null ? delta(before, after) : '—';
const markdown = [
  '# Progressão de estágios da oficina',
  '',
  `Comparações adjacentes na mesma configuração de apoio, na pista de testes a ${WORKSHOP_DISTANCE_M.toFixed(3)} m. As séries com estágio ausente ou sem contexto comum ficam explícitas.`,
  '',
  '| Carro | Família | Grupo | Antes | Depois | Δ cv | Δ N·m | Δ 0–100 s | Δ ¼ milha s | Δ admissão kPa | Δ escape kPa | Δ borboleta ms | Δ combustível g/s | Resultado |',
  '|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|',
];
for (const row of rows) {
  const prefix = `| ${row.carId} | ${row.family} | ${row.group} |`;
  if (row.missingTiers.length) markdown.push(`${prefix} — | — | — | — | — | — | — | — | — | — | Faltam stages ${row.missingTiers.join(', ')} |`);
  for (const { previous, next, audit } of row.comparisons) {
    const m = 'gain' in audit ? audit.gain : null;
    const values = m ? [
      delta(m.cvBefore, m.cvAfter),
      delta(m.torqueBeforeNm, m.torqueAfterNm),
      delta(m.t100Before, m.t100After),
      delta(m.etBefore, m.etAfter),
      restrictionDelta(m.intakeRestrictionBeforeKPa, m.intakeRestrictionAfterKPa),
      restrictionDelta(m.exhaustRestrictionBeforeKPa, m.exhaustRestrictionAfterKPa),
      delta(1000 * m.throttleBeforeS, 1000 * m.throttleAfterS),
      m.fuelCapacityBeforeKgS !== null && m.fuelCapacityAfterKgS !== null
        ? delta(1000 * m.fuelCapacityBeforeKgS, 1000 * m.fuelCapacityAfterKgS) : '—',
    ] : Array<string>(8).fill('—');
    const figures = values.join(' | ');
    markdown.push(`${prefix} ${previous ?? 'Original'} | ${next} | ${figures} | ${audit.status} |`);
  }
}
mkdirSync(output, { recursive: true });
const missingGroups = [...selectedGroups].filter((group) => !rows.some((row) => row.group === group));
if (missingGroups.length) throw new Error(`Nenhuma série compatível para: ${missingGroups.join(', ')}`);
const suffix = [carId, selectedGroups.size ? 'selection' : undefined].filter(Boolean).map((item) => `-${item}`).join('');
writeFileSync(join(output, `parts-stage${suffix}.json`), JSON.stringify({ distanceM: WORKSHOP_DISTANCE_M, rows }, null, 2) + '\n');
writeFileSync(join(output, `parts-stage${suffix}.md`), markdown.join('\n') + '\n');
const issues = rows.filter((row) => row.missingTiers.length || row.comparisons.some(({ audit }) => audit.status !== 'gain'));
console.log(`${rows.length} grupos em ${cars.length} carros. ${issues.length} grupos com lacunas, falhas ou ganhos não comprovados.`);
const uncoveredCar = !selectedGroups.size && cars.some((car) => !rows.some((row) => row.carId === car.id));
if (args.includes('--fail') && (issues.length || uncoveredCar)) process.exitCode = 1;
