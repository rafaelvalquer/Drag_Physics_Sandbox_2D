/**
 * Pure logic of the visual layer: it only reads physics values and never feeds anything back.
 * Asset geometry, wheel presentation, visual suspension, camera, lighting and instruments.
 */
import { describe, expect, it } from 'vitest';
import { STANDARD_GRAVITY } from '../../src/core/units';
import { GRAPHICS } from '../../src/app/graphics';
import { CARS, LAB_CARS, cloneCar } from '../../src/data/cars/index';
import { validateCar } from '../../src/data/schema';
import { CameraController, FOLLOW_SPAN_FAST_M, FOLLOW_SPAN_REST_M } from '../../src/game/scenes/CameraController';
import { THEME_TIME, lightingFor, lit, resolveTime, spriteTint } from '../../src/game/scenes/LightingController';
import { DESIGNS, outlineV } from '../../src/game/vehicles/art/designs';
import { slipIntensity } from '../../src/game/vehicles/slip';
import { SuspensionVisualController } from '../../src/game/vehicles/SuspensionVisualController';
import { artSignature, buildVehicleLayers } from '../../src/game/vehicles/VehicleSpriteAssembler';
import { FULL_BLUR_RANGE, SOFT_BLUR_RANGE, WheelAnimationController } from '../../src/game/vehicles/WheelAnimationController';
import { dynoWheelOmega } from '../../src/ui/dyno/DynoBayView';
import { gearLabel } from '../../src/ui/hud/GearIndicator';
import { SHIFT_LIGHT_COUNT, shiftLightState, shiftTargets, shiftWindow } from '../../src/ui/hud/ShiftLights';
import { tachAngle, tachScale } from '../../src/ui/hud/Tachometer';

describe('vehicle artwork pipeline', () => {
  it('every car has its own body design (no shared silhouette with other colours)', () => {
    const styles = LAB_CARS.map((c) => c.visual.bodyStyle);
    expect(new Set(styles).size).toBe(LAB_CARS.length);
    const outlines = LAB_CARS.map((c) => JSON.stringify(DESIGNS[c.visual.bodyStyle].outline));
    expect(new Set(outlines).size).toBe(LAB_CARS.length);
    // versions of one body generation (F30 320i / 335i M Sport) share the greenhouse, nothing else
    const SIBLINGS: Record<string, string> = { bmw335iF30: 'bmw320iF30' };
    const glass = LAB_CARS.filter((c) => !SIBLINGS[c.visual.bodyStyle]).map((c) => JSON.stringify(DESIGNS[c.visual.bodyStyle].glass));
    expect(new Set(glass).size).toBe(glass.length);
    const wheels = LAB_CARS.map((c) => JSON.stringify(DESIGNS[c.visual.bodyStyle].wheel));
    expect(new Set(wheels).size).toBeGreaterThanOrEqual(6);
  });

  it('visual metadata agrees with the physics geometry of each car', () => {
    for (const car of LAB_CARS) {
      const { meta, layers } = buildVehicleLayers(car, 100);
      // wheel centres: one wheelbase apart, one tyre radius above the ground
      expect(meta.wheelCentres.front).toEqual({ x: 0, y: car.tires.radiusM });
      expect(meta.wheelCentres.rear).toEqual({ x: -car.wheelbaseM, y: car.tires.radiusM });
      expect(meta.tyreRadiusM).toBe(car.tires.radiusM);
      expect(meta.groundY).toBe(0);
      expect(meta.contact.rear.y).toBe(0);
      // overall size is the configured size
      expect(meta.noseX - meta.rearX).toBeCloseTo(car.visual.lengthM, 9);
      expect(meta.noseX).toBeCloseTo(car.visual.frontOverhangM, 9);
      expect(meta.roofY).toBe(car.visual.heightM);
      // emit points are on the car
      for (const ex of meta.exhausts) {
        expect(ex.x).toBeGreaterThan(meta.rearX - 0.3);
        expect(ex.x).toBeLessThan(meta.noseX);
        expect(ex.y).toBeGreaterThan(0);
        expect(ex.y).toBeLessThan(car.visual.heightM);
      }
      expect(meta.headlight.x).toBeGreaterThan(0);
      expect(meta.taillight.x).toBeLessThan(-car.wheelbaseM);
      // the wheel sprite is exactly the tyre diameter (plus the antialiasing margin)
      const wheel = layers.find((l) => l.name === 'wheel')!;
      expect(wheel.w).toBe(Math.ceil(2 * car.tires.radiusM * 100) + 6);
      // nine layers (front and rear hubs differ when the rear axle has drums), all well-formed SVG documents
      expect(layers.map((l) => l.name)).toEqual(['under', 'body', 'gloss', 'lights', 'brake', 'shadow', 'hub', 'hubRear', 'wheel']);
      for (const l of layers) {
        expect(l.svg.startsWith('<svg ')).toBe(true);
        expect(l.svg.endsWith('</svg>')).toBe(true);
        expect(l.svg).not.toContain('NaN');
        expect(l.svg).not.toContain('undefined');
      }
    }
  });

  it('cars of different sizes are drawn at different sizes on the same scale', () => {
    const widths = CARS.map((c) => buildVehicleLayers(c, 100).layers[1]!.w);
    const lengths = CARS.map((c) => c.visual.lengthM);
    for (let i = 0; i < CARS.length; i++) {
      for (let j = 0; j < CARS.length; j++) {
        if (lengths[i]! > lengths[j]! + 0.05) expect(widths[i]!).toBeGreaterThan(widths[j]!);
      }
    }
  });

  it('the fenders clear the tyres: the body outline is above each wheel arch', () => {
    for (const car of LAB_CARS) {
      const d = DESIGNS[car.visual.bodyStyle];
      const v = car.visual;
      const yb = v.rideHeightM + 0.03;
      const archTop = (2 * car.tires.radiusM + d.archGap + 0.005 - yb) / (v.heightM - yb);
      const uFront = (v.lengthM - v.frontOverhangM) / v.lengthM;
      const uRear = uFront - car.wheelbaseM / v.lengthM;
      expect(outlineV(d, uFront)).toBeGreaterThan(archTop + 0.03);
      expect(outlineV(d, uRear)).toBeGreaterThan(archTop + 0.03);
    }
  });

  it('the artwork is rebuilt when the look changes and only then', () => {
    const car = cloneCar(CARS[0]!);
    const sig = artSignature(car);
    const tuned = cloneCar(car);
    tuned.massKg += 100;
    tuned.engine.redlineRpm += 100;
    expect(artSignature(tuned)).toBe(sig);
    const painted = cloneCar(car);
    painted.visual.color = '#123456';
    expect(artSignature(painted)).not.toBe(sig);
    const stretched = cloneCar(car);
    stretched.wheelbaseM += 0.05;
    expect(artSignature(stretched)).not.toBe(sig);
    // an edited car is still a valid configuration and still produces artwork
    expect(validateCar(painted).ok).toBe(true);
    expect(buildVehicleLayers(painted, 80).layers).toHaveLength(9);
  });
});

