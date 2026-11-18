/**
 * The 1 km duels of chapter 3 reuse the one RaceController (no second implementation): official
 * distance, splits at 201 m / 402 m / 1000 m, trap speed at the line, a distance-dependent DNF
 * clock and the run-off beyond the finish line.
 */
import { describe, expect, it } from 'vitest';
import { AI_PROFILES, DragAI } from '../../../src/game/ai/DragAI';
import { findCareerTrack } from '../../../src/data/tracks/career';
import { CHAPTER3_EVENTS, findRival, rivalOf } from '../../../src/game/career/CareerEvents';
import { rivalCar } from '../../../src/game/career/RivalBuildFactory';
import { DNF_TIMEOUT_S, RACE_DISTANCES, RaceController } from '../../../src/game/race/RaceController';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;

function solo(rivalId: string, trackId = 'pier-elite') {
  const car = rivalCar(rivalId);
  const sim = new VehicleSimulation(car, findCareerTrack(trackId));
  const ai = new DragAI(car, 'advanced', 5, AI_PROFILES.advanced);
  const race = new RaceController([{ sim, ai, name: rivalId }], 'km', 'pro', 3);
  return { sim, race };
}

describe('1 km race', () => {
  it('events 6, 8 and 10 are 1 km and their tracks have run-off beyond the line', () => {
    const km = CHAPTER3_EVENTS.filter((e) => e.distance === 'km');
    expect(km.map((e) => e.order)).toEqual([6, 8, 10]);
    expect(RACE_DISTANCES.km.m).toBe(1000);
    for (const e of km) {
      const t = findCareerTrack(e.trackId);
      expect(t.lengthM, e.id).toBeGreaterThanOrEqual(1500);
      expect(t.lengthM, e.id).toBeLessThanOrEqual(1700);
    }
  });

  it('timing stops at 1000 m, splits are recorded at 201/402/1000 m in order and the trap is at the line', () => {
    const { sim, race } = solo('akira');
    let xAtFinish = -1;
    for (let g = 0; g < 120 * 80 && xAtFinish < 0; g++) {
      race.beforeStep(H);
      sim.step(H);
      race.afterStep(H);
      if (race.results[0]!.finished) xAtFinish = sim.x;
    }
    const r = race.results[0]!;
    expect(r.finished).toBe(true);
    expect(xAtFinish).toBeGreaterThanOrEqual(1000);
    expect(xAtFinish).toBeLessThan(1010);
    expect(race.distanceM).toBe(1000);
    const { eighth, quarter } = r.splits;
    expect(eighth).toBeGreaterThan(0);
    expect(quarter!).toBeGreaterThan(eighth!);
    expect(r.et!).toBeGreaterThan(quarter!);
    expect(r.splits['1000ft']).toBeGreaterThan(quarter! - 5);
    // the final trap is the one of the last split (the 1 km line), a real speed (m/s)
    expect(r.trapMs!).toBeGreaterThan(60);
    expect(r.trapMs!).toBeLessThan(110);
    expect(r.traps.km).toBe(r.trapMs);
  });

  it('the car keeps moving after the line, brakes by itself and stops inside the track', () => {
    for (const id of ['akira', 'valentina']) {
      const { sim, race } = solo(id);
      const lengthM = findCareerTrack('pier-elite').lengthM;
      let finished = false;
      let vAtFinish = 0;
      for (let g = 0; g < 120 * 200; g++) {
        race.beforeStep(H);
        sim.step(H);
        race.afterStep(H);
        if (!finished && race.results[0]!.finished) {
          finished = true;
          vAtFinish = sim.speed;
          expect(sim.speed, id).toBeGreaterThan(50); // still moving at the line
        }
        if (finished && sim.speed < 0.3) break;
        expect(sim.x, id).toBeLessThan(lengthM); // never reaches the barrier
      }
      expect(vAtFinish).toBeGreaterThan(0);
      expect(sim.x, id).toBeGreaterThan(1000);
      expect(sim.x, id).toBeLessThan(lengthM - 100);
    }
  });

  it('the DNF clock depends on the distance: 201/402 m unchanged, 1 km about 70 s', () => {
    expect(DNF_TIMEOUT_S.eighth).toBe(45);
    expect(DNF_TIMEOUT_S.quarter).toBe(45);
    expect(DNF_TIMEOUT_S.km).toBeGreaterThanOrEqual(65);
    expect(DNF_TIMEOUT_S.km).toBeLessThanOrEqual(75);
    const car = rivalCar('hugo');
    const mk = (d: 'quarter' | 'km') => new RaceController([{ sim: new VehicleSimulation(car, findCareerTrack('pier-elite')), ai: null, name: 'x' }], d, 'pro', 1);
    expect(mk('quarter').dnfTimeoutS).toBe(45);
    expect(mk('km').dnfTimeoutS).toBe(DNF_TIMEOUT_S.km);
  });

  it('the slowest chapter car (aspirated V6 and the Golf) finishes the 1 km well inside the clock', () => {
    for (const id of ['hugo', 'renata', 'ricardo-elite']) {
      const { sim, race } = solo(id);
      for (let g = 0; g < 120 * 90 && !race.results[0]!.finished && !race.results[0]!.dnf; g++) {
        race.beforeStep(H);
        sim.step(H);
        race.afterStep(H);
      }
      const r = race.results[0]!;
      expect(r.dnf, id).toBe(false);
      expect(r.total!, id).toBeLessThan(DNF_TIMEOUT_S.km - 15);
    }
  });

  it('a lane that never leaves the line is out at 70 s of a 1 km run, not at 45 s', () => {
    const car = rivalCar('hugo');
    const sim = new VehicleSimulation(car, findCareerTrack('pier-elite'));
    const race = new RaceController([{ sim, ai: null, name: 'parado' }], 'km', 'pro', 1);
    // never ready: force the tree by a red-light-free path is not needed; the clock starts at the green
    race.greenAt = 0;
    race.phase = 'racing';
    let outAt = -1;
    for (let g = 0; g < 120 * 80 && outAt < 0; g++) {
      race.afterStep(H);
      if (race.results[0]!.dnf) outAt = race.time;
    }
    expect(race.results[0]!.dnfReason).toBe('timeout');
    expect(outAt).toBeGreaterThan(69);
    expect(outAt).toBeLessThan(71);
  });

  it('the events point to rivals whose builds are the ones of the plan', () => {
    expect(rivalOf(CHAPTER3_EVENTS[5]!).id).toBe('valentina');
    expect(rivalOf(CHAPTER3_EVENTS[7]!).id).toBe('bianca-elite');
    expect(rivalOf(CHAPTER3_EVENTS[9]!).id).toBe(findRival('akira')!.id);
  });
});
