/**
 * Blown engine in a career race: the HUD effort gauge rises, the engine breaks (BROKEN, no
 * restart), the result screen shows MOTOR QUEBRADO / DNF and "Tentar novamente" starts a fresh
 * race with a healthy engine. The failure spec is shortened through the debug handle so the test
 * runs in seconds; the path from the failure to the result is the real one.
 */
import { expect, test } from '@playwright/test';
import { boot, errors, mode } from './helpers';

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('motor quebrado: esforço no HUD, DNF e nova tentativa restaurada', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await mode(page, 'm.ready');
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  const credits = await mode<number>(page, 'm.controller.save.credits');
  await mode(page, `m.show('events')`);
  await page.getByTestId('event-e1-primeira-noite').click();
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
  await page.getByTestId('rival-start').click();
  await expect.poll(() => mode<string>(page, 'm.screen')).toBe('race');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.engine.runState'), { timeout: 15_000 }).toBe('RUNNING');
  // weak engine: exposure from 2500 rpm, 1.5 s at the limit; rev it in neutral at the line
  await mode(page, `m.runner.player.sim.enableEngineFailure({ recommendedSafeRpm: 2500, maxSafeRpm: 4500, enduranceS: 1.5, recoveryPerS: 0 })`);
  await page.keyboard.down('ArrowUp');
  await expect(page.getByTestId('hud-strain')).not.toHaveAttribute('data-level', 'normal', { timeout: 15_000 });
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.engine.runState'), { timeout: 30_000 }).toBe('BROKEN');
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(1500);
  expect(await mode<string>(page, 'm.runner.player.sim.engine.runState')).toBe('BROKEN');
  await expect.poll(() => mode<string>(page, 'm.screen'), { timeout: 120_000 }).toBe('result');
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
  await expect(page.getByTestId('blown-engine')).toBeVisible();
  await expect(page.getByTestId('blown-engine')).toContainText('MOTOR QUEBRADO');
  expect(await mode<string>(page, 'm.lastRecord.result.outcome')).toBe('dnf');
  expect(await mode<string>(page, 'm.lastRecord.result.playerResult.dnfReason')).toBe('engine-blown');
  expect(await mode<number>(page, 'm.controller.save.results.length')).toBe(1);
  expect(await mode<number>(page, 'm.controller.save.credits')).toBe(credits);
  await page.getByTestId('result-retry').click();
  await expect.poll(() => mode<string>(page, 'm.screen')).toBe('race');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.engine.runState'), { timeout: 15_000 }).toBe('RUNNING');
});