describe('wheel presentation', () => {
  it('goes from sharp to softly blurred to fully blurred with the wheel speed', () => {
    const w = new WheelAnimationController('staged');
    expect(w.layers(0)).toEqual({ sharp: 1, soft: 0, full: 0 });
    expect(w.layers(SOFT_BLUR_RANGE[0])).toEqual({ sharp: 1, soft: 0, full: 0 });
    const mid = w.layers((SOFT_BLUR_RANGE[1] + FULL_BLUR_RANGE[0]) / 2);
    expect(mid).toEqual({ sharp: 0, soft: 1, full: 0 });
    expect(w.layers(FULL_BLUR_RANGE[1] + 1)).toEqual({ sharp: 0, soft: 0, full: 1 });
    // direction does not matter
    expect(w.layers(-80)).toEqual(w.layers(80));
  });

  it('never becomes see-through during a transition (a lower layer stays opaque)', () => {
    const w = new WheelAnimationController('staged');
    for (let omega = 0; omega < 70; omega += 0.25) {
      const a = w.layers(omega);
      expect(Math.max(a.sharp, a.soft === 1 ? 1 : 0, a.full === 1 ? 1 : 0)).toBe(1);
      for (const v of [a.sharp, a.soft, a.full]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('respects the graphics profile', () => {
    expect(new WheelAnimationController('off').layers(500)).toEqual({ sharp: 1, soft: 0, full: 0 });
    const full = new WheelAnimationController('full');
    expect(full.layers(15).soft).toBe(0);
    expect(full.layers(100)).toEqual({ sharp: 0, soft: 0, full: 1 });
    expect(GRAPHICS.low.wheelBlur).toBe('off');
    expect(GRAPHICS.high.wheelBlur).toBe('staged');
  });
});

describe('visual suspension', () => {
  const params = { wheelbaseM: 2.7, cgHeightM: 0.5 };
  const run = (s: SuspensionVisualController, seconds: number, accel: number, speed = 0, dt = 1 / 60): void => {
    for (let t = 0; t < seconds; t += dt) s.update(dt, { accel, speed });
  };

  it('pitches nose-up under acceleration and nose-down under braking, then settles', () => {
    const s = new SuspensionVisualController(params);
    run(s, 2, 0.8 * STANDARD_GRAVITY);
    const launch = s.state;
    expect(launch.pitch).toBeGreaterThan(0.01);
    expect(launch.pitch).toBeCloseTo(s.pitchGain * 0.8 * STANDARD_GRAVITY, 3);
    expect(launch.frontTravel).toBeGreaterThan(launch.rearTravel); // nose up, tail squats
    run(s, 2, -0.55 * STANDARD_GRAVITY);
    expect(s.state.pitch).toBeLessThan(-0.008);
    run(s, 3, 0);
    expect(Math.abs(s.state.pitch)).toBeLessThan(1e-3);
    expect(Math.abs(s.state.heave)).toBeLessThan(1e-3);
  });

  it('is a damped spring: it overshoots a little and never grows', () => {
    const s = new SuspensionVisualController(params);
    const target = s.pitchGain * 6;
    let peak = 0;
    for (let i = 0; i < 240; i++) peak = Math.max(peak, s.update(1 / 120, { accel: 6, speed: 0 }).pitch);
    expect(peak).toBeGreaterThan(target);
    expect(peak).toBeLessThan(target * 1.25);
  });

  it('a gear change (drive force interrupted) makes the body drop back and recover', () => {
    const s = new SuspensionVisualController(params);
    run(s, 1.5, 5);
    const before = s.state.pitch;
    run(s, 0.2, -0.5);
    expect(s.state.pitch).toBeLessThan(before * 0.75);
    run(s, 1.5, 5);
    expect(s.state.pitch).toBeCloseTo(before, 2);
  });

  it('does not depend on the frame rate and survives bad input', () => {
    const a = new SuspensionVisualController(params);
    const b = new SuspensionVisualController(params);
    run(a, 1, 7, 20, 1 / 30);
    run(b, 1, 7, 20, 1 / 144);
    expect(a.state.pitch).toBeCloseTo(b.state.pitch, 3);
    const c = new SuspensionVisualController(params);
    c.update(5, { accel: Number.NaN, speed: Number.POSITIVE_INFINITY });
    c.update(0.016, { accel: 1e9, speed: 1e9 });
    expect(Number.isFinite(c.state.pitch)).toBe(true);
    expect(Math.abs(c.state.pitch)).toBeLessThan(0.12);
    expect(Math.abs(c.state.heave)).toBeLessThan(0.08);
  });
});

describe('tyre smoke condition', () => {
  it('needs real sliding: throttle or speed alone never smokes', () => {
    expect(slipIntensity(0, 0)).toBe(0);
    // peak-traction slip at speed (8 % of 40 m/s): grip, no smoke
    expect(slipIntensity(0.08, 3.2)).toBe(0);
    // a high ratio at a crawl (below the sliding speed)
    expect(slipIntensity(2, 0.5)).toBe(0);
    // burnout
    expect(slipIntensity(3, 12)).toBe(1);
    expect(slipIntensity(-3, -12)).toBe(1);
    const mild = slipIntensity(0.35, 3);
    expect(mild).toBeGreaterThan(0);
    expect(mild).toBeLessThan(1);
  });
});

describe('camera', () => {
  const base = { viewW: 1100, viewH: 760, trackStartM: -30, trackEndM: 1612, userZoom: 1, include: null, others: [] };
  const car = (x: number, speed: number): { x: number; speed: number; wheelbaseM: number } => ({ x, speed, wheelbaseM: 2.7 });

  it('frames the car as the subject and keeps the track in the lower middle', () => {
    const cam = new CameraController();
    const s = cam.update(0.016, { ...base, mode: 'follow', player: car(0, 0) });
    expect(1100 / s.ppm).toBeCloseTo(FOLLOW_SPAN_REST_M, 6);
    // a 4.8 m car fills about a third of the view
    expect((4.8 * s.ppm) / 1100).toBeGreaterThan(0.3);
    expect(s.groundY / 760).toBeGreaterThan(0.6);
    expect(s.groundY / 760).toBeLessThan(0.8);
  });

  it('opens the zoom moderately with speed, leads the car and never jumps', () => {
    const cam = new CameraController();
    let x = 100;
    let v = 0;
    // the controller updates its state in place (no allocation per frame): keep a copy
    let prev = { ...cam.update(1 / 60, { ...base, mode: 'follow', player: car(x, v) }) };
    let maxStep = 0;
    for (let i = 0; i < 60 * 14; i++) {
      v = Math.min(75, v + 9 / 60);
      x += v / 60;
      const s = cam.update(1 / 60, { ...base, mode: 'follow', player: car(x, v) });
      // camera motion relative to the car stays smooth frame to frame
      maxStep = Math.max(maxStep, Math.abs(s.x - prev.x - v / 60));
      expect(Math.abs(s.ppm - prev.ppm)).toBeLessThan(1.2);
      prev = { ...s };
    }
    expect(maxStep).toBeLessThan(0.35);
    expect(1100 / prev.ppm).toBeCloseTo(FOLLOW_SPAN_FAST_M, 0);
    // the car is still on screen, behind the centre (the camera looks ahead)
    const screenX = 550 + (x - 1.35 - prev.x) * prev.ppm;
    expect(screenX).toBeGreaterThan(80);
    expect(screenX).toBeLessThan(550);
  });

  it('cuts instead of flying when the car is put back on the line', () => {
    const cam = new CameraController();
    cam.update(1 / 60, { ...base, mode: 'follow', player: car(900, 60) });
    const s = cam.update(1 / 60, { ...base, mode: 'follow', player: car(0, 0) });
    expect(Math.abs(s.x - -1.35)).toBeLessThan(1);
  });

  it('stays inside the track and keeps a nearby opponent or the tree in frame', () => {
    const cam = new CameraController();
    const start = cam.update(1 / 60, { ...base, mode: 'follow', player: car(-28, 0) });
    expect(start.x - 550 / start.ppm).toBeGreaterThanOrEqual(-30 - 1e-6);
    const solo = new CameraController().update(1 / 60, { ...base, mode: 'follow', player: car(300, 30) });
    const pair = new CameraController().update(1 / 60, { ...base, mode: 'follow', player: car(300, 30), others: [car(308, 30)] });
    expect(pair.ppm).toBeLessThan(solo.ppm + 1e-9);
    const half = 550 / pair.ppm;
    expect(308 + 1).toBeLessThan(pair.x + half);
    expect(300 - 2.7 - 1).toBeGreaterThan(pair.x - half);
    // an opponent far away does not drag the camera
    const far = new CameraController().update(1 / 60, { ...base, mode: 'follow', player: car(300, 30), others: [car(380, 30)] });
    expect(far.ppm).toBeCloseTo(solo.ppm, 6);
    const tree = new CameraController().update(1 / 60, { ...base, mode: 'follow', player: car(0, 0), include: 4.6 });
    const th = 550 / tree.ppm;
    expect(4.6 + 1).toBeLessThan(tree.x + th);
    expect(-2.7 - 1).toBeGreaterThan(tree.x - th);
  });

  it('never distorts on small or portrait views: one scale for both axes', () => {
    for (const [w, h] of [
      [1920, 1080],
      [1366, 768],
      [390, 500],
      [820, 500],
    ] as const) {
      const s = new CameraController().update(1 / 60, { ...base, viewW: w, viewH: h, mode: 'follow', player: car(0, 0) });
      expect(s.ppm).toBeGreaterThan(6);
      // the whole car fits in the view
      expect(4.8 * s.ppm).toBeLessThan(w);
      expect(s.groundY).toBeLessThan(h);
    }
  });
});

describe('lighting', () => {
  it('has day, dusk and night with the lamps on when it gets dark', () => {
    const day = lightingFor('testTrack', 'day');
    const dusk = lightingFor('testTrack', 'dusk');
    const night = lightingFor('testTrack', 'night');
    expect(day.headlights).toBe(false);
    expect(dusk.headlights).toBe(true);
    expect(night.trackLamps).toBe(true);
    expect(day.intensity).toBeGreaterThan(dusk.intensity);
    expect(dusk.intensity).toBeGreaterThan(night.intensity);
    expect(night.stars).toBe(1);
    // reflections and shadows change with the light
    expect(day.gloss.alpha).toBeGreaterThan(night.gloss.alpha);
    expect(day.shadow.alpha).toBeGreaterThan(night.shadow.alpha);
    expect(dusk.shadow.stretch).toBeGreaterThan(day.shadow.stretch);
  });

  it('each track has its own default and the setting overrides it', () => {
    expect(resolveTime('nightIndustrial', 'track')).toBe('night');
    expect(resolveTime('desert', 'track')).toBe(THEME_TIME.desert);
    expect(resolveTime('nightIndustrial', 'day')).toBe('day');
    expect(lightingFor('airfield', 'track').time).toBe('day');
  });

  it('lit surfaces are darker and tinted at night', () => {
    const night = lightingFor('testTrack', 'night');
    expect(lit('#ffffff', lightingFor('testTrack', 'day'))).toBe('#ffffff');
    const n = Number.parseInt(lit('#ffffff', night).slice(1), 16);
    const r = (n >> 16) & 255;
    const b = n & 255;
    expect(r).toBeLessThan(160);
    expect(b).toBeGreaterThan(r); // cool night light
    expect(spriteTint(night)).toBe(n);
  });
});

describe('instruments', () => {
  it('the tachometer scale adapts to each engine', () => {
    const scales = LAB_CARS.map((c) => tachScale(c.engine.redlineRpm, c.engine.revLimitRpm));
    for (const [i, s] of scales.entries()) {
      const e = LAB_CARS[i]!.engine;
      expect(s.maxRpm % 1000).toBe(0);
      expect(s.maxRpm).toBeGreaterThan(e.revLimitRpm);
      expect(s.maxRpm - e.revLimitRpm).toBeLessThanOrEqual(1300);
      expect(s.redlineRpm).toBe(e.redlineRpm);
    }
    // not one fixed scale for every car
    expect(new Set(scales.map((s) => s.maxRpm)).size).toBeGreaterThan(1);
    // 270° sweep
    expect(tachAngle(8000, 8000) - tachAngle(0, 8000)).toBeCloseTo((270 * Math.PI) / 180, 9);
    expect(tachAngle(99999, 8000)).toBe(tachAngle(8000, 8000));
  });

  it('shift lights use each car’s own shift points', () => {
    const targets = CARS.map((c) => shiftTargets(c));
    for (const [i, t] of targets.entries()) {
      const car = CARS[i]!;
      expect(t).toHaveLength(car.transmission.gearRatios.length);
      // nothing to shift into in top gear
      expect(t[t.length - 1]).toBeNull();
      for (const rpm of t.slice(0, -1)) {
        expect(rpm).not.toBeNull();
        expect(rpm!).toBeGreaterThan(car.engine.idleRpm + 1000);
        expect(rpm!).toBeLessThanOrEqual(car.engine.revLimitRpm);
      }
    }
    expect(new Set(targets.map((t) => t[0])).size).toBeGreaterThan(3);
  });

  it('shift lights come on progressively and flash at the shift point', () => {
    const target = 6500;
    const span = shiftWindow(target);
    expect(shiftLightState(target - span - 1, target)).toEqual({ lit: 0, flash: false });
    let last = 0;
    for (let rpm = target - span; rpm < target; rpm += 25) {
      const s = shiftLightState(rpm, target);
      expect(s.flash).toBe(false);
      expect(s.lit).toBeGreaterThanOrEqual(last);
      expect(s.lit).toBeLessThan(SHIFT_LIGHT_COUNT);
      last = s.lit;
    }
    expect(last).toBe(SHIFT_LIGHT_COUNT - 1);
    expect(shiftLightState(target, target)).toEqual({ lit: SHIFT_LIGHT_COUNT, flash: true });
    expect(shiftLightState(9000, null)).toEqual({ lit: 0, flash: false });
  });

  it('the gear indicator shows neutral, the gear and the gear being selected', () => {
    expect(gearLabel({ gear: 0, shifting: false, targetGear: 0 })).toEqual({ text: 'N', arrow: '' });
    expect(gearLabel({ gear: 3, shifting: false, targetGear: 3 })).toEqual({ text: '3', arrow: '' });
    expect(gearLabel({ gear: 2, shifting: true, targetGear: 3 })).toEqual({ text: '3', arrow: '▲' });
    expect(gearLabel({ gear: 4, shifting: true, targetGear: 3 })).toEqual({ text: '3', arrow: '▼' });
  });

  it('the dyno illustration turns the wheels through the most direct gear', () => {
    for (const car of LAB_CARS) {
      const w = dynoWheelOmega(car, 3000);
      const ratios = car.transmission.gearRatios;
      const direct = ratios.reduce((best, r) => (Math.abs(r - 1) < Math.abs(best - 1) ? r : best), ratios[0]!);
      expect(w).toBeCloseTo((3000 * 2 * Math.PI) / 60 / (direct * car.transmission.finalDrive), 9);
      expect(dynoWheelOmega(car, 0)).toBe(0);
    }
  });
});
