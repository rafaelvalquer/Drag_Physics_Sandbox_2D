import type { PortraitId } from './CareerEvents';
import { ALL_EVENTS, rivalOf } from './CareerEvents';
import { CAIO } from './chapter2/events';
import { CHAPTER_1_ID, CHAPTER_2_ID, CHAPTER_3_ID, type ChapterId } from './chapters';
import { UNLOCK_LABEL, type UnlockId } from './tuning/parts';

/**
 * Story scenes as data. A scene plays once (its id goes to `seenStorySceneIds`); every scene can
 * be skipped. Triggers name the moment of the career they belong to.
 */
export type StoryTrigger = 'start' | 'workshop' | 'pre-race' | 'victory' | 'defeat' | 'unlock' | 'final-challenge' | 'completion' | 'prize';

export interface StoryLine {
  speaker: PortraitId;
  text: string;
}

export interface StoryScene {
  id: string;
  /** Chapter of the scene (chapter-wide triggers play only in their chapter). Default: chapter 1. */
  chapter?: ChapterId;
  trigger: StoryTrigger;
  eventId?: string;
  lines: StoryLine[];
}

export const SPEAKER_NAME: Record<PortraitId, string> = {
  nina: 'Nina',
  lara: 'Lara "Faísca"',
  eduardo: 'Eduardo "Duda Mille"',
  roberto: 'Roberto "Beto Relógio"',
  fernando: 'Fernando "Nando"',
  leonardo: 'Leonardo "Léo AP"',
  paula: 'Paula "Giro"',
  marcos: 'Marcos "Rei da Madrugada"',
  caio: 'Caio',
  guga: 'Gustavo "Guga"',
  camila: 'Camila "THP"',
  ricardo: 'Ricardo "GTI"',
  andre: 'André "A3"',
  helena: 'Helena "C200"',
  daniel: 'Daniel "320"',
  lucas: 'Lucas "Si"',
  felipe: 'Felipe "TSI"',
  bianca: 'Bianca "Evo"',
  victor: 'Victor "335"',
  hugo: 'Hugo "Z"',
  renata: 'Renata "Silêncio"',
  bruno: 'Bruno "Zeta"',
  maya: 'Maya "Três-Mais"',
  davi: 'Davi "Stinger"',
  valentina: 'Valentina "Salão"',
  dante: 'Dante "Quadrifólio"',
  akira: 'Akira "Godzilla"',
};

/** Nina's fixed lines of the script. */
export const NINA = {
  intro: 'Então esse é o seu carro? Dá para fazer muita coisa com ele. Mas antes de pensar em turbina, aprende a colocar essa potência no chão.',
  firstWin: 'Não foi ruim. Agora imagina o que dá para fazer com um pouco de acerto e as peças certas.',
  defeat: 'Olha o tempo da largada e a patinação. Nem sempre o problema é falta de motor.',
} as const;

/** Nina's lines of chapter 2. */
export const NINA_C2 = {
  intro:
    'Lembra quando ninguém sabia seu nome? Agora um grupo bem mais seleto quer te conhecer. Importados, motor moderno, uma liga de madrugada que não aparece em lugar nenhum.',
  intro2: 'Pode ir com o carro que trouxe você até aqui. Se ele estiver bem preparado, carro caro nenhum ganha só por ser caro.',
  caio: 'Esse é o Caio. Eletrônica e turbo. Ele vai mexer onde a minha chave não alcança.',
} as const;

/** Nina's lines of chapter 3. */
export const NINA_C3 = {
  intro:
    'Você derrubou a Liga. Agora quem quer te conhecer não anda de importado qualquer: é a elite. V6 em todo lugar, carro que custa mais que uma casa, e gente que nunca perdeu.',
  intro2:
    'Oito carros premium, dois velhos conhecidos que voltaram diferentes e um dono. Pode continuar com o carro que te trouxe até aqui: se ele estiver bem acertado, o preço do carro do rival não decide nada.',
  caio: 'O Caio continua com você. Os motores aqui são outro mundo, e ele vai te dizer onde mexer.',
  firstDefeat: 'Na elite, perto é o mesmo que longe. Olha a telemetria: o tempo foi perdido na largada, na troca ou na patinação?',
} as const;

