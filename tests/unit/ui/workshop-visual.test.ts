/** Logic of the visual workshop: preview without touching the save, search/filters, friendly copy, comparison numbers. */
import { describe, expect, it } from 'vitest';
import { CAREER_CARS, findCampaignCar } from '../../../src/data/cars/campaign';
import { CareerController } from '../../../src/game/career/CareerController';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { EVENTS } from '../../../src/game/career/CareerEvents';
import { ALL_PARTS, CATEGORY_LABEL, WORKSHOP_TABS, findPart, type PartCategory } from '../../../src/game/career/tuning/parts';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { careerResolverVersion } from '../../../src/game/career/tuning/resolverVersion';
import { MemoryStore } from '../../../src/storage/db';
import { CATEGORY_HELP, COMPARE_FRIENDLY, FILTERS, L, TAB_COPY, friendlyIssue, friendlyOpError, layoutNote, stockSpec } from '../../../src/ui/career/workshop-visual/WorkshopCopy';
import { comparisonRows, prosAndCons } from '../../../src/ui/career/workshop-visual/WorkshopComparisonPanel';
import { buildCatalog, fitsCar, visiblePartsOf } from '../../../src/ui/career/workshop-visual/WorkshopPartCatalog';
import { previewSelection, statusOf } from '../../../src/ui/career/workshop-visual/WorkshopPreviewModel';
import { matchesFilter, matchesQuery, normalize } from '../../../src/ui/career/workshop-visual/WorkshopSearchFilters';
import { WorkshopVisualState } from '../../../src/ui/career/workshop-visual/WorkshopVisualState';
import { workshopCategoryOf, workshopLocation } from '../../../src/ui/workshop/WorkshopSlotMapping';

type Internal = { commit(fn: (s: import('../../../src/game/career/CareerState').CareerSave) => void): Promise<unknown> };
const win = (id: string) => ({
  attemptId: `${id}-ws`, eventId: id, playerCarId: '', opponentCarId: 'r', outcome: 'win' as const, completedAt: new Date().toISOString(), buildVersion: 1, playerBuildKey: 'k', opponentBuildKey: 'k',
  playerResult: { name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false },
  opponentResult: { name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false },
});

async function chevette(credits = 80_000): Promise<CareerController> {
  const c = new CareerController(new CareerRepository(new MemoryStore(), 'slot-1'));
  const r = await c.newCareer('gm-chevette-sl-1988');
  if (!r.ok) throw new Error(r.error);
  for (const e of EVENTS.filter((x) => x.order <= 5)) {
    const res = await c.recordRace({ ...win(e.id), playerCarId: c.activeCar!.id });
    if (!res.ok) throw new Error(res.error);
  }
  await (c as unknown as Internal).commit((s) => void (s.credits = credits));
  return c;
}

