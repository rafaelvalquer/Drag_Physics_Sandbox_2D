import { expect, type Page } from '@playwright/test';

export interface DebugState {
  mode: string | null;
  audio: string;
  sampleRate: number;
  liveVoices: number;
}

/** Page errors and console errors collected during a test (asserted empty in afterEach). */
export const errors: string[] = [];

export async function boot(page: Page, withAudio = true): Promise<void> {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto('/');
  await expect(page.getByTestId('audio-gate')).toBeVisible();
  await waitForApp(page);
  if (withAudio) {
    await page.getByRole('button', { name: 'Ativar som e começar' }).click();
    await expect(page.getByTestId('audio-gate')).toHaveCount(0);
    await page.waitForFunction(() => (window as unknown as { __app: { debug: DebugState } }).__app.debug.audio === 'running');
  }
}

export async function waitForApp(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as { __app?: { debug: { current: unknown } } }).__app?.debug.current);
}

/** Evaluates an expression against the active mode (`m`). */
export function mode<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const m = window.__app.debug.current; return (${fn}); })()`) as Promise<T>;
}

export function debug(page: Page): Promise<DebugState> {
  return page.evaluate(() => {
    const d = (window as unknown as { __app: { debug: DebugState } }).__app.debug;
    return { mode: d.mode, audio: d.audio, sampleRate: d.sampleRate, liveVoices: d.liveVoices };
  });
}

export async function waitEngineRunning(page: Page): Promise<void> {
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.engine.runState'), { timeout: 15_000 }).toBe('RUNNING');
}
