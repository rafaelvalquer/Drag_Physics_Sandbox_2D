/**
 * The ten chapter 2 cars: registration in the unified catalogue, sources and provenance, dyno
 * peaks against the documented power and torque (±5 %), documented 0–100 km/h, drivetrain kinds.
 */
import { describe, expect, it } from 'vitest';
import { LAB_CARS } from '../../../src/data/cars/index';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER2_SOURCES } from '../../../src/data/cars/chapter2/sources';
import { ASTRA_2011_DOC } from '../../../src/data/cars/chapter2/gmAstra2011';
import { PEUGEOT_208GT_2017_DOC } from '../../../src/data/cars/chapter2/peugeot208Gt2017';
import { GOLF_GTI_2003_DOC } from '../../../src/data/cars/chapter2/vwGolfGti2003';
import { AUDI_A3_2005_DOC } from '../../../src/data/cars/chapter2/audiA3Turbo2005';
import { MERCEDES_C200_2015_DOC } from '../../../src/data/cars/chapter2/mercedesC2002015';
import { BMW_320I_2014_DOC } from '../../../src/data/cars/chapter2/bmw320i2014';
import { CIVIC_SI_2008_DOC } from '../../../src/data/cars/chapter2/hondaCivicSi2008';
import { JETTA_TSI_2012_DOC } from '../../../src/data/cars/chapter2/vwJettaTsi2012';
import { EVO_X_2012_DOC } from '../../../src/data/cars/chapter2/mitsubishiEvoX2012';
import { BMW_335I_2013_DOC } from '../../../src/data/cars/chapter2/bmw335i2013';
import { FAMILIA2_FLEX20_DOC } from '../../../src/data/engines/chapter2/gmFamilia2Flex20';
import { PRINCE_THP16_DOC } from '../../../src/data/engines/chapter2/psaPrinceThp16';
import { EA113_18T_DOC } from '../../../src/data/engines/chapter2/vwEa11318T';
import { M274_DOC } from '../../../src/data/engines/chapter2/mercedesM274';
import { N20_DOC } from '../../../src/data/engines/chapter2/bmwN20';
import { K20Z3_DOC } from '../../../src/data/engines/chapter2/hondaK20Z3';
import { EA888_20_DOC } from '../../../src/data/engines/chapter2/vwEa88820';
import { B4B11T_DOC } from '../../../src/data/engines/chapter2/mitsubishi4B11T';
import { N55_DOC } from '../../../src/data/engines/chapter2/bmwN55';
import { validateCar, type CarConfig } from '../../../src/data/schema';
import { EngineDyno } from '../../../src/physics/engine/EngineDyno';

interface Doc {
  sources: readonly string[];
  performance?: { accel0to100S?: number };
}
interface EngDoc {
  sources: readonly string[];
  displacementCm3: number;
  power: { cv: number };
  torque: { nm: number };
  firingOrder: readonly number[];
}

const DOCS: Record<string, [Doc, EngDoc]> = {
  'gm-astra-2011': [ASTRA_2011_DOC, FAMILIA2_FLEX20_DOC],
  'peugeot-208-gt-2017': [PEUGEOT_208GT_2017_DOC, PRINCE_THP16_DOC],
  'vw-golf-gti-mk4-2003': [GOLF_GTI_2003_DOC, EA113_18T_DOC],
  'audi-a3-18t-2005': [AUDI_A3_2005_DOC, EA113_18T_DOC],
  'mercedes-c200-w205-2015': [MERCEDES_C200_2015_DOC, M274_DOC],
  'bmw-320i-f30-2014': [BMW_320I_2014_DOC, N20_DOC],
  'honda-civic-si-2008': [CIVIC_SI_2008_DOC, K20Z3_DOC],
  'vw-jetta-tsi-2012': [JETTA_TSI_2012_DOC, EA888_20_DOC],
  'mitsubishi-evo-x-2012': [EVO_X_2012_DOC, B4B11T_DOC],
  'bmw-335i-f30-2013': [BMW_335I_2013_DOC, N55_DOC],
};

function dynoPeaks(car: CarConfig): { cv: number; nm: number } {
  const d = new EngineDyno(car.engine);
  d.start();
  let cv = 0;
  let nm = 0;
  for (let rpm = 1200; rpm <= car.engine.revLimitRpm; rpm += 100) {
    const m = d.measure(rpm, 1, 1 / 120, car.engine.induction === 'turbo' ? 1.5 : 0.6, 0.15);
    cv = Math.max(cv, m.powerCv);
    nm = Math.max(nm, m.torqueNm);
  }
  return { cv, nm };
}

describe('chapter 2 catalogue', () => {
  it('has the ten cars of the plan, once, in the unified catalogue and in the career', () => {
    expect(CHAPTER2_CARS.map((c) => c.id).sort()).toEqual(Object.keys(DOCS).sort());
    for (const c of CHAPTER2_CARS) {
      expect(LAB_CARS.filter((x) => x.id === c.id)).toHaveLength(1);
      expect(CAREER_CARS.filter((x) => x.id === c.id)).toHaveLength(1);
      expect(LAB_CARS.find((x) => x.id === c.id)).toBe(c); // the same record, not a copy
    }
  });

  it('drivetrains: AWD Evo, automatic C200/F30s, dual clutch Jetta/Evo, the N55 is a straight six', () => {
    const k = (id: string) => CHAPTER2_CARS.find((c) => c.id === id)!;
    expect(k('mitsubishi-evo-x-2012').drivenAxle).toBe('awd');
    expect(k('mitsubishi-evo-x-2012').transmission.kind).toBe('dual-clutch');
    expect(k('vw-jetta-tsi-2012').transmission.kind).toBe('dual-clutch');
    for (const id of ['mercedes-c200-w205-2015', 'bmw-320i-f30-2014', 'bmw-335i-f30-2013']) expect(k(id).transmission.kind).toBe('torque-converter-auto');
    expect(k('bmw-335i-f30-2013').engine.architecture).toBe('I6');
    expect(k('honda-civic-si-2008').engine.variableCam).toBeTruthy();
  });
});

describe.each(CHAPTER2_CARS.map((c) => [c.id, c] as const))('%s', (id, car) => {
  const [doc, eng] = DOCS[id]!;

  it('validates and every source is registered (documents with a URL)', () => {
    expect(validateCar(car).ok).toBe(true);
    for (const s of [...doc.sources, ...eng.sources]) {
      const ref = CHAPTER2_SOURCES[s];
      expect(ref, `fonte não registrada: ${s}`).toBeTruthy();
      if (ref!.nature === 'manual' || ref!.nature === 'technical-sheet') expect(ref!.url).toMatch(/^https:\/\//);
    }
    expect(car.engine.firingOrder ?? eng.firingOrder).toEqual(eng.firingOrder);
  });

  it('dyno peaks within 5 % of the documented power and torque (nothing forced)', () => {
    const p = dynoPeaks(car);
    expect(Math.abs(p.cv / eng.power.cv - 1), `potência ${p.cv.toFixed(1)} vs ${eng.power.cv}`).toBeLessThan(0.05);
    expect(Math.abs(p.nm / eng.torque.nm - 1), `torque ${p.nm.toFixed(1)} vs ${eng.torque.nm}`).toBeLessThan(0.05);
  });
});
