/** Modern cars: generic car hardware of the slot catalogue, Stage 2 of the factory turbo, progressive unlocks. */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { CHAPTER2_CARS } from '../../../src/data/cars/chapter2/index';
import { CHAPTER2_EVENTS, CHAPTER3_EVENTS, EVENTS } from '../../../src/game/career/CareerEvents';
import { isPartUnlocked, partStatus } from '../../../src/game/career/CareerProgression';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { familyOf, incompatibility } from '../../../src/game/career/tuning/BuildResolverV2';
import { findPart, GENERIC_V2_CATEGORIES } from '../../../src/game/career/tuning/parts';

const bmw = findCampaignCar('bmw-320i-f30-2014')!;
const s2 = ['ecu-stage2', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo'];
const ch1Done = EVENTS.map((e) => e.id);
const upTo = (order: number) => [...ch1Done, ...CHAPTER2_EVENTS.filter((e) => e.order <= order).map((e) => e.id)];

describe('generic car hardware on modern engines', () => {
  it('fits the 320i, while classic engine parts stay out', () => {
    for (const id of ['weight-light', 'radiator-large', 'oil-cooler', 'fan-upgrade', 'tires-width-1', 'tires-pressure-street'])
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
    const oil = resolveBuild(findCampaignCar('honda-civic-si-2008')!, ['oil-cooler'], {}, 2);
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

describe('Stage 2 of the factory turbo', () => {
  it('gains 20–30 % on every factory-turbo car of chapter 2', () => {
    for (const car of CHAPTER2_CARS.filter((c) => c.engine.induction === 'turbo')) {
      const stock = resolveBuild(car, [], {}, 2);
      if (!stock.ok) throw new Error(car.id);
      const r = [[], ['at-upgrade'], ['dct-upgrade'], ['clutch-reinforced'], ['pistons-forged-modern', 'at-upgrade'], ['pistons-forged-modern', 'dct-upgrade'], ['pistons-forged-modern', 'clutch-reinforced']]
        .map((x) => resolveBuild(car, [...s2, ...x], {}, 2))
        .find((b) => b.ok);
      if (!r?.ok) throw new Error(`${car.id}: Stage 2 sem build válido`);
      const gain = r.peakPowerCv / stock.peakPowerCv - 1;
      expect(gain, car.id).toBeGreaterThanOrEqual(0.2);
      expect(gain, car.id).toBeLessThanOrEqual(0.3);
    }
  });

  it('refuses the map without its hardware, forged internals or a stronger gearbox', () => {
    const noDp = resolveBuild(bmw, ['ecu-stage2', 'intercooler-race'], {}, 2);
    expect(noDp.ok).toBe(false);
    if (!noDp.ok) expect(noDp.errors.join()).toMatch(/downpipe/);
    const noIc = resolveBuild(bmw, ['ecu-stage2', 'downpipe-catless'], {}, 2);
    expect(noIc.ok).toBe(false);
    if (!noIc.ok) expect(noIc.errors.join()).toMatch(/intercooler/);
    const evo = findCampaignCar('mitsubishi-evo-x-2012')!;
    const bare = resolveBuild(evo, s2, {}, 2);
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.errors.join()).toMatch(/forjados/);
    // the gearbox has to carry the new torque (manual 208: reinforced clutch)
    const p208 = findCampaignCar('peugeot-208-gt-2017')!;
    const cl = resolveBuild(p208, [...s2, 'pistons-forged-modern'], {}, 2);
    expect(cl.ok).toBe(false);
    if (!cl.ok) expect(cl.errors.join()).toMatch(/embreagem/);
    expect(resolveBuild(p208, [...s2, 'pistons-forged-modern', 'clutch-reinforced'], {}, 2).ok).toBe(true);
  });

  it('opens at the 8th event; Stage 3 opens at the 5th duel of chapter 3; never fits an NA engine', () => {
    expect(isPartUnlocked({ completedEventIds: upTo(7) }, findPart('ecu-stage2')!)).toBe(false);
    expect(isPartUnlocked({ completedEventIds: upTo(8) }, findPart('ecu-stage2')!)).toBe(true);
    // chapter 2 complete: chapter 3 is open, but the map of Stage 3 waits for the 5th duel
    const ch3 = (k: number) => [...upTo(10), ...CHAPTER3_EVENTS.filter((e) => e.order <= k).map((e) => e.id)];
    const st3 = partStatus({ completedEventIds: upTo(10), inventoryPartIds: [], credits: 1e6 }, { baseCarId: bmw.id, installedParts: [] }, findPart('ecu-stage3')!);
    expect(st3.state).toBe('locked');
    expect(st3.label).toBe('Duelo 5');
    expect(partStatus({ completedEventIds: ch3(4), inventoryPartIds: [], credits: 1e6 }, { baseCarId: bmw.id, installedParts: [] }, findPart('ecu-stage3')!).state).toBe('locked');
    expect(partStatus({ completedEventIds: ch3(5), inventoryPartIds: [], credits: 1e6 }, { baseCarId: bmw.id, installedParts: [] }, findPart('ecu-stage3')!).state).toBe('available');
    // chapter 2 not complete: chapter 3 is still closed
    expect(partStatus({ completedEventIds: upTo(9), inventoryPartIds: [], credits: 1e6 }, { baseCarId: bmw.id, installedParts: [] }, findPart('ecu-stage3')!).label).toBe('Capítulo 3');
    expect(incompatibility(findCampaignCar('honda-civic-si-2008')!, findPart('ecu-stage2')!)).not.toBeNull();
  });
});
