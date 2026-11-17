/**
 * Premium campaign main menu: states, data, actions, navigation robustness, reduced motion and
 * layout at four resolutions. Screenshots go to `visual-captures/career-menu/` (VISUAL_DIR overrides
 * the root, e.g. `before`/`after`). The chapter states are produced by editing the in-memory save of
 * the open campaign (nothing is persisted); the data shown is still read from that save.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { eventsOf } from '../../src/game/career/CareerEvents';
import { boot, errors, mode } from './helpers';

const OUT = `${process.env.VISUAL_DIR ?? 'visual-captures'}/career-menu`;
mkdirSync(OUT, { recursive: true });
const SIZES: [number, number][] = [
  [1920, 1080],
  [1366, 768],
  [1024, 768],
  [390, 844],
];

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

async function openCareer(page: Page): Promise<void> {
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __app: { debug: { current: { id: string } } } }).__app.debug.current.id === 'career');
}

async function startCampaign(page: Page): Promise<void> {
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  await mode(page, `m.show('menu')`);
  await expect(page.getByTestId('career-continue')).toBeVisible();
}

/** Waits for the entrance to finish (≈1.5 s) and the hero artwork to be drawn. */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid=career-menu] .cm-car canvas');
    return !!c && c.width > 100;
  });
  await page.waitForTimeout(1900);
}

