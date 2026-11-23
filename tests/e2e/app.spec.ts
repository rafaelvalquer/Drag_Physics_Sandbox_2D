/**
 * End-to-end: the real application in Microsoft Edge. Physics, audio worklet and UI are checked
 * through the DOM and the read-only `window.__app` debug view – nothing is mocked.
 */
import { expect, test } from '@playwright/test';
import { boot, errors, mode, type DebugState } from './helpers';

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('boots, unlocks audio and streams physics frames to the AudioWorklet', async ({ page }) => {
  await boot(page);
  const dbg = await page.evaluate(() => (window as unknown as { __app: { debug: DebugState } }).__app.debug);
  expect(dbg.mode).toBe('sandbox');
  expect([44100, 48000, 88200, 96000]).toContain(dbg.sampleRate);
  await expect(page.getByTestId('audio-state')).toContainText('Hz');
  // the engine starts by itself on the track and the worklet receives ~120 frames per second
  await page.waitForFunction(() => {
    const m = (window as unknown as { __app: { debug: { current: { runner: { player: { sim: { engine: { runState: string } }; sound: { lastStats: { receivedFrames: number } | null } } } } } } }).__app.debug.current;
    return m.runner.player.sim.engine.runState === 'RUNNING' && (m.runner.player.sound?.lastStats?.receivedFrames ?? 0) > 200;
  });
  const s0 = await mode<{ f: number; r: number }>(page, '({ f: m.runner.player.sound.lastStats.receivedFrames, r: m.runner.player.sound.lastStats.renderedS })');
  await page.waitForTimeout(3000);
  const st = await mode<{ receivedFrames: number; renderedS: number; nanResets: number; rejectedFrames: number; peak: number[]; playbackRate: number }>(page, 'm.runner.player.sound.lastStats');
  const fps = (st.receivedFrames - s0.f) / (st.renderedS - s0.r);
  expect(fps).toBeGreaterThan(110);
  expect(fps).toBeLessThan(130);
  expect(st.nanResets).toBe(0);
  expect(st.rejectedFrames).toBe(0);
  expect(st.peak[2]).toBeGreaterThan(1e-4); // exhaust channel is producing sound at idle
  expect(Math.max(...st.peak)).toBeLessThanOrEqual(1);
  expect(st.playbackRate).toBeGreaterThanOrEqual(0.98);
  expect(st.playbackRate).toBeLessThanOrEqual(1.02);
  // the master analyser sees a non-silent signal
  const rms = await page.evaluate(() => {
    const an = (window as unknown as { __app: { debug: { current: { ctx: { audio: { analyser: AnalyserNode } } } } } }).__app.debug.current.ctx.audio.analyser;
    const b = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(b);
    return Math.sqrt(b.reduce((a, v) => a + v * v, 0) / b.length);
  });
  expect(rms).toBeGreaterThan(1e-4);
});

test('drives with W/E/Q only: no clutch key, no brake key', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => (window as unknown as { __app: { debug: { current: { runner: { player: { sim: { engine: { runState: string } } } } } } } }).__app.debug.current.runner.player.sim.engine.runState === 'RUNNING');
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  // keys that would be clutch/brake in other games do nothing
  for (const k of ['s', 'ArrowDown', 'Space', 'Shift', 'Control', 'c']) {
    await page.keyboard.down(k);
    await page.waitForTimeout(60);
    await page.keyboard.up(k);
  }
  expect(await mode<number>(page, 'm.runner.player.sim.controls.pedal')).toBe(0);
  expect(await mode<number>(page, 'm.runner.player.sim.gear')).toBe(0);
  await page.keyboard.press('e');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear')).toBe(1);
  await page.keyboard.down('w');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.speed'), { timeout: 10_000 }).toBeGreaterThan(8);
  expect(await mode<string>(page, 'm.runner.player.sim.clutchCtl.mode')).not.toBe('OPEN');
  // upshift while accelerating
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.clutchCtl.mode'), { timeout: 10_000 }).toBe('LOCKED');
  await page.keyboard.press('e');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear')).toBe(2);
  await expect(page.locator('[data-testid=hud-gear] .num')).toHaveText('2');
  await page.keyboard.up('w');
  // R restarts the simulation
  await page.keyboard.press('r');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.speed')).toBeLessThan(0.1);
  expect(await mode<number>(page, 'm.runner.player.sim.gear')).toBe(0);
});

