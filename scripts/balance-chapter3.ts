/**
 * Balance report of chapter 3 "Elite da Madrugada". Repeatable: fixed seeds per race, DragAI
 * drivers, the game's physics and the same build resolver (version 2) for player and rivals. No
 * hidden factors: the rivals' advantage is their car, their parts, their dyno tune and their
 * driving. Nothing in this script changes a save: every car is resolved from the catalogue.
 *
 *   npx tsx scripts/balance-chapter3.ts               # builds + rivals + matrix
 *   npx tsx scripts/balance-chapter3.ts --builds      # only the builds and the rivals
 *   npx tsx scripts/balance-chapter3.ts --matrix      # only the race matrix
 *   npx tsx scripts/balance-chapter3.ts --seeds 5     # seeds per duel (default 3)
 *   npx tsx scripts/balance-chapter3.ts --out docs/chapter3/balance-data.md
 *
 * 1. Builds: reference cars (335i original/Stage 1/2/3, prepared Evo and Golf, prepared 350Z, 370Z,
 *    C 43, Ghibli, Giulia, GT-R) plus the chapter cars original/Stage 1/prepared: power, torque,
 *    weight, parts, boost, 0–100, 201 m, 402 m, 1000 m, trap speed, wheelspin, shifts.
 * 2. Rivals: the ten builds with the resolved power, torque, weight, parts and tune.
 * 3. Matrix: every reference car against the ten rivals with three pilots (intermediate, advanced
 *    and a human-like one) and several seeds: wins per duel, mean RT, 201/402/1000 m, trap speed,
 *    shifts, wheelspin, DNF.
 */
import fs from 'node:fs';
import { findCampaignCar } from '../src/data/cars/campaign';
import { CHAPTER3_CARS } from '../src/data/cars/chapter3/index';
import { TRACKS } from '../src/data/tracks/index';
import { findCareerTrack } from '../src/data/tracks/career';
import type { CarConfig } from '../src/data/schema';
import { AI_PROFILES, type AiProfile } from '../src/game/ai/DragAI';
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
const seedIdx = argv.indexOf('--seeds');
const SEEDS = seedIdx >= 0 ? Math.max(1, Number(argv[seedIdx + 1]) || 3) : 3;
const lines: string[] = [];
const say = (s = ''): void => {
  lines.push(s);
  console.log(s);
};

const testTrack = TRACKS.find((t) => t.id === 'test-track')!;
const f2 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : v.toFixed(2));
const cost = (parts: readonly string[]): number => parts.reduce((a, id) => a + findPart(id)!.price, 0);

