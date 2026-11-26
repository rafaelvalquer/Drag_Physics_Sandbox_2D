import type { CarConfig } from '../../../../data/schema';
import type { VehicleVisualMeta } from '../../VehicleSpriteAssembler';

/**
 * Anchors of the workshop technical view. Everything is in metres, relative to the ground contact of
 * the front axle (x forward, y up) like `VehicleVisualMeta`, and is derived from real data of the car
 * (wheelbase, nose/rear positions, driven axle, engine mount, exhaust outlet): never screen pixels.
 */
export type EnginePosition = 'front' | 'mid' | 'rear';
export type EngineOrientation = 'transverse' | 'longitudinal';
export interface EngineMount {
  position: EnginePosition;
  orientation: EngineOrientation;
}

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Zone of the car a part belongs to (hotspot + highlight of the technical view). */
export type VisualZone =
  | 'engine' | 'intake' | 'turbo' | 'intercooler' | 'exhaust' | 'transmission' | 'clutch' | 'diff'
  | 'nitro' | 'cooling' | 'wheel' | 'tire' | 'ecu' | 'suspension' | 'weight';

export interface TechAnchors {
  mount: EngineMount;
  engine: Box;
  /** Gearbox / transaxle. */
  gearbox: Box;
  /** One entry per turbocharger (twin = one per bank). */
  turbos: Pt[];
  intercooler: Box;
  radiator: Box;
  /** Manifold -> downpipe -> muffler -> tail. */
  exhaust: Pt[];
  muffler: Box;
  nitroCylinder: Box;
  /** Line from the cylinder to the intake. */
  nitroLine: Pt[];
  intake: Box;
  /** Drive shafts to the driven axles ('front' halfshaft, 'rear' propshaft + differential). */
  frontDrive: Pt[] | null;
  rearDrive: Pt[] | null;
  frontDiff: Box | null;
  rearDiff: Box | null;
  ecu: Pt;
  /** Hotspot (where the pulsing marker goes) of each zone. */
  zones: Record<VisualZone, Pt>;
}

/** Engine mount of a car: explicit data when present, otherwise front engine (across on FWD, lengthwise otherwise). */
export function engineMountOf(car: Pick<CarConfig, 'drivenAxle' | 'visual'>): EngineMount {
  return car.visual.engineMount ?? { position: 'front', orientation: car.drivenAxle === 'front' ? 'transverse' : 'longitudinal' };
}

export function wheelYOf(meta: VehicleVisualMeta): number {
  return meta.wheelCentres.front.y;
}

const box = (cx: number, cy: number, w: number, h: number): Box => ({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
export const centreOf = (b: Box): Pt => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });

