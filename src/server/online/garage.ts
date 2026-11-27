import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import { findCampaignCar } from '../../data/cars/campaign';
import { resolveBuild, type ResolverVersion } from '../../game/career/tuning/BuildResolver';
import type { BuildTune } from '../../game/career/tuning/buildCommon';
import { physicalSlotOf } from '../../game/career/tuning/partProgression';
import { CATEGORY_ORDER, findPart } from '../../game/career/tuning/parts';
import { careerResolverVersion } from '../../game/career/tuning/resolverVersion';
import { failureSpecFor, reconcileTune, validateTune } from '../../game/career/tuning/TuningCapabilities';
import { ONLINE_MARKET } from '../../game/online/catalog';
import type { GarageRequest, Onboarding } from '../../game/online/contracts';
import { ONLINE_STARTERS } from '../../game/online/demoCatalog';
import { ONLINE_MAX_GARAGE, ONLINE_TERMS_VERSION } from '../../game/online/economy';
import { PREPARATION_TREES } from '../../game/online/preparation';
import { onlineWorkshopTree, replaceOnlinePart, restoreOnlineSlots } from '../../game/online/workshopBuild';
import type { OnlineIdentity } from './auth';
import { OnlineError } from './OnlineError';

type Sql = postgres.Sql | postgres.TransactionSql;

interface CarRow {
  id: string;
  base_car_id: string;
  purchase_price: number;
  paint: string | null;
  build_version: ResolverVersion;
  build_revision: number;
  pp_balance: number;
  pp_earned_total: number;
  pp_spent_total: number;
  tree_version: number;
  wins: number;
  losses: number;
  total_races: number;
  tune: BuildTune;
  parts: string[];
  unlocks: string[];
}

interface BalanceConfig {
  startCredits: number;
  startRp: number;
}

export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function baseCar(baseCarId: string) {
  const base = findCampaignCar(baseCarId);
  if (!base) throw new OnlineError(404, 'Modelo indisponível no catálogo.');
  return base;
}

function buildFor(car: CarRow) {
  const base = baseCar(car.base_car_id);
  const result = resolveBuild(base, car.parts, car.tune, car.build_version);
  if (!result.ok) throw new OnlineError(409, result.errors.join('. '));
  return { base, result };
}

export async function savePreparationCatalog(sql: postgres.Sql): Promise<void> {
  const nodes = [...PREPARATION_TREES.values()].flatMap((tree) => tree.nodes.map((node) => ({
    tree_id: tree.id, tree_version: tree.version, node_id: node.id, branch_id: node.branchId,
    tier: node.tier, cost_pp: node.costPP, definition: sql.json({ ...node }),
  })));
  await sql`insert into online_preparation_nodes ${sql(nodes)} on conflict do nothing`;
}

export class OnlineGarage {
  constructor(readonly sql: postgres.Sql, private readonly balance: BalanceConfig) {}

  async create(identity: OnlineIdentity, input: Onboarding): Promise<void> {
    if (!(ONLINE_STARTERS as readonly string[]).includes(input.baseCarId)) throw new OnlineError(400, 'Escolha um carro inicial válido.');
    await this.sql.begin(async (tx) => {
      const [existing] = await tx`select user_id from online_profiles where user_id = ${identity.id}`;
      if (existing) return;
      const [profile] = await tx`insert into online_profiles (user_id, nickname, avatar_url, terms_version)
        values (${identity.id}, ${input.nickname.normalize('NFC')}, ${input.useGoogleAvatar ? identity.avatarUrl : null}, ${ONLINE_TERMS_VERSION})
        on conflict do nothing returning user_id`;
      if (!profile) {
        if ((await tx`select user_id from online_profiles where user_id = ${identity.id}`).length) return;
        throw new OnlineError(409, 'Este nickname já está em uso.');
      }
      await tx`insert into online_wallets (user_id, cr_balance) values (${identity.id}, ${this.balance.startCredits})`;
      await tx`insert into online_ratings (user_id, rp, highest_rp) values (${identity.id}, ${this.balance.startRp}, ${this.balance.startRp})`;
      const carId = await this.insertCar(tx, identity.id, input.baseCarId, 0, null);
      await tx`update online_profiles set active_car_id = ${carId} where user_id = ${identity.id}`;
      await tx`insert into online_currency_ledger (user_id, currency, amount, balance_after, reason, reference_id, idempotency_key)
        values (${identity.id}, 'CR', ${this.balance.startCredits}, ${this.balance.startCredits}, 'primeiro-acesso', ${identity.id}, 'primeiro-acesso'),
               (${identity.id}, 'RP', ${this.balance.startRp}, ${this.balance.startRp}, 'primeiro-acesso', ${identity.id}, 'primeiro-acesso')`;
    });
  }

