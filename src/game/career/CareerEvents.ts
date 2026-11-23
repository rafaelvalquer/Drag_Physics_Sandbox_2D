import type { AiProfile } from '../ai/DragAI';
import type { RaceDistanceId } from '../race/RaceController';
import type { UnlockId } from './tuning/parts';
import type { ResolverVersion, BuildTune } from './tuning/buildCommon';
import { CHAPTER_1_ID, CHAPTER_1_TITLE, CHAPTER_2_ID, type ChapterId } from './chapters';
import { CHAPTER2_EVENTS, CHAPTER2_REGIONS, CHAPTER2_RIVALS } from './chapter2/events';
import { CHAPTER3_EVENTS, CHAPTER3_REGIONS, CHAPTER3_RIVALS } from './chapter3/events';

/**
 * Chapter 1 — "Madrugada Zero": rivals and events as structured data. The lines are the exact
 * lines of the chapter script. Rival difficulty comes ONLY from the car, its parts (resolved by
 * the same build resolver as the player's), and the driver: reaction time, launch/throttle control
 * (traction), shift points. The AI never gets torque or speed the physics did not produce.
 */
export { CHAPTER_1_ID, CHAPTER_1_TITLE };

export type PortraitId =
  | 'nina' | 'lara' | 'eduardo' | 'roberto' | 'fernando' | 'leonardo' | 'paula' | 'marcos'
  // chapter 2
  | 'caio' | 'guga' | 'camila' | 'ricardo' | 'andre' | 'helena' | 'daniel' | 'lucas' | 'felipe' | 'bianca' | 'victor'
  // chapter 3
  | 'hugo' | 'renata' | 'bruno' | 'maya' | 'davi' | 'valentina' | 'dante' | 'akira';

/**
 * Prize of a chapter's final: the loser hands the car over. The player gets a copy of the rival's
 * build (same paint, parts and tune); `value` is what the car counts as "paid" for the resale.
 */
export interface PrizeDef {
  /** Garage name of the car (max 32 characters). */
  nickname: string;
  value: number;
  /** Delivery scene (after the victory line). */
  lines: { speaker: PortraitId; text: string }[];
}

export interface RivalDef {
  id: string;
  name: string;
  nickname: string;
  portrait: PortraitId;
  /** Campaign catalogue car the build starts from. */
  baseCarId: string;
  /** Build id (documentation / results). */
  buildId: string;
  /** Build resolver version of the rival's build (chapter 1: 1). */
  buildVersion?: ResolverVersion;
  parts: string[];
  /** Same settings a player has in the Dyno Lab; the resolver rejects what the installed parts do not unlock. */
  tune?: BuildTune;
  paint: { color: string; accent: string };
  /** Driver skill (the only thing that is not the car). */
  skill: AiProfile;
  skillLabel: string;
  lines: { before: string; win: string; lose?: string };
  /** Only the rival of a chapter's final: the car the player wins. */
  prize?: PrizeDef;
}

export type CareerTrackId = 'distrito-industrial' | 'baixada' | 'avenida-norte' | 'patio-das-torres' | 'distrito-financeiro' | 'corredor-da-liga' | 'marginal-alta' | 'hangar-executivo' | 'pier-elite';

export interface CareerEventDef {
  id: string;
  chapter: ChapterId;
  order: number;
  title: string;
  rivalId: string;
  trackId: CareerTrackId;
  regionLabel: string;
  distance: RaceDistanceId;
  /** Full prize of the first win (CR). */
  rewardCr: number;
  reputation: number;
  unlocks: UnlockId[];
  /** Unlock required besides the previous event (the final challenge). */
  requires?: UnlockId;
  finale?: boolean;
}

