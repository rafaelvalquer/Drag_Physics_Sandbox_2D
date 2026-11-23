import type { Prng } from '../../../core/prng';
import { AI_PROFILES, type AiProfile } from '../../ai/DragAI';
import { pick } from './FreeEventCatalog';
import { FREE_PORTRAITS, type FreeTier } from './FreeEventTypes';

const NAMES = ['Vitor', 'Carol', 'Guilherme', 'Luana', 'Pedro', 'Fernanda', 'Renan', 'Thiago', 'Bia', 'Caio', 'Mateus', 'Lívia'];
const NICKS = ['Pé Pesado', 'Sem Corte', 'Sombra', 'Falcão', 'Nitro', 'Mão Leve', 'Madruga', 'Alta Rotação', 'Torque', 'Veloz', 'Corvo', 'Pistão'];

const PROFILES: Record<FreeTier, AiProfile> = {
  iniciante: AI_PROFILES.beginner,
  rua: AI_PROFILES.intermediate,
  preparado: { ...AI_PROFILES.advanced, reactionMeanS: 0.23, shiftOffsetRpm: -140, shiftJitterRpm: 95, jumpStartChance: 0.01 },
  competicao: { ...AI_PROFILES.advanced, reactionMeanS: 0.12, reactionJitterS: 0.018 },
};
export const FREE_SKILL_LABEL: Record<FreeTier, string> = {
  iniciante: 'Iniciante · acelerador direto',
  rua: 'Intermediário · modula a tração',
  preparado: 'Experiente · controla a patinagem',
  competicao: 'Especialista · largada e trocas precisas',
};

export function generateFreeDriver(tier: FreeTier, rng: Prng) {
  const base = PROFILES[tier];
  return {
    driverName: pick(NAMES, rng),
    driverNickname: pick(NICKS, rng),
    portrait: pick(FREE_PORTRAITS, rng),
    skill: {
      ...base,
      reactionMeanS: Math.round((base.reactionMeanS + rng.bipolar() * 0.018) * 1000) / 1000,
      shiftOffsetRpm: Math.round(base.shiftOffsetRpm + rng.bipolar() * 50),
      traction: base.traction && { ...base.traction, slipFraction: Math.round((base.traction.slipFraction + rng.bipolar() * 0.1) * 100) / 100 },
    },
  };
}