  async profile(user: string, sql: Sql = this.sql) {
    const [row] = await sql<{ nickname: string; avatar_url: string | null; active_car_id: string; rp: number; cr_balance: number }[]>`
      select p.nickname, p.avatar_url, p.active_car_id, r.rp, w.cr_balance from online_profiles p
      join online_ratings r using(user_id) join online_wallets w using(user_id) where p.user_id = ${user}`;
    return row ?? null;
  }

  async get(user: string) {
    return this.sql.begin('isolation level repeatable read read only', async (tx) => {
      const profile = await this.profile(user, tx);
      if (!profile) return null;
      const cars = await this.cars(tx, user);
      const inventory = await tx<{ base_car_id: string; part_id: string; quantity: number }[]>`
        select base_car_id, part_id, quantity from online_inventory where user_id = ${user} order by part_id`;
      return { profile, inventory: [...inventory], cars: cars.map((car) => {
        const { result } = buildFor(car);
        return { ...car, config: result.car, peakPowerCv: result.peakPowerCv, peakTorqueNm: result.peakTorqueNm };
      }) };
    });
  }

  async cars(sql: Sql, user: string): Promise<CarRow[]> {
    return sql<CarRow[]>`select c.id, c.base_car_id, c.purchase_price, c.paint, c.build_version, c.build_revision,
      p.pp_balance, p.pp_earned_total, p.pp_spent_total, p.tree_version, p.wins, p.losses, p.total_races, t.tune,
      array(select part_id from online_car_parts where car_id = c.id order by part_id) as parts,
      array(select node_id from online_car_unlocks where car_id = c.id and tree_version = p.tree_version order by node_id) as unlocks
      from online_cars c join online_car_progression p on p.car_id = c.id join online_car_tunes t on t.car_id = c.id
      where c.user_id = ${user} and c.sold_at is null order by c.created_at, c.id`;
  }

  async raceBuild(sql: Sql, user: string, carId: string | undefined) {
    const profile = await this.profile(user, sql);
    const cars = await this.cars(sql, user);
    const car = cars.find((item) => item.id === (carId ?? profile?.active_car_id)) ?? (carId ? undefined : cars[0]);
    if (!profile || !car) throw new OnlineError(409, 'Selecione um carro válido da sua garagem.');
    const { base, result } = buildFor(car);
    const config = structuredClone(result.car);
    if (car.paint) config.visual.color = car.paint;
    return { carId: car.id, revision: car.build_revision, car: config, name: profile.nickname, failureSpec: failureSpecFor(base, car.parts, car.build_version) };
  }

