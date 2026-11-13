/**
 * End-to-end feature checks: car selection, engine on/off, pause/blur/restart, presets across a
 * reload, track conditions, on-screen buttons, settings persistence, the editor's live tab, the
 * Developer Lab and audio-voice leaks across mode switches. Real app, real browser, no mocks.
 */
import { expect, test } from '@playwright/test';
import { boot, debug, errors, mode, waitEngineRunning, waitForApp } from './helpers';

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('car selection, engine off/on, pause, focus loss and restart', async ({ page }) => {
  await boot(page);
  await waitEngineRunning(page);
  await page.getByTestId('car-select').selectOption('arco-1600');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.id')).toBe('arco-1600');
  await waitEngineRunning(page);

  // engine off and on again (automatic start)
  await page.getByTestId('engine-toggle').click();
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.engine.runState')).toBe('OFF');
  await expect(page.getByTestId('engine-toggle')).toHaveText('Ligar motor');
  await page.getByTestId('engine-toggle').click();
  await waitEngineRunning(page);

  // pause freezes the simulation clock, P again resumes
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('p');
  const t0 = await mode<number>(page, 'm.runner.simTime');
  await page.waitForTimeout(500);
  expect(await mode<number>(page, 'm.runner.simTime')).toBe(t0);
  await page.keyboard.press('p');
  await expect.poll(() => mode<number>(page, 'm.runner.simTime')).toBeGreaterThan(t0 + 0.1);

  // losing focus releases the throttle even while the key is still physically down
  await page.keyboard.press('e');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear')).toBe(1);
  await page.keyboard.down('w');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.speed'), { timeout: 10_000 }).toBeGreaterThan(2);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.controls.pedal')).toBe(0);
  await page.keyboard.up('w');

  // restart puts the car back on the line at rest
  await page.getByTestId('restart').click();
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.speed')).toBeLessThan(0.1);
  expect(Math.abs(await mode<number>(page, 'm.runner.player.sim.x'))).toBeLessThan(0.05);

  // optional performance log (measured in this browser, attached to the report)
  const perf = await mode<{ stepMs: number; steps: number; dropped: number }>(page, '({ stepMs: m.runner.stats.stepMs, steps: m.runner.stats.steps, dropped: m.runner.stats.droppedRealTimeS })');
  test.info().annotations.push({ type: 'perf', description: `physics ${perf.stepMs.toFixed(3)} ms/step over ${perf.steps} steps; dropped real time ${perf.dropped.toFixed(3)} s` });
  expect(perf.stepMs).toBeLessThan(2);
});

test('presets: save, survive a reload, load back', async ({ page }) => {
  await boot(page, false);
  await page.locator('.car-editor .tabs button[data-group=transmission]').click();
  await page.locator('[data-path="transmission.finalDrive"]').fill('3.41');
  await page.getByTestId('preset-name').fill('Preset E2E');
  await page.getByTestId('preset-save').click();
  await expect(page.getByTestId('preset-row').filter({ hasText: 'Preset E2E' })).toHaveCount(1);
  await page.reload();
  await waitForApp(page);
  const row = page.getByTestId('preset-row').filter({ hasText: 'Preset E2E' });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Carregar' }).click();
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.name')).toBe('Preset E2E');
  expect(await mode<number>(page, 'm.runner.player.sim.car.transmission.finalDrive')).toBe(3.41);
  // duplicate creates a second preset
  await page.getByTestId('editor-duplicate').click();
  await expect(page.getByTestId('preset-row').filter({ hasText: 'Preset E2E (cópia)' })).toHaveCount(1);
});

test('no audio voices leak across mode and car switches', async ({ page }) => {
  await boot(page);
  await waitEngineRunning(page);
  expect((await debug(page)).liveVoices).toBe(1);
  for (let i = 0; i < 3; i++) {
    await page.locator('#topbar button[data-mode=race]').click();
    await expect.poll(async () => (await debug(page)).liveVoices).toBe(2);
    await page.getByTestId('race-opponent').selectOption({ index: (i % 3) + 1 });
    await page.locator('#topbar button[data-mode=dyno]').click();
    await expect.poll(async () => (await debug(page)).liveVoices).toBe(1);
    await page.locator('#topbar button[data-mode=sandbox]').click();
    await page.getByTestId('car-select').selectOption({ index: i + 1 });
    await page.getByTestId('compare-select').selectOption({ index: 1 });
    await expect.poll(async () => (await debug(page)).liveVoices).toBe(2);
    await page.getByTestId('compare-select').selectOption({ index: 0 });
    await expect.poll(async () => (await debug(page)).liveVoices).toBe(1);
  }
});

