/** Visual registry, anchors by architecture, engine drawings and what counts as an external change. */
import { describe, expect, it } from 'vitest';
import { findCampaignCar } from '../../../src/data/cars/campaign';
import type { CarConfig } from '../../../src/data/schema';
import { resolveBuild } from '../../../src/game/career/tuning/BuildResolver';
import { ALL_PARTS, CATEGORY_LABEL, findPart, type PartCategory } from '../../../src/game/career/tuning/parts';
import { buildVehicleLayers } from '../../../src/game/vehicles/VehicleSpriteAssembler';
import { engineSpecOf } from '../../../src/game/vehicles/art/parts/EngineDrawings';
import { engineMountOf, techAnchorsOf } from '../../../src/game/vehicles/art/parts/PartVisualAnchors';
import { CATEGORY_VISUAL, RESERVED_FAMILIES } from '../../../src/game/vehicles/art/parts/PartVisualRegistry';
import { externalChanges, resolvePartVisual, stockAsset, techStateOf } from '../../../src/game/vehicles/art/parts/PartVisualResolver';

const base = (id: string): CarConfig => findCampaignCar(id)!;
const metaOf = (car: CarConfig) => buildVehicleLayers(car, 100).meta;
const withVisual = (car: CarConfig, extra: Partial<CarConfig['visual']>, drivenAxle?: CarConfig['drivenAxle']): CarConfig =>
  ({ ...car, drivenAxle: drivenAxle ?? car.drivenAxle, visual: { ...car.visual, ...extra } }) as CarConfig;

describe('part visual registry', () => {
  it('covers every part category and every catalogue part resolves to a drawing', () => {
    for (const c of Object.keys(CATEGORY_LABEL) as PartCategory[]) expect(CATEGORY_VISUAL[c], c).toBeDefined();
    for (const p of ALL_PARTS) {
      const v = resolvePartVisual(p as unknown as { category: PartCategory } & Record<string, unknown>);
      expect(v.asset, p.id).toBeTruthy();
      expect(v.supportsPreview).toBe(true);
    }
  });

  it('keeps no price, requirement or physics in the registry (visual data only)', () => {
    for (const e of Object.values(CATEGORY_VISUAL)) expect(Object.keys(e).sort()).toEqual(['anchorId', 'assetId', 'defaultMode', 'illustrated', 'layer', 'scale', 'supportsInstalledView', 'supportsPreview']);
  });

  it('refines the drawing with the part data: tyre grade, exhaust preset, turbo layout', () => {
    expect(resolvePartVisual(findPart('tires-sport')! as never).asset).toBe('tire-sport');
    expect(resolvePartVisual(findPart('tires-semislick')! as never).asset).toBe('tire-semislick');
    expect(resolvePartVisual(findPart('exhaust-sport')! as never).asset).toBe('exhaust-sport');
    // every exhaust part shows the sport tip in the game art, so the drawing is the same; the factory exhaust has its own
    expect(resolvePartVisual(findPart('exhaust-bmw-n20-s1')! as never).asset).toBe('exhaust-sport');
    expect(stockAsset('exhaust')).toBe('exhaust-free');
    expect(stockAsset('tires')).toBe('tire-stock');
    expect(resolvePartVisual(findPart('turbo-basic')! as never).asset).toBe('turbo-single');
  });

  it('the four illustrated families exist and wheels are a reserved family (no rim part is invented)', () => {
    expect(CATEGORY_VISUAL.tires.illustrated).toBe(true);
    expect(CATEGORY_VISUAL.exhaust.illustrated).toBe(true);
    expect(CATEGORY_VISUAL.turbo.illustrated).toBe(true);
    expect(RESERVED_FAMILIES).toEqual(['wheel-original', 'wheel-sport']);
    expect(ALL_PARTS.some((p) => /roda|aro|wheel/i.test(p.name))).toBe(false);
  });
});

describe('external changes come from the resolved cars, never from the part name', () => {
  const chevette = base('gm-chevette-sl-1988');
  const resolve = (parts: string[]) => {
    const b = resolveBuild(chevette, parts, {}, 1);
    if (!b.ok) throw new Error(b.errors.join('; '));
    return b.car;
  };

  it('tyres, exhaust tip and intercooler are the only visible differences', () => {
    const stock = resolve([]);
    expect(externalChanges(stock, resolve(['tires-sport']))).toEqual(['tyre']);
    expect(externalChanges(stock, resolve(['tires-semislick']))).toEqual(['tyre']);
    expect(externalChanges(stock, resolve(['exhaust-sport']))).toEqual(['exhaust-tip']);
  });

  it('an internal part is never reported as an external change', () => {
    const stock = resolve([]);
    for (const id of ['cam-sport', 'filter-sport', 'flywheel-light', 'clutch-reinforced']) expect(externalChanges(stock, resolve([id])), id).toEqual([]);
  });
});

