/**
 * On-screen stability of the followed car: fixed-step physics → interpolated render state →
 * camera, exactly as the race scene chains them, at several frame rates and irregular frame
 * times. The physics itself is not under test here (the runner tests prove it is independent of
 * the frame rate); what matters is that the car keeps its place on screen in follow and wide and
 * never jumps back and forth, which drawing whole physics steps did.
 */
import { describe, expect, it } from 'vitest';
import { VehicleViews } from '../../src/app/vehicleView';
import { Prng } from '../../src/core/prng';
import { findCar } from '../../src/data/cars/index';
import { TRACKS } from '../../src/data/tracks/index';
import { CameraController, type CameraMode, type CameraTarget } from '../../src/game/scenes/CameraController';
import type { RenderVehicle } from '../../src/game/scenes/renderTypes';
import { PHYSICS_DT, SimulationRunner, type RunnerVehicle } from '../../src/game/SimulationRunner';

const W = 1400;
const H = 860;
const TRACK = TRACKS.find((t) => t.id === 'airfield') ?? TRACKS[0]!;

/** Replaces a vehicle's physics by a constant-speed kinematic model (render pipeline tests only). */
function constantSpeed(v: RunnerVehicle, speed: number, x0 = 0): void {
  const sim = v.sim;
  sim.x = x0;
  sim.body.v = speed;
  const r = sim.car.tires.radiusM;
  sim.step = (h: number): void => {
    sim.x += speed * h;
    sim.wheelAngleFree += (speed / r) * h;
    sim.wheelAngleDriven += (speed / r) * h;
  };
}

interface Frame {
  t: number;
  dt: number;
  screenX: number;
  renderX: number;
  physicsX: number;
  camX: number;
  ppm: number;
  speed: number;
  alpha: number;
  steps: number;
  others: number[];
}

type FrameTimes = (i: number) => number;
const fixed = (fps: number): FrameTimes => () => 1 / fps;
/** 60 fps with ±1.5 ms of timer noise: the pattern measured in the browser (3/1 step pairs). */
const noisy60 = (seed: number): FrameTimes => {
  const rng = new Prng(seed);
  return () => 1 / 60 + rng.bipolar() * 0.0015;
};
/** Anything between 7 and 45 ms per frame, with an occasional 90 ms hitch. */
const irregular = (seed: number): FrameTimes => {
  const rng = new Prng(seed);
  return (i) => (i % 97 === 50 ? 0.09 : 0.007 + rng.next() * 0.038);
};

/** Renders `seconds` of real time like RaceScene.update does and records every frame. */
function render(runner: SimulationRunner, seconds: number, frameTimes: FrameTimes, camMode: CameraMode, opts: { draw?: 'interpolated' | 'physics'; cam?: CameraController; t0?: number } = {}): Frame[] {
  const views = new VehicleViews();
  const cam = opts.cam ?? new CameraController();
  const out: Frame[] = [];
  let t = opts.t0 ?? 0;
  const target = (v: RenderVehicle): CameraTarget => ({ x: v.x, speed: v.speed, wheelbaseM: v.car.wheelbaseM });
  for (let i = 0; t < seconds; i++) {
    const dt = frameTimes(i);
    t += dt;
    runner.advance(dt);
    const list = views.render(runner.vehicles, dt);
    if (opts.draw === 'physics') for (const v of list) v.x = v.physicsX;
    const p = list.find((v) => v.isPlayer)!;
    const s = cam.update(Math.min(0.1, dt), {
      mode: camMode,
      player: target(p),
      others: list.filter((v) => v !== p).map(target),
      viewW: W,
      viewH: H,
      trackStartM: -30,
      trackEndM: TRACK.lengthM + 12,
      userZoom: 1,
      include: null,
    });
    out.push({
      t,
      dt,
      screenX: W / 2 + (p.x - s.x) * s.ppm,
      renderX: p.x,
      physicsX: p.physicsX,
      camX: s.x,
      ppm: s.ppm,
      speed: p.speed,
      alpha: p.interpAlpha,
      steps: p.physicsSteps,
      others: list.filter((v) => v !== p).map((v) => W / 2 + (v.x - s.x) * s.ppm),
    });
  }
  return out;
}

