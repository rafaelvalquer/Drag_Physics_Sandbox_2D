/**
 * Campaign (chapter 1 "Madrugada Zero") end to end, in the real app.
 *
 * One race is run through the visible path (tree, HUD, RaceController, DragAI) with the player's
 * lane on the advanced AI profile ("autopilot"); the rest of the chapter goes through
 * `debugSimulateRace`, which uses the same RaceController/DragAI/physics without rendering and
 * records through the same CareerController path. Screenshots go to `visual-captures/career/`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, errors, mode } from './helpers';

const OUT = `${process.env.VISUAL_DIR ?? 'visual-captures'}/career`;
mkdirSync(OUT, { recursive: true });

const EVENT_IDS = ['e1-primeira-noite', 'e2-pequeno-valente', 'e3-acerto-de-contas', 'e4-tracao-traseira', 'e5-respeita-o-ap', 'e6-o-aspirado', 'e7-rei-da-madrugada'];
const TRACK_EVENTS: [string, string][] = [
  ['distrito-industrial', 'e1-primeira-noite'],
  ['baixada', 'e3-acerto-de-contas'],
  ['avenida-norte', 'e5-respeita-o-ap'],
];

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function openCareer(page: Page): Promise<void> {
  await page.locator('button.tab[data-mode=career]').click();
  await expect(page.getByTestId('career-menu')).toBeVisible();
  await page.waitForFunction(() => {
    const m = (window as unknown as { __app: { debug: { current: { id: string; controller?: { save: unknown } } } } }).__app.debug.current;
    return m.id === 'career';
  });
}

/** Clicks through every pending dialogue line (stopping when the chapter's ending screen opens). */
async function readDialogue(page: Page, stopAtEnding = false): Promise<string[]> {
  const lines: string[] = [];
  for (let i = 0; i < 40 && (await page.getByTestId('dialogue-next').count()); i++) {
    lines.push((await page.getByTestId('dialogue-line').textContent()) ?? '');
    await page.getByTestId('dialogue-next').click();
    if (stopAtEnding && (await mode<string>(page, 'm.screen')) === 'ending') break;
  }
  return lines;
}

async function credits(page: Page): Promise<number> {
  return mode<number>(page, 'm.controller.save.credits');
}

