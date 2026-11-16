import type { PortraitId } from './CareerEvents';
import { EVENTS, rivalOf } from './CareerEvents';
import { UNLOCK_LABEL, type UnlockId } from './tuning/parts';

/**
 * Story scenes as data. A scene plays once (its id goes to `seenStorySceneIds`); every scene can
 * be skipped. Triggers name the moment of the career they belong to.
 */
export type StoryTrigger = 'start' | 'workshop' | 'pre-race' | 'victory' | 'defeat' | 'unlock' | 'final-challenge' | 'completion';

export interface StoryLine {
  speaker: PortraitId;
  text: string;
}

export interface StoryScene {
  id: string;
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
};

/** Nina's fixed lines of the script. */
export const NINA = {
  intro: 'Então esse é o seu carro? Dá para fazer muita coisa com ele. Mas antes de pensar em turbina, aprende a colocar essa potência no chão.',
  firstWin: 'Não foi ruim. Agora imagina o que dá para fazer com um pouco de acerto e as peças certas.',
  defeat: 'Olha o tempo da largada e a patinação. Nem sempre o problema é falta de motor.',
} as const;

const UNLOCK_INTRO: Partial<Record<UnlockId, string>> = {
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
  for (const e of EVENTS) {
    const r = rivalOf(e);
    s.push({ id: `pre-${e.id}`, trigger: 'pre-race', eventId: e.id, lines: [{ speaker: r.portrait, text: r.lines.before }] });
    s.push({ id: `win-${e.id}`, trigger: 'victory', eventId: e.id, lines: [{ speaker: r.portrait, text: r.lines.win }] });
    if (r.lines.lose) s.push({ id: `lose-${e.id}`, trigger: 'defeat', eventId: e.id, lines: [{ speaker: r.portrait, text: r.lines.lose }] });
    const unl = e.unlocks.filter((u) => UNLOCK_INTRO[u]);
    if (unl.length)
      s.push({
        id: `unlock-${e.id}`,
        trigger: 'unlock',
        eventId: e.id,
        lines: unl.map((u) => ({ speaker: 'nina' as const, text: `${UNLOCK_LABEL[u]}: ${UNLOCK_INTRO[u]!}` })),
      });
  }
  return s;
}

export const STORY_SCENES: readonly StoryScene[] = buildScenes();

export function findScene(id: string): StoryScene | undefined {
  return STORY_SCENES.find((x) => x.id === id);
}

/** Scenes of a trigger (optionally for one event) that the player has not seen yet. */
export function pendingScenes(trigger: StoryTrigger, seen: readonly string[], eventId?: string): StoryScene[] {
  return STORY_SCENES.filter((x) => x.trigger === trigger && (x.eventId === undefined || x.eventId === eventId) && !seen.includes(x.id));
}
