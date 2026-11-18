/**
 * The eight Chapter 3 cars: registration in the unified catalogue, sources and provenance, V6
 * geometry and firing, dyno peaks against the documented figures (±5 %), the nine-speed gearbox,
 * the parallel-twin turbo, the unit conversions (hp ≠ cv ≠ kW) and the acoustic identity.
 */
import { describe, expect, it } from 'vitest';
import { LAB_CARS } from '../../../src/data/cars/index';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { CHAPTER3_CARS } from '../../../src/data/cars/chapter3/index';
import { CHAPTER2_SOURCES } from '../../../src/data/cars/chapter2/sources';
import { CHAPTER3_SOURCES } from '../../../src/data/cars/chapter3/sources';
import * as E from '../../../src/data/engines/chapter3/index';
import { CV_TO_KW, HP_TO_KW, hpToCv, hpToKw, lbftToNm } from '../../../src/data/provenance';
import { EngineSchema, validateCar, type CarConfig, type EngineConfig } from '../../../src/data/schema';
import { Turbocharger } from '../../../src/physics/engine/Turbocharger';
import { EngineDyno } from '../../../src/physics/engine/EngineDyno';
import { TRACKS } from '../../../src/data/tracks/index';
import { runAccelerationTest } from '../../../src/game/race/accelerationTest';
import { carToAcousticConfig } from '../../../src/audio/dsp/AcousticConfig';
import { ENGINE_RELIABILITY } from '../../../src/game/career/tuning/EngineReliability';
import { ENGINE_FAMILIES } from '../../../src/game/career/tuning/chapter2Parts';

const DOCS = {
  'nissan-350z-2006': [E.ENGINE_NISSAN_VQ35DE, E.VQ35DE_DOC],
  'lexus-is350-2015': [E.ENGINE_TOYOTA_2GR_FSE, E.GR2_FSE_DOC],
  'nissan-370z-2014': [E.ENGINE_NISSAN_VQ37VHR, E.VQ37VHR_DOC],
  'mercedes-amg-c43-2017': [E.ENGINE_MERCEDES_M276, E.M276_BITURBO_DOC],
  'kia-stinger-gt-2019': [E.ENGINE_KIA_LAMBDA_33, E.LAMBDA_33_TGDI_DOC],
  'maserati-ghibli-sq4-2015': [E.ENGINE_MASERATI_F160, E.F160_DOC],
  'alfa-giulia-qv-2017': [E.ENGINE_ALFA_690T, E.ALFA_690T_DOC],
  'nissan-gtr-r35-2015': [E.ENGINE_NISSAN_VR38DETT, E.VR38DETT_DOC],
} as const;

const SOURCES = { ...CHAPTER2_SOURCES, ...CHAPTER3_SOURCES };
const TWIN = ['mercedes-amg-c43-2017', 'kia-stinger-gt-2019', 'maserati-ghibli-sq4-2015', 'alfa-giulia-qv-2017', 'nissan-gtr-r35-2015'];

function dynoPeaks(e: EngineConfig): { cv: number; nm: number } {
  const d = new EngineDyno(e);
  d.start();
  let cv = 0;
  let nm = 0;
  for (let rpm = 1200; rpm <= e.revLimitRpm; rpm += 100) {
    const m = d.measure(rpm, 1, 1 / 120, e.induction === 'turbo' ? 1.5 : 0.6, 0.15);
    cv = Math.max(cv, m.powerCv);
    nm = Math.max(nm, m.torqueNm);
  }
  return { cv, nm };
}

describe('units: hp, cv and kW are three different units', () => {
  it('converts the published figures and never treats them as equal', () => {
    expect(HP_TO_KW).toBeGreaterThan(CV_TO_KW);
    expect(hpToCv(300)).toBe(304.2);
    expect(hpToCv(545)).toBe(552.6);
    expect(hpToKw(300)).toBe(223.7);
    expect(lbftToNm(260)).toBe(352.5);
    expect(lbftToNm(463)).toBe(627.7);
    for (const hp of [300, 306, 332, 362, 365, 404, 505, 545]) expect(hpToCv(hp)).toBeGreaterThan(hp);
  });

  it('every engine documents the published hp and lb-ft and stores the converted values', () => {
    for (const [id, [, doc]] of Object.entries(DOCS)) {
      expect(doc.published?.hp, id).toBeTruthy();
      expect(doc.power.cv, id).toBe(hpToCv(doc.published!.hp!));
      expect(doc.torque.nm, id).toBe(lbftToNm(doc.published!.lbFt!));
    }
  });
});

