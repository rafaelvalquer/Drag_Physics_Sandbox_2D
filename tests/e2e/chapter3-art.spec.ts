/**
 * Visual review of the eight Chapter 3 silhouettes (contact sheets, day and night) and of the three
 * new venues. Screenshots go to `visual-captures/chapter3/`. Not a pixel comparison: a review tool
 * that also fails on any error of the console.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot, errors, mode } from './helpers';

const OUT = `${process.env.VISUAL_DIR ?? 'visual-captures'}/chapter3`;
mkdirSync(OUT, { recursive: true });

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('capítulo 3: silhuetas dos oito carros e os três cenários', async ({ page }) => {
  test.setTimeout(240_000);
  const sheet = async (query: string, name: string): Promise<void> => {
    await page.goto(`/?${query}`);
    await expect(page.locator('#artsheet')).toBeVisible();
    const data = await page.evaluate(() => (document.getElementById('artsheet') as HTMLCanvasElement).toDataURL('image/png'));
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data.split(',')[1]!, 'base64'));
  };
  await sheet('artsheet=&from=23&count=4&ppm=170', 'silhuetas-a');
  await sheet('artsheet=&from=27&count=4&ppm=170', 'silhuetas-b');
  await sheet('artsheet=night&from=23&count=4&ppm=170', 'silhuetas-noite-a');
  await sheet('artsheet=night&from=27&count=4&ppm=170', 'silhuetas-noite-b');

  // the three venues, through the rival screen of the first event of each (the career scene)
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __app: { debug: { current: { id: string } } } }).__app.debug.current.id === 'career');
  await mode(page, 'm.ready');
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) await page.getByTestId('dialogue-next').click();
  for (const [track, ev] of [
    ['marginal-alta', 'c3e1-a-volta-do-gti'],
    ['hangar-executivo', 'c3e4-zeta-de-verdade'],
    ['pier-elite', 'c3e8-a-volta-da-evo'],
  ] as const) {
    await mode(page, `(m.selectedEvent = '${ev}', m.show('rival'))`);
    await page.evaluate(() => document.querySelector('[data-testid=career]')!.classList.add('hidden'));
    await expect.poll(() => mode<string>(page, 'm.track().id')).toBe(track);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/cenario-${track}.png` });
  }
});
