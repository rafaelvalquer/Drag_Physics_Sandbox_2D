/**
 * Balance report of chapter 2 "Liga da Madrugada". Repeatable: fixed seeds per race, DragAI
 * drivers, the game's physics and the same build resolver (version 2) for player and rivals. No
 * hidden factors: the rivals' advantage is their parts and their driving.
 *
 *   npx tsx scripts/balance-chapter2.ts               # builds + matrix + campaign
 *   npx tsx scripts/balance-chapter2.ts --builds      # only the prepared builds (plan §17)
 *   npx tsx scripts/balance-chapter2.ts --matrix      # only the race matrix
 *   npx tsx scripts/balance-chapter2.ts --campaign    # only the campaign simulation
 *   npx tsx scripts/balance-chapter2.ts --out docs/chapter2/balance-data.md
 *
 * 1. Builds: the ten cars original and Stage 1 / prepared — power, torque, boost, 0–100, 201 m,
 *    402 m, trap speed, wheelspin, shifts, compatibility.
 * 2. Matrix: every player build (and the chapter 1 Gol turbo) against the ten rivals.
 * 3. Campaign: the whole chapter from a finished chapter 1 save, buying parts and cars with a
 *    simple strategy, repeating lost events; reports races, defeats and money.
 */
import fs from 'node:fs';
import { findCampaignCar } from '../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../src/data/cars/chapter2/index';
import { findCareerTrack } from '../src/data/tracks/career';
import { TRACKS } from '../src/data/tracks/index';
import type { CarConfig } from '../src/data/schema';
import { AI_PROFILES, type AiLevel } from '../src/game/ai/DragAI';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { CHAPTER2_EVENTS, EVENTS, findRival, rivalOf } from '../src/game/career/CareerEvents';
import { isChapterComplete, isPartUnlocked, nextEvent } from '../src/game/career/CareerProgression';
import { computeReward } from '../src/game/career/CareerRewards';
import { newCareerSave, type CareerSave } from '../src/game/career/CareerState';
import { CHAPTER_2_ID } from '../src/game/career/chapters';
import { DEALER_CARS, offerAvailability, resaleValue } from '../src/game/career/chapter2/dealer';
import { rivalBuild, rivalCar } from '../src/game/career/RivalBuildFactory';
import { runHeadlessRace } from '../src/game/career/headlessRace';
import { resolveBuild, type BuildTune, type BuildResult } from '../src/game/career/tuning/BuildResolver';
import { familyOf, forEngine, incompatibility } from '../src/game/career/tuning/BuildResolverV2';
import { findPart } from '../src/game/career/tuning/parts';

const argv = process.argv.slice(2);
const has = (f: string): boolean => argv.includes(f);
const only = ['--builds', '--matrix', '--campaign'].filter(has);
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

