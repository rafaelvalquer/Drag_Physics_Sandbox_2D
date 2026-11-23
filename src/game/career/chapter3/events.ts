import type { CareerEventDef, RivalDef } from '../CareerEvents';
import { CHAPTER_3_ID } from '../chapters';

/**
 * Chapter 3 — "Elite da Madrugada": rivals and events as data. As in the other chapters, a rival is
 * only its car, its parts (bought and resolved by the same resolver, version 2, as the player's)
 * and its driver: reaction, launch control and shift points. No hidden factors: eight new V6
 * premium cars, and two rivals that come back from chapter 2 with the car the player already
 * knows, now prepared with parts that exist in the workshop (Ricardo: Golf GTI Stage 2; Bianca:
 * Lancer Evolution X with a programmable ECU, bigger turbo and prepared dual-clutch and AWD).
 */
const driver = (
  reactionMeanS: number,
  reactionJitterS: number,
  slip: number,
  force: number,
  trim: number,
  shiftOffsetRpm = 0,
  shiftJitterRpm = 30,
): RivalDef['skill'] => ({
  reactionMeanS,
  reactionJitterS,
  traction: { slipFraction: slip, forceFraction: force, trimGain: trim, updateHz: 60 },
  shiftOffsetRpm,
  shiftJitterRpm,
  jumpStartChance: 0,
});