describe('preview before buying (V01-V12)', () => {
  it('previewing any selection never touches the save, the credits or the stock', async () => {
    const c = await chevette();
    const before = JSON.stringify(c.save);
    for (const id of ['exhaust-sport', 'tires-semislick', 'turbo-basic', 'cam-sport', 'nitrous-street', 'clutch-reinforced', 'stock:exhaust', 'stock:tires']) previewSelection(c.save!, c.activeCar!, id);
    expect(JSON.stringify(c.save)).toBe(before);
    expect(c.save!.credits).toBe(80_000);
  });

  it('the preview is the resolver: its numbers are the build the purchase would make', async () => {
    const c = await chevette();
    const car = c.activeCar!;
    const p = previewSelection(c.save!, car, 'cam-sport');
    const direct = resolveBuild(findCampaignCar(car.baseCarId)!, ['cam-sport'], {}, 1);
    expect(p.state).toBe('preview');
    expect(p.after.ok && direct.ok && p.after.peakPowerCv === direct.peakPowerCv).toBe(true);
    expect(p.afterCar).not.toBeNull();
  });

  it('a part that needs other parts previews the build the plan would install (pending requirements)', async () => {
    const c = await chevette();
    const p = previewSelection(c.save!, c.activeCar!, 'turbo-basic');
    expect(p.plan).not.toBeNull();
    expect(p.state).toBe('preview-pending');
    expect(p.nextParts).toEqual(p.plan!.parts);
    expect(p.plan!.steps.length).toBeGreaterThan(1);
    expect(c.activeCar!.installedParts).toEqual([]);
  });

  it('shows external changes only when the resolved cars differ on the outside', async () => {
    const c = await chevette();
    expect(previewSelection(c.save!, c.activeCar!, 'exhaust-sport').external).toEqual(['exhaust-tip']);
    expect(previewSelection(c.save!, c.activeCar!, 'tires-sport').external).toEqual(['tyre']);
    expect(previewSelection(c.save!, c.activeCar!, 'cam-sport').external).toEqual([]);
    expect(previewSelection(c.save!, c.activeCar!, 'filter-sport').external).toEqual([]);
  });

  it('states: original for the factory part in use, equipped once installed, preview otherwise', async () => {
    const c = await chevette();
    expect(previewSelection(c.save!, c.activeCar!, 'stock:exhaust').state).toBe('original');
    const bought = await c.buyPart('exhaust-sport');
    expect(bought.ok).toBe(true);
    expect(previewSelection(c.save!, c.activeCar!, 'exhaust-sport').state).toBe('equipped');
    expect(previewSelection(c.save!, c.activeCar!, 'stock:exhaust').state).toBe('preview');
    // equipped: the "other" car is the one without the part
    expect(previewSelection(c.save!, c.activeCar!, 'exhaust-sport').afterCar!.visual.mods?.sportTip).toBeFalsy();
  });

  it('buying through the controller is what changes the save (price charged once)', async () => {
    const c = await chevette();
    const price = findPart('exhaust-sport')!.price;
    previewSelection(c.save!, c.activeCar!, 'exhaust-sport');
    expect(c.save!.credits).toBe(80_000);
    const r = await c.buyPart('exhaust-sport');
    expect(r.ok).toBe(true);
    expect(c.save!.credits).toBe(80_000 - price);
    expect(c.activeCar!.installedParts).toContain('exhaust-sport');
  });

  it('status of locked and available parts is the progression one', async () => {
    const c = await chevette();
    const st = statusOf(c.save!, c.activeCar!, findPart('exhaust-sport')!);
    expect(['available', 'locked']).toContain(st.state);
  });
});