/** Chapter 1 rivals. */
export const RIVALS: readonly RivalDef[] = [
  {
    id: 'lara',
    name: 'Lara',
    nickname: 'Faísca',
    portrait: 'lara',
    baseCarId: 'gm-celta-2003',
    buildId: 'celta-lara-stock',
    parts: [],
    paint: { color: '#c8322b', accent: '#2a2d31' },
    skill: { reactionMeanS: 0.36, reactionJitterS: 0.07, traction: null, shiftOffsetRpm: -650, shiftJitterRpm: 220, jumpStartChance: 0 },
    skillLabel: 'Ansiosa: pisa fundo, troca cedo.',
    lines: {
      before: 'É a sua primeira noite? Então vamos ver se você sabe largar.',
      win: 'Beleza, você sabe dirigir. Quero ver quando aparecer alguém com motor preparado.',
      lose: 'Volta quando estiver acertado. Não adianta só pisar fundo.',
    },
  },
  {
    id: 'eduardo',
    name: 'Eduardo',
    nickname: 'Duda Mille',
    portrait: 'eduardo',
    baseCarId: 'fiat-uno-mille-1995',
    buildId: 'uno-duda-stock',
    parts: [],
    paint: { color: '#e7e4da', accent: '#3a3d40' },
    skill: { reactionMeanS: 0.3, reactionJitterS: 0.05, traction: { slipFraction: 2, forceFraction: 0.85, trimGain: 1.5, updateHz: 12 }, shiftOffsetRpm: -300, shiftJitterRpm: 150, jumpStartChance: 0 },
    skillLabel: 'Conhece o Uno: largada limpa, trocas no ponto.',
    lines: {
      before: 'Pode rir do tamanho. Na hora da largada, esse Uno surpreende.',
      win: 'Seu carro está bem acertado. Acho que vou precisar mexer no meu.',
    },
  },
  {
    id: 'roberto',
    name: 'Roberto',
    nickname: 'Beto Relógio',
    portrait: 'roberto',
    baseCarId: 'gm-corsa-gl-1996',
    buildId: 'corsa-beto-street',
    parts: ['filter-sport', 'exhaust-sport'],
    paint: { color: '#2f5d8a', accent: '#1d1f22' },
    skill: { reactionMeanS: 0.24, reactionJitterS: 0.01, traction: { slipFraction: 1.6, forceFraction: 0.9, trimGain: 2, updateHz: 20 }, shiftOffsetRpm: -200, shiftJitterRpm: 30, jumpStartChance: 0 },
    skillLabel: 'Constante como um relógio: o mesmo tempo de reação toda noite.',
    lines: {
      before: 'Todo mundo fala de cavalaria. Eu prefiro olhar o cronômetro.',
      win: 'Você melhorou. Agora começa a parte interessante.',
    },
  },
  {
    id: 'fernando',
    name: 'Fernando',
    nickname: 'Nando',
    portrait: 'fernando',
    baseCarId: 'gm-chevette-sl-1988',
    buildId: 'chevette-nando-street',
    parts: ['filter-sport', 'exhaust-sport', 'manifold-sport', 'tires-sport'],
    paint: { color: '#7a5a2e', accent: '#1f1d1b' },
    skill: { reactionMeanS: 0.24, reactionJitterS: 0.04, traction: { slipFraction: 1.4, forceFraction: 0.92, trimGain: 2.5, updateHz: 24 }, shiftOffsetRpm: -150, shiftJitterRpm: 80, jumpStartChance: 0 },
    skillLabel: 'Sabe dosar o acelerador na tração traseira.',
    lines: {
      before: 'Cada carro tem um jeito de sair. Vamos descobrir se você conhece o seu.',
      win: 'Mandou bem. Seu carro está respondendo melhor a cada noite.',
    },
  },
  {
    id: 'leonardo',
    name: 'Leonardo',
    nickname: 'Léo AP',
    portrait: 'leonardo',
    baseCarId: 'vw-gol-gts-1988',
    buildId: 'gol-leo-ap',
    parts: ['filter-sport', 'exhaust-sport', 'tires-sport'],
    paint: { color: '#101215', accent: '#c9a227' },
    skill: { reactionMeanS: 0.2, reactionJitterS: 0.03, traction: { slipFraction: 1.2, forceFraction: 0.95, trimGain: 3, updateHz: 40 }, shiftOffsetRpm: -80, shiftJitterRpm: 50, jumpStartChance: 0 },
    skillLabel: 'Conhece o AP de ponta a ponta: trocas no limite certo.',
    lines: {
      before: 'Você está andando bem. Mas agora vai enfrentar um carro que eu conheço de ponta a ponta.',
      win: 'Agora entendi por que estão falando do seu projeto.',
    },
  },
  {
    id: 'paula',
    name: 'Paula',
    nickname: 'Giro',
    portrait: 'paula',
    baseCarId: 'gm-kadett-sl-1992',
    buildId: 'kadett-paula-na',
    parts: ['filter-sport', 'manifold-sport', 'cam-sport', 'exhaust-sport', 'tires-sport'],
    paint: { color: '#d8d9d6', accent: '#b0182a' },
    skill: { reactionMeanS: 0.19, reactionJitterS: 0.03, traction: { slipFraction: 1.5, forceFraction: 0.95, trimGain: 3, updateHz: 40 }, shiftOffsetRpm: 120, shiftJitterRpm: 60, jumpStartChance: 0 },
    skillLabel: 'Estica as marchas: troca acima do ponto ideal.',
    lines: {
      before: 'Não preciso de turbina para fazer tempo. Preciso de motor bem acertado.',
      win: 'Seu projeto merece enfrentar o Marcos. Eu vou estar lá para assistir.',
    },
  },
  {
    id: 'marcos',
    name: 'Marcos',
    nickname: 'Rei da Madrugada',
    portrait: 'marcos',
    baseCarId: 'vw-saveiro-gl-1994',
    buildId: 'saveiro-marcos-chapter1',
    parts: ['turbo-basic', 'manifold-sport', 'exhaust-sport', 'clutch-reinforced', 'tires-sport'],
    paint: { color: '#0d0f12', accent: '#8f1c1c' },
    skill: { reactionMeanS: 0.18, reactionJitterS: 0.025, traction: { slipFraction: 1.3, forceFraction: 0.95, trimGain: 3, updateHz: 40 }, shiftOffsetRpm: -60, shiftJitterRpm: 40, jumpStartChance: 0 },
    skillLabel: 'Experiente. Segura a patinação da Saveiro turbo no pé.',
    lines: {
      before: 'Ouvi falar de você. Sete noites atrás ninguém sabia seu nome. Vamos ver o que esse carro consegue fazer.',
      win: 'Seu carro não é o mais caro daqui. Mas você soube preparar e pilotar. O título é seu.',
      lose: 'Ainda falta acerto nesse projeto. Quando estiver pronto, eu vou estar aqui.',
    },
    prize: {
      nickname: 'Saveiro do Marcos',
      value: 3500,
      lines: [
        { speaker: 'marcos', text: 'Regra velha da madrugada: quem perde o último desafio entrega a chave. A Saveiro é sua.' },
        { speaker: 'marcos', text: 'A turbina, a embreagem, o acerto para segurar a patinação: está tudo como eu deixei. Só não judia do disco.' },
        { speaker: 'nina', text: 'Ele nunca emprestou essa Saveiro para ninguém. Isso, aqui, é respeito.' },
      ],
    },
  },
];

