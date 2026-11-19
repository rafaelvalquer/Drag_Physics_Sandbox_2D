/** Structured build issues, the install planner ("install with requirements") and the atomic bundle. */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { EVENTS } from '../../../src/game/career/CareerEvents';
import { CareerController, buildVersionFor, inventoryEntry } from '../../../src/game/career/CareerController';
import { CareerRepository } from '../../../src/game/career/CareerRepository';
import { classifyError, issuesOf } from '../../../src/game/career/tuning/buildIssues';
import { planInstall } from '../../../src/game/career/tuning/ProjectRequirements';
import { MemoryStore } from '../../../src/storage/db';

type Internal = { commit(fn: (s: import('../../../src/game/career/CareerState').CareerSave) => void): Promise<unknown> };
const win = (id: string) => ({
  attemptId: `${id}-bundle`, eventId: id, playerCarId: '', opponentCarId: 'r', outcome: 'win' as const, completedAt: new Date().toISOString(), buildVersion: 1, playerBuildKey: 'k', opponentBuildKey: 'k',
  playerResult: { name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false },
  opponentResult: { name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false },
});

async function chevette(credits = 50000): Promise<CareerController> {
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

describe('build issues', () => {
  it('classifies the messages the resolvers emit', () => {
    const cases: [string, string][] = [
      ['turbina, intercooler, wastegate e pressão exigem um kit turbo instalado', 'needs-turbo-kit'],
      ['ajuste de pressão exige kit turbo', 'needs-turbo-kit'],
      ['alimentação de combustível insuficiente para a pressão configurada', 'fuel-limit'],
      ['pressão superior a 0,95 bar exige bicos ou bomba de maior vazão', 'fuel-limit'],
      ['torque excede o limite mecânico dos internos; instale bielas e pistões reforçados', 'internals-limit'],
      ['o torque do turbo (256 N·m) passa do que a embreagem segura com folga (293 N·m): instale a embreagem reforçada', 'clutch-limit'],
      ['as embreagens do câmbio de dupla embreagem (500 N·m) não seguram 600 N·m com folga: instale o upgrade DSG/SST', 'gearbox-limit'],
      ['taxa de compressão 11,4:1 a gasolina não aceita o kit turbo sem detonar (máximo 10,5:1)', 'compression-limit'],
      ['a turbina de maior fluxo exige ECU programável', 'needs-ecu'],
      ['ajuste de pressão exige ECU programável', 'needs-ecu'],
      ['Remap Stage 2 exige downpipe sem catalisador', 'needs-part'],
      ['detonação: este motor perde 30 % do torque em atraso de ignição nesta pressão; baixe a pressão', 'knock'],
      ['pressão fora da faixa do kit (0,40 a 1,00 bar)', 'range'],
    ];
    for (const [msg, code] of cases) expect(classifyError(msg).code, msg).toBe(code);
    expect(issuesOf(['qualquer coisa nova'])[0]!.code).toBe('other');
  });
});

describe('install planner', () => {
  it('lists the parts a kit needs, using the stock first, and the build is valid with them', async () => {
    const c = await chevette();
    const car = c.activeCar!;
    const base = findCampaignCar(car.baseCarId)!;
    // the single install is refused: the clutch must come first
    expect((await c.buyPart('turbo-basic')).ok).toBe(false);
    const plan = planInstall({ base, car, save: c.save!, partId: 'turbo-basic', versionOf: (p) => buildVersionFor(car, p) });
    expect(plan.steps[0]!.partId).toBe('turbo-basic');
    expect(plan.steps.map((s) => s.partId)).toContain('clutch-reinforced');
    expect(plan.openIssues).toEqual([]);
    expect(plan.blockers).toEqual([]);
    expect(plan.ok).toBe(true);
    expect(plan.cost).toBe(plan.steps.reduce((n, s) => n + (s.source === 'buy' ? s.price : 0), 0));
  });
});

describe('atomic bundle', () => {
  it('installs kit and clutch together, charging once', async () => {
    const c = await chevette(20000);
    const plan = planInstall({ base: findCampaignCar(c.activeCar!.baseCarId)!, car: c.activeCar!, save: c.save!, partId: 'turbo-basic', versionOf: (p) => buildVersionFor(c.activeCar!, p) });
    const before = c.save!.credits;
    const r = await c.installBundle(plan.steps.map((s) => s.partId));
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    expect(c.activeCar!.installedParts).toEqual(expect.arrayContaining(plan.steps.map((s) => s.partId)));
    expect(before - c.save!.credits).toBe(plan.cost);
  });

  it('uses the stock for free and changes nothing when the credits fall short or a part is locked', async () => {
    const c = await chevette(100);
    const car = c.activeCar!;
    const snapshot = JSON.stringify([c.save!.credits, car.installedParts, c.save!.inventoryPartIds]);
    expect((await c.installBundle(['clutch-reinforced', 'turbo-basic'])).ok).toBe(false); // credits
    expect((await c.installBundle(['clutch-reinforced', 'ecu-stage3'])).ok).toBe(false); // unknown / locked part
    expect(JSON.stringify([c.save!.credits, c.activeCar!.installedParts, c.save!.inventoryPartIds])).toBe(snapshot);
    // stock part: free
    await (c as unknown as Internal).commit((s) => void s.inventoryPartIds.push(inventoryEntry('clutch-reinforced', car.baseCarId)));
    const credits = c.save!.credits;
    const r = await c.installBundle(['clutch-reinforced']);
    expect(r.ok).toBe(true);
    expect(c.save!.credits).toBe(credits);
    expect(c.save!.inventoryPartIds).not.toContain(inventoryEntry('clutch-reinforced', car.baseCarId));
  });

  it('an invalid final build is refused and nothing is charged', async () => {
    const c = await chevette(50000);
    const before = c.save!.credits;
    const r = await c.installBundle(['turbo-basic']); // clutch missing
    expect(r.ok).toBe(false);
    expect(c.save!.credits).toBe(before);
    expect(c.activeCar!.installedParts).not.toContain('turbo-basic');
  });
});