test('drag race against the AI: tree, results, record persisted in IndexedDB', async ({ page }) => {
  await boot(page);
  await page.locator('#topbar button[data-mode=race]').click();
  await page.getByTestId('race-distance').selectOption('eighth');
  await expect(page.getByTestId('race-status')).toContainText('Pronto para largar');
  await page.waitForFunction(() => (window as unknown as { __app: { debug: { current: { runner: { player: { sim: { engine: { runState: string } } } } } } } }).__app.debug.current.runner.player.sim.engine.runState === 'RUNNING');
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('e');
  // wait for the green light, then launch
  await page.waitForFunction(() => {
    const r = (window as unknown as { __app: { debug: { current: { race: { greenAt: number | null; time: number } } } } }).__app.debug.current.race;
    return r.greenAt !== null && r.time >= r.greenAt;
  }, undefined, { timeout: 20_000 });
  await page.keyboard.down('w');
  // shift up near the redline until the finish
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const s = await mode<{ phase: string; gear: number; rpm: number; red: number; locked: boolean; n: number }>(
      page,
      '({ phase: m.race.phase, gear: m.runner.player.sim.gear, rpm: m.runner.player.sim.engine.rpm, red: m.runner.player.sim.car.engine.redlineRpm, locked: m.runner.player.sim.clutchCtl.mode === "LOCKED", n: m.runner.player.sim.gearbox.gearCount })',
    );
    if (s.phase === 'finished') break;
    if (s.locked && s.gear < s.n && s.rpm > s.red - 400) await page.keyboard.press('e');
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('w');
  await expect(page.getByTestId('result-card')).toBeVisible();
  const res = await mode<{ et: number; rt: number; splits: Record<string, number>; trapMs: number }[]>(page, 'm.race.results');
  expect(res[0]!.et).toBeGreaterThan(5);
  expect(res[0]!.splits['60ft']).toBeGreaterThan(1);
  expect(res[0]!.trapMs).toBeGreaterThan(20);
  expect(res[1]!.et).toBeGreaterThan(5);
  await expect(page.getByTestId('result-card')).toContainText('60 ft');
  await expect(page.getByTestId('result-card')).toContainText('Marchas usadas');
  const extra = await mode<{ gears: number[]; maxRpm: number; slipM: number }>(page, '({ gears: m.race.results[0].gearsUsed, maxRpm: m.race.results[0].maxRpm, slipM: m.race.results[0].slipM })');
  expect(extra.gears.length).toBeGreaterThanOrEqual(2);
  expect(extra.gears[0]).toBe(1);
  expect(extra.maxRpm).toBeGreaterThan(3000);
  expect(extra.slipM).toBeGreaterThanOrEqual(0);
  // the car brakes by itself after the finish
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.speed'), { timeout: 30_000 }).toBeLessThan(0.5);
  // run + record stored in IndexedDB and still there after a reload
  await expect(page.getByTestId('records')).toContainText('1 corrida');
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __app?: { debug: { current: unknown } } }).__app?.debug.current);
  await page.locator('#topbar button[data-mode=race]').click();
  await page.getByTestId('race-distance').selectOption('eighth');
  await expect(page.getByTestId('records')).toContainText('1 corrida');
});

test('sandbox editor validates input in Portuguese and applies a valid change', async ({ page }) => {
  await boot(page, false);
  await page.locator('.car-editor .tabs button[data-group=transmission]').click();
  const fd = page.locator('[data-path="transmission.finalDrive"]');
  await fd.fill('9');
  await expect(page.getByTestId('editor-errors')).toContainText('Diferencial');
  await expect(page.getByTestId('editor-apply')).toBeDisabled();
  await fd.fill('3.90');
  await expect(page.getByTestId('editor-apply')).toBeEnabled();
  await page.getByTestId('editor-apply').click();
  expect(await mode<number>(page, 'm.runner.player.sim.car.transmission.finalDrive')).toBe(3.9);
});

test('dyno measures the full-load curve and exports CSV', async ({ page }) => {
  await boot(page);
  await page.locator('#topbar button[data-mode=dyno]').click();
  await page.getByTestId('dyno-sweep').click();
  await expect(page.getByTestId('dyno-status')).toContainText('Torque máx.', { timeout: 30_000 });
  const pts = await mode<number>(page, 'm.points.length');
  expect(pts).toBeGreaterThan(10);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
  const path = await dl.path();
  const fs = await import('node:fs');
  const csv = fs.readFileSync(path, 'utf8');
  expect(csv).toContain('rpm,torque_Nm');
  expect(csv.trim().split('\n').filter((l) => !l.startsWith('#')).length).toBe(pts + 1);
  // live bench with sound: the spectrum has energy
  await page.getByTestId('dyno-throttle').fill('0.6');
  await page.waitForTimeout(1500);
  const live = await mode<{ rpm: number; frames: number }>(page, '({ rpm: m.bench.engine.rpm, frames: m.sound.lastStats ? m.sound.lastStats.receivedFrames : 0 })');
  expect(live.rpm).toBeGreaterThan(2500);
  expect(live.frames).toBeGreaterThan(50);
});
