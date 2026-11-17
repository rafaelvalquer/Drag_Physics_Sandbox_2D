import type { CarConfig } from '../../../data/schema';
import { findCampaignCar } from '../../../data/cars/campaign';
import { eventsOf, rivalOf, type CareerEventDef, type PortraitId } from '../../../game/career/CareerEvents';
import { isChapterComplete, isChapterUnlocked, nextEvent } from '../../../game/career/CareerProgression';
import { ownedCarBuild } from '../../../game/career/RivalBuildFactory';
import type { CareerSave } from '../../../game/career/CareerState';
import { CHAPTER_1_ID, CHAPTER_2_ID, chapterOf, type ChapterId } from '../../../game/career/chapters';
import { RACE_DISTANCES } from '../../../game/race/RaceController';

/** Everything the main menu shows, derived from the save only (pure: no DOM, nothing invented). */
export interface MenuViewModel {
  hasSave: boolean;
  chapter: { id: ChapterId; number: number; title: string; tagline: string; theme: 'amber' | 'blue' };
  credits: number | null;
  reputation: number | null;
  progress: { done: number; total: number; percent: number; unit: string; complete: boolean };
  next: null | {
    order: number;
    total: number;
    title: string;
    rivalName: string;
    rivalNickname: string;
    rivalPortrait: PortraitId;
    rivalCarName: string;
    distanceLabel: string;
    region: string;
    rewardCr: number;
    finale: boolean;
  };
  car: null | {
    name: string;
    powerCv: number;
    torqueNm: number;
    aspiration: string;
    drive: string;
    stage: string;
  };
  chapter2Open: boolean;
}

const TAGLINE: Record<ChapterId, string> = {
  [CHAPTER_1_ID]: 'Sete noites para conquistar seu nome.',
  [CHAPTER_2_ID]: 'Novos carros. Novos rivais. Outro nível.',
};

const fmtDrive = (c: CarConfig): string => (c.drivenAxle === 'awd' ? 'integral' : c.drivenAxle === 'rear' ? 'traseira' : 'dianteira');

export function menuViewModel(save: CareerSave | null, chapterId: ChapterId): MenuViewModel {
  const def = chapterOf(chapterId);
  const evs = eventsOf(chapterId);
  const done = save ? evs.filter((e) => save.completedEventIds.includes(e.id)).length : 0;
  const complete = save ? isChapterComplete(save, chapterId) : false;
  const nxt: CareerEventDef | null = save ? nextEvent(save, chapterId) : null;
  let car: MenuViewModel['car'] = null;
  const owned = save ? (save.ownedCars.find((c) => c.id === save.activeCarId) ?? null) : null;
  if (owned) {
    const b = ownedCarBuild(owned);
    if (b.ok) {
      car = {
        name: owned.nickname,
        powerCv: Math.round(b.peakPowerCv),
        torqueNm: Math.round(b.peakTorqueNm),
        aspiration: b.car.engine.induction === 'turbo' ? 'turbo' : 'aspirado',
        drive: fmtDrive(b.car),
        stage: owned.installedParts.length ? `${owned.installedParts.length} ${owned.installedParts.length === 1 ? 'peça' : 'peças'}` : 'original',
      };
    }
  }
  let next: MenuViewModel['next'] = null;
  if (nxt) {
    const rv = rivalOf(nxt);
    next = {
      order: nxt.order,
      total: evs.length,
      title: nxt.title,
      rivalName: rv.name,
      rivalNickname: rv.nickname,
      rivalPortrait: rv.portrait,
      rivalCarName: findCampaignCar(rv.baseCarId)?.name ?? rv.baseCarId,
      distanceLabel: RACE_DISTANCES[nxt.distance].label,
      region: nxt.regionLabel,
      rewardCr: nxt.rewardCr,
      finale: !!nxt.finale,
    };
  }
  return {
    hasSave: !!save,
    chapter: { id: chapterId, number: def.number, title: def.title, tagline: TAGLINE[chapterId], theme: chapterId === CHAPTER_2_ID ? 'blue' : 'amber' },
    credits: save ? save.credits : null,
    reputation: save ? save.reputation : null,
    progress: { done, total: evs.length, percent: evs.length ? Math.round((done / evs.length) * 100) : 0, unit: chapterId === CHAPTER_1_ID ? 'noites' : 'etapas', complete },
    next,
    car,
    chapter2Open: save ? isChapterUnlocked(save, CHAPTER_2_ID) : false,
  };
}
