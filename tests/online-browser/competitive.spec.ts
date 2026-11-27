import { expect, test, type Page } from '@playwright/test';
import type { OnlineGearUpdate, OnlineRaceSnapshot } from '../../src/game/online/contracts';
import { findPart } from '../../src/game/career/tuning/parts';

async function login(page: Page, account: number): Promise<void> {
  await page.route('**/auth/v1/authorize?**', (route) => route.continue({
    headers: { ...route.request().headers(), 'x-fixture-account': String(account) },
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ativar som e começar' }).click();
  // Two software-rendered scenes share one GitHub runner during this network test.
  await page.getByTestId('settings').click();
  await page.getByTestId('graphics-setting').selectOption('low');
  await page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'baixa (menos CPU)', exact: true }) }).selectOption('low');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Online', exact: true }).click();
  const loginScreen = page.getByTestId('online-screen');
  for (const [label, url, heading] of [
    ['Privacidade', '/online/privacidade.html', 'Privacidade do modo online'],
    ['Termos de uso', '/online/termos.html', 'Termos de uso do modo online'],
  ]) {
    await expect(loginScreen.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', `.${url}`);
    const info = await page.request.get(url);
    expect(info.ok()).toBe(true);
    expect(await info.text()).toContain(`<h1>${heading}</h1>`);
  }
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
}

async function enroll(page: Page, nickname: string, starter: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Primeiro acesso' })).toBeVisible();
  await page.getByLabel('Nickname público').fill(nickname);
  await page.getByLabel('Primeiro carro').selectOption(starter);
  await page.getByLabel('Aceito os termos de uso').check();
  await page.getByRole('button', { name: 'Criar garagem' }).click();
  await expect(page.getByTestId('online-screen').getByText('4.500 CR')).toBeVisible();
  const audioGate = page.getByRole('button', { name: 'Ativar som e começar' });
  if (await audioGate.isVisible()) await audioGate.click();
}

const currentSnapshot = (page: Page) => page.evaluate(() => {
  const { renderer } = (window as unknown as {
    __app: { debug: { current: { renderer?: { newest?: OnlineRaceSnapshot; latestGear?: OnlineGearUpdate; loading: { lane: 0 | 1 } } } } };
  }).__app.debug.current;
  return renderer && { newest: renderer.newest, gear: renderer.latestGear, lane: renderer.loading.lane };
});

async function checkClock(page: Page): Promise<void> {
  const samples = await page.getByTestId('hud-time').evaluate((clock) => new Promise<number[]>((resolve) => {
    const values: number[] = [];
    const start = performance.now();
    const sample = (now: number) => {
      const seconds = Number.parseFloat(clock.textContent ?? '');
      if (Number.isFinite(seconds)) values.push(seconds);
      if (now - start < 1_200) requestAnimationFrame(sample);
      else resolve(values);
    };
    requestAnimationFrame(sample);
  }));
  expect(samples.length).toBeGreaterThan(5);
  expect(samples.every((seconds, index) => index === 0 || seconds >= samples[index - 1]!)).toBe(true);
  expect(samples.at(-1)! - samples[0]!).toBeGreaterThan(0.8);
}

function driveKey(page: Page, type: 'keydown' | 'keyup', code: 'KeyW' | 'KeyE'): Promise<void> {
  // Send each pilot's keys to its own window without moving focus between the two sessions.
  return page.evaluate(({ type, code }) => { window.dispatchEvent(new KeyboardEvent(type, { code })); }, { type, code });
}

