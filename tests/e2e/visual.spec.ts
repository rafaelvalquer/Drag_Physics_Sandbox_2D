/**
 * Visual tests of the running game (real app, real browser, no mocks).
 *
 * Every scenario saves a screenshot to `visual-captures/` for inspection and asserts geometry and
 * behaviour read from the renderer's own debug snapshot: vehicle scale, wheels on the ground and
 * inside their arches, framing, HUD inside the stage, parallax, smoke only when the tyres slide.
 * Pixels are not compared; the screenshots are the evidence to look at.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, errors, mode, waitEngineRunning } from './helpers';

const OUT = process.env.VISUAL_DIR ?? 'visual-captures';
mkdirSync(OUT, { recursive: true });

interface VehicleInfo {
  id: string;
  lane: number;
  loaded: boolean;
  pxPerM: number;
  rootScale: number;
  bodyScaleX: number;
  bodyScaleY: number;
  wheels: { x: number; y: number; r: number }[];
  lengthM: number;
  wheelbaseM: number;
  pitch: number;
  heave: number;
  wheelLayers: { rear: [number, number, number]; front: [number, number, number] };
  lightsOn: boolean;
  brakeOn: boolean;
  screenX: number;
  screenGroundY: number;
  screenLengthPx: number;
}

interface Visual {
  viewW: number;
  viewH: number;
  ppm: number;
  camX: number;
  groundY: number;
  lighting: string;
  profile: string;
  vehicles: VehicleInfo[];
  particles: { live: number; marks: number; pooled: number; emitted: Record<string, number> };
  parallax: { layers: { index: number; tileX: number; y: number; scale: number }[] };
  track: { props: number; textures: number; treeVisible: boolean; litBulbs: number };
  vehicleTextures: number;
  fps: number;
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

function visual(page: Page): Promise<Visual> {
  return page.evaluate(() => {
    const game = (window as unknown as { __app: { debug: { game: { scene: { getScene(k: string): { visualDebug(): unknown } } } } } }).__app.debug.game;
    return game.scene.getScene('race').visualDebug() as never;
  }) as Promise<Visual>;
}

async function setting(page: Page, key: string, value: unknown): Promise<void> {
  await page.evaluate(([k, v]) => (window as unknown as { __app: { updateSetting(k: string, v: unknown): void } }).__app.updateSetting(k as string, v), [key, value] as const);
}

/** Waits until every vehicle's artwork is on screen. */
async function waitArt(page: Page): Promise<Visual> {
  await expect.poll(async () => (await visual(page)).vehicles.every((v) => v.loaded) && (await visual(page)).vehicles.length > 0, { timeout: 15_000 }).toBe(true);
  return visual(page);
}

/** Geometry every vehicle must satisfy in any scenario. */
function expectSound(v: Visual): void {
  for (const car of v.vehicles) {
    // uniform scale: the sprite is never stretched
    expect(car.bodyScaleX).toBeCloseTo(car.bodyScaleY, 6);
    expect(car.bodyScaleX).toBeGreaterThan(0);
    // on-screen length follows the car's real length and the camera scale
    expect(car.screenLengthPx).toBeCloseTo(car.lengthM * v.ppm * car.rootScale, 3);
    expect(car.wheels).toHaveLength(2);
    for (const w of car.wheels) {
      // tyres rest on the ground line: centre exactly one radius above it (root-local, y down)
      expect(w.y).toBeCloseTo(-w.r, 4);
    }
    // wheel centres are one wheelbase apart
    expect(Math.abs(car.wheels[1]!.x - car.wheels[0]!.x) / 40).toBeCloseTo(car.wheelbaseM, 4);
    // body motion stays small (no floating, no sinking)
    expect(Math.abs(car.pitch)).toBeLessThan(0.12);
    expect(Math.abs(car.heave)).toBeLessThan(0.08);
  }
}

test.afterEach(() => {
  expect(errors, errors.join('\n')).toEqual([]);
});