test('campanha: escolha do carro, introdução, corrida visível, oficina, dinamômetro e capítulo completo', async ({ page }) => {
  test.setTimeout(900_000);
  await boot(page);
  await openCareer(page);
  await shot(page, '01-menu');

  // new career: the three starter cars, stock
  await page.getByTestId('career-new').click();
  await expect(page.getByTestId('career-choose')).toBeVisible();
  for (const id of ['vw-gol-gts-1988', 'gm-chevette-sl-1988', 'fiat-uno-mille-1995']) await expect(page.getByTestId(`starter-${id}`)).toBeVisible();
  await shot(page, '02-carros-iniciais');
  await page.getByTestId('choose-vw-gol-gts-1988').click();

  // introduction with Nina: manual advance, then never again
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await shot(page, '03-introducao-nina');
  const intro = await readDialogue(page);
  expect(intro.join(' ')).toContain('aprende a colocar essa potência no chão');
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  expect(await credits(page)).toBe(4500 - 2200);
  expect(await mode<string[]>(page, 'm.controller.save.seenStorySceneIds')).toContain('intro');
  await shot(page, '04-garagem');

  // the three night venues (overlay hidden to see the scene)
  for (const [track, ev] of TRACK_EVENTS) {
    await mode(page, `(m.selectedEvent = '${ev}', m.show('rival'))`);
    await page.evaluate(() => document.querySelector('[data-testid=career]')!.classList.add('hidden'));
    await expect.poll(() => mode<string>(page, 'm.track().id')).toBe(track);
    await page.waitForTimeout(700);
    await shot(page, `05-cenario-${track}`);
  }

  // the seven rival presentations (portrait, line, car of each rival)
  for (const [i, ev] of EVENT_IDS.entries()) {
    await mode(page, `(m.selectedEvent = '${ev}', m.show('rival'))`);
    await expect(page.getByTestId('rival-line')).toBeVisible();
    await shot(page, `06-rival-${i + 1}`);
  }

  // first event, raced through the visible path
  await mode(page, `m.show('events')`);
  await expect(page.getByTestId('event-e1-primeira-noite')).toHaveAttribute('data-status', 'available');
  await expect(page.getByTestId('event-e2-pequeno-valente')).toHaveAttribute('data-status', 'locked');
  await shot(page, '07-eventos');
  await page.getByTestId('event-e1-primeira-noite').click();
  await expect(page.getByTestId('rival-name')).toContainText('Lara');
  await mode(page, '(m.autopilot = true)');
  await page.getByTestId('rival-start').click();
  await expect.poll(() => mode<string>(page, 'm.screen')).toBe('race');
  await expect(page.getByTestId('race-status')).toContainText('Lara');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.x'), { timeout: 60_000 }).toBeGreaterThan(25);
  await shot(page, '08-corrida');
  await expect.poll(() => mode<string>(page, 'm.screen'), { timeout: 120_000 }).toBe('result');
  const first = await mode<{ outcome: string; credits: number }>(page, '({ outcome: m.lastRecord.result.outcome, credits: m.lastRecord.result.creditsAwarded })');
  await shot(page, '09-resultado-com-fala');
  await readDialogue(page);
  await expect(page.getByTestId('result-winner')).toBeVisible();
  await expect(page.getByTestId('nina-comments')).toBeVisible();
  await shot(page, '10-resultado');
  if (first.outcome !== 'win') {
    // a loss pays at most the consolation; win the first night through the same race path
    expect(first.credits).toBeLessThanOrEqual(100);
    for (let k = 0; k < 6 && !(await mode<boolean>(page, `m.controller.save.completedEventIds.includes('e1-primeira-noite')`)); k++) {
      await mode(page, `m.debugSimulateRace('e1-primeira-noite')`);
      await readDialogue(page);
    }
  } else {
    expect(first.credits).toBe(300);
  }
  expect(await mode<string[]>(page, 'm.controller.save.completedEventIds')).toContain('e1-primeira-noite');

  // the same attempt recorded twice pays once (double click / reload)
  const again = await mode<{ applied: boolean; credits: number }>(
    page,
    `m.controller.recordRace({ ...m.lastRecord.result, creditsAwarded: undefined, reputationAwarded: undefined }).then(r => ({ applied: r.value.applied, credits: m.controller.save.credits }))`,
  );
  expect(again.applied).toBe(false);
  expect(again.credits).toBe(await credits(page));

  // workshop: three panels, before/after with simulated estimates, atomic purchase
  await mode(page, `m.show('garage')`);
  await page.getByTestId('garage-workshop').click();
  await readDialogue(page);
  await expect(page.getByTestId('career-workshop')).toBeVisible();
  await page.getByTestId('ws-tab-exhaust').click();
  await page.getByTestId('ws-part-exhaust-sport').click();
  await expect(page.getByTestId('ws-compare')).toContainText('402 m (estimativa)');
  await expect(page.getByTestId('ws-compare')).not.toContainText('…', { timeout: 30_000 });
  // change markers: the freer exhaust raises power (green ▲) and nothing it changes gets worse
  const powerRow = page.getByTestId('ws-compare').locator('tr', { hasText: 'Potência' });
  await expect(powerRow.getByTestId('delta-up')).toBeVisible();
  await expect(page.getByTestId('ws-compare').getByTestId('delta-down')).toHaveCount(0);
  // the shop text and the physical effect are two different texts
  const texts = await page.getByTestId('ws-detail').locator('p').allTextContents();
  expect(texts[0]).not.toBe(texts[1]!.replace(/^Efeito físico:\s*/, ''));
  await expect(page.getByTestId('ws-pill-exhaust-sport')).toHaveText('450 CR');
  const before = await credits(page);
  await page.getByTestId('ws-buy').click();
  await expect(page.getByTestId('ws-remove')).toBeVisible();
  expect(await credits(page)).toBe(before - 450);
  expect(await mode<string[]>(page, 'm.controller.activeCar.installedParts')).toContain('exhaust-sport');

  // state pill follows the save: in use → bought (removed to the stock) → in use again
  const pill = page.getByTestId('ws-pill-exhaust-sport');
  await expect(pill).toHaveText('Em uso');
  await expect(page.getByTestId('ws-part-exhaust-sport')).toHaveAttribute('data-state', 'installed');
  await page.getByTestId('ws-remove').click();
  await expect(pill).toHaveText('Comprada');
  expect(await credits(page)).toBe(before - 450);
  await page.getByTestId('ws-install').click();
  await expect(pill).toHaveText('Em uso');
  expect(await credits(page)).toBe(before - 450);
  await page.getByTestId('ws-tab-intake').click();
  await expect(page.getByTestId('ws-pill-filter-sport')).toHaveText('250 CR');
  await expect(page.getByTestId('ws-pill-manifold-sport')).toContainText('Noite 2');
  await shot(page, '11b-oficina-admissao');
  await page.getByTestId('ws-tab-exhaust').click();
  await shot(page, '11-oficina');

  // factory part of the slot: free, always available; going back keeps the bought part in stock
  const stockPill = page.getByTestId('ws-stock-pill-exhaust');
  await expect(stockPill).toHaveText('Original');
  await page.getByTestId('ws-stock-exhaust').click();
  await expect(page.getByTestId('ws-detail')).toContainText('Grátis');
  await page.getByTestId('ws-install-stock').click();
  await expect(stockPill).toHaveText('Em uso');
  await expect(pill).toHaveText('Comprada');
  expect(await credits(page)).toBe(before - 450);
  expect(await mode<string[]>(page, 'm.controller.activeCar.installedParts')).toEqual([]);
  expect(await mode<string[]>(page, 'm.controller.save.inventoryPartIds')).toEqual(['exhaust-sport@vw-gol-gts-1988']);
  await shot(page, '11c-oficina-original');
  // the choice survives in the save and the part goes back on without paying
  await page.getByTestId('ws-part-exhaust-sport').click();
  await page.getByTestId('ws-install').click();
  await expect(pill).toHaveText('Em uso');
  await expect(stockPill).toHaveText('Original');
  // restore everything to factory (confirmation dialog), then reinstall
  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('ws-restore-all').click();
  await expect(stockPill).toHaveText('Em uso');
  await expect(page.getByTestId('ws-restore-all')).toHaveCount(0);
  expect(await mode<string[]>(page, 'm.controller.activeCar.installedParts')).toEqual([]);
  await page.getByTestId('ws-part-exhaust-sport').click();
  await page.getByTestId('ws-install').click();
  await expect(pill).toHaveText('Em uso');
  expect(await credits(page)).toBe(before - 450);

  // campaign dyno: measures the build that is on the car
  await page.getByTestId('ws-dyno').click();
  await expect(page.getByTestId('career-dyno-info')).toHaveAttribute('data-done', '1', { timeout: 60_000 });
  await expect(page.getByTestId('career-dyno-info')).toContainText('cv');
  await shot(page, '12-dinamometro');

  // the rest of the chapter: buy parts as they unlock, race the next night, repeat when lost
  const priority = ['tires-sport', 'filter-sport', 'manifold-sport', 'cam-sport', 'clutch-reinforced', 'tires-semislick', 'turbo-basic'];
  let races = 0;
  for (; races < 60; races++) {
    const done = await mode<string[]>(page, 'm.controller.save.completedEventIds');
    if (done.length === EVENT_IDS.length) break;
    await mode(
      page,
      `(async () => { for (const id of ${JSON.stringify(priority)}) { const c = m.controller.activeCar; if (c.installedParts.includes(id)) continue; const r = await m.controller.buyPart(id); if (!r.ok && /saldo|créditos/i.test(r.error)) break; } })()`,
    );
    const next = EVENT_IDS.find((id) => !done.includes(id))!;
    if (next === 'e7-rei-da-madrugada' && !(await mode<boolean>(page, `m.screen === 'ending'`))) {
      // final challenge scene plays once before the race
      await mode(page, `(m.selectedEvent = '${next}', m.show('rival'))`);
      await shot(page, '13-desafio-final');
    }
    await mode(page, `m.debugSimulateRace('${next}')`);
    await readDialogue(page, true);
  }
  expect(await mode<string | null>(page, 'm.controller.save.chapterCompletedAt')).not.toBeNull();
  test.info().annotations.push({ type: 'career', description: `capítulo concluído com o Gol em ${races + 1} corridas no total` });

  // ending: completion scene, then the summary
  await expect.poll(() => mode<string>(page, 'm.screen')).toBe('ending');
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await shot(page, '14-final-cena');
  const outro = await readDialogue(page);
  expect(outro.length).toBeGreaterThan(0);
  await expect(page.getByTestId('ending-title')).toHaveText('Rei da Madrugada');
  // the loser of the final handed the car over: Marcos' Saveiro, with his parts, in the garage
  expect(await mode<boolean>(page, `m.controller.save.ownedCars.some((c) => c.prizeEventId === 'e7-rei-da-madrugada' && c.baseCarId === 'vw-saveiro-gl-1994' && c.installedParts.includes('turbo-basic'))`)).toBe(true);
  await expect(page.locator('.enx')).toContainText('Saveiro do Marcos');
  await shot(page, '15-final');
  const s = await mode<{ rep: number; credits: number; results: number }>(page, '({ rep: m.controller.save.reputation, credits: m.controller.save.credits, results: m.controller.save.results.length })');
  expect(s.rep).toBeLessThanOrEqual(250);
  expect(s.credits).toBeGreaterThanOrEqual(0);

  // history and the other modes still work
  await mode(page, `m.show('history')`);
  await expect(page.getByTestId('career-history-screen')).toBeVisible();
  await shot(page, '16-historico');
  await page.locator('button.tab[data-mode=race]').click();
  await expect.poll(() => mode<string>(page, 'm.id')).toBe('race');
  await page.locator('button.tab[data-mode=sandbox]').click();
  await expect.poll(() => mode<string>(page, 'm.id')).toBe('sandbox');
});

