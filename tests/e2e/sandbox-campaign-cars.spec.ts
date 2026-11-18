import { expect, test } from '@playwright/test';
import { boot, debug, errors, mode, waitEngineRunning } from './helpers';

const ids = [
  'fiat-uno-mille-1995', 'gm-celta-2003', 'gm-chevette-sl-1988',
  'gm-corsa-gl-1996', 'gm-kadett-sl-1992', 'vw-saveiro-gl-1994',
];

test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));

test('main Sandbox vehicle selector lists all factory and prepared cars', async ({ page }) => {
  await boot(page);
  const select = page.getByTestId('car-select');
  await expect(select.locator('optgroup')).toHaveCount(6); // classic, Chapter 2, Chapter 3, fictional, experimental, prepared
  await expect(select.locator('option')).toHaveCount(40);
  await expect(page.getByTestId('sandbox-catalog-count')).toContainText('32 carros originais + 8 preparações');

  // Factory cars are selectable directly, without career unlocks (Chapter 2 cars included).
  for (const id of [...ids, 'mitsubishi-evo-x-2012', 'bmw-335i-f30-2013', 'nissan-gtr-r35-2015', 'alfa-giulia-qv-2017']) {
    await expect(select.locator('option[value="' + id + '"]')).toHaveCount(1);
    await select.selectOption(id);
    await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.id')).toBe(id);
  }

  // The same primary selector exposes ready-to-drive turbo recipes.
  const marcos = 'vw-saveiro-marcos-turbo-sandbox';
  await expect(select.locator('option[value="' + marcos + '"]')).toHaveCount(1);
  await select.selectOption(marcos);
  await expect(select).toHaveValue(marcos);
  await expect(page.getByTestId('prepared-select')).toHaveValue(marcos);
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.engine.induction')).toBe('turbo');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.id')).toBe('vw-saveiro-gl-1994');

  await select.selectOption('vw-saveiro-gl-1994');
  await expect(page.getByTestId('prepared-select')).toHaveValue('');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.engine.induction')).toBe('NA');
});



test('six Brazilian factory cars, garage art and original restoration', async ({ page }) => {
  await boot(page);
  for (const id of ids) {
    await page.getByTestId('car-select').selectOption(id);
    await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.id')).toBe(id);
    await waitEngineRunning(page);
    expect(await mode<string>(page, 'm.runner.player.sim.car.visual.bodyStyle')).toBeTruthy();
    await page.getByTestId('editor-defaults').click();
    await expect(page.getByTestId('car-select')).toHaveValue(id);
  }
  await page.getByTestId('garage-open').click();
  for (const id of ids) await expect(page.getByTestId('garage-car-' + id)).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('brasileiros-garagem.png'), fullPage: true });
});

test('Marcos turbo is a separate free preset with correct boost and a factory reset', async ({ page }) => {
  await boot(page);
  await page.getByTestId('prepared-select').selectOption('vw-saveiro-marcos-turbo-sandbox');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.engine.induction')).toBe('turbo');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.id')).toBe('vw-saveiro-gl-1994');
  await expect(page.getByTestId('car-select')).toHaveValue('vw-saveiro-marcos-turbo-sandbox');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.car.acoustic.turboGain')).toBeGreaterThan(0);
  await expect.poll(async () => (await debug(page)).liveVoices).toBe(1);
  await expect(page.getByTestId('turbo-gauge')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('marcos-turbo-sandbox.png'), fullPage: true });
  await page.getByTestId('editor-defaults').click();
  await page.getByTestId('editor-apply').click();
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.engine.induction')).toBe('NA');
  await expect(page.getByTestId('turbo-gauge')).toBeHidden();
  await page.getByTestId('prepared-select').selectOption('vw-saveiro-marcos-turbo-sandbox');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.engine.induction')).toBe('turbo');
  await page.getByTestId('car-select').selectOption('gm-celta-2003');
  await expect(page.getByTestId('prepared-select')).toHaveValue('');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.engine.induction')).toBe('NA');
  await expect(page.getByTestId('turbo-gauge')).toBeHidden();
});
