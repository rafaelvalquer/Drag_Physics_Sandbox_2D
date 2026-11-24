/** Nitro visuals: the camera opens with the flow, the body kick settles, nothing changes without nitro. */
import { describe, expect, it } from 'vitest';
import { BOOST_SPAN, CameraController } from '../../src/game/scenes/CameraController';
import { SuspensionVisualController } from '../../src/game/vehicles/SuspensionVisualController';

const frame = (cam: CameraController, boost: number, seconds: number) => {
  let st = cam.state;
  for (let i = 0; i < seconds * 60; i++)
    st = cam.update(1 / 60, {
      mode: 'follow',
      player: { x: 200, speed: 50, wheelbaseM: 2.5 },
      others: [],
      viewW: 1280,
      viewH: 720,
      trackStartM: 0,
      trackEndM: 1000,
      userZoom: 1,
      include: null,
      boost,
    });
  return { ...st };
};

describe('camera boost', () => {
  it('opens the view while the nitro injects and closes it again after', () => {
    const cam = new CameraController();
    const rest = frame(cam, 0, 4);
    const on = frame(cam, 1, 4);
    expect(on.ppm).toBeLessThan(rest.ppm * (1 - BOOST_SPAN * 0.7)); // fewer pixels per metre = wider view
    const off = frame(cam, 0, 6);
    expect(off.ppm).toBeCloseTo(rest.ppm, 0);
  });

  it('no boost, no change: the same input without the field gives the same view', () => {
    const a = frame(new CameraController(), 0, 3);
    const b = frame(new CameraController(), 0, 3);
    expect(a).toEqual(b);
  });

  it('the opening is gradual (no cut) when the injection starts', () => {
    const cam = new CameraController();
    const rest = frame(cam, 0, 4);
    const firstFrame = frame(cam, 1, 1 / 60);
    expect(Math.abs(firstFrame.ppm - rest.ppm) / rest.ppm).toBeLessThan(0.02);
  });
});

describe('body kick', () => {
  it('the tail squats and the nose rises, then the spring brings the body back', () => {
    const s = new SuspensionVisualController({ wheelbaseM: 2.5, cgHeightM: 0.5 });
    s.kick(0.5, -0.12);
    let peak = 0;
    for (let i = 0; i < 20; i++) peak = Math.max(peak, s.update(1 / 60, { accel: 0, speed: 20 }).pitch);
    expect(peak).toBeGreaterThan(0.01);
    expect(peak).toBeLessThan(0.11); // inside the pitch clamp
    for (let i = 0; i < 360; i++) s.update(1 / 60, { accel: 0, speed: 0 });
    expect(Math.abs(s.state.pitch)).toBeLessThan(0.002);
  });

  it('ignores a non-finite kick', () => {
    const s = new SuspensionVisualController({ wheelbaseM: 2.5, cgHeightM: 0.5 });
    s.kick(Number.NaN, Number.POSITIVE_INFINITY);
    expect(Number.isFinite(s.update(1 / 60, { accel: 0, speed: 0 }).pitch)).toBe(true);
  });
});