async function drive(page: Page, touch = false): Promise<void> {
  const controls = page.getByTestId('touch-controls');
  const accelerator = page.getByTestId('touch-throttle');
  const throttle = (pressed: boolean) => touch
    ? accelerator.dispatchEvent(pressed ? 'pointerdown' : 'pointerup', { pointerType: 'touch', pointerId: 101 })
    : driveKey(page, pressed ? 'keydown' : 'keyup', 'KeyW');
  const upshift = async () => {
    if (touch) {
      await page.getByTestId('touch-upshift').evaluate((button) => {
        if (button.getClientRects().length === 0) return;
        const pointer = { pointerType: 'touch', pointerId: 102, bubbles: true, cancelable: true };
        button.dispatchEvent(new PointerEvent('pointerdown', pointer));
        button.dispatchEvent(new PointerEvent('pointerup', pointer));
      });
    } else {
      await driveKey(page, 'keydown', 'KeyE');
      await driveKey(page, 'keyup', 'KeyE');
    }
  };
  if (touch) await expect(controls).toBeVisible();
  await expect.poll(async () => {
    const renderer = await currentSnapshot(page);
    return renderer?.newest?.lanes[renderer.lane].runState;
  }, { timeout: 20_000 }).toBe('RUNNING');
  await upshift();
  await expect.poll(async () => {
    const renderer = await currentSnapshot(page);
    return { lane: renderer?.lane, confirmed: renderer?.gear?.gear, snapshot: renderer?.newest?.lanes[renderer.lane].gear };
  }, { timeout: 4_000 }).toMatchObject({ confirmed: 1, snapshot: 1 });
  await expect.poll(async () => {
    const renderer = await currentSnapshot(page);
    return renderer?.newest?.lights.green[renderer.lane] ?? false;
  }, { timeout: 20_000 }).toBe(true);
  await throttle(true);
  if (touch) await expect(accelerator).toHaveClass(/\bheld\b/);
  try {
    await checkClock(page);
    for (;;) {
      await page.waitForTimeout(130);
      const renderer = await currentSnapshot(page);
      const lane = renderer && renderer.newest?.lanes[renderer.lane];
      if (!lane || lane.result.finished || lane.result.dnf) return;
      if (lane.rpm >= 5_750 && !lane.shifting) await upshift();
    }
  } finally {
    // Keep the touch press held to verify that leaving the race clears it.
    if (!touch) await throttle(false);
  }
}

