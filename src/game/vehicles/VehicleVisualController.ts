import Phaser from 'phaser';
import { Prng } from '../../core/prng';
import type { GraphicsProfile } from '../../app/graphics';
import { spriteTint, type LightingState } from '../scenes/LightingController';
import type { RenderVehicle } from '../scenes/renderTypes';
import { PPM_BASE, laneScale, laneYPx } from '../scenes/worldScale';
import { SuspensionVisualController } from './SuspensionVisualController';
import { prefersReducedMotion } from '../scenes/reducedMotion';
import { FX_TEXTURE, type VehicleParticleSystem } from './VehicleParticleSystem';
import { assembleVehicleSprites, type FrameName, type VehicleSpriteSet } from './VehicleSpriteAssembler';
import { WheelAnimationController } from './WheelAnimationController';

/**
 * Registers vehicle atlases as Phaser textures, shared by reference count so the same artwork is
 * uploaded once and removed when the last vehicle using it goes away (no leak when cars change).
 */
export class VehicleTextureRegistry {
  private readonly refs = new Map<string, number>();
  private readonly keys = new Map<string, string>();
  private counter = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  acquire(set: VehicleSpriteSet): string {
    let key = this.keys.get(set.key);
    if (!key || !this.scene.textures.exists(key)) {
      key = `veh-${++this.counter}`;
      const tex = this.scene.textures.addCanvas(key, set.atlas);
      if (!tex) throw new Error('vehicle texture could not be created');
      for (const [name, f] of Object.entries(set.frames)) tex.add(name, 0, f.x, f.y, f.w, f.h);
      this.keys.set(set.key, key);
      this.refs.set(key, 0);
    }
    this.refs.set(key, (this.refs.get(key) ?? 0) + 1);
    return key;
  }

  release(key: string): void {
    const n = (this.refs.get(key) ?? 1) - 1;
    if (n > 0) {
      this.refs.set(key, n);
      return;
    }
    this.refs.delete(key);
    for (const [k, v] of this.keys) if (v === key) this.keys.delete(k);
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }

  get liveTextures(): number {
    return this.refs.size;
  }
}

export interface VehicleEnvironment {
  lighting: LightingState;
  profile: GraphicsProfile;
  /** Tint of the dust lifted on this surface, or null when the surface is clean. */
  dustTint: number | null;
  onScreen: boolean;
}

interface WheelSprites {
  hub: Phaser.GameObjects.Image;
  sharp: Phaser.GameObjects.Image;
  soft: Phaser.GameObjects.Image;
  full: Phaser.GameObjects.Image;
}

interface Parts {
  texKey: string;
  set: VehicleSpriteSet;
  shadow: Phaser.GameObjects.Image;
  beam: Phaser.GameObjects.Image;
  under: Phaser.GameObjects.Image;
  rear: WheelSprites;
  front: WheelSprites;
  body: Phaser.GameObjects.Image;
  gloss: Phaser.GameObjects.Image;
  lights: Phaser.GameObjects.Image;
  brake: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Image;
  nflame: Phaser.GameObjects.Image;
  nglow: Phaser.GameObjects.Image;
  all: Phaser.GameObjects.Image[];
}

export interface VehicleVisualInfo {
  loaded: boolean;
  pxPerM: number;
  /** Root position (world px) and scale. */
  rootX: number;
  rootY: number;
  rootScale: number;
  /** Size of the body sprite on screen relative to its texture (must be uniform). */
  bodyScaleX: number;
  bodyScaleY: number;
  /** Wheel centres and radius in root-local pixels. */
  wheels: { x: number; y: number; r: number }[];
  lengthM: number;
  wheelbaseM: number;
  pitch: number;
  heave: number;
  wheelLayers: { rear: [number, number, number]; front: [number, number, number] };
  lightsOn: boolean;
  brakeOn: boolean;
}

/**
 * One vehicle on screen. Assembles the sprite layers and turns the physics state into motion:
 * wheel rotation and blur from the wheel speeds, body pitch and heave from the acceleration
 * (visual suspension), idle shake from the engine, lamps from the lighting and the brakes, and
 * smoke, marks and exhaust puffs through the particle system.
 */