/** Prepared builds of the plan (§17). Stage 1 is the remap (with what it needs); prepared is the full route. */
export const BUILDS: Record<string, { stage1: string[]; prepared: string[]; tune?: BuildTune; label: [string, string] }> = {
  'gm-astra-2011': { stage1: ['ecu-stage1-na'], prepared: ['filter-sport', 'exhaust-sport', 'manifold-familia2', 'cam-familia2', 'head-ported', 'pistons-high-cr', 'ecu-stage1-na', 'tires-semislick'], label: ['remap aspirado', 'aspirado preparado'] },
  'peugeot-208-gt-2017': { stage1: ['ecu-stage1'], prepared: ['ecu-stage1', 'clutch-reinforced', 'intercooler-race', 'exhaust-sport', 'tires-semislick', 'suspension-drag-fwd'], label: ['Stage 1', 'preparado'] },
  'vw-golf-gti-mk4-2003': { stage1: ['ecu-stage1', 'clutch-reinforced'], prepared: ['ecu-programmable', 'boost-control', 'intercooler-race', 'exhaust-sport', 'clutch-reinforced', 'tires-semislick', 'suspension-drag-fwd'], label: ['Stage 1', 'preparado'] },
  'audi-a3-18t-2005': { stage1: ['ecu-stage1', 'clutch-reinforced'], prepared: ['ecu-programmable', 'boost-control', 'intercooler-race', 'exhaust-sport', 'clutch-reinforced', 'tires-semislick', 'suspension-drag-fwd'], label: ['Stage 1', 'preparado'] },
  'mercedes-c200-w205-2015': { stage1: ['ecu-stage1'], prepared: ['ecu-stage1', 'at-upgrade', 'intercooler-race', 'tires-semislick', 'suspension-drag-rwd'], label: ['Stage 1', 'preparado'] },
  'bmw-320i-f30-2014': { stage1: ['ecu-stage1'], prepared: ['ecu-stage1', 'at-upgrade', 'intercooler-race', 'tires-semislick', 'suspension-drag-rwd'], label: ['Stage 1', 'preparado'] },
  'honda-civic-si-2008': { stage1: ['ecu-stage1-na'], prepared: ['filter-sport', 'exhaust-sport', 'manifold-k20-rbc', 'cam-k20', 'head-ported', 'ecu-stage1-na', 'flywheel-light-modern', 'tires-semislick'], label: ['remap aspirado', 'aspirado preparado'] },
  'vw-jetta-tsi-2012': { stage1: ['ecu-stage1'], prepared: ['ecu-stage1', 'dct-upgrade', 'intercooler-race', 'exhaust-sport', 'tires-semislick', 'suspension-drag-fwd'], label: ['Stage 1', 'preparado'] },
  'mitsubishi-evo-x-2012': { stage1: ['ecu-stage1'], prepared: ['ecu-stage1', 'intercooler-race', 'boost-control', 'dct-upgrade', 'awd-center-tune', 'tires-semislick', 'suspension-drag-awd'], label: ['Stage 1', 'preparado'] },
  'bmw-335i-f30-2013': { stage1: ['ecu-stage1'], prepared: ['ecu-programmable', 'boost-control', 'intercooler-race', 'at-upgrade', 'exhaust-sport', 'tires-slick', 'suspension-drag-rwd'], label: ['Stage 1', 'preparado'] },
};

function build(baseId: string, parts: readonly string[], tune: BuildTune = {}): Extract<BuildResult, { ok: true }> {
  const base = findCampaignCar(baseId)!;
  // classic-only parts (filter, exhaust, clutch...) become the Stage 1 of the family on modern engines
  const r = resolveBuild(base, parts.map((id) => forEngine(base, id)), tune, 2);
  if (!r.ok) throw new Error(`${baseId} [${parts.join(', ')}]: ${r.errors.join('; ')}`);
  return r;
}

/** Chapter 1 reference: the Gol GTS turbo build a player typically finishes chapter 1 with (resolver 1). */
const GOL_C1 = { id: 'vw-gol-gts-1988', parts: ['filter-sport', 'exhaust-sport', 'manifold-sport', 'cam-sport', 'tires-semislick', 'clutch-reinforced', 'turbo-basic'], tune: { boostBar: 0.6 } };
const golCar = (): CarConfig => {
  const r = resolveBuild(findCampaignCar(GOL_C1.id)!, GOL_C1.parts, GOL_C1.tune, 1);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.car;
};

// ------------------------------------------------------------------------------- 1. builds

