/** N₂O in the race: full cylinder every attempt, no refill inside one, the attempt end shuts it, rivals play fair. */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { DragAI } from '../../../src/game/ai/DragAI';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { RaceController } from '../../../src/game/race/RaceController';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';

const H = 1 / 120;
const track = TRACKS.find((t) => t.id === 'test-track')!;
const gol = findCampaignCar('vw-gol-gts-1988')!;
const build = (kit: string, tune = {}) => {
  const r = resolveBuild(gol, [kit], tune, 1);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.car;
};

function runRace(player: VehicleSimulation, rival: VehicleSimulation, seed = 3): RaceController {
  const race = new RaceController(
    [
      { sim: player, ai: new DragAI(player.car, 'advanced', 1), name: 'player' },
      { sim: rival, ai: new DragAI(rival.car, 'advanced', 2), name: 'rival' },
    ],
    'quarter',
    'pro',
    seed,
  );
  for (let i = 0; i < 120 * 60; i++) {
    race.beforeStep(H);
    for (const l of race.raceLanes) l.sim.step(H);
    race.afterStep(H);
    if (race.phase === 'finished' && race.raceLanes.every((l) => l.sim.speed < 0.3)) break;
  }
  return race;
}

describe('nitrous in a race', () => {
  it('a rival with a kit uses it by the same rules: it spends its cylinder, once, and never gets more', () => {
    const car = build('nitrous-street');
    const sim = new VehicleSimulation(car, track);
    const rival = new VehicleSimulation(gol, track);
    runRace(sim, rival);
    const t = sim.nitrous!.telemetry();
    expect(t.consumedKg).toBeGreaterThan(0.001);
    expect(t.consumedKg).toBeLessThanOrEqual(car.nitrous!.capacityKg + 1e-9);
  }, 60_000);

  it('the finish line shuts the injection and a new attempt starts with a full cylinder', () => {
    const car = build('nitrous-progressive', { nitrousFlow: 0.25 }); // slow flow: still injecting at the line
    const sim = new VehicleSimulation(car, track);
    const rival = new VehicleSimulation(gol, track);
    const race = runRace(sim, rival);
    expect(race.results[0]!.finished).toBe(true);
    expect(['DISABLED', 'DEPLETED']).toContain(sim.nitrous!.status);
    expect(sim.nitrous!.active).toBe(false);
    // a restart: the cylinder is full again, with nothing carried over
    sim.reset();
    expect(sim.nitrous!.status).toBe('READY');
    expect(sim.nitrous!.remainingFraction).toBe(1);
    expect(sim.nitrous!.telemetry().consumedKg).toBe(0);
  }, 60_000);

  it('the same race twice gives the same result (deterministic)', () => {
    const run = () => {
      const sim = new VehicleSimulation(build('nitrous-wet'), track);
      const race = runRace(sim, new VehicleSimulation(gol, track));
      return { et: race.results[0]!.et, consumed: sim.nitrous!.telemetry().consumedKg };
    };
    expect(run()).toEqual(run());
  }, 90_000);

  it('the nitro makes the car quicker over 402 m than the same car without it', () => {
    const plain = runRace(new VehicleSimulation(gol, track), new VehicleSimulation(gol, track)).results[0]!.et!;
    const nitro = runRace(new VehicleSimulation(build('nitrous-street'), track), new VehicleSimulation(gol, track)).results[0]!.et!;
    expect(nitro).toBeLessThan(plain);
  }, 90_000);
});
