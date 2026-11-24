import { expect, it } from 'vitest';
import { CAREER_CARS } from '../../../src/data/cars/campaign';
import { ONLINE_MARKET } from '../../../src/game/online/catalog';
import { eloDelta, ONLINE_REWARD_POLICY, rankCategory } from '../../../src/game/online/economy';
import { compatibleOnlineParts, PREPARATION_TREES } from '../../../src/game/online/preparation';
import { findPart } from '../../../src/game/career/tuning/parts';

it.each(CAREER_CARS.map((car) => [car.id, car] as const))('valida grafo, cobertura e preços de %s', (id, car) => {
  const tree = PREPARATION_TREES.get(id)!;
  const available = new Set(compatibleOnlineParts(car).map((part) => part.id));
  const acquired = new Set<string>();
  const nodes = new Map(tree.nodes.map((node) => [node.id, node]));
  expect(nodes.size).toBe(tree.nodes.length);
  expect([...nodes.values()].filter((node) => !node.prerequisites.length).map((node) => node.id)).toEqual(['original']);
  const visit = (nodeId: string, stack: ReadonlySet<string>): void => {
    expect(stack.has(nodeId)).toBe(false);
    const node = nodes.get(nodeId);
    expect(node).toBeDefined();
    if (acquired.has(nodeId)) return;
    for (const dependency of node!.prerequisites) visit(dependency, new Set([...stack, nodeId]));
    acquired.add(nodeId);
  };
  for (const node of tree.nodes) {
    visit(node.id, new Set());
    expect(Number.isInteger(node.costPP)).toBe(true);
    expect(node.costPP).toBeGreaterThanOrEqual(0);
    for (const id of node.unlocksPartIds) expect(findPart(id)?.price).toBeGreaterThan(0);
  }
  const parts = tree.nodes.flatMap((node) => node.unlocksPartIds);
  expect(new Set(parts)).toEqual(available);
  expect(new Set(parts).size).toBe(parts.length);
  expect(ONLINE_MARKET.find((car) => car.id === id)?.price).toBeGreaterThan(0);
});

it('mantém deltas Elo simétricos e aplica as faixas de categoria', () => {
  expect(eloDelta(1000, 1000, 1)).toBe(16);
  expect(eloDelta(1000, 1000, 0)).toBe(-16);
  expect(eloDelta(1000, 1000, 0.5)).toBe(0);
  expect(eloDelta(1000, 1500, 0.5)).toBe(-eloDelta(1500, 1000, 0.5));
  expect([799, 800, 1100, 1400, 1700].map(rankCategory)).toEqual(['Iniciante', 'Street', 'Preparado', 'Elite', 'Lenda das Ruas']);
  expect(ONLINE_REWARD_POLICY.rewards.forfeit).toEqual({ cr: 0, pp: 0 });
});
