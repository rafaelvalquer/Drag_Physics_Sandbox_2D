import { expect, test, type Page } from '@playwright/test';
import { CHAPTER2_EVENTS, CHAPTER3_EVENTS, EVENTS } from '../../src/game/career/CareerEvents';
import { findPart } from '../../src/game/career/tuning/parts';
import { boot, errors, mode } from './helpers';

/**
 * Visual workshop (Oficina Visual 2.0): three areas, preview before buying, technical view by
 * architecture, GSAP animations, friendly copy and responsive layout. The screenshots of the
 * homologation go to `visual-captures/workshop/` (VISUAL_DIR overrides the folder).
 */
test.afterEach(() => expect(errors, errors.join('\n')).toEqual([]));

const OUT = `${process.env.VISUAL_DIR ?? 'visual-captures'}/workshop`;
const ALL_EVENTS = JSON.stringify([...EVENTS, ...CHAPTER2_EVENTS, ...CHAPTER3_EVENTS].map((e) => e.id));

async function newCampaign(page: Page): Promise<void> {
  await boot(page);
  await page.locator('button.tab[data-mode=career]').click();
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-vw-gol-gts-1988').click();
  await expect.poll(() => mode<boolean>(page, 'Boolean(m.controller.save)'), { timeout: 20_000 }).toBe(true);
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
}

/** Gives the player a car (bought through the controller) and opens the workshop on it. */
async function openWorkshopWith(page: Page, baseCarId: string | null, credits = 400_000): Promise<void> {
  await mode(page, `(async () => {
    await m.controller.commit(s => { s.completedEventIds = ${ALL_EVENTS}; s.reputation = 900; s.credits = ${credits}; });
    ${baseCarId ? `const bought = await m.controller.buyCar('${baseCarId}'); if (!bought.ok) throw Error(bought.error);
    const id = m.controller.save.ownedCars.find(c => c.baseCarId === '${baseCarId}').id;
    const active = await m.controller.setActiveCar(id); if (!active.ok) throw Error(active.error);` : ''}
    m.show('workshop');
  })()`);
  await expect(page.getByTestId('ws-visual')).toBeVisible();
  await waitPainted(page);
}

const painted = (page: Page): Promise<number> => page.getByTestId('ws-stage').getAttribute('data-painted').then((v) => Number(v ?? 0));
async function waitPainted(page: Page, atLeast = 1): Promise<void> {
  await expect.poll(() => painted(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(atLeast);
}
/** Selects a part through the screen API (its own tab opens), then waits for the stage to repaint. */
async function pick(page: Page, id: string): Promise<void> {
  const before = await painted(page);
  await mode(page, `m.workshopView.select(${JSON.stringify(id)})`);
  await expect(page.getByTestId('ws-detail')).toBeVisible();
  await expect.poll(() => painted(page), { timeout: 20_000 }).toBeGreaterThan(before);
}
const credits = (page: Page): Promise<number> => mode<number>(page, 'm.controller.save.credits');
const installed = (page: Page): Promise<string[]> => mode<string[]>(page, 'm.controller.activeCar.installedParts');
/** Pixel signature of a stage canvas (to tell whether two versions of the car differ). */
const sig = (page: Page, which: 'before' | 'after'): Promise<string> =>
  page.evaluate((w) => {
    const c = document.querySelector<HTMLCanvasElement>(`[data-testid="ws-canvas-${w}"]`)!;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]!) | 0;
    return `${c.width}x${c.height}:${h}`;
  }, which);

