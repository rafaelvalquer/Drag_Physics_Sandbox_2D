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
  await page.keyboard.up('ShiftLeft'); // releasing does not cancel
  await page.waitForTimeout(300);
  expect(await mode<string>(page, 'm.runner.player.sim.nitrous.status')).toBe('STAGE_1_ACTIVE');

  // stage 1 runs out by itself; stage 2 waits for a new press
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.nitrous.status'), { timeout: 30_000 }).toBe('STAGE_2_READY');
  await expect(page.getByTestId('hud-nitrous-state')).toContainText('ESTÁGIO 2');
  await page.keyboard.press('ShiftLeft');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.nitrous.status')).toBe('STAGE_2_ACTIVE');

  // a restart: full cylinder
  await mode(page, 'm.restart()');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.nitrous.remainingFraction')).toBe(1);
  expect(await mode<string>(page, 'm.runner.player.sim.nitrous.status')).toBe('READY');
});