/** Largest deviation (px) of a frame from a uniform motion through its two neighbours (time-aware). */
function jitter(frames: Frame[], key: (f: Frame) => number = (f) => f.screenX): number {
  let worst = 0;
  for (let i = 1; i < frames.length - 1; i++) {
    const a = frames[i - 1]!;
    const b = frames[i]!;
    const c = frames[i + 1]!;
    const k = (b.t - a.t) / (c.t - a.t);
    worst = Math.max(worst, Math.abs(key(b) - (key(a) + (key(c) - key(a)) * k)));
  }
  return worst;
}

/** Screen position of the start line: how the track itself moves on screen. */
const worldX = (f: Frame): number => W / 2 - f.camX * f.ppm;

function spread(frames: Frame[], key: (f: Frame) => number = (f) => f.screenX): number {
  const v = frames.map(key);
  return Math.max(...v) - Math.min(...v);
}

function kinematicRunner(speeds: number[], gaps: number[] = []): SimulationRunner {
  const runner = new SimulationRunner(TRACK);
  const car = findCar('tempest-v8')!;
  speeds.forEach((s, i) => {
    const v = runner.add(car, { id: i === 0 ? 'player' : `o${i}`, lane: i === 0 ? 0 : 1, isPlayer: i === 0 });
    constantSpeed(v, s, gaps[i] ?? 0);
  });
  return runner;
}

describe('render interpolation', () => {
  it('draws lerp(prev, cur, alpha) with 0, 1 and N steps per frame, alpha clamped to 0..1', () => {
    const runner = kinematicRunner([30]);
    const views = new VehicleViews();
    const v = runner.vehicles[0]!;
    // one step, nothing left over: the frame shows exactly the new physics state
    runner.advance(PHYSICS_DT);
    let r = views.render(runner.vehicles, PHYSICS_DT)[0]!;
    expect(v.interp.steps).toBe(1);
    expect(r.interpAlpha).toBeCloseTo(0, 9);
    expect(r.x).toBeCloseTo(v.interp.prev.x, 9);
    expect(v.interp.cur.x - v.interp.prev.x).toBeCloseTo(30 * PHYSICS_DT, 9);
    // half a step: no physics step, halfway between the two states
    runner.advance(PHYSICS_DT / 2);
    r = views.render(runner.vehicles, PHYSICS_DT / 2)[0]!;
    expect(v.interp.steps).toBe(0);
    expect(r.interpAlpha).toBeCloseTo(0.5, 9);
    expect(r.x).toBeCloseTo((v.interp.prev.x + v.interp.cur.x) / 2, 9);
    expect(r.physicsX).toBe(v.sim.x);
    // almost a full step
    runner.advance(PHYSICS_DT * 0.499);
    r = views.render(runner.vehicles, 0)[0]!;
    expect(r.interpAlpha).toBeGreaterThan(0.99);
    expect(r.interpAlpha).toBeLessThanOrEqual(1);
    expect(r.x).toBeLessThanOrEqual(v.sim.x);
    // N steps in one frame: interpolates inside the last step only
    runner.advance(PHYSICS_DT * 3.25);
    r = views.render(runner.vehicles, 0)[0]!;
    expect(v.interp.steps).toBe(4);
    expect(r.x).toBeGreaterThanOrEqual(v.interp.prev.x);
    expect(r.x).toBeLessThanOrEqual(v.interp.cur.x);
    // the renderer never wrote into the simulation
    expect(v.interp.cur.x).toBe(v.sim.x);
  });

  it('the drawn position follows the real clock: one step behind, never jumping by whole steps', () => {
    for (const ft of [fixed(30), fixed(60), fixed(120), fixed(144), noisy60(3), irregular(5)]) {
      const runner = kinematicRunner([50]);
      const frames = render(runner, 3, ft, 'start');
      for (const f of frames.slice(5)) expect(f.renderX).toBeCloseTo(50 * (f.t - PHYSICS_DT), 6);
    }
  });

  it('a reset or a teleport is shown at once, not animated back to the line', () => {
    const runner = kinematicRunner([80]);
    const cam = new CameraController();
    render(runner, 4, fixed(60), 'follow', { cam });
    expect(runner.vehicles[0]!.sim.x).toBeGreaterThan(300);
    // R: the runner resets the car (here the kinematic model keeps its speed, which is fine)
    runner.resetAll();
    constantSpeed(runner.vehicles[0]!, 0, 0);
    const after = render(runner, 4.2, fixed(60), 'follow', { cam, t0: 4 });
    expect(after[0]!.renderX).toBe(0);
    expect(Math.abs(after[0]!.camX - after[0]!.renderX)).toBeLessThan(10);
    // a car moved outside the step loop (car change, editor) is a cut too
    const v = runner.vehicles[0]!;
    v.sim.x = 700;
    runner.advance(PHYSICS_DT / 3);
    const r = new VehicleViews().render(runner.vehicles, 0)[0]!;
    expect(r.x).toBe(700);
    expect(v.interp.prev.x).toBe(700);
  });
});

