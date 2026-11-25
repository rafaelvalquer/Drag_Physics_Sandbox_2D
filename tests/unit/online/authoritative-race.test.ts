import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CHAPTER1_CARS, CAREER_CARS } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks';
import { transmissionKindOf } from '../../../src/game/career/tuning/BuildResolverV2';
import { careerResolverVersion } from '../../../src/game/career/tuning/resolverVersion';
import { AuthoritativeRace } from '../../../src/game/online/AuthoritativeRace';
import { RaceInputSchema, type RaceInput } from '../../../src/game/online/contracts';
import { ONLINE_STARTERS, stockOnlineBuild } from '../../../src/game/online/demoCatalog';
import { inputDelayTicks } from '../../../src/game/online/inputTiming';

function newRace() {
  return new AuthoritativeRace(randomUUID(), [
    stockOnlineBuild(ONLINE_STARTERS[0], 'Piloto A'),
    stockOnlineBuild(ONLINE_STARTERS[1], 'Piloto B'),
  ], TRACKS[0]!, 17);
}

function driveRace(race: AuthoritativeRace, command: (lane: 0 | 1) => Pick<RaceInput, 'throttle' | 'shift'>): void {
  while (race.race.phase !== 'finished' && race.tick < 6_000) {
    if (race.tick % 4 === 0) {
      for (const lane of [0, 1] as const) {
        race.submit(lane, { matchId: race.matchId, sequence: race.tick, observedTick: race.tick, ...command(lane) });
      }
    }
    race.step();
  }
}

describe('catálogo da prova online', () => {
  it('contém os 25 veículos da campanha', () => {
    expect(CAREER_CARS).toHaveLength(25);
    expect(new Set(CAREER_CARS.map((car) => car.id)).size).toBe(25);
  });

  it.each(CAREER_CARS.map((car) => [car.id, car] as const))('resolve o veículo original %s no Node', (id, car) => {
    expect(careerResolverVersion(id)).toBe(CHAPTER1_CARS.includes(car) ? 1 : 2);
    expect(stockOnlineBuild(id, car.name).car.id).toBe(id);
  });
});

