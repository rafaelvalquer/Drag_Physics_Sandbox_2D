import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findCareerTrack } from '../src/data/tracks/career';
import { AI_PROFILES } from '../src/game/ai/DragAI';
import { CareerController, inventoryEntry, type OpResult } from '../src/game/career/CareerController';
import { CareerRepository } from '../src/game/career/CareerRepository';
import { rivalOf, type CareerEventDef } from '../src/game/career/CareerEvents';
import { isChapterComplete, nextEvent } from '../src/game/career/CareerProgression';
import type { CareerRaceResult, RunSummary } from '../src/game/career/CareerState';
import { CHAPTERS, CHAPTER_2_ID, CHAPTER_3_ID, type ChapterId } from '../src/game/career/chapters';
import { DEALER_CARS, offerAvailability } from '../src/game/career/chapter2/dealer';
import { makeFreeEvent, type FreeEventOffer } from '../src/game/career/FreeEvents';
import { runHeadlessRace } from '../src/game/career/headlessRace';
import { ownedCarBuild, rivalBuild } from '../src/game/career/RivalBuildFactory';
import { familyOf, transmissionKindOf } from '../src/game/career/tuning/BuildResolverV2';
import { findPart, LEGACY_FAMILY } from '../src/game/career/tuning/parts';
import type { LaneResult } from '../src/game/race/RaceController';
import { MemoryStore } from '../src/storage/db';

const output = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'docs/workshop';
const starter = 'vw-gol-gts-1988';
const seed = 12_340;
const maxAttemptsPerChapter = 150;

const oldCarUpgrades = [
  'exhaust-sport', 'filter-sport', 'tires-sport', 'cam-sport', 'clutch-reinforced', 'turbo-basic',
  'tires-semislick', 'fuel-classic-regulation', 'ecu-remap',
];

function upgradeOrder(family: string, transmission: ReturnType<typeof transmissionKindOf>): string[] {
  if (family === LEGACY_FAMILY) return oldCarUpgrades;
  const driveline = transmission === 'manual' ? 'clutch-reinforced'
    : transmission === 'dual-clutch' ? 'dct-upgrade' : 'at-upgrade';
  return [
    'tires-sport', driveline, 'ecu-stage1', `intake-filter-${family}-s1`,
    `exhaust-downpipe-${family}-s1`, `exhaust-${family}-s1`, 'tires-semislick', 'intercooler-race',
    `fuel-${family}-s3`, 'pistons-forged-modern',
    'downpipe-catless', 'ecu-stage2', 'boost-control', 'ecu-programmable', 'turbo-hybrid', 'ecu-stage3',
    `exhaust-pipe-${family}-s2`, 'tires-slick', `rotating-assembly-${family}-s3`,
    `charge-cooler-${family}-s3`, `ecu-map-${family}-s3`, `factory-turbo-${family}-s3`,
    'weight-race',
  ];
}