  async apply(user: string, request: GarageRequest, active: () => boolean): Promise<{ carId: string }> {
    return this.sql.begin(async (tx) => {
      const [profile] = await tx<{ active_car_id: string }[]>`select active_car_id from online_profiles where user_id = ${user} for update`;
      if (!profile) throw new OnlineError(404, 'Crie seu perfil online primeiro.');
      const requestHash = digest(request.operation);
      const [previous] = await tx<{ request_hash: string; result: { carId: string } }[]>`
        select request_hash, result from online_operations where user_id = ${user} and operation_id = ${request.operationId}`;
      if (previous) {
        if (previous.request_hash !== requestHash) throw new OnlineError(409, 'Identificador de operação já utilizado.');
        return previous.result;
      }
      if (active()) throw new OnlineError(409, 'Saia da fila ou aguarde o término da partida para alterar a garagem.');
      const cars = await this.cars(tx, user);
      const operation = request.operation;
      let id: string;
      if (operation.kind === 'buy') {
        const offer = ONLINE_MARKET.find((item) => item.id === operation.baseCarId);
        if (!offer) throw new OnlineError(404, 'Veículo indisponível.');
        if (cars.length >= ONLINE_MAX_GARAGE) throw new OnlineError(409, 'Sua garagem está cheia.');
        id = await this.insertCar(tx, user, offer.id, offer.price, operation.paint ?? null);
        await this.changeCredits(tx, user, id, -offer.price, operation.kind, request.operationId);
      } else {
        const car = cars.find((item) => item.id === operation.carId);
        if (!car) throw new OnlineError(404, 'Veículo indisponível na sua garagem.');
        id = car.id;
        if ('buildRevision' in operation && operation.buildRevision !== car.build_revision) throw new OnlineError(409, 'O projeto foi atualizado. Recarregue a garagem.');
        switch (operation.kind) {
          case 'sell': {
            const replacement = cars.find((item) => item.id !== id);
            if (!replacement) throw new OnlineError(409, 'Mantenha pelo menos um carro na garagem.');
            await tx`update online_cars set sold_at = now() where id = ${id}`;
            if (profile.active_car_id === id) await this.select(tx, user, replacement.id);
            await this.changeCredits(tx, user, id, Math.round(car.purchase_price * 0.6), operation.kind, request.operationId);
            break;
          }
          case 'select': await this.select(tx, user, id); break;
          case 'paint': await tx`update online_cars set paint = ${operation.paint}, build_revision = build_revision + 1 where id = ${id}`; break;
          case 'unlock': await this.unlock(tx, user, car, operation.nodeId, request.operationId); break;
          case 'buyPart':
          case 'install':
          case 'remove': await this.part(tx, user, car, operation.kind, operation.partId, request.operationId); break;
          case 'buyAndInstall': await this.installSet(tx, user, car, [operation.partId], 'buy', operation.kind, request.operationId); break;
          case 'installBundle': await this.installSet(tx, user, car, operation.partIds, 'auto', operation.kind, request.operationId, operation.maxCost); break;
          case 'restoreStock': await this.restore(tx, user, car, operation.scope === 'all' ? null : operation.slotIds ?? [operation.slotId!]); break;
          case 'tune': await this.updateBuild(tx, car, car.parts, operation.tune); break;
        }
      }
      const result = { carId: id };
      await tx`insert into online_operations (user_id, operation_id, request_hash, result)
        values (${user}, ${request.operationId}, ${requestHash}, ${tx.json(result)})`;
      return result;
    });
  }

  private async insertCar(sql: Sql, user: string, baseId: string, price: number, paint: string | null): Promise<string> {
    const tree = PREPARATION_TREES.get(baseId);
    if (!tree) throw new OnlineError(404, 'Árvore de preparação indisponível.');
    const [car] = await sql<{ id: string }[]>`insert into online_cars (user_id, base_car_id, paint, purchase_price, build_version)
      values (${user}, ${baseId}, ${paint}, ${price}, ${careerResolverVersion(baseId)}) returning id`;
    const id = car!.id;
    await sql`insert into online_car_progression (car_id, tree_id, tree_version) values (${id}, ${tree.id}, ${tree.version})`;
    await sql`insert into online_car_tunes (car_id) values (${id})`;
    await sql`insert into online_car_unlocks (car_id, tree_id, tree_version, node_id, pp_spent)
      values (${id}, ${tree.id}, ${tree.version}, 'original', 0)`;
    return id;
  }

  private async select(sql: Sql, user: string, carId: string): Promise<void> {
    await sql`update online_profiles set active_car_id = ${carId}, updated_at = now() where user_id = ${user}`;
  }

