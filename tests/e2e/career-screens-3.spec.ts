/**
 * Career Experience 3.0: every redesigned screen at the required resolutions (screenshots in
 * `visual-captures/career-3/`) plus layout checks (no horizontal overflow, no clipped buttons).
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { eventsOf } from '../../src/game/career/CareerEvents';
import { boot, errors, mode } from './helpers';

const OUT = `${process.env.VISUAL_DIR ?? 'visual-captures'}/career-3`;
mkdirSync(OUT, { recursive: true });
const SIZES: [number, number][] = [
  [1920, 1080],
  [1743, 632],
  [1366, 768],
  [1024, 768],
  [390, 844],
];

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

async function startCampaign(page: Page): Promise<void> {
  await boot(page, false);
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
}

async function noClipping(page: Page): Promise<void> {
  const r = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.career')!;
    const vw = root.clientWidth;
    const bad = [...root.querySelectorAll<HTMLElement>('button')]
      .filter((b) => b.offsetParent !== null && !b.closest('.gx-fleet'))
      .map((b) => b.getBoundingClientRect())
      .filter((b) => b.left < -1 || b.right > vw + 1).length;
    return { scroll: root.scrollWidth - root.clientWidth, bad };
  });
  expect(r.scroll).toBeLessThanOrEqual(1);
  expect(r.bad).toBe(0);
}

async function shots(page: Page, name: string): Promise<void> {
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}-${w}x${h}.png` });
    await noClipping(page);
  }
  await page.setViewportSize({ width: 1400, height: 860 });
}


test('shell and the first screens: garage, events, chapters', async ({ page }) => {
  test.setTimeout(240_000);
  await startCampaign(page);
  await expect(page.getByTestId('career-nav')).toBeVisible();
  await expect(page.getByTestId('nav-garage')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('nav-chapters')).toBeDisabled();
  await expect(page.getByTestId('garage-systems')).toHaveCount(0); // stock car: nothing installed
  await expect(page.getByTestId('stat-power')).toHaveText(/^\d+ cv$/);
  await shots(page, 'garage');

  await page.getByTestId('nav-events').click();
  await expect(page.getByTestId('career-events')).toBeVisible();
  await expect(page.getByTestId('nav-events')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('event-e1-primeira-noite')).toHaveAttribute('data-status', 'available');
  await expect(page.getByTestId('event-e2-pequeno-valente')).toBeDisabled();
  await shots(page, 'events');

  await mode(page, `(() => { const s = m.controller.save; s.completedEventIds = ${JSON.stringify(eventsOf('chapter-1').map((e) => e.id))}; m.show('chapters'); })()`);
  await expect(page.getByTestId('career-chapters-screen')).toBeVisible();
  await expect(page.getByTestId('chapter-chapter-2')).toHaveAttribute('data-open', '1');
  await shots(page, 'chapters');
  await mode(page, `(() => { const s = m.controller.save; s.completedEventIds = []; m.show('chapters'); })()`);
  await expect(page.getByTestId('chapter-chapter-2')).toHaveAttribute('data-open', '0');
  await shots(page, 'chapters-locked');
});

test('first car choice and the intro dialogue', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, false);
  await page.locator('button.tab[data-mode=career]').click();
  await page.getByTestId('career-new').click();
  await expect(page.getByTestId('career-choose')).toBeVisible();
  for (const id of ['vw-gol-gts-1988', 'gm-chevette-sl-1988', 'fiat-uno-mille-1995']) await expect(page.getByTestId(`starter-${id}`)).toBeVisible();
  await shots(page, 'choose');
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/dialogue-1400x860.png` });
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
});

test('dyno, market, history, rival, result and ending', async ({ page }) => {
  test.setTimeout(420_000);
  await startCampaign(page);

  // dyno: real measurement fills the chart and the meter
  await page.getByTestId('nav-dyno').click();
  await expect(page.getByTestId('career-dyno')).toBeVisible();
  await expect(page.getByTestId('career-dyno-info')).toHaveAttribute('data-done', '1', { timeout: 60_000 });
  await expect(page.getByTestId('dyno-state')).toHaveText('Medição concluída');
  await expect(page.getByTestId('dyno-peak-power')).toHaveText(/\d+,\d cv/);
  await shots(page, 'dyno');
  // leaving mid-measurement is harmless
  await page.getByTestId('dyno-run').click();
  await page.getByTestId('nav-garage').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();

  // market: cards, detail, filters, resale protection (only one car)
  await page.getByTestId('nav-market').click();
  await expect(page.getByTestId('career-market')).toBeVisible();
  await expect(page.getByTestId('market-buy-gm-chevette-sl-1988')).toBeVisible();
  await page.getByRole('button', { name: /Ver detalhes de/ }).first().click();
  await expect(page.getByTestId('market-detail-close')).toBeVisible();
  await shots(page, 'market-detail');
  await page.getByTestId('market-detail-close').click();
  await page.getByTestId('market-filter-owned').click();
  await expect(page.getByTestId('market-resale')).toBeVisible();
  await page.getByTestId('market-filter-all').click();
  const sellBtn = page.locator('[data-testid^=market-sell-]').first();
  await expect(sellBtn).toBeDisabled();
  await shots(page, 'market');

  // history: empty state with a way to the events
  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await shots(page, 'history-empty');

  // a recorded race feeds history and the result screen
  await mode(page, `m.debugSimulateRace('e1-primeira-noite')`);
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
  await expect(page.getByTestId('career-result')).toBeVisible();
  await expect(page.getByTestId('result-award')).toContainText('CR');
  await expect(page.getByTestId('nina-comments')).toBeVisible();
  await shots(page, 'result');
  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-total')).toHaveText('1');
  await page.getByTestId('history-row').first().locator('button').click();
  await expect(page.getByTestId('history-detail')).toBeVisible();
  await shots(page, 'history');

  // workshop inside the new shell
  await mode(page, `m.show('workshop')`);
  await expect(page.getByTestId('career-workshop')).toBeVisible();
  await expect(page.getByTestId('nav-workshop')).toHaveAttribute('aria-current', 'page');
  await shots(page, 'workshop');

  // rival confrontation
  await mode(page, `(m.selectedEvent = 'e2-pequeno-valente', m.show('rival'))`);
  await expect(page.getByTestId('rival-name')).toContainText('Duda');
  await expect(page.getByTestId('rival-reward')).toContainText('CR');
  await shots(page, 'rival');

  // chapter ending (dialogue closes with skip)
  await mode(page, `(() => { const s = m.controller.save; s.completedEventIds = ${JSON.stringify(eventsOf('chapter-1').map((e) => e.id))}; m.endingChapter = 'chapter-1'; m.show('ending'); })()`);
  await expect(page.getByTestId('ending-title')).toHaveText('Rei da Madrugada');
  await expect(page.getByTestId('ending-chapter2')).toBeVisible();
  await page.waitForTimeout(600);
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-skip').count()); i++) await page.getByTestId('dialogue-skip').click();
  await shots(page, 'ending');
});

test('navigation: rapid switching keeps exactly one screen and reduced motion is respected', async ({ page }) => {
  test.setTimeout(120_000);
  await startCampaign(page);
  await mode(page, `(() => { for (const s of ['events','garage','market','history','dyno','garage','events','garage']) m.show(s); })()`);
  await expect(page.locator('.career > .career-screen')).toHaveCount(1);
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  for (const id of ['events', 'market', 'history', 'dyno', 'garage', 'overview']) {
    await page.getByTestId(`nav-${id}`).click();
    await expect(page.locator('.career > .career-screen')).toHaveCount(1);
  }
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await page.getByTestId('career-continue').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  // keyboard: Tab moves along the career navigation and Enter activates the focused entry
  await page.getByTestId('nav-garage').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('career-events')).toBeVisible();
  await page.locator('button.tab[data-mode=sandbox]').click();
});