describe('chapter 3 catalogue', () => {
  it('has the eight cars of the plan, once, in the unified catalogue and in the career', () => {
    expect(CHAPTER3_CARS.map((c) => c.id).sort()).toEqual(Object.keys(DOCS).sort());
    for (const c of CHAPTER3_CARS) {
      expect(LAB_CARS.filter((x) => x.id === c.id)).toHaveLength(1);
      expect(CAREER_CARS.filter((x) => x.id === c.id)).toHaveLength(1);
      expect(LAB_CARS.find((x) => x.id === c.id)).toBe(c);
    }
  });

  it('drivetrains and gearboxes of the plan', () => {
    const k = (id: string): CarConfig => CHAPTER3_CARS.find((c) => c.id === id)!;
    for (const id of ['nissan-350z-2006', 'nissan-370z-2014', 'lexus-is350-2015', 'alfa-giulia-qv-2017']) expect(k(id).drivenAxle, id).toBe('rear');
    for (const id of ['mercedes-amg-c43-2017', 'kia-stinger-gt-2019', 'maserati-ghibli-sq4-2015', 'nissan-gtr-r35-2015']) expect(k(id).drivenAxle, id).toBe('awd');
    for (const id of ['nissan-350z-2006', 'nissan-370z-2014']) {
      expect(k(id).transmission.gearRatios).toHaveLength(6);
      expect(k(id).transmission.kind ?? 'manual').toBe('manual');
    }
    for (const id of ['lexus-is350-2015', 'kia-stinger-gt-2019', 'maserati-ghibli-sq4-2015', 'alfa-giulia-qv-2017']) {
      expect(k(id).transmission.kind).toBe('torque-converter-auto');
      expect(k(id).transmission.gearRatios).toHaveLength(8);
    }
    expect(k('mercedes-amg-c43-2017').transmission.gearRatios).toHaveLength(9);
    expect(k('nissan-gtr-r35-2015').transmission.kind).toBe('dual-clutch');
    expect(k('nissan-gtr-r35-2015').transmission.gearRatios).toHaveLength(6);
    // the factory ratios of the sources
    expect(k('mercedes-amg-c43-2017').transmission.gearRatios).toEqual([5.35, 3.24, 2.25, 1.64, 1.21, 1.0, 0.86, 0.72, 0.6]);
    expect(k('mercedes-amg-c43-2017').transmission.finalDrive).toBe(3.07);
    expect(k('nissan-gtr-r35-2015').transmission.gearRatios).toEqual([4.056, 2.301, 1.595, 1.248, 1.001, 0.796]);
    expect(k('nissan-370z-2014').transmission.finalDrive).toBe(3.692);
    // the C43 split of the manufacturer page: 31:69
    expect(k('mercedes-amg-c43-2017').awd!.frontTorqueFraction).toBe(0.31);
  });

  it('no car is a copy of another: distinct engines, masses, silhouettes and exhausts', () => {
    expect(new Set(CHAPTER3_CARS.map((c) => c.engine.id)).size).toBe(8);
    expect(new Set(CHAPTER3_CARS.map((c) => c.visual.bodyStyle)).size).toBe(8);
    expect(new Set(CHAPTER3_CARS.map((c) => c.massKg)).size).toBe(8);
    expect(new Set(CHAPTER3_CARS.map((c) => JSON.stringify(c.exhaust))).size).toBe(8);
    expect(new Set(CHAPTER3_CARS.map((c) => JSON.stringify(c.engine.torqueCurve))).size).toBe(8);
  });
});