describe('corrida autoritativa', () => {
  it('rejeita mensagem adulterada, repetida ou fora da janela', () => {
    const race = newRace();
    const input = { matchId: race.matchId, sequence: 0, observedTick: 0, throttle: 1 };
    expect(RaceInputSchema.safeParse({ ...input, x: 402 }).success).toBe(false);
    expect(RaceInputSchema.safeParse({ ...input, throttle: 2 }).success).toBe(false);
    expect(race.submit(0, { ...input, matchId: randomUUID() })).toBe(false);
    expect(race.submit(0, { ...input, observedTick: 1 })).toBe(false);
    expect(race.submit(0, input)).toBe(true);
    expect(race.submit(0, input)).toBe(false);
    for (let i = 0; i < 121; i++) race.step();
    expect(race.submit(0, { ...input, sequence: 1 })).toBe(false);
    expect(race.race.raceLanes[0]!.sim.controls.pedal).toBe(0);
  });

  it('recebe comandos independentes e calcula o resultado do quarto de milha', () => {
    const race = newRace();
    expect(race.race.raceLanes.map(({ sim }) => [transmissionKindOf(sim.car), sim.car.drivenAxle, !!sim.car.engine.turbo]))
      .toEqual([['manual', 'front', false], ['manual', 'rear', false]]);
    driveRace(race, (lane) => {
      const sim = race.race.raceLanes[lane]!.sim;
      const launch = race.race.greenAt !== null && race.race.time >= race.race.greenAt + 0.12 * lane;
      const shift = launch && (sim.gear === 0 || sim.engine.rpm >= 5_750) ? 1 : undefined;
      return { throttle: launch ? 1 : 0, shift };
    });
    const result = race.snapshot();
    expect(result.phase).toBe('finished');
    expect(result.lanes.every((lane) => lane.result.et !== null && !lane.result.redLight)).toBe(true);
    expect(result.lanes[0].result.rt).not.toBe(result.lanes[1].result.rt);
    expect(result.winner).toBe(result.lanes[0].result.total! < result.lanes[1].result.total! ? 0 : 1);
  });

  it('completa o quarto de milha com automático RWD e dupla embreagem AWD de fábrica', () => {
    const converter = stockOnlineBuild('mercedes-c200-w205-2015', 'Conversor');
    const dualClutch = stockOnlineBuild('nissan-gtr-r35-2015', 'Dupla embreagem');
    expect([transmissionKindOf(converter.car), converter.car.drivenAxle]).toEqual(['torque-converter-auto', 'rear']);
    expect([transmissionKindOf(dualClutch.car), dualClutch.car.drivenAxle]).toEqual(['dual-clutch', 'awd']);
    const race = new AuthoritativeRace(randomUUID(), [converter, dualClutch], TRACKS[0]!, 17);
    const peakBoost = [0, 0];
    driveRace(race, (lane) => {
      const sim = race.race.raceLanes[lane]!.sim;
      peakBoost[lane] = Math.max(peakBoost[lane]!, sim.engine.turbo?.boostPa ?? 0);
      const launch = race.race.greenAt !== null && race.race.time >= race.race.greenAt + 0.12 * lane;
      const shift = launch && !sim.shift.active && (sim.gear === 0 ||
        (sim.gearboxMode === 'M' && sim.engine.rpm >= sim.car.engine.redlineRpm)) ? 1 : undefined;
      return { throttle: launch ? 1 : 0, shift };
    });
    const snapshot = race.snapshot();
    expect(snapshot.phase).toBe('finished');
    for (const lane of snapshot.lanes) {
      expect(lane.result).toMatchObject({ finished: true, redLight: false, dnf: false });
      expect(lane.result.et).toBeGreaterThan(0);
      expect(lane.gear).toBeGreaterThan(1);
    }
    expect(peakBoost.every((boost) => boost > 0)).toBe(true);
  });

  it('registra queima de largada e quebra mecânica a partir dos comandos dos pilotos', () => {
    const weak = stockOnlineBuild(ONLINE_STARTERS[1], 'Motor de teste');
    // Deliberately fragile engine so this scenario reaches a real over-rev failure in seconds.
    weak.failureSpec = { recommendedSafeRpm: 1_800, maxSafeRpm: 3_000, enduranceS: 0.35, recoveryPerS: 0 };
    const race = new AuthoritativeRace(randomUUID(), [stockOnlineBuild(ONLINE_STARTERS[0], 'Largada antecipada'), weak], TRACKS[0]!, 17);
    driveRace(race, (lane) => {
      const sim = race.race.raceLanes[lane]!.sim;
      const greenAt = race.race.greenAt;
      const throttle = greenAt !== null && race.race.time >= greenAt - (lane === 0 ? 0.9 : 0) ? 1 : 0;
      const shift = lane === 0 && throttle > 0 && !sim.shift.active && (sim.gear === 0 || sim.engine.rpm >= 5_750) ? 1 : undefined;
      return { throttle, shift };
    });
    const snapshot = race.snapshot();
    expect(snapshot.phase).toBe('finished');
    expect(snapshot.lanes[0].result.redLight).toBe(true);
    expect(snapshot.lanes[0].result.rt).toBeLessThan(0);
    expect(snapshot.lanes[1].result).toMatchObject({ dnf: true, dnfReason: 'engine-blown' });
    expect(snapshot.lanes[1].result.blownAtRpm).toBeGreaterThan(weak.failureSpec.recommendedSafeRpm);
  });

  it.each([20, 80, 150, 250])('termina com %i ms de RTT, jitter e descarte de comandos', (rttMs) => {
    const race = newRace();
    const pending: { at: number; lane: 0 | 1; input: RaceInput }[] = [];
    const oneWayTicks = Math.round(rttMs * 0.06);
    let sequence = 0;
    let firstLaunchCommand: number | undefined;
    let firstAppliedThrottle: number | undefined;
    while (race.race.phase !== 'finished' && race.tick < 6_000) {
      if (race.tick % 4 === 0) {
        sequence++;
        if (sequence % 17 !== 0) for (const lane of [0, 1] as const) {
          const observedTick = Math.max(0, race.tick - oneWayTicks);
          const sim = race.race.raceLanes[lane]!.sim;
          const launch = race.race.greenAt !== null && observedTick / 120 >= race.race.greenAt + lane * 0.15;
          if (lane === 0 && launch) firstLaunchCommand ??= race.tick;
          pending.push({ at: race.tick + Math.max(0, oneWayTicks + sequence % 5 - 2), lane,
            input: { matchId: race.matchId, sequence, observedTick, throttle: launch ? 1 : 0,
              shift: launch && (sim.gear === 0 || sim.engine.rpm >= 5_750) ? 1 : undefined } });
        }
      }
      for (let index = pending.length - 1; index >= 0; index--) {
        const packet = pending[index]!;
        if (packet.at > race.tick) continue;
        race.submit(packet.lane, packet.input);
        pending.splice(index, 1);
      }
      race.step();
      if (race.race.raceLanes[0]!.sim.controls.pedal > 0) firstAppliedThrottle ??= race.tick;
    }
    const snapshot = race.snapshot();
    expect(snapshot.phase).toBe('finished');
    expect(snapshot.lanes.every((lane) => lane.result.finished && !lane.result.redLight)).toBe(true);
    expect(firstLaunchCommand).toBeDefined();
    expect(firstAppliedThrottle).toBeDefined();
    expect(firstAppliedThrottle! - firstLaunchCommand!).toBeLessThanOrEqual(oneWayTicks + 3);
  });

  it('limita a compensação em recepção, sem aplicar comandos retroativos', () => {
    expect(inputDelayTicks(undefined, 250)).toBe(0);
    expect(inputDelayTicks(250, 20)).toBe(0);
    expect(inputDelayTicks(20, 250)).toBe(12);
    const race = newRace();
    const lagA = Math.round(20 * 0.06);
    const lagB = Math.round(250 * 0.06);
    const base = { matchId: race.matchId, sequence: 0, observedTick: 0, throttle: 0.6 };
    for (let tick = 0; tick < lagB; tick++) {
      if (tick === lagA) expect(race.submit(0, base, inputDelayTicks(20, 250))).toBe(true);
      if (tick < lagA + 12) expect(race.race.raceLanes[0]!.sim.controls.pedal).toBe(0);
      race.step();
    }
    expect(race.race.raceLanes[0]!.sim.controls.pedal).toBe(0.6);
    expect(race.submit(1, base, inputDelayTicks(250, 20))).toBe(true);
    race.step();
    expect(race.race.raceLanes[1]!.sim.controls.pedal).toBe(0.6);
    expect(lagB - lagA - 12).toBeLessThanOrEqual(2);
  });
});