export const CHAPTER3_RIVALS: readonly RivalDef[] = [
  {
    id: 'hugo',
    name: 'Hugo',
    nickname: 'Z',
    portrait: 'hugo',
    baseCarId: 'nissan-350z-2006',
    buildId: 'z33-hugo-preparado',
    buildVersion: 2,
    parts: ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na', 'clutch-reinforced', 'tires-slick', 'differential-short', 'weight-medium', 'suspension-drag-rwd'],
    paint: { color: '#1f4e8c', accent: '#e4e6e8' },
    skill: driver(0.22, 0.03, 1.4, 0.94, 3, -100, 50),
    skillLabel: 'Ama o V6 aspirado: segura a marcha até o fim e larga com calma.',
    lines: {
      before: 'Aqui ninguém liga para turbo. Eu quero ouvir o motor chegar nos sete mil.',
      win: 'Boa largada. Um V6 que respira sozinho também sabe esperar a hora certa.',
      lose: 'Sete mil giros, e você ainda estava na frente. Volta quando tiver mais cavalos.',
    },
  },
  {
    id: 'renata',
    name: 'Renata',
    nickname: 'Silêncio',
    portrait: 'renata',
    baseCarId: 'lexus-is350-2015',
    buildId: 'is350-renata-preparado',
    buildVersion: 2,
    parts: ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na', 'at-upgrade', 'tires-slick', 'differential-short', 'weight-medium', 'suspension-drag-rwd'],
    paint: { color: '#f0f0f2', accent: '#9b1b30' },
    skill: driver(0.21, 0.025, 1.35, 0.95, 3, 0, 40),
    skillLabel: 'Fria e metódica: deixa o automático trabalhar e não perde tempo na saída.',
    lines: {
      before: 'Silêncio dentro do carro, ruído nenhum. É assim que se ganha sem fazer barulho.',
      win: 'Você largou melhor do que eu esperava. Fica o respeito, e a próxima volta é minha.',
      lose: 'Refinamento também é velocidade. Aprende a esperar o câmbio.',
    },
  },
  {
    id: 'ricardo-elite',
    name: 'Ricardo',
    nickname: 'GTI',
    portrait: 'ricardo',
    baseCarId: 'vw-golf-gti-mk4-2003',
    buildId: 'golf-ricardo-stage2',
    buildVersion: 2,
    parts: ['ecu-map-vw-ea113-s2', 'fuel-vw-ea113-s1', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'clutch-reinforced', 'tires-slick', 'suspension-drag-fwd', 'weight-medium', 'flywheel-light-modern', 'differential-short'],
    paint: { color: '#b0182a', accent: '#1a1a1a' },
    skill: driver(0.19, 0.025, 1.3, 0.95, 3.5, -100, 40),
    skillLabel: 'Voltou com o Golf Stage 2: torque de sobra na dianteira, e ele segura a patinação no pé.',
    lines: {
      before: 'O mesmo Golf, de novo. Só que agora com tudo o que aprendi desde a Liga.',
      win: 'Um dos meus melhores quartos de milha. Mesmo assim o motor velho ficou para trás, e essa é a regra da madrugada.',
      lose: 'Eu disse que o 1.8T aguentava mais. Falta a elite saber disso.',
    },
  },
  {
    id: 'bruno',
    name: 'Bruno',
    nickname: 'Zeta',
    portrait: 'bruno',
    baseCarId: 'nissan-370z-2014',
    buildId: 'z34-bruno-preparado',
    buildVersion: 2,
    parts: ['filter-v6-flow', 'exhaust-v6-sport', 'ecu-v6-na', 'cam-vq37-s1', 'clutch-reinforced', 'tires-slick', 'differential-short', 'weight-medium', 'suspension-drag-rwd'],
    paint: { color: '#1a1a1d', accent: '#d97a1a' },
    skill: driver(0.2, 0.025, 1.4, 0.95, 3.5, 0, 40),
    skillLabel: 'Larga de embreagem na mão: sobe o giro e solta sem patinar.',
    lines: {
      before: 'Mais curso, mais giro, mais som. O 370Z é o que o 350Z queria ser.',
      win: 'Vitória limpa. Joga o giro lá em cima, que ele responde.',
      lose: 'Faltou pé direito. Tenta de novo, o motor aguenta.',
    },
  },
  {
    id: 'maya',
    name: 'Maya',
    nickname: 'Três-Mais',
    portrait: 'maya',
    baseCarId: 'mercedes-amg-c43-2017',
    buildId: 'c43-maya-stage2',
    buildVersion: 2,
    parts: ['ecu-map-mercedes-m276-s2', 'fuel-mercedes-m276-s1', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'at-upgrade', 'tires-slick', 'awd-center-tune', 'suspension-drag-awd'],
    paint: { color: '#e8eaee', accent: '#2d3b57' },
    skill: driver(0.19, 0.02, 1.3, 0.96, 4, 0, 30),
    skillLabel: 'Tração integral e nove marchas: sai sem patinar e quase nunca erra.',
    lines: {
      before: 'Biturbo, tração nas quatro, nove marchas. Sai da linha sem pedir licença.',
      win: 'Você gastou o torque inteiro, e eu agradeço: aprendi mais com essa corrida do que com as últimas dez.',
      lose: 'Quatro rodas empurrando. Não tem como o seu carro acompanhar sem acerto.',
    },
  },
  {
    id: 'davi',
    name: 'Davi',
    nickname: 'Stinger',
    portrait: 'davi',
    baseCarId: 'kia-stinger-gt-2019',
    buildId: 'stinger-davi-stage1',
    buildVersion: 2,
    parts: ['ecu-map-kia-lambda33-s2', 'fuel-kia-lambda33-s1', 'intake-direct-turbo', 'at-upgrade', 'tires-semislick', 'awd-center-tune', 'suspension-drag-awd'],
    paint: { color: '#2a2f36', accent: '#a31f2a' },
    skill: driver(0.18, 0.02, 1.25, 0.96, 4, 0, 30),
    skillLabel: 'Pesado e direto: confia no torque de baixa e deixa o câmbio decidir.',
    lines: {
      before: 'Três vírgula três, dois turbos e um tanque cheio. Vamos ver quanto torque o seu carro segura.',
      win: 'Você ganhou no acerto. Esse carro é pesado demais para perder para um desatento.',
      lose: 'Nem precisei de truque. Pede um torque a mais.',
    },
  },
  {
    id: 'bianca-elite',
    name: 'Bianca',
    nickname: 'Evo',
    portrait: 'bianca',
    baseCarId: 'mitsubishi-evo-x-2012',
    buildId: 'evo-bianca-turbo-preparado',
    buildVersion: 2,
    parts: [
      'ecu-map-mitsubishi-4b11-s3', 'fuel-mitsubishi-4b11-s2',
      'turbo-hybrid',
      'downpipe-catless',
      'intake-direct-turbo',
      'pistons-forged-modern',
      'intercooler-race',
      'dct-upgrade',
      'awd-center-tune',
      'tires-slick',
      'suspension-drag-awd',
    ],
    paint: { color: '#f2f3f4', accent: '#c8322b' },
    skill: driver(0.17, 0.02, 1.2, 0.96, 4, 0, 20),
    skillLabel: 'Voltou com o Evo todo preparado: SST afiado, diferencial central ajustado e slick.',
    lines: {
      before: 'O mesmo Evolution, o mesmo tipo de largada. Só que agora ele tem turbina de elite, slick e câmbio afiado.',
      win: 'O Evo foi ao limite e você foi além. Eu volto, e com mais pressão.',
      lose: 'Eu disse que não ia desistir. Agora é diferente: meu carro também ficou mais forte.',
    },
  },
  {
    id: 'valentina',
    name: 'Valentina',
    nickname: 'Salão',
    portrait: 'valentina',
    baseCarId: 'maserati-ghibli-sq4-2015',
    buildId: 'ghibli-valentina-stage2',
    buildVersion: 2,
    parts: ['ecu-map-maserati-f160-s2', 'fuel-maserati-f160-s1', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'at-upgrade', 'tires-slick', 'awd-center-tune', 'suspension-drag-awd'],
    paint: { color: '#1b1f2a', accent: '#c9a24a' },
    skill: driver(0.17, 0.02, 1.25, 0.96, 4, 0, 25),
    skillLabel: 'Elegante e fria: não faz nada de errado e não pede desculpa.',
    lines: {
      before: 'Quatro portas, tração integral e o som mais bonito do salão. Isso não é uma corrida, é um recital.',
      win: 'Raramente alguém me segura. Hoje foi diferente, e eu gostei.',
      lose: 'Uma italiana nunca chega cedo. Mas chega na frente.',
    },
  },
  {
    id: 'dante',
    name: 'Dante',
    nickname: 'Quadrifólio',
    portrait: 'dante',
    baseCarId: 'alfa-giulia-qv-2017',
    buildId: 'giulia-dante-stage2',
    buildVersion: 2,
    parts: ['ecu-map-alfa-690t-s2', 'fuel-alfa-690t-s1', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'at-upgrade', 'tires-slick', 'suspension-drag-rwd'],
    paint: { color: '#f2f2f2', accent: '#b01212' },
    skill: driver(0.16, 0.015, 1.2, 0.97, 4, 0, 20),
    skillLabel: 'Tração traseira e 505 cv: controla a patinação com precisão cirúrgica.',
    lines: {
      before: 'Noventa graus, dois turbos e um motor que ri ao ligar. Aprende a ouvir, depois a largar.',
      win: 'Você me pegou na largada. Quando o motor dá o primeiro tranco, tudo já está decidido.',
      lose: 'Quinhentos cavalos atrás do eixo traseiro. Tem que saber domar antes de acelerar.',
    },
  },
  {
    id: 'akira',
    name: 'Akira',
    nickname: 'Godzilla',
    portrait: 'akira',
    baseCarId: 'nissan-gtr-r35-2015',
    buildId: 'gtr-akira-stage2',
    buildVersion: 2,
    parts: ['ecu-map-nissan-vr38dett-s2', 'fuel-nissan-vr38dett-s1', 'downpipe-catless', 'intercooler-race', 'intake-direct-turbo', 'pistons-forged-modern', 'dct-upgrade', 'tires-slick', 'awd-center-tune', 'suspension-drag-awd'],
    paint: { color: '#0b0b0d', accent: '#c01414' },
    skill: driver(0.15, 0.012, 1.15, 0.98, 5, 0, 10),
    skillLabel: 'O melhor piloto da madrugada: largada de elite e nenhuma troca fora do ponto.',
    lines: {
      before: 'Você chegou até aqui sem fazer barulho. Agora o GT-R vai fazer o barulho por você.',
      win: 'A madrugada tem um dono novo. Você não precisou de potência a mais: soube usar a que tinha.',
      lose: 'Chegou perto. Na elite, perto é o mesmo que longe.',
    },
    prize: {
      nickname: 'GT-R do Akira',
      value: 250000, // the dealer's list price of the GT-R: resale 150.000 CR
      lines: [
        { speaker: 'akira', text: 'Regra da elite: quem perde o último duelo entrega a chave. O GT-R é seu.' },
        { speaker: 'akira', text: 'Dupla embreagem, tração integral e dois turbos de fábrica. Tudo como saiu da pista. Cuida dele: ele devolve o que você der.' },
        { speaker: 'nina', text: 'Ele nunca perdeu uma corrida nesse carro. Ele só entrega a chave a quem merece.' },
        { speaker: 'caio', text: 'Agora a sua garagem tem o carro mais forte da madrugada. O que fazer com ele é a parte difícil.' },
      ],
    },
  },
];