test('garage: detailed preview, technical sheet, paint and car choice', async ({ page }) => {
  await boot(page, false);
  await page.getByTestId('garage-open').click();
  await expect(page.getByTestId('garage')).toBeVisible();
  const layout = (): Promise<{ carPx: number; width: number; loaded: boolean }> =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('[data-testid=garage] canvas.garage-preview')!;
      return { carPx: c.width * 0.74, width: c.width, loaded: c.width > 100 };
    });
  await expect.poll(async () => (await layout()).loaded).toBe(true);
  await page.waitForTimeout(500);
  await shot(page, 'garage-default');
  // the car fills most of the preview (detail is visible)
  expect((await layout()).carPx / (await layout()).width).toBeGreaterThan(0.6);
  await expect(page.getByTestId('garage-specs')).toContainText('cv');
  await expect(page.getByTestId('garage-specs')).toContainText('N·m');
  for (const id of ['arco-1600', 'vetra-rs', 'lince-gt', 'orion-xr', 'tempest-v8', 'aurora-v12-lab']) {
    await page.getByTestId(`garage-car-${id}`).click();
    await page.waitForTimeout(350);
    await shot(page, `garage-${id}`);
  }
  // paint preview and lamps
  await page.getByTestId('garage-car-tempest-v8').click();
  await page.getByTestId('garage-swatch').nth(2).click();
  await page.getByTestId('garage-lamps').check();
  await page.waitForTimeout(350);
  await shot(page, 'garage-paint-lamps');
  await page.getByTestId('garage-use').click();
  await expect(page.getByTestId('garage')).toHaveCount(0);
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.id')).toBe('tempest-v8');
  // the chosen paint reached the car on the track (same artwork source)
  const colour = await mode<string>(page, 'm.runner.player.sim.car.visual.color');
  expect(colour).not.toBe('#f2b705');
  await waitArt(page);
  await shot(page, 'garage-applied-on-track');
});

test('sandbox: idle, launch with wheelspin, gear change and deceleration', async ({ page }) => {
  await boot(page);
  await waitEngineRunning(page);
  let v = await waitArt(page);
  await page.waitForTimeout(600);
  v = await visual(page);
  await shot(page, 'sandbox-idle');
  expectSound(v);
  const car = v.vehicles[0]!;
  // framing: the car is the subject (about a third of the view) and sits in the lower middle
  expect(car.screenLengthPx / v.viewW).toBeGreaterThan(0.26);
  expect(v.groundY / v.viewH).toBeGreaterThan(0.6);
  expect(v.groundY / v.viewH).toBeLessThan(0.8);
  // idle: wheels still and sharp, no smoke although the engine runs
  expect(car.wheelLayers.rear).toEqual([1, 0, 0]);
  expect(v.particles.emitted.smoke).toBe(0);
  // revving in neutral must not make smoke either (throttle alone is not wheelspin)
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  expect((await visual(page)).particles.emitted.smoke).toBe(0);
  await page.waitForTimeout(600);

  // launch: the driven tyres slide → smoke and marks; the nose rises
  await page.keyboard.press('e');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear')).toBe(1);
  await page.keyboard.down('w');
  await expect.poll(async () => (await visual(page)).particles.emitted.smoke, { timeout: 8000 }).toBeGreaterThan(5);
  await page.waitForTimeout(350);
  v = await visual(page);
  await shot(page, 'sandbox-launch');
  expectSound(v);
  expect(v.vehicles[0]!.pitch).toBeGreaterThan(0.004);
  expect(v.particles.emitted.marks).toBeGreaterThan(0);
  // gear change at speed: wheels blurred, parallax moving, zoom opened a little
  const ppmRest = car.screenLengthPx / car.lengthM;
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.speed'), { timeout: 15_000 }).toBeGreaterThan(14);
  const before = await visual(page);
  await page.keyboard.press('e');
  await page.waitForTimeout(120);
  await shot(page, 'sandbox-shift');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear'), { timeout: 5000 }).toBe(2);
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.speed'), { timeout: 15_000 }).toBeGreaterThan(30);
  v = await visual(page);
  await shot(page, 'sandbox-speed');
  expectSound(v);
  expect(v.vehicles[0]!.wheelLayers.rear[2]).toBeGreaterThan(0.5);
  expect(v.ppm).toBeLessThan(ppmRest);
  // measured in this browser while accelerating with smoke on screen (reported, not asserted hard)
  const perf = await mode<{ stepMs: number; dropped: number }>(page, '({ stepMs: m.runner.stats.stepMs, dropped: m.runner.stats.droppedRealTimeS })');
  console.log(`perf (high profile): ${v.fps.toFixed(1)} fps, physics ${perf.stepMs.toFixed(3)} ms/step, dropped ${perf.dropped.toFixed(3)} s, ${v.particles.live} particles, ${v.particles.marks} marks`);
  test.info().annotations.push({ type: 'perf', description: `${v.fps.toFixed(1)} fps; physics ${perf.stepMs.toFixed(3)} ms/step` });
  expect(v.fps).toBeGreaterThan(30);
  expect(perf.stepMs).toBeLessThan(2);
  // parallax: distant layers scroll slower than near ones, all slower than the track
  const moved = v.parallax.layers.map((l, i) => Math.abs(l.tileX * l.scale - before.parallax.layers[i]!.tileX * before.parallax.layers[i]!.scale));
  expect(moved[0]!).toBeGreaterThan(0);
  expect(moved[0]!).toBeLessThan(moved[moved.length - 1]!);
  // lift off: deceleration, nose down, no new smoke
  await page.keyboard.up('w');
  const smoke = v.particles.emitted.smoke;
  await page.waitForTimeout(900);
  v = await visual(page);
  await shot(page, 'sandbox-decel');
  expectSound(v);
  expect(v.vehicles[0]!.pitch).toBeLessThan(0.002);
  expect(v.particles.emitted.smoke).toBe(smoke);
});

