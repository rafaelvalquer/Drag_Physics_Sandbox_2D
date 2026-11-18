/**
 * Career balancing report (chapter 1). Repeatable: every race has a fixed seed derived from its
 * index, the drivers are DragAI profiles, the physics is the game's.
 *
 *   npx tsx scripts/balance-career.ts            # matrix + campaign simulation
 *   npx tsx scripts/balance-career.ts --matrix   # only the matrix
 *   npx tsx scripts/balance-career.ts --campaign # only the campaign simulation
 *
 * 1. Matrix: each starter car at three build levels (original, basic, advanced) against every
 *    rival, with three player skills: power, torque, 0–100 km/h, 201/402 m, trap speed, slip,
 *    first shift point, build cost, and the race result.
 * 2. Campaign: a whole chapter played by a driver of each skill with each starter car, buying parts
 *    as they unlock and money allows (fixed priority list), repeating lost events. Reports the
 *    number of races to finish (the "grind").
 */
import { findCampaignCar } from '../src/data/cars/campaign';
import { findCareerTrack } from '../src/data/tracks/career';
import { TRACKS } from '../src/data/tracks/index';
import { AI_PROFILES, type AiLevel, type AiProfile } from '../src/game/ai/DragAI';
import { runAccelerationTest } from '../src/game/race/accelerationTest';
import { EVENTS, rivalOf } from '../src/game/career/CareerEvents';
import { isPartUnlocked, nextEvent, isChapterComplete, canTuneBoost } from '../src/game/career/CareerProgression';
import { computeReward } from '../src/game/career/CareerRewards';
import { newCareerSave, STARTER_CARS, type CareerSave } from '../src/game/career/CareerState';
import { rivalBuild, rivalCar } from '../src/game/career/RivalBuildFactory';
import { runHeadlessRace } from '../src/game/career/headlessRace';
import { resolveBuild, type BuildTune } from '../src/game/career/tuning/BuildResolver';
import { findPart } from '../src/game/career/tuning/parts';

const args = new Set(process.argv.slice(2));
const doMatrix = !args.has('--campaign');
const doCampaign = !args.has('--matrix');
const testTrack = TRACKS.find((t) => t.id === 'test-track')!;
const SKILLS: AiLevel[] = ['beginner', 'intermediate', 'advanced'];
const GOL_PRICE = STARTER_CARS.find((c) => c.baseCarId === 'vw-gol-gts-1988')!.price;

/** Build levels and the purchase priority of each starter (what a sensible player buys first). */
const LEVELS: Record<string, { basic: string[]; advanced: string[]; tune: BuildTune; priority: string[] }> = {
  'vw-gol-gts-1988': {
    basic: ['filter-sport', 'exhaust-sport', 'manifold-sport', 'tires-sport'],
    advanced: ['filter-sport', 'exhaust-sport', 'manifold-sport', 'cam-sport', 'tires-semislick', 'clutch-reinforced', 'turbo-basic'],
    tune: { boostBar: 0.6 },
    priority: ['tires-sport', 'exhaust-sport', 'filter-sport', 'manifold-sport', 'cam-sport', 'clutch-reinforced', 'tires-semislick', 'turbo-basic'],
  },
  'gm-chevette-sl-1988': {
    basic: ['filter-sport', 'exhaust-sport', 'manifold-sport', 'tires-sport'],
    advanced: ['filter-sport', 'exhaust-sport', 'manifold-sport', 'cam-sport', 'tires-semislick', 'clutch-reinforced', 'turbo-basic'],
    tune: { boostBar: 1.0 },
    priority: ['exhaust-sport', 'filter-sport', 'tires-sport', 'manifold-sport', 'cam-sport', 'clutch-reinforced', 'tires-semislick', 'turbo-basic'],
  },
  'fiat-uno-mille-1995': {
    basic: ['filter-sport', 'exhaust-sport', 'manifold-sport', 'tires-sport'],
    advanced: ['filter-sport', 'exhaust-sport', 'manifold-sport', 'cam-sport', 'tires-semislick', 'clutch-reinforced', 'differential-short', 'turbo-basic'],
    tune: { boostBar: 1.0 },
    priority: ['exhaust-sport', 'filter-sport', 'manifold-sport', 'cam-sport', 'differential-short', 'tires-sport', 'clutch-reinforced', 'turbo-basic', 'tires-semislick'],
  },
};

