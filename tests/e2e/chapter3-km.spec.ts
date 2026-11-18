/**
 * Chapter 3, 1 km duel end to end in the real app: the rival presentation shows the distance and the
 * resolved build, the race HUD shows the distance out of 1000 m and the 402 m partial, the car runs
 * past the line and stops inside the track, and the result lists 201 m, 402 m and 1000 m.
 * Screenshots go to `visual-captures/chapter3/`.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, errors, mode } from './helpers';

const OUT = `${process.env.VISUAL_DIR ?? 'visual-captures'}/chapter3`;
mkdirSync(OUT, { recursive: true });

const C1 = ['e1-primeira-noite', 'e2-pequeno-valente', 'e3-acerto-de-contas', 'e4-tracao-traseira', 'e5-respeita-o-ap', 'e6-o-aspirado', 'e7-rei-da-madrugada'];
const C2 = ['c2e1-portas-abertas', 'c2e2-turbo-frances', 'c2e3-lenda-do-gti', 'c2e4-quatro-argolas', 'c2e5-precisao-alema', 'c2e6-tracao-traseira', 'c2e7-vtec', 'c2e8-troca-perfeita', 'c2e9-tracao-total', 'c2e10-dono-da-liga'];
const C3_FIRST_FIVE = ['c3e1-a-volta-do-gti', 'c3e2-primeira-elite', 'c3e3-silencio-refinado', 'c3e4-zeta-de-verdade', 'c3e5-peso-pesado'];
const KM_EVENT = 'c3e6-salao-italiano';

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function readDialogue(page: Page): Promise<void> {
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
}

function winJs(eventId: string): string {
  const run = "{ name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false }";
  return `m.controller.recordRace({ attemptId: '${eventId}-km-' + Math.random().toString(36).slice(2), eventId: '${eventId}', playerCarId: m.controller.activeCar.id, opponentCarId: 'r', playerResult: ${run}, opponentResult: ${run}, outcome: 'win', completedAt: new Date().toISOString(), buildVersion: 1, playerBuildKey: 'k', opponentBuildKey: 'k' }).then((r) => r.ok)`;
}

test('capítulo 3: duelo de 1 km — apresentação, HUD, passagem pela linha e resultado com parciais', async ({ page }) => {
  test.setTimeout(600_000);
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __app: { debug: { current: { id: string } } } }).__app.debug.current.id === 'career');
  await mode(page, 'm.ready');
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await readDialogue(page);
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();

  for (const id of C1) expect(await mode<boolean>(page, winJs(id))).toBe(true);
  await mode(page, `m.controller.markScenesSeen(['completion'])`);
  expect(await mode<boolean>(page, `m.controller.setActiveChapter('chapter-2').then((r) => r.ok)`)).toBe(true);
  for (const id of C2) expect(await mode<boolean>(page, winJs(id))).toBe(true);
  await mode(page, `m.controller.markScenesSeen(['c2-completion'])`);
  expect(await mode<boolean>(page, `m.controller.setActiveChapter('chapter-3').then((r) => r.ok)`)).toBe(true);
  for (const id of C3_FIRST_FIVE) expect(await mode<boolean>(page, winJs(id))).toBe(true);
  await mode(page, `m.controller.commit((s) => void (s.credits = 400000))`);
  expect(await mode<boolean>(page, `m.controller.buyCar('nissan-370z-2014').then((r) => r.ok)`)).toBe(true);
  const id = await mode<string>(page, `m.controller.save.ownedCars.find((c) => c.baseCarId === 'nissan-370z-2014').id`);
  await mode(page, `m.controller.setActiveCar('${id}').then(() => m.show('events'))`);

  // the rival presentation: 1 km, the build resolved from the parts, aspiration and prep level
  await page.getByTestId(`event-${KM_EVENT}`).click();
  await expect(page.getByTestId('rival-name')).toContainText('Valentina');
  await expect(page.locator('.rv-info')).toContainText('1 km');
  await expect(page.locator('.rv-side.right')).toContainText('biturbo · Stage 2');
  await shot(page, 'e2e-km-01-apresentacao');

  await mode(page, '(m.autopilot = true)');
  await page.getByTestId('rival-start').click();
  await expect.poll(() => mode<string>(page, 'm.screen')).toBe('race');
  await expect(page.getByTestId('hud-distance')).toContainText('/ 1000 m');
  await expect(page.getByTestId('hud-left')).toContainText('m');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.x'), { timeout: 60_000 }).toBeGreaterThan(450);
  // the 402 m partial is a real crossing, never an estimate
  await expect(page.getByTestId('hud-partial')).toContainText('s');
  await shot(page, 'e2e-km-02-corrida-hud');
  // the car passes the line and keeps moving, then the automatic brake stops it inside the track
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.x'), { timeout: 90_000 }).toBeGreaterThan(1000);
  await shot(page, 'e2e-km-03-depois-da-linha');
  await expect.poll(() => mode<string>(page, 'm.screen'), { timeout: 120_000 }).toBe('result');
  expect(await mode<number>(page, 'm.runner.player.sim.x')).toBeLessThan(1700);
  await readDialogue(page);
  const result = page.locator('.career-result, [data-testid="career-result"]').first();
  await expect(result).toContainText('201 m');
  await expect(result).toContainText('402 m');
  await expect(result).toContainText('1.000 m');
  await expect(result).toContainText('Velocidade na linha de chegada');
  await shot(page, 'e2e-km-04-resultado');
  const run = await mode<{ splitsS: Record<string, number>; maxRpm: number; gearsUsed: number[] }>(page, 'm.lastRecord.result.playerResult');
  expect(run.splitsS.eighth).toBeGreaterThan(0);
  expect(run.splitsS.quarter).toBeGreaterThan(run.splitsS.eighth!);
  expect(run.maxRpm).toBeGreaterThan(3000);
  expect(run.gearsUsed.length).toBeGreaterThan(2);
});
