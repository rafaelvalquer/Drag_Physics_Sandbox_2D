/**
 * Chapter 2 "Liga da Madrugada" end to end, in the real app: an old career that finished chapter 1
 * opens chapter 2 (Nina and Caio), the three new venues and the ten rivals, the dealer with
 * confirmation (no duplicate after a reload), the workshop showing only the parts that fit, the
 * dyno of a chapter 2 car and one league race through the visible path. Screenshots go to
 * `visual-captures/chapter2/`.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, errors, mode } from './helpers';

const OUT = `${process.env.VISUAL_DIR ?? 'visual-captures'}/chapter2`;
mkdirSync(OUT, { recursive: true });

const C1 = ['e1-primeira-noite', 'e2-pequeno-valente', 'e3-acerto-de-contas', 'e4-tracao-traseira', 'e5-respeita-o-ap', 'e6-o-aspirado', 'e7-rei-da-madrugada'];
const C2 = [
  'c2e1-portas-abertas',
  'c2e2-turbo-frances',
  'c2e3-lenda-do-gti',
  'c2e4-quatro-argolas',
  'c2e5-precisao-alema',
  'c2e6-tracao-traseira',
  'c2e7-vtec',
  'c2e8-troca-perfeita',
  'c2e9-tracao-total',
  'c2e10-dono-da-liga',
];
const VENUES: [string, string][] = [
  ['patio-das-torres', 'c2e1-portas-abertas'],
  ['distrito-financeiro', 'c2e4-quatro-argolas'],
  ['corredor-da-liga', 'c2e10-dono-da-liga'],
];

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function openCareer(page: Page): Promise<void> {
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __app: { debug: { current: { id: string } } } }).__app.debug.current.id === 'career');
  await mode(page, 'm.ready');
}

async function readDialogue(page: Page): Promise<string[]> {
  const lines: string[] = [];
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) {
    lines.push((await page.getByTestId('dialogue-line').textContent()) ?? '');
    await page.getByTestId('dialogue-next').click();
  }
  return lines;
}

/** Records a win of an event through the controller (same path as a race result). */
function winJs(eventId: string): string {
  const run = "{ name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false }";
  return `m.controller.recordRace({ attemptId: '${eventId}-e2e-' + Math.random().toString(36).slice(2), eventId: '${eventId}', playerCarId: m.controller.activeCar.id, opponentCarId: 'r', playerResult: ${run}, opponentResult: ${run}, outcome: 'win', completedAt: new Date().toISOString(), buildVersion: 1, playerBuildKey: 'k', opponentBuildKey: 'k' }).then((r) => r.ok)`;
}