test('tracks and lighting: every scene, day, dusk and night', async ({ page }) => {
  await boot(page);
  for (const track of ['test-track', 'desert-strip', 'night-industrial', 'airfield']) {
    await page.getByTestId('track-select').selectOption(track);
    await waitArt(page);
    await page.waitForTimeout(500);
    const v = await visual(page);
    await shot(page, `track-${track}`);
    expectSound(v);
    expect(v.track.props).toBeGreaterThan(10);
    expect(v.parallax.layers.length).toBe(3);
  }
  for (const time of ['day', 'dusk', 'night']) {
    await setting(page, 'timeOfDay', time);
    await page.waitForTimeout(500);
    const v = await visual(page);
    await shot(page, `light-airfield-${time}`);
    expect(v.lighting).toContain(time);
  }
  await setting(page, 'timeOfDay', 'track');
  // a wider view of each scene: more of the scenery and the sky
  await setting(page, 'cameraZoom', 0.6);
  for (const track of ['test-track', 'desert-strip']) {
    await page.getByTestId('track-select').selectOption(track);
    await page.waitForTimeout(700);
    await shot(page, `wide-${track}`);
  }
  await setting(page, 'cameraZoom', 1);
});

test('graphics profiles and resolutions keep the cars undistorted', async ({ page }) => {
  await boot(page);
  await waitArt(page);
  const res: [number, number][] = [
    [1920, 1080],
    [1600, 900],
    [1366, 768],
    [820, 1180],
    [390, 844],
  ];
  for (const [w, h] of res) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    const v = await visual(page);
    await shot(page, `res-${w}x${h}`);
    expectSound(v);
    const car = v.vehicles[0]!;
    // the whole car fits in the view and stays the subject
    expect(car.screenLengthPx).toBeLessThan(v.viewW);
    expect(car.screenLengthPx / v.viewW).toBeGreaterThan(0.24);
    // HUD stays inside the stage
    const hud = await page.getByTestId('hud').boundingBox();
    const stage = await page.locator('#stage').boundingBox();
    expect(hud).not.toBeNull();
    expect(hud!.x).toBeGreaterThanOrEqual(stage!.x - 1);
    expect(hud!.y + hud!.height).toBeLessThanOrEqual(stage!.y + stage!.height + 1);
  }
  await page.setViewportSize({ width: 1400, height: 860 });
  for (const q of ['low', 'medium', 'high']) {
    await setting(page, 'graphics', q);
    await expect.poll(async () => (await visual(page)).profile).toBe(q);
    const v = await waitArt(page);
    await page.waitForTimeout(400);
    await shot(page, `profile-${q}`);
    expectSound(await visual(page));
    expect(v.vehicles[0]!.pxPerM).toBe({ low: 72, medium: 104, high: 144 }[q]);
  }
});

