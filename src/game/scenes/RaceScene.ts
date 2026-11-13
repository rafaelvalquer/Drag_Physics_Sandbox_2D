import Phaser from 'phaser';
import type { CarConfig, TrackConfig } from '../../data/schema';
import { Prng } from '../../core/prng';
import { buildCarArt, svgToCanvas, type CarArt } from '../vehicles/carArt';
import { THEMES, buildAsphalt, buildFlame, buildParallax, buildProp, buildPuff, type PropKind } from './trackArt';

/** World texture scale: 1 m = PPM_BASE px inside the world container (zoom scales the container). */
export const PPM_BASE = 40;
const LANE_GAP_M = 1.9;
/** The track's visible extent: the camera never shows more than this before the start line. */
const TRACK_START_M = -30;
/** Barrier behind the far lane: its foot sits this far behind the far lane's outer edge (m). */
const BARRIER_GAP_M = 0.25;
const BARRIER_H_M = 2.4;
/** Slip speed (m/s) above which the driven tyres lay rubber on the asphalt. */
const SKID_SLIP_MS = 2.5;
const MAX_MARKS = 400;

export interface RenderVehicle {
  id: string;
  car: CarConfig;
  /** Front axle ground contact, metres along the track (0 = start line). */
  x: number;
  lane: 0 | 1;
  pitch: number;
  wheelAngleDriven: number;
  wheelAngleFree: number;
  slipSpeed: number;
  speed: number;
  afterfire: boolean;
  isPlayer: boolean;
  /** Changes whenever the car's visual config changes (texture rebuild). */
  artKey: string;
  /** Engine speed (rpm) and whether it is running – drives idle shake and exhaust pulses. */
  rpm: number;
  running: boolean;
  /** Engine load 0..1 (exhaust pulse strength). */
  load: number;
  /** Display name for the off-screen indicator. */
  name: string;
}

export interface TreeLights {
  /** per lane (0 near, 1 far) */
  prestage: [boolean, boolean];
  stage: [boolean, boolean];
  /** number of amber bulbs lit from the top (0..3) */
  amber: [number, number];
  green: [boolean, boolean];
  red: [boolean, boolean];
}

export interface TrackMarker {
  xM: number;
  label: string;
  major: boolean;
}

export type CameraMode = 'follow' | 'wide' | 'start';

export interface SceneBridge {
  /** Advance the simulation by the real frame time (s). */
  tick(dtS: number): void;
  vehicles(): RenderVehicle[];
  track(): TrackConfig;
  markers(): TrackMarker[];
  tree(): TreeLights | null;
  /** Finish line position (m) or null. */
  finishM(): number | null;
  cameraMode: CameraMode;
  /** User zoom multiplier (settings), 1 = default. */
  zoom(): number;
}

interface CarView {
  key: string;
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image | null;
  wheels: Phaser.GameObjects.Image[];
  flame: Phaser.GameObjects.Image;
  beam: Phaser.GameObjects.Graphics;
  art: CarArt;
  loading: boolean;
  placeholder: Phaser.GameObjects.Rectangle;
}

interface Prop {
  obj: Phaser.GameObjects.Image;
  x0: number;
  x1: number;
  kind: PropKind;
}

interface MarkTrack {
  segs: { lane: 0 | 1; x0: number; x1: number; alpha: number }[];
  open: { lane: 0 | 1; x0: number; x1: number; alpha: number } | null;
  lastX: number;
}

interface Indicator {
  box: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

/**
 * Side-view rendering of the track and the vehicles. Purely a view: every position, wheel angle,
 * pitch and slip comes from the physics through the bridge; the scene never changes the state.
 * Cosmetic effects (tyre marks, exhaust puffs, idle shake) are derived from that state only.
 */
export class RaceScene extends Phaser.Scene {
  private bridge!: SceneBridge;
  /** Props behind the barrier (grandstands, buildings) – same transform as `world`. */
  private backWorld!: Phaser.GameObjects.Container;
  private world!: Phaser.GameObjects.Container;
  private sky!: Phaser.GameObjects.Graphics;
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private ground!: Phaser.GameObjects.Rectangle;
  private asphalt!: Phaser.GameObjects.TileSprite;
  private barrier!: Phaser.GameObjects.TileSprite;
  private frontProps!: Phaser.GameObjects.Container;
  private marksG!: Phaser.GameObjects.Graphics;
  private lines!: Phaser.GameObjects.Graphics;
  private treeG!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Graphics;
  private youLabel!: Phaser.GameObjects.Text;
  private labels: Phaser.GameObjects.Text[] = [];
  private cars = new Map<string, CarView>();
  private props: Prop[] = [];
  private marks = new Map<string, MarkTrack>();
  private indicators = new Map<string, Indicator>();
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Exhaust puff emitters by strength (light / medium / heavy load). */
  private exhaust: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private themeId = '';
  private propsKey = '';
  private camX = 0;
  private ppm = 34;
  private groundScreenY = 0;
  private smokeAcc = new Map<string, number>();
  private exhaustAcc = new Map<string, number>();
  private dustAcc = new Map<string, number>();
  private lastNow = 0;
  private shakeRng = new Prng(7);

