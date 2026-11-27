import { expect, test } from '@playwright/test';
import { boot, debug, errors, mode, waitEngineRunning } from './helpers';

const ids = [
  'fiat-uno-mille-1995', 'gm-celta-2003', 'gm-chevette-sl-1988',
  'gm-corsa-gl-1996', 'gm-kadett-sl-1992', 'vw-saveiro-gl-1994',
];

test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));

test('Sandbox switches four turbo models and controls each diagnostic without restarting the car', async ({ page }) => {
  await boot(page);
  await page.getByTestId('car-select').selectOption('vw-gol-ap-turbo-sandbox');
  await waitEngineRunning(page);
  const panel = page.getByTestId('turbo-ab');
  await panel.locator('summary').click();
  const select = panel.getByTestId('turbo-model');
  await expect(select.locator('option')).toHaveCount(4);
  await expect(select).toHaveValue('hybrid');
  const mask = panel.locator('[data-turbo-layer="order3"]');
  await select.selectOption('legacy');
  await expect(mask).toBeDisabled();
  for (const model of ['v2', 'reduced', 'hybrid']) {
    await select.selectOption(model);
    await expect(mask).toBeEnabled();
    await expect.poll(() => mode(page, 'm.turboComparison.model')).toBe(model);
  }
  await mask.uncheck();
  await expect(panel.locator('[data-turbo-gain="order3"]')).toHaveValue('0');
  await expect.poll(() => mode(page, 'm.turboComparison.diagnostics.order3')).toBe(0);
  await panel.locator('[data-turbo-layer="resonance-1"]').uncheck();
  await panel.locator('[data-turbo-layer="exhaustPulse"]').uncheck();
  await expect.poll(() => mode(page, 'm.turboComparison.diagnostics.resonances[0]')).toBe(0);
  await expect.poll(() => mode(page, 'm.turboComparison.diagnostics.exhaustPulse')).toBe(0);
  await expect.poll(async () => (await debug(page)).liveVoices).toBe(1);
  await waitEngineRunning(page);
  await expect.poll(() => mode(page, 'm.runner.player.sim.car.engine.induction')).toBe('turbo');

  await page.getByTestId('compare-select').selectOption('nissan-gtr-r35-2015');
  await expect.poll(async () => (await debug(page)).liveVoices).toBe(2);
  await waitEngineRunning(page);
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('e');
  await page.keyboard.down('w');
  try {
    await expect.poll(() => mode(page, `m.runner.vehicles.every((v) =>
      v.sound?.lastStats?.peak[3] > 0 && v.sound.lastStats.nanResets === 0)`), { timeout: 20_000 }).toBe(true);
  } finally {
    await page.keyboard.up('w');
  }
});

test('main Sandbox vehicle selector lists all factory and prepared cars', async ({ page }) => {
  await boot(page);
  const select = page.getByTestId('car-select');
  await expect(select.locator('optgroup')).toHaveCount(6); // classic, Chapter 2, Chapter 3, fictional, experimental, prepared
  await expect(select.locator('option')).toHaveCount(42);
  await expect(page.getByTestId('sandbox-catalog-count')).toContainText('32 carros originais + 10 preparações');

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
