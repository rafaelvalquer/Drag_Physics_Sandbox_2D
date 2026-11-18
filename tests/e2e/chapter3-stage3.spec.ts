/** Oficina Stage 3 in the real app: project presets, school switch, limitations panel, A/B and aesthetics. */
import { expect, test } from '@playwright/test';
import { boot, errors, mode } from './helpers';

const DONE = [
  'e1-primeira-noite', 'e2-pequeno-valente', 'e3-acerto-de-contas', 'e4-tracao-traseira', 'e5-respeita-o-ap', 'e6-o-aspirado', 'e7-rei-da-madrugada',
  'c2e1-portas-abertas', 'c2e2-turbo-frances', 'c2e3-lenda-do-gti', 'c2e4-quatro-argolas', 'c2e5-precisao-alema', 'c2e6-tracao-traseira', 'c2e7-vtec', 'c2e8-troca-perfeita', 'c2e9-tracao-total', 'c2e10-dono-da-liga',
  'c3e1-a-volta-do-gti', 'c3e2-primeira-elite', 'c3e3-silencio-refinado', 'c3e4-zeta-de-verdade', 'c3e5-peso-pesado', 'c3e6-salao-italiano', 'c3e7-biturbo-alemao', 'c3e8-a-volta-da-evo',
];

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('oficina Stage 3: projeto aspirado, troca para turbo, estética e Dyno', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await page.waitForFunction(() => (window as unknown as { __app: { debug: { current: { id: string } } } }).__app.debug.current.id === 'career');
  await mode(page, 'm.ready');
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  await mode(page, `m.controller.commit((s) => {
    s.credits = 900000; s.reputation = 1400;
    s.completedEventIds = ${JSON.stringify(DONE)};
    s.unlockedChapters = ['chapter-1', 'chapter-2', 'chapter-3'];
    s.ownedCars.push({ id: 'car-z', baseCarId: 'nissan-370z-2014', nickname: '370Z', paint: { color: '#d97a1a', accent: '#16181b' }, installedParts: [], buildVersion: 2, purchasePrice: 0, acquiredAt: s.createdAt });
    s.activeCarId = 'car-z';
  }).then(() => true)`);
  await mode(page, `m.show('workshop')`);
  await expect(page.getByTestId('career-workshop')).toBeVisible();
  await expect(page.getByTestId('ws-projects')).toBeVisible();
  await expect(page.getByTestId('ws-aesthetics')).toBeVisible();

  // aspirated project, bought in one transaction
  await page.getByTestId('ws-preset-buy-na-high-rpm').click();
  await expect.poll(() => mode<string[]>(page, 'm.controller.activeCar.installedParts')).toContain('manifold-v6-sport');
  expect(await mode<string>(page, `m.controller.activeCar.baseCarId`)).toBe('nissan-370z-2014');

  // school switch: turbo kit in, the aspirated manifold goes to stock, nothing is lost
  await page.getByTestId('ws-preset-buy-turbo-street').click();
  await expect.poll(() => mode<string[]>(page, 'm.controller.activeCar.installedParts')).toContain('turbo-vq37-street');
  expect(await mode<string[]>(page, 'm.controller.save.inventoryPartIds')).toContain('manifold-v6-sport@nissan-370z-2014');

  // aesthetics never touch the physics
  const hp = await mode<number>(page, `m.controller.activeCar.installedParts.length`);
  await mode(page, `m.controller.setAccent('#ff0000').then(() => true)`);
  expect(await mode<string>(page, 'm.controller.activeCar.paint.accent')).toBe('#ff0000');
  expect(await mode<number>(page, `m.controller.activeCar.installedParts.length`)).toBe(hp);

  // dyno: measured limitations and the A/B comparison
  await mode(page, `m.show('dyno')`);
  await expect(page.getByTestId('dyno-limitations')).toBeVisible();
  await page.getByTestId('dyno-ab-run').click();
  await expect(page.getByTestId('dyno-ab').locator('table')).toBeVisible({ timeout: 120_000 });
});