const cost = (parts: string[]): number => parts.reduce((a, id) => a + findPart(id)!.price, 0);
const f2 = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : v.toFixed(2));

function build(baseId: string, parts: string[], tune: BuildTune = {}) {
  const r = resolveBuild(findCampaignCar(baseId)!, parts, parts.includes('turbo-basic') ? tune : {});
  if (!r.ok) throw new Error(`${baseId}: ${r.errors.join('; ')}`);
  return r;
}

if (doMatrix) {
  console.log('# Matriz de balanceamento — Capítulo 1\n');
  console.log('Sementes: jogador 1000 + i, rival 2000 + i, corrida 3000 + i. Pista e distância do evento.\n');
  console.log('## Rivais\n');
  for (const ev of EVENTS) {
    const r = rivalOf(ev);
    const b = rivalBuild(r);
    console.log(`- ${ev.order}. ${ev.title} — ${r.name} "${r.nickname}": ${b.car.name}, ${b.peakPowerCv.toFixed(0)} cv, ${b.peakTorqueNm.toFixed(0)} N·m, peças [${r.parts.join(', ')}], RT médio ${r.skill.reactionMeanS} s`);
  }
  console.log('\n## Carros do jogador\n');
  console.log('| carro | nível | custo | cv | N·m | 0–100 | 201 m | 402 m | vel. 402 m | patinagem | 1ª troca |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const s of STARTER_CARS) {
    const lv = LEVELS[s.baseCarId]!;
    for (const [name, parts] of [['original', []], ['básico', lv.basic], ['avançado', lv.advanced]] as const) {
      const b = build(s.baseCarId, [...parts], lv.tune);
      const a = runAccelerationTest(b.car, testTrack, { speedsKmh: [100], distancesM: [201, 402], maxS: 30 });
      console.log(
        `| ${s.baseCarId} | ${name} | ${cost([...parts])} | ${b.peakPowerCv.toFixed(0)} | ${b.peakTorqueNm.toFixed(0)} | ${f2(a.speedTimes.get(100))} | ${f2(a.distanceTimes.get(201))} | ${f2(a.distanceTimes.get(402))} | — | ${a.wheelspinS.toFixed(2)} s | ${a.shifts[0]?.rpm.toFixed(0) ?? '—'} |`,
      );
    }
  }
  console.log('\n## Corridas (total = RT + ET, s; V = jogador vence)\n');
  const header = ['carro', 'nível', 'piloto', ...EVENTS.map((e) => `${e.order}`)];
  console.log(`| ${header.join(' | ')} |`);
  console.log(`|${header.map(() => '---').join('|')}|`);
  let i = 0;
  for (const s of STARTER_CARS) {
    const lv = LEVELS[s.baseCarId]!;
    for (const [name, parts] of [['original', []], ['básico', lv.basic], ['avançado', lv.advanced]] as const) {
      const car = build(s.baseCarId, [...parts], lv.tune).car;
      for (const sk of SKILLS) {
        const cells: string[] = [];
        for (const ev of EVENTS) {
          i++;
          const r = rivalOf(ev);
          const x = runHeadlessRace(
            { car, name: 'jogador', profile: AI_PROFILES[sk], seed: 1000 + i },
            { car: rivalCar(r.id), name: r.nickname, profile: r.skill, seed: 2000 + i },
            findCareerTrack(ev.trackId),
            ev.distance,
            3000 + i,
          );
          const p = x.lanes[0];
          const o = x.lanes[1];
          cells.push(`${x.winner === 0 ? 'V' : '·'} ${f2(p.total)}/${f2(o.total)}`);
        }
        console.log(`| ${s.baseCarId} | ${name} | ${sk} | ${cells.join(' | ')} |`);
      }
    }
  }
}