/** Anchors of the three layouts (front, mid and rear engine) on the real geometry of the car. */
export function techAnchorsOf(car: Pick<CarConfig, 'drivenAxle' | 'visual' | 'engine' | 'wheelbaseM'>, meta: VehicleVisualMeta): TechAnchors {
  const mount = engineMountOf(car);
  const wb = car.wheelbaseM;
  const wy = wheelYOf(meta);
  const front = 0;
  const rearAxle = -wb;
  const nose = meta.noseX;
  const tail = meta.rearX;
  const hoodY = Math.min(0.78, meta.heightM * 0.5);
  const twin = car.engine.turbo?.layout === 'parallel-twin';
  const transverse = mount.orientation === 'transverse';
  const engW = transverse ? 0.62 : 0.84;
  const engH = Math.min(0.46, hoodY - 0.28);

  let engine: Box;
  let gearbox: Box;
  if (mount.position === 'front') {
    engine = box(transverse ? 0.2 : 0.22, 0.28 + engH / 2 + 0.02, engW, engH);
    gearbox = transverse ? box(engine.x0 - 0.12, 0.42, 0.26, 0.34) : box(engine.x0 - 0.3, 0.4, 0.58, 0.3);
  } else if (mount.position === 'mid') {
    engine = box(rearAxle + 0.95, 0.3 + engH / 2, engW, engH);
    gearbox = box(engine.x0 - 0.2, 0.4, 0.4, 0.28);
  } else {
    engine = box(Math.max(tail + 0.55, rearAxle - 0.5), 0.3 + engH / 2, engW, engH);
    gearbox = box(engine.x1 + 0.2, 0.4, 0.4, 0.28);
  }

  // turbo: the exhaust side of the engine; one per bank on a twin layout
  const turboX = mount.position === 'front' && transverse ? engine.x0 + 0.02 : engine.x1 - 0.08;
  const turboY = engine.y0 + 0.1;
  const turbos: Pt[] = twin ? [{ x: turboX, y: turboY + 0.05 }, { x: turboX - 0.02, y: turboY - 0.01 }] : [{ x: turboX, y: turboY }];

  // front-mounted cooling for front/mid/rear engines alike; mid/rear engines put the charge cooler beside the engine
  const sideCooler = mount.position !== 'front';
  const intercooler = sideCooler ? box(engine.x1 + 0.34, 0.46, 0.34, 0.2) : box(nose - 0.16, 0.44, 0.08, 0.34);
  const radiator = box(nose - 0.3, 0.46, 0.07, 0.36);

  const out = meta.exhausts[0] ?? { x: tail, y: 0.3 };
  const mufflerX = mount.position === 'front' ? rearAxle - 0.32 : Math.max(tail + 0.3, engine.x0 - 0.3);
  const muffler = box(mufflerX, 0.26, 0.5, 0.2);
  const exhaustStart: Pt = transverse && mount.position === 'front' ? { x: engine.x0 + 0.04, y: engine.y0 + 0.14 } : { x: engine.x0 + 0.3, y: engine.y0 };
  const exhaust: Pt[] =
    mount.position === 'front'
      ? [exhaustStart, { x: engine.x0 - 0.02, y: 0.22 }, { x: rearAxle + 0.5, y: 0.2 }, { x: muffler.x0, y: muffler.y1 - 0.1 }, { x: muffler.x1, y: muffler.y1 - 0.1 }, { x: out.x + 0.04, y: out.y }]
      : [{ x: engine.x0 + 0.12, y: engine.y0 + 0.04 }, { x: engine.x0 - 0.05, y: 0.24 }, { x: muffler.x0, y: muffler.y1 - 0.1 }, { x: muffler.x1, y: muffler.y1 - 0.1 }, { x: out.x + 0.04, y: out.y }];

  // nitro: the cylinder rides in the luggage space farthest from the engine
  const nitroCylinder = mount.position === 'front' ? box(tail + 0.62, 0.56, 0.72, 0.2) : box(nose - 0.7, 0.5, 0.7, 0.2);
  const nitroLine: Pt[] =
    mount.position === 'front'
      ? [{ x: nitroCylinder.x1, y: nitroCylinder.y0 + 0.1 }, { x: rearAxle + 0.4, y: 0.34 }, { x: engine.x0 + 0.1, y: 0.34 }, { x: engine.x0 + 0.18, y: engine.y1 - 0.06 }]
      : [{ x: nitroCylinder.x0, y: nitroCylinder.y0 + 0.1 }, { x: front - 0.3, y: 0.3 }, { x: rearAxle + 0.9, y: 0.3 }, { x: engine.x1 - 0.1, y: engine.y1 - 0.06 }];

  const intake = box(engine.x1 - 0.12, engine.y1 + 0.05, 0.3, 0.1);
  const frontDriven = car.drivenAxle !== 'rear';
  const rearDriven = car.drivenAxle !== 'front';
  const gbc = centreOf(gearbox);
  const frontDrive: Pt[] | null = frontDriven ? [{ x: gbc.x, y: gearbox.y0 + 0.04 }, { x: front, y: wy }] : null;
  const rearDrive: Pt[] | null = rearDriven ? [{ x: gearbox.x0, y: gbc.y }, { x: rearAxle, y: wy }] : null;
  const frontDiff = frontDriven ? box(front - 0.2, wy - 0.02, 0.3, 0.22) : null;
  const rearDiff = rearDriven ? box(rearAxle, wy - 0.02, 0.3, 0.2) : null;
  const ecu: Pt = { x: engine.x0 + 0.1, y: engine.y1 + 0.12 };

  const c = (b: Box): Pt => centreOf(b);
  const zones: Record<VisualZone, Pt> = {
    engine: c(engine),
    intake: c(intake),
    turbo: turbos[0]!,
    intercooler: c(intercooler),
    exhaust: { x: out.x, y: out.y },
    transmission: c(gearbox),
    clutch: { x: gearbox.x1, y: gbc.y },
    diff: rearDiff ? c(rearDiff) : frontDiff ? c(frontDiff) : c(gearbox),
    nitro: c(nitroCylinder),
    cooling: c(radiator),
    wheel: { x: meta.wheelCentres.front.x, y: wy + meta.tyreRadiusM * 0.9 },
    tire: { x: meta.wheelCentres.rear.x, y: wy + meta.tyreRadiusM * 0.9 },
    ecu,
    suspension: { x: meta.wheelCentres.front.x, y: wy + meta.tyreRadiusM + 0.14 },
    weight: { x: (nose + tail) / 2, y: meta.heightM * 0.62 },
  };
  return { mount, engine, gearbox, turbos, intercooler, radiator, exhaust, muffler, nitroCylinder, nitroLine, intake, frontDrive, rearDrive, frontDiff, rearDiff, ecu, zones };
}
