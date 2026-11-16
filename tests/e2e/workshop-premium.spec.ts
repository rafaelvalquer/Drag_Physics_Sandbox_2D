import { expect, test } from '@playwright/test';
import { boot, errors, mode } from './helpers';

test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));

test('oficina premium: nove sistemas, grupos distintos, estados e adaptação para mobile', async ({ page }) => {
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  for (let i = 0; i < 30 && (await page.getByTestId('dialogue-next').count()); i++)
    await page.getByTestId('dialogue-next').click();

  await mode(page, "m.show('workshop')");
  await expect(page.getByTestId('career-workshop')).toBeVisible();
  await expect(page.getByTestId('ws-overview')).toContainText('POTÊNCIA');
  await expect(page.getByTestId('ws-overview')).toContainText('REPUTAÇÃO');
  for (const name of ['engine', 'intake', 'exhaust', 'transmission', 'tires', 'turbo', 'electronics', 'cooling', 'chassis'])
    await expect(page.getByTestId(`ws-tab-${name}`)).toHaveCount(1);

  await page.getByTestId('ws-tab-intake').click();
  for (const slot of ['intake-filter', 'intake-manifold', 'intake-throttle', 'intake-airbox']) {
    await expect(page.getByTestId(`ws-group-${slot}`)).toBeVisible();
    await expect(page.getByTestId(`ws-stock-${slot}`)).toHaveAttribute('data-state', 'installed');
  }
  await expect(page.locator('.ws-center .ws-group')).toHaveCount(4);
  await expect(page.getByTestId('ws-part-filter-cone')).toHaveAttribute('data-state', 'locked');
  await page.getByTestId('ws-part-throttle-rework').click();
  await expect(page.getByTestId('ws-detail')).toContainText('Borboleta retrabalhada');
  await expect(page.getByTestId('ws-compare')).toContainText('Torque');

  await page.getByTestId('ws-tab-electronics').click();
  await expect(page.locator('.ws-center .ws-group')).toHaveCount(3);
  await page.getByTestId('ws-tab-cooling').click();
  await expect(page.locator('.ws-center .ws-group')).toHaveCount(4);
  await expect(page.getByTestId('ws-group-turbo-intercooler')).toBeVisible();

  await page.setViewportSize({ width: 430, height: 900 });
  await expect(page.getByTestId('ws-tab-chassis')).toBeVisible();
  await expect(page.getByTestId('ws-group-cooling-radiator')).toBeVisible();
  const cols = await page.locator('.ws').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(1);
});
