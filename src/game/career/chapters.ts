/**
 * Chapters of the career. A chapter is a sequence of events with its own story; progress,
 * credits, reputation, cars and parts are shared by the whole career (one save per slot).
 * Chapter 2 is unlocked by completing chapter 1; an old save that already completed chapter 1
 * opens chapter 2 directly (save migration v1 → v2).
 */
export const CHAPTER_1_ID = 'chapter-1';
export const CHAPTER_2_ID = 'chapter-2';
export const CHAPTER_IDS = [CHAPTER_1_ID, CHAPTER_2_ID] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export interface ChapterDef {
  id: ChapterId;
  number: number;
  title: string;
  /** Short line for the chapter selector (pt-BR). */
  blurb: string;
  /** Word used for one event ("Noite 3", "Etapa 3"). */
  eventWord: string;
  /** Total reputation the career can hold at the end of this chapter (cumulative cap). */
  reputationCap: number;
  /** Chapter that must be complete before this one opens. */
  after?: ChapterId;
}

export const CHAPTERS: readonly ChapterDef[] = [
  { id: CHAPTER_1_ID, number: 1, title: 'Madrugada Zero', blurb: 'Um carro simples, sete noites e o Rei da Madrugada.', eventWord: 'Noite', reputationCap: 250 },
  {
    id: CHAPTER_2_ID,
    number: 2,
    title: 'Liga da Madrugada',
    blurb: 'Importados, motores modernos e a liga informal dos preparadores.',
    eventWord: 'Etapa',
    reputationCap: 700,
    after: CHAPTER_1_ID,
  },
];

export const CHAPTER_1_TITLE = CHAPTERS[0]!.title;
export const CHAPTER_2_TITLE = CHAPTERS[1]!.title;

export function findChapter(id: string): ChapterDef | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function chapterOf(id: ChapterId): ChapterDef {
  return CHAPTERS.find((c) => c.id === id)!;
}
