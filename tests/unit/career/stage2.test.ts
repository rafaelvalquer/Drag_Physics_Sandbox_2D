/** Modern cars: generic car hardware of the slot catalogue, Stage 2 of the factory turbo, progressive unlocks. */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER2_EVENTS, CHAPTER3_EVENTS, EVENTS } from '../../../src/game/career/CareerEvents';
import { isPartUnlocked, partStatus } from '../../../src/game/career/CareerProgression';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { familyOf, incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { planInstall } from '../../../src/game/career/tuning/ProjectRequirements';
import { findPart, GENERIC_V2_CATEGORIES } from '../../../src/game/career/tuning/parts';

const bmw = findCampaignCar('bmw-320i-f30-2014')!;
const ch1Done = EVENTS.map((e) => e.id);
const upTo = (order: number) => [...ch1Done, ...CHAPTER2_EVENTS.filter((e) => e.order <= order).map((e) => e.id)];

describe('generic car hardware on modern engines', () => {
  it('fits the 320i, while classic engine parts (and the classic cooling, beaten by its own Stage 1) stay out', () => {
    for (const id of ['radiator-large', 'oil-cooler', 'fan-upgrade']) expect(incompatibility(bmw, findPart(id)!), id).not.toBeNull();
    for (const id of ['weight-light', 'cooling-radiator-bmw-n20-s1', 'cooling-oil-bmw-n20-s1', 'cooling-fan-bmw-n20-s1', 'tires-width-1', 'tires-pressure-street'])
      expect(incompatibility(bmw, findPart(id)!), id).toBeNull();
    expect(incompatibility(bmw, findPart('cam-sport')!)).not.toBeNull();
    expect(incompatibility(bmw, findPart('turbo-basic')!)).not.toBeNull();
  });

  it('applies its physics in resolver v2 (mass, tyre, friction)', () => {
    const stock = resolveBuild(bmw, [], {}, 2);
    const w = resolveBuild(bmw, ['weight-medium', 'tires-width-2'], {}, 2);
    if (!stock.ok || !w.ok) throw new Error('build');
    expect(w.car.massKg).toBe(stock.car.massKg - 48);
    expect(w.car.tires.muPeak).toBeGreaterThan(stock.car.tires.muPeak);
    const oil = resolveBuild(findCampaignCar('honda-civic-si-2008')!, ['cooling-oil-honda-k20-s1'], {}, 2);
    const civic = resolveBuild(findCampaignCar('honda-civic-si-2008')!, [], {}, 2);
    if (!oil.ok || !civic.ok) throw new Error('build');
    expect(oil.peakPowerCv).toBeGreaterThan(civic.peakPowerCv);
  });

  it('opens along chapter 2 on modern cars, not at its start', () => {
    const fam = familyOf(bmw);
    const tyres = findPart('tires-width-1')!;
    const weight = findPart('weight-light')!;
    expect(isPartUnlocked({ completedEventIds: ch1Done }, tyres, fam)).toBe(false);
    expect(isPartUnlocked({ completedEventIds: upTo(2) }, tyres, fam)).toBe(true);
    expect(isPartUnlocked({ completedEventIds: upTo(4) }, weight, fam)).toBe(false);
    expect(isPartUnlocked({ completedEventIds: upTo(5) }, weight, fam)).toBe(true);
    // classic engines keep their chapter 1 rules
    expect(isPartUnlocked({ completedEventIds: ch1Done }, weight, 'legacy')).toBe(true);
    const st = partStatus({ completedEventIds: ch1Done, inventoryPartIds: [], credits: 1e6 }, { baseCarId: bmw.id, installedParts: [] }, tyres, fam);
    expect(st.state).toBe('locked');
    expect(st.label).toMatch(/Etapa 2/);
    expect(GENERIC_V2_CATEGORIES).toContain('chassis-weight');
  });
});

describe('Stage maps of the factory turbo (one map per engine family)', () => {
  const mapOf = (car: { engine: { family?: string } }, tier: number) => `ecu-map-${car.engine.family}-s${tier}`;
  const save = { completedEventIds: [], inventoryPartIds: [], credits: 9e9 };

  it('each stage gains more than the one before on every factory-turbo car of chapter 2 (Stage 3 reaches the old generic Stage 3 level)', () => {
    for (const car of CHAPTER2_CARS.filter((c) => c.engine.induction === 'turbo')) {
      const stock = resolveBuild(car, [], {}, 2);
      if (!stock.ok) throw new Error(car.id);
      const gains = [1, 2, 3].map((tier) => {
        // the planner finds the hardware each map asks for (fuel, intercooler, internals, gearbox...)
        const plan = planInstall({ base: car, car: { baseCarId: car.id, installedParts: [] }, save, partId: mapOf(car, tier), versionOf: () => 2 });
        const r = resolveBuild(car, plan.parts, {}, 2);
        if (!r.ok) throw new Error(`${car.id} Stage ${tier}: ${r.errors.join('; ')}`);
        return r.peakPowerCv / stock.peakPowerCv - 1;
      });
      expect(gains[0], car.id).toBeGreaterThan(0.03);
      expect(gains[1], car.id).toBeGreaterThan(gains[0]! + 0.04);
      expect(gains[2], car.id).toBeGreaterThan(gains[1]! + 0.25);
      expect(gains[2], car.id).toBeLessThan(0.75);
    }
  });

  it('Stage 3 refuses the map without its hardware: downpipe, intercooler, forged internals, fuel, big turbine and a gearbox that carries the torque', () => {
    const n20 = mapOf(bmw, 3);
    const bare = resolveBuild(bmw, [n20], {}, 2);
    expect(bare.ok).toBe(false);
    const text = bare.ok ? '' : bare.errors.join(' | ');
    for (const need of [/downpipe/, /intercooler/, /pistões/, /alimentação/, /turbina/]) expect(text).toMatch(need);
    // the manual 208 also needs a clutch that carries the torque
    const p208 = findCampaignCar('peugeot-208-gt-2017')!;
    const hw = ['fuel-psa-prince-thp-s3', 'charge-cooler-psa-prince-thp-s3', 'rotating-assembly-psa-prince-thp-s3', 'exhaust-downpipe-psa-prince-thp-s3', 'factory-turbo-psa-prince-thp-s3', mapOf(p208, 3)];
    const cl = resolveBuild(p208, hw, {}, 2);
    expect(cl.ok).toBe(false);
    if (!cl.ok) expect(cl.errors.join()).toMatch(/embreagem/);
    expect(resolveBuild(p208, [...hw, 'clutch-psa-prince-thp-s3'], {}, 2).ok).toBe(true);
  });

  it('Stage 2 opens at the 8th event; Stage 3 opens at the 5th duel of chapter 3; a map never fits an NA engine or another family', () => {
    const s2map = findPart(mapOf(bmw, 2))!;
    const s3map = findPart(mapOf(bmw, 3))!;
    const fam = familyOf(bmw);
    expect(isPartUnlocked({ completedEventIds: upTo(7) }, s2map, fam)).toBe(false);
    expect(isPartUnlocked({ completedEventIds: upTo(8) }, s2map, fam)).toBe(true);
    // chapter 2 complete: chapter 3 is open, but the map of Stage 3 waits for the 5th duel
    const ch3 = (k: number) => [...upTo(10), ...CHAPTER3_EVENTS.filter((e) => e.order <= k).map((e) => e.id)];
    const status = (done: string[]) => partStatus({ completedEventIds: done, inventoryPartIds: [], credits: 1e6 }, { baseCarId: bmw.id, installedParts: [] }, s3map, fam);
    expect(status(upTo(10)).state).toBe('locked');
    expect(status(upTo(10)).label).toBe('Duelo 5');
    expect(status(ch3(4)).state).toBe('locked');
    expect(status(ch3(5)).state).toBe('available');
    // chapter 2 not complete: chapter 3 is still closed
    expect(status(upTo(9)).label).toBe('Capítulo 3');
    expect(incompatibility(findCampaignCar('honda-civic-si-2008')!, s2map)).not.toBeNull();
    expect(incompatibility(findCampaignCar('mitsubishi-evo-x-2012')!, s2map)).not.toBeNull(); // the N20 map is not for the 4B11
  });
});