function assertResult<T>(result: OpResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function summarize(lane: LaneResult, name: string): RunSummary {
  return {
    name, rt: lane.rt, et: lane.et, total: lane.total ?? null,
    trapKmh: lane.trapMs === null ? null : lane.trapMs * 3.6,
    redLight: lane.redLight, finished: lane.finished, dnf: lane.dnf,
  };
}

interface ChapterEconomy {
  chapter: ChapterId;
  startCr: number;
  endCr: number;
  lowestCr: number;
  partSpendCr: number;
  carSpendCr: number;
  storyWins: number;
  storyLosses: number;
  freeAttempts: number;
  freeWins: number;
  freeIncomeCr: number;
  complete: boolean;
  nextStory: string | null;
  purchases: { partId: string; model: string; price: number }[];
  cars: string[];
}

async function shop(controller: CareerController, ledger: ChapterEconomy, losses: number): Promise<void> {
  const models = ledger.chapter === CHAPTER_2_ID ? ['vw-golf-gti-mk4-2003', 'bmw-320i-f30-2014', 'mitsubishi-evo-x-2012']
    : ledger.chapter === CHAPTER_3_ID ? ['nissan-gtr-r35-2015', 'alfa-giulia-qv-2017', 'mercedes-amg-c43-2017'] : [];
  const save = controller.save!;
  const offer = models.map((model) => DEALER_CARS.find((item) => item.baseCarId === model)!)
    .find((item) => !save.ownedCars.some((owned) => owned.baseCarId === item.baseCarId) &&
      offerAvailability(save, item).ok && save.credits >= item.price + 6000);
  if (offer && losses >= 2) {
    const bought = assertResult(await controller.buyCar(offer.baseCarId));
    const id = bought.ownedCars.find((item) => item.baseCarId === offer.baseCarId)!.id;
    assertResult(await controller.setActiveCar(id));
    ledger.carSpendCr += offer.price;
    ledger.cars.push(offer.baseCarId);
    console.log(`${ledger.chapter}: comprou ${offer.baseCarId} por ${offer.price} CR`);
  }

  const car = controller.activeCar!;
  const build = ownedCarBuild(car);
  if (!build.ok) throw new Error(build.errors.join('\n'));
  const order = upgradeOrder(familyOf(build.car), transmissionKindOf(build.car));
  for (const [index, partId] of order.entries()) {
    const part = findPart(partId);
    if (!part || controller.activeCar!.installedParts.includes(partId) ||
      controller.save!.inventoryPartIds.includes(inventoryEntry(partId, car.baseCarId))) continue;
    const equipped = controller.activeCar!.installedParts.find((id) => findPart(id)?.category === part.category);
    if (equipped && order.indexOf(equipped) > index) continue;
    const result = await controller.buyPart(partId);
    if (!result.ok) continue;
    ledger.partSpendCr += part.price;
    ledger.purchases.push({ partId, model: car.baseCarId, price: part.price });
  }
  ledger.lowestCr = Math.min(ledger.lowestCr, controller.save!.credits);
}

async function race(controller: CareerController, event: CareerEventDef, serial: number, free?: FreeEventOffer) {
  const car = controller.activeCar!;
  const player = ownedCarBuild(car);
  if (!player.ok) throw new Error(player.errors.join('\n'));
  const opponent = free?.rival ?? rivalOf(event);
  const opposingBuild = rivalBuild(opponent);
  const raced = runHeadlessRace(
    { car: player.car, name: 'Jogador', profile: AI_PROFILES.advanced, seed: seed + serial * 3 },
    { car: opposingBuild.car, name: opponent.nickname, profile: opponent.skill, seed: seed + serial * 3 + 1 },
    findCareerTrack(event.trackId), event.distance, seed + serial * 3 + 2,
  );
  const [left, right] = raced.lanes;
  const outcome = left.redLight ? 'red-light' : left.dnf ? 'dnf' : raced.winner === 0 ? 'win' : 'loss';
  const entry: Omit<CareerRaceResult, 'creditsAwarded' | 'reputationAwarded'> = {
    attemptId: `economy-${serial}`, eventId: event.id, playerCarId: car.id, opponentCarId: opposingBuild.car.id,
    playerResult: summarize(left, 'Jogador'), opponentResult: summarize(right, opponent.nickname), outcome,
    completedAt: '2026-01-01T12:00:00.000Z', buildVersion: player.version,
    playerBuildKey: player.key, opponentBuildKey: opposingBuild.key,
  };
  return assertResult(free ? await controller.recordFreeRace(entry, free) : await controller.recordRace(entry));
}

const controller = new CareerController(new CareerRepository(new MemoryStore(), 'workshop-economy'));
assertResult(await controller.newCareer(starter));
const rows: ChapterEconomy[] = [];
let serial = 0;
let prizeId: string | undefined;
for (const chapter of CHAPTERS) {
  assertResult(await controller.setActiveChapter(chapter.id));
  if (prizeId) assertResult(await controller.setActiveCar(prizeId));
  const startCr = controller.save!.credits;
  const ledger: ChapterEconomy = {
    chapter: chapter.id, startCr, endCr: startCr, lowestCr: startCr, partSpendCr: 0, carSpendCr: 0,
    storyWins: 0, storyLosses: 0, freeAttempts: 0, freeWins: 0, freeIncomeCr: 0,
    complete: false, nextStory: null, purchases: [], cars: [controller.activeCar!.baseCarId],
  };
  let losses = 0;
  let freeRemaining = 0;
  let event = nextEvent(controller.save!, chapter.id);
  for (let attempt = 0; event && attempt < maxAttemptsPerChapter; attempt++) {
    await shop(controller, ledger, losses);
    if (freeRemaining > 0) {
      const offer = makeFreeEvent(chapter.id, controller.save!.freeEventRotation, 'bairro');
      const result = await race(controller, offer.event, ++serial, offer);
      ledger.freeAttempts++;
      if (result.result.outcome === 'win') ledger.freeWins++;
      ledger.freeIncomeCr += result.reward.credits;
      freeRemaining--;
      continue;
    }
    const result = await race(controller, event, ++serial);
    if (result.result.outcome === 'win') {
      ledger.storyWins++;
      losses = 0;
      prizeId = result.prizeCar?.id ?? prizeId;
      event = nextEvent(controller.save!, chapter.id);
      console.log(`${chapter.title}: ${ledger.storyWins} vitórias principais, ${ledger.freeAttempts} livres, ${controller.save!.credits} CR`);
    } else {
      ledger.storyLosses++;
      losses++;
      freeRemaining = Math.min(1 + losses, 6);
    }
  }
  ledger.endCr = controller.save!.credits;
  ledger.complete = isChapterComplete(controller.save!, chapter.id);
  ledger.nextStory = event?.id ?? null;
  rows.push(ledger);
  if (!ledger.complete) break;
}

const completed = rows.length === CHAPTERS.length && rows.every((row) => row.complete);
const markdown = [
  '# Simulação de compra e progressão da oficina',
  '',
  'Uma rota de referência com piloto avançado, Gol GTS inicial e os carros das finais disponíveis na garagem. As corridas foram simuladas com a física do jogo. O controlador da campanha gravou compras, vitórias, perdas e recompensas num save em memória.',
  '',
  'A rota tenta o próximo evento principal ainda inédito. Após uma derrota, corre eventos livres de bairro para financiar peças. Na Liga, considera Golf, 320i e Evo. Na Elite, considera GT-R, Giulia e C43. As compras de carro reservam 6.000 CR para a oficina. A execução limita cada capítulo a 150 tentativas.',
  '',
  '| Capítulo | Início CR | Final CR | Menor saldo CR | Peças CR | Carros CR | Vitórias da história | Derrotas da história | Livres ganhos / corridos | Prêmios dos livres CR | Carros usados | Concluído |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|',
  ...rows.map((row) => `| ${row.chapter} | ${row.startCr} | ${row.endCr} | ${row.lowestCr} | ${row.partSpendCr} | ${row.carSpendCr} | ${row.storyWins} | ${row.storyLosses} | ${row.freeWins} / ${row.freeAttempts} | ${row.freeIncomeCr} | ${row.cars.join(', ')} | ${row.complete ? 'Sim' : row.nextStory ?? 'Não'} |`),
  '',
  'Cada compra, o carro a que ela pertence e o valor efetivamente debitado constam no relatório JSON.',
  '',
];
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'parts-economy.md'), markdown.join('\n'));
writeFileSync(join(output, 'parts-economy.json'), JSON.stringify({ seed, starter, maxAttemptsPerChapter, completed, chapters: rows }, null, 2) + '\n');
if (process.argv.includes('--fail') && !completed) process.exitCode = 1;
