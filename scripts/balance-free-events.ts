import { Prng } from '../src/core/prng';
import { findCareerTrack } from '../src/data/tracks/career';
import { AI_PROFILES } from '../src/game/ai/DragAI';
import { ALL_EVENTS, eventsOf } from '../src/game/career/CareerEvents';
import { CHAPTER_IDS } from '../src/game/career/chapters';
import { runHeadlessRace } from '../src/game/career/headlessRace';
import { generateFreeBuild, stockFreeBuild } from '../src/game/career/freeEvents/FreeBuildGenerator';
import { FREE_CARS, FREE_CLASS_GATES, freeDistances, freeSeed } from '../src/game/career/freeEvents/FreeEventCatalog';
import { estimateFreeTime, freePerformanceBand } from '../src/game/career/freeEvents/FreeEventDifficulty';
import { generateFreeOpponent } from '../src/game/career/freeEvents/FreeOpponentGenerator';
import { resolveFreeOpponent } from '../src/game/career/freeEvents/FreeEventService';
import { FREE_TIERS } from '../src/game/career/freeEvents/FreeEventTypes';
import { resolveBuild } from '../src/game/career/tuning/BuildResolver';

const sampleSize = Number(process.argv[2] ?? 16);
if (!Number.isInteger(sampleSize) || sampleSize < 2) throw new Error('Informe pelo menos duas sementes por combinação.');
const chapterFilter = process.argv.find((arg) => arg.startsWith('--chapter='))?.slice('--chapter='.length);
if (chapterFilter && !CHAPTER_IDS.some((chapter) => chapter === chapterFilter)) throw new Error('Capítulo desconhecido.');
const full = { completedEventIds: ALL_EVENTS.map((e) => e.id) };
const mean = (values: number[]) => values.reduce((sum, n) => sum + n, 0) / Math.max(1, values.length);
const distribution = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map((v) => [v, values.filter((x) => x === v).length]));

for (const chapter of process.argv.includes('--farm-only') ? [] : CHAPTER_IDS.filter((id) => !chapterFilter || id === chapterFilter)) {
  const bases = FREE_CARS[chapter];
  const earlier = CHAPTER_IDS.slice(0, CHAPTER_IDS.indexOf(chapter)).flatMap((id) => [...eventsOf(id)]);
  for (const tier of FREE_TIERS) {
    const gate = FREE_CLASS_GATES[chapter][tier];
    const progress = { completedEventIds: [...earlier, ...eventsOf(chapter).slice(0, gate)].map((e) => e.id) };
    for (const distance of freeDistances(chapter)) {
      const estimated: number[] = [];
      const actual: number[] = [];
      const power: number[] = [];
      const torque: number[] = [];
      const models: string[] = [];
      const preparations: string[] = [];
      let winsStock = 0, winsPrepared = 0, completed = 0;
      let credits = 0, gainPerMinuteStock = 0, gainPerMinutePrepared = 0;
      let error = 0, inBand = 0, eligibleStock = 0, eligiblePrepared = 0;
      const [fast, slow] = freePerformanceBand(chapter, distance, tier);
      const samples = Math.max(sampleSize, bases.length * 2);
      for (let i = 0; i < samples; i++) {
        const seed = freeSeed(`${chapter}/${tier}/${distance}/${i}`);
        const offer = generateFreeOpponent(chapter, tier, distance, 0, i + 1, seed, i % 2 ? full : progress);
        const rival = offer && resolveFreeOpponent(offer);
        if (!offer || !rival?.ok) throw new Error(`Oferta inválida para ${chapter}/${tier}/${distance}/${seed}`);
        const track = findCareerTrack(offer.trackId);
        const base = bases[Math.floor(i / 2) % bases.length]!;
        const prepared = i % 2 !== 0;
        const player = prepared ? generateFreeBuild(base, chapter, 'preparado', full, new Prng(seed)).resolved : stockFreeBuild(base).resolved;
        const race = runHeadlessRace(
          { car: player.car, name: 'Jogador', profile: AI_PROFILES.advanced, seed: seed + 1 },
          { car: rival.car, name: 'Rival', profile: offer.opponent.skill, seed: seed + 2 }, track, distance, seed,
        );
        const playerEstimate = estimateFreeTime(player, track, distance);
        const eligible = tier === 'competicao' || playerEstimate >= fast - Math.max(0.65, fast * 0.065);
        if (eligible && prepared) eligiblePrepared++;
        if (eligible && !prepared) eligibleStock++;
        if (eligible && race.winner === 0 && !race.lanes[0].redLight && !race.lanes[0].dnf) {
          if (prepared) { winsPrepared++; gainPerMinutePrepared += offer.rewardCr * 60 / (race.lanes[0].total ?? 60); }
          else { winsStock++; gainPerMinuteStock += offer.rewardCr * 60 / (race.lanes[0].total ?? 60); }
        }
        estimated.push(offer.estimatedS);
        if (offer.estimatedS >= fast && offer.estimatedS <= slow) inBand++;
        if (race.lanes[1].total != null && !race.lanes[1].redLight) {
          completed++;
          actual.push(race.lanes[1].total);
          error += Math.abs(race.lanes[1].total - offer.estimatedS);
        }
        power.push(rival.peakPowerCv);
        torque.push(rival.peakTorqueNm);
        credits = offer.rewardCr;
        models.push(rival.car.id);
        preparations.push(offer.preparation);
      }
      console.log(JSON.stringify({
        chapter, tier, distance, samples, validBuilds: samples, inBand,
        powerCv: mean(power).toFixed(1), torqueNm: mean(torque).toFixed(1), estimateS: mean(estimated).toFixed(2),
        raceS: mean(actual).toFixed(2), meanAbsoluteErrorS: (error / Math.max(1, completed)).toFixed(2), completed,
        winsStock, winsPrepared, eligibleStock, eligiblePrepared, creditsPerWin: credits,
        averageCreditsPerRaceMinuteStock: (gainPerMinuteStock / Math.max(1, eligibleStock)).toFixed(0),
        averageCreditsPerRaceMinutePrepared: (gainPerMinutePrepared / Math.max(1, eligiblePrepared)).toFixed(0),
        models: distribution(models), preparations: distribution(preparations),
      }));
    }
  }
}

