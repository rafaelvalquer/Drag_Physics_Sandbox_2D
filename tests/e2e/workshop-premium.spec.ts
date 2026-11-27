import { expect, test } from '@playwright/test';
import { CHAPTER2_EVENTS, CHAPTER3_EVENTS, EVENTS } from '../../src/game/career/CareerEvents';
import { findPart } from '../../src/game/career/tuning/parts';
import { boot, errors, mode } from './helpers';

test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));

test('oficina premium: categorias, subcategorias, estados e adaptação para mobile', async ({ page }) => {
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
  await expect(page.getByTestId('ws-performance')).toContainText('Potência');
  await expect(page.getByTestId('ws-overview')).toContainText('Reputação');
  for (const name of ['engine', 'intake', 'exhaust', 'transmission', 'tires', 'turbo', 'electronics', 'cooling', 'chassis'])
    await expect(page.getByTestId(`ws-tab-${name}`)).toHaveCount(1);

  const turboCams = page.getByTestId('ws-carousel').locator('[data-testid^="ws-part-cam-turbo"]');
  expect(await turboCams.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-tier')))).toEqual(['1', '2', '3']);
  await expect(turboCams.first()).toContainText('1.050 CR');

  await page.getByTestId('ws-tab-intake').click();
  for (const slot of ['intake-filter', 'intake-manifold', 'intake-throttle', 'intake-airbox']) {
    await page.getByTestId(`ws-subtab-${slot}`).click();
    await expect(page.getByTestId(`ws-stock-${slot}`)).toHaveAttribute('data-state', 'installed');
  }
  await expect(page.getByTestId('ws-subcategories').getByRole('button')).toHaveCount(4);
  await page.getByTestId('ws-subtab-intake-filter').click();
  await expect(page.getByTestId('ws-part-filter-cone')).toHaveAttribute('data-state', 'locked');
  await page.getByTestId('ws-subtab-intake-throttle').click();
  await page.getByTestId('ws-part-throttle-rework').click();
  await page.getByTestId('ws-details-toggle').click();
  await expect(page.getByTestId('ws-detail')).toContainText('Borboleta retrabalhada');
  await expect(page.getByTestId('ws-compare')).toContainText('Torque');
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();

  await page.getByTestId('ws-tab-electronics').click();
  await expect(page.getByTestId('ws-subcategories').getByRole('button')).toHaveCount(4);
  await page.getByTestId('ws-tab-cooling').click();
  await expect(page.getByTestId('ws-subcategories').getByRole('button')).toHaveCount(3);
  await expect(page.getByTestId('ws-subtab-turbo-intercooler')).toHaveCount(0);
  await page.getByTestId('ws-tab-turbo').click();
  await expect(page.getByTestId('ws-subtab-turbo-intercooler')).toBeVisible();
  await page.getByTestId('ws-tab-cooling').click();

  await page.setViewportSize({ width: 430, height: 900 });
  await expect(page.getByTestId('ws-tab-chassis')).toBeVisible();
  await expect(page.getByTestId('ws-subtab-cooling-radiator')).toBeVisible();
  const cols = await page.getByTestId('ws-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
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
  await page.getByTestId('ws-subtab-intake-airbox').click();
  const stage = (tier: number) => page.getByTestId(`ws-part-intake-airbox-bmw-n20-s${tier}`);
  await expect(stage(1)).toHaveAttribute('data-tier', '1');
  await expect(stage(1)).toHaveAttribute('data-state', 'available');
  await expect(stage(2)).toHaveAttribute('data-state', 'locked');
  await expect(stage(2)).toHaveAttribute('title', /Troca Perfeita/);
  await expect(stage(3)).toHaveAttribute('data-state', 'locked');
  await expect(page.getByTestId('ws-part-intake-airbox-bmw-n55-s1')).toHaveCount(0);

  await stage(1).click();
  await page.getByTestId('ws-details-toggle').click();
  await expect(page.getByTestId('ws-compare')).toContainText('Torque');
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();
  await page.getByTestId('ws-buy').click();
  await page.getByTestId('ws-confirm-accept').click();
  await expect(stage(1)).toHaveAttribute('data-state', 'installed');
  const progressed = JSON.stringify([...EVENTS, ...CHAPTER2_EVENTS.slice(0, 8)].map((event) => event.id));
  await mode(page, `m.controller.commit(s => { s.completedEventIds = ${progressed}; }).then(() => m.show('workshop'))`);
  await expect(stage(2)).toHaveAttribute('data-state', 'available');
  await stage(2).click();
  await page.getByTestId('ws-buy').click();
  await page.getByTestId('ws-confirm-accept').click();
  await expect(stage(2)).toHaveAttribute('data-state', 'installed');
  await expect(stage(1)).toHaveAttribute('data-state', 'owned');

  const elite = JSON.stringify([...EVENTS, ...CHAPTER2_EVENTS, ...CHAPTER3_EVENTS.slice(0, 5)].map((event) => event.id));
  await mode(page, `m.controller.commit(s => { s.completedEventIds = ${elite}; }).then(() => m.show('workshop'))`);
  await expect(stage(3)).toHaveAttribute('data-state', 'available');
  const beforePurchase = await mode<number>(page, 'm.controller.save.credits');
  await stage(3).click();
  await page.getByTestId('ws-buy').click();
  await page.getByTestId('ws-confirm-accept').click();
  await expect(stage(3)).toHaveAttribute('data-state', 'installed');
  await expect(stage(2)).toHaveAttribute('data-state', 'owned');
  const stage3Price = findPart('intake-airbox-bmw-n20-s3')!.price;
  expect(await mode<number>(page, 'm.controller.save.credits')).toBe(beforePurchase - stage3Price);

  await page.getByTestId('ws-stock-intake-airbox').click();
  await page.getByTestId('ws-install-stock').click();
  await page.getByTestId('ws-confirm-accept').click();
  await expect(page.getByTestId('ws-stock-intake-airbox')).toHaveAttribute('data-state', 'installed');
  await expect(stage(2)).toHaveAttribute('data-state', 'owned');
  await expect(stage(3)).toHaveAttribute('data-state', 'owned');
  await mode(page, "m.controller.load().then(() => m.show('workshop'))");
  await expect(page.getByTestId('ws-stock-intake-airbox')).toHaveAttribute('data-state', 'installed');
  await expect(stage(1)).toHaveAttribute('data-state', 'owned');
  await expect(stage(2)).toHaveAttribute('data-state', 'owned');
  await expect(stage(3)).toHaveAttribute('data-state', 'owned');
  await page.getByTestId('ws-tab-transmission').click();
  await page.getByTestId('ws-subtab-transmission-gearbox').click();
  await page.getByTestId('ws-part-automatic-bmw-n20-s1').click();
  await page.getByTestId('ws-details-toggle').click();
  await expect(page.getByTestId('ws-compare')).toContainText('Capacidade do câmbio');
  await expect(page.getByTestId('ws-compare')).toContainText('Fase de torque da troca');
  await expect(page.getByTestId('ws-compare')).toContainText('Travamento do conversor');
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();
  await page.getByTestId('ws-tab-electronics').click();
  await page.getByTestId('ws-subtab-electronics-fuel').click();
  await page.getByTestId('ws-part-fuel-bmw-n20-s1').click();
  await page.getByTestId('ws-details-toggle').click();
  await expect(page.getByTestId('ws-compare')).toContainText('Vazão de combustível');
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();
  await page.getByTestId('ws-tab-turbo').click();
  await page.getByTestId('ws-subtab-turbo-boost').click();
  await page.getByTestId('ws-part-boost-solenoid-bmw-n20-s1').click();
  await page.getByTestId('ws-details-toggle').click();
  await expect(page.getByTestId('ws-compare')).toContainText('Constante de enchimento do turbo');
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();
  await page.getByTestId('ws-tab-engine').click();
  await page.getByTestId('ws-subtab-engine-compression').click();
  await page.getByTestId('ws-part-compression-chamber-bmw-n20-s1').click();
  await page.getByTestId('ws-details-toggle').click();
  await expect(page.getByTestId('ws-compare')).toContainText('Torque médio');
  await expect(page.getByTestId('ws-compare')).toContainText('Taxa de compressão');
  await expect(page.getByTestId('ws-compare')).toContainText('Pressão sem atraso por detonação');
});
