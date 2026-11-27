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
  await expect(page.getByTestId('ws-buy')).toBeDisabled();
  await page.getByTestId('ws-details-toggle').click();
  await expect(page.getByTestId('ws-detail')).toContainText('Kit turbo básico');
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

test('oficina: remap aspirado com conversão turbo mostra o Mapa turbo equivalente e instala o pacote', async ({ page }) => {
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
  // an in-memory Civic Si with the Stage 1 turbo conversion (the unlocks are the player's progress, not tested here)
  await mode(
    page,
    `(() => { const s = m.controller.save; const c = s.ownedCars[0]; c.baseCarId = 'honda-civic-si-2008'; c.buildVersion = 2; c.installedParts = ['conversion-turbo-honda-k20-s1','conversion-compression-honda-k20','conversion-oil-honda-k20','fuel-honda-k20-s1','ignition-honda-k20-s1','rotating-assembly-honda-k20-s1','clutch-honda-k20-s3']; s.credits = 500000; })()`,
  );
  await mode(page, `(m.workshopState.patch({ selected: 'ecu-map-honda-k20-s2', tab: 'electronics' }), m.show('workshop'))`);
  await expect(page.getByTestId('ws-install-bundle')).toBeVisible();
  await page.getByTestId('ws-details-toggle').click();
  await expect(page.getByTestId('ws-detail')).toContainText('Remap');
  await expect(page.getByTestId('ws-req-list')).toBeVisible();
  await expect(page.getByTestId('ws-req-substitute')).toBeVisible();
  await expect(page.getByTestId('ws-req-ecu-conversion-honda-k20-s2')).toBeVisible();
  // the red "incompatible" line is replaced by the explanation
  await expect(page.getByTestId('ws-incompatible')).toHaveCount(0);
  await page.getByTestId('ws-detail').screenshot({ path: `${process.env.VISUAL_DIR ?? 'visual-captures'}/workshop-ecu-requirements.png` });
});
