import type { CarConfig } from '../../../data/schema';
import { inductionState, isConversionKit, type InductionState } from './ConvertedTurboModel';
import { findPart, type PartDef } from './parts';

/**
 * Engine project of a build, DERIVED from the hardware installed (never stored, never a stage
 * variable). The "Stage" of the workshop is only the name of a group of parts: this classifier
 * reads the parts and the induction of the hardware and says which project the car is.
 *
 *  - aspirated cars: original / street / high RPM / competition (valve events, breathing, ECU, internals);
 *  - aspirated cars converted with a kit: turbo street / balanced / high flow / twin competition;
 *  - factory-turbo cars (biturbo V6): original / stage 1 / 2 / 3 / competition.
 */
export type EngineSchool = 'aspirated' | 'turbo-conversion' | 'factory-turbo';

export type EngineProjectId =
  | 'original'
  | 'na-street'
  | 'na-high-rpm'
  | 'na-competition'
  | 'turbo-street'
  | 'turbo-balanced'
  | 'turbo-high-flow'
  | 'turbo-twin-competition'
  | 'biturbo-stage1'
  | 'biturbo-stage2'
  | 'biturbo-stage3'
  | 'biturbo-competition';

export interface EngineProject {
  id: EngineProjectId;
  school: EngineSchool;
  /** Name of the project (pt-BR). */
  label: string;
  /** Short description of what the hardware is, for the workshop header. */
  summary: string;
  induction: InductionState;
  /** Names of the installed parts that define the project. */
  definedBy: string[];
}

export const PROJECT_LABEL: Record<EngineProjectId, string> = {
  original: 'Original',
  'na-street': 'Aspirado Street',
  'na-high-rpm': 'Aspirado High RPM',
  'na-competition': 'Aspirado Competition',
  'turbo-street': 'Turbo Street',
  'turbo-balanced': 'Turbo Balanced',
  'turbo-high-flow': 'Turbo High Flow',
  'turbo-twin-competition': 'Twin Turbo Competition',
  'biturbo-stage1': 'Biturbo Stage 1',
  'biturbo-stage2': 'Biturbo Stage 2',
  'biturbo-stage3': 'Biturbo Stage 3',
  'biturbo-competition': 'Biturbo Competition',
};

const SUMMARY: Record<EngineProjectId, string> = {
  original: 'Motor de fábrica.',
  'na-street': 'Respiração livre e remap: ganho moderado, sem mexer no motor por dentro.',
  'na-high-rpm': 'Comandos, coletor, cabeçotes e molas: o motor respira melhor em alto giro e perde embaixo.',
  'na-competition': 'Peças de competição no motor aspirado: giro alto, internos reforçados e lubrificação do tamanho.',
  'turbo-street': 'Conversão turbo de turbina pequena: resposta rápida e pouca pressão.',
  'turbo-balanced': 'Conversão turbo de turbina intermediária: mais fluxo, enche um pouco mais tarde.',
  'turbo-high-flow': 'Conversão turbo de turbina grande: muito fluxo, enchimento tardio, exige alimentação e internos fortes.',
  'turbo-twin-competition': 'Dois turbos paralelos, um por bancada: fluxo alto com menos inércia que um turbo grande.',
  'biturbo-stage1': 'Biturbo de fábrica com remap: mais pressão dentro do que a turbina e a wastegate seguram.',
  'biturbo-stage2': 'Biturbo com downpipe, intercooler maior e mapa Stage 2.',
  'biturbo-stage3': 'Turbinas híbridas, mapa Stage 3 e internos forjados.',
  'biturbo-competition': 'Turbinas High Flow, ECU Competition, alimentação de alta vazão e internos Stage 3.',
};

const has = (parts: readonly PartDef[], ...ids: string[]): boolean => parts.some((p) => ids.includes(p.id));

/** Hardware that makes an aspirated engine a "competition" project. */
const NA_COMPETITION_IDS = ['ecu-vq35-comp', 'ecu-2gr-comp', 'ecu-vq37-comp', 'manifold-v6-comp', 'head-v6-comp', 'vvel-370z-comp', 'forged-v6-na', 'exhaust-v6-race', 'crank-balanced-v6'];
/** Hardware that makes it a "high RPM" project (valve events, breathing tuned for speed). */
const NA_HIGH_RPM_IDS = [
  'cam-vq35-s1', 'cam-vq35-s2', 'cam-vq37-s1', 'vvel-370z-s1', 'vvti-2gr-s1', 'head-v6-ported', 'head-2gr-ported',
  'ecu-vq35-s2', 'ecu-2gr-s2', 'ecu-vq37-s2', 'manifold-v6-sport', 'valve-springs', 'valve-springs-v6-comp', 'filter-v6-dual', 'pistons-v6-hcr', 'rods-v6-light',
];

export function classifyProject(base: CarConfig, partIds: readonly string[]): EngineProject {
  const parts = partIds.map(findPart).filter((p): p is PartDef => !!p);
  const induction = inductionState(base, parts);
  const mk = (id: EngineProjectId, school: EngineSchool, definedBy: PartDef[]): EngineProject => ({
    id,
    school,
    label: PROJECT_LABEL[id],
    summary: SUMMARY[id],
    induction,
    definedBy: definedBy.map((p) => p.name),
  });

  const kit = parts.find(isConversionKit);
  if (kit) {
    const id: EngineProjectId =
      kit.conversion.layout === 'twin-parallel' ? 'turbo-twin-competition' : kit.conversion.profile === 'street' ? 'turbo-street' : kit.conversion.profile === 'balanced' ? 'turbo-balanced' : 'turbo-high-flow';
    return mk(id, 'turbo-conversion', [kit]);
  }

  if (base.engine.induction === 'turbo') {
    const ecu = parts.find((p) => p.category === 'ecu');
    const turbo = parts.find((p) => p.category === 'turbo');
    if (has(parts, 'ecu-biturbo-comp')) return mk('biturbo-competition', 'factory-turbo', parts.filter((p) => ['ecu-biturbo-comp', 'turbo-hybrid-hf'].includes(p.id)));
    if (has(parts, 'ecu-stage3') || has(parts, 'turbo-hybrid-s3', 'turbo-hybrid-hf')) return mk('biturbo-stage3', 'factory-turbo', parts.filter((p) => ['ecu-stage3', 'turbo-hybrid-s3', 'turbo-hybrid-hf'].includes(p.id)));
    if (has(parts, 'ecu-stage2') || has(parts, 'turbo-hybrid')) return mk('biturbo-stage2', 'factory-turbo', parts.filter((p) => ['ecu-stage2', 'turbo-hybrid'].includes(p.id)));
    if (ecu || turbo || parts.some((p) => ['downpipe-catless', 'intake-direct-turbo', 'intercooler-race', 'intercooler-comp', 'pistons-forged-modern'].includes(p.id)))
      return mk('biturbo-stage1', 'factory-turbo', ecu ? [ecu] : parts.slice(0, 1));
    return mk('original', 'factory-turbo', []);
  }

  const comp = parts.filter((p) => NA_COMPETITION_IDS.includes(p.id));
  if (comp.length) return mk('na-competition', 'aspirated', comp);
  const high = parts.filter((p) => NA_HIGH_RPM_IDS.includes(p.id));
  if (high.length) return mk('na-high-rpm', 'aspirated', high);
  const street = parts.filter((p) => ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na'].includes(p.id));
  if (street.length) return mk('na-street', 'aspirated', street);
  return mk('original', 'aspirated', []);
}