  private async changeCredits(sql: Sql, user: string, carId: string, amount: number, reason: string, operationId: string): Promise<void> {
    const [wallet] = await sql<{ cr_balance: number }[]>`update online_wallets set cr_balance = cr_balance + ${amount}, version = version + 1, updated_at = now()
      where user_id = ${user} and cr_balance + ${amount} >= 0 returning cr_balance`;
    if (!wallet) throw new OnlineError(409, 'Créditos insuficientes.');
    await sql`insert into online_currency_ledger (user_id, car_id, currency, amount, balance_after, reason, reference_id, idempotency_key)
      values (${user}, ${carId}, 'CR', ${amount}, ${wallet.cr_balance}, ${reason}, ${carId}, ${operationId})`;
  }

  private async unlock(sql: Sql, user: string, car: CarRow, nodeId: string, operationId: string): Promise<void> {
    const tree = PREPARATION_TREES.get(car.base_car_id);
    const node = tree?.nodes.find((item) => item.id === nodeId);
    if (!tree || !node || tree.version !== car.tree_version) throw new OnlineError(404, 'Preparação indisponível.');
    if (car.unlocks.includes(nodeId)) return;
    if (!node.prerequisites.every((item) => car.unlocks.includes(item))) throw new OnlineError(409, 'Desbloqueie os pré-requisitos primeiro.');
    const [balance] = await sql<{ pp_balance: number }[]>`update online_car_progression set pp_balance = pp_balance - ${node.costPP},
      pp_spent_total = pp_spent_total + ${node.costPP}, updated_at = now()
      where car_id = ${car.id} and pp_balance >= ${node.costPP} returning pp_balance`;
    if (!balance) throw new OnlineError(409, 'Pontos de preparação insuficientes neste veículo.');
    await sql`insert into online_car_unlocks (car_id, tree_id, tree_version, node_id, pp_spent)
      values (${car.id}, ${tree.id}, ${tree.version}, ${node.id}, ${node.costPP})`;
    await sql`insert into online_currency_ledger (user_id, car_id, currency, amount, balance_after, reason, reference_id, idempotency_key)
      values (${user}, ${car.id}, 'PP', ${-node.costPP}, ${balance.pp_balance}, 'desbloqueio', ${node.id}, ${operationId})`;
  }

  private async part(sql: Sql, user: string, car: CarRow, kind: 'buyPart' | 'install' | 'remove', partId: string, operationId: string): Promise<void> {
    if (kind === 'buyPart') {
      const part = this.unlockedPart(car, partId);
      await this.changeCredits(sql, user, car.id, -part.price, kind, operationId);
      await this.stock(sql, user, car.base_car_id, partId);
      return;
    }
    if (kind === 'install') {
      this.unlockedPart(car, partId);
      if (!car.parts.includes(partId)) await this.installSet(sql, user, car, [partId], 'stock', kind, operationId);
      return;
    }
    if (!car.parts.includes(partId)) throw new OnlineError(404, 'Peça não instalada.');
    await this.updateParts(sql, user, car, car.parts.filter((id) => id !== partId), [partId], []);
  }

  private unlockedPart(car: CarRow, id: string) {
    const part = findPart(id);
    const node = onlineWorkshopTree(car.base_car_id, car.tree_version)?.nodes.find((item) => item.unlocksPartIds.includes(id));
    if (!part || !node || !car.unlocks.includes(node.id)) throw new OnlineError(409, 'Peça indisponível ou bloqueada neste projeto.');
    return part;
  }

  private async consumeStock(sql: Sql, user: string, baseId: string, partId: string): Promise<boolean> {
    const removed = await sql`delete from online_inventory
      where user_id = ${user} and base_car_id = ${baseId} and part_id = ${partId} and quantity = 1 returning id`;
    if (removed.length) return true;
    const reduced = await sql`update online_inventory set quantity = quantity - 1
      where user_id = ${user} and base_car_id = ${baseId} and part_id = ${partId} and quantity > 1 returning id`;
    return reduced.length > 0;
  }