describe('catalogue, search and filters (V13-V20)', () => {
  it('maps every part to one presentation location and separates turbo kits from turbine upgrades', () => {
    for (const p of ALL_PARTS) {
      const location = workshopLocation(p);
      expect(workshopCategoryOf(location.slot), p.id).toBe(location.category);
    }
    expect(workshopLocation(findPart('turbo-basic')!)).toEqual({ category: 'turbo', slot: 'turbo' });
    expect(workshopLocation(findPart('factory-turbo-bmw-n20-s1')!)).toEqual({ category: 'turbo', slot: 'turbo-turbine' });
    expect(workshopCategoryOf('boost-control')).toBe('turbo');
    expect(workshopCategoryOf('intercooler')).toBe('turbo');
  });

  it('retains an addressable, duplicate-free catalog for every campaign car', async () => {
    const c = await chevette();
    for (const base of CAREER_CARS) {
      const owned = { ...c.activeCar!, baseCarId: base.id, installedParts: [], buildVersion: careerResolverVersion(base.id) };
      const catalog = buildCatalog(c.save!, owned, (p) => statusOf(c.save!, owned, p));
      const groups = catalog.tabs.flatMap((tab) => tab.groups);
      const ids = groups.flatMap((g) => g.parts.map((p) => p.part.id));
      expect(ids.length, base.id).toBeGreaterThan(0);
      expect(ids.length, base.id).toBe(new Set(ids).size);
      expect(new Set(ids), base.id).toEqual(new Set(visiblePartsOf(owned).map((p) => p.id)));
      expect(new Set(groups.map((g) => g.category)).size, base.id).toBe(groups.length);
    }
  });
  it('tabs, groups and the factory slot come from the same data as the classic workshop', async () => {
    const c = await chevette();
    const cat = buildCatalog(c.save!, c.activeCar!, (p) => statusOf(c.save!, c.activeCar!, p));
    expect(cat.tabs.map((t) => t.id)).toEqual(expect.arrayContaining(['engine', 'intake', 'exhaust', 'transmission', 'tires', 'turbo', 'electronics', 'cooling', 'chassis']));
    expect(cat.tabs.find((t) => t.id === 'intake')!.groups.map((g) => g.category)).toEqual(['intake-filter', 'intake-manifold', 'intake-throttle', 'intake-airbox']);
    for (const g of cat.tabs.flatMap((t) => t.groups)) expect(g.stockInUse).toBe(true);
    expect(visiblePartsOf(c.activeCar!).length).toBeGreaterThan(40);
  });

  it('search ignores accents and case, needs every word, and understands everyday words', () => {
    expect(normalize('Pressão')).toBe('pressao');
    expect(matchesQuery('Turbina Pequena turbo', 'turbina')).toBe(true);
    expect(matchesQuery('Kit Turbo Básico', 'turbina')).toBe(true); // everyday word -> catalogue word
    expect(matchesQuery('Escapamento esportivo escape', 'ESCAPE esport')).toBe(true);
    expect(matchesQuery('Filtro de ar', 'turbo')).toBe(false);
    expect(matchesQuery('qualquer coisa', '   ')).toBe(true);
  });

  it('every filter keeps the right states', () => {
    expect(matchesFilter('all', 'locked', () => false)).toBe(true);
    expect(matchesFilter('available', 'available', () => false)).toBe(true);
    expect(matchesFilter('available', 'locked', () => false)).toBe(false);
    expect(matchesFilter('equipped', 'installed', () => false)).toBe(true);
    expect(matchesFilter('stock', 'owned', () => false)).toBe(true);
    expect(matchesFilter('locked', 'locked', () => false)).toBe(true);
    expect(matchesFilter('compatible', 'available', () => true)).toBe(true);
    expect(matchesFilter('compatible', 'available', () => false)).toBe(false);
    expect(FILTERS.map((f) => f.id)).toEqual(['all', 'available', 'equipped', 'stock', 'locked', 'compatible', 'incompatible']);
  });

  it('"compatible" asks the resolver (a turbo part alone does not fit a car without the kit)', async () => {
    const c = await chevette();
    expect(fitsCar(c.activeCar!, findPart('exhaust-sport')!)).toBe(true);
    expect(fitsCar(c.activeCar!, findPart('turbine-small')!)).toBe(false);
  });
});

describe('selection state', () => {
  it('notifies only the keys that really changed', () => {
    const s = new WorkshopVisualState();
    const seen: string[][] = [];
    s.subscribe((_, changed) => seen.push([...changed]));
    s.patch({ query: 'a' });
    s.patch({ query: 'a' });
    s.patch({ selected: 'x', version: 'with' });
    expect(seen).toEqual([['query'], ['selected', 'version']]);
    expect(s.value.selected).toBe('x');
  });
});