/** Caio's lines of chapter 3. */
export const CAIO_C3 = {
  intro:
    'Aqui os motores são V6, aspirados ou com dois turbos, um por bancada. Peça de AP, de K20 ou de N55 não cabe neles: a oficina só mostra o que serve no seu carro. Nos aspirados o ganho vem de pneu, peso e suspensão; nos biturbo, de ECU e pressão.',
  workshop:
    'Dois turbos, um de cada lado do motor: o torque chega pelos dois ao mesmo tempo. Se mexer na pressão, mexe nos dois. O dinamômetro mostra a faixa que a ECU deixa e o que o motor aguenta.',
} as const;

/** Speaker of each unlock line (Caio for electronics and turbo, Nina for the rest). */
const UNLOCK_SPEAKER: Partial<Record<UnlockId, PortraitId>> = {
  'c2-ecu': 'caio',
  'c2-intercooler': 'caio',
  'c2-boost-control': 'caio',
  'c2-programmable': 'caio',
  'c2-turbo-hybrid': 'caio',
  'c2-internals': 'caio',
  'c2-stage2': 'caio',
  'c3-stage3': 'caio',
};

const UNLOCK_INTRO: Partial<Record<UnlockId, string>> = {
  // ---- chapter 2
  'c2-ecu': CAIO.ecu,
  'c2-intercooler': 'Ar mais frio é ar mais denso. Intercooler maior segura a temperatura quando a pressão sobe, e afasta a detonação.',
  'c2-boost-control': 'O atuador de fábrica só segura um pouco acima da pressão original. Com controle de boost a wastegate obedece a ECU.',
  'c2-engine-family':
    'Peças por família de motor: comando, coletor, cabeçote, pistões e volante. Cada uma só aparece para o motor em que ela cabe.',
  'c2-gearbox': 'Agora dá para mexer no câmbio automático e no de dupla embreagem: mais capacidade de torque e trocas mais rápidas. Embreagem de manual não serve para eles.',
  'c2-suspension': 'Suspensão de arrancada: cada tração pede um acerto. Tração dianteira quer peso na frente; traseira, o carro sentando atrás.',
  'c2-programmable': CAIO.dyno,
  'c2-turbo-hybrid': 'Turbina híbrida: mais vazão em cima, enche um pouco mais tarde. Só com ECU programável, senão a pressão nem muda.',
  'c2-internals': 'Pistões forjados. Não dão potência sozinhos, mas sobem o limite de torque que o motor aguenta.',
  'c2-tires-slick': 'Slick de arrancada. Gruda como nada, mas só quando estiver quente.',
  'c2-generic-tires': 'Pneu mais largo e pressão de arrancada agora servem nos carros modernos também.',
  'c2-generic-chassis': 'Alívio de peso, radiador, óleo e ventoinha: agora também nos importados.',
  'c2-stage2': 'Stage 2: downpipe sem catalisador, admissão direta e o meu mapa com mais pressão. Precisa de intercooler maior, e se o torque subir demais, de forjados e câmbio reforçado.',
  'c2-awd': 'Acerto do diferencial central: o acoplamento passa torque para o outro eixo mais cedo. Só para tração integral.',
  'c2-final-challenge': 'O Victor aceitou correr com você. Corredor da Liga, quatrocentos metros.',
  'c2-dealer-335i': 'A revenda passou a vender a 335i de série. A do Victor, essa já é sua.',
  // ---- chapter 3
  'c3-stage3': 'Stage 3 de turbina de fábrica: mapa para motor forjado. Exige turbina de maior fluxo, downpipe, intercooler maior e pistões forjados; sem tudo isso a ECU recusa o mapa.',
  'c3-dealer-gtr': 'A revenda Elite liberou o GT-R de série. O do Akira, esse você só ganha na pista.',
  'c3-final-challenge': 'O Akira aceitou o duelo final. Pier Elite, quatrocentos metros.',
  // ---- chapter 1
  'workshop-basic': 'A oficina está aberta para você. Começa pelo que deixa o motor respirar: filtro e escape.',
  'part-manifold': 'Chegou um coletor de dutos mais curtos. Ganha em cima, perde um pouco embaixo: pensa no seu câmbio antes de comprar.',
  'part-tires-sport': 'Pneu esportivo é o upgrade mais honesto que existe. De nada adianta motor se a roda gira em falso.',
  'part-cam': 'Comando esportivo: mais giro, menos força em baixa. Não é para todo carro.',
  'workshop-transmission': 'Agora dá para mexer na transmissão também.',
  'part-clutch': 'Embreagem reforçada não cria cavalo nenhum. Ela só para de jogar fora o que o motor já faz.',
  'part-differential': 'Diferencial mais curto puxa mais forte, mas a final vem antes. Testa no dinamômetro e na pista.',
  'part-tires-semislick': 'Semi-slick só gruda quente. Na primeira saída ele ainda está frio.',
  'engine-tuners': 'Os preparadores toparam ajustar a pressão do turbo no dinamômetro, quando você tiver um. Pressão demais, o motor detona.',
  'part-turbo': 'O kit turbo chegou. Sem embreagem reforçada, ele vai patinar o disco na primeira saída.',
};