type Ev = Omit<CareerEventDef, 'chapter'>;

const EV: readonly Ev[] = [
  // The order follows the real difficulty (402 m time of each rival on the test track, see
  // docs/chapter3/balance-report.md): the Golf Stage 2 is the slowest of the ten, then the two
  // aspirated V6, the turbo sedans in order of time, the returning Evo and the two heavy hitters.
  { id: 'c3e1-a-volta-do-gti', order: 1, title: 'A Volta do GTI', rivalId: 'ricardo-elite', trackId: 'marginal-alta', regionLabel: 'Marginal Alta', distance: 'eighth', rewardCr: 15000, reputation: 50, unlocks: ['c3-v6-parts', 'c3-workshop-street'] },
  { id: 'c3e2-primeira-elite', order: 2, title: 'Primeira Elite', rivalId: 'hugo', trackId: 'marginal-alta', regionLabel: 'Marginal Alta', distance: 'eighth', rewardCr: 20000, reputation: 55, unlocks: [] },
  { id: 'c3e3-silencio-refinado', order: 3, title: 'Silêncio Refinado', rivalId: 'renata', trackId: 'marginal-alta', regionLabel: 'Marginal Alta', distance: 'quarter', rewardCr: 26000, reputation: 60, unlocks: [] },
  { id: 'c3e4-zeta-de-verdade', order: 4, title: 'Zeta de Verdade', rivalId: 'bruno', trackId: 'hangar-executivo', regionLabel: 'Hangar Executivo', distance: 'quarter', rewardCr: 32000, reputation: 65, unlocks: [] },
  { id: 'c3e5-peso-pesado', order: 5, title: 'Peso Pesado', rivalId: 'davi', trackId: 'hangar-executivo', regionLabel: 'Hangar Executivo', distance: 'quarter', rewardCr: 40000, reputation: 70, unlocks: ['c3-stage3', 'nitrous-direct', 'c3-workshop-sport'] },
  { id: 'c3e6-salao-italiano', order: 6, title: 'Salão Italiano', rivalId: 'valentina', trackId: 'hangar-executivo', regionLabel: 'Hangar Executivo', distance: 'km', rewardCr: 48000, reputation: 75, unlocks: [] },
  { id: 'c3e7-biturbo-alemao', order: 7, title: 'Biturbo Alemão', rivalId: 'maya', trackId: 'hangar-executivo', regionLabel: 'Hangar Executivo', distance: 'quarter', rewardCr: 60000, reputation: 80, unlocks: [] },
  { id: 'c3e8-a-volta-da-evo', order: 8, title: 'A Volta da Evo', rivalId: 'bianca-elite', trackId: 'pier-elite', regionLabel: 'Pier Elite', distance: 'km', rewardCr: 75000, reputation: 90, unlocks: [] },
  { id: 'c3e9-o-trevo-vermelho', order: 9, title: 'O Trevo Vermelho', rivalId: 'dante', trackId: 'pier-elite', regionLabel: 'Pier Elite', distance: 'quarter', rewardCr: 95000, reputation: 100, unlocks: ['c3-dealer-gtr', 'c3-final-challenge', 'c3-workshop-race'] },
  {
    id: 'c3e10-elite-da-madrugada',
    order: 10,
    title: 'Elite da Madrugada',
    rivalId: 'akira',
    trackId: 'pier-elite',
    regionLabel: 'Pier Elite',
    distance: 'km',
    rewardCr: 150000,
    reputation: 120,
    unlocks: [],
    requires: 'c3-final-challenge',
    finale: true,
  },
];

export const CHAPTER3_EVENTS: readonly CareerEventDef[] = EV.map((e) => ({ ...e, chapter: CHAPTER_3_ID }));

export const CHAPTER3_REGIONS = [
  { id: 'marginal-alta', label: 'Marginal Alta', blurb: 'Expressa elevada, torres de vidro e o brilho da cidade lá embaixo.', chapter: CHAPTER_3_ID },
  { id: 'hangar-executivo', label: 'Hangar Executivo', blurb: 'Pista de pouso fechada, jatos executivos e hangares iluminados.', chapter: CHAPTER_3_ID },
  { id: 'pier-elite', label: 'Pier Elite', blurb: 'Cais de uma marina: iates na água, luz quente e a última corrida da noite.', chapter: CHAPTER_3_ID },
] as const;
