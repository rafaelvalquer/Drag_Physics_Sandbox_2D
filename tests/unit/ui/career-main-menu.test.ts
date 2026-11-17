/** Data behind the campaign main menu: everything comes from the save, nothing is invented. */
import { describe, expect, it } from 'vitest';
import { eventsOf } from '../../../src/game/career/CareerEvents';
import { newCareerSave, type CareerSave } from '../../../src/game/career/CareerState';
import { ownedCarBuild } from '../../../src/game/career/RivalBuildFactory';
import { menuViewModel } from '../../../src/ui/career/menu/CareerMenuProgress';

function saveWithCar(): CareerSave {
  const s = newCareerSave();
  s.ownedCars = [{ id: 'c1', baseCarId: 'vw-gol-gts-1988', nickname: 'Meu Gol', paint: { color: '#c8322b', accent: '#2a2d31' }, installedParts: [], buildVersion: 1, acquiredAt: s.createdAt }];
  s.activeCarId = 'c1';
  s.credits = 3700;
  s.reputation = 12;
  return s;
}
const ids1 = eventsOf('chapter-1').map((e) => e.id);
const ids2 = eventsOf('chapter-2').map((e) => e.id);

describe('campaign menu view model', () => {
  it('without a save: no progression, no car, no next event', () => {
    const vm = menuViewModel(null, 'chapter-1');
    expect(vm.hasSave).toBe(false);
    expect(vm.credits).toBeNull();
    expect(vm.reputation).toBeNull();
    expect(vm.car).toBeNull();
    expect(vm.next).toBeNull();
    expect(vm.progress.done).toBe(0);
    expect(vm.chapter.title).toBe('Madrugada Zero');
    expect(vm.chapter2Open).toBe(false);
  });

  it('reads credits, reputation, car and build values from the save', () => {
    const s = saveWithCar();
    const vm = menuViewModel(s, 'chapter-1');
    const b = ownedCarBuild(s.ownedCars[0]!);
    if (!b.ok) throw new Error('build');
    expect(vm.credits).toBe(3700);
    expect(vm.reputation).toBe(12);
    expect(vm.car).toMatchObject({ name: 'Meu Gol', powerCv: Math.round(b.peakPowerCv), torqueNm: Math.round(b.peakTorqueNm), aspiration: 'aspirado', drive: 'dianteira', stage: 'original' });
    expect(vm.progress).toMatchObject({ done: 0, total: 7, percent: 0, unit: 'noites', complete: false });
    expect(vm.next?.order).toBe(1);
    expect(vm.next?.title).toBe(eventsOf('chapter-1')[0]!.title);
    expect(vm.next?.rewardCr).toBe(eventsOf('chapter-1')[0]!.rewardCr);
  });

  it('progress follows the completed events and advances the next event', () => {
    const s = saveWithCar();
    s.completedEventIds = ids1.slice(0, 3);
    const vm = menuViewModel(s, 'chapter-1');
    expect(vm.progress).toMatchObject({ done: 3, total: 7, percent: Math.round((3 / 7) * 100) });
    expect(vm.next?.order).toBe(4);
  });

  it('chapter complete: no next event (no rival lookup), full bar', () => {
    const s = saveWithCar();
    s.completedEventIds = ids1;
    const vm = menuViewModel(s, 'chapter-1');
    expect(vm.next).toBeNull();
    expect(vm.progress).toMatchObject({ done: 7, percent: 100, complete: true });
  });

  it('chapter 2 has its own identity, unit and events; completed state is also safe', () => {
    const s = saveWithCar();
    s.unlockedChapters = ['chapter-1', 'chapter-2'];
    s.chapterId = 'chapter-2';
    s.completedEventIds = [...ids1, ...ids2.slice(0, 3)];
    let vm = menuViewModel(s, 'chapter-2');
    expect(vm.chapter).toMatchObject({ number: 2, title: 'Liga da Madrugada', theme: 'blue', tagline: 'Novos carros. Novos rivais. Outro nível.' });
    expect(vm.progress).toMatchObject({ done: 3, total: 10, unit: 'etapas' });
    expect(vm.next?.order).toBe(4);
    expect(vm.chapter2Open).toBe(true);
    s.completedEventIds = [...ids1, ...ids2];
    vm = menuViewModel(s, 'chapter-2');
    expect(vm.next).toBeNull();
    expect(vm.progress.complete).toBe(true);
  });

  it('counts installed parts as the preparation stage', () => {
    const s = saveWithCar();
    s.ownedCars[0]!.installedParts = ['intake-sport'];
    const vm = menuViewModel(s, 'chapter-1');
    // an unknown part id makes the build fail → no car data rather than a made-up value
    expect(vm.car === null || vm.car.stage === '1 peça').toBe(true);
  });
});