async function checkProgress(page: Page, won: boolean, pilot: string, rival: string): Promise<void> {
  const screen = page.getByTestId('online-screen');
  const credits = won ? '5.100 CR' : '4.800 CR';
  const rp = won ? '1016' : '984';
  const pp = won ? '5' : '3';
  const outcome = won ? 'Vitória' : 'Derrota';
  await expect(screen.getByRole('heading', { name: outcome, exact: true })).toBeVisible();
  await expect(screen.getByText(credits, { exact: true })).toBeVisible();
  await expect(screen.getByText(won ? '+600 CR · +16 RP · +5 PP' : '+300 CR · -16 RP · +3 PP', { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Online', exact: true }).click();
  await expect(screen.getByText(credits, { exact: true })).toBeVisible();
  await expect(screen.getByText(new RegExp(`^${pp} PP · Árvore .* · 1 corridas`))).toBeVisible();

  const nav = screen.getByRole('navigation', { name: 'Modo online' });
  await screen.getByRole('button', { name: 'Dinamômetro', exact: true }).click();
  await expect(screen.getByRole('spinbutton', { name: 'Pressão dos pneus', exact: true })).toBeDisabled();
  await expect(screen.getByText('Exige pneus de competição ou kit de pressão.', { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Medir e comparar', exact: true }).click();
  await expect(screen.getByText('Medição concluída.', { exact: true })).toBeVisible();
  const measured = screen.getByRole('table', { name: 'Comparação dos picos' });
  for (const label of ['Potência (cv)', 'Torque (N·m)']) {
    const row = measured.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) });
    const [saved, current] = await row.getByRole('cell').allTextContents();
    expect(Number(saved)).toBeGreaterThan(0);
    expect(current).toBe(saved);
  }

  await nav.getByRole('button', { name: 'Garagem', exact: true }).click();
  await screen.getByRole('button', { name: 'Oficina', exact: true }).click();
  await expect(screen.getByTestId('ws-stage')).toBeVisible();
  await expect(screen.getByTestId('ws-overview')).toContainText('Original');
  await screen.getByTestId('ws-search-panel').locator('summary').click();
  await screen.getByTestId('ws-search').fill('turbina grande');
  await screen.getByTestId('ws-part-turbine-large').click();
  await screen.getByTestId('ws-search-panel').locator('summary').click();
  await expect(screen.getByTestId('ws-unlock')).toBeDisabled();
  await screen.getByRole('button', { name: 'Ver preparação', exact: true }).click();
  await expect(screen.getByRole('heading', { name: 'Preparação', exact: true })).toBeVisible();
  const focused = screen.locator('.online-focused');
  await expect(focused).toHaveCount(1);
  await expect(focused.getByText(/^Faltam \d+ PP$/)).toBeVisible();
  const prerequisite = focused.getByRole('button', { name: /^Ir para / }).first();
  const prerequisiteName = await prerequisite.innerText();
  await prerequisite.click();
  await expect(screen.getByRole('article', { name: prerequisiteName, exact: true })).toBeFocused();
  const branches = screen.getByRole('navigation', { name: 'Ramos da preparação' });
  await branches.getByRole('button', { name: 'Pneus e aderência', exact: true }).click();
  await expect(screen.getByRole('heading', { name: 'Pneus e aderência', exact: true })).toBeFocused();
  await screen.getByRole('button', { name: 'Voltar à oficina', exact: true }).click();
  await expect(screen.getByTestId('ws-part-turbine-large')).toHaveAttribute('aria-pressed', 'true');

  await nav.getByRole('button', { name: 'Ranking', exact: true }).click();
  const position = won ? '1' : '2';
  await expect(screen.getByText(`Sua posição global: ${position}`, { exact: true })).toBeVisible();
  const rankingRow = screen.getByRole('row').filter({ has: page.getByRole('cell', { name: pilot, exact: true }) });
  await expect(rankingRow).toHaveClass(/\bonline-focused\b/);
  await expect(rankingRow.getByRole('cell').nth(0)).toHaveText(position);
  await expect(rankingRow.getByRole('cell').nth(3)).toHaveText(rp);

  await nav.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(screen.getByRole('columnheader', { name: 'Motivo', exact: true })).toBeVisible();
  const historyRow = screen.getByRole('row').filter({ has: page.getByRole('cell', { name: rival, exact: true }) });
  await expect(historyRow.getByRole('cell').nth(2)).toHaveText(outcome);
  await expect(historyRow.getByRole('cell').nth(3)).toHaveText(won ? '600' : '300');
  await expect(historyRow.getByRole('cell').nth(4)).toHaveText(won ? '16' : '-16');
  await expect(historyRow.getByRole('cell').nth(5)).toHaveText(pp);
  await expect(historyRow.getByRole('cell').nth(6)).toHaveText('—');
}

test('duas sessões de navegador completam PKCE, garagem e corrida 1v1', async ({ browser, baseURL }) => {
  const contexts = await Promise.all([
    browser.newContext({ baseURL, viewport: { width: 1000, height: 680 } }),
    browser.newContext({ baseURL, viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true }),
  ]);
  try {
    const [left, right] = await Promise.all(contexts.map((context) => context.newPage()));
    await Promise.all([login(left!, 0), login(right!, 1)]);
    await Promise.all([enroll(left!, 'Piloto Azul', 'fiat-uno-mille-1995'), enroll(right!, 'Piloto Ouro', 'gm-chevette-sl-1988')]);
    // Voltar a entrar com a mesma conta preserva a garagem e o saldo.
    await left!.getByTestId('online-screen').getByRole('button', { name: 'Sair', exact: true }).click();
    await left!.getByRole('button', { name: 'Continuar com Google' }).click();
    await expect(left!.getByTestId('online-screen').getByText('4.500 CR')).toBeVisible();
    for (const page of [left!, right!]) {
      const audioGate = page.getByRole('button', { name: 'Ativar som e começar' });
      if (await audioGate.isVisible()) await audioGate.click();
      await page.getByRole('button', { name: 'Buscar partida', exact: true }).click();
    }
    await Promise.all([left!, right!].map((page) => page.getByRole('button', { name: 'Confirmar veículo' }).click()));
    await Promise.all([drive(left!), drive(right!, true)]);
    for (const page of [left!, right!]) await expect(page.getByRole('button', { name: 'Buscar nova partida' })).toBeVisible({ timeout: 45_000 });
    await expect(right!.getByTestId('touch-controls')).toBeHidden();
    await expect(right!.getByTestId('touch-throttle')).not.toHaveClass(/\bheld\b/);
    const matchReference = (page: Page) => page.getByTestId('online-match-reference').locator('code');
    await expect(matchReference(left!)).toHaveText(/^[0-9a-f-]{36}$/);
    await expect(matchReference(right!)).toHaveText(await matchReference(left!).innerText());
    const timings = (page: Page) => page.getByTestId('online-screen').getByText(/Reação .* ET .* Total/).allTextContents();
    expect(await timings(left!)).toEqual(await timings(right!));
    expect(await timings(left!)).toHaveLength(2);
    expect((await timings(left!)).every((line) => /ET \d+\.\d{3} s/.test(line))).toBe(true);
    for (const [index, page] of [left!, right!].entries()) await page.screenshot({ path: test.info().outputPath(`resultado-${index + 1}.png`) });
    const leftWon = await left!.getByTestId('online-screen').getByRole('heading', { name: 'Vitória', exact: true }).isVisible();
    await Promise.all([
      checkProgress(left!, leftWon, 'Piloto Azul', 'Piloto Ouro'),
      checkProgress(right!, !leftWon, 'Piloto Ouro', 'Piloto Azul'),
    ]);
  } finally { await Promise.allSettled(contexts.map((context) => context.close())); }
});

test('oficina compartilhada confirma PP, compra, conjunto e restauração pelo servidor', async ({ page }) => {
  await login(page, 2);
  const base = 'gm-chevette-sl-1988';
  await enroll(page, 'Piloto Oficina', base);
  expect((await page.request.post('http://127.0.0.1:54751/fixture/workshop')).ok()).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Online', exact: true }).click();
  await page.getByRole('button', { name: 'Oficina', exact: true }).click();
  const workshop = page.getByTestId('ws-visual');
  await expect(workshop).toHaveAttribute('data-mode', 'online');
  await expect(workshop.getByTestId('ws-overview')).toContainText('20.000 CR');
  await expect(workshop.getByTestId('ws-stage')).toHaveAttribute('data-painted', /[1-9]/);
  await workshop.evaluate((element) => { element.dataset.identity = 'same'; });
  const captures = `${process.env.VISUAL_DIR ?? 'visual-captures'}/workshop-online`;
  const shot = (name: string) => page.screenshot({ path: `${captures}/${name}.png`, fullPage: true, animations: 'disabled' });
  const choose = async (tab: string, slot: string, id: string) => {
    await workshop.getByTestId(`ws-tab-${tab}`).click();
    await workshop.getByTestId(`ws-subtab-${slot}`).click();
    await workshop.getByTestId(`ws-part-${id}`).click();
  };
  const open = () => workshop.getByTestId('ws-details-toggle').click();
  const close = () => workshop.getByRole('button', { name: 'Fechar detalhes' }).click();
  const unlock = async () => {
    await workshop.getByTestId('ws-unlock').click();
    await page.getByTestId('ws-confirm-accept').click();
    await expect(workshop.getByTestId('ws-unlock')).toHaveCount(0);
  };
  await choose('turbo', 'turbo', 'turbo-basic');
  await expect(workshop.getByTestId('ws-part-turbo-basic')).toHaveAttribute('data-state', 'locked');
  await shot('01-desbloqueio');
  await unlock();
  await expect(workshop.getByTestId('ws-part-turbo-basic')).toHaveAttribute('aria-pressed', 'true');
  await expect(workshop.getByTestId('ws-overview')).toContainText('20.000 CR');
  await expect(workshop.getByTestId('ws-buy')).toBeDisabled();
  await open();
  await expect(workshop.getByTestId('ws-req-clutch-reinforced')).toBeVisible();
  await shot('02-requisitos-mecanicos');
  await close();

  await choose('transmission', 'clutch', 'clutch-reinforced');
  await unlock();
  await workshop.getByTestId('ws-buy-stock').click();
  await page.getByTestId('ws-confirm-accept').click();
  await expect(workshop.getByTestId('ws-part-clutch-reinforced')).toHaveAttribute('data-state', 'owned');
  await choose('turbo', 'turbo', 'turbo-basic');
  await workshop.getByTestId('ws-install-bundle').click();
  await expect(page.getByTestId('ws-bundle-modal')).toContainText('do estoque');
  await page.getByTestId('ws-bundle-confirm').click();
  await expect(workshop.getByTestId('ws-part-turbo-basic')).toHaveAttribute('data-state', 'installed');
  await expect(workshop).toHaveAttribute('data-identity', 'same');
  const balance = 20000 - findPart('turbo-basic')!.price - findPart('clutch-reinforced')!.price;
  await expect(workshop.getByTestId('ws-overview')).toContainText(`${balance.toLocaleString('pt-BR')} CR`);
  await workshop.getByTestId('ws-version-slide').click();
  await expect(workshop.getByTestId('ws-slider')).toBeVisible();
  await shot('03-conjunto-e-comparacao');

  await workshop.getByTestId('ws-restore-all').click();
  await page.getByTestId('ws-confirm-accept').click();
  await expect(workshop.getByTestId('ws-part-turbo-basic')).toHaveAttribute('data-state', 'owned');
  await expect(workshop.getByTestId('ws-overview')).toContainText(`${balance.toLocaleString('pt-BR')} CR`);
  await choose('exhaust', 'exhaust', 'exhaust-sport');
  await unlock();
  await workshop.getByTestId('ws-buy').click();
  await page.getByTestId('ws-confirm-accept').click();
  await expect(workshop.getByTestId('ws-part-exhaust-sport')).toHaveAttribute('data-state', 'installed');
  await expect(workshop.getByTestId('ws-overview')).toContainText(`${(balance - findPart('exhaust-sport')!.price).toLocaleString('pt-BR')} CR`);
  await shot('04-compra-e-instalacao');
});