describe('engine mount and layouts', () => {
  it('defaults to a front engine, across on front drive and lengthwise otherwise; explicit data wins', () => {
    expect(engineMountOf(base('vw-gol-gts-1988'))).toEqual({ position: 'front', orientation: 'transverse' });
    expect(engineMountOf(base('gm-chevette-sl-1988'))).toEqual({ position: 'front', orientation: 'longitudinal' });
    expect(engineMountOf(base('mitsubishi-evo-x-2012'))).toEqual({ position: 'front', orientation: 'transverse' });
    expect(engineMountOf(withVisual(base('vw-gol-gts-1988'), { engineMount: { position: 'rear', orientation: 'longitudinal' } }))).toEqual({ position: 'rear', orientation: 'longitudinal' });
  });

  it('front engine: engine ahead of the cabin, drive follows the driven axle', () => {
    const gol = base('vw-gol-gts-1988');
    const a = techAnchorsOf(gol, metaOf(gol));
    expect(a.mount.position).toBe('front');
    expect(a.engine.x0).toBeGreaterThan(-gol.wheelbaseM / 3);
    expect(a.frontDrive).not.toBeNull();
    expect(a.rearDrive).toBeNull();
    const chevette = base('gm-chevette-sl-1988');
    const b = techAnchorsOf(chevette, metaOf(chevette));
    expect(b.frontDrive).toBeNull();
    expect(b.rearDrive).not.toBeNull();
    expect(b.rearDiff!.x0).toBeLessThan(-chevette.wheelbaseM + 0.2);
    const gtr = base('nissan-gtr-r35-2015');
    const c = techAnchorsOf(gtr, metaOf(gtr));
    expect(c.frontDrive).not.toBeNull();
    expect(c.rearDrive).not.toBeNull();
  });

  it('mid engine sits behind the cabin between the axles; rear engine behind the rear axle', () => {
    const car = base('nissan-350z-2006');
    const mid = techAnchorsOf(withVisual(car, { engineMount: { position: 'mid', orientation: 'longitudinal' } }), metaOf(car));
    const rear = techAnchorsOf(withVisual(car, { engineMount: { position: 'rear', orientation: 'longitudinal' } }), metaOf(car));
    const front = techAnchorsOf(car, metaOf(car));
    const cx = (b: { x0: number; x1: number }) => (b.x0 + b.x1) / 2;
    expect(cx(mid.engine)).toBeLessThan(-car.wheelbaseM / 2);
    expect(cx(mid.engine)).toBeGreaterThan(-car.wheelbaseM - 0.3);
    expect(cx(rear.engine)).toBeLessThan(cx(mid.engine));
    expect(cx(front.engine)).toBeGreaterThan(cx(mid.engine));
  });

  it('exhaust, intercooler, gearbox and nitro cylinder move with the layout', () => {
    const car = base('nissan-350z-2006');
    const front = techAnchorsOf(car, metaOf(car));
    const mid = techAnchorsOf(withVisual(car, { engineMount: { position: 'mid', orientation: 'longitudinal' } }), metaOf(car));
    // nitro: farthest from the engine (luggage at the other end)
    expect(front.nitroCylinder.x1).toBeLessThan(front.engine.x0);
    expect(mid.nitroCylinder.x0).toBeGreaterThan(mid.engine.x1);
    // charge cooler: nose of a front engine, beside a mid engine
    expect(front.intercooler.x0).toBeGreaterThan(front.engine.x1);
    expect(mid.intercooler.x0).toBeLessThan(front.intercooler.x0);
    // gearbox behind a front engine, ahead of... the other end of a mid engine
    expect(front.gearbox.x1).toBeLessThanOrEqual(front.engine.x0 + 0.01);
    expect(mid.gearbox.x1).toBeLessThanOrEqual(mid.engine.x0 + 0.01);
    // the exhaust line ends at the real outlet of the car art
    const meta = metaOf(car);
    const end = front.exhaust[front.exhaust.length - 1]!;
    expect(end.y).toBeCloseTo(meta.exhausts[0]!.y, 5);
    expect(mid.exhaust.length).toBeLessThan(front.exhaust.length);
  });

  it('anchors are metres from real data: no value depends on a screen size', () => {
    const car = base('bmw-320i-f30-2014');
    const m1 = buildVehicleLayers(car, 100).meta;
    const m2 = buildVehicleLayers(car, 240).meta;
    const a = techAnchorsOf(car, m1);
    const b = techAnchorsOf(car, m2);
    expect(a.engine.x0).toBeCloseTo(b.engine.x0, 5);
    expect(a.zones.exhaust.x).toBeCloseTo(b.zones.exhaust.x, 1);
  });
});

describe('engine drawings by architecture and cylinders', () => {
  it('a V6 is two banks of three cylinders; twin turbo layout draws two small turbos', () => {
    const z = base('nissan-350z-2006');
    const v6 = engineSpecOf(z);
    expect(z.engine.cylinders).toBe(6);
    expect(v6).toMatchObject({ shape: 'v', banks: 2, perBank: 3 });
    expect(v6.label).toContain('duas bancadas de 3 cilindros');
    const twin = { ...z, engine: { ...z.engine, induction: 'turbo', turbo: { ...(findPart('turbo-basic') as never as { turbo: object }).turbo, layout: 'parallel-twin' } } } as unknown as CarConfig;
    expect(engineSpecOf(twin).turbos).toBe(2);
  });

  it('in-line engines are one bank; a 180 degree bank angle is a boxer', () => {
    const gol = base('vw-gol-gts-1988');
    expect(engineSpecOf(gol)).toMatchObject({ shape: 'inline', banks: 1, perBank: gol.engine.cylinders });
    const boxer = { ...gol, engine: { ...gol.engine, bankAngleDeg: 180, cylinders: 6, architecture: 'V6' } } as unknown as CarConfig;
    expect(engineSpecOf(boxer)).toMatchObject({ shape: 'boxer', banks: 2, perBank: 3 });
  });

  it('the technical state follows the resolved car (turbo, intercooler, nitro, exhaust tip)', () => {
    const chevette = base('gm-chevette-sl-1988');
    expect(techStateOf(chevette)).toMatchObject({ turbo: 'none', intercooler: false, nitrous: false });
    const b = resolveBuild(chevette, ['turbo-basic', 'ic-small', 'exhaust-sport', 'clutch-reinforced'], {}, 1);
    if (!b.ok) throw new Error(b.errors.join('; '));
    expect(techStateOf(b.car)).toMatchObject({ turbo: 'single', intercooler: true, sportExhaust: true });
  });
});