if (doCampaign) {
  console.log('\n## Campanha simulada (compras por prioridade, revanche até vencer, limite de 40 corridas)\n');
  console.log('| carro inicial | piloto | corridas | derrotas | repetições pagas | créditos finais | concluiu | parou em |');
  console.log('|---|---|---:|---:|---:|---:|---|---|');
  for (const s of STARTER_CARS) {
    for (const sk of SKILLS) {
      const save: CareerSave = newCareerSave();
      save.credits -= s.price;
      let baseId: string = s.baseCarId;
      let installed: string[] = [];
      let bought = new Set<string>();
      let switched = '';
      let streak = 0;
      let races = 0;
      let losses = 0;
      let farmed = 0;
      let stuck = '';
      const profile: AiProfile = AI_PROFILES[sk];
      while (!isChapterComplete(save) && races < 40) {
        const lvNow = LEVELS[baseId]!;
        const pending = lvNow.priority.filter((id) => !bought.has(id) && isPartUnlocked(save, findPart(id)!));
        // stuck with every unlocked part already on the car: buy the Gol from the classified ads
        if (streak >= 3 && pending.length === 0 && baseId !== 'vw-gol-gts-1988' && save.credits >= GOL_PRICE) {
          save.credits -= GOL_PRICE;
          baseId = 'vw-gol-gts-1988';
          installed = [];
          bought = new Set();
          switched = ` → Gol na corrida ${races + 1}`;
          streak = 0;
        }
        const plv = LEVELS[baseId]!;
        // shopping: in priority order while affordable and unlocked
        for (const id of plv.priority) {
          const p = findPart(id)!;
          if (bought.has(id) || !isPartUnlocked(save, p)) continue;
          if (save.credits < p.price) break; // save up for the next part of the list
          const next = [...installed.filter((x) => findPart(x)!.category !== p.category), id];
          const ok = resolveBuild(findCampaignCar(baseId)!, next, next.includes('turbo-basic') && canTuneBoost(save) ? plv.tune : {});
          if (!ok.ok) continue;
          save.credits -= p.price;
          bought.add(id);
          installed = next;
        }
        const wanted = plv.priority.find((id) => !bought.has(id) && isPartUnlocked(save, findPart(id)!));
        // lost and saving for a part: repeat the best-paying completed event instead (35 % prize)
        const farm =
          streak >= 1 && wanted !== undefined && save.credits < findPart(wanted)!.price
            ? [...EVENTS].filter((e) => save.completedEventIds.includes(e.id)).sort((a, b) => b.rewardCr - a.rewardCr)[0]
            : undefined;
        const ev = farm ?? nextEvent(save)!;
        const tune = installed.includes('turbo-basic') && canTuneBoost(save) ? plv.tune : {};
        const car = build(baseId, installed, tune).car;
        const r = rivalOf(ev);
        races++;
        const x = runHeadlessRace(
          { car, name: 'jogador', profile, seed: 5000 + races },
          { car: rivalCar(r.id), name: r.nickname, profile: r.skill, seed: 6000 + races },
          findCareerTrack(ev.trackId),
          ev.distance,
          7000 + races,
        );
        const p = x.lanes[0];
        const outcome = p.redLight ? 'red-light' : p.dnf ? 'dnf' : x.winner === 0 ? 'win' : 'loss';
        const rw = computeReward(save, ev, outcome);
        save.credits += rw.credits;
        save.reputation += rw.reputation;
        if (rw.claimId) save.claimedRewardIds.push(rw.claimId);
        if (farm) {
          if (outcome === 'win') farmed++;
          else losses++;
        } else if (outcome === 'win') {
          save.completedEventIds.push(ev.id);
          streak = 0;
        } else {
          losses++;
          streak++;
        }
        stuck = `${ev.order}. ${ev.title} (${installed.length} peças)`;
      }
      console.log(`| ${s.baseCarId}${switched} | ${sk} | ${races} | ${losses} | ${farmed} | ${save.credits} | ${isChapterComplete(save) ? 'sim' : 'não'} | ${isChapterComplete(save) ? '—' : stuck} |`);
    }
  }
}