const CH1: readonly Omit<CareerEventDef, 'chapter'>[] = [
  {
    id: 'e1-primeira-noite',
    order: 1,
    title: 'Primeira Noite',
    rivalId: 'lara',
    trackId: 'distrito-industrial',
    regionLabel: 'Distrito Industrial',
    distance: 'eighth',
    rewardCr: 300,
    reputation: 10,
    unlocks: ['workshop-basic', 'part-filter', 'part-exhaust', 'c1-dealer-celta'],
  },
  {
    id: 'e2-pequeno-valente',
    order: 2,
    title: 'O Pequeno Valente',
    rivalId: 'eduardo',
    trackId: 'distrito-industrial',
    regionLabel: 'Distrito Industrial',
    distance: 'eighth',
    rewardCr: 400,
    reputation: 15,
    unlocks: ['part-manifold', 'part-tires-sport'],
  },
  {
    id: 'e3-acerto-de-contas',
    order: 3,
    title: 'Acerto de Contas',
    rivalId: 'roberto',
    trackId: 'baixada',
    regionLabel: 'Baixada',
    distance: 'eighth',
    rewardCr: 600,
    reputation: 20,
    unlocks: ['part-cam', 'workshop-transmission', 'c1-dealer-corsa'],
  },
  {
    id: 'e4-tracao-traseira',
    order: 4,
    title: 'Tração Traseira',
    rivalId: 'fernando',
    trackId: 'baixada',
    regionLabel: 'Baixada',
    distance: 'quarter',
    rewardCr: 800,
    reputation: 25,
    unlocks: ['part-clutch', 'part-differential', 'part-turbo', 'engine-tuners'],
  },
  {
    id: 'e5-respeita-o-ap',
    order: 5,
    title: 'Respeita o AP',
    rivalId: 'leonardo',
    trackId: 'avenida-norte',
    regionLabel: 'Avenida Norte',
    distance: 'quarter',
    rewardCr: 1000,
    reputation: 30,
    unlocks: ['part-tires-semislick'],
  },
  {
    id: 'e6-o-aspirado',
    order: 6,
    title: 'O Aspirado',
    rivalId: 'paula',
    trackId: 'avenida-norte',
    regionLabel: 'Avenida Norte',
    distance: 'quarter',
    rewardCr: 1300,
    reputation: 40,
    unlocks: ['final-challenge', 'part-launch-pro', 'c1-dealer-kadett'],
  },
  {
    id: 'e7-rei-da-madrugada',
    order: 7,
    title: 'Rei da Madrugada',
    rivalId: 'marcos',
    trackId: 'avenida-norte',
    regionLabel: 'Avenida Norte',
    distance: 'quarter',
    rewardCr: 2500,
    reputation: 60,
    unlocks: [],
    requires: 'final-challenge',
    finale: true,
  },
];