test('capítulo 2: liberação, Caio, cenários, rivais, revenda, oficina compatível e corrida', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page);
  await openCareer(page);
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await readDialogue(page);
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();

  // chapter 2 is closed while chapter 1 is not finished
  expect(await mode<boolean>(page, `m.controller.setActiveChapter('chapter-2').then((r) => r.ok)`)).toBe(false);
  await expect(page.getByTestId('garage-chapters')).toHaveCount(0);

  // finish chapter 1 (results through the controller), keep its ending scene seen
  for (const id of C1) expect(await mode<boolean>(page, winJs(id))).toBe(true);
  await mode(page, `m.controller.markScenesSeen(['completion'])`);
  const c1 = await mode<{ credits: number; rep: number }>(page, '({ credits: m.controller.save.credits, rep: m.controller.save.reputation })');

  // reload: the save is versioned, chapter 2 unlocked, chapter 1 progress kept
  await boot(page); // navigates again: a fresh load of the app and of the save
  await openCareer(page);
  expect(await mode<number>(page, 'm.controller.save.version')).toBe(3);
  expect(await mode<string[]>(page, 'm.controller.save.unlockedChapters')).toEqual(['chapter-1', 'chapter-2']);
  expect(await mode<number>(page, 'm.controller.save.completedEventIds.length')).toBe(7);
  await page.getByTestId('career-continue').click();
  await expect(page.getByTestId('career-chapters-screen')).toBeVisible();
  await shot(page, '01-capitulos');
  await page.getByTestId('chapter-open-chapter-2').click();

  // introduction: Nina, then Caio
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await shot(page, '02-introducao');
  const intro = await readDialogue(page);
  expect(intro.join(' ')).toContain('Caio');
  expect(intro.join(' ')).toContain('Motor moderno não se prepara com chave de boca');
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  await expect(page.getByTestId('career-chapter')).toHaveText('Capítulo 2 · Liga da Madrugada');
  expect(await mode<number>(page, 'm.controller.save.credits')).toBe(c1.credits);
  expect(await mode<number>(page, 'm.controller.save.reputation')).toBe(c1.rep);
  await shot(page, '03-garagem-capitulo-2');

  // the three venues of the league
  for (const [track, ev] of VENUES) {
    await mode(page, `(m.selectedEvent = '${ev}', m.show('rival'))`);
    await page.evaluate(() => document.querySelector('[data-testid=career]')!.classList.add('hidden'));
    await expect.poll(() => mode<string>(page, 'm.track().id')).toBe(track);
    await page.waitForTimeout(800);
    await shot(page, `04-cenario-${track}`);
  }

  // the ten rival presentations
  for (const [i, ev] of C2.entries()) {
    await mode(page, `(m.selectedEvent = '${ev}', m.show('rival'))`);
    await expect(page.getByTestId('rival-line')).toBeVisible();
    await shot(page, `05-rival-${String(i + 1).padStart(2, '0')}`);
  }

  // events of the chapter: the first open, the rest locked
  await mode(page, `m.show('events')`);
  await expect(page.getByTestId(`event-${C2[0]}`)).toHaveAttribute('data-status', 'available');
  await expect(page.getByTestId(`event-${C2[1]}`)).toHaveAttribute('data-status', 'locked');
  await expect(page.getByTestId(`event-${C1[0]}`)).toHaveCount(0);
  await shot(page, '06-etapas');

  // dealer: confirmation, credits debited once, no duplicate after reload
  await mode(page, `m.controller.commit((s) => void (s.credits = 30000)).then(() => m.show('market'))`);
  await expect(page.getByTestId('career-dealer')).toBeVisible();
  await expect(page.getByTestId('dealer-buy-bmw-335i-f30-2013')).toBeDisabled();
  await shot(page, '07-revenda');
  await page.getByTestId('dealer-buy-gm-astra-2011').click();
  const purchase = page.getByTestId('garage-purchase');
  await expect(purchase.getByTestId('garage-use')).toHaveText('Comprar por 6.000 CR');
  await purchase.getByTestId('garage-close').click();
  await expect(purchase).toBeHidden();
  expect(await mode<number>(page, 'm.controller.save.credits')).toBe(30000);
  await page.getByTestId('dealer-buy-gm-astra-2011').click();
  await expect(purchase.getByRole('button', { name: 'cor original' })).toHaveAttribute('aria-pressed', 'true');
  await purchase.getByTestId('garage-use').click();
  await expect.poll(() => mode<number>(page, 'm.controller.save.credits')).toBe(24000);
  await expect(page.getByTestId('dealer-buy-gm-astra-2011')).toBeDisabled();
  await boot(page); // navigates again: a fresh load of the app and of the save
  await openCareer(page);
  expect(await mode<number>(page, `m.controller.save.ownedCars.filter((c) => c.baseCarId === 'gm-astra-2011').length`)).toBe(1);
  expect(await mode<number>(page, 'm.controller.save.credits')).toBe(24000);
  expect(await mode(page, `m.controller.save.ownedCars.find((c) => c.baseCarId === 'gm-astra-2011').paint`)).toEqual(
    { color: '#5b6066', accent: '#c9ced3' },
  );

  // first league race through the visible path, with the Astra
  const astraId = await mode<string>(page, `m.controller.save.ownedCars.find((c) => c.baseCarId === 'gm-astra-2011').id`);
  await mode(page, `m.controller.setActiveCar('${astraId}').then(() => m.show('events'))`);
  await page.getByTestId(`event-${C2[0]}`).click();
  await expect(page.getByTestId('rival-name')).toContainText('Gustavo');
  await mode(page, '(m.autopilot = true)');
  await page.getByTestId('rival-start').click();
  await expect.poll(() => mode<string>(page, 'm.screen')).toBe('race');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.x'), { timeout: 60_000 }).toBeGreaterThan(25);
  await shot(page, '08-corrida-patio');
  await expect.poll(() => mode<string>(page, 'm.screen'), { timeout: 120_000 }).toBe('result');
  await readDialogue(page);
  expect(await mode<number>(page, 'm.lastRecord.result.buildVersion')).toBe(2);
  await shot(page, '09-resultado');
  for (let k = 0; k < 8 && !(await mode<boolean>(page, `m.controller.save.completedEventIds.includes('${C2[0]}')`)); k++) {
    await mode(page, `m.debugSimulateRace('${C2[0]}')`);
    await readDialogue(page);
  }
  expect(await mode<string[]>(page, 'm.controller.save.completedEventIds')).toContain(C2[0]);

  // workshop: Caio's line, the NA remap for the Astra, no turbo map, no gearbox parts of other kinds
  await mode(page, `m.show('garage')`);
  await page.getByTestId('garage-workshop').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  const ws = await readDialogue(page);
  expect(ws.join(' ')).toContain('família');
  await expect(page.getByTestId('career-workshop')).toBeVisible();
  await page.getByTestId('ws-tab-electronics').click();
  await expect(page.getByTestId('ws-part-ecu-stage1-na')).toBeVisible();
  await expect(page.getByTestId('ws-part-ecu-stage1')).toHaveCount(0);
  await expect(page.getByTestId('ws-part-ecu-stage1-na')).toHaveAttribute('data-state', 'available');
  await page.getByTestId('ws-part-ecu-stage1-na').click();
  await expect(page.getByTestId('ws-compare')).toBeVisible();
  await shot(page, '10-oficina-eletronica');
  await page.getByTestId('ws-buy').click();
  await expect(page.getByTestId('ws-pill-ecu-stage1-na')).toHaveText('Em uso');
  expect(await mode<number>(page, 'm.controller.activeCar.buildVersion')).toBe(2);
  await page.getByTestId('ws-tab-transmission').click();
  await expect(page.getByTestId('ws-part-dct-upgrade')).toHaveCount(0);
  await expect(page.getByTestId('ws-part-at-upgrade')).toHaveCount(0);
  await expect(page.getByTestId('ws-part-awd-center-tune')).toHaveCount(0);

  // dyno of the chapter 2 car
  await page.getByTestId('ws-dyno').click();
  await expect(page.getByTestId('career-dyno-info')).toHaveAttribute('data-done', '1', { timeout: 60_000 });
  await expect(page.getByTestId('career-dyno-info')).toContainText('cv');
  await shot(page, '11-dinamometro');

  // garage card of a chapter 2 car: drive and gearbox labels
  await mode(page, `m.show('garage')`);
  await expect(page.getByTestId('stat-gearbox')).toContainText('manual, 5 marchas');
  await expect(page.getByTestId('garage-sell')).toBeVisible();

  // prize of the chapter 1 final: Marcos' Saveiro came with the win (trophy badge, his parts and paint)
  const prize = await mode<{ id: string; installedParts: string[]; paint: { color: string }; nickname: string; purchasePrice: number }>(
    page,
    `m.controller.save.ownedCars.find((c) => c.prizeEventId === 'e7-rei-da-madrugada')`,
  );
  expect(prize.nickname).toBe('Saveiro do Marcos');
  expect(prize.installedParts).toContain('turbo-basic');
  expect(prize.paint.color).toBe('#0d0f12');
  await mode(page, `m.controller.setActiveCar('${prize.id}').then(() => m.show('garage'))`);
  await expect(page.getByTestId('garage-trophy')).toBeVisible();
  await shot(page, '12-saveiro-do-marcos');

  // a save that won the final before the prize existed: the garage delivers it with the hand-over scene
  await mode(
    page,
    `m.controller.commit((s) => { s.ownedCars = s.ownedCars.filter((c) => !c.prizeEventId); s.activeCarId = s.ownedCars[0].id; s.claimedRewardIds = s.claimedRewardIds.filter((x) => !x.endsWith(':prize-car')); s.seenStorySceneIds = s.seenStorySceneIds.filter((x) => !x.startsWith('prize-')); })`,
  );
  await boot(page); // navigates again: a fresh load of the app and of the save
  await openCareer(page);
  expect(await mode<number>(page, `m.controller.save.ownedCars.filter((c) => c.prizeEventId).length`)).toBe(0);
  await page.getByTestId('career-garage').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  const handover = await readDialogue(page);
  expect(handover.join(' ')).toContain('quem perde o último desafio entrega a chave');
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  expect(await mode<number>(page, `m.controller.save.ownedCars.filter((c) => c.prizeEventId).length`)).toBe(1);
  // and only once: opening the garage again changes nothing
  await mode(page, `m.show('menu')`);
  await page.getByTestId('career-garage').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  expect(await mode<number>(page, `m.controller.save.ownedCars.filter((c) => c.prizeEventId).length`)).toBe(1);
});