test('campanha: salvar e continuar, segunda aba só leitura, exportar', async ({ page, context }) => {
  test.setTimeout(240_000);
  await boot(page, false);
  await openCareer(page);
  await page.getByTestId('career-new').click();
  await page.getByTestId('choose-gm-chevette-sl-1988').click();
  await expect(page.getByTestId('career-dialogue')).toBeVisible();
  await readDialogue(page);
  await expect(page.getByTestId('career-garage-screen')).toBeVisible();
  expect(await credits(page)).toBe(4500 - 1400);

  // a second tab on the same career opens read-only
  const other = await context.newPage();
  await other.goto('/');
  await other.waitForFunction(() => !!(window as unknown as { __app?: { debug: { current: unknown } } }).__app?.debug.current);
  await other.evaluate(() => document.querySelector('.audio-gate')?.remove());
  await other.locator('button.tab[data-mode=career]').click();
  await expect(other.getByTestId('career-warning')).toContainText('outra aba');
  await shot(other, '17-segunda-aba');
  await other.close();

  // reload: the career is still there, on the Chevette
  await page.reload();
  await page.evaluate(() => document.querySelector('.audio-gate')?.remove());
  await openCareer(page);
  await page.getByTestId('career-continue').click();
  await expect(page.getByTestId('garage-car-name')).toContainText('Chevette');

  // versioned JSON export
  await mode(page, `m.show('menu')`);
  const download = page.waitForEvent('download');
  await page.getByTestId('career-export').click();
  const file = await (await download).path();
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { format: string; save: { ownedCars: { baseCarId: string }[]; version: number } };
  expect(doc.format).toBe('drag-physics-sandbox-2d/career');
  expect(doc.save.version).toBe(5); // v5 preserves both histories and stores the continuous nitrous tune
  expect(doc.save.ownedCars[0]!.baseCarId).toBe('gm-chevette-sl-1988');
});