describe('camera keeps the car steady on screen', () => {
  const RATES: [string, FrameTimes][] = [
    ['30 fps', fixed(30)],
    ['60 fps', fixed(60)],
    ['120 fps', fixed(120)],
    ['144 fps', fixed(144)],
    ['60 fps ± 1.5 ms', noisy60(11)],
    ['irregular 7–45 ms', irregular(13)],
  ];

  for (const kmh of [40, 80, 120, 180, 240, 300]) {
    it(`follow at a constant ${kmh} km/h: residual oscillation below 0.5 px at any frame rate`, () => {
      for (const [name, ft] of RATES) {
        const frames = render(kinematicRunner([kmh / 3.6]), 6, ft, 'follow');
        const settled = frames.filter((f) => f.t > 3.5);
        expect(jitter(settled), `${name} jitter`).toBeLessThan(0.5);
        expect(spread(settled), `${name} spread`).toBeLessThan(2);
      }
    });
  }

  it('the track scrolls just as smoothly under the car (the shake is not moved to the background)', () => {
    for (const [name, ft] of RATES) {
      const frames = render(kinematicRunner([300 / 3.6]), 6, ft, 'follow').filter((f) => f.t > 3.5);
      expect(jitter(frames, worldX), name).toBeLessThan(0.5);
    }
  });

  it('drawing whole physics steps (the old renderer) shakes the picture by many pixels at speed', () => {
    for (const ft of [fixed(144), noisy60(11)]) {
      const frames = render(kinematicRunner([300 / 3.6]), 6, ft, 'follow', { draw: 'physics' }).filter((f) => f.t > 3.5);
      // whichever the camera follows, the car or the track jumps by whole 0.69 m steps
      expect(Math.max(jitter(frames), jitter(frames, worldX))).toBeGreaterThan(10);
    }
  });

  it('wide: both cars in view, smooth zoom, nobody shakes – near and far apart', () => {
    for (const [name, ft] of RATES) {
      // near: same speed 6 m apart; far: the opponent slowly drops back to ~100 m
      for (const [speeds, gaps] of [
        [[60, 60], [0, 6]],
        [[70, 66], [0, 0]],
      ] as const) {
        const frames = render(kinematicRunner([...speeds], [...gaps]), 25, ft, 'wide');
        const settled = frames.filter((f) => f.t > 3);
        // the framing eases with the gap and the zoom: well under a pixel even with 7–90 ms frames
        expect(jitter(settled), `${name} player`).toBeLessThan(1);
        expect(jitter(settled, (f) => f.others[0]!), `${name} opponent`).toBeLessThan(1);
        for (const f of settled) {
          expect(f.screenX).toBeGreaterThan(0);
          expect(f.screenX).toBeLessThan(W);
          expect(f.others[0]!).toBeGreaterThan(0);
          expect(f.others[0]!).toBeLessThan(W);
        }
        // smooth zoom: no jump, the scale changes gradually even across a long frame
        let maxZoomRate = 0;
        for (let i = 1; i < settled.length; i++) maxZoomRate = Math.max(maxZoomRate, Math.abs(settled[i]!.ppm / settled[i - 1]!.ppm - 1) / settled[i]!.dt);
        expect(maxZoomRate, `${name} zoom rate`).toBeLessThan(0.4);
      }
    }
  });

  it('follow with an opponent close by and far away: framing eases, the car does not shake', () => {
    for (const [name, ft] of RATES) {
      const frames = render(kinematicRunner([55, 54], [0, 4]), 30, ft, 'follow');
      expect(jitter(frames.filter((f) => f.t > 2)), name).toBeLessThan(0.5);
    }
  });

  it('start camera stays fixed; the car crosses it smoothly', () => {
    for (const [name, ft] of RATES) {
      const frames = render(kinematicRunner([20]), 1.5, ft, 'start');
      expect(spread(frames, (f) => f.camX), name).toBeLessThan(1e-9);
      expect(jitter(frames.slice(1)), name).toBeLessThan(0.5);
    }
  });

  it('switching the camera mode restarts the tracking (no drift from the previous mode)', () => {
    const runner = kinematicRunner([40]);
    const cam = new CameraController();
    render(runner, 3, fixed(60), 'start', { cam });
    const follow = render(runner, 6, fixed(60), 'follow', { cam, t0: 3 });
    // straight onto the car: the car is on screen in the very first follow frame
    expect(follow[0]!.screenX).toBeGreaterThan(0);
    expect(follow[0]!.screenX).toBeLessThan(W);
    expect(jitter(follow.filter((f) => f.t > 5))).toBeLessThan(0.5);
  });
});

