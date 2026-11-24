/**
 * N₂O: the preset with a kit in the Sandbox shows the gauge, one Shift press starts the injection, releasing does not stop it,
 * the second press is needed for stage 2, and a restart refills the cylinder.
 */
import { expect, test } from '@playwright/test';
import { boot, errors, mode } from './helpers';

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('sandbox: Shift inicia o estágio 1, soltar não para, o 2 pede outro toque, reiniciar enche o cilindro', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.getByTestId('car-select').selectOption('gm-chevette-nitro-wet-sandbox');
  await expect.poll(() => mode<string | null>(page, 'm.runner.player.sim.nitrous?.status ?? null')).toBe('READY');
  await expect(page.getByTestId('hud-nitrous')).toBeVisible();
  await expect(page.getByTestId('hud-nitrous-state')).toContainText('Shift');

  // get the car moving in a gear above the kit's minimum rpm
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('e');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear')).toBe(1);
  await page.keyboard.down('w');
  // up to 2nd gear once the clutch is locked: the kit needs a gear above 1st to inject without just spinning the tyres
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.clutchCtl.mode'), { timeout: 15_000 }).toBe('LOCKED');
  await page.keyboard.press('e');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear')).toBe(2);
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.speed'), { timeout: 30_000 }).toBeGreaterThan(8);

  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.engine.rpm')).toBeGreaterThan(3600); // above the kit's minimum rpm
  await page.keyboard.down('ShiftLeft');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.nitrous.status')).toBe('STAGE_1_ACTIVE');
  await expect(page.getByTestId('hud-nitrous')).toHaveAttribute('data-status', 'STAGE_1_ACTIVE');
  await expect(page.getByTestId('hud-nitrous-edge')).toHaveAttribute('data-active', '1'); // the screen border lights up
  expect(await mode<number>(page, 'm.runner.player.sim.nitrous.telemetry().flowKgPerS')).toBeGreaterThan(0);
  await page.keyboard.up('ShiftLeft'); // releasing does not cancel
  await page.waitForTimeout(300);
  expect(await mode<string>(page, 'm.runner.player.sim.nitrous.status')).toBe('STAGE_1_ACTIVE');

  // stage 1 runs out by itself; stage 2 waits for a new press
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.nitrous.status'), { timeout: 30_000 }).toBe('STAGE_2_READY');
  await expect(page.getByTestId('hud-nitrous-state')).toContainText('ESTÁGIO 2');
  // 30 s in 2nd gear the engine may be on the limiter, where a request is refused (and spends nothing): go to 3rd and ask again
  await page.keyboard.press('e');
  await expect
    .poll(async () => {
      await page.keyboard.press('ShiftLeft');
      return mode<string>(page, 'm.runner.player.sim.nitrous.status');
    }, { timeout: 20_000 })
    .toBe('STAGE_2_ACTIVE');

  // a restart: full cylinder
  await mode(page, 'm.restart()');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.nitrous.remainingFraction')).toBe(1);
  expect(await mode<string>(page, 'm.runner.player.sim.nitrous.status')).toBe('READY');
});

test('Dyno Lab: a aba Nitro regula o kit, mede o rascunho e aplica; a oficina só aponta para o Dyno', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await mode(page, 'm.ready');
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-gm-chevette-sl-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  const C1 = ['e1-primeira-noite', 'e2-pequeno-valente', 'e3-acerto-de-contas', 'e4-tracao-traseira', 'e5-respeita-o-ap'];
  const run = "{ name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false }";
  for (const id of C1)
    await mode(
      page,
      `m.controller.recordRace({ attemptId: '${id}-n', eventId: '${id}', playerCarId: m.controller.activeCar.id, opponentCarId: 'r', playerResult: ${run}, opponentResult: ${run}, outcome: 'win', completedAt: new Date().toISOString(), buildVersion: 1, playerBuildKey: 'k', opponentBuildKey: 'k' })`,
    );
  await mode(page, `m.controller.commit((s) => void (s.credits = 20000))`);
  await mode(page, `m.controller.installBundle(['nitrous-street'])`);
  await expect.poll(() => mode<string[]>(page, 'm.controller.activeCar.installedParts')).toContain('nitrous-street');

  // the Workshop no longer has the sliders, only the way to the Dyno Lab
  await mode(page, `(m.selectedPart = 'nitrous-street', m.workshopTab = 'nitrous', m.show('workshop'))`);
  await expect(page.getByTestId('nitro-dyno-hint')).toBeVisible();
  await expect(page.getByTestId('nitro-flow1')).toHaveCount(0);
  await page.getByTestId('nitro-open-dyno').click();

  // the Dyno Lab: Nitro tab, flow slider writes the draft, Apply saves it
  await page.getByTestId('dyno-tab-nitro').click();
  await expect(page.getByTestId('nitro-panel')).toBeVisible();
  await expect(page.getByTestId('nitro-prev-1')).toContainText('Estágio 1');
  await page.getByTestId('nitro-mode').selectOption('dual');
  await expect(page.getByTestId('nitro-prev-2')).toContainText('Estágio 2');
  await page.getByTestId('nitro-flow1').fill('0.5');
  await expect(page.getByTestId('nitro-flow1-out')).toHaveText('50 %');
  await page.getByTestId('dyno-apply').click();
  await expect.poll(() => mode<{ nitrousMode?: string; nitrousFlow1?: number }>(page, 'm.controller.activeCar.tune')).toMatchObject({ nitrousMode: 'dual', nitrousFlow1: 0.5 });
});
