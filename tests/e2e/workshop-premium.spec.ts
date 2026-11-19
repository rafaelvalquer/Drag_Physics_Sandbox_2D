import { expect, test } from '@playwright/test';
import { CHAPTER2_EVENTS, EVENTS } from '../../src/game/career/CareerEvents';
import { boot, errors, mode } from './helpers';

test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));

test('oficina premium: nove sistemas, grupos distintos, estados e adaptação para mobile', async ({ page }) => {
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  // Creating the campaign is asynchronous (IndexedDB): do not race it with the test-only navigation.
  await expect.poll(() => mode<boolean>(page, 'Boolean(m.controller.save)'), { timeout: 20_000 }).toBe(true);
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  // The prologue has a variable number of dialogue frames; skip it for this visual regression.
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();

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
  await expect(page.locator('.ws-center .ws-group')).toHaveCount(4); // ECU, ignition, data logger + launch control (Dyno Lab 3.0)
  await page.getByTestId('ws-tab-cooling').click();
  await expect(page.locator('.ws-center .ws-group')).toHaveCount(4);
  await expect(page.getByTestId('ws-group-turbo-intercooler')).toBeVisible();

  await page.setViewportSize({ width: 430, height: 900 });
  await expect(page.getByTestId('ws-tab-chassis')).toBeVisible();
  await expect(page.getByTestId('ws-group-cooling-radiator')).toBeVisible();
  const cols = await page.locator('.ws').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(1);
});

test('oficina moderna: libera, substitui e guarda estágios da mesma peça', async ({ page }) => {
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();

  const completed = JSON.stringify([...EVENTS, CHAPTER2_EVENTS[0]!].map((event) => event.id));
  const bmw = 'bmw-320i-f30-2014';
  await mode(page, `(async () => {
    await m.controller.commit(s => { s.completedEventIds = ${completed}; s.reputation = 300; s.credits = 100000; });
    const bought = await m.controller.buyCar('${bmw}');
    if (!bought.ok) throw Error(bought.error);
    const id = m.controller.save.ownedCars.find(c => c.baseCarId === '${bmw}').id;
    const active = await m.controller.setActiveCar(id);
    if (!active.ok) throw Error(active.error);
    m.show('workshop');
  })()`);

  await page.getByTestId('ws-tab-intake').click();
  const stage = (tier: number) => page.getByTestId(`ws-part-intake-airbox-bmw-n20-s${tier}`);
  await expect(stage(1)).toHaveAttribute('data-tier', '1');
  await expect(stage(1)).toHaveAttribute('data-state', 'available');
  await expect(stage(2)).toHaveAttribute('data-state', 'locked');
  await expect(stage(2)).toContainText('Troca Perfeita');
  await expect(stage(3)).toHaveAttribute('data-state', 'locked');
  await expect(page.getByTestId('ws-part-intake-airbox-bmw-n55-s1')).toHaveCount(0);

  await stage(1).click();
  await expect(page.getByTestId('ws-compare')).toContainText('Torque');
  await page.getByTestId('ws-buy').click();
  await expect(stage(1)).toHaveAttribute('data-state', 'installed');
  const progressed = JSON.stringify([...EVENTS, ...CHAPTER2_EVENTS.slice(0, 8)].map((event) => event.id));
  await mode(page, `m.controller.commit(s => { s.completedEventIds = ${progressed}; }).then(() => m.show('workshop'))`);
  await expect(stage(2)).toHaveAttribute('data-state', 'available');
  await stage(2).click();
  await page.getByTestId('ws-buy').click();
  await expect(stage(2)).toHaveAttribute('data-state', 'installed');
  await expect(stage(1)).toHaveAttribute('data-state', 'owned');
  await page.getByTestId('ws-stock-intake-airbox').click();
  await page.getByTestId('ws-install-stock').click();
  await expect(page.getByTestId('ws-stock-intake-airbox')).toHaveAttribute('data-state', 'installed');
  await expect(stage(2)).toHaveAttribute('data-state', 'owned');
  await mode(page, "m.controller.load().then(() => m.show('workshop'))");
  await expect(page.getByTestId('ws-stock-intake-airbox')).toHaveAttribute('data-state', 'installed');
  await expect(stage(1)).toHaveAttribute('data-state', 'owned');
  await expect(stage(2)).toHaveAttribute('data-state', 'owned');
  await page.getByTestId('ws-tab-transmission').click();
  await page.getByTestId('ws-part-automatic-bmw-n20-s1').click();
  await expect(page.getByTestId('ws-compare')).toContainText('Capacidade do câmbio');
  await expect(page.getByTestId('ws-compare')).toContainText('Fase de torque da troca');
  await expect(page.getByTestId('ws-compare')).toContainText('Travamento do conversor');
  await page.getByTestId('ws-tab-electronics').click();
  await page.getByTestId('ws-part-fuel-bmw-n20-s1').click();
  await expect(page.getByTestId('ws-compare')).toContainText('Vazão de combustível');
});