if (want('--builds')) {
  say('# Balanceamento — Capítulo 2 (gerado por scripts/balance-chapter2.ts)');
  say();
  say('## Builds preparados (pista de testes, piloto avançado)');
  say();
  say('| carro | build | custo | cv | N·m | boost máx. | 0–100 | 201 m | 402 m | vel. 402 m | patinagem | trocas | câmbio |');
  say('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const car of CHAPTER2_CARS) {
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
  for (const ev of CHAPTER2_EVENTS) {
    const r = rivalOf(ev);
    const b = rivalBuild(r);
    say(`- ${ev.order}. ${ev.title} — ${r.name} "${r.nickname}": ${b.car.name}, ${b.peakPowerCv.toFixed(0)} cv, ${b.peakTorqueNm.toFixed(0)} N·m, ${b.car.massKg} kg, peças [${r.parts.join(', ')}], RT médio ${r.skill.reactionMeanS} s, prêmio ${ev.rewardCr} CR`);
  }
}

// ------------------------------------------------------------------------------- 2. matrix

if (want('--matrix')) {
  const skills: AiLevel[] = ['intermediate', 'advanced'];
  say();
  say('## Corridas contra os rivais (total = RT + ET, s; V = jogador vence)');
  say();
  say('Sementes: jogador 1000 + i, rival 2000 + i, corrida 3000 + i. Pista e distância do evento.');
  say();
  const header = ['carro', 'build', 'piloto', ...CHAPTER2_EVENTS.map((e) => `${e.order}`)];
  say(`| ${header.join(' | ')} |`);
  say(`|${header.map(() => '---').join('|')}|`);
  let i = 0;
  // the prize of chapter 1 (Marcos' Saveiro, handed over after the final) is a car of chapter 2 too
  const rows: { id: string; name: string; car: CarConfig }[] = [
    { id: 'vw-gol-gts-1988 (cap. 1)', name: 'turbo do cap. 1', car: golCar() },
    { id: 'vw-saveiro-gl-1994 (prêmio do cap. 1)', name: 'Saveiro do Marcos', car: rivalBuild(findRival('marcos')!).car },
  ];
  for (const car of CHAPTER2_CARS) {
    const lv = BUILDS[car.id]!;
    rows.push({ id: car.id, name: 'original', car: build(car.id, []).car });
    rows.push({ id: car.id, name: lv.label[0], car: build(car.id, lv.stage1, lv.tune).car });
    rows.push({ id: car.id, name: lv.label[1], car: build(car.id, lv.prepared, lv.tune).car });
  }
  for (const row of rows) {
    for (const sk of skills) {
      const cells: string[] = [];
      for (const ev of CHAPTER2_EVENTS) {
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

// ------------------------------------------------------------------------------- 3. campaign

/** Order in which a sensible player upgrades a car (parts that do not fit are skipped). */
const PRIORITY = [
  'ecu-stage1',
  'ecu-stage1-na',
  'tires-sport',
  'clutch-reinforced',
  'exhaust-sport',
  'filter-sport',
  'intercooler-race',
  'boost-control',
  'manifold-k20-rbc',
  'cam-k20',
  'manifold-familia2',
  'cam-familia2',
  'head-ported',
  'dct-upgrade',
  'at-upgrade',
  'suspension-drag-fwd',
  'suspension-drag-rwd',
  'suspension-drag-awd',
  'tires-semislick',
  'ecu-programmable',
  'awd-center-tune',
  'tires-slick',
];

/** Credits a sensible player keeps for the first parts when buying a car. */
const PART_RESERVE = 3000;
const MAX_RACES = 160;

interface Strategy {
  name: string;
  /** Car models the player buys, in order, when stuck and the money allows. */
  cars: string[];
}

const STRATEGIES: Strategy[] = [
  { name: 'fica com o carro do cap. 1 e compra quando trava', cars: ['vw-golf-gti-mk4-2003', 'bmw-320i-f30-2014', 'mitsubishi-evo-x-2012'] },
  { name: 'compra o 208 cedo', cars: ['peugeot-208-gt-2017', 'mercedes-c200-w205-2015', 'mitsubishi-evo-x-2012'] },
  { name: 'começa pela Astra, passa pelo Golf e pelo Civic', cars: ['gm-astra-2011', 'vw-golf-gti-mk4-2003', 'honda-civic-si-2008', 'mitsubishi-evo-x-2012'] },
];

function chapter1Done(): CareerSave {
  const s = newCareerSave();
  s.completedEventIds = EVENTS.map((e) => e.id);
  s.claimedRewardIds = EVENTS.map((e) => `${e.id}:first`);
  s.credits = 4000; // a typical end of chapter 1 after the turbo build (see balance-career.ts)
  s.reputation = 200;
  s.chapterId = CHAPTER_2_ID;
  s.unlockedChapters = ['chapter-1', CHAPTER_2_ID];
  return s;
}

if (want('--campaign')) {
  say();
  say('## Campanha simulada (início: capítulo 1 concluído, Gol turbo, 4.000 CR, 200 de reputação; limite de 160 corridas; compra só com 3.000 CR de reserva para peças; repete o evento mais bem pago que o carro atual venceu por último)');
  say();
  say('| estratégia | piloto | corridas | derrotas | repetições pagas | carros comprados | CR gastos em peças | créditos finais | concluiu | parou em |');
  say('|---|---|---:|---:|---:|---|---:|---:|---|---|');
  for (const st of STRATEGIES) {
    for (const sk of ['intermediate', 'advanced'] as AiLevel[]) {
      const save = chapter1Done();
      let carId = GOL_C1.id;
      let installed: string[] = [...GOL_C1.parts];
      let version: 1 | 2 = 1;
      const garage: string[] = [];
      let streak = 0;
      let races = 0;
      let losses = 0;
      let farmed = 0;
      let partSpend = 0;
      let stuck = '';
      const lastWin = new Map<string, string>();
      const profile = AI_PROFILES[sk];
      const nextCar = (): string | undefined => st.cars.find((id) => !garage.includes(id));
      while (!isChapterComplete(save, CHAPTER_2_ID) && races < MAX_RACES) {
        // buy the next car of the plan when stuck (or at once for the "early" strategy) and affordable
        const want2 = nextCar();
        const offer = want2 ? DEALER_CARS.find((d) => d.baseCarId === want2) : undefined;
        if (offer && offerAvailability(save, offer).ok && (streak >= 2 || (garage.length === 0 && st.cars[0] !== 'vw-golf-gti-mk4-2003'))) {
          const resale = garage.length ? resaleValue({ baseCarId: carId }) : 0;
          if (save.credits + resale >= offer.price + PART_RESERVE) {
            save.credits += resale - offer.price; // sells the previous chapter 2 car
            garage.push(offer.baseCarId);
            carId = offer.baseCarId;
            installed = [];
            version = 2;
            streak = 0;
          }
        }
        // parts in priority order, only what fits and is unlocked; saves for the next one
        if (version === 2) {
          const base = findCampaignCar(carId)!;
          for (const id of PRIORITY) {
            const p = findPart(id)!;
            if (installed.includes(id) || incompatibility(base, p) || !isPartUnlocked(save, p, familyOf(base))) continue;
            if (installed.some((x) => findPart(x)!.category === p.category && PRIORITY.indexOf(x) > PRIORITY.indexOf(id))) continue;
            const next = [...installed.filter((x) => findPart(x)!.category !== p.category), id];
            if (!resolveBuild(base, next, {}, 2).ok) continue;
            if (save.credits < p.price) break;
            save.credits -= p.price;
            partSpend += p.price;
            installed = next;
          }
        }
        const pending = nextEvent(save, CHAPTER_2_ID)!;
        const done2 = CHAPTER2_EVENTS.filter((e) => save.completedEventIds.includes(e.id));
        const farm =
          streak >= 1
            ? (done2.filter((e) => lastWin.get(e.id) === carId).sort((a, b) => b.rewardCr - a.rewardCr)[0] ?? done2[0])
            : undefined;
        const ev = farm && streak % 2 === 1 ? farm : pending;
        const car = resolveBuild(findCampaignCar(carId)!, installed, version === 1 ? GOL_C1.tune : {}, version);
        if (!car.ok) throw new Error(car.errors.join('; '));
        const r = rivalOf(ev);
        races++;
        const x = runHeadlessRace(
          { car: car.car, name: 'jogador', profile, seed: 5000 + races },
          { car: rivalCar(r.id), name: r.nickname, profile: r.skill, seed: 6000 + races },
          findCareerTrack(ev.trackId),
          ev.distance,
          7000 + races,
        );
        const p = x.lanes[0];
        const outcome = p.redLight ? 'red-light' : p.dnf ? 'dnf' : x.winner === 0 ? 'win' : 'loss';
        if (outcome === 'win') lastWin.set(ev.id, carId);
        else if (lastWin.get(ev.id) === carId) lastWin.delete(ev.id);
        const rw = computeReward(save, ev, outcome);
        save.credits += rw.credits;
        save.reputation += rw.reputation;
        if (rw.claimId) save.claimedRewardIds.push(rw.claimId);
        save.results.push({ eventId: ev.id, outcome } as CareerSave['results'][number]);
        if (ev !== pending) {
          if (outcome === 'win') farmed++;
          else losses++;
          streak++;
        } else if (outcome === 'win') {
          save.completedEventIds.push(ev.id);
          streak = 0;
        } else {
          losses++;
          streak++;
        }
        stuck = `${pending.order}. ${pending.title} (${carId}, ${installed.length} peças)`;
        if (process.env.BAL_DEBUG) console.error(races, ev.id, carId, installed.join("+"), outcome, p.total?.toFixed(2), x.lanes[1].total?.toFixed(2), p.redLight, p.dnf, save.credits);
      }
      const done = isChapterComplete(save, CHAPTER_2_ID);
      say(`| ${st.name} | ${sk} | ${races} | ${losses} | ${farmed} | ${garage.join(', ') || '—'} | ${partSpend} | ${save.credits} | ${done ? 'sim' : 'não'} | ${done ? '—' : stuck} |`);
    }
  }
}

if (outFile) fs.writeFileSync(outFile, lines.join('\n') + '\n');