const chapter = 'chapter-1';
const progress = { completedEventIds: eventsOf(chapter).slice(0, 4).map((e) => e.id) };
const chevette = FREE_CARS[chapter].find((car) => car.id === 'gm-chevette-sl-1988')!;
const uno = FREE_CARS[chapter].find((car) => car.id === 'fiat-uno-mille-1995')!;
const gol = FREE_CARS[chapter].find((car) => car.id === 'vw-gol-gts-1988')!;
const aspiratedParts = ['filter-sport', 'exhaust-sport', 'cam-sport', 'tires-sport'];
const profiles = [
  ['Chevette original', chevette, []], ['Chevette aspirado', chevette, aspiratedParts],
  ['Uno aspirado', uno, aspiratedParts], ['Gol original', gol, []], ['Gol aspirado', gol, aspiratedParts],
] as const;
const farmOffers = Array.from({ length: sampleSize }, (_, i) => {
  const seed = freeSeed(`farm/quarter/${i}`);
  return { seed, offer: generateFreeOpponent(chapter, 'preparado', 'quarter', 0, i + 1, seed, progress)! };
});
let chevetteWins = 0;
for (const [name, base, parts] of profiles) {
  const player = resolveBuild(base, parts, {}, 1);
  if (!player.ok) throw new Error(`${name}: ${player.errors.join(', ')}`);
  let wins = 0;
  let attempts = 0;
  let prize = 0;
  for (const { seed, offer } of farmOffers) {
    const rival = resolveFreeOpponent(offer);
    if (!rival?.ok) throw new Error('Rival inválido na matriz de farm.');
    const track = findCareerTrack(offer.trackId);
    const race = runHeadlessRace(
      { car: player.car, name, profile: AI_PROFILES.advanced, seed: seed + 1 },
      { car: rival.car, name: 'Rival', profile: offer.opponent.skill, seed: seed + 2 }, track, offer.distance, seed,
    );
    prize = offer.rewardCr;
    attempts++;
    if (race.winner === 0 && !race.lanes[0].redLight && !race.lanes[0].dnf) wins++;
  }
  if (name === 'Chevette aspirado') chevetteWins = wins;
  console.log(JSON.stringify({ name, distance: '402 m', wins, attempts, prize, winsForTurboAndClutch: Math.ceil(4900 / prize) }));
}
if (chevetteWins < Math.max(1, Math.floor(sampleSize / 5))) {
  console.error('Poucas ofertas de 402 m vencíveis com Chevette aspirado.');
  process.exitCode = 1;
}
