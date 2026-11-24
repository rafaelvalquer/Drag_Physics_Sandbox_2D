import { describe, expect, it } from 'vitest';
import { migrateNitrousConfig } from '../../../src/data/nitrousMigration';
import { exportCareer, importCareer, parseCareerSave } from '../../../src/game/career/CareerState';
import { CareerController } from '../../../src/game/career/CareerController';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { MemoryStore } from '../../../src/storage/db';

describe('continuous nitrous migration', () => {
  it.each([
    [{ nitrousMode: 'single', nitrousFlow1: 0.75, nitrousRamp1: 0.5 }, 0.75, 0.5],
    [{ nitrousMode: 'dual', nitrousShare: 0.25, nitrousFlow1: 1, nitrousFlow2: 0.5, nitrousRamp1: 0.5, nitrousRamp2: 3 }, 0.625, 1.8125],
  ])('converts the v4 tune and preserves the garage and progress', async (legacy, flow, ramp) => {
    const controller = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
    expect((await controller.newCareer('vw-gol-gts-1988')).ok).toBe(true);
    const save = controller.save!;
    const old = {
      ...save, version: 4, credits: 1234, completedEventIds: ['e1-primeira-noite'],
      ownedCars: save.ownedCars.map((car) => ({
        ...car, installedParts: ['nitrous-wet'], tune: { ...legacy, launchRpm: 3200 },
      })),
    };
    const result = parseCareerSave(old);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.save.version).toBe(5);
    expect(result.save.credits).toBe(1234);
    expect(result.save.completedEventIds).toEqual(old.completedEventIds);
    expect(result.save.ownedCars[0]!.installedParts).toEqual(['nitrous-wet']);
    expect(result.save.ownedCars[0]!.tune).toEqual({ nitrousFlow: flow, nitrousRampS: ramp, launchRpm: 3200 });
    expect(importCareer(exportCareer(result.save))).toEqual(result);
  });

  it('converts a resolved Sandbox preset without changing its hardware', () => {
    expect(migrateNitrousConfig({
      kitId: 'nitrous-wet', capacityKg: 0.04, mode: 'dual', stage1Share: 0.5,
      stage1Flow: 0.9, stage2Flow: 0.5, stage1RampS: 0.4, stage2RampS: 0.8,
    })).toEqual({ kitId: 'nitrous-wet', capacityKg: 0.04, flow: 0.7, rampS: expect.closeTo(0.6) });
  });
});
