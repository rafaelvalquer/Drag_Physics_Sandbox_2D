/**
 * Dyno Lab 3.0 in the real app: editing a setting never rebuilds the screen, the draft (B) is
 * measured against the saved build (A), Discard returns to A and Apply writes the save once.
 */
import { expect, test } from '@playwright/test';
import { boot, errors, mode } from './helpers';

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Dyno Lab 3.0: rascunho, comparação A/B, descartar e aplicar', async ({ page }) => {
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
  // chapter 1 progress unlocks the parts (results through the controller)
  const run = "{ name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false }";
  for (const id of ['e1-primeira-noite', 'e2-pequeno-valente', 'e3-acerto-de-contas', 'e4-tracao-traseira', 'e5-respeita-o-ap', 'e6-o-aspirado'])
    await mode(page, `m.controller.recordRace({ attemptId: '${id}-e2e', eventId: '${id}', playerCarId: m.controller.activeCar.id, opponentCarId: 'r', playerResult: ${run}, opponentResult: ${run}, outcome: 'win', completedAt: new Date().toISOString(), buildVersion: 1, playerBuildKey: 'k', opponentBuildKey: 'k' })`);
  // tyres + differential give two settings on chapter 1 hardware
  await mode(page, `m.controller.commit((s) => void (s.credits = 99999))`);
  for (const p of ['tires-sport', 'differential-short']) {
    const ok = await mode<boolean>(page, `m.controller.buyPart('${p}').then((r) => r.ok || r.error)`);
    expect(ok, String(ok)).toBe(true);
  }
  await mode(page, `m.show('dyno')`);
  const info = page.getByTestId('career-dyno-info');
  await expect(info).toHaveAttribute('data-done', '1', { timeout: 60_000 });
  // locked control explains why (NA engine)
  await expect(page.getByTestId('dyno-reason-boostBar')).toContainText('Exige kit turbo compatível.');
  const root = await page.getByTestId('career-dyno-chart').elementHandle();
  await page.getByTestId('dyno-tab-transmissao').click();
  await page.getByTestId('dyno-ctl-finalDrive-short').click();
  await expect(page.getByTestId('dyno-dirty')).toContainText('não salvo');
  await expect(info).toHaveAttribute('data-done', '1', { timeout: 60_000 });
  await expect(page.getByTestId('dyno-metric-t402-delta')).toBeVisible();
  // the screen was not rebuilt
  expect(await root!.evaluate((el) => el.isConnected)).toBe(true);
  expect(await mode<unknown>(page, 'm.controller.activeCar.tune?.finalDrive ?? null')).toBeNull();
  // discard → A again
  await page.getByTestId('dyno-discard').click();
  await expect(page.getByTestId('dyno-dirty')).toContainText('Sem alterações');
  // apply
  await page.getByTestId('dyno-ctl-finalDrive-short').click();
  await page.getByTestId('dyno-apply').click();
  await expect.poll(() => mode<unknown>(page, 'm.controller.activeCar.tune')).toEqual({ finalDrive: 'short' });
  await expect(page.getByTestId('dyno-dirty')).toContainText('Sem alterações');
  await expect(page.getByTestId('dyno-reliability')).toHaveAttribute('data-level', 'safe');
});