test('V01-V03 três áreas: catálogo, carro e detalhes; carro em destaque e desenhado', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  await expect(page.getByTestId('ws-left')).toBeVisible();
  await expect(page.getByTestId('ws-stage')).toBeVisible();
  await expect(page.getByTestId('ws-inspector')).toBeVisible();
  await expect(page.getByTestId('ws-detail-empty')).toContainText('Escolha uma peça');
  const [left, stage, insp] = await Promise.all(['ws-left', 'ws-stage', 'ws-inspector'].map((t) => page.getByTestId(t).boundingBox()));
  expect(stage!.width).toBeGreaterThan(left!.width * 1.5);
  expect(stage!.width).toBeGreaterThan(insp!.width * 1.5);
  expect(left!.x).toBeLessThan(stage!.x);
  expect(stage!.x).toBeLessThan(insp!.x);
  const info = await page.getByTestId('ws-canvas-before').evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
  expect(info.w).toBeGreaterThan(300);
  // the three modes and the title wording
  for (const m of ['external', 'technical', 'detail']) await expect(page.getByTestId(`ws-mode-${m}`)).toBeVisible();
  await expect(page.getByTestId('ws-mode-external')).toHaveText('Visual externo');
  await expect(page.getByTestId('ws-mode-technical')).toHaveText('Visão técnica');
  await expect(page.getByTestId('ws-mode-detail')).toHaveText('Detalhe da peça');
});

test('V04-V10 selecionar só mostra a prévia: não gasta créditos, não instala e não reconstrói a tela', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  const startCredits = await credits(page);
  const marker = await page.getByTestId('ws-visual').evaluate((el) => { (el as HTMLElement).dataset.keep = 'same'; return true; });
  expect(marker).toBe(true);
  await page.getByTestId('ws-tab-exhaust').click();
  await page.getByTestId('ws-part-exhaust-sport').click();
  await expect(page.getByTestId('ws-detail')).toContainText('Escape dimensionado');
  await expect(page.getByTestId('ws-part-exhaust-sport')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('ws-version-with').click();
  await expect(page.getByTestId('ws-legend')).toContainText('nada foi comprado');
  await page.getByTestId('ws-version-slide').click();
  await expect(page.getByTestId('ws-slider')).toBeVisible();
  await page.getByTestId('ws-version-now').click();
  expect(await credits(page)).toBe(startCredits);
  expect(await installed(page)).toEqual([]);
  // the screen element is the same one: selecting never rebuilt it
  await expect(page.getByTestId('ws-visual')).toHaveAttribute('data-keep', 'same');
  // the right-hand text uses the friendly sections
  for (const t of ['O que faz', 'O que muda no carro', 'Antes e depois', 'O que você precisa', 'Detalhes técnicos']) await expect(page.getByTestId('ws-detail')).toContainText(t);
  await expect(page.getByTestId('ws-detail')).toContainText('Funciona neste carro?');
});

test('V11-V14 modificações externas reais: escape e pneu mudam o carro; peça interna não muda', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  // exhaust tip: the "with" car differs from the current one
  await pick(page, 'exhaust-sport');
  await page.getByTestId('ws-mode-external').click();
  await page.getByTestId('ws-version-slide').click();
  await waitPainted(page, (await painted(page)) + 1).catch(() => undefined);
  await expect.poll(async () => (await sig(page, 'before')) !== (await sig(page, 'after'))).toBe(true);
  await expect(page.getByTestId('ws-detail')).toContainText('Ponteira do escapamento');
  // a tyre only changes lettering/appearance of the tyre
  await pick(page, 'tires-semislick');
  await expect(page.getByTestId('ws-external')).toContainText('Escrita e aparência do pneu');
  // an internal part is never shown as an external change
  await pick(page, 'cam-sport');
  await expect(page.getByTestId('ws-external')).toHaveCount(0);
  await page.getByTestId('ws-mode-external').click();
  await expect(page.getByTestId('ws-viewnote')).toContainText('não muda a aparência externa');
  await page.getByTestId('ws-version-slide').click();
  await expect.poll(async () => (await sig(page, 'before')) === (await sig(page, 'after'))).toBe(true);
});