test('track conditions, on-screen buttons, HUD run info and persistent settings', async ({ page }) => {
  await boot(page);
  await waitEngineRunning(page);
  // settings: on-screen buttons always on, closer camera
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.getByTestId('touch-setting').selectOption('on');
  await page.getByTestId('cameraZoom').fill('1.4');
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByTestId('touch-controls')).toBeVisible();

  // track conditions: invalid value rejected in Portuguese, valid value applied live
  await page.locator('details.fold > summary').click();
  const grip = page.locator('[data-track=surfaceGrip]');
  await grip.fill('3');
  await grip.dispatchEvent('change');
  await expect(page.getByTestId('track-errors')).toContainText('Aderência');
  expect(await mode<number>(page, 'm.runner.track.surfaceGrip')).toBe(1);
  await grip.fill('0.6');
  await grip.dispatchEvent('change');
  await expect(page.getByTestId('track-errors')).toHaveText('');
  expect(await mode<number>(page, 'm.runner.player.sim.tire.surfaceGrip')).toBe(0.6);

  // drive with the on-screen buttons only
  await page.getByTestId('touch-upshift').click();
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear')).toBe(1);
  const box = (await page.getByTestId('touch-throttle').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.speed'), { timeout: 10_000 }).toBeGreaterThan(5);
  // low grip: the driven tyres slip (HUD shows it)
  expect(await mode<number>(page, 'm.runner.player.sim.slipIntegral')).toBeGreaterThan(0.1);
  await page.mouse.up();
  await expect(page.getByTestId('hud-time')).toHaveText(/\d+\.\d{3} s/);
  await expect(page.getByTestId('hud-distance')).not.toHaveText('0.0 m');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.controls.pedal')).toBe(0);

  // settings persist across a reload
  await page.reload();
  await waitForApp(page);
  const s = await page.evaluate(() => {
    const st = (window as unknown as { __app: { settings: { cameraZoom: number; touchControls: string } } }).__app.settings;
    return { zoom: st.cameraZoom, touch: st.touchControls };
  });
  expect(s).toEqual({ zoom: 1.4, touch: 'on' });
});

test('editor live tests tab, architecture templates, factory defaults and Developer Lab', async ({ page }) => {
  await boot(page);
  await waitEngineRunning(page);
  // architecture switch keeps the configuration valid and recomputes the displacement
  await page.locator('select[data-path="engine.architecture"]').selectOption('I6');
  await expect(page.getByTestId('editor-errors')).toHaveText('');
  await expect(page.locator('input[data-path="engine.cylinders"]')).toHaveValue('6');
  await expect(page.getByTestId('displacement')).toContainText('cm³');
  await page.getByTestId('editor-defaults').click();
  await expect(page.locator('input[data-path="engine.cylinders"]')).toHaveValue('8');
  await expect(page.getByTestId('editor-apply')).toBeDisabled();

  // live readings of the running car
  await page.locator('.car-editor .tabs button[data-group=tests]').click();
  await expect(page.getByTestId('editor-tests')).toContainText('rpm');
  await expect(page.getByTestId('editor-tests')).toContainText('embreagem');

  // Developer Lab: measured counters and honest audio-load reporting
  await expect(page.getByTestId('devlab-live')).toContainText('rotação do motor');
  await expect(page.getByTestId('devlab-stats')).toContainText('FPS');
  await expect(page.getByTestId('devlab-estimated')).toContainText('não mensurável');
  await page.getByTestId('audio-estimate').click();
  await expect(page.getByTestId('devlab-estimated')).toContainText('% de um núcleo');
  // T hides the lab
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('t');
  await expect(page.getByTestId('devlab')).toHaveClass(/collapsed/);
});
