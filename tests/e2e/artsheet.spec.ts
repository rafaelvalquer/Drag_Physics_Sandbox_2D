/** Captures the vehicle-art contact sheet (asset pipeline review). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const OUT = process.env.VISUAL_DIR ?? 'visual-captures';
mkdirSync(OUT, { recursive: true });

test('capture: vehicle art contact sheet', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const save = async (url: string, name: string): Promise<void> => {
    await page.goto(url);
    await expect(page.locator('#artsheet')).toBeVisible();
    const data = await page.evaluate(() => (document.getElementById('artsheet') as HTMLCanvasElement).toDataURL('image/png'));
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data.split(',')[1]!, 'base64'));
  };
  await save('/?artsheet=&from=0&count=4&ppm=170', 'artsheet-a');
  await save('/?artsheet=&from=4&count=4&ppm=170', 'artsheet-b');
  await save('/?artsheet=night&from=3&count=3&ppm=170', 'artsheet-night');
  expect(errors).toEqual([]);
});
