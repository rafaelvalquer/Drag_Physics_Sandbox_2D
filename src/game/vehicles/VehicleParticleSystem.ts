import Phaser from 'phaser';
import { Prng } from '../../core/prng';
import type { GraphicsProfile } from '../../app/graphics';
import { FAR_TYRE_OFFSET_M, PPM_BASE, laneScale, laneYPx } from '../scenes/worldScale';
import type { FxFrame } from './fxArt';
import { slipIntensity, smoothstep } from './slip';

/**
 * Vehicle effects: tyre smoke, exhaust puffs, dust, rubber debris and tyre marks.
 *
 * Everything is emitted from the simulated state (slip of the driven tyres, engine events, road
 * speed) and is purely cosmetic. Particles are pooled sprites from one atlas with hard limits
 * per graphics profile; tyre marks are pooled decals with a lifetime.
 */
export const FX_TEXTURE = 'fx';

interface Particle {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  s0: number;
  s1: number;
  a0: number;
  vr: number;
  /** 1/s: how fast the horizontal velocity relaxes to the wind. */
  windK: number;
  gravity: number;
}

interface Mark {
  img: Phaser.GameObjects.Image;
  far: Phaser.GameObjects.Image;
  x0: number;
  x1: number;
  lane: 0 | 1;
  alpha: number;
  age: number;
}

interface MarkTrack {
  open: Mark | null;
  lastX: number;
}

const MARK_FADE_S = [28, 42] as const;

export class VehicleParticleSystem {
  private readonly pool: Particle[] = [];
  private readonly free: number[] = [];
  private readonly marks: Mark[] = [];
  private readonly markTracks = new Map<string, MarkTrack>();
  private readonly acc = new Map<string, number>();
  private readonly rng = new Prng(90210);
  private smokeTint = 0xffffff;
  private live = 0;
  /** Counters for the visual tests (emitted since the scene started). */
  readonly emitted = { smoke: 0, exhaust: 0, dust: 0, debris: 0, marks: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly marksLayer: Phaser.GameObjects.Container,
    private profile: GraphicsProfile,
  ) {}

  setProfile(p: GraphicsProfile): void {
    this.profile = p;
  }

  /** Ambient tint of the white particles (smoke is lit by the scene light). */
  setLighting(tint: number): void {
    this.smokeTint = tint;
  }

  get stats(): { live: number; marks: number; pooled: number } {
    return { live: this.live, marks: this.marks.length, pooled: this.pool.length };
  }

  private rate(key: string, perSecond: number, dt: number): number {
    const a = (this.acc.get(key) ?? 0) + perSecond * this.profile.particleRate * dt;
    const n = Math.floor(a);
    this.acc.set(key, a - n);
    return n;
  }

  private spawn(frame: FxFrame, blend: Phaser.BlendModes = Phaser.BlendModes.NORMAL): Particle | null {
    let p: Particle | undefined;
    const idx = this.free.pop();
    if (idx !== undefined) p = this.pool[idx];
    else if (this.pool.length < this.profile.maxParticles) {
      const img = this.scene.add.image(0, 0, FX_TEXTURE, frame);
      this.layer.add(img);
      p = { img, alive: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, s0: 1, s1: 1, a0: 1, vr: 0, windK: 0, gravity: 0 };
      this.pool.push(p);
    }
    if (!p) return null;
    p.alive = true;
    p.age = 0;
    p.img.setFrame(frame).setBlendMode(blend).setVisible(true).setAlpha(0).setRotation(this.rng.next() * 6.283);
    this.live++;
    return p;
  }

