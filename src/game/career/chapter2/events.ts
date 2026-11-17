import type { CareerEventDef, RivalDef } from '../CareerEvents';
import { CHAPTER_2_ID } from '../chapters';

/**
 * Chapter 2 — "Liga da Madrugada": rivals and events as data. The `before` lines (and Victor's
 * win line) are the exact lines of the chapter script; the others complete the scenes. As in
 * chapter 1, a rival is only its car, its parts (bought and resolved by the same resolver, version
 * 2, as the player's) and its driver: reaction, launch control and shift points. No hidden factors.
 */
export const CHAPTER2_RIVALS: readonly RivalDef[] = [
  {
    id: 'guga',
    name: 'Gustavo',
    nickname: 'Guga',
    portrait: 'guga',
    baseCarId: 'gm-astra-2011',
    buildId: 'astra-guga-simples',
    buildVersion: 2,
    parts: ['filter-sport', 'exhaust-sport'],
    paint: { color: '#20324f', accent: '#2a2d31' },
    skill: { reactionMeanS: 0.26, reactionJitterS: 0.04, traction: { slipFraction: 1.6, forceFraction: 0.9, trimGain: 2, updateHz: 20 }, shiftOffsetRpm: -250, shiftJitterRpm: 120, jumpStartChance: 0 },
    skillLabel: 'Conservado e honesto: larga bem, troca um pouco cedo.',
    lines: {
      before: 'Fiquei sabendo que você venceu o Marcos. Quero ver se consegue manter o ritmo.',
      win: 'Tá, o boato era verdade. Aqui na liga ninguém vai te dar moleza, mas você chegou com o pé direito.',
      lose: 'Ganhar do Marcos foi lá. Aqui o asfalto é outro.',
    },
  },
  {
    id: 'camila',
    name: 'Camila',
    nickname: 'THP',
    portrait: 'camila',
    baseCarId: 'peugeot-208-gt-2017',
    buildId: '208-camila-pneu',
    buildVersion: 2,
    parts: ['tires-sport'],
    paint: { color: '#e9e9e6', accent: '#1c1f24' },
    skill: { reactionMeanS: 0.23, reactionJitterS: 0.035, traction: { slipFraction: 1.4, forceFraction: 0.92, trimGain: 2.5, updateHz: 24 }, shiftOffsetRpm: -350, shiftJitterRpm: 80, jumpStartChance: 0 },
    skillLabel: 'Troca cedo de propósito: usa o torque médio do turbo.',
    lines: {
      before: 'Meu carro não precisa de muito giro para encher o turbo. Vamos ver o que o seu faz.',
      win: 'Boa. Torque baixo não ganha sozinho, né? Vou pensar nisso.',
      lose: 'Viu? Enquanto você esperava o giro subir, eu já estava na frente.',
    },
  },
  {
    id: 'ricardo',
    name: 'Ricardo',
    nickname: 'GTI',
    portrait: 'ricardo',
    baseCarId: 'vw-golf-gti-mk4-2003',
    buildId: 'golf-ricardo-stage1',
    buildVersion: 2,
    parts: ['ecu-stage1', 'clutch-reinforced'],
    paint: { color: '#b0182a', accent: '#1a1a1a' },
    skill: { reactionMeanS: 0.22, reactionJitterS: 0.03, traction: { slipFraction: 1.3, forceFraction: 0.94, trimGain: 3, updateHz: 30 }, shiftOffsetRpm: -150, shiftJitterRpm: 60, jumpStartChance: 0 },
    skillLabel: 'Conhece cada parafuso do 1.8T: largada limpa, trocas no ponto.',
    lines: {
      before: 'Esse motor ainda tem muito para entregar. Só precisa das peças certas.',
      win: 'Respeito. O 1.8T aguenta mais, e eu vou descobrir quanto.',
      lose: 'Vinte anos de projeto e ainda anda. Volta quando seu carro tiver história.',
    },
  },
  {
    id: 'andre',
    name: 'André',
    nickname: 'A3',
    portrait: 'andre',
    baseCarId: 'audi-a3-18t-2005',
    buildId: 'a3-andre-stage1',
    buildVersion: 2,
    parts: ['ecu-stage1', 'boost-control', 'clutch-reinforced'],
    paint: { color: '#8f969e', accent: '#22252a' },
    skill: { reactionMeanS: 0.21, reactionJitterS: 0.03, traction: { slipFraction: 1.3, forceFraction: 0.94, trimGain: 3, updateHz: 30 }, shiftOffsetRpm: -100, shiftJitterRpm: 50, jumpStartChance: 0 },
    skillLabel: 'Metódico: confia no controle de pressão e não erra troca.',
    lines: {
      before: 'Pode conhecer o motor. Mas ainda precisa conhecer o carro.',
      win: 'Mesmo motor, carro diferente, e você leu os dois. Justo.',
      lose: 'O motor é o mesmo do Golf. O resto não. Faz a lição de casa.',
    },
  },
  {
    id: 'helena',
    name: 'Helena',
    nickname: 'C200',
    portrait: 'helena',
    baseCarId: 'mercedes-c200-w205-2015',
    buildId: 'c200-helena-stage1',
    buildVersion: 2,
    parts: ['ecu-stage1'],
    paint: { color: '#121417', accent: '#c9ccd0' },
    skill: { reactionMeanS: 0.2, reactionJitterS: 0.025, traction: { slipFraction: 1.3, forceFraction: 0.95, trimGain: 3, updateHz: 40 }, shiftOffsetRpm: 0, shiftJitterRpm: 40, jumpStartChance: 0 },
    skillLabel: 'Fria e precisa: deixa o câmbio automático trabalhar.',
    lines: {
      before: 'Não precisa fazer barulho para andar rápido. Deixa o cronômetro responder.',
      win: 'O cronômetro respondeu. Parabéns.',
      lose: 'Silêncio. É assim que soa um carro bem acertado.',
    },
  },
  {
    id: 'daniel',
    name: 'Daniel',
    nickname: '320',
    portrait: 'daniel',
    baseCarId: 'bmw-320i-f30-2014',
    buildId: '320i-daniel-stage1',
    buildVersion: 2,
    parts: ['ecu-stage1', 'at-upgrade', 'suspension-drag-rwd', 'tires-semislick'],
    paint: { color: '#1f4e8c', accent: '#16181b' },
    skill: { reactionMeanS: 0.2, reactionJitterS: 0.025, traction: { slipFraction: 1.2, forceFraction: 0.95, trimGain: 3.5, updateHz: 40 }, shiftOffsetRpm: 0, shiftJitterRpm: 40, jumpStartChance: 0 },
    skillLabel: 'Especialista em largada de tração traseira.',
    lines: {
      before: 'A largada é onde a maioria perde essa corrida.',
      win: 'Você não perdeu na largada. Então perdeu eu.',
      lose: 'Eu avisei: a corrida acaba nos primeiros sessenta pés.',
    },
  },
  {
    id: 'lucas',
    name: 'Lucas',
    nickname: 'Si',
    portrait: 'lucas',
    baseCarId: 'honda-civic-si-2008',
    buildId: 'civic-lucas-aspirado',
    buildVersion: 2,
    parts: ['filter-sport', 'exhaust-sport', 'manifold-k20-rbc', 'cam-k20', 'head-ported', 'ecu-stage1-na', 'tires-semislick'],
    paint: { color: '#d4d6d8', accent: '#b0182a' },
    skill: { reactionMeanS: 0.19, reactionJitterS: 0.025, traction: { slipFraction: 1.3, forceFraction: 0.95, trimGain: 3, updateHz: 40 }, shiftOffsetRpm: 150, shiftJitterRpm: 40, jumpStartChance: 0 },
    skillLabel: 'Vive no corte: estica cada marcha até o limite.',
    lines: {
      before: 'Você tem turbo. Eu tenho giro. Vamos ver quem faz o melhor tempo.',
      win: 'Nove mil giros e não deu. Seu acerto está bom mesmo.',
      lose: 'Ouviu quando o comando virou? É isso que turbo nenhum faz.',
    },
  },
  {
    id: 'felipe',
    name: 'Felipe',
    nickname: 'TSI',
    portrait: 'felipe',
    baseCarId: 'vw-jetta-tsi-2012',
    buildId: 'jetta-felipe-stage1-dsg',
    buildVersion: 2,
    parts: ['ecu-stage1', 'dct-upgrade', 'intercooler-race', 'exhaust-sport', 'tires-semislick'],
    paint: { color: '#e7e8e6', accent: '#20242a' },
    skill: { reactionMeanS: 0.18, reactionJitterS: 0.02, traction: { slipFraction: 1.2, forceFraction: 0.95, trimGain: 3.5, updateHz: 40 }, shiftOffsetRpm: 0, shiftJitterRpm: 20, jumpStartChance: 0 },
    skillLabel: 'Câmbio de dupla embreagem calibrado: trocas sem buraco.',
    lines: {
      before: 'Não basta ter torque. Você precisa entregar tudo sem perder tempo nas trocas.',
      win: 'Nenhuma troca perdida e mesmo assim você chegou antes. Bem feito.',
      lose: 'Cada troca sua custou um décimo. Some aí.',
    },
  },
  {
    id: 'bianca',
    name: 'Bianca',
    nickname: 'Evo',
    portrait: 'bianca',
    baseCarId: 'mitsubishi-evo-x-2012',
    buildId: 'evo-bianca-awd',
    buildVersion: 2,
    parts: ['awd-center-tune', 'tires-sport'],
    paint: { color: '#c8322b', accent: '#16181b' },
    skill: { reactionMeanS: 0.17, reactionJitterS: 0.02, traction: { slipFraction: 1.2, forceFraction: 0.96, trimGain: 3.5, updateHz: 50 }, shiftOffsetRpm: 0, shiftJitterRpm: 20, jumpStartChance: 0 },
    skillLabel: 'Motor original, centro acertado: larga como ninguém com as quatro rodas.',
    lines: {
      before: 'Todo mundo pensa em potência. Eu prefiro colocar toda ela no chão.',
      win: 'Quatro rodas e você ainda saiu junto. Agora o Victor vai querer te ver.',
      lose: 'Enquanto sua roda girava em falso, as minhas quatro empurravam.',
    },
  },
  {
    id: 'victor',
    name: 'Victor',
    nickname: '335',
    portrait: 'victor',
    baseCarId: 'bmw-335i-f30-2013',
    buildId: '335i-victor-stage1',
    buildVersion: 2,
    parts: ['ecu-stage1', 'at-upgrade', 'tires-semislick', 'suspension-drag-rwd'],
    paint: { color: '#0d0f12', accent: '#3a6fb0' },
    skill: { reactionMeanS: 0.16, reactionJitterS: 0.015, traction: { slipFraction: 1.15, forceFraction: 0.96, trimGain: 4, updateHz: 60 }, shiftOffsetRpm: 0, shiftJitterRpm: 15, jumpStartChance: 0 },
    skillLabel: 'O mais respeitado da liga: N55 Stage 1 bem calibrado e nenhum erro.',
    lines: {
      before: 'Você venceu carros de todos os tipos para chegar aqui. Agora quero ver se conhece mesmo o seu projeto.',
      win: 'Você não venceu por sorte. Esse carro foi construído para chegar até aqui.',
      lose: 'Chegou perto. Perto não é o bastante na última etapa.',
    },
  },
];