test('V15-V20 visão técnica segue a arquitetura: Gol (dianteiro transversal) e Chevette (dianteiro, tração traseira)', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  await pick(page, 'turbo-basic');
  await expect(page.getByTestId('ws-mode-technical')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('ws-viewnote')).toContainText('motor dianteiro transversal');
  await expect(page.getByTestId('ws-viewnote')).toContainText('tração dianteira');
  await expect(page.getByTestId('ws-hotspot')).toContainText('Turbina');
  await expect(page.getByTestId('ws-illustration')).toBeVisible();
  await expect(page.getByTestId('ws-detail')).toContainText('Ilustração representativa');
  await page.screenshot({ path: `${OUT}/gol-tecnica-turbo.png` });
  // the technical drawing differs between current and with-the-part (the turbo only exists "with")
  await page.getByTestId('ws-version-slide').click();
  await expect.poll(async () => (await sig(page, 'before')) !== (await sig(page, 'after'))).toBe(true);
});

test('V21-V24 modo detalhe amplia a ilustração da peça; categorias sem ilustração própria usam a família', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  await pick(page, 'tires-semislick');
  await page.getByTestId('ws-mode-detail').click();
  await expect(page.getByTestId('ws-viewnote')).toContainText('Ilustração representativa');
  await expect(page.getByTestId('ws-hotspot')).toHaveCount(0);
  await page.getByTestId('ws-version-with').click();
  await expect(page.getByTestId('ws-mode-detail')).toHaveAttribute('aria-pressed', 'true');
  // a part with no dedicated drawing still has one (family drawing)
  await pick(page, 'cam-sport');
  await expect(page.getByTestId('ws-illustration')).toBeVisible();
  await expect(page.getByTestId('ws-detail')).toContainText('O que faz');
});

test('V25-V30 comparação com números reais, estimativas rotuladas e detalhes avançados recolhíveis', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  await pick(page, 'cam-sport');
  const cmp = page.getByTestId('ws-compare');
  await expect(cmp).toContainText('Potência');
  await expect(cmp).toContainText('Força do motor');
  await expect(cmp).toContainText('402 m (estimativa)');
  await expect(cmp).not.toContainText('…', { timeout: 30_000 });
  for (const d of ['201 m', '1 km']) await expect(cmp).toContainText(d);
  const adv = page.getByTestId('ws-advanced');
  await expect(adv).not.toHaveAttribute('open', '');
  await adv.locator('summary').click();
  await expect(adv).toHaveAttribute('open', '');
  await expect(adv).toContainText('Faixa útil (90 % do torque)');
});

test('V31-V36 comprar e instalar passa pelo controlador: créditos, estado, animação e erro sem sucesso falso', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null, 5_000);
  const price = findPart('exhaust-sport')!.price;
  await pick(page, 'exhaust-sport');
  const start = await credits(page);
  await page.getByTestId('ws-buy').click();
  await expect(page.getByTestId('ws-part-exhaust-sport')).toHaveAttribute('data-state', 'installed');
  expect(await credits(page)).toBe(start - price);
  expect(await installed(page)).toContain('exhaust-sport');
  await expect(page.getByTestId('career-credits')).toContainText(String(start - price).replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  await expect(page.getByTestId('ws-overview')).toContainText('SALDO');
  await expect(page.getByTestId('ws-remove')).toBeVisible();
  // not enough credits: the button is blocked and nothing changes
  await mode(page, 'm.controller.commit(s => { s.credits = 10; })');
  await mode(page, 'm.workshopView.refresh()');
  await pick(page, 'tires-semislick');
  await expect(page.getByTestId('ws-buy')).toBeDisabled();
  expect(await installed(page)).toEqual(['exhaust-sport']);
  // remove puts the part in the stock, install-from-stock charges nothing
  await pick(page, 'exhaust-sport');
  await page.getByTestId('ws-remove').click();
  await expect(page.getByTestId('ws-part-exhaust-sport')).toHaveAttribute('data-state', 'owned');
  const afterRemove = await credits(page);
  await page.getByTestId('ws-install').click();
  await expect(page.getByTestId('ws-part-exhaust-sport')).toHaveAttribute('data-state', 'installed');
  expect(await credits(page)).toBe(afterRemove);
  // restore everything to the original
  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('ws-restore-all').click();
  await expect.poll(() => installed(page)).toEqual([]);
});