  /**
   * Smoke from a sliding driven tyre. `xM` is the tyre's contact point, `slipSpeed` the speed of
   * the tread relative to the road (ωr − v), `carSpeed` the road speed.
   */
  tyreSmoke(id: string, xM: number, lane: 0 | 1, tyreRadiusM: number, slipRatio: number, slipSpeed: number, carSpeed: number, dt: number): void {
    const k = slipIntensity(slipRatio, slipSpeed);
    if (k <= 0) return;
    const n = this.rate(`s:${id}`, 12 + 70 * k, dt);
    const sc = laneScale(lane);
    for (let i = 0; i < n; i++) {
      const p = this.spawn('smoke');
      if (!p) return;
      const r = this.rng;
      p.x = (xM - tyreRadiusM * (0.1 + r.next() * 1.6)) * PPM_BASE;
      p.y = laneYPx(lane) - (0.05 + r.next() * 0.22 + (r.next() < 0.4 ? FAR_TYRE_OFFSET_M : 0)) * PPM_BASE * sc;
      // the tread throws the smoke backwards; the car's wake drags a little of it along
      p.vx = (-Math.min(9, Math.abs(slipSpeed) * (0.1 + r.next() * 0.45)) * Math.sign(slipSpeed || 1) + carSpeed * 0.12) * PPM_BASE;
      p.vy = -(0.25 + r.next() * 1.1) * PPM_BASE;
      p.life = 1.3 + r.next() * 1.5 + k * 0.6;
      p.s0 = ((0.4 + r.next() * 0.35) * PPM_BASE * sc) / 128;
      p.s1 = ((1.7 + r.next() * 1.5 + k * 0.9) * PPM_BASE * sc) / 128;
      p.a0 = 0.11 + 0.2 * k;
      p.vr = (r.next() - 0.5) * 1.2;
      p.windK = 1.5;
      p.gravity = -0.25 * PPM_BASE;
      p.img.setTint(this.smokeTint);
      this.emitted.smoke++;
    }
    if (this.profile.debris && k > 0.45) {
      const m = this.rate(`d:${id}`, 14 * k, dt);
      for (let i = 0; i < m; i++) {
        const p = this.spawn('speck');
        if (!p) return;
        const r = this.rng;
        p.x = (xM - tyreRadiusM * 0.6) * PPM_BASE;
        p.y = laneYPx(lane) - 0.04 * PPM_BASE;
        p.vx = -(1.5 + r.next() * 4.5) * PPM_BASE;
        p.vy = -(0.6 + r.next() * 2.2) * PPM_BASE;
        p.life = 0.35 + r.next() * 0.4;
        p.s0 = p.s1 = (0.02 + r.next() * 0.03) * PPM_BASE * sc * 0.09;
        p.a0 = 0.9;
        p.vr = 0;
        p.windK = 0;
        p.gravity = 9.8 * PPM_BASE;
        p.img.setTint(0xffffff);
        this.emitted.debris++;
      }
    }
  }

  /** A discreet exhaust puff (engine start, sudden load, afterfire) at world pixel (x, y). */
  exhaustPuff(xPx: number, yPx: number, carSpeed: number, strength: number, count: number, scale = 1): void {
    for (let i = 0; i < count; i++) {
      const p = this.spawn('smoke');
      if (!p) return;
      const r = this.rng;
      p.x = xPx;
      p.y = yPx;
      p.vx = (carSpeed - (1.2 + r.next() * 2.4)) * PPM_BASE;
      p.vy = -(0.1 + r.next() * 0.5) * PPM_BASE;
      p.life = 0.45 + r.next() * 0.5;
      p.s0 = ((0.1 + r.next() * 0.06) * PPM_BASE * scale) / 128;
      p.s1 = ((0.45 + r.next() * 0.4) * PPM_BASE * scale) / 128;
      p.a0 = Math.min(0.42, 0.1 + 0.3 * strength);
      p.vr = (r.next() - 0.5) * 2;
      p.windK = 4;
      p.gravity = -0.5 * PPM_BASE;
      p.img.setTint(Phaser.Display.Color.GetColor(150, 152, 156));
      this.emitted.exhaust++;
    }
  }

  /** Dust lifted from a dusty surface by the car's wake. */
  dust(id: string, xM: number, lane: 0 | 1, carSpeed: number, tint: number, dt: number): void {
    const n = this.rate(`u:${id}`, Math.min(26, (carSpeed - 8) * 0.9), dt);
    const sc = laneScale(lane);
    for (let i = 0; i < n; i++) {
      const p = this.spawn('smoke');
      if (!p) return;
      const r = this.rng;
      p.x = (xM - r.next() * 1.2) * PPM_BASE;
      p.y = laneYPx(lane) - (0.02 + r.next() * 0.12) * PPM_BASE;
      p.vx = carSpeed * (0.2 + r.next() * 0.25) * PPM_BASE;
      p.vy = -(0.2 + r.next() * 0.6) * PPM_BASE;
      p.life = 0.8 + r.next() * 0.9;
      p.s0 = (0.3 * PPM_BASE * sc) / 128;
      p.s1 = ((1.2 + r.next() * 1.1) * PPM_BASE * sc) / 128;
      p.a0 = 0.16 + r.next() * 0.1;
      p.vr = (r.next() - 0.5) * 1.5;
      p.windK = 2.2;
      p.gravity = -0.1 * PPM_BASE;
      p.img.setTint(tint);
      this.emitted.dust++;
    }
  }