const V6 = ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na'];
const S2 = ['ecu-stage2', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern'];
const S3 = ['ecu-stage3', 'turbo-hybrid', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern'];

/** Stage 1 is the remap (turbo cars) or the first generic upgrades (aspirated V6); prepared is the full route of the workshop. */
export const BUILDS: Record<string, { stage1: string[]; prepared: string[]; tune?: BuildTune; label: [string, string] }> = {
  'nissan-350z-2006': { stage1: ['tires-semislick', 'clutch-reinforced'], prepared: [...V6, 'cam-vq35-s1', 'clutch-reinforced', 'tires-slick', 'differential-short', 'weight-medium', 'flywheel-light-modern', 'suspension-drag-rwd'], label: ['pneus + embreagem', 'preparado'] },
  'lexus-is350-2015': { stage1: ['tires-semislick'], prepared: [...V6, 'at-upgrade', 'tires-slick', 'differential-short', 'weight-medium', 'suspension-drag-rwd'], label: ['pneus', 'preparado'] },
  'nissan-370z-2014': { stage1: ['tires-semislick', 'clutch-reinforced'], prepared: [...V6, 'cam-vq37-s1', 'clutch-reinforced', 'tires-slick', 'differential-short', 'weight-medium', 'flywheel-light-modern', 'suspension-drag-rwd'], label: ['pneus + embreagem', 'preparado'] },
  'mercedes-amg-c43-2017': { stage1: ['ecu-stage1'], prepared: [...S2, 'at-upgrade', 'tires-slick', 'awd-center-tune', 'suspension-drag-awd'], label: ['Stage 1', 'Stage 2 preparado'] },
  'kia-stinger-gt-2019': { stage1: ['ecu-stage1'], prepared: [...S2, 'at-upgrade', 'tires-slick', 'awd-center-tune', 'suspension-drag-awd'], label: ['Stage 1', 'Stage 2 preparado'] },
  'maserati-ghibli-sq4-2015': { stage1: ['ecu-stage1'], prepared: [...S2, 'at-upgrade', 'tires-slick', 'awd-center-tune', 'suspension-drag-awd'], label: ['Stage 1', 'Stage 2 preparado'] },
  'alfa-giulia-qv-2017': { stage1: ['ecu-stage1'], prepared: [...S2, 'at-upgrade', 'tires-slick', 'suspension-drag-rwd'], label: ['Stage 1', 'Stage 2 preparado'] },
  'nissan-gtr-r35-2015': { stage1: ['ecu-stage1'], prepared: [...S2, 'dct-upgrade', 'tires-slick', 'awd-center-tune', 'suspension-drag-awd'], label: ['Stage 1', 'Stage 2 preparado'] },
};

/** Cars the player may arrive with that are not chapter 3 cars (chapter 2 cars, the 335i levels, the Golf). */
const REFERENCE: { id: string; name: string; parts: string[] }[] = [
  { id: 'bmw-335i-f30-2013', name: '335i original', parts: [] },
  { id: 'bmw-335i-f30-2013', name: '335i Stage 1', parts: ['ecu-stage1', 'at-upgrade', 'tires-semislick', 'suspension-drag-rwd'] },
  { id: 'bmw-335i-f30-2013', name: '335i Stage 2', parts: [...S2, 'at-upgrade', 'tires-slick', 'suspension-drag-rwd', 'weight-medium'] },
  { id: 'bmw-335i-f30-2013', name: '335i Stage 3', parts: [...S3, 'at-upgrade', 'tires-slick', 'suspension-drag-rwd', 'weight-medium'] },
  { id: 'mitsubishi-evo-x-2012', name: 'Evo X preparado (cap. 2)', parts: ['ecu-stage1', 'intercooler-race', 'boost-control', 'dct-upgrade', 'awd-center-tune', 'tires-semislick', 'suspension-drag-awd'] },
  { id: 'mitsubishi-evo-x-2012', name: 'Evo X Stage 3', parts: [...S3, 'dct-upgrade', 'awd-center-tune', 'tires-slick', 'suspension-drag-awd'] },
  { id: 'vw-golf-gti-mk4-2003', name: 'Golf GTI preparado', parts: ['ecu-stage2', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'clutch-reinforced', 'tires-slick', 'suspension-drag-fwd', 'weight-medium', 'flywheel-light-modern', 'differential-short'] },
];

/** Three drivers for the player: a middling one, the AI's best, and a human-like one (late reaction, sloppier shifts and traction). */
const PILOTS: { name: string; profile: AiProfile }[] = [
  { name: 'intermediário', profile: AI_PROFILES.intermediate },
  { name: 'avançado', profile: AI_PROFILES.advanced },
  { name: 'humano', profile: { reactionMeanS: 0.22, reactionJitterS: 0.045, traction: { slipFraction: 1.4, forceFraction: 0.92, trimGain: 2.5, updateHz: 30 }, shiftOffsetRpm: -120, shiftJitterRpm: 90, jumpStartChance: 0 } },
];

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
  say('| carro | build | custo (CR) | cv | N·m | massa (kg) | peças | boost máx. | 0–100 | 201 m | 402 m | 1000 m | vel. 402 m | patinagem | trocas | câmbio |');
  say('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  const row = (id: string, name: string, parts: readonly string[], tune?: BuildTune): void => {
    const car = findCampaignCar(id)!;
    for (const p of parts) {
      const bad = incompatibility(car, findPart(p)!);
      if (bad) throw new Error(`${id}: ${bad}`);
    }
    const b = build(id, parts, tune);
    const a = runAccelerationTest(b.car, testTrack, { speedsKmh: [100], distancesM: [201, 402, 1000], maxS: 70 });
    const boost = b.steadyBoostBar.length ? `${f2(Math.max(...b.steadyBoostBar.map((x) => x.bar)))} bar` : '—';
    say(
      `| ${id} | ${name} | ${cost(parts)} | ${b.peakPowerCv.toFixed(0)} | ${b.peakTorqueNm.toFixed(0)} | ${b.car.massKg.toFixed(0)} | ${parts.length} | ${boost} | ${f2(a.speedTimes.get(100))} | ${f2(a.distanceTimes.get(201))} | ${f2(a.distanceTimes.get(402))} | ${f2(a.distanceTimes.get(1000))} | ${a.topSpeedKmh.toFixed(0)} km/h | ${a.wheelspinS.toFixed(2)} s | ${a.shifts.length} | ${b.car.transmission.kind ?? 'manual'} |`,
    );
  };
  for (const r of REFERENCE) row(r.id, r.name, r.parts);
  for (const car of CHAPTER3_CARS) {
    const lv = BUILDS[car.id]!;
    row(car.id, 'original', []);
    row(car.id, lv.label[0], lv.stage1, lv.tune);
    row(car.id, lv.label[1], lv.prepared, lv.tune);
  }
  say();
  say('## Rivais');
  say();
  say('| # | Duelo | Distância | Rival | Carro | cv | N·m | kg | 0–100 | 201 m | 402 m | 1000 m | RT médio | Prêmio (CR) | Original (cv / N·m) |');
  say('|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const ev of CHAPTER3_EVENTS) {
    const r = rivalOf(ev);
    const b = rivalBuild(r);
    const stock = build(r.baseCarId, []);
    const a = runAccelerationTest(b.car, testTrack, { speedsKmh: [100], distancesM: [201, 402, 1000], maxS: 70 });
    say(
      `| ${ev.order} | ${ev.title} | ${ev.distance} | ${r.name} "${r.nickname}" | ${b.car.name} | ${b.peakPowerCv.toFixed(0)} | ${b.peakTorqueNm.toFixed(0)} | ${b.car.massKg} | ${f2(a.speedTimes.get(100))} | ${f2(a.distanceTimes.get(201))} | ${f2(a.distanceTimes.get(402))} | ${f2(a.distanceTimes.get(1000))} | ${r.skill.reactionMeanS} s | ${ev.rewardCr} | ${stock.peakPowerCv.toFixed(0)} / ${stock.peakTorqueNm.toFixed(0)} |`,
    );
    say(`|   | peças | | | ${r.parts.join(', ') || 'original'}${r.tune ? `; ajuste: ${JSON.stringify(r.tune)}` : ''} | | | | | | | | | | |`);
  }
}

if (want('--matrix')) {
  say();
  say(`## Corridas contra os rivais (${SEEDS} sementes por duelo; célula = vitórias do jogador / ${SEEDS})`);
  say();
  say('Sementes: jogador 1000 + i, rival 2000 + i, corrida 3000 + i. Pista e distância do evento; o piloto humano tem reação 0,22 s, trocas ±90 rpm e controle de tração mais frouxo.');
  say();
  const header = ['carro', 'build', 'piloto', ...CHAPTER3_EVENTS.map((e) => `${e.order}`), 'vitórias'];
  say(`| ${header.join(' | ')} |`);
  say(`|${header.map(() => '---').join('|')}|`);
  const rows: { id: string; name: string; car: CarConfig }[] = [];
  for (const r of REFERENCE) rows.push({ id: r.id, name: r.name, car: build(r.id, r.parts).car });
  rows.push({ id: 'vw-saveiro-gl-1994', name: 'Saveiro do Marcos (prêmio do cap. 1)', car: rivalBuild(findRival('marcos')!).car });
  for (const car of CHAPTER3_CARS) {
    const lv = BUILDS[car.id]!;
    rows.push({ id: car.id, name: 'original', car: build(car.id, []).car });
    rows.push({ id: car.id, name: lv.label[1], car: build(car.id, lv.prepared, lv.tune).car });
  }
  const detail: string[] = [];
  for (const row of rows) {
    for (const pilot of PILOTS) {
      const cells: string[] = [];
      let total = 0;
      for (const ev of CHAPTER3_EVENTS) {
        const r = rivalOf(ev);
        let wins = 0;
        let rt = 0;
        let t201 = 0;
        let t402 = 0;
        let tEnd = 0;
        let trap = 0;
        let dnf = 0;
        for (let s = 0; s < SEEDS; s++) {
          const x = runHeadlessRace(
            { car: row.car, name: 'jogador', profile: pilot.profile, seed: 1000 + s },
            { car: rivalCar(r.id), name: r.nickname, profile: r.skill, seed: 2000 + s },
            findCareerTrack(ev.trackId),
            ev.distance,
            3000 + s,
          );
          if (x.winner === 0) wins++;
          const p = x.lanes[0];
          rt += p.rt ?? 0;
          t201 += p.splits.eighth ?? 0;
          t402 += p.splits.quarter ?? 0;
          tEnd += p.et ?? 0;
          trap += (p.trapMs ?? 0) * 3.6;
          if (p.dnf) dnf++;
        }
        total += wins;
        cells.push(`${wins}`);
        if (pilot.name === 'humano') {
          const n = SEEDS;
          detail.push(`| ${row.name} | ${ev.order} | ${wins}/${n} | ${f2(rt / n)} | ${f2(t201 / n)} | ${f2(t402 / n)} | ${ev.distance === 'km' ? f2(tEnd / n) : '—'} | ${(trap / n).toFixed(0)} | ${dnf} |`);
        }
      }
      say(`| ${row.id} | ${row.name} | ${pilot.name} | ${cells.join(' | ')} | ${total} |`);
    }
  }
  say();
  say('### Detalhe do piloto humano (médias das sementes)');
  say();
  say('| carro | duelo | vitórias | RT | 201 m | 402 m | 1000 m | vel. final (km/h) | DNF |');
  say('|---|---|---|---:|---:|---:|---:|---:|---:|');
  for (const l of detail) say(l);
}

if (outFile) fs.writeFileSync(outFile, lines.join('\n') + '\n');