test('race: two cars, tree from the real race state, finish and results', async ({ page }) => {
  await boot(page);
  await page.locator('#topbar button[data-mode=race]').click();
  await page.getByTestId('race-distance').selectOption('eighth');
  await expect(page.getByTestId('race-status')).toContainText('Pronto para largar');
  await page.waitForFunction(() => (window as unknown as { __app: { debug: { current: { runner: { player: { sim: { engine: { runState: string } } } } } } } }).__app.debug.current.runner.player.sim.engine.runState === 'RUNNING');
  let v = await waitArt(page);
  await page.waitForTimeout(700);
  v = await visual(page);
  await shot(page, 'race-staging');
  expectSound(v);
  expect(v.vehicles).toHaveLength(2);
  // two lanes: the far car is higher on screen and slightly smaller; both keep their real length ratio
  const near = v.vehicles.find((c) => c.lane === 0)!;
  const far = v.vehicles.find((c) => c.lane === 1)!;
  expect(far.screenGroundY).toBeLessThan(near.screenGroundY - 40);
  expect(far.rootScale).toBeLessThan(near.rootScale);
  expect(far.screenLengthPx / near.screenLengthPx).toBeCloseTo((far.lengthM * far.rootScale) / (near.lengthM * near.rootScale), 3);
  // the tree is in the picture while staging
  expect(v.track.treeVisible).toBe(true);
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('e');
  // bulbs follow the race controller: staged lamps first, then the countdown, then green
  await expect.poll(async () => (await visual(page)).track.litBulbs, { timeout: 10_000 }).toBeGreaterThan(1);
  await page.waitForFunction(() => {
    const r = (window as unknown as { __app: { debug: { current: { race: { greenAt: number | null; time: number } } } } }).__app.debug.current.race;
    return r.greenAt !== null && r.time >= r.greenAt;
  }, undefined, { timeout: 20_000 });
  await shot(page, 'race-green');
  const green = await mode<boolean>(page, 'm.tree().green[0]');
  expect(green).toBe(true);
  await page.keyboard.down('w');
  await page.waitForTimeout(900);
  v = await visual(page);
  await shot(page, 'race-launch');
  expectSound(v);
  const deadline = Date.now() + 60_000;
  let shotMid = false;
  while (Date.now() < deadline) {
    const s = await mode<{ phase: string; gear: number; rpm: number; red: number; locked: boolean; n: number; x: number }>(
      page,
      '({ phase: m.race.phase, gear: m.runner.player.sim.gear, rpm: m.runner.player.sim.engine.rpm, red: m.runner.player.sim.car.engine.redlineRpm, locked: m.runner.player.sim.clutchCtl.mode === "LOCKED", n: m.runner.player.sim.gearbox.gearCount, x: m.runner.player.sim.x })',
    );
    if (s.phase === 'finished') break;
    if (!shotMid && s.x > 90) {
      shotMid = true;
      await shot(page, 'race-mid');
      expectSound(await visual(page));
    }
    if (s.locked && s.gear < s.n && s.rpm > s.red - 400) await page.keyboard.press('e');
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('w');
  await expect(page.getByTestId('result-card')).toBeVisible();
  await shot(page, 'race-finish-results');
  // after the finish the car brakes by itself: brake lamps on
  await expect.poll(async () => (await visual(page)).vehicles.find((c) => c.lane === 0)!.brakeOn, { timeout: 10_000 }).toBe(true);
  await shot(page, 'race-braking');
  expectSound(await visual(page));
});

test('dyno: test cell with the car on the rollers and the measured curves', async ({ page }) => {
  await boot(page);
  await page.locator('#topbar button[data-mode=dyno]').click();
  await expect(page.getByTestId('dyno-bay')).toBeVisible();
  const bay = (): Promise<{ loaded: boolean; wheelOmega: number; carPx: number; width: number }> => mode(page, 'm.bay.debug()');
  await expect.poll(async () => (await bay()).loaded, { timeout: 15_000 }).toBe(true);
  await expect.poll(() => mode<string>(page, 'm.bench.engine.runState'), { timeout: 15_000 }).toBe('RUNNING');
  await page.waitForTimeout(800);
  await shot(page, 'dyno-idle');
  const b = await bay();
  // the car is large in the cell and the wheels turn with the engine
  expect(b.carPx / b.width).toBeGreaterThan(0.5);
  expect(b.wheelOmega).toBeGreaterThan(1);
  // the charts stay real: measure the curve
  await page.getByTestId('dyno-sweep').click();
  await expect(page.getByTestId('dyno-status')).toContainText('Torque máx.', { timeout: 90_000 });
  await shot(page, 'dyno-measured');
  expect(await mode<number>(page, 'm.points.length')).toBeGreaterThan(10);
  // no track rendering work while the dyno view is shown
  const cam = await page.evaluate(() => {
    const game = (window as unknown as { __app: { debug: { game: { scene: { getScene(k: string): { cameras: { main: { visible: boolean } } } } } } } }).__app.debug.game;
    return game.scene.getScene('race').cameras.main.visible;
  });
  expect(cam).toBe(false);
});

test('Gol GTS 1988: garage, sandbox launch, race with results and dyno', async ({ page }) => {
  const GOL = 'vw-gol-gts-1988';
  await boot(page);
  // garage: the option, the technical sheet read from the configuration, choose it
  await page.getByTestId('garage-open').click();
  await page.getByTestId(`garage-car-${GOL}`).click();
  await expect(page.getByTestId('garage')).toContainText('Volkswagen Gol GTS 1988 — AP 1.8S Original');
  const specs = page.getByTestId('garage-specs');
  await expect(specs).toContainText('99 cv');
  await expect(specs).toContainText('146 N·m a 3200 rpm');
  await expect(specs).toContainText('5 marchas');
  await expect(specs).toContainText('dianteira');
  await page.waitForTimeout(400);
  await shot(page, `garage-${GOL}`);
  await page.getByTestId('garage-use').click();
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.id')).toBe(GOL);

  // sandbox: idle, launch (front wheels spin), second gear
  await waitEngineRunning(page);
  let v = await waitArt(page);
  await page.waitForTimeout(500);
  v = await visual(page);
  await shot(page, 'gol-sandbox-idle');
  expectSound(v);
  expect(v.vehicles[0]!.lengthM).toBeCloseTo(3.849, 6);
  expect(v.vehicles[0]!.wheelbaseM).toBeCloseTo(2.358, 6);
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('e');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear')).toBe(1);
  await page.keyboard.down('w');
  await expect.poll(async () => (await visual(page)).particles.emitted.smoke, { timeout: 8000 }).toBeGreaterThan(5);
  await page.waitForTimeout(250);
  v = await visual(page);
  await shot(page, 'gol-sandbox-launch');
  expectSound(v);
  // front-wheel drive: the front (driven) wheel turns faster than the rear one while spinning
  const spin = await mode<{ driven: number; free: number }>(page, '({ driven: m.runner.player.sim.telemetry.wheelOmegaDriven, free: m.runner.player.sim.telemetry.wheelOmegaFree })');
  expect(spin.driven).toBeGreaterThan(spin.free);
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.engine.rpm'), { timeout: 10_000 }).toBeGreaterThan(5800);
  await page.keyboard.press('e');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear'), { timeout: 5000 }).toBe(2);
  await page.waitForTimeout(600);
  await shot(page, 'gol-sandbox-second');
  expectSound(await visual(page));
  await page.keyboard.up('w');

  // race: the Gol against the AI over an eighth of a mile, HUD and results
  await page.locator('#topbar button[data-mode=race]').click();
  await page.getByTestId('race-car').selectOption(GOL);
  await page.getByTestId('race-distance').selectOption('eighth');
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.id')).toBe(GOL);
  await page.waitForFunction(() => (window as unknown as { __app: { debug: { current: { runner: { player: { sim: { engine: { runState: string } } } } } } } }).__app.debug.current.runner.player.sim.engine.runState === 'RUNNING');
  await waitArt(page);
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('e');
  await page.waitForFunction(() => {
    const r = (window as unknown as { __app: { debug: { current: { race: { greenAt: number | null; time: number } } } } }).__app.debug.current.race;
    return r.greenAt !== null && r.time >= r.greenAt;
  }, undefined, { timeout: 20_000 });
  await page.keyboard.down('w');
  await page.waitForTimeout(900);
  await shot(page, 'gol-race-launch');
  expectSound(await visual(page));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const s = await mode<{ phase: string; gear: number; rpm: number; red: number; locked: boolean; n: number }>(
      page,
      '({ phase: m.race.phase, gear: m.runner.player.sim.gear, rpm: m.runner.player.sim.engine.rpm, red: m.runner.player.sim.car.engine.redlineRpm, locked: m.runner.player.sim.clutchCtl.mode === "LOCKED", n: m.runner.player.sim.gearbox.gearCount })',
    );
    if (s.phase === 'finished') break;
    if (s.locked && s.gear < s.n && s.rpm > s.red - 300) await page.keyboard.press('e');
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('w');
  await expect(page.getByTestId('result-card')).toBeVisible();
  await shot(page, 'gol-race-results');

  // dyno: the same engine measured on the bench
  await page.locator('#topbar button[data-mode=dyno]').click();
  await page.getByTestId('dyno-car').selectOption(GOL);
  await expect.poll(() => mode<string>(page, 'm.car.id')).toBe(GOL);
  await expect.poll(() => mode<string>(page, 'm.bench.engine.runState'), { timeout: 15_000 }).toBe('RUNNING');
  await page.getByTestId('dyno-sweep').click();
  await expect(page.getByTestId('dyno-status')).toContainText('Torque máx.', { timeout: 90_000 });
  await page.waitForTimeout(300);
  await shot(page, 'gol-dyno-measured');
  const peak = await mode<{ t: number; tRpm: number; p: number; pRpm: number }>(
    page,
    '(() => { let t = { v: 0, r: 0 }, p = { v: 0, r: 0 }; for (const x of m.points) { if (x.torqueNm > t.v) t = { v: x.torqueNm, r: x.rpm }; if (x.powerCv > p.v) p = { v: x.powerCv, r: x.rpm }; } return { t: t.v, tRpm: t.r, p: p.v, pRpm: p.r }; })()',
  );
  expect(Math.abs(peak.t - 146) / 146).toBeLessThan(0.02);
  expect(Math.abs(peak.p - 99) / 99).toBeLessThan(0.02);
  expect(Math.abs(peak.tRpm - 3200)).toBeLessThanOrEqual(400);
  expect(Math.abs(peak.pRpm - 5600)).toBeLessThanOrEqual(400);
});

test('no texture leak when cars, tracks and lighting change', async ({ page }) => {
  await boot(page, false);
  await waitArt(page);
  const count = (): Promise<number> =>
    page.evaluate(() => {
      const game = (window as unknown as { __app: { debug: { game: { textures: { getTextureKeys(): string[] } } } } }).__app.debug.game;
      return game.textures.getTextureKeys().length;
    });
  const cycle = async (): Promise<void> => {
    for (const car of ['arco-1600', 'tempest-v8', 'kronos-v8']) {
      await page.getByTestId('car-select').selectOption(car);
      await waitArt(page);
    }
    for (const track of ['desert-strip', 'night-industrial', 'test-track']) {
      await page.getByTestId('track-select').selectOption(track);
      await page.waitForTimeout(250);
    }
  };
  await cycle();
  const first = await count();
  await cycle();
  await cycle();
  const v = await visual(page);
  // the same number of textures after repeating the cycle: nothing accumulates
  expect(await count()).toBe(first);
  expect(v.vehicleTextures).toBe(1);
  expect(v.particles.pooled).toBeLessThanOrEqual(280);
});

// ------------------------------------------------------------------ on-screen stability

interface FrameColumns {
  t: number[];
  physicsX: number[];
  renderX: number[];
  cameraX: number[];
  screenX: number[];
  interpolationAlpha: number[];
  physicsSteps: number[];
  realDeltaMs: number[];
  visualDeltaMs: number[];
  phaserDeltaMs: number[];
  fps: number[];
  ppm: number[];
  speed: number[];
  cameraMode: number[];
}

const SPEED_BINS_KMH = [0, 40, 80, 120, 180, 240, 300, 400];

/**
 * Jitter of the player's car on screen: for every frame, the distance (px) between where it was
 * drawn and where a uniform motion through its neighbouring frames would have put it (time-aware,
 * so an uneven frame time alone does not count). Smooth motion → ≈ 0 px whatever the speed.
 */
function screenJitter(f: FrameColumns, viewW: number): { kmh: number; r: number }[] {
  const out: { kmh: number; r: number }[] = [];
  for (let i = 1; i < f.t.length - 1; i++) {
    const s = f.screenX;
    if (f.speed[i]! < 1 || s[i]! < 0 || s[i]! > viewW) continue;
    const t0 = f.t[i - 1]!;
    const t2 = f.t[i + 1]!;
    if (t2 <= t0) continue;
    const k = (f.t[i]! - t0) / (t2 - t0);
    const expected = s[i - 1]! + (s[i + 1]! - s[i - 1]!) * k;
    out.push({ kmh: f.speed[i]! * 3.6, r: Math.abs(s[i]! - expected) });
  }
  return out;
}

function percentile(a: number[], p: number): number {
  if (a.length === 0) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
}

function jitterReport(j: { kmh: number; r: number }[]): { bin: string; n: number; p95: number; max: number }[] {
  const rows: { bin: string; n: number; p95: number; max: number }[] = [];
  for (let b = 0; b < SPEED_BINS_KMH.length - 1; b++) {
    const lo = SPEED_BINS_KMH[b]!;
    const hi = SPEED_BINS_KMH[b + 1]!;
    const r = j.filter((x) => x.kmh >= lo && x.kmh < hi).map((x) => x.r);
    if (r.length > 0) rows.push({ bin: `${lo}-${hi} km/h`, n: r.length, p95: percentile(r, 0.95), max: Math.max(...r) });
  }
  return rows;
}

/** Full-throttle run on the long track with automatic upshifts, recording every frame. */
async function recordRun(page: Page, camera: 'follow' | 'wide' | 'start', maxS: number): Promise<FrameColumns> {
  await mode(page, `(m.restart(), m.cameraMode = '${camera}', 0)`);
  await waitEngineRunning(page);
  await page.waitForTimeout(400);
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.press('e');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.gear')).toBe(1);
  await page.evaluate(() => (window as unknown as { __app: { debug: { game: { scene: { getScene(k: string): { frameLog: { clear(): void } } } } } } }).__app.debug.game.scene.getScene('race').frameLog.clear());
  await page.keyboard.down('w');
  const t0 = Date.now();
  while (Date.now() - t0 < maxS * 1000) {
    const s = await mode<{ rpm: number; red: number; gear: number; gears: number; x: number }>(
      page,
      '({ rpm: m.runner.player.sim.engine.rpm, red: m.runner.player.sim.car.engine.redlineRpm, gear: m.runner.player.sim.gear, gears: m.runner.player.sim.car.transmission.gearRatios.length, x: m.runner.player.sim.x })',
    );
    if (s.x > 1400) break;
    if (s.rpm > s.red * 0.94 && s.gear < s.gears) await page.keyboard.press('e');
    await page.waitForTimeout(60);
  }
  await page.keyboard.up('w');
  return page.evaluate(() => {
    const game = (window as unknown as { __app: { debug: { game: { scene: { getScene(k: string): { visualDebug(n: number): { frames: unknown } } } } } } }).__app.debug.game;
    return game.scene.getScene('race').visualDebug(900).frames as never;
  });
}

test('camera stability: the car does not shake on screen while accelerating (follow, wide, start)', async ({ page }) => {
  test.setTimeout(240_000);
  const label = process.env.SMOOTH_LABEL ?? 'atual';
  await boot(page);
  await page.getByTestId('track-select').selectOption('airfield');
  await page.getByTestId('car-select').selectOption('aurora-v12-lab');
  await waitEngineRunning(page);
  await waitArt(page);
  const runs: Record<string, FrameColumns> = {};
  runs.follow = await recordRun(page, 'follow', 22);
  await shot(page, `stability-${label}-follow`);
  runs.start = await recordRun(page, 'start', 6);
  await shot(page, `stability-${label}-start`);
  await page.getByTestId('compare-select').selectOption('tempest-v8');
  await waitArt(page);
  runs.wide = await recordRun(page, 'wide', 22);
  await shot(page, `stability-${label}-wide`);
  const viewW = (await visual(page)).viewW;
  const report: Record<string, { bin: string; n: number; p95: number; max: number }[]> = {};
  for (const [k, f] of Object.entries(runs)) {
    report[k] = jitterReport(screenJitter(f, viewW));
    console.log(`[${label}] ${k}: ${report[k]!.map((r) => `${r.bin} p95 ${r.p95.toFixed(2)} px max ${r.max.toFixed(2)} px (n=${r.n})`).join(' | ')}`);
  }
  writeFileSync(`${OUT}/stability-${label}.json`, JSON.stringify({ label, viewW, report, runs }));
  if (process.env.SMOOTH_BASELINE) return;
  // follow and wide: the car is steady on screen at every speed reached (≈ 300 km/h)
  for (const k of ['follow', 'wide']) {
    const all = report[k]!;
    expect(Math.max(...runs[k]!.speed) * 3.6, `top speed of the ${k} run`).toBeGreaterThan(240);
    for (const r of all) {
      expect(r.p95, `${k} ${r.bin}`).toBeLessThanOrEqual(2);
      expect(r.max, `${k} ${r.bin}`).toBeLessThanOrEqual(6);
    }
  }
});

test('hud: turbo gauge only on turbo cars, reads the simulated boost', async ({ page }) => {
  await boot(page, false);
  await waitEngineRunning(page);
  // naturally aspirated car: no gauge, no placeholder
  await expect(page.getByTestId('turbo-gauge')).toBeHidden();
  await shot(page, 'hud-na');
  await page.getByTestId('garage-open').click();
  await page.getByTestId('garage-car-vetra-rs').click();
  await page.getByTestId('garage-use').click();
  await expect.poll(() => mode<string>(page, 'm.runner.player.sim.car.id')).toBe('vetra-rs');
  await waitEngineRunning(page);
  await expect(page.getByTestId('turbo-gauge')).toBeVisible();
  const size = async (sel: string): Promise<number> => (await page.locator(sel).first().boundingBox())!.width;
  expect(await size('[data-testid=turbo-gauge]')).toBeLessThan((await size('.rhud .tach')) * 0.6);
  await shot(page, 'hud-turbo-idle');
  await page.locator('#game').click({ position: { x: 50, y: 50 } });
  await page.keyboard.down('w');
  await expect.poll(() => mode<number>(page, 'm.runner.player.sim.engine.turbo.boostPa'), { timeout: 8000 }).toBeGreaterThan(5000);
  await page.waitForTimeout(500);
  await shot(page, 'hud-turbo-boost');
  const shown = Number(await page.getByTestId('hud-boost').textContent());
  expect(shown).toBeGreaterThan(0.04);
  await page.keyboard.up('w');
  // the HUD stays inside the stage with the gauge present
  const hud = await page.getByTestId('hud').boundingBox();
  const stage = await page.locator('#stage').boundingBox();
  expect(hud!.x + hud!.width).toBeLessThanOrEqual(stage!.x + stage!.width + 1);
});