function buildScenes(): StoryScene[] {
  const s: StoryScene[] = [
    ...chapter2Scenes(),
    ...chapter3Scenes(),
    { id: 'intro', trigger: 'start', lines: [{ speaker: 'nina', text: NINA.intro }] },
    {
      id: 'workshop-first',
      trigger: 'workshop',
      lines: [
        {
          speaker: 'nina',
          text: 'Aqui é a oficina. Cada peça mexe em uma coisa de verdade: pressão, fluxo, aderência. Olha o antes e depois antes de gastar.',
        },
      ],
    },
    { id: 'first-win', trigger: 'victory', lines: [{ speaker: 'nina', text: NINA.firstWin }] },
    { id: 'first-defeat', trigger: 'defeat', lines: [{ speaker: 'nina', text: NINA.defeat }] },
    {
      id: 'final-challenge',
      trigger: 'final-challenge',
      lines: [
        { speaker: 'nina', text: 'O Marcos aceitou. A Saveiro dele é turbo, e não saiu assim da fábrica. Ela patina, mas quando engata, some.' },
        { speaker: 'nina', text: 'Confere a embreagem e os pneus. Contra ele, quem larga mal não tem segunda chance.' },
        { speaker: 'nina', text: 'E tem a regra do último desafio: quem perde entrega o carro. Ele sabe. Você também.' },
      ],
    },
    {
      id: 'completion',
      trigger: 'completion',
      lines: [
        { speaker: 'nina', text: 'Rei da Madrugada. Sete noites atrás ninguém sabia seu nome.' },
        { speaker: 'nina', text: 'Já tem gente de outras regiões perguntando por você. Dizem que lá a conversa é outra. Mas isso fica para depois.' },
      ],
    },
  ];
  for (const e of ALL_EVENTS) {
    const r = rivalOf(e);
    const chapter = e.chapter;
    s.push({ id: `pre-${e.id}`, chapter, trigger: 'pre-race', eventId: e.id, lines: [{ speaker: r.portrait, text: r.lines.before }] });
    s.push({ id: `win-${e.id}`, chapter, trigger: 'victory', eventId: e.id, lines: [{ speaker: r.portrait, text: r.lines.win }] });
    if (r.lines.lose) s.push({ id: `lose-${e.id}`, chapter, trigger: 'defeat', eventId: e.id, lines: [{ speaker: r.portrait, text: r.lines.lose }] });
    // the loser of a final hands the car over (also played when a save claims it afterwards)
    if (r.prize) s.push({ id: `prize-${e.id}`, chapter, trigger: 'prize', eventId: e.id, lines: r.prize.lines });
    const unl = e.unlocks.filter((u) => UNLOCK_INTRO[u]);
    if (unl.length)
      s.push({
        id: `unlock-${e.id}`,
        chapter,
        trigger: 'unlock',
        eventId: e.id,
        lines: unl.map((u) => ({ speaker: UNLOCK_SPEAKER[u] ?? ('nina' as const), text: `${UNLOCK_LABEL[u]}: ${UNLOCK_INTRO[u]!}` })),
      });
  }
  return s;
}

