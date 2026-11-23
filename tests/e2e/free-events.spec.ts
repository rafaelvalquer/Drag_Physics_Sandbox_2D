import { expect, test } from '@playwright/test';
import { boot, errors, mode } from './helpers';

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('eventos livres: ofertas, pinturas, rematch e recompensas independentes da história', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  await page.getByTestId('nav-free-events').click();
  await expect(page.getByTestId('career-free-events')).toBeVisible();
  for (const tier of ['bairro', 'preparado', 'elite'])
    await expect(page.getByTestId('free-offer-' + tier)).toBeVisible();

  const before = await mode<{ rotation: number; credits: number; story: string[] }>(page,
    '({ rotation: m.controller.save.freeEventRotation, credits: m.controller.save.credits, story: m.controller.save.completedEventIds })');
  await page.getByTestId('free-refresh').click();
  await expect.poll(() => mode<number>(page, 'm.controller.save.freeEventRotation')).toBe(before.rotation + 1);
  await page.getByTestId('free-pick-bairro').click();
  await expect(page.getByTestId('career-rival')).toBeVisible();
  await expect(page.getByTestId('rival-reward')).toContainText('250 CR');
  await mode(page, '(m.autopilot = true)');
  await page.getByTestId('rival-start').click();
  await expect.poll(() => mode<string>(page, 'm.screen'), { timeout: 120_000 }).toBe('result');
  const after = await mode<{ id: string; credits: number; reward: number; story: string[]; rotation: number }>(page,
    '({ id: m.lastRecord.result.eventId, credits: m.controller.save.credits, reward: m.lastRecord.result.creditsAwarded, story: m.controller.save.completedEventIds, rotation: m.controller.save.freeEventRotation })');
  expect(after.id.startsWith('free-1-')).toBe(true);
  expect(after.credits).toBe(before.credits + after.reward);
  expect([0, 250]).toContain(after.reward);
  expect(after.story).toEqual(before.story);
  expect(after.rotation).toBe(before.rotation + 2);
  await page.getByTestId('result-events').click();
  await expect(page.getByTestId('career-free-events')).toBeVisible();
  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('career-history-screen')).toBeVisible();
  await expect(page.getByTestId('career-history-screen')).toContainText('Evento livre');
});