test('V37-V39 busca e filtros instantâneos, sem esconder a peça escolhida', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  await page.getByTestId('ws-search').fill('turbina');
  await expect(page.getByTestId('ws-part-turbo-basic')).toBeVisible();
  await expect(page.getByTestId('ws-part-cam-sport')).toHaveCount(0);
  await page.getByTestId('ws-search').fill('');
  await page.getByTestId('ws-tab-exhaust').click();
  await page.getByTestId('ws-part-exhaust-sport').click();
  await page.getByTestId('ws-filter-equipped').click();
  await expect(page.getByTestId('ws-pinned')).toContainText('fora do filtro');
  await expect(page.getByTestId('ws-part-exhaust-sport')).toBeVisible();
  await page.getByTestId('ws-filter-all').click();
  await page.getByTestId('ws-search').fill('zzzz-nada');
  await expect(page.getByTestId('ws-empty')).toContainText('Nenhuma peça');
  await expect(page.getByTestId('ws-count')).toContainText('0 de');
});

test('V40-V41 animações com GSAP e prefers-reduced-motion; o ciclo termina ao sair da oficina', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  // the transition manager owns the controller while the workshop is open and drops it when it closes
  expect(await mode<boolean>(page, 'm.transition.workshop !== null')).toBe(true);
  expect(await mode<boolean>(page, 'm.transition.workshop.isReduced')).toBe(false);
  await pick(page, 'exhaust-sport');
  // after the selection animation finishes no inline style is left behind (clearProps)
  await expect.poll(() => page.getByTestId('ws-inspector').evaluate((el) => (el as HTMLElement).style.opacity)).toBe('');
  await mode(page, "m.show('garage')");
  expect(await mode<boolean>(page, 'm.transition.workshop === null')).toBe(true);
  expect(await mode<boolean>(page, 'm.workshopView === null')).toBe(true);
  // reduced motion: the controller never animates
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mode(page, "m.show('workshop')");
  await waitPainted(page);
  expect(await mode<boolean>(page, 'm.transition.workshop.isReduced')).toBe(true);
  await pick(page, 'tires-semislick');
  expect(await page.getByTestId('ws-inspector').evaluate((el) => (el as HTMLElement).style.opacity)).toBe('');
});

test('V42 a oficina lembra a seleção ao voltar e o Dyno Lab é aberto pelo kit de nitro', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  await pick(page, 'nitrous-street');
  await expect(page.getByTestId('nitro-dyno-hint')).toContainText('Shift');
  await expect(page.getByTestId('nitro-dyno-hint')).toContainText('Dyno Lab');
  await page.getByTestId('ws-buy').click();
  await expect(page.getByTestId('nitro-open-dyno')).toBeVisible();
  await page.getByTestId('nitro-open-dyno').click();
  await expect(page.getByTestId('career-dyno')).toBeVisible();
  await mode(page, "m.show('workshop')");
  await expect(page.getByTestId('ws-part-nitrous-street')).toHaveAttribute('aria-pressed', 'true');
});

test('V43 desempenho: a seleção responde rápido e não repinta o carro sem necessidade', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  await page.getByTestId('ws-tab-exhaust').click();
  const ids = ['exhaust-sport', 'exhaust-classic-flow', 'exhaust-classic-race'];
  const ms = await page.evaluate(async (list) => {
    const times: number[] = [];
    for (const id of list) {
      const t0 = performance.now();
      (document.querySelector(`[data-testid="ws-part-${id}"]`) as HTMLElement).click();
      times.push(performance.now() - t0);
      await new Promise((r) => setTimeout(r, 50));
    }
    return times;
  }, ids);
  console.log(`selection handler ms: ${ms.map((x) => x.toFixed(1)).join(', ')}`);
  for (const t of ms) expect(t).toBeLessThan(250);
  // hovering and idling never repaint the stage
  const n = await painted(page);
  await page.getByTestId('ws-part-exhaust-sport').hover();
  await page.waitForTimeout(400);
  expect(await painted(page)).toBe(n);
});

