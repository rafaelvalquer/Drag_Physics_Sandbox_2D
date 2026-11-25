import { expect, test, type Page } from '@playwright/test';
import type { OnlineGearUpdate, OnlineRaceSnapshot } from '../../src/game/online/contracts';

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

async function upshift(page: Page): Promise<void> {
  await driveKey(page, 'keydown', 'KeyE');
  await driveKey(page, 'keyup', 'KeyE');
}

async function drive(page: Page): Promise<void> {
  await expect.poll(async () => {
    const renderer = await currentSnapshot(page);
    return renderer?.newest?.lanes[renderer.lane].runState;
  }, { timeout: 20_000 }).toBe('RUNNING');
  await upshift(page);
  await expect.poll(async () => {
    const renderer = await currentSnapshot(page);
    return { lane: renderer?.lane, confirmed: renderer?.gear?.gear, snapshot: renderer?.newest?.lanes[renderer.lane].gear };
  }, { timeout: 4_000 }).toMatchObject({ confirmed: 1, snapshot: 1 });
  await expect.poll(async () => {
    const renderer = await currentSnapshot(page);
    return renderer?.newest?.lights.green[renderer.lane] ?? false;
  }, { timeout: 20_000 }).toBe(true);
  await driveKey(page, 'keydown', 'KeyW');
  try {
    await checkClock(page);
    for (;;) {
      const renderer = await currentSnapshot(page);
      const lane = renderer && renderer.newest?.lanes[renderer.lane];
      if (!lane || lane.result.finished || lane.result.dnf) return;
      await page.waitForTimeout(130);
      if (lane.rpm >= 5_750 && !lane.shifting) await upshift(page);
    }
  } finally { await driveKey(page, 'keyup', 'KeyW'); }
}

test('duas sessões de navegador completam PKCE, garagem e corrida 1v1', async ({ browser, baseURL }) => {
  const options = { baseURL, viewport: { width: 1000, height: 680 } };
  const contexts = await Promise.all([browser.newContext(options), browser.newContext(options)]);
  try {
    const [left, right] = await Promise.all(contexts.map((context) => context.newPage()));
    await right!.routeWebSocket('ws://127.0.0.1:54752/**', (socket) => {
      const upstream = socket.connectToServer();
      let count = 0;
      let delivery = Promise.resolve();
      let closed = false;
      upstream.onMessage((message) => {
        const ready = new Promise<void>((resolve) => setTimeout(resolve, ++count % 12 === 0 ? 140 : 40));
        delivery = delivery.then(async () => {
          await ready;
          if (!closed) socket.send(message);
        });
      });
      socket.onClose(() => {
        closed = true;
        upstream.close();
      });
    });
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
    await Promise.all([drive(left!), drive(right!)]);
    for (const page of [left!, right!]) await expect(page.getByRole('button', { name: 'Buscar nova partida' })).toBeVisible({ timeout: 45_000 });
    const matchReference = (page: Page) => page.getByTestId('online-match-reference').locator('code');
    await expect(matchReference(left!)).toHaveText(/^[0-9a-f-]{36}$/);
    await expect(matchReference(right!)).toHaveText(await matchReference(left!).innerText());
    const timings = (page: Page) => page.getByTestId('online-screen').getByText(/Reação .* ET .* Total/).allTextContents();
    expect(await timings(left!)).toEqual(await timings(right!));
    expect(await timings(left!)).toHaveLength(2);
    expect((await timings(left!)).every((line) => /ET \d+\.\d{3} s/.test(line))).toBe(true);
    await expect(left!.getByTestId('online-screen').getByText(/^(4\.800|5\.100) CR$/)).toBeVisible();
    await expect(right!.getByTestId('online-screen').getByText(/^(4\.800|5\.100) CR$/)).toBeVisible();
    for (const [index, page] of [left!, right!].entries()) await page.screenshot({ path: test.info().outputPath(`resultado-${index + 1}.png`) });
  } finally { await Promise.allSettled(contexts.map((context) => context.close())); }
});
