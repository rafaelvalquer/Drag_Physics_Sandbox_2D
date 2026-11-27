import { describe, expect, it, vi } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import { findPart } from '../../../src/game/career/tuning/parts';
import type { Garage } from '../../../src/game/online/OnlineClient';
import type { GarageRequest } from '../../../src/game/online/contracts';
import { PREPARATION_TREES } from '../../../src/game/online/preparation';
import { OnlineWorkshopAdapter, type PendingWorkshopOperation } from '../../../src/ui/workshop/OnlineWorkshopAdapter';

const carId = 'a8deda4b-dbd8-4094-b163-3ff467c9286d';
const base = findCampaignCar('gm-chevette-sl-1988')!;
const tree = PREPARATION_TREES.get(base.id)!;
const kit = findPart('turbo-basic')!;
const node = tree.nodes.find((item) => item.unlocksPartIds.includes(kit.id))!;
const action = { kind: 'buyAndInstall', partId: 'exhaust-sport' } as const;

function sample(revision = 7, unlocked: string[] = ['original']): Garage {
  return {
    profile: { nickname: 'Teste', avatar_url: null, active_car_id: carId, rp: 1200, cr_balance: 20000 },
    cars: [{
      id: carId, base_car_id: base.id, config: base, purchase_price: 0, paint: null, build_version: 1,
      build_revision: revision, pp_balance: 500, pp_earned_total: 500, pp_spent_total: 0, tree_version: tree.version,
      wins: 0, losses: 0, total_races: 0, tune: {}, parts: [], unlocks: unlocked,
      peakPowerCv: 82, peakTorqueNm: 105,
    }],
    inventory: [],
  };
}

describe('adaptador da oficina online', () => {
  it('usa a árvore do veículo e permite prévia hipotética sem mutar garagem, carteira ou PP', () => {
    const saved = sample();
    const api = { change: vi.fn(), garage: vi.fn() };
    const adapter = new OnlineWorkshopAdapter(saved, carId, api, new Map(), vi.fn());
    const before = structuredClone(saved);
    expect(adapter.getEligibility(kit)).toMatchObject({ state: 'locked', unlock: { id: node.id, available: 500 } });
    const p = adapter.preview(kit.id);
    expect(p.unlocked).toBe(false);
    expect(p.plan?.steps.some((step) => step.partId === 'clutch-reinforced')).toBe(true);
    expect(p.afterCar?.engine.induction).toBe('turbo');
    expect(saved).toEqual(before);
    expect(api.change).not.toHaveBeenCalled();
    expect(api.garage).not.toHaveBeenCalled();
  });

  it('reconsulta a garagem após conflito de revisão sem reenviar a compra', async () => {
    const api = { change: vi.fn().mockRejectedValue(Object.assign(new Error('O projeto foi atualizado.'), { status: 409 })),
      garage: vi.fn().mockResolvedValue(sample(8)) };
    const pending = new Map<string, PendingWorkshopOperation>();
    const publish = vi.fn();
    const adapter = new OnlineWorkshopAdapter(sample(), carId, api, pending, publish);
    expect(await adapter.execute(action)).toMatchObject({ ok: false, error: 'O projeto foi atualizado.' });
    expect(api.change).toHaveBeenCalledTimes(1);
    expect(adapter.getSnapshot()?.buildRevision).toBe(8);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(0);
  });

  it('reusa o mesmo envelope após timeout e libera nova operação apenas após confirmação', async () => {
    const api = { change: vi.fn().mockRejectedValueOnce(new Error('indeterminado')).mockRejectedValueOnce(new Error('indeterminado')).mockResolvedValue({ carId }),
      garage: vi.fn().mockResolvedValue(sample(8)) };
    const pending = new Map<string, PendingWorkshopOperation>();
    const adapter = new OnlineWorkshopAdapter(sample(), carId, api, pending, vi.fn());
    expect(await adapter.execute(action)).toMatchObject({ ok: false });
    expect(adapter.hasPendingOperation()).toBe(true);
    expect(await adapter.execute({ kind: 'remove', partId: kit.id })).toMatchObject({ ok: false, error: expect.stringContaining('pendente') });
    expect(await adapter.recoverOperation()).toMatchObject({ ok: true });
    const calls = api.change.mock.calls.map(([input]) => input as GarageRequest);
    expect(calls).toHaveLength(3);
    expect(calls.every((input) => input === calls[0])).toBe(true);
    expect(calls[0]?.operation).toMatchObject({ ...action, carId, buildRevision: 7 });
    expect(adapter.hasPendingOperation()).toBe(false);
  });

  it('ignora resposta recebida depois da desmontagem', async () => {
    let complete!: (value: Garage) => void;
    const reply = new Promise<Garage>((resolve) => { complete = resolve; });
    const publish = vi.fn();
    const listener = vi.fn();
    const adapter = new OnlineWorkshopAdapter(sample(), carId, { change: vi.fn(), garage: () => reply }, new Map(), publish);
    adapter.subscribe(listener);
    const refresh = adapter.refresh();
    adapter.dispose();
    complete(sample(9));
    await refresh;
    expect(adapter.getSnapshot()?.buildRevision).toBe(7);
    expect(publish).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});