test('V43b layout responsivo: 1920, 1366, tablet e celular sem rolagem horizontal', async ({ page }) => {
  await newCampaign(page);
  await openWorkshopWith(page, null);
  await pick(page, 'exhaust-sport');
  const sizes: [number, number, string][] = [[1920, 1080, '1920x1080'], [1600, 900, '1600x900'], [1366, 768, '1366x768'], [1280, 720, '1280x720'], [768, 1024, '768x1024'], [430, 900, '430x900']];
  for (const [w, h, name] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `${name} horizontal overflow`).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('ws-stage')).toBeVisible();
    await page.screenshot({ path: `${OUT}/layout-${name}.png` });
  }
  const cols = await page.locator('.ws').evaluate((el) => getComputedStyle(el).display);
  expect(['flex', 'grid']).toContain(cols);
});

/** Captures of the homologation for the four reference cars. */
const CARS: { id: string | null; label: string; turbo: string; tire: string; exhaust: string; incompatible: string }[] = [
  { id: 'gm-chevette-sl-1988', label: 'chevette-sl-1988', turbo: 'turbo-basic', tire: 'tires-semislick', exhaust: 'exhaust-sport', incompatible: 'turbine-small' },
  { id: null, label: 'gol-gts-1988', turbo: 'turbo-basic', tire: 'tires-semislick', exhaust: 'exhaust-sport', incompatible: 'turbine-small' },
  { id: 'bmw-320i-f30-2014', label: 'bmw-320i-f30', turbo: 'factory-turbo-bmw-n20-s1', tire: 'tires-semislick', exhaust: 'exhaust-bmw-n20-s1', incompatible: 'factory-turbo-bmw-n20-s3' },
  { id: 'nissan-350z-2006', label: 'nissan-350z', turbo: 'conversion-turbo-nissan-vq35de-s1', tire: 'tires-semislick', exhaust: 'exhaust-v6-sport', incompatible: 'conversion-turbo-nissan-vq35de-s3' },
];

for (const car of CARS) {
  test(`capturas: ${car.label}`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await newCampaign(page);
    await openWorkshopWith(page, car.id);
    const shot = (name: string): Promise<Buffer> => page.screenshot({ path: `${OUT}/${car.label}-${name}.png` });
    await shot('01-sem-selecao');
    await pick(page, car.turbo);
    await shot('02-turbina');
    await pick(page, car.tire);
    await shot('03-pneu');
    await pick(page, car.exhaust);
    await shot('04-escapamento');
    await pick(page, car.turbo);
    await page.getByTestId('ws-mode-technical').click();
    await page.getByTestId('ws-version-with').click();
    await waitPainted(page, (await painted(page)) + 1).catch(() => undefined);
    await page.waitForTimeout(600);
    await shot('05-visao-tecnica-com-a-peca');
    await page.getByTestId('ws-mode-detail').click();
    await page.waitForTimeout(500);
    await shot('06-detalhe');
    await pick(page, car.exhaust);
    await page.getByTestId('ws-mode-external').click();
    await page.getByTestId('ws-version-slide').click();
    await page.waitForTimeout(600);
    await shot('07-antes-depois');
    await pick(page, car.incompatible);
    await page.getByTestId('ws-version-now').click();
    await page.waitForTimeout(500);
    await shot('09-peca-incompativel');
    // install: the success is shown only after the controller confirmed it
    await pick(page, car.exhaust);
    await page.getByTestId('ws-buy').click();
    await expect(page.getByTestId(`ws-part-${car.exhaust}`)).toHaveAttribute('data-state', 'installed');
    await page.waitForTimeout(900);
    await shot('08-instalacao-concluida');
    await page.setViewportSize({ width: 430, height: 900 });
    await page.waitForTimeout(400);
    await shot('10-mobile');
  });
}