export class VehicleVisualController {
  readonly root: Phaser.GameObjects.Container;
  private parts: Parts | null = null;
  private artKey = '';
  private pxPerM = 0;
  private loading = '';
  private susp: SuspensionVisualController | null = null;
  private readonly wheelCtl = new WheelAnimationController();
  private readonly shake = new Prng(7);
  private brakeGlow = 0;
  private loadSlow = 0;
  private puffCooldown = 0;
  private crankPuff = 0;
  private blownPuff = 0;
  private nitroPuff = 0;
  /** Smoothed N₂O flow (0..1) drawn as light and flame; the previous raw flow detects a new injection. */
  private nitroGlow = 0;
  private nitroPrev = 0;
  private wasRunning = false;
  private lastX = 0;
  private destroyed = false;
  private last: { pitch: number; heave: number; layers: VehicleVisualInfo['wheelLayers']; lights: boolean } = {
    pitch: 0,
    heave: 0,
    layers: { rear: [1, 0, 0], front: [1, 0, 0] },
    lights: false,
  };

  constructor(
    private readonly scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    private readonly registry: VehicleTextureRegistry,
    private readonly particles: VehicleParticleSystem,
    readonly id: string,
  ) {
    this.root = scene.add.container(0, 0);
    parent.add(this.root);
  }