async function shots(page: Page, name: string): Promise<void> {
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/${name}-${w}x${h}.png` });
    await expectNoClipping(page);
  }
  await page.setViewportSize({ width: 1400, height: 860 });
}

/** No horizontal scroll and every action button fully inside the horizontal bounds. */
async function expectNoClipping(page: Page): Promise<void> {
  const r = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.career')!;
    const vw = root.clientWidth;
    const bad = [...document.querySelectorAll<HTMLElement>('[data-testid=career-menu] button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => b.getBoundingClientRect())
      .filter((b) => b.left < -1 || b.right > vw + 1).length;
    return { scroll: root.scrollWidth - root.clientWidth, bad };
  });
  expect(r.scroll).toBeLessThanOrEqual(1);
  expect(r.bad).toBe(0);
}

async function setSave(page: Page, js: string): Promise<void> {
  await mode(page, `(() => { const s = m.controller.save; ${js}; m.show('menu'); })()`);
  await settle(page);
}

test('menu without a campaign: demo car, start action, no progression', async ({ page }) => {
  await boot(page, false);
  await openCareer(page);
  await settle(page);
  await expect(page.getByTestId('career-new')).toHaveCount(1);
  await expect(page.getByTestId('career-continue')).toHaveCount(0);
  await expect(page.getByTestId('career-credits')).toHaveCount(0);
  await expect(page.getByTestId('career-import')).toBeVisible();
  await expect(page.getByTestId('career-back')).toBeVisible();
  await expect(page.getByTestId('career-chapter')).toContainText('Madrugada Zero');
  await shots(page, 'a-no-campaign');
});

test('menu with a campaign: real data, actions, confirmation and navigation', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, false);
  await openCareer(page);
  await startCampaign(page);
  await settle(page);

  const d = await mode<{ credits: number; rep: number; name: string }>(
    page,
    `(() => { const s = m.controller.save; const c = m.controller.activeCar; return { credits: s.credits, rep: s.reputation, name: c.nickname }; })()`,
  );
  await expect(page.getByTestId('career-credits')).toHaveText(`${d.credits.toLocaleString('pt-BR')} CR`);
  await expect(page.getByTestId('career-reputation')).toHaveText(`Reputação ${d.rep}`);
  await expect(page.getByTestId('career-chapter-progress')).toHaveText('0/7 noites');
  await expect(page.getByTestId('menu-car-name')).toContainText(d.name);
  await expect(page.getByTestId('menu-power')).toHaveText(/^\d+ cv$/);
  await expect(page.getByTestId('menu-torque')).toHaveText(/^\d+ N·m$/);
  await expect(page.getByTestId('menu-next-event')).toContainText(eventsOf('chapter-1')[0]!.title.toUpperCase());
  // no progress simulated when nothing was completed
  expect(await page.locator('.cm-bar > i').first().evaluate((e) => (e as HTMLElement).style.width)).toBe('0%');
  await shots(page, 'b-ch1-progress');

  // continue → garage → back to the menu
  await page.getByTestId('career-continue').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  await page.getByTestId('garage-menu').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  for (const [btn, screen] of [
    ['career-garage', 'career-garage-screen'],
    ['career-history', 'career-history-screen'],
  ] as const) {
    await page.getByTestId(btn).click();
    await expect(page.getByTestId(screen)).toBeVisible();
    await mode(page, `m.show('menu')`);
    await expect(page.getByTestId('career-menu')).toBeVisible();
  }
  await expect(page.getByTestId('career-chapters')).toHaveCount(0); // chapter 2 still locked
  await expect(page.getByTestId('career-export')).toBeVisible();

  // new campaign keeps its confirmation (declining changes nothing)
  let asked = 0;
  page.once('dialog', (dlg) => {
    asked++;
    void dlg.dismiss();
  });
  await page.getByTestId('career-new').click();
  expect(asked).toBe(1);
  await expect(page.getByTestId('career-menu')).toBeVisible();

  // back to the sandbox
  await page.getByTestId('career-back').click();
  await expect.poll(() => mode<string>(page, 'm.id')).toBe('sandbox');
});

test('chapter states: 1 complete, 2 in progress, 2 complete', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, false);
  await openCareer(page);
  await startCampaign(page);
  const ids1 = eventsOf('chapter-1').map((e) => e.id);
  const ids2 = eventsOf('chapter-2').map((e) => e.id);

  await setSave(page, `s.completedEventIds = ${JSON.stringify(ids1.slice(0, 3))}`);
  await expect(page.getByTestId('career-chapter-progress')).toHaveText('3/7 noites');
  expect(await page.locator('.cm-bar > i').first().evaluate((e) => (e as HTMLElement).style.width)).toBe(`${Math.round((3 / 7) * 100)}%`);
  await shots(page, 'b2-ch1-3of7');

  await setSave(page, `s.completedEventIds = ${JSON.stringify(ids1)}`);
  await expect(page.getByTestId('menu-chapter-done')).toBeVisible();
  await expect(page.getByTestId('career-continue')).toBeVisible();
  await shots(page, 'c-ch1-complete');

  await setSave(page, `s.completedEventIds = ${JSON.stringify([...ids1, ...ids2.slice(0, 3)])}; s.unlockedChapters = ['chapter-1','chapter-2']; s.chapterId = 'chapter-2'`);
  await expect(page.getByTestId('career-menu')).toHaveAttribute('data-chapter', 'chapter-2');
  await expect(page.getByTestId('career-chapter')).toContainText('Liga da Madrugada');
  await expect(page.getByTestId('career-chapters')).toBeVisible();
  await expect(page.getByTestId('menu-next-event')).toBeVisible();
  await shots(page, 'd-ch2-progress');
  await page.getByTestId('career-chapters').click();
  await expect(page.getByTestId('career-chapters-screen')).toBeVisible();
  await mode(page, `m.show('menu')`);

  await setSave(page, `s.completedEventIds = ${JSON.stringify([...ids1, ...ids2])}`);
  await expect(page.getByTestId('menu-chapter-done')).toContainText('Capítulo concluído');
  await expect(page.getByTestId('career-garage')).toBeVisible();
  await shots(page, 'e-ch2-complete');
});

test('animations: clicks are never blocked, fast navigation and remounts stay clean', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, false);
  await openCareer(page);
  await startCampaign(page);
  // click right after mount, while the entrance is still running
  await mode(page, `m.show('menu')`);
  await page.getByTestId('career-garage').click({ timeout: 2000 });
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  // rapid screen switching never leaves an empty root
  await mode(page, `(() => { for (const s of ['menu','garage','menu','history','menu','garage','menu']) m.show(s); })()`);
  await expect(page.getByTestId('career-menu')).toHaveCount(1);
  for (let i = 0; i < 6; i++) {
    await page.locator('button.tab[data-mode=sandbox]').click();
    await page.locator('button.tab[data-mode=career]').click();
    await expect(page.getByTestId('career-menu')).toBeVisible();
  }
  await settle(page);
  // no timeline from removed menus keeps running: only the current menu's ambient tweens remain
  const active = await page.evaluate(() => {
    const g = (window as unknown as { gsap?: { globalTimeline: { getChildren(): unknown[] } } }).gsap;
    return g ? g.globalTimeline.getChildren().length : -1;
  });
  expect(active === -1 || active < 12).toBe(true);
  // leaving mid-animation is harmless
  await mode(page, `m.show('menu')`);
  await page.locator('button.tab[data-mode=sandbox]').click();
});

test('reduced motion: content is complete immediately and nothing keeps moving', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, false);
  await openCareer(page);
  const op = await page.getByTestId('career-new').evaluate((e) => getComputedStyle(e.closest('.cm-primary-wrap')!).opacity);
  expect(op).toBe('1');
  await expect(page.locator('.cm-spot').first()).toHaveCSS('transform', 'none');
  await shots(page, 'f-reduced-motion');
});
