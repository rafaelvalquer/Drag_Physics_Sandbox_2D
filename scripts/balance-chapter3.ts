/**
 * Balance report of chapter 3 "Elite da Madrugada". Repeatable: fixed seeds per race, DragAI
 * drivers, the game's physics and the same build resolver (version 2) for player and rivals. No
 * hidden factors: the rivals' advantage is their car, their parts and their driving.
 *
 *   npx tsx scripts/balance-chapter3.ts               # builds + rivals + matrix
 *   npx tsx scripts/balance-chapter3.ts --builds      # only the builds and the rivals
 *   npx tsx scripts/balance-chapter3.ts --matrix      # only the race matrix
 *   npx tsx scripts/balance-chapter3.ts --out docs/chapter3/balance-data.md
 *
 * 1. Builds: the eight cars original, Stage 1 and prepared — power, torque, boost, 0–100, 201 m,
 *    402 m, trap speed, wheelspin, shifts.
 * 2. Rivals: the ten builds with power, torque, mass and parts, and the comparison of the two
 *    that return from chapter 2 (original × prepared).
 * 3. Matrix: every player build (and the best chapter 2 cars) against the ten rivals.
 */
import fs from 'node:fs';
import { findCampaignCar } from '../src/data/cars/campaign';
import { CHAPTER3_CARS } from '../src/data/cars/chapter3/index';
import { TRACKS } from '../src/data/tracks/index';
import { findCareerTrack } from '../src/data/tracks/career';
import type { CarConfig } from '../src/data/schema';
import { AI_PROFILES, type AiLevel } from '../src/game/ai/DragAI';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { CHAPTER3_EVENTS, findRival, rivalOf } from '../src/game/career/CareerEvents';
import { rivalBuild, rivalCar } from '../src/game/career/RivalBuildFactory';
import { runHeadlessRace } from '../src/game/career/headlessRace';
import { resolveBuild, type BuildResult, type BuildTune } from '../src/game/career/tuning/BuildResolver';
import { incompatibility } from '../src/game/career/tuning/BuildResolverV2';
import { findPart } from '../src/game/career/tuning/parts';

const argv = process.argv.slice(2);
const has = (f: string): boolean => argv.includes(f);
const only = ['--builds', '--matrix'].filter(has);
const want = (f: string): boolean => only.length === 0 || only.includes(f);
const outIdx = argv.indexOf('--out');
const outFile = outIdx >= 0 ? argv[outIdx + 1] : undefined;
const lines: string[] = [];
const say = (s = ''): void => {
  lines.push(s);
  console.log(s);
};

const testTrack = TRACKS.find((t) => t.id === 'test-track')!;
const f2 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : v.toFixed(2));
const cost = (parts: readonly string[]): number => parts.reduce((a, id) => a + findPart(id)!.price, 0);

/** Stage 1 is the remap (turbo cars) or the first generic upgrades (aspirated V6); prepared is the full route of the workshop. */
export const BUILDS: Record<string, { stage1: string[]; prepared: string[]; tune?: BuildTune; label: [string, string] }> = {
  'nissan-350z-2006': { stage1: ['tires-semislick', 'clutch-reinforced'], prepared: ['filter-sport', 'exhaust-sport', 'clutch-reinforced', 'tires-semislick', 'differential-short', 'weight-medium', 'flywheel-light-modern', 'suspension-drag-rwd'], label: ['pneus + embreagem', 'preparado'] },
  'lexus-is350-2015': { stage1: ['tires-semislick'], prepared: ['filter-sport', 'exhaust-sport', 'at-upgrade', 'tires-semislick', 'differential-short', 'weight-medium', 'suspension-drag-rwd'], label: ['pneus', 'preparado'] },
  'nissan-370z-2014': { stage1: ['tires-semislick', 'clutch-reinforced'], prepared: ['filter-sport', 'exhaust-sport', 'clutch-reinforced', 'tires-semislick', 'differential-short', 'weight-medium', 'flywheel-light-modern', 'suspension-drag-rwd'], label: ['pneus + embreagem', 'preparado'] },
  'mercedes-amg-c43-2017': { stage1: ['ecu-stage1'], prepared: ['ecu-stage2', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'at-upgrade', 'tires-semislick', 'awd-center-tune', 'suspension-drag-awd'], label: ['Stage 1', 'Stage 2 preparado'] },
  'kia-stinger-gt-2019': { stage1: ['ecu-stage1'], prepared: ['ecu-stage2', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'at-upgrade', 'tires-semislick', 'awd-center-tune', 'suspension-drag-awd'], label: ['Stage 1', 'Stage 2 preparado'] },
  'maserati-ghibli-sq4-2015': { stage1: ['ecu-stage1'], prepared: ['ecu-stage2', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'at-upgrade', 'tires-semislick', 'awd-center-tune', 'suspension-drag-awd'], label: ['Stage 1', 'Stage 2 preparado'] },
  'alfa-giulia-qv-2017': { stage1: ['ecu-stage1'], prepared: ['ecu-stage2', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'at-upgrade', 'tires-slick', 'suspension-drag-rwd'], label: ['Stage 1', 'Stage 2 preparado'] },
  'nissan-gtr-r35-2015': { stage1: ['ecu-stage1'], prepared: ['ecu-stage2', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'dct-upgrade', 'tires-slick', 'awd-center-tune', 'suspension-drag-awd'], label: ['Stage 1', 'Stage 2 preparado'] },
};