  constructor() {
    super('race');
  }

  init(data: { bridge: SceneBridge }): void {
    this.bridge = data.bridge;
  }

  create(): void {
    this.textures.addCanvas('puff', buildPuff());
    this.textures.addCanvas('flame', buildFlame());
    this.sky = this.add.graphics().setScrollFactor(0).setDepth(-100);
    this.ground = this.add.rectangle(0, 0, 10, 10, 0x000000).setOrigin(0, 0).setDepth(-20);
    this.backWorld = this.add.container(0, 0).setDepth(-7);
    this.world = this.add.container(0, 0).setDepth(0);
    this.frontProps = this.add.container(0, 0);
    this.marksG = this.add.graphics();
    this.lines = this.add.graphics();
    this.treeG = this.add.graphics();
    this.glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.smoke = this.add.particles(0, 0, 'puff', {
      lifespan: { min: 900, max: 1700 },
      speedX: { min: -30, max: 10 },
      speedY: { min: -40, max: -10 },
      scale: { start: 0.35, end: 1.6 },
      alpha: { start: 0.55, end: 0 },
      rotate: { min: 0, max: 360 },
      emitting: false,
    });
    this.dust = this.add.particles(0, 0, 'puff', {
      lifespan: { min: 700, max: 1400 },
      speedX: { min: -60, max: -10 },
      speedY: { min: -25, max: -5 },
      scale: { start: 0.25, end: 1.3 },
      alpha: { start: 0.35, end: 0 },
      tint: 0xd2a874,
      emitting: false,
    });
    this.exhaust = [0.1, 0.2, 0.36].map((a) =>
      this.add.particles(0, 0, 'puff', {
        lifespan: { min: 350, max: 700 },
        speedX: { min: -70, max: -35 },
        speedY: { min: -12, max: 4 },
        scale: { start: 0.06, end: 0.42 },
        alpha: { start: a, end: 0 },
        tint: 0xb9bcc0,
        emitting: false,
      }),
    );
    this.world.add([this.frontProps, this.marksG, this.lines, this.treeG, ...this.exhaust, this.dust, this.smoke, this.glow]);
    this.ui = this.add.graphics().setScrollFactor(0).setDepth(40);
    this.youLabel = this.add
      .text(0, 0, 'VOCÊ', { fontFamily: 'system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#101418', backgroundColor: '#f2b705', padding: { x: 5, y: 2 } })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(41)
      .setVisible(false);
    this.applyTheme();
    this.scale.on('resize', () => this.applyTheme(true));
  }

