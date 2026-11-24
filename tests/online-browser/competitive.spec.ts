import { expect, test, type Page } from '@playwright/test';
import type { OnlineRaceSnapshot } from '../../src/game/online/contracts';

async function login(page: Page, account: number): Promise<void> {
  await page.route('**/auth/v1/authorize?**', (route) => route.continue({
    headers: { ...route.request().headers(), 'x-fixture-account': String(account) },
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Ativar som e começar' }).click();
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
    __app: { debug: { current: { renderer?: { newest?: OnlineRaceSnapshot; loading: { lane: 0 | 1 } } } } };
  }).__app.debug.current;
  return renderer && { newest: renderer.newest, lane: renderer.loading.lane };
});

async function drive(page: Page): Promise<void> {
  await expect.poll(async () => {
    const renderer = await currentSnapshot(page);
    return renderer?.newest?.lights.green[renderer.lane] ?? false;
  }, { timeout: 20_000 }).toBe(true);
  await page.keyboard.down('w');
  await page.keyboard.press('e');
  try {
    for (;;) {
      const renderer = await currentSnapshot(page);
      const lane = renderer && renderer.newest?.lanes[renderer.lane];
      if (!lane || lane.result.finished || lane.result.dnf) return;
      await page.waitForTimeout(130);
      if (lane.rpm >= 5_750 && !lane.shifting) await page.keyboard.press('e');
    }
  } finally { await page.keyboard.up('w'); }
}

test('duas sessões de navegador completam PKCE, garagem e corrida 1v1', async ({ browser, baseURL }) => {
  const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })]);
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
    await Promise.all([drive(left!), drive(right!)]);
    for (const page of [left!, right!]) await expect(page.getByRole('button', { name: 'Buscar nova partida' })).toBeVisible({ timeout: 45_000 });
    const timings = (page: Page) => page.getByTestId('online-screen').getByText(/Reação .* ET .* Total/).allTextContents();
    expect(await timings(left!)).toEqual(await timings(right!));
    expect(await timings(left!)).toHaveLength(2);
    expect((await timings(left!)).every((line) => /ET \d+\.\d{3} s/.test(line))).toBe(true);
    await expect(left!.getByTestId('online-screen').getByText(/^(4\.800|5\.100) CR$/)).toBeVisible();
    await expect(right!.getByTestId('online-screen').getByText(/^(4\.800|5\.100) CR$/)).toBeVisible();
    for (const [index, page] of [left!, right!].entries()) await page.screenshot({ path: test.info().outputPath(`resultado-${index + 1}.png`) });
  } finally { await Promise.allSettled(contexts.map((context) => context.close())); }
});