  private async installSet(sql: Sql, user: string, car: CarRow, ids: string[], source: 'stock' | 'buy' | 'auto', reason: string, operationId: string, maxCost?: number): Promise<void> {
    const parts = ids.map((id) => this.unlockedPart(car, id));
    if (new Set(parts.map(physicalSlotOf)).size !== parts.length) throw new OnlineError(409, 'Selecione apenas uma peça por slot.');
    const added = parts.filter((p) => !car.parts.includes(p.id));
    if (!added.length) return;
    let next = [...car.parts];
    const removed: string[] = [];
    let cost = 0;
    for (const p of added) {
      const replacement = replaceOnlinePart(next, p.id);
      next = replacement.parts;
      if (replacement.replaced) removed.push(replacement.replaced);
      const inStock = source !== 'buy' && await this.consumeStock(sql, user, car.base_car_id, p.id);
      if (!inStock && source === 'stock') throw new OnlineError(409, 'Compre a peça antes de instalar.');
      if (!inStock) cost += p.price;
    }
    if (maxCost !== undefined && cost > maxCost) throw new OnlineError(409, 'O custo do conjunto mudou. Confira o estoque e confirme novamente.');
    // All inventory changes, build validation and the single CR movement use the surrounding transaction.
    await this.updateParts(sql, user, car, next, removed, added.map((p) => p.id));
    if (cost) await this.changeCredits(sql, user, car.id, -cost, reason, operationId);
  }

  private async restore(sql: Sql, user: string, car: CarRow, slots: readonly string[] | null): Promise<void> {
    if (slots?.some((slot) => !(CATEGORY_ORDER as readonly string[]).includes(slot))) throw new OnlineError(400, 'Slot de preparação inválido.');
    const next = slots ? restoreOnlineSlots(car.parts, slots) : { removed: car.parts, parts: [] };
    if (!next.removed.length) return;
    await this.updateParts(sql, user, car, next.parts, next.removed, []);
  }

  private async updateParts(sql: Sql, user: string, car: CarRow, next: string[], removed: readonly string[], added: readonly string[]): Promise<void> {
    const tune = reconcileTune(baseCar(car.base_car_id), next, careerResolverVersion(car.base_car_id, next, car.build_version), car.tune, { tunersUnlocked: true }).tune;
    await this.updateBuild(sql, car, next, tune);
    for (const id of removed) {
      await sql`delete from online_car_parts where car_id = ${car.id} and part_id = ${id}`;
      await this.stock(sql, user, car.base_car_id, id);
    }
    for (const id of added) {
      const slot = physicalSlotOf(findPart(id)!);
      await sql`insert into online_car_parts (user_id, car_id, part_id, physical_slot) values (${user}, ${car.id}, ${id}, ${slot})`;
    }
  }

  private async stock(sql: Sql, user: string, baseId: string, partId: string): Promise<void> {
    await sql`insert into online_inventory (user_id, base_car_id, part_id, quantity) values (${user}, ${baseId}, ${partId}, 1)
      on conflict (user_id, base_car_id, part_id) do update set quantity = online_inventory.quantity + 1`;
  }

  private async updateBuild(sql: Sql, car: CarRow, parts: string[], tune: BuildTune): Promise<void> {
    const version = careerResolverVersion(car.base_car_id, parts, car.build_version);
    const base = baseCar(car.base_car_id);
    const errors = validateTune(base, parts, version, tune, { tunersUnlocked: true });
    if (errors.length) throw new OnlineError(409, errors.join('. '));
    buildFor({ ...car, parts, tune, build_version: version });
    await sql`update online_cars set build_version = ${version}, build_revision = build_revision + 1 where id = ${car.id}`;
    await sql`update online_car_tunes set tune = ${sql.json({ ...tune })}, revision = revision + 1, updated_at = now() where car_id = ${car.id}`;
  }
}