  /** Rubber laid by a sliding driven tyre (two streaks: near-side and far-side tyres). */
  tyreMark(id: string, lane: 0 | 1, wheelXM: number, slipRatio: number, slipSpeed: number): void {
    let t = this.markTracks.get(id);
    if (!t || wheelXM < t.lastX - 1) {
      // first frame or the car went back to the start: the old marks belong to the previous run
      if (t) this.clearMarks();
      t = { open: null, lastX: wheelXM };
      this.markTracks.set(id, t);
    }
    t.lastX = wheelXM;
    const k = slipIntensity(slipRatio, slipSpeed);
    if (k < 0.12) {
      t.open = null;
      return;
    }
    const a = Math.min(0.85, 0.3 + 0.55 * k);
    if (t.open && Math.abs(wheelXM - t.open.x1) < 0.8 && t.open.lane === lane) {
      t.open.x1 = Math.max(t.open.x1, wheelXM);
      t.open.alpha = Math.max(t.open.alpha, a);
      t.open.age = 0;
    } else {
      if (this.marks.length >= this.profile.maxMarks) this.dropMark(0);
      const y = laneYPx(lane);
      const sc = laneScale(lane);
      const img = this.scene.add.image(0, y + 0.02 * PPM_BASE, FX_TEXTURE, 'skid').setOrigin(0, 0.5);
      const far = this.scene.add.image(0, y - FAR_TYRE_OFFSET_M * PPM_BASE * sc, FX_TEXTURE, 'skid').setOrigin(0, 0.5);
      this.marksLayer.add([far, img]);
      t.open = { img, far, x0: wheelXM - 0.12, x1: wheelXM + 0.12, lane, alpha: a, age: 0 };
      this.marks.push(t.open);
      this.emitted.marks++;
    }
  }

  private dropMark(i: number): void {
    const m = this.marks[i];
    if (!m) return;
    m.img.destroy();
    m.far.destroy();
    this.marks.splice(i, 1);
    for (const t of this.markTracks.values()) if (t.open === m) t.open = null;
  }

  clearMarks(): void {
    for (const m of this.marks) {
      m.img.destroy();
      m.far.destroy();
    }
    this.marks.length = 0;
    for (const t of this.markTracks.values()) t.open = null;
  }

  forget(id: string): void {
    this.markTracks.delete(id);
    for (const k of [...this.acc.keys()]) if (k.endsWith(`:${id}`)) this.acc.delete(k);
  }

  /** Advances every live particle and mark. `windMs` is the track wind (+ = towards the front). */
  update(dt: number, windMs: number, x0M: number, x1M: number): void {
    const windPx = windMs * PPM_BASE;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i]!;
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        p.img.setVisible(false);
        this.free.push(i);
        this.live--;
        continue;
      }
      if (p.windK > 0) p.vx += (windPx - p.vx) * Math.min(1, p.windK * dt);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity > 0 && p.y > 0) {
        // debris stops on the ground
        p.y = 0;
        p.vx *= 0.5;
        p.vy = 0;
      }
      const t = p.age / p.life;
      const grow = 1 - (1 - t) * (1 - t);
      const fadeIn = Math.min(1, p.age / 0.07);
      p.img.setPosition(p.x, p.y);
      p.img.setScale(p.s0 + (p.s1 - p.s0) * grow);
      p.img.setAlpha(p.a0 * fadeIn * (1 - t) ** 1.4);
      if (p.vr !== 0) p.img.rotation += p.vr * dt;
    }
    const sh = (0.19 * PPM_BASE) / 20;
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i]!;
      m.age += dt;
      if (m.age > MARK_FADE_S[1]) {
        this.dropMark(i);
        continue;
      }
      const visible = m.x1 > x0M && m.x0 < x1M;
      m.img.setVisible(visible);
      m.far.setVisible(visible);
      if (!visible) continue;
      const fade = 1 - smoothstep(MARK_FADE_S[0], MARK_FADE_S[1], m.age);
      const sc = laneScale(m.lane);
      const w = Math.max(0.05, m.x1 - m.x0) * PPM_BASE;
      m.img.setPosition(m.x0 * PPM_BASE, m.img.y).setScale(w / 128, sh * sc).setAlpha(m.alpha * fade);
      m.far.setPosition(m.x0 * PPM_BASE, m.far.y).setScale(w / 128, sh * sc * 0.75).setAlpha(m.alpha * fade * 0.8);
    }
  }

  clear(): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i]!;
      if (p.alive) {
        p.alive = false;
        p.img.setVisible(false);
        this.free.push(i);
      }
    }
    this.live = 0;
    this.clearMarks();
    this.markTracks.clear();
    this.acc.clear();
  }

  destroy(): void {
    for (const p of this.pool) p.img.destroy();
    this.pool.length = 0;
    this.free.length = 0;
    this.clearMarks();
  }
}
