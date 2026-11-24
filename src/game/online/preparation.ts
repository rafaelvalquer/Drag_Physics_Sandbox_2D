import { CAREER_CARS } from '../../data/cars/campaign';
import type { CarConfig } from '../../data/schema';
import { familyOf, incompatibility } from '../career/tuning/BuildResolverV2';
import { progressionOf } from '../career/tuning/partProgression';
import { ALL_PARTS, type PartDef } from '../career/tuning/parts';

const branches = [
  { id: 'aspirado', name: 'Motor aspirado', costs: [10, 25, 60] },
  { id: 'turbo', name: 'Turbo e sobrealimentação', costs: [20, 40, 80] },
  { id: 'internos', name: 'Componentes internos', costs: [10, 25, 60] },
  { id: 'respiracao', name: 'Admissão e escape', costs: [10, 25, 50] },
  { id: 'eletronica', name: 'Eletrônica e gerenciamento', costs: [10, 25, 50] },
  { id: 'transmissao', name: 'Transmissão', costs: [10, 25, 50] },
  { id: 'aderencia', name: 'Pneus e aderência', costs: [10, 25, 50] },
  { id: 'chassi', name: 'Chassi e arrefecimento', costs: [10, 25, 50] },
] as const;

type BranchId = typeof branches[number]['id'];
export const ONLINE_CATALOG_VERSION = 1;

export interface PreparationNode {
  id: string;
  name: string;
  description: string;
  branchId: BranchId | 'original';
  tier: number;
  costPP: number;
  prerequisites: string[];
  unlocksPartIds: string[];
  position: { x: number; y: number };
}

export interface PreparationTreeDefinition {
  id: string;
  version: number;
  engineFamily: string;
  baseCarId: string;
  nodes: PreparationNode[];
  branches: { id: BranchId; name: string }[];
}

function branchFor(part: PartDef, specialization?: string): BranchId {
  const slot = part.category;
  if (slot.startsWith('turbo') || slot === 'intercooler' || slot === 'boost-control' || specialization === 'turbo') return 'turbo';
  if (slot.startsWith('electronics-') || slot === 'ecu' || slot === 'nitrous') return 'eletronica';
  if (slot.startsWith('tires')) return 'aderencia';
  if (slot.startsWith('cooling-') || slot.startsWith('chassis-') || slot === 'suspension') return 'chassi';
  if (slot.startsWith('transmission-') || ['awd', 'gearbox', 'flywheel', 'engine-flywheel', 'clutch', 'differential'].includes(slot)) return 'transmissao';
  if (slot === 'engine-internals' || slot === 'pistons' || slot === 'engine-valvetrain') return 'internos';
  if (specialization === 'aspirado' || slot === 'camshaft' || slot === 'engine-compression') return 'aspirado';
  return 'respiracao';
}

export function compatibleOnlineParts(car: CarConfig): PartDef[] {
  const hasTurbo = car.engine.induction === 'turbo' || ALL_PARTS.some((part) =>
    part.category === 'turbo' && !('upgrade' in part) && !incompatibility(car, part));
  return ALL_PARTS.filter((part) => {
    if (incompatibility(car, part)) return false;
    const branch = branchFor(part, progressionOf(part, familyOf(car), car.id)?.specialization);
    return branch !== 'turbo' || hasTurbo;
  });
}

function createTree(car: CarConfig): PreparationTreeDefinition {
  const engineFamily = familyOf(car);
  const nodes: PreparationNode[] = [{
    id: 'original', branchId: 'original', name: 'Motor original', description: 'Configuração de fábrica.',
    tier: 0, costPP: 0, prerequisites: [], unlocksPartIds: [], position: { x: 0, y: 0 },
  }];
  const parts = compatibleOnlineParts(car).map((part) => {
    const progression = progressionOf(part, engineFamily, car.id);
    return { part, branchId: branchFor(part, progression?.specialization), tier: progression?.tier ?? 1 };
  });
  const available = branches.filter((branch) => parts.some((item) => item.branchId === branch.id));
  available.forEach((branch, x) => {
    let previous = 'original';
    branch.costs.forEach((costPP, index) => {
      const tier = index + 1;
      const unlocksPartIds = parts.filter((part) => part.branchId === branch.id && part.tier === tier).map(({ part }) => part.id);
      if (!unlocksPartIds.length) return;
      const id = `${branch.id}-${tier}`;
      const prerequisites = [previous];
      nodes.push({
        id, name: `${branch.name} ${tier}`, description: `Libera peças de estágio ${tier} na oficina.`,
        branchId: branch.id, tier, costPP, prerequisites, unlocksPartIds, position: { x, y: tier },
      });
      previous = id;
    });
  });
  const forgedTurbo = nodes.find((node) => node.id === 'turbo-3');
  const initialInternals = nodes.find((node) => node.branchId === 'internos');
  if (forgedTurbo && initialInternals) forgedTurbo.prerequisites.push(initialInternals.id);
  return { id: car.id, version: ONLINE_CATALOG_VERSION, engineFamily, baseCarId: car.id, nodes, branches: available };
}

export const PREPARATION_TREES = new Map(CAREER_CARS.map((car) => [car.id, createTree(car)]));