function chapter2Scenes(): StoryScene[] {
  const c = CHAPTER_2_ID;
  return [
    {
      id: 'c2-intro',
      chapter: c,
      trigger: 'start',
      lines: [
        { speaker: 'nina', text: NINA_C2.intro },
        { speaker: 'nina', text: NINA_C2.intro2 },
        { speaker: 'nina', text: NINA_C2.caio },
        { speaker: 'caio', text: CAIO.intro },
      ],
    },
    { id: 'c2-workshop', chapter: c, trigger: 'workshop', lines: [{ speaker: 'caio', text: CAIO.workshop }] },
    {
      id: 'c2-first-defeat',
      chapter: c,
      trigger: 'defeat',
      lines: [{ speaker: 'caio', text: 'Antes de comprar peça, olha o dinamômetro e a telemetria. Às vezes o tempo está na largada, às vezes na troca.' }],
    },
    {
      id: 'c2-final-challenge',
      chapter: c,
      trigger: 'final-challenge',
      lines: [
        { speaker: 'nina', text: 'Victor. Seis cilindros turbo, câmbio automático de oito marchas, tudo acertado com calma. Ele não erra.' },
        { speaker: 'caio', text: 'O carro dele está no limite do que o motor aguenta com segurança. Se você quer passar, tem que ser no acerto e na largada.' },
        { speaker: 'nina', text: 'E vale a regra da liga: quem perde a última etapa entrega o carro. Ele sabe. Você também.' },
      ],
    },
    {
      id: 'c2-completion',
      chapter: c,
      trigger: 'completion',
      lines: [
        { speaker: 'nina', text: 'Dono da Liga. Você ganhou de carro mais caro, mais novo e mais forte. Ganhou porque entendeu cada um deles.' },
        { speaker: 'caio', text: 'E o dinamômetro guardou tudo. Quando quiser continuar mexendo, a oficina está aberta.' },
      ],
    },
  ];
}

function chapter3Scenes(): StoryScene[] {
  const c = CHAPTER_3_ID;
  return [
    {
      id: 'c3-intro',
      chapter: c,
      trigger: 'start',
      lines: [
        { speaker: 'nina', text: NINA_C3.intro },
        { speaker: 'nina', text: NINA_C3.intro2 },
        { speaker: 'nina', text: NINA_C3.caio },
        { speaker: 'caio', text: CAIO_C3.intro },
      ],
    },
    { id: 'c3-workshop', chapter: c, trigger: 'workshop', lines: [{ speaker: 'caio', text: CAIO_C3.workshop }] },
    { id: 'c3-first-defeat', chapter: c, trigger: 'defeat', lines: [{ speaker: 'nina', text: NINA_C3.firstDefeat }] },
    {
      id: 'c3-final-challenge',
      chapter: c,
      trigger: 'final-challenge',
      lines: [
        { speaker: 'nina', text: 'Akira. GT-R com dois turbos, dupla embreagem e tração integral, tudo de fábrica. Ele não precisa de peça: o carro já nasceu para isso.' },
        { speaker: 'caio', text: 'O ponto fraco dele é você. Ele nunca correu contra alguém que soubesse o limite de cada peça.' },
        { speaker: 'nina', text: 'E vale a regra da elite: quem perde o último duelo entrega o carro. Ele sabe. Você também.' },
      ],
    },
    {
      id: 'c3-completion',
      chapter: c,
      trigger: 'completion',
      lines: [
        { speaker: 'nina', text: 'Elite da Madrugada, campeão. Você começou com um Gol e uma chave de boca. Hoje tem o GT-R do Akira na garagem.' },
        { speaker: 'caio', text: 'E o dinamômetro guardou cada curva. Quando quiser continuar mexendo, a oficina está aberta.' },
      ],
    },
  ];
}

export const STORY_SCENES: readonly StoryScene[] = buildScenes();

export function findScene(id: string): StoryScene | undefined {
  return STORY_SCENES.find((x) => x.id === id);
}

/** Scenes of a trigger (optionally for one event) of a chapter that the player has not seen yet. */
export function pendingScenes(trigger: StoryTrigger, seen: readonly string[], eventId?: string, chapter: ChapterId = CHAPTER_1_ID): StoryScene[] {
  return STORY_SCENES.filter(
    (x) => x.trigger === trigger && (x.chapter ?? CHAPTER_1_ID) === chapter && (x.eventId === undefined || x.eventId === eventId) && !seen.includes(x.id),
  );
}