type Ev = Omit<CareerEventDef, 'chapter'>;

const EV: readonly Ev[] = [
  { id: 'c2e1-portas-abertas', order: 1, title: 'Portas Abertas', rivalId: 'guga', trackId: 'patio-das-torres', regionLabel: 'Pátio das Torres', distance: 'eighth', rewardCr: 2500, reputation: 15, unlocks: ['c2-ecu'] },
  { id: 'c2e2-turbo-frances', order: 2, title: 'Turbo Francês', rivalId: 'camila', trackId: 'patio-das-torres', regionLabel: 'Pátio das Torres', distance: 'eighth', rewardCr: 3500, reputation: 20, unlocks: ['c2-intercooler', 'c2-boost-control'] },
  { id: 'c2e3-lenda-do-gti', order: 3, title: 'A Lenda do GTI', rivalId: 'ricardo', trackId: 'patio-das-torres', regionLabel: 'Pátio das Torres', distance: 'quarter', rewardCr: 4500, reputation: 25, unlocks: ['c2-engine-family'] },
  { id: 'c2e4-quatro-argolas', order: 4, title: 'Quatro Argolas', rivalId: 'andre', trackId: 'distrito-financeiro', regionLabel: 'Distrito Financeiro', distance: 'quarter', rewardCr: 5500, reputation: 30, unlocks: ['c2-gearbox'] },
  { id: 'c2e5-precisao-alema', order: 5, title: 'Precisão Alemã', rivalId: 'helena', trackId: 'distrito-financeiro', regionLabel: 'Distrito Financeiro', distance: 'quarter', rewardCr: 6500, reputation: 35, unlocks: [] },
  { id: 'c2e6-tracao-traseira', order: 6, title: 'Tração Traseira', rivalId: 'daniel', trackId: 'distrito-financeiro', regionLabel: 'Distrito Financeiro', distance: 'quarter', rewardCr: 7500, reputation: 40, unlocks: ['c2-suspension'] },
  { id: 'c2e7-vtec', order: 7, title: 'VTEC', rivalId: 'lucas', trackId: 'distrito-financeiro', regionLabel: 'Distrito Financeiro', distance: 'quarter', rewardCr: 8500, reputation: 45, unlocks: ['c2-programmable'] },
  { id: 'c2e8-troca-perfeita', order: 8, title: 'Troca Perfeita', rivalId: 'felipe', trackId: 'corredor-da-liga', regionLabel: 'Corredor da Liga', distance: 'quarter', rewardCr: 10000, reputation: 50, unlocks: ['c2-turbo-hybrid', 'c2-internals', 'c2-tires-slick'] },
  { id: 'c2e9-tracao-total', order: 9, title: 'Tração Total', rivalId: 'bianca', trackId: 'corredor-da-liga', regionLabel: 'Corredor da Liga', distance: 'quarter', rewardCr: 13000, reputation: 60, unlocks: ['c2-awd', 'c2-final-challenge'] },
  {
    id: 'c2e10-dono-da-liga',
    order: 10,
    title: 'O Dono da Liga',
    rivalId: 'victor',
    trackId: 'corredor-da-liga',
    regionLabel: 'Corredor da Liga',
    distance: 'quarter',
    rewardCr: 20000,
    reputation: 80,
    unlocks: ['c2-dealer-335i'],
    requires: 'c2-final-challenge',
    finale: true,
  },
];

