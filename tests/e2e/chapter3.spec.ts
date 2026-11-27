/**
 * Chapter 3 "Elite da Madrugada" end to end, in the real app: a career that completed chapters 1 and
 * 2 opens chapter 3 (Nina and Caio), the three venues and the ten rivals, the Elite dealer with
 * confirmation (no duplicate after a reload), a league race through the visible path, the workshop
 * of a biturbo V6 and of an aspirated V6, the dyno, and the ending with the prize car of the boss.
 * Screenshots go to `visual-captures/chapter3/`.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, errors, mode } from './helpers';

const OUT = `${process.env.VISUAL_DIR ?? 'visual-captures'}/chapter3`;
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
const C3 = [
  'c3e1-a-volta-do-gti',
  'c3e2-primeira-elite',
  'c3e3-silencio-refinado',
  'c3e4-zeta-de-verdade',
  'c3e5-peso-pesado',
  'c3e6-salao-italiano',
  'c3e7-biturbo-alemao',
  'c3e8-a-volta-da-evo',
  'c3e9-o-trevo-vermelho',
  'c3e10-elite-da-madrugada',
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

test('capítulo 3: liberação, cenários, rivais, revenda Elite, oficina dos V6, corrida e prêmio do GT-R', async ({ page }) => {
  test.setTimeout(900_000);
  await boot(page);
  await openCareer(page);
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await readDialogue(page);
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();

  // chapter 3 is closed while chapter 2 is not finished
  expect(await mode<boolean>(page, `m.controller.setActiveChapter('chapter-3').then((r) => r.ok)`)).toBe(false);
  for (const id of C1) expect(await mode<boolean>(page, winJs(id))).toBe(true);
  expect(await mode<boolean>(page, `m.controller.setActiveChapter('chapter-3').then((r) => r.ok)`)).toBe(false); // chapter 1 alone does not open it
  await mode(page, `m.controller.markScenesSeen(['completion'])`);
  expect(await mode<boolean>(page, `m.controller.setActiveChapter('chapter-2').then((r) => r.ok)`)).toBe(true);
  for (const id of C2) expect(await mode<boolean>(page, winJs(id))).toBe(true);
  await mode(page, `m.controller.markScenesSeen(['c2-completion'])`);
  const before = await mode<{ credits: number; rep: number }>(page, '({ credits: m.controller.save.credits, rep: m.controller.save.reputation })');

  // reload: the save keeps everything and chapter 3 is open
  await boot(page);
  await openCareer(page);
  expect(await mode<string[]>(page, 'm.controller.save.unlockedChapters')).toEqual(['chapter-1', 'chapter-2', 'chapter-3']);
  await page.getByTestId('career-continue').click();
  await expect(page.getByTestId('career-chapters-screen')).toBeVisible();
  await shot(page, 'e2e-01-capitulos');
  await page.getByTestId('chapter-open-chapter-3').click();

  // introduction: Nina, then Caio
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await shot(page, 'e2e-02-introducao');
  const intro = (await readDialogue(page)).join(' ');
  expect(intro).toContain('elite');
  expect(intro).toContain('V6');
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  await expect(page.getByTestId('career-chapter')).toHaveText('Capítulo 3 · Elite da Madrugada');
  expect(await mode<number>(page, 'm.controller.save.credits')).toBe(before.credits);
  expect(await mode<number>(page, 'm.controller.save.reputation')).toBe(before.rep);
  await shot(page, 'e2e-03-garagem');

  // the ten rival presentations
  for (const [i, ev] of C3.entries()) {
    await mode(page, `(m.selectedEvent = '${ev}', m.show('rival'))`);
    await expect(page.getByTestId('rival-line')).toBeVisible();
    await shot(page, `e2e-04-rival-${String(i + 1).padStart(2, '0')}`);
  }
  // events: the first one open, the rest locked
  await mode(page, `m.show('events')`);
  await expect(page.getByTestId(`event-${C3[0]}`)).toHaveAttribute('data-status', 'available');
  await expect(page.getByTestId(`event-${C3[1]}`)).toHaveAttribute('data-status', 'locked');
  await expect(page.getByTestId(`event-${C2[0]}`)).toHaveCount(0);
  await shot(page, 'e2e-05-duelos');

  // the Elite dealer: confirmation, credits debited once, no duplicate after a reload
  await mode(page, `m.controller.commit((s) => void (s.credits = 400000)).then(() => m.show('market'))`);
  await expect(page.getByTestId('career-dealer')).toBeVisible();
  await page.getByTestId('market-filter-elite').click();
  await expect(page.getByTestId('dealer-buy-nissan-350z-2006')).toBeEnabled();
  await expect(page.getByTestId('dealer-buy-nissan-gtr-r35-2015')).toBeDisabled();
  await expect(page.getByTestId('dealer-reason-nissan-gtr-r35-2015')).toBeVisible();
  await shot(page, 'e2e-06-revenda-elite');
  await page.getByTestId('dealer-buy-nissan-350z-2006').click();
  const purchase = page.getByTestId('garage-purchase');
  await expect(purchase.getByTestId('garage-use')).toHaveText('Comprar por 45.000 CR');
  await purchase.getByTestId('garage-close').click();
  expect(await mode<number>(page, 'm.controller.save.credits')).toBe(400000);
  await page.getByTestId('dealer-buy-nissan-350z-2006').click();
  await purchase.getByTestId('garage-use').click();
  await expect.poll(() => mode<number>(page, 'm.controller.save.credits')).toBe(355000);
  await expect(page.getByTestId('dealer-buy-nissan-350z-2006')).toBeDisabled();
  await boot(page);
  await openCareer(page);
  expect(await mode<number>(page, `m.controller.save.ownedCars.filter((c) => c.baseCarId === 'nissan-350z-2006').length`)).toBe(1);
  expect(await mode<number>(page, 'm.controller.save.credits')).toBe(355000);

  // the first duel through the visible path, with the 350Z (aspirated V6, manual)
  const zId = await mode<string>(page, `m.controller.save.ownedCars.find((c) => c.baseCarId === 'nissan-350z-2006').id`);
  await mode(page, `m.controller.setActiveCar('${zId}').then(() => m.show('events'))`);
  await page.getByTestId(`event-${C3[0]}`).click();
  await expect(page.getByTestId('rival-name')).toContainText('Ricardo');
  await mode(page, '(m.autopilot = true)');
  await page.getByTestId('rival-start').click();
  await expect.poll(() => mode<string>(page, 'm.screen')).toBe('race');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.x'), { timeout: 60_000 }).toBeGreaterThan(25);
  await shot(page, 'e2e-07-corrida-marginal-alta');
  await expect.poll(() => mode<string>(page, 'm.screen'), { timeout: 120_000 }).toBe('result');
  await readDialogue(page);
  expect(await mode<number>(page, 'm.lastRecord.result.buildVersion')).toBe(2);
  await shot(page, 'e2e-08-resultado');
  for (let k = 0; k < 8 && !(await mode<boolean>(page, `m.controller.save.completedEventIds.includes('${C3[0]}')`)); k++) {
    await mode(page, `m.debugSimulateRace('${C3[0]}')`);
    await readDialogue(page);
  }
  expect(await mode<string[]>(page, 'm.controller.save.completedEventIds')).toContain(C3[0]);

  // workshop of the aspirated V6: no turbo, no remap, the generic parts
  await mode(page, `m.show('garage')`);
  await page.getByTestId('garage-workshop').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  const ws = (await readDialogue(page)).join(' ');
  expect(ws).toContain('turbo');
  await expect(page.getByTestId('career-workshop')).toBeVisible();
  await expect(page.getByTestId('ws-part-ecu-stage1')).toHaveCount(0);
  await expect(page.getByTestId('ws-part-turbo-hybrid')).toHaveCount(0);
  await page.getByTestId('ws-tab-tires').click();
  await expect(page.getByTestId('ws-part-tires-semislick')).toBeVisible();
  await shot(page, 'e2e-09-oficina-v6-aspirado');

  // workshop and dyno of a biturbo V6 (the Giulia, 90°)
  await mode(page, `m.controller.commit((s) => { s.credits = 900000; s.reputation = 1400; for (const id of ${JSON.stringify(C3.slice(0, 8))}) if (!s.completedEventIds.includes(id)) s.completedEventIds.push(id); })`);
  expect(await mode<boolean>(page, `m.controller.buyCar('alfa-giulia-qv-2017').then((r) => r.ok)`)).toBe(true);
  const gId = await mode<string>(page, `m.controller.save.ownedCars.find((c) => c.baseCarId === 'alfa-giulia-qv-2017').id`);
  await mode(page, `m.controller.setActiveCar('${gId}').then(() => m.show('workshop'))`);
  await expect(page.getByTestId('career-workshop')).toBeVisible();
  await page.getByTestId('ws-tab-electronics').click();
  await expect(page.getByTestId('ws-part-ecu-map-alfa-690t-s1')).toBeVisible();
  await expect(page.getByTestId('ws-part-ecu-stage1-na')).toHaveCount(0);
  await page.getByTestId('ws-part-ecu-map-alfa-690t-s1').click();
  await page.getByTestId('ws-details-toggle').click();
  await expect(page.getByTestId('ws-compare')).toBeVisible();
  await shot(page, 'e2e-10-oficina-biturbo');
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();
  await page.getByTestId('ws-dyno').click();
  await expect(page.getByTestId('career-dyno-info')).toHaveAttribute('data-done', '1', { timeout: 60_000 });
  await expect(page.getByTestId('career-dyno-info')).toContainText('cv');
  await shot(page, 'e2e-11-dinamometro-giulia');
  await mode(page, `m.show('garage')`);
  await expect(page.getByTestId('stat-gearbox')).toContainText('8 marchas');

  // the ending: the last duel hands the GT-R over, and the chapter is its own (not the league's)
  for (const id of C3.slice(8)) expect(await mode<boolean>(page, winJs(id))).toBe(true);
  expect(await mode<boolean>(page, `m.controller.save.ownedCars.some((c) => c.prizeEventId === '${C3[9]}' && c.baseCarId === 'nissan-gtr-r35-2015')`)).toBe(true);
  await mode(page, `(m.endingChapter = 'chapter-3', m.show('ending'))`);
  await expect(page.getByTestId('ending-title')).toHaveText('Campeão da Elite');
  await expect(page.locator('.enx')).toContainText('GT-R do Akira');
  await expect(page.locator('.enx')).not.toContainText('Dono da Liga');
  await shot(page, 'e2e-12-final');
  const outro = (await readDialogue(page)).join(' ');
  expect(outro).toContain('Elite da Madrugada');
  // the scene is marked as seen by a write that finishes right after the last line
  await expect.poll(() => mode<boolean>(page, `m.controller.save.seenStorySceneIds.includes('c3-completion')`)).toBe(true);
  await mode(page, `m.controller.setActiveCar(m.controller.save.ownedCars.find((c) => c.prizeEventId === '${C3[9]}').id).then(() => m.show('garage'))`);
  await expect(page.getByTestId('garage-trophy')).toBeVisible();
  await expect(page.getByTestId('stat-gearbox')).toContainText('manual (câmbio melhorado), 6 marchas');
  await shot(page, 'e2e-13-gtr-do-akira');
});
