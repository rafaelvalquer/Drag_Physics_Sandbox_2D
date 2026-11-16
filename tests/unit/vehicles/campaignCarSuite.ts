/**
 * Shared acceptance suite of the career cars (one test file per car calls it): registration,
 * sources and provenance, dyno peaks against the documented points, the standing-start test
 * against the documented 0–100 km/h and top speed (with the justified tolerances of
 * campaignTargets.ts), and the car's own side art.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CARS, LAB_CARS, SANDBOX_CARS } from '../../../src/data/cars/index';
import { CAMPAIGN_CARS, findCampaignCar } from '../../../src/data/cars/campaign';
import { CAMPAIGN_SOURCES } from '../../../src/data/cars/campaignSources';
import { CAMPAIGN_TARGETS } from '../../../src/data/cars/campaignTargets';
import type { Provenance } from '../../../src/data/provenance';
import { validateCar, type CarConfig } from '../../../src/data/schema';
import { TRACKS } from '../../../src/data/tracks/index';
import { runAccelerationTest, type AccelerationResult } from '../../../src/game/race/accelerationTest';
import { DESIGNS } from '../../../src/game/vehicles/art/designs';
import { buildVehicleLayers } from '../../../src/game/vehicles/VehicleSpriteAssembler';
import { EngineDyno } from '../../../src/physics/engine/EngineDyno';
import { engineGeometry } from '../../../src/physics/engine/EngineGeometry';

const H = 1 / 120;
const rel = (sim: number, target: number): number => Math.abs(sim - target) / target;

export interface CampaignCarSpec {
  car: CarConfig;
  doc: { sources: readonly string[]; dimensions: { lengthMm: number; wheelbaseMm: number }; transmission: { gearRatios: readonly number[]; finalDrive: number } };
  engineDoc: { displacementCm3: number; boreMm: number; strokeMm: number; compressionRatio: number; sources: readonly string[] };
  curve: { rpm: readonly number[]; torqueNm: readonly number[]; documented: readonly number[] };
  provenance: Record<string, Provenance>;
  mass: { tareKg: number; driverKg: number; fuelKg: number };
  drive: 'front' | 'rear';
  /** Body type the art must show. */
  body: 'hatch' | 'sedan' | 'pickup';
  badge: string;
}