export const CHAPTER2_EVENTS: readonly CareerEventDef[] = EV.map((e) => ({ ...e, chapter: CHAPTER_2_ID }));

export const CHAPTER2_REGIONS = [
  { id: 'patio-das-torres', label: 'Pátio das Torres', blurb: 'Prédios comerciais, estacionamentos e luz de LED azul e branca.', chapter: CHAPTER_2_ID },
  { id: 'distrito-financeiro', label: 'Distrito Financeiro', blurb: 'Arranha-céus, viadutos e reflexos no asfalto novo.', chapter: CHAPTER_2_ID },
  { id: 'corredor-da-liga', label: 'Corredor da Liga', blurb: 'Pista fechada entre estruturas industriais, holofotes e público.', chapter: CHAPTER_2_ID },
] as const;

/** Lines of Caio (ECU and turbo tuner) and Nina for the chapter's story scenes. */
export const CAIO = {
  intro: 'Prazer, Caio. Eu cuido da parte que não aparece: injeção, ignição, pressão. Motor moderno não se prepara com chave de boca.',
  workshop:
    'Aqui cada motor tem a sua família. Peça de AP não entra em N55, e comando de K20 não serve em turbo. A oficina só mostra o que cabe no seu carro.',
  ecu: 'Remap Stage 1: mais pressão e mais avanço dentro do que o motor de fábrica aguenta. Não é mágica, é calibração.',
  dyno: 'Com a ECU programável eu ajusto a pressão no dinamômetro. Passou do que o intercooler e a gasolina aguentam, ela atrasa a ignição e o ganho some.',
} as const;