describe('friendly copy (V31-V37)', () => {
  it('every slot has a friendly explanation, a label and a friendly tab', () => {
    for (const c of Object.keys(CATEGORY_LABEL) as PartCategory[]) {
      expect(CATEGORY_HELP[c], c).toBeTruthy();
      expect(CATEGORY_HELP[c]!.length, c).toBeGreaterThan(20);
    }
    for (const t of WORKSHOP_TABS) expect(TAB_COPY[t.id], t.id).toBeDefined();
  });

  it('player-facing words avoid the terms of the plan (spool, knock, boost, build inválido)', () => {
    const texts = [...Object.values(L), ...Object.values(CATEGORY_HELP), ...Object.values(TAB_COPY).flatMap((t) => [t.label, t.help]), ...Object.values(COMPARE_FRIENDLY)];
    for (const t of texts) expect(/\b(spool|knock|boost|build inválido|hardware)\b/i.test(t), t).toBe(false);
    expect(TAB_COPY.tires!.label).toBe('Rodas e pneus');
    expect(L.restoreAll).toBe('Voltar à configuração original');
    expect(L.installOwned).toBe('Instalar peça que já tenho');
    expect(L.details).toBe('Detalhes da peça');
    expect(L.chooseTitle).toBe('Escolha o que melhorar');
    expect(L.available).toBe('Peças disponíveis');
    expect(L.beforeAfter).toBe('Antes e depois');
    expect(L.whatChanges).toBe('O que muda no carro');
    expect(L.whatIsMissing).toBe('O que falta');
    expect(L.works).toBe('Funciona neste carro?');
    expect(L.needsAdjust).toBe('Esta combinação precisa de ajustes');
  });

  it('resolver sentences become friendly ones and keep the original for the technical section', () => {
    const f = friendlyIssue('o torque do turbo (256 N·m) passa do que a embreagem segura com folga (293 N·m): instale a embreagem reforçada');
    expect(f.code).toBe('clutch-limit');
    expect(f.friendly).toContain('embreagem');
    expect(f.technical).toContain('256 N·m');
    expect(friendlyIssue('detonação: este motor perde 30 % do torque').friendly).toContain('detonação');
    expect(friendlyOpError('créditos insuficientes: Turbo custa 4000 CR, você tem 100 CR')).toContain('Você não tem créditos suficientes');
    expect(friendlyOpError('incompatível: pressão fora da faixa do kit (0,40 a 1,00 bar)')).not.toContain('incompatível');
  });

  it('nitro and gearbox wording follow the current systems', () => {
    expect(L.nitroKit).toContain('Shift');
    expect(L.nitroKit).toContain('Dyno Lab');
    expect(L.nitroKit.toLowerCase()).not.toContain('armar');
    expect(L.gearboxUpgradeNote).toContain('manual');
    expect(CATEGORY_HELP.gearbox).toContain('vira manual');
  });

  it('technical note names the layout of the car', () => {
    const n = layoutNote('Gol GTS', { position: 'front', orientation: 'transverse' }, 'front');
    expect(n).toContain('motor dianteiro transversal');
    expect(n).toContain('tração dianteira');
    expect(layoutNote('X', { position: 'mid', orientation: 'longitudinal' }, 'rear')).toContain('motor central longitudinal, tração traseira');
    expect(stockSpec(findCampaignCar('gm-chevette-sl-1988')!, 'exhaust')).toContain('Escapamento original');
  });
});

describe('comparison uses the real numbers (V25-V30)', () => {
  it('rows carry the resolver values; nothing is invented and unchanged rows show no marker', async () => {
    const c = await chevette();
    const p = previewSelection(c.save!, c.activeCar!, 'cam-sport');
    if (!p.before.ok || !p.after.ok) throw new Error('build');
    const { summary, advanced } = comparisonRows(p.before, p.after, null, null);
    const power = summary.find((r) => r.technical === 'Potência')!;
    expect(power.a).toBe(p.before.peakPowerCv);
    expect(power.b).toBe(p.after.peakPowerCv);
    expect(power.label).toBe('Potência');
    expect(summary.find((r) => r.technical === 'Torque')!.label).toBe('Força do motor');
    expect(advanced.map((r) => r.technical)).toEqual(expect.arrayContaining(['Torque', '402 m (estimativa)', '1 km (estimativa)']));
    // estimates are labelled as estimates and stay unresolved ("…") until computed
    for (const r of summary.filter((x) => x.technical.includes('estimativa'))) {
      expect(r.source).toBe('estimate');
      expect(r.before).toBe('…');
    }
    // an exhaust changes no mass: no marker on the weight row
    const q = previewSelection(c.save!, c.activeCar!, 'filter-sport');
    if (!q.before.ok || !q.after.ok) throw new Error('build');
    expect(comparisonRows(q.before, q.after, null, null).summary.find((r) => r.technical === 'Massa')!.kind).toBeNull();
  });

  it('pros and cons are derived from the numbers: a gain is a pro, a loss a con', async () => {
    const c = await chevette();
    const p = previewSelection(c.save!, c.activeCar!, 'cam-sport');
    if (!p.before.ok || !p.after.ok) throw new Error('build');
    const pc = prosAndCons(p.before, p.after);
    const d = p.after.peakPowerCv - p.before.peakPowerCv;
    if (d > 0.05) expect(pc.pros.join(' ')).toContain('Mais potência');
    if (d < -0.05) expect(pc.cons.join(' ')).toContain('Menos potência');
    const heavy = prosAndCons({ ...p.before, car: { ...p.before.car, massKg: 900 } } as never, { ...p.after, car: { ...p.after.car, massKg: 910 } } as never);
    expect(heavy.cons.join(' ')).toContain('Mais pesado: +10,0 kg');
  });
});