export function campaignCarSuite(s: CampaignCarSpec): void {
  const { car } = s;
  const tg = CAMPAIGN_TARGETS[car.id]!;

  describe(`${car.name} — registration, sources and data`, () => {
    it('shares the canonical factory car with free modes without changing the campaign catalogue', () => {
      expect(validateCar(car).errors).toEqual([]);
      expect(findCampaignCar(car.id)).toBe(car);
      expect(CAMPAIGN_CARS).toContain(car);
      expect(SANDBOX_CARS.filter((c) => c.id === car.id)).toEqual([car]);
      expect(LAB_CARS.filter((c) => c.id === car.id)).toEqual([car]);
      expect(CARS.map((c) => c.id).includes(car.id)).toBe(car.id === 'vw-gol-gts-1988');
    });

    it('every cited source exists, with URL, model year and access date', () => {
      for (const id of [...s.doc.sources, ...s.engineDoc.sources]) {
        const src = CAMPAIGN_SOURCES[id];
        expect(src, id).toBeDefined();
        expect(src!.url).toMatch(/^https?:\/\//);
        expect(src!.accessed).toBe('2026-11-16');
      }
    });

    it('geometry, mass split and gearing come from the documented data', () => {
      expect(car.wheelbaseM).toBeCloseTo(s.doc.dimensions.wheelbaseMm / 1000, 3);
      expect(car.visual.lengthM).toBeCloseTo(s.doc.dimensions.lengthMm / 1000, 3);
      expect(car.massKg).toBe(s.mass.tareKg + s.mass.driverKg + s.mass.fuelKg);
      expect(car.transmission.gearRatios).toEqual([...s.doc.transmission.gearRatios]);
      expect(car.transmission.finalDrive).toBe(s.doc.transmission.finalDrive);
      expect(car.drivenAxle).toBe(s.drive);
      const e = car.engine;
      expect(engineGeometry(e).displacement * 1e6).toBeCloseTo(s.engineDoc.displacementCm3, -1);
      expect([e.boreMm, e.strokeMm, e.compressionRatio]).toEqual([s.engineDoc.boreMm, s.engineDoc.strokeMm, s.engineDoc.compressionRatio]);
      expect(e.induction).toBe('NA');
      expect(e.turbo).toBeUndefined();
      expect(e.breathing).toBeDefined();
    });

    it('the torque curve passes through the documented points and the provenance labels them', () => {
      for (const rpm of s.curve.documented) {
        const i = s.curve.rpm.indexOf(rpm);
        expect(i, `documented rpm ${rpm} in curve`).toBeGreaterThanOrEqual(0);
        expect(car.engine.torqueCurve.torqueNm[i]).toBe(s.curve.torqueNm[i]);
      }
      const labels = Object.values(s.provenance);
      expect(labels).toContain('secondary');
      expect(labels).toContain('estimated');
      expect(labels).toContain('calibrated');
    });
  });

  describe(`${car.name} — dyno`, () => {
    it(`peaks within ${tg.tolerances.peaks * 100} % of ${tg.torqueNm} N·m and ${tg.powerCv} cv`, () => {
      const d = new EngineDyno(car.engine);
      expect(d.start()).toBe(true);
      let tMax = { rpm: 0, v: 0 };
      let pMax = { rpm: 0, v: 0 };
      for (let rpm = 1600; rpm <= car.engine.revLimitRpm; rpm += 200) {
        const p = d.measure(rpm, 1, H, 0.6, 0.15);
        if (p.torqueNm > tMax.v) tMax = { rpm, v: p.torqueNm };
        if (p.powerCv > pMax.v) pMax = { rpm, v: p.powerCv };
      }
      expect(rel(tMax.v, tg.torqueNm)).toBeLessThan(tg.tolerances.peaks);
      expect(rel(pMax.v, tg.powerCv)).toBeLessThan(tg.tolerances.peaks);
      expect(Math.abs(tMax.rpm - tg.torqueRpm)).toBeLessThanOrEqual(600);
      expect(Math.abs(pMax.rpm - tg.powerRpm)).toBeLessThanOrEqual(600);
    });
  });

  describe(`${car.name} — standing start (payload ${tg.testPayloadKg} kg)`, () => {
    let r: AccelerationResult;
    beforeAll(() => {
      const track = TRACKS.find((t) => t.id === 'test-track')!;
      r = runAccelerationTest(car, track, { speedsKmh: [100], distancesM: [201, 402], maxS: 150, payloadKg: tg.testPayloadKg });
    });

    it(`0–100 km/h within ${tg.tolerances.accel * 100} % of ${tg.accel0to100S} s`, () => {
      const t = r.speedTimes.get(100);
      expect(t).toBeDefined();
      expect(rel(t!, tg.accel0to100S)).toBeLessThan(tg.tolerances.accel);
    });

    it(`top speed within ${tg.tolerances.topSpeed * 100} % of ${tg.topSpeedKmh} km/h`, () => {
      expect(rel(r.topSpeedKmh, tg.topSpeedKmh)).toBeLessThan(tg.tolerances.topSpeed);
      expect(r.distanceTimes.get(402)).toBeGreaterThan(r.distanceTimes.get(201)!);
    });
  });

  describe(`${car.name} — side art`, () => {
    it(`own ${s.body} design with the "${s.badge}" badge, sized to the real car`, () => {
      const d = DESIGNS[car.visual.bodyStyle];
      expect(d).toBeDefined();
      expect(d.badges?.map((b) => b.text)).toContain(s.badge);
      const { meta, layers } = buildVehicleLayers(car, 100);
      expect(meta.noseX - meta.rearX).toBeCloseTo(car.visual.lengthM, 6);
      expect(meta.wheelCentres.rear.x).toBeCloseTo(-car.wheelbaseM, 9);
      const body = layers.find((l) => l.name === 'body')!.svg;
      expect(body).toContain(`>${s.badge}<`);
      // silhouette: a hatch carries the roof to the tail; a sedan's boot and a pickup's bed stay low
      const rearHeight = Math.max(...d.outline.filter((p) => p[0] <= 0.2).map((p) => p[1]));
      if (s.body === 'hatch') expect(rearHeight).toBeGreaterThan(0.8);
      else expect(rearHeight).toBeLessThan(0.65);
      if (s.body === 'pickup') {
        // open bed: a long flat rail from the tail to the cab (at least a third of the length)
        const rail = d.outline.filter((p) => Math.abs(p[1] - 0.605) < 0.01).map((p) => p[0]);
        expect(Math.max(...rail) - Math.min(...rail)).toBeGreaterThan(0.33);
      }
    });
  });
}