  private build(v: RenderVehicle, pxPerM: number): void {
    const want = `${v.artKey}|${pxPerM}`;
    if (this.loading === want) return;
    this.loading = want;
    assembleVehicleSprites(v.car, pxPerM)
      .then((set) => {
        if (this.destroyed || this.loading !== want) return;
        const old = this.parts;
        const texKey = this.registry.acquire(set);
        const img = (frame: FrameName): Phaser.GameObjects.Image => this.scene.add.image(0, 0, texKey, frame);
        const s = PPM_BASE / set.meta.pxPerM;
        const o = set.meta.bodyOriginPx;
        const bodyFrame = set.frames.body;
        const layer = (frame: FrameName): Phaser.GameObjects.Image => img(frame).setOrigin(o.x / bodyFrame.w, o.y / bodyFrame.h).setScale(s);
        const wheel = (hub: FrameName): WheelSprites => ({ hub: img(hub).setScale(s), sharp: img('wheel').setScale(s), soft: img('wheelSoft').setScale(s).setAlpha(0), full: img('wheelFull').setScale(s).setAlpha(0) });
        const shadow = img('shadow').setScale(s);
        const beam = this.scene.add.image(0, 0, FX_TEXTURE, 'beam').setOrigin(0.02, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        const under = layer('under');
        const rear = wheel('hubRear');
        const front = wheel('hub');
        const body = layer('body');
        const gloss = layer('gloss');
        const lights = layer('lights').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        const brake = layer('brake').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        const flame = this.scene.add.image(0, 0, FX_TEXTURE, 'flame').setOrigin(1, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        const nflame = this.scene.add.image(0, 0, FX_TEXTURE, 'nflame').setOrigin(1, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        const nglow = this.scene.add.image(0, 0, FX_TEXTURE, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x58b4ff).setVisible(false);
        const all = [shadow, beam, under, rear.hub, rear.sharp, rear.soft, rear.full, front.hub, front.sharp, front.soft, front.full, body, gloss, lights, brake, nglow, flame, nflame];
        this.root.add(all);
        this.parts = { texKey, set, shadow, beam, under, rear, front, body, gloss, lights, brake, flame, nflame, nglow, all };
        this.artKey = v.artKey;
        this.pxPerM = pxPerM;
        this.susp = new SuspensionVisualController({ wheelbaseM: v.car.wheelbaseM, cgHeightM: v.car.cgHeightM });
        if (old) this.dispose(old);
      })
      .catch((e: unknown) => console.error('vehicle art failed', e));
  }

  private dispose(p: Parts): void {
    for (const o of p.all) o.destroy();
    this.registry.release(p.texKey);
  }

  /** Visual idle shake (m, rad) of the body on its mounts; larger with fewer cylinders. */
  private idleShake(v: RenderVehicle): [number, number] {
    // N₂O: the exhaust shakes the body in proportion to the flow (small, bounded; off with reduced motion)
    const nf = v.nitrous ?? 0;
    if (nf > 0.02 && v.running && !prefersReducedMotion()) return [0.007 * nf * this.shake.bipolar(), 0.003 * nf * this.shake.bipolar()];
    if (v.cranking) return [0.004 * this.shake.bipolar(), 0.0018 * this.shake.bipolar()];
    if (!v.running || v.speed > 3) return [0, 0];
    const idle = v.car.engine.idleRpm;
    const fade = Math.min(1, Math.max(0, 1 - (v.rpm - idle) / 2500));
    if (fade <= 0) return [0, 0];
    const cyl = Math.min(1.6, Math.max(0.7, Math.sqrt(8 / v.car.engine.cylinders)));
    return [0.0045 * cyl * fade * this.shake.bipolar(), 0.0016 * cyl * fade * this.shake.bipolar()];
  }

  sync(v: RenderVehicle, dtS: number, env: VehicleEnvironment): void {
    const pxPerM = env.profile.carPxPerM;
    if (v.artKey !== this.artKey || pxPerM !== this.pxPerM) this.build(v, pxPerM);
    const sc = laneScale(v.lane);
    const ly = laneYPx(v.lane);
    this.root.setPosition(v.x * PPM_BASE, ly).setScale(sc);
    const teleported = Math.abs(v.x - this.lastX) > 20;
    this.lastX = v.x;
    const p = this.parts;
    if (!p || !this.susp) return;
    if (teleported) this.susp.reset();
    const m = p.set.meta;
    const L = env.lighting;
    const tint = spriteTint(L);

    // ---- body on its suspension
    // N₂O: a new injection kicks the body (nose up, tail squats), then the spring settles it
    const nitroNow = v.nitrous ?? 0;
    if (nitroNow > 0.05 && this.nitroPrev <= 0.05 && !prefersReducedMotion()) this.susp.kick(0.5, -0.12);
    this.nitroPrev = nitroNow;
    this.nitroGlow += (nitroNow - this.nitroGlow) * Math.min(1, dtS / 0.08);
    const ng = this.nitroGlow;
    const st = this.susp.update(dtS, { accel: v.accel, speed: v.speed });
    const [shakeY, shakeRot] = this.idleShake(v);
    const rot = -(st.pitch + shakeRot);
    const px = m.centre.x * PPM_BASE;
    const py = -m.centre.y * PPM_BASE;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const bx = px + (0 - px) * cos - (0 - py) * sin;
    const by = py + (0 - px) * sin + (0 - py) * cos - (st.heave + shakeY) * PPM_BASE;
    for (const o of [p.under, p.body, p.gloss, p.lights, p.brake]) o.setPosition(bx, by).setRotation(rot);
    p.under.setTint(tint);
    p.body.setTint(tint);
    p.gloss.setTint(Number.parseInt(L.gloss.color.slice(1), 16)).setAlpha(L.gloss.alpha);

    // ---- wheels: on the ground, turning with the simulated wheel speed
    const rearDriven = v.car.drivenAxle === 'rear';
    this.wheelCtl.mode = env.profile.wheelBlur;
    const setWheel = (w: WheelSprites, xM: number, angle: number, omega: number): [number, number, number] => {
      const x = xM * PPM_BASE;
      const y = -m.tyreRadiusM * PPM_BASE;
      const a = this.wheelCtl.layers(omega);
      w.hub.setPosition(x, y).setTint(tint);
      w.sharp.setPosition(x, y).setRotation(angle).setAlpha(a.sharp).setTint(tint);
      w.soft.setPosition(x, y).setRotation(angle).setAlpha(a.soft).setTint(tint);
      w.full.setPosition(x, y).setRotation(angle).setAlpha(a.full).setTint(tint);
      return [a.sharp, a.soft, a.full];
    };
    const lr = setWheel(p.rear, -m.wheelbaseM, rearDriven ? v.wheelAngleDriven : v.wheelAngleFree, rearDriven ? v.wheelOmegaDriven : v.wheelOmegaFree);
    const lf = setWheel(p.front, 0, rearDriven ? v.wheelAngleFree : v.wheelAngleDriven, rearDriven ? v.wheelOmegaFree : v.wheelOmegaDriven);

    // ---- contact shadow
    p.shadow
      .setPosition(((m.rearX + m.noseX) / 2 + L.shadow.offsetM) * PPM_BASE, -0.07 * PPM_BASE)
      .setScale((PPM_BASE / m.pxPerM) * L.shadow.stretch, PPM_BASE / m.pxPerM)
      .setAlpha(L.shadow.alpha * Math.max(0.6, 1 - Math.abs(st.heave) * 4));

    // ---- lamps
    const lampsOn = L.headlights && v.running;
    // N₂O lights the lamps (day or night) in blue-white, and the tail turns blue; both fade with the flow
    const nitroLamps = ng > 0.03 && v.running;
    p.lights.setVisible(lampsOn || nitroLamps);
    if (nitroLamps) p.lights.setTint(0xb4e2ff).setAlpha(lampsOn ? 1 : Math.min(1, ng * 1.4));
    else p.lights.clearTint().setAlpha(1);
    this.brakeGlow += ((v.braking ? 1 : 0) - this.brakeGlow) * Math.min(1, dtS / 0.06);
    const tailNitro = ng > 0.03;
    p.brake.setVisible(this.brakeGlow > 0.02 || tailNitro).setAlpha(Math.max(this.brakeGlow, tailNitro ? Math.min(1, ng * 1.2) : 0));
    if (tailNitro) p.brake.setTint(0x6ac8ff);
    else p.brake.clearTint();
    const beamOn = (lampsOn || nitroLamps) && env.profile.glow;
    p.beam.setVisible(beamOn);
    if (beamOn) {
      p.beam
        .setPosition(m.headlight.x * PPM_BASE, -m.headlight.y * PPM_BASE)
        .setScale(((11 + 3 * ng) * PPM_BASE) / 320, ((2.6 + 0.6 * ng) * PPM_BASE) / 128)
        .setRotation(rot + 0.05)
        .setAlpha(Math.max(lampsOn ? 0.75 * L.glow : 0, 0.55 * ng))
        .setTint(nitroLamps ? 0x9fdcff : 0xfff1c8);
    }

    // ---- exhaust flame (afterfire)
    const ex = m.exhausts[0] ?? { x: m.rearX, y: 0.3 };
    p.flame.setVisible(v.afterfire);
    if (v.afterfire) {
      const jet = 1 + 0.25 * nitroNow;
      p.flame.setPosition(ex.x * PPM_BASE, -ex.y * PPM_BASE).setScale((0.45 + Math.random() * 0.35) * (PPM_BASE / 40) * jet, 0.4 + Math.random() * 0.3);
    }

    // ---- N₂O flame at the pipe (blue-white, longer and brighter with the flow) and the glow behind it
    const flameOn = ng > 0.03;
    p.nflame.setVisible(flameOn);
    p.nglow.setVisible(flameOn && env.profile.glow);
    if (flameOn) {
      const flick = env.profile.glow ? 0.85 + 0.3 * Math.random() : 1;
      p.nflame
        .setPosition(ex.x * PPM_BASE, -ex.y * PPM_BASE)
        .setRotation(rot)
        .setScale((0.2 + 0.45 * ng) * (PPM_BASE / 40) * flick, (0.35 + 0.25 * ng) * (0.9 + 0.2 * Math.random()))
        .setAlpha(Math.min(0.95, 0.5 + 0.45 * ng));
      p.nglow
        .setPosition(ex.x * PPM_BASE - 0.15 * PPM_BASE, -ex.y * PPM_BASE)
        .setScale((0.12 + 0.14 * ng) * (PPM_BASE / 40))
        .setAlpha(0.55 * ng);
    }

    this.last = { pitch: st.pitch, heave: st.heave, layers: { rear: lr, front: lf }, lights: lampsOn };

    // ---- effects from the physics state
    this.puffCooldown = Math.max(0, this.puffCooldown - dtS);
    this.loadSlow += (v.load - this.loadSlow) * (1 - Math.exp(-dtS / 0.3));
    const exX = v.x * PPM_BASE + ex.x * PPM_BASE * sc;
    const exY = ly - ex.y * PPM_BASE * sc;
    const started = v.running && !this.wasRunning;
    this.wasRunning = v.running;
    if (!env.onScreen) return;
    const drivenX = rearDriven ? v.x - m.wheelbaseM : v.x;
    this.particles.tyreSmoke(this.id, drivenX, v.lane, m.tyreRadiusM, v.slipRatio, v.slipSpeed, v.speed, dtS);
    this.particles.tyreMark(this.id, v.lane, drivenX, v.slipRatio, v.slipSpeed);
    if (started) this.particles.exhaustPuff(exX, exY, v.speed, 0.9, 6, sc);
    if (v.cranking) {
      this.crankPuff += dtS;
      if (this.crankPuff > 0.22) {
        this.crankPuff = 0;
        this.particles.exhaustPuff(exX, exY, v.speed, 0.5, 1, sc);
      }
    }
    if (v.afterfire && this.puffCooldown <= 0) {
      this.puffCooldown = 0.12;
      this.particles.exhaustPuff(exX, exY, v.speed, 0.7, 2, sc);
    }
    // a sudden load step enriches the mixture for a moment: one small puff, not a constant cloud
    if (v.running && v.load - this.loadSlow > 0.32 && this.puffCooldown <= 0) {
      this.puffCooldown = 0.5;
      this.particles.exhaustPuff(exX, exY, v.speed, 0.45, 2, sc);
    }
    // blown engine: light smoke out of the bonnet (front of the body), a few puffs per second
    if (v.blown) {
      this.blownPuff += dtS;
      if (this.blownPuff > 0.18) {
        this.blownPuff = 0;
        const hoodX = v.x * PPM_BASE + (m.noseX - 0.6) * PPM_BASE * sc;
        const hoodY = ly - 0.95 * PPM_BASE * sc;
        this.particles.exhaustPuff(hoodX, hoodY, v.speed, 0.55, 1, sc * 1.4);
      }
    }
    // N₂O: a purge-like burst of puffs while injecting, denser with more flow; none when it is idle
    const nf = v.nitrous ?? 0;
    if (nf > 0.02) {
      this.nitroPuff += dtS;
      if (this.nitroPuff > 0.14 - 0.08 * nf) {
        this.nitroPuff = 0;
        this.particles.exhaustPuff(exX, exY, v.speed, 0.4 + 0.5 * nf, 1, sc);
      }
    } else this.nitroPuff = 0;
    if (env.dustTint !== null && v.speed > 8) this.particles.dust(this.id, v.x - m.wheelbaseM - 0.4, v.lane, v.speed, env.dustTint, dtS);
  }

  info(): VehicleVisualInfo {
    const p = this.parts;
    const m = p?.set.meta;
    return {
      loaded: !!p,
      pxPerM: this.pxPerM,
      rootX: this.root.x,
      rootY: this.root.y,
      rootScale: this.root.scaleX,
      bodyScaleX: p ? p.body.scaleX : 0,
      bodyScaleY: p ? p.body.scaleY : 0,
      wheels: p && m ? [p.rear.sharp, p.front.sharp].map((w) => ({ x: w.x, y: w.y, r: m.tyreRadiusM * PPM_BASE })) : [],
      lengthM: m?.lengthM ?? 0,
      wheelbaseM: m?.wheelbaseM ?? 0,
      pitch: this.last.pitch,
      heave: this.last.heave,
      wheelLayers: this.last.layers,
      lightsOn: this.last.lights,
      brakeOn: this.brakeGlow > 0.5,
    };
  }

  /** Top of the car in root-local pixels (for the "you" marker). */
  get topPx(): number {
    return -(this.parts?.set.meta.roofY ?? 1.4) * PPM_BASE;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.parts) this.dispose(this.parts);
    this.parts = null;
    this.particles.forget(this.id);
    this.root.destroy();
  }
}