/** The best of chapter 2 a player may arrive with (resolver 2). */
const CH2_BEST: Record<string, { parts: string[]; label: string }> = {
  'mitsubishi-evo-x-2012': { parts: ['ecu-stage1', 'intercooler-race', 'boost-control', 'dct-upgrade', 'awd-center-tune', 'tires-semislick', 'suspension-drag-awd'], label: 'Evo X preparado (cap. 2)' },
  'bmw-335i-f30-2013': { parts: ['ecu-stage1', 'at-upgrade', 'tires-semislick', 'suspension-drag-rwd'], label: '335i do Victor (prêmio do cap. 2)' },
};

function build(baseId: string, parts: readonly string[], tune: BuildTune = {}): Extract<BuildResult, { ok: true }> {
  const base = findCampaignCar(baseId)!;
  const r = resolveBuild(base, parts, tune, 2);
  if (!r.ok) throw new Error(`${baseId} [${parts.join(', ')}]: ${r.errors.join('; ')}`);
  return r;
}

if (want('--builds')) {
  say('# Balanceamento — Capítulo 3 (gerado por scripts/balance-chapter3.ts)');
  say();
  say('## Builds (pista de testes, piloto avançado)');
  say();
  say('| carro | build | custo | cv | N·m | boost máx. | 0–100 | 201 m | 402 m | vel. 402 m | patinagem | trocas | câmbio |');
  say('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const car of CHAPTER3_CARS) {
    const lv = BUILDS[car.id]!;
    for (const [name, parts] of [['original', []], [lv.label[0], lv.stage1], [lv.label[1], lv.prepared]] as const) {
      for (const id of parts) {
        const bad = incompatibility(car, findPart(id)!);
        if (bad) throw new Error(`${car.id}: ${bad}`);
      }
      const b = build(car.id, parts, lv.tune);
      const a = runAccelerationTest(b.car, testTrack, { speedsKmh: [100], distancesM: [201, 402], maxS: 40 });
      const boost = b.steadyBoostBar.length ? `${f2(Math.max(...b.steadyBoostBar.map((x) => x.bar)))} bar` : '—';
      say(
        `| ${car.id} | ${name} | ${cost(parts)} | ${b.peakPowerCv.toFixed(0)} | ${b.peakTorqueNm.toFixed(0)} | ${boost} | ${f2(a.speedTimes.get(100))} | ${f2(a.distanceTimes.get(201))} | ${f2(a.distanceTimes.get(402))} | ${a.topSpeedKmh.toFixed(0)} km/h | ${a.wheelspinS.toFixed(2)} s | ${a.shifts.length} | ${b.car.transmission.kind ?? 'manual'} |`,
      );
    }
  }
  say();
  say('## Rivais');
  say();
  for (const ev of CHAPTER3_EVENTS) {
    const r = rivalOf(ev);
    const b = rivalBuild(r);
    const stock = build(r.baseCarId, []);
    const a = runAccelerationTest(b.car, testTrack, { speedsKmh: [100], distancesM: [402], maxS: 40 });
    say(
      `- ${ev.order}. ${ev.title} — ${r.name} "${r.nickname}": ${b.car.name}, ${b.peakPowerCv.toFixed(0)} cv, ${b.peakTorqueNm.toFixed(0)} N·m, ${b.car.massKg} kg, 0–100 ${f2(a.speedTimes.get(100))} s, 402 m ${f2(a.distanceTimes.get(402))} s, peças [${r.parts.join(', ') || 'original'}], RT médio ${r.skill.reactionMeanS} s, prêmio ${ev.rewardCr} CR${r.parts.length ? ` — original: ${stock.peakPowerCv.toFixed(0)} cv, ${stock.peakTorqueNm.toFixed(0)} N·m` : ''}`,
    );
  }
}

if (want('--matrix')) {
  const skills: AiLevel[] = ['intermediate', 'advanced'];
  say();
  say('## Corridas contra os rivais (total = RT + ET, s; V = jogador vence)');
  say();
  say('Sementes: jogador 1000 + i, rival 2000 + i, corrida 3000 + i. Pista e distância do evento.');
  say();
  const header = ['carro', 'build', 'piloto', ...CHAPTER3_EVENTS.map((e) => `${e.order}`)];
  say(`| ${header.join(' | ')} |`);
  say(`|${header.map(() => '---').join('|')}|`);
  let i = 0;
  const rows: { id: string; name: string; car: CarConfig }[] = [];
  for (const [id, b] of Object.entries(CH2_BEST)) rows.push({ id, name: b.label, car: build(id, b.parts).car });
  rows.push({ id: 'vw-saveiro-gl-1994', name: 'Saveiro do Marcos (prêmio do cap. 1)', car: rivalBuild(findRival('marcos')!).car });
  for (const car of CHAPTER3_CARS) {
    const lv = BUILDS[car.id]!;
    rows.push({ id: car.id, name: 'original', car: build(car.id, []).car });
    rows.push({ id: car.id, name: lv.label[0], car: build(car.id, lv.stage1, lv.tune).car });
    rows.push({ id: car.id, name: lv.label[1], car: build(car.id, lv.prepared, lv.tune).car });
  }
  for (const row of rows) {
    for (const sk of skills) {
      const cells: string[] = [];
      for (const ev of CHAPTER3_EVENTS) {
        i++;
        const r = rivalOf(ev);
        const x = runHeadlessRace(
          { car: row.car, name: 'jogador', profile: AI_PROFILES[sk], seed: 1000 + i },
          { car: rivalCar(r.id), name: r.nickname, profile: r.skill, seed: 2000 + i },
          findCareerTrack(ev.trackId),
          ev.distance,
          3000 + i,
        );
        cells.push(`${x.winner === 0 ? 'V' : '·'} ${f2(x.lanes[0].total)}/${f2(x.lanes[1].total)}`);
      }
      say(`| ${row.id} | ${row.name} | ${sk} | ${cells.join(' | ')} |`);
    }
  }
}

if (outFile) fs.writeFileSync(outFile, lines.join('\n') + '\n');