  private applyTheme(force = false): void {
    const track = this.bridge.track();
    const pk = `${track.id}|${track.theme}|${track.lengthM}`;
    if (pk !== this.propsKey) {
      this.propsKey = pk;
      this.buildProps(track);
      this.marks.clear();
    }
    if (!force && this.themeId === track.theme) return;
    this.themeId = track.theme;
    const p = THEMES[track.theme];
    const W = this.scale.width;
    const H = this.scale.height;
    this.groundScreenY = Math.round(H * 0.74);
    this.sky.clear();
    this.sky.fillGradientStyle(hex(p.skyTop), hex(p.skyTop), hex(p.skyBottom), hex(p.skyBottom), 1);
    this.sky.fillRect(0, 0, W, this.groundScreenY);
    for (const l of this.layers) l.destroy();
    this.layers = [];
    for (const layer of [0, 1, 2] as const) {
      const key = `px-${track.theme}-${layer}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, buildParallax(track.theme, layer));
      // 2 px trimmed from the texture edges: with linear filtering + repeat wrap the filled
      // bottom row would otherwise bleed into the transparent top row as a thin line
      const ts = this.add
        .tileSprite(0, Math.round(this.groundScreenY - 256 * (1 - layer * 0.12) - 70) + 2, W, 252, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-90 + layer);
      ts.tilePositionY = 2;
      this.layers.push(ts);
    }
    this.ground.setPosition(0, this.groundScreenY - 70).setSize(W, H - this.groundScreenY + 70).setFillStyle(hex(p.ground));
    const ak = `asphalt-${track.theme}`;
    if (!this.textures.exists(ak)) this.textures.addCanvas(ak, buildAsphalt(track.theme));
    this.asphalt?.destroy();
    this.asphalt = this.add.tileSprite(0, 0, W, 120, ak).setOrigin(0, 0).setScrollFactor(0).setDepth(-10);
    const bk = `prop-${track.theme}-barrier`;
    if (!this.textures.exists(bk)) this.textures.addCanvas(bk, buildProp('barrier', track.theme, PPM_BASE));
    this.barrier?.destroy();
    this.barrier = this.add.tileSprite(0, 0, W, BARRIER_H_M * PPM_BASE, bk).setOrigin(0, 1).setScrollFactor(0).setDepth(-5);
    this.cameras.main.setBackgroundColor(p.skyBottom);
  }

  /** Trackside props in world space. The layout is deterministic per track. */
  private buildProps(track: TrackConfig): void {
    for (const pr of this.props) pr.obj.destroy();
    this.props = [];
    const theme = track.theme;
    const L = track.lengthM;
    const footY = -(LANE_GAP_M + 0.9 + BARRIER_GAP_M) * PPM_BASE;
    const add = (kind: PropKind, xM: number, variant = 0, front = false): void => {
      const key = `prop-${theme}-${kind}-${variant}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, buildProp(kind, theme, PPM_BASE, variant));
      const tex = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
      // front props stand just in front of the barrier, the rest behind it
      const y = front ? footY + 0.15 * PPM_BASE : footY - 0.05 * PPM_BASE;
      const img = this.add.image(xM * PPM_BASE, y, key).setOrigin(0.5, 1);
      (front ? this.frontProps : this.backWorld).add(img);
      const half = tex.width / PPM_BASE / 2;
      this.props.push({ obj: img, x0: xM - half, x1: xM + half, kind });
    };
    const rng = new Prng(track.id.length * 13 + Math.round(L));
    switch (theme) {
      case 'testTrack':
        for (const x of [-10, 22, 54]) add('grandstand', x);
        add('pitbox', 140);
        add('pitbox', 620);
        add('sign', 220, 0, true);
        add('sign', L - 160, 4, true);
        break;
      case 'desert':
        add('grandstand', 4);
        add('sign', -20, 0, true);
        add('sign', 180, 2, true);
        add('sign', 760, 3, true);
        for (let x = 40; x < L; x += 25 + rng.next() * 45) add('cactus', x, Math.floor(rng.next() * 3));
        break;
      case 'nightIndustrial':
        for (let x = 8; x < L + 10; x += 30) add('lamp', x, 0, true);
        add('pitbox', 90);
        add('pitbox', 520);
        add('sign', 160, 1, true);
        add('sign', L - 200, 4, true);
        break;
      case 'airfield':
        add('tower', 150);
        add('windsock', 60);
        add('windsock', 540);
        add('pitbox', 300);
        add('sign', 30, 0, true);
        add('sign', L - 180, 4, true);
        break;
    }
  }

  private ensureCar(v: RenderVehicle): CarView {
    let view = this.cars.get(v.id);
    if (view && view.key === v.artKey) return view;
    if (view) {
      view.root.destroy();
      this.cars.delete(v.id);
    }
    const art = buildCarArt(v.car);
    const root = this.add.container(0, 0);
    const s = PPM_BASE / art.scale;
    const placeholder = this.add.rectangle(-(art.frontAxleX - art.bodyW / 2) * s, -art.bodyH * s * 0.4, art.bodyW * s * 0.8, art.bodyH * s * 0.5, hex(v.car.visual.color));
    const flame = this.add.image(0, 0, 'flame').setVisible(false).setOrigin(1, 0.5);
    const beam = this.add.graphics();
    root.add([beam, placeholder, flame]);
    this.world.add(root);
    view = { key: v.artKey, root, body: null, wheels: [], flame, beam, art, loading: true, placeholder };
    this.cars.set(v.id, view);
    const bodyKey = `car-${v.id}-${v.artKey}`;
    const wheelKey = `wheel-${v.id}-${v.artKey}`;
    const current = view;
    Promise.all([svgToCanvas(art.bodySvg, art.bodyW, art.bodyH), svgToCanvas(art.wheelSvg, art.wheelD, art.wheelD)])
      .then(([bc, wc]) => {
        if (this.cars.get(v.id) !== current || !this.sys.isActive()) return;
        if (!this.textures.exists(bodyKey)) this.textures.addCanvas(bodyKey, bc);
        if (!this.textures.exists(wheelKey)) this.textures.addCanvas(wheelKey, wc);
        // body: origin at the front axle centre so pitch/position use the physics reference point
        const body = this.add.image(0, 0, bodyKey).setOrigin(art.frontAxleX / art.bodyW, art.axleY / art.bodyH).setScale(s);
        const wr = this.add.image(0, 0, wheelKey).setScale(s);
        const wf = this.add.image(0, 0, wheelKey).setScale(s);
        current.root.add([body, wr, wf]);
        current.root.bringToTop(current.flame);
        current.body = body;
        current.wheels = [wr, wf];
        current.placeholder.setVisible(false);
        current.loading = false;
      })
      .catch((e: unknown) => console.error('car art failed', e));
    return view;
  }

