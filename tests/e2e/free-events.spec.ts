import { expect, test, type Page } from '@playwright/test';
import { boot, errors, mode } from './helpers';
import { eventsOf } from '../../src/game/career/CareerEvents';
import { FREE_CARS } from '../../src/game/career/freeEvents/FreeEventCatalog';
import type { FreeOffer } from '../../src/game/career/freeEvents/FreeEventTypes';
import type { ChapterId } from '../../src/game/career/chapters';

test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));

async function openCareer(page: Page): Promise<void> {
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await mode(page, 'm.ready');
}

async function newCareer(page: Page): Promise<void> {
  await openCareer(page);
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-gm-chevette-sl-1988').click();
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  await mode(page, "(async () => { const s = m.controller.save; await m.controller.repo.transact(s.revision, (draft) => { draft.freeEvents.seed = 24; return draft; }); await m.controller.load(); })()");
}

const cards = (page: Page) => page.getByTestId('free-offer');
const board = (page: Page) => mode<FreeOffer[]>(page, 'm.controller.save.freeEvents.offersByChapter[m.chapter]');

async function finishRace(page: Page, lose = false) {
  // Advance the live race's real fixed steps without waiting on wall-clock time. Only the first
  // driver's reaction is delayed to exercise a legal defeat through the normal result path.
  await mode(page, `(() => {
    const race = m.race;
    if (${lose}) race.raceLanes[0].ai.reaction = 4;
    const hadSound = m.runner.vehicles.every(v => v.sound !== null);
    for (let i = 0; race.phase !== 'finished' && i < 120 * 85; i++) m.runner.stepOnce();
    for (const v of m.runner.vehicles) v.sound?.flush();
    return hadSound;
  })()`).then((hadSound) => expect(hadSound).toBe(true));
  await expect(page.getByTestId('career-result')).toBeVisible();
}

test('oferta persiste após recarregar, permite revanche e paga uma única vez', async ({ page }) => {
  await newCareer(page);
  await page.getByTestId('nav-free-events').click();
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByTestId('free-filter-rua')).toBeDisabled();
  const initial = await board(page);
  const bases = FREE_CARS['chapter-1'].map((car) => car.id);
  expect(initial.every((offer) => bases.includes(offer.opponent.baseCarId))).toBe(true);

  await openCareer(page);
  await page.getByTestId('career-continue').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  await page.getByTestId('nav-free-events').click();
  await expect(cards(page)).toHaveCount(3);
  expect(await board(page)).toEqual(initial);

  const [offer, ...other] = initial;
  const before = await mode<{ credits: number; story: string[]; rep: number }>(page, '({ credits: m.controller.save.credits, story: m.controller.save.completedEventIds, rep: m.controller.save.reputation })');
  await cards(page).first().getByTestId('free-pick').click();
  await expect(page.getByTestId('career-rival')).toContainText(offer!.paintName);
  await expect(page.getByTestId('rival-reward')).toContainText('250 CR');
  await mode(page, '(m.autopilot = true)');
  await page.getByTestId('rival-start').click();
  await expect(page.getByTestId('race-status')).toBeVisible();
  expect(await mode<string>(page, 'm.runner.vehicles[1].sim.car.visual.color')).toBe(offer!.paint.color);
  await finishRace(page, true);
  await expect(page.getByTestId('result-winner')).toHaveAttribute('data-outcome', 'loss');
  await expect(page.getByTestId('result-award')).toHaveText('+0 CR');
  expect((await board(page))[0]!.opponent).toEqual(offer!.opponent);
  await page.getByTestId('result-retry').click();
  await expect(page.getByTestId('rival-name')).toContainText(offer!.opponent.driverName);
  await expect(page.getByTestId('career-rival')).toContainText(offer!.preparation);
  await page.getByTestId('rival-start').click();
  await expect(page.getByTestId('race-status')).toBeVisible();
  await finishRace(page);
  await expect(page.getByTestId('result-winner')).toHaveAttribute('data-outcome', 'win');
  await expect(page.getByTestId('result-award')).toHaveText('+250 CR');
  await expect(page.getByTestId('free-result-car')).toContainText(offer!.paintName);
  await expect(page.getByTestId('result-retry')).toHaveCount(0);

  const after = await mode<typeof before>(page, '({ credits: m.controller.save.credits, story: m.controller.save.completedEventIds, rep: m.controller.save.reputation })');
  expect(after).toEqual({ ...before, credits: before.credits + 250 });
  await page.getByTestId('result-events').click();
  await expect(cards(page)).toHaveCount(3);
  const replaced = await board(page);
  expect(replaced.find((entry) => entry.slot === offer!.slot)!.id).not.toBe(offer!.id);
  expect(replaced.filter((entry) => entry.slot !== offer!.slot)).toEqual(other);
  await page.getByTestId('free-history').click();
  await expect(page.getByTestId('history-total')).toHaveText('2');
  await expect(page.getByTestId('history-wins')).toHaveText('1');
  await page.getByTestId('history-row').first().getByRole('button').click();
  await expect(page.getByTestId('history-detail')).toContainText(offer!.paintName);
});

test('libera catálogos posteriores, premiação do capítulo e a prova de 1 km', async ({ page }) => {
  await newCareer(page);
  for (const chapter of ['chapter-2', 'chapter-3'] as const) {
    const previous: ChapterId = chapter === 'chapter-2' ? 'chapter-1' : 'chapter-2';
    for (const ev of eventsOf(previous)) {
      const run = "{ name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false }";
      const saved = await mode<boolean>(page, `m.controller.recordRace({
        attemptId: '${ev.id}-free-e2e', eventId: '${ev.id}', playerCarId: m.controller.activeCar.id,
        opponentCarId: 'r', playerResult: ${run}, opponentResult: ${run}, outcome: 'win',
        completedAt: new Date().toISOString(), buildVersion: 1, playerBuildKey: 'k', opponentBuildKey: 'k',
      }).then((r) => r.ok)`);
      expect(saved).toBe(true);
    }
    expect(await mode<boolean>(page, `m.controller.setActiveChapter('${chapter}').then((r) => r.ok)`)).toBe(true);
    await mode(page, "m.show('garage')");
    await page.getByTestId('nav-free-events').click();
    await expect(cards(page)).toHaveCount(3);
    const offers = await board(page);
    const bases = FREE_CARS[chapter].map((car) => car.id);
    expect(offers.every((offer) => bases.includes(offer.opponent.baseCarId))).toBe(true);
    expect(offers[0]!.rewardCr).toBe(chapter === 'chapter-2' ? 1200 : 5000);
    if (chapter === 'chapter-3') {
      const km = offers.find((offer) => offer.distance === 'km')!;
      expect(['hangar-executivo', 'pier-elite']).toContain(km.trackId);
      await page.locator(`[data-offer-id="${km.id}"]`).getByTestId('free-pick').click();
      await expect(page.getByTestId('rival-reward')).toContainText('6.250 CR');
      await mode(page, '(m.autopilot = true)');
      await page.getByTestId('rival-start').click();
      await expect(page.getByTestId('race-status')).toBeVisible();
      expect(await mode(page, 'm.race.distanceM')).toBe(1000);
      await finishRace(page);
      await expect(page.getByTestId('career-result')).toContainText('1.000 m');
    }
  }
});