describe('full physics: launch to ~300 km/h with gear changes', () => {
  /** Flat out from the line with upshifts near the redline, rendered at `ft`. */
  function launch(ft: FrameTimes, camMode: CameraMode, seconds: number, draw: boolean): { frames: Frame[]; runner: SimulationRunner } {
    const runner = new SimulationRunner(TRACK);
    const p = runner.add(findCar('aurora-v12-lab')!, { id: 'player', lane: 0, isPlayer: true });
    let ready = false;
    p.control = () => {
      const s = p.sim;
      if (!ready && s.engine.runState === 'RUNNING') {
        ready = true;
        s.requestShift(1);
      }
      s.controls.pedal = ready ? 1 : 0;
      if (s.engine.rpm > s.car.engine.redlineRpm - 250 && !s.shift.active && s.gear >= 1 && s.gear < s.gearbox.gearCount && s.clutchCtl.mode === 'LOCKED') s.requestShift(1);
    };
    const frames = draw ? render(runner, seconds, ft, camMode) : [];
    if (!draw) {
      let t = 0;
      for (let i = 0; t < seconds; i++) {
        const dt = ft(i);
        t += dt;
        runner.advance(dt);
      }
    }
    return { frames, runner };
  }

  it('the car keeps its place on screen through every shift and never moves backwards', () => {
    for (const ft of [fixed(60), fixed(144), noisy60(21), irregular(23)]) {
      const { frames } = launch(ft, 'follow', 24, true);
      const moving = frames.filter((f) => f.speed > 2);
      expect(Math.max(...frames.map((f) => f.speed)) * 3.6).toBeGreaterThan(280);
      for (let i = 1; i < frames.length; i++) expect(frames[i]!.renderX).toBeGreaterThanOrEqual(frames[i - 1]!.renderX - 1e-9);
      // frame-to-frame residual (the "back and forth"): below ~2 px at any speed
      for (const [lo, hi] of [
        [40, 80],
        [80, 120],
        [120, 180],
        [180, 240],
        [240, 300],
      ] as const) {
        const bin = moving.filter((f) => f.speed * 3.6 >= lo && f.speed * 3.6 < hi);
        if (bin.length > 3) expect(jitter(bin), `${lo}-${hi} km/h`).toBeLessThan(2);
      }
    }
  });

  it('rendering does not change the physics (same state with or without drawing)', () => {
    const a = launch(noisy60(31), 'follow', 12, true).runner.vehicles[0]!.sim;
    const b = launch(noisy60(31), 'follow', 12, false).runner.vehicles[0]!.sim;
    expect(a.x).toBe(b.x);
    expect(a.speed).toBe(b.speed);
    expect(a.engine.rpm).toBe(b.engine.rpm);
    expect(a.gear).toBe(b.gear);
  });
});
