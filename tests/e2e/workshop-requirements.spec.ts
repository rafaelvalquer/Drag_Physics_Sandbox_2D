/**
 * Workshop: a part that needs other parts shows what is missing and installs everything at once.
 * Chevette + turbo kit: the kit alone is refused (clutch), the panel lists the clutch, "install with
 * requirements" opens the confirmation and installs both in one purchase charged once.
 */
import { expect, test } from '@playwright/test';
import { boot, errors, mode } from './helpers';

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

const C1 = ['e1-primeira-noite', 'e2-pequeno-valente', 'e3-acerto-de-contas', 'e4-tracao-traseira', 'e5-respeita-o-ap'];
const run = "{ name: 'x', rt: 0.2, et: 12, total: 12.2, trapKmh: 120, redLight: false, finished: true, dnf: false }";

test('oficina: lista o que falta e instala com requisitos de uma vez', async ({ page }) => {
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
  for (const id of C1)
    await mode(
      page,
      `m.controller.recordRace({ attemptId: '${id}-req', eventId: '${id}', playerCarId: m.controller.activeCar.id, opponentCarId: 'r', playerResult: ${run}, opponentResult: ${run}, outcome: 'win', completedAt: new Date().toISOString(), buildVersion: 1, playerBuildKey: 'k', opponentBuildKey: 'k' })`,
    );
  await mode(page, `m.controller.commit((s) => void (s.credits = 20000))`);

  // the turbo kit alone does not fit (clutch): the panel says what is missing
  await mode(page, `(m.workshopState.patch({ selected: 'turbo-basic', tab: 'turbo' }), m.show('workshop'))`);
  await expect(page.getByTestId('ws-detail')).toContainText('Kit turbo básico');
  await expect(page.getByTestId('ws-buy')).toBeDisabled();
  await expect(page.getByTestId('ws-req-list')).toBeVisible();
  await expect(page.getByTestId('ws-req-clutch-reinforced')).toBeVisible();
  const credits = await mode<number>(page, 'm.controller.save.credits');

  // "Ver peça" goes to the clutch (another system tab)
  await page.getByTestId('ws-req-go-clutch-reinforced').click();
  await expect(page.getByTestId('ws-detail')).toContainText('Embreagem reforçada');
  await mode(page, `(m.workshopState.patch({ selected: 'turbo-basic', tab: 'turbo' }), m.show('workshop'))`);

  // install with requirements: confirmation, one purchase
  await page.getByTestId('ws-install-bundle').click();
  await expect(page.getByTestId('ws-bundle-modal')).toBeVisible();
  await page.getByTestId('ws-bundle-cancel').click();
  await expect(page.getByTestId('ws-bundle-modal')).toHaveCount(0);
  expect(await mode<string[]>(page, 'm.controller.activeCar.installedParts')).not.toContain('turbo-basic');
  await page.getByTestId('ws-install-bundle').click();
  await page.getByTestId('ws-bundle-confirm').click();
  await expect.poll(() => mode<string[]>(page, 'm.controller.activeCar.installedParts')).toEqual(expect.arrayContaining(['turbo-basic', 'clutch-reinforced']));
  const spent = credits - (await mode<number>(page, 'm.controller.save.credits'));
  expect(spent).toBe(4000 + 900);
  await expect(page.getByTestId('ws-req-list')).toHaveCount(0);
});