describe.each(CHAPTER3_CARS.map((c) => [c.id, c] as const))('%s', (id, car) => {
  const [eng, doc] = DOCS[id as keyof typeof DOCS];

  it('validates; every source is registered and the consulted ones carry a URL', () => {
    expect(validateCar(car).ok).toBe(true);
    expect(EngineSchema.safeParse(eng).success).toBe(true);
    expect(car.engine).toBe(eng);
    for (const s of doc.sources) {
      const ref = SOURCES[s];
      expect(ref, `fonte não registrada: ${s}`).toBeTruthy();
      if (ref!.nature === 'manual' || ref!.nature === 'catalogue' || ref!.nature === 'technical-sheet') expect(ref!.url).toMatch(/^https:\/\//);
    }
  });

  it('is a V6: six cylinders, two banks, a valid firing order and mapping', () => {
    expect(eng.architecture).toBe('V6');
    expect(eng.cylinders).toBe(6);
    expect([...eng.firingOrder].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(eng.firingOrder).toEqual(doc.firingOrder);
    expect(eng.bankAngleDeg).toBe(id === 'alfa-giulia-qv-2017' ? 90 : 60);
    expect(eng.bankOfCylinder.filter((b) => b === 0)).toHaveLength(3);
    expect(eng.bankOfCylinder.filter((b) => b === 1)).toHaveLength(3);
    expect(eng.firingAnglesDeg.every((a) => Number.isFinite(a) && a >= 0 && a < 720)).toBe(true);
    // consecutive events in the firing order
    const at = eng.firingOrder.map((c) => eng.firingAnglesDeg[c - 1]!);
    const gaps = at.map((a, i) => ((at[(i + 1) % 6]! - a + 720) % 720));
    expect(gaps.reduce((a, b) => a + b, 0)).toBe(720);
    if (id === 'alfa-giulia-qv-2017') expect(gaps).toEqual([90, 150, 90, 150, 90, 150]);
    else expect(gaps).toEqual([120, 120, 120, 120, 120, 120]);
  });

  it('the displacement of the geometry matches the source sheet', () => {
    const cm3 = (Math.PI / 4) * (eng.boreMm / 10) ** 2 * (eng.strokeMm / 10) * 6;
    expect(Math.abs(cm3 / doc.displacementCm3 - 1)).toBeLessThan(0.006);
    expect(eng.boreMm).toBe(doc.boreMm);
    expect(eng.strokeMm).toBe(doc.strokeMm);
    expect(eng.compressionRatio).toBe(doc.compressionRatio);
  });

  it('dyno peaks within 5 % of the documented power and torque (nothing forced)', () => {
    const p = dynoPeaks(eng);
    expect(Math.abs(p.cv / doc.power.cv - 1), `potência ${p.cv.toFixed(1)} vs ${doc.power.cv}`).toBeLessThan(0.05);
    expect(Math.abs(p.nm / doc.torque.nm - 1), `torque ${p.nm.toFixed(1)} vs ${doc.torque.nm}`).toBeLessThan(0.05);
    expect(Number.isFinite(p.cv) && Number.isFinite(p.nm)).toBe(true);
  });

  it('the curve covers the limiter and idles without power', () => {
    expect(eng.torqueCurve.rpm[eng.torqueCurve.rpm.length - 1]!).toBeGreaterThanOrEqual(eng.revLimitRpm);
    expect(eng.torqueCurve.torqueNm.every(Number.isFinite)).toBe(true);
    const idle = eng.torqueCurve.torqueNm[0]! * ((eng.idleRpm * 2 * Math.PI) / 60) / 735.5;
    expect(idle).toBeLessThan(0.15 * doc.power.cv);
  });

  it('has its own family in the workshop and its own reliability spec (Blown Engine)', () => {
    expect(ENGINE_FAMILIES[eng.family!], eng.family).toBeTruthy();
    expect(ENGINE_FAMILIES[eng.family!]!.induction).toBe(eng.induction);
    expect(ENGINE_RELIABILITY[eng.family!], eng.family).toBeTruthy();
    expect(ENGINE_RELIABILITY[eng.family!]!.enduranceS).toBeGreaterThan(2);
  });

  it('aspiration: aspirated V6 have no turbo; the biturbo are parallel twins with a recirculating valve', () => {
    if (TWIN.includes(id)) {
      expect(eng.induction).toBe('turbo');
      expect(eng.turbo?.layout).toBe('parallel-twin');
      expect(eng.turbo?.bovVent).toBe('recirculating');
    } else {
      expect(eng.induction).toBe('NA');
      expect(eng.turbo).toBeUndefined();
      expect(carToAcousticConfig(car).acoustic.turboGain).toBe(0);
    }
  });
});

describe('nine-speed gearbox (C43)', () => {
  it('the schema takes nine gears and the simulation shifts through all of them', () => {
    const c43 = CHAPTER3_CARS.find((c) => c.id === 'mercedes-amg-c43-2017')!;
    const track = TRACKS.find((t) => t.id === 'test-track')!;
    const r = runAccelerationTest(c43, track, { speedsKmh: [100, 300], distancesM: [402], maxS: 60 });
    expect(r.topSpeedGear).toBeGreaterThanOrEqual(8);
    // the shifts go through the gears in order
    const froms = r.shifts.map((s) => s.from);
    for (let i = 1; i < froms.length; i++) expect(froms[i]!).toBeGreaterThanOrEqual(froms[i - 1]!);
    expect(r.speedTimes.get(100)!).toBeGreaterThan(3.5);
  });

  it('a car does not get a ninth gear it does not have', () => {
    for (const c of CHAPTER3_CARS) if (c.id !== 'mercedes-amg-c43-2017') expect(c.transmission.gearRatios.length).toBeLessThanOrEqual(8);
  });
});

describe('parallel-twin turbo', () => {
  const cfg = {
    layout: 'parallel-twin' as const,
    maxBoostBar: 1,
    spoolTimeS: 0.3,
    fullBoostFlowFraction: 0.2,
    maxShaftRpm: 200000,
    compressorBlades: 6,
    bovEnabled: true,
    bovVentTimeS: 0.1,
  };
  const run = (c: typeof cfg | (Omit<typeof cfg, 'layout'> & { layout?: undefined })): Turbocharger => {
    const t = new Turbocharger(c as never, 0.2);
    for (let i = 0; i < 360; i++) t.update(1 / 120, 0.3, 1, 0.9);
    return t;
  };

  it('two rotors that spool to the same wastegate limit with a small mismatch in between', () => {
    const t = new Turbocharger(cfg, 0.2);
    expect(t.count).toBe(2);
    let diff = 0;
    for (let i = 0; i < 40; i++) {
      t.update(1 / 120, 0.3, 1, 0.9);
      diff = Math.max(diff, Math.abs(t.shaft - t.shaftB));
    }
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(0.1);
    for (let i = 0; i < 320; i++) t.update(1 / 120, 0.3, 1, 0.9);
    expect(t.shaftRpm2).toBeGreaterThan(0);
    expect(Math.abs(t.shaftRpm2 / t.shaftRpm - 1)).toBeLessThan(0.02);
  });

  it('the pressure is the mean of the compressors, not their sum', () => {
    const twin = run(cfg);
    const { layout: _l, ...single } = cfg;
    const one = run(single);
    expect(one.count).toBe(1);
    expect(one.shaftRpm2).toBe(0);
    expect(twin.boostPa).toBeGreaterThan(0.8e5);
    expect(twin.boostPa).toBeLessThan(1.05e5);
    expect(Math.abs(twin.boostPa / one.boostPa - 1)).toBeLessThan(0.03);
  });

  it('the engines with a single turbo keep their behaviour (layout absent)', () => {
    const t = new Turbocharger({ ...cfg, layout: undefined } as never, 0.2);
    expect(t.twin).toBe(false);
    for (let i = 0; i < 240; i++) t.update(1 / 120, 0.3, 1, 0.9);
    expect(t.shaftB).toBe(0);
  });
});

describe('acoustic identity', () => {
  it('the 90° V6 is configured with its own geometry, not the one of a 60° V6', () => {
    const giulia = carToAcousticConfig(CHAPTER3_CARS.find((c) => c.id === 'alfa-giulia-qv-2017')!);
    const gtr = carToAcousticConfig(CHAPTER3_CARS.find((c) => c.id === 'nissan-gtr-r35-2015')!);
    expect(giulia.engine.bankAngleDeg).toBe(90);
    expect(gtr.engine.bankAngleDeg).toBe(60);
    expect(giulia.engine.firingAnglesDeg).not.toEqual(gtr.engine.firingAnglesDeg);
    expect(giulia.engine.crankType).toBe('split-pin');
  });

  it('every car has its own exhaust and gains', () => {
    const cfgs = CHAPTER3_CARS.map((c) => carToAcousticConfig(c));
    expect(new Set(cfgs.map((c) => JSON.stringify(c.exhaust))).size).toBe(8);
    expect(new Set(cfgs.map((c) => JSON.stringify(c.acoustic))).size).toBe(8);
  });
});