  override update(_time: number, deltaMs: number): void {
    // Real elapsed time (Phaser's delta is smoothed/quantised to the target frame rate, which
    // would make the simulation drift from the audio clock). Long gaps are passed through so the
    // runner can cap them and report the dropped time honestly.
    const now = performance.now();
    const realDt = this.lastNow === 0 ? deltaMs / 1000 : (now - this.lastNow) / 1000;
    this.lastNow = now;
    this.bridge.tick(realDt);
    this.applyTheme();
    const dtS = Math.min(0.1, deltaMs / 1000);
    const W = this.scale.width;
    const track = this.bridge.track();
    const vehicles = this.bridge.vehicles();
    const player = vehicles.find((v) => v.isPlayer) ?? vehicles[0];

    // ---- camera
    const mode = this.bridge.cameraMode;
    const userZoom = this.bridge.zoom();
    // follow: at least ~16 m visible; zoom out a little with speed; the look-ahead is limited to
    // a fraction of the visible half-width so the car never leaves the screen on narrow stages
    let targetPpm = Math.min(34, W / 16) * (1 - 0.25 * Math.min(1, (player?.speed ?? 0) / 60)) * userZoom;
    const halfSpan = W / 2 / targetPpm;
    let targetX = player ? player.x - player.car.wheelbaseM * 0.5 + Math.min(halfSpan * 0.4, Math.max(0, player.speed * 0.25)) : 0;
    if (mode === 'wide' && vehicles.length > 1) {
      const xs = vehicles.map((v) => v.x);
      const lo = Math.min(...xs) - 6;
      const hi = Math.max(...xs) + 4;
      targetX = (lo + hi) / 2;
      // never crop the pair: the user zoom can only widen this view
      targetPpm = Math.max(6, Math.min(34, (W * 0.85) / Math.max(1, hi - lo))) * Math.min(1, userZoom);
    } else if (mode === 'start') {
      targetPpm = Math.min(22, W / 30) * userZoom;
      targetX = -4.5 + (W / 2 / targetPpm) * 0.7;
    }
    // keep the view inside the track: nothing before TRACK_START_M or past the end wall
    const half = W / 2 / targetPpm;
    const lo = TRACK_START_M + half;
    const hi = track.lengthM + 12 - half;
    if (lo < hi) targetX = Math.min(hi, Math.max(lo, targetX));
    const k = 1 - Math.exp(-deltaMs / 120);
    this.camX += (targetX - this.camX) * (Math.abs(targetX - this.camX) > 200 ? 1 : k);
    this.ppm += (targetPpm - this.ppm) * k;
    const zoom = this.ppm / PPM_BASE;
    this.world.setScale(zoom);
    this.world.setPosition(W / 2 - this.camX * this.ppm, this.groundScreenY);
    this.backWorld.setScale(zoom);
    this.backWorld.setPosition(W / 2 - this.camX * this.ppm, this.groundScreenY);
    const toScreenX = (xm: number): number => W / 2 + (xm - this.camX) * this.ppm;

    // ---- background parallax and ground
    const factors = [0.04, 0.12, 0.3];
    this.layers.forEach((l, i) => (l.tilePositionX = this.camX * PPM_BASE * factors[i]!));
    this.asphalt.setPosition(0, this.groundScreenY - LANE_GAP_M * this.ppm - 0.9 * this.ppm);
    this.asphalt.setDisplaySize(W, (LANE_GAP_M + 1.8) * this.ppm);
    this.asphalt.setTileScale(zoom * 0.5, ((LANE_GAP_M + 1.8) * this.ppm) / 120);
    this.asphalt.tilePositionX = (this.camX * PPM_BASE * 2) / 1 - (W / 2 / zoom) * 2;
    // barrier: screen-space tile, world-anchored, clipped to the track's extent
    {
      const sx0 = Math.max(0, toScreenX(TRACK_START_M - 10));
      const sx1 = Math.min(W, toScreenX(track.lengthM + 12));
      const visible = sx1 > sx0;
      this.barrier.setVisible(visible);
      if (visible) {
        const footY = this.groundScreenY - (LANE_GAP_M + 0.9 + BARRIER_GAP_M) * this.ppm;
        this.barrier.setPosition(sx0, footY).setSize((sx1 - sx0) / zoom, BARRIER_H_M * PPM_BASE).setScale(zoom);
        this.barrier.tilePositionX = (this.camX + (sx0 - W / 2) / this.ppm) * PPM_BASE;
      }
    }

    // ---- visible range, props
    const halfSpanM = W / 2 / this.ppm + 5;
    const x0 = this.camX - halfSpanM;
    const x1 = this.camX + halfSpanM;
    for (const pr of this.props) pr.obj.setVisible(pr.x1 > x0 && pr.x0 < x1);
    const night = THEMES[track.theme].night;

    // ---- markers and lines (only the visible range)
    const g = this.lines;
    g.clear();
    const laneTop = -(LANE_GAP_M + 0.9) * PPM_BASE;
    const laneBot = 0.9 * PPM_BASE;
    // start line
    if (0 > x0 && 0 < x1) {
      g.fillStyle(0xffffff, 0.95);
      g.fillRect(-0.08 * PPM_BASE, laneTop, 0.16 * PPM_BASE, laneBot - laneTop);
    }
    const finish = this.bridge.finishM();
    if (finish !== null && finish > x0 && finish < x1) {
      const sq = 0.3 * PPM_BASE;
      for (let yy = laneTop, row = 0; yy < laneBot; yy += sq, row++) {
        for (let c = 0; c < 3; c++) {
          g.fillStyle((row + c) % 2 ? 0x111111 : 0xffffff, 1);
          g.fillRect(finish * PPM_BASE + c * sq - sq * 1.5, yy, sq, Math.min(sq, laneBot - yy));
        }
      }
    }
    // end of the track: sand trap and catch wall
    const endM = track.lengthM;
    if (endM - 20 < x1 && endM + 15 > x0) {
      g.fillStyle(0xc9a66b, 1);
      g.fillRect((endM - 18) * PPM_BASE, laneTop, 18 * PPM_BASE, laneBot - laneTop);
      const wallTop = laneTop - 1.6 * PPM_BASE;
      const stripe = (laneBot - wallTop) / 8;
      for (let i = 0; i < 8; i++) {
        g.fillStyle(i % 2 ? 0xffffff : 0xd62828, 1);
        g.fillRect(endM * PPM_BASE, wallTop + i * stripe, 0.6 * PPM_BASE, stripe);
      }
    }
    let li = 0;
    for (const m of this.bridge.markers()) {
      if (m.xM < x0 || m.xM > x1) continue;
      g.fillStyle(0xffffff, m.major ? 0.85 : 0.45);
      g.fillRect(m.xM * PPM_BASE - 1.5, laneTop, 3, laneBot - laneTop);
      // board
      g.fillStyle(0x1b1f24, 1);
      g.fillRect(m.xM * PPM_BASE - 26, laneTop - 2.6 * PPM_BASE, 52, 22);
      g.fillStyle(0x6b7178, 1);
      g.fillRect(m.xM * PPM_BASE - 2, laneTop - 2.6 * PPM_BASE + 22, 4, 2.6 * PPM_BASE - 22);
      let t = this.labels[li];
      if (!t) {
        t = this.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#f2f2f2' }).setOrigin(0.5, 0);
        this.labels.push(t);
        this.world.add(t);
      }
      t.setText(m.label).setPosition(m.xM * PPM_BASE, laneTop - 2.6 * PPM_BASE + 3).setVisible(true);
      li++;
    }
    for (; li < this.labels.length; li++) this.labels[li]!.setVisible(false);
    this.drawTree(x0, x1, laneTop);

    // ---- tyre marks (rubber laid by the driven wheels while they slip)
    for (const v of vehicles) this.trackMarks(v);
    this.drawMarks(x0, x1);

    // ---- vehicles (far lane first)
    const ordered = [...vehicles].sort((a, b) => b.lane - a.lane);
    const seen = new Set<string>();
    for (const v of ordered) {
      seen.add(v.id);
      const view = this.ensureCar(v);
      const laneY = v.lane === 1 ? -LANE_GAP_M * PPM_BASE : 0;
      const sc = v.lane === 1 ? 0.92 : 1;
      view.root.setPosition(v.x * PPM_BASE, laneY).setScale(sc);
      this.world.bringToTop(view.root);
      const art = view.art;
      const s = PPM_BASE / art.scale;
      const r = v.car.tires.radiusM * PPM_BASE;
      const wb = v.car.wheelbaseM * PPM_BASE;
      const exX = (art.exhaustX - art.frontAxleX) * s;
      const exY = (art.exhaustY - art.axleY) * s - r;
      if (view.body && view.wheels.length === 2) {
        // body pitches about the mid-wheelbase point; nose up = counter-clockwise
        const [shakeY, shakeRot] = this.idleShake(v);
        const pitch = -v.pitch + shakeRot;
        const pivotX = -wb / 2;
        const pivotY = -r - 0.25 * PPM_BASE;
        const cos = Math.cos(pitch);
        const sin = Math.sin(pitch);
        const ox = 0 - pivotX;
        const oy = -r - pivotY;
        view.body.setPosition(pivotX + ox * cos - oy * sin, pivotY + ox * sin + oy * cos + shakeY * PPM_BASE).setRotation(pitch);
        const [wr, wf] = view.wheels as [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
        const rearDriven = v.car.drivenAxle === 'rear';
        wr.setPosition(-wb, -r).setRotation(rearDriven ? v.wheelAngleDriven : v.wheelAngleFree);
        wf.setPosition(0, -r).setRotation(rearDriven ? v.wheelAngleFree : v.wheelAngleDriven);
        // exhaust flame (afterfire)
        view.flame.setPosition(exX, exY).setVisible(v.afterfire).setScale(0.6 + Math.random() * 0.5, 0.5 + Math.random() * 0.3);
      }
      // headlight beam at night
      view.beam.clear();
      if (night) {
        const fx = (art.bodyW - art.frontAxleX) * s;
        view.beam.fillStyle(0xfff4c2, 0.12);
        view.beam.fillTriangle(fx, -r - 0.1 * PPM_BASE, fx + 9 * PPM_BASE, -r - 0.7 * PPM_BASE, fx + 9 * PPM_BASE, 0.4 * PPM_BASE);
      }
      const onScreen = v.x + 3 > x0 && v.x - v.car.wheelbaseM - 3 < x1;
      if (!onScreen) continue;
      const wx = v.car.drivenAxle === 'rear' ? v.x - v.car.wheelbaseM : v.x;
      // tyre smoke from the driven wheels while they slip
      const slip = v.slipSpeed;
      if (slip > 1.5) {
        const n = this.accumulate(this.smokeAcc, v.id, dtS * Math.min(80, (slip - 1.5) * 9));
        if (n > 0) this.smoke.emitParticleAt(wx * PPM_BASE - r * 0.6, laneY - 0.15 * PPM_BASE, n);
      }
      // exhaust pulses: one visible puff per few firing events, stronger with load
      if (v.running) {
        const firingHz = (v.rpm / 60) * (v.car.engine.cylinders / 2);
        const rate = Math.min(28, firingHz / 4);
        const n = this.accumulate(this.exhaustAcc, v.id, dtS * rate);
        if (n > 0) {
          const em = this.exhaust[v.load > 0.7 ? 2 : v.load > 0.3 ? 1 : 0]!;
          em.emitParticleAt(v.x * PPM_BASE + exX * sc, laneY + exY * sc, n);
        }
      }
      // desert: dust lifted by the car's wake on the sandy shoulders
      if (track.theme === 'desert' && v.speed > 8) {
        const n = this.accumulate(this.dustAcc, v.id, dtS * Math.min(40, (v.speed - 8) * 1.2));
        if (n > 0) this.dust.emitParticleAt((v.x - v.car.wheelbaseM - 0.6) * PPM_BASE, laneY + 0.6 * PPM_BASE * (v.lane === 1 ? -1 : 1), n);
      }
    }
    for (const [id, view] of this.cars) {
      if (!seen.has(id)) {
        view.root.destroy();
        this.cars.delete(id);
        this.marks.delete(id);
      }
    }
    for (const em of this.exhaust) this.world.bringToTop(em);
    this.world.bringToTop(this.dust);
    this.world.bringToTop(this.smoke);
    this.drawLampGlow(x0, x1, night);
    this.world.bringToTop(this.glow);

    // ---- screen-space overlays: player marker and off-screen opponent indicator
    this.drawOverlays(vehicles, player, W, zoom, toScreenX);
  }

  private accumulate(map: Map<string, number>, id: string, add: number): number {
    const acc = (map.get(id) ?? 0) + add;
    const n = Math.floor(acc);
    map.set(id, acc - n);
    return n;
  }

  /**
   * Visual idle shake (m, rad): the body rocks on its mounts at low rpm, more with fewer cylinders.
   * The firing frequency is far above the frame rate, so a per-frame random offset is used
   * instead of a sine (which would alias). Cosmetic only – no mount dynamics are simulated.
   */
  private idleShake(v: RenderVehicle): [number, number] {
    if (!v.running || v.speed > 3) return [0, 0];
    const idle = v.car.engine.idleRpm;
    const fade = Math.min(1, Math.max(0, 1 - (v.rpm - idle) / 2500));
    if (fade <= 0) return [0, 0];
    const cylFactor = Math.min(1.6, Math.max(0.7, Math.sqrt(8 / v.car.engine.cylinders)));
    const amp = 0.006 * cylFactor * fade;
    return [amp * this.shakeRng.bipolar(), 0.0022 * cylFactor * fade * this.shakeRng.bipolar()];
  }

  private trackMarks(v: RenderVehicle): void {
    const wx = v.car.drivenAxle === 'rear' ? v.x - v.car.wheelbaseM : v.x;
    let mt = this.marks.get(v.id);
    if (!mt || wx < mt.lastX - 1) {
      // first frame or the vehicle was reset to the start: old marks belong to the previous run
      mt = { segs: [], open: null, lastX: wx };
      this.marks.set(v.id, mt);
    }
    mt.lastX = wx;
    if (v.slipSpeed > SKID_SLIP_MS) {
      const a = Math.min(0.7, 0.28 + (v.slipSpeed - SKID_SLIP_MS) * 0.04);
      if (mt.open && Math.abs(wx - mt.open.x1) < 0.6 && mt.open.lane === v.lane) {
        mt.open.x1 = Math.max(mt.open.x1, wx);
        mt.open.alpha = Math.max(mt.open.alpha * 0.98, a);
      } else {
        mt.open = { lane: v.lane, x0: wx - 0.15, x1: wx + 0.15, alpha: a };
        mt.segs.push(mt.open);
        if (mt.segs.length > MAX_MARKS) mt.segs.shift();
      }
    } else {
      mt.open = null;
    }
  }

  private drawMarks(x0: number, x1: number): void {
    const g = this.marksG;
    g.clear();
    for (const mt of this.marks.values()) {
      for (const sgm of mt.segs) {
        if (sgm.x1 < x0 || sgm.x0 > x1) continue;
        const y = sgm.lane === 1 ? -LANE_GAP_M * PPM_BASE : 0;
        g.fillStyle(0x0b0b0b, sgm.alpha);
        g.fillRect(sgm.x0 * PPM_BASE, y - 0.06 * PPM_BASE, (sgm.x1 - sgm.x0) * PPM_BASE, 0.16 * PPM_BASE);
      }
    }
  }

  private drawLampGlow(x0: number, x1: number, night: boolean): void {
    const g = this.glow;
    g.clear();
    if (!night) return;
    const footY = -(LANE_GAP_M + 0.9 + BARRIER_GAP_M) * PPM_BASE + 0.15 * PPM_BASE;
    for (const pr of this.props) {
      if (pr.kind !== 'lamp' || pr.x1 < x0 - 10 || pr.x0 > x1 + 10) continue;
      const cx = ((pr.x0 + pr.x1) / 2) * PPM_BASE;
      const headY = footY - 10.4 * PPM_BASE;
      const groundY = 0.9 * PPM_BASE;
      g.fillStyle(0xffe6a0, 0.05);
      g.fillTriangle(cx - 0.9 * PPM_BASE, headY, cx + 0.9 * PPM_BASE, headY, cx + 7 * PPM_BASE, groundY);
      g.fillTriangle(cx - 0.9 * PPM_BASE, headY, cx + 7 * PPM_BASE, groundY, cx - 7 * PPM_BASE, groundY);
      g.fillStyle(0xffe6a0, 0.07);
      g.fillEllipse(cx, -LANE_GAP_M * 0.5 * PPM_BASE, 12 * PPM_BASE, 3.2 * PPM_BASE);
    }
  }

  private drawOverlays(vehicles: RenderVehicle[], player: RenderVehicle | undefined, W: number, zoom: number, toScreenX: (xm: number) => number): void {
    const ui = this.ui;
    ui.clear();
    const multi = vehicles.length > 1;
    const seen = new Set<string>();
    if (player && multi) {
      const view = this.cars.get(player.id);
      const topLocal = view ? -player.car.tires.radiusM * PPM_BASE - view.art.axleY * (PPM_BASE / view.art.scale) : -1.4 * PPM_BASE;
      const laneY = player.lane === 1 ? -LANE_GAP_M * PPM_BASE : 0;
      const sx = toScreenX(player.x - player.car.wheelbaseM / 2);
      const sy = this.groundScreenY + (laneY + topLocal) * zoom - 6;
      const inView = sx > 0 && sx < W;
      this.youLabel.setVisible(inView).setPosition(sx, sy - 6);
      if (inView) {
        ui.fillStyle(0xf2b705, 1);
        ui.fillTriangle(sx - 5, sy - 6, sx + 5, sy - 6, sx, sy);
      }
    } else {
      this.youLabel.setVisible(false);
    }
    if (player && multi) {
      for (const v of vehicles) {
        if (v === player) continue;
        const sx = toScreenX(v.x - v.car.wheelbaseM / 2);
        if (sx > -20 && sx < W + 20) continue;
        seen.add(v.id);
        let ind = this.indicators.get(v.id);
        if (!ind) {
          ind = {
            box: this.add.graphics().setScrollFactor(0).setDepth(40),
            text: this.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#f2f4f6' }).setScrollFactor(0).setDepth(41),
          };
          this.indicators.set(v.id, ind);
        }
        const gap = v.x - player.x;
        const right = sx >= W;
        ind.text.setText(`${v.name}  ${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)} m`);
        const tw = ind.text.width;
        const y = this.groundScreenY + (v.lane === 1 ? -LANE_GAP_M : 0) * this.ppm - 2.4 * this.ppm - 12;
        const bx = right ? W - tw - 30 : 30;
        ind.text.setOrigin(0, 0.5).setPosition(bx, y).setVisible(true);
        const b = ind.box;
        b.clear();
        b.fillStyle(0x0d1014, 0.78);
        b.fillRoundedRect(bx - 8, y - 11, tw + 16, 22, 5);
        b.fillStyle(0x2bb3ff, 1);
        if (right) b.fillTriangle(W - 6, y, W - 18, y - 8, W - 18, y + 8);
        else b.fillTriangle(6, y, 18, y - 8, 18, y + 8);
        b.setVisible(true);
      }
    }
    for (const [id, ind] of this.indicators) {
      if (seen.has(id)) continue;
      if (!vehicles.some((v) => v.id === id)) {
        ind.box.destroy();
        ind.text.destroy();
        this.indicators.delete(id);
      } else {
        ind.box.setVisible(false);
        ind.text.setVisible(false);
      }
    }
  }

  private drawTree(x0: number, x1: number, laneTop: number): void {
    const g = this.treeG;
    g.clear();
    const lights = this.bridge.tree();
    const tx = -4.5;
    if (!lights || tx < x0 - 2 || tx > x1 + 2) return;
    const px = tx * PPM_BASE;
    const top = laneTop - 4.6 * PPM_BASE;
    g.fillStyle(0x30353b, 1);
    g.fillRect(px - 4, top + 3.4 * PPM_BASE, 8, laneTop - top);
    g.fillStyle(0x15181c, 1);
    g.fillRoundedRect(px - 30, top, 60, 3.6 * PPM_BASE, 6);
    const bulb = (lane: number, row: number, on: boolean, color: number): void => {
      const bx = px + (lane === 0 ? -13 : 13);
      const by = top + 12 + row * 17;
      g.fillStyle(on ? color : 0x2a2d31, 1);
      g.fillCircle(bx, by, 6.5);
      if (on) {
        g.fillStyle(color, 0.25);
        g.fillCircle(bx, by, 11);
      }
    };
    for (const lane of [0, 1] as const) {
      bulb(lane, 0, lights.prestage[lane], 0xfff2b0);
      bulb(lane, 1, lights.stage[lane], 0xfff2b0);
      for (let a = 0; a < 3; a++) bulb(lane, 2 + a, lights.amber[lane] > a, 0xffa31a);
      bulb(lane, 5, lights.green[lane], 0x2bff5a);
      bulb(lane, 6, lights.red[lane], 0xff2b2b);
    }
  }
}

function hex(c: string): number {
  return Number.parseInt(c.slice(1), 16);
}
