/** N₂O on the Dyno Lab: measured bench curves per stage, run modes (none / stage 1 / all), nothing without a kit. */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { TRACKS } from '../../../src/data/tracks/index';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { measureLab } from '../../../src/game/career/tuning/dynoLab';

const track = TRACKS.find((t) => t.id === 'test-track')!;
const gol = findCampaignCar('vw-gol-gts-1988')!;
const build = (kit: string, tune = {}) => {
  const r = resolveBuild(gol, [kit], tune, 1);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.car;
};
const opts = { rpmStep: 1000, topSpeedS: 40 };

describe('Dyno Lab with N₂O', () => {
  it('a car without a kit has no nitrous section', async () => {
    const m = await measureLab(gol, track, () => false, () => {}, opts);
    expect(m!.nitrous).toBeUndefined();
  }, 60_000);

  it('the stage curves are measured on the bench and sit above the engine without nitro', async () => {
    const car = build('nitrous-progressive', { nitrousMode: 'dual' });
    const m = (await measureLab(car, track, () => false, () => {}, { ...opts, nitrous: 'all' }))!;
    const n = m.nitrous!;
    expect(n.stage1Points.length).toBeGreaterThanOrEqual(3);
    expect(n.peakCvStage1).toBeGreaterThan(m.peakCv + 10);
    expect(n.stage2Points).not.toBeNull();
    expect(n.capacityKg).toBeGreaterThan(0);
  }, 90_000);

  it('run modes: none uses nothing, stage 1 uses part of the cylinder, all uses more and is quicker than none', async () => {
    const car = build('nitrous-progressive', { nitrousMode: 'dual' });
    const run = async (mode: 'off' | 'stage1' | 'all') => (await measureLab(car, track, () => false, () => {}, { ...opts, nitrous: mode }))!;
    const off = await run('off');
    const s1 = await run('stage1');
    const all = await run('all');
    expect(off.nitrous!.usedKg).toBe(0);
    expect(s1.nitrous!.usedKg).toBeGreaterThan(0);
    expect(all.nitrous!.usedKg).toBeGreaterThan(s1.nitrous!.usedKg);
    expect(all.t402!).toBeLessThan(off.t402!);
  }, 180_000);

  it('the default is the car without the kit running (the old Dyno numbers do not change)', async () => {
    const car = build('nitrous-street');
    const plain = (await measureLab(gol, track, () => false, () => {}, opts))!;
    const withKit = (await measureLab(car, track, () => false, () => {}, opts))!;
    expect(withKit.nitrous!.usedKg).toBe(0);
    expect(Math.abs(withKit.peakCv - plain.peakCv)).toBeLessThan(0.5);
  }, 120_000);
});