/** Chapter 1 events (kept under this name: chapter 1 code and tests use it). */
export const EVENTS: readonly CareerEventDef[] = CH1.map((e) => ({ ...e, chapter: CHAPTER_1_ID }));
export { CHAPTER2_EVENTS, CHAPTER2_RIVALS, CHAPTER3_EVENTS, CHAPTER3_RIVALS };

/** Every event of every chapter, in chapter order. */
export const ALL_EVENTS: readonly CareerEventDef[] = [...EVENTS, ...CHAPTER2_EVENTS, ...CHAPTER3_EVENTS];
export const ALL_RIVALS: readonly RivalDef[] = [...RIVALS, ...CHAPTER2_RIVALS, ...CHAPTER3_RIVALS];

export function eventsOf(chapter: ChapterId): readonly CareerEventDef[] {
  return chapter === CHAPTER_1_ID ? EVENTS : chapter === CHAPTER_2_ID ? CHAPTER2_EVENTS : CHAPTER3_EVENTS;
}

export interface RegionDef {
  id: CareerTrackId;
  label: string;
  blurb: string;
  chapter: ChapterId;
}

const CH1_REGIONS: readonly Omit<RegionDef, 'chapter'>[] = [
  { id: 'distrito-industrial', label: 'Distrito Industrial', blurb: 'Galpões, postes de luz amarela e asfalto gasto.' },
  { id: 'baixada', label: 'Baixada', blurb: 'Concreto sob o viaduto, luz fria e prédios ao fundo.' },
  { id: 'avenida-norte', label: 'Avenida Norte', blurb: 'Avenida isolada, torres de luz e público atrás das barreiras.' },
];

/** Regions of every chapter. */
export const REGIONS: readonly RegionDef[] = [...CH1_REGIONS.map((r) => ({ ...r, chapter: CHAPTER_1_ID as ChapterId })), ...CHAPTER2_REGIONS, ...CHAPTER3_REGIONS];

export function findEvent(id: string): CareerEventDef | undefined {
  return ALL_EVENTS.find((e) => e.id === id);
}

export function findRival(id: string): RivalDef | undefined {
  return ALL_RIVALS.find((r) => r.id === id);
}

export function rivalOf(e: CareerEventDef): RivalDef {
  const r = findRival(e.rivalId);
  if (!r) throw new Error(`rival desconhecido: ${e.rivalId}`);
  return r;
}
