import { expect, test } from '@playwright/test';

test('o modo online pode ser aberto e a campanha continua acessível', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Online', exact: true }).click();
  await expect(page.getByTestId('online-screen').getByRole('heading', { name: 'Online', exact: true })).toBeVisible();
  await expect(page.getByText(/Continuar com Google|O modo online ainda não foi configurado/)).toBeVisible();
  await page.getByRole('button', { name: 'Campanha', exact: true }).click();
  await expect(page.getByTestId('online-screen')).toHaveCount(0);
  await expect(page.locator('.career[data-screen]')).toBeVisible();
});
