import { expect, test } from '@playwright/test';
import { boot, errors, mode } from './helpers';

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('sandbox: Shift injeta enquanto pressionado, pausa preserva a carga, reinício recarrega', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.getByTestId('car-select').selectOption('gm-chevette-nitro-wet-sandbox');
  await expect.poll(() => mode<string | null>(page, 'm.runner.player.sim.nitrous?.status ?? null')).toBe('READY');
  await expect(page.getByTestId('hud-nitrous')).toBeVisible();
  await expect(page.getByTestId('hud-nitrous-state')).toContainText('PRONTO');

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
  const tank = () => mode<number>(page, 'm.runner.player.sim.nitrous.remainingFraction');
  const status = () => mode<string>(page, 'm.runner.player.sim.nitrous.status');
  await page.keyboard.down('ShiftLeft');
  await expect.poll(status).toBe('INJECTING');
  await expect(page.getByTestId('hud-nitrous-edge')).toHaveAttribute('data-active', '1');
  await page.keyboard.up('ShiftLeft');
  await expect.poll(status).toBe('READY');
  await expect(page.getByTestId('hud-nitrous-edge')).toHaveAttribute('data-active', '0');
  const left = await tank();
  expect(left).toBeLessThan(1);
  await page.keyboard.press('c');
  expect(await tank()).toBe(left);
  await page.keyboard.down('ShiftLeft');
  await expect.poll(tank).toBeLessThan(left);
  await page.keyboard.press('p');
  await expect.poll(status).toBe('READY');
  const paused = await tank();
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.press('p');
  await expect.poll(() => mode<boolean>(page, 'm.runner.player.sim.nitrousHeld')).toBe(false);
  expect(await tank()).toBe(paused);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('w');
  await mode(page, 'm.restart()');
  await expect.poll(tank).toBe(1);
  await expect.poll(status).toBe('READY');

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
  await expect(page.getByTestId('nitro-flow')).toHaveCount(0);
  await page.getByTestId('nitro-open-dyno').click();

  // the Dyno Lab: Nitro tab, flow slider writes the draft, Apply saves it
  await page.getByTestId('dyno-tab-nitro').click();
  await expect(page.getByTestId('nitro-panel')).toBeVisible();
  await expect(page.getByTestId('nitro-preview')).toContainText('Autonomia contínua');
  await page.getByTestId('nitro-flow').fill('0.5');
  await expect(page.getByTestId('nitro-flow-out')).toHaveText('50 %');
  await page.getByTestId('dyno-apply').click();
  await expect.poll(() => mode<{ nitrousFlow?: number }>(page, 'm.controller.activeCar.tune')).toMatchObject({ nitrousFlow: 0.5 });
});
