import Phaser from 'phaser';
import type { GraphicsProfile } from '../../app/graphics';
import type { TrackConfig } from '../../data/schema';
import { Prng } from '../../core/prng';
import { shade } from '../vehicles/art/svg';
import { FX_TEXTURE } from '../vehicles/VehicleParticleSystem';
import { lit, type LightingState } from './LightingController';
import type { TrackMarker, TreeLights } from './renderTypes';
import { SURFACES, buildForeground, buildProp, buildRoad, buildShoulder, buildWall, type PropKind, type PropOptions, type Theme } from './trackArt';
import {
  FAR_LANE_SCALE,
  FAR_TYRE_OFFSET_M,
  LANE_EDGE_M,
  LANE_GAP_M,
  PPM_BASE,
  ROAD_BOTTOM_PX,
  ROAD_TOP_PX,
  TRACK_END_MARGIN_M,
  TRACK_START_M,
  TREE_X_M,
  WALL_FOOT_PX,
  WALL_HEIGHT_M,
} from './worldScale';

const BAND_M = LANE_GAP_M + 2 * LANE_EDGE_M;
const CENTRE_PX = -(LANE_GAP_M / 2) * PPM_BASE;
/** Road texture: metres covered by one tile. */
const ROAD_TILE_M = 16;
const PAD_TILE_M = 8;
const PAD_FROM_M = -14;
const PAD_TO_M = 22;
const SHOULDER_M = 4;
const DEPTH = { back: -55, wall: -50, farShoulder: -45, ground: -42, shoulder: -41, road: -40, world: 0, foreground: 20 };
const hexNum = (c: string): number => Number.parseInt(c.slice(1), 16);

interface Prop {
  obj: Phaser.GameObjects.Image;
  x0: number;
  x1: number;
}

/**
 * The drag strip: textured road with a concrete launch pad, painted lines, burnout and launch
 * rubber, the wall, shoulders, timing equipment, distance boards, the starting-line tree and the
 * trackside structures. Static parts are cached textures and objects built once per track and
 * lighting; per frame only scroll offsets, culling and the tree's lamps change.
 */
export class TrackRenderer {
  readonly backWorld: Phaser.GameObjects.Container;
  readonly world: Phaser.GameObjects.Container;
  /** Layers inside `world`, bottom to top. */
  readonly decals: Phaser.GameObjects.Container;
  readonly marksLayer: Phaser.GameObjects.Container;
  readonly lightLayer: Phaser.GameObjects.Container;
  readonly frontProps: Phaser.GameObjects.Container;
  readonly farLane: Phaser.GameObjects.Container;
  readonly midProps: Phaser.GameObjects.Container;
  readonly nearLane: Phaser.GameObjects.Container;
  readonly fxLayer: Phaser.GameObjects.Container;

  private road: Phaser.GameObjects.TileSprite | null = null;
  private wall: Phaser.GameObjects.TileSprite | null = null;
  private shoulder: Phaser.GameObjects.TileSprite | null = null;
  private groundFill: Phaser.GameObjects.Rectangle | null = null;
  private farShoulder: Phaser.GameObjects.Rectangle | null = null;
  private foreground: Phaser.GameObjects.TileSprite | null = null;
  private roadTexW = 1024;
  private wallTexW = 512;
  private wallTexH = 154;
  private shoulderTex = { w: 512, h: 256 };
  private foregroundTex = { w: 2048, h: 200 };
  private props: Prop[] = [];
  private staticObjects: Phaser.GameObjects.GameObject[] = [];
  private markerObjects: Phaser.GameObjects.GameObject[] = [];
  private keys: string[] = [];
  private markerKey = '';
  private track: TrackConfig | null = null;
  private lighting: LightingState | null = null;
  private lightingId = '';
  private propPpm = 64;
  private treeImg: Phaser.GameObjects.Image | null = null;
  private treeG: Phaser.GameObjects.Graphics;
  private treeGlows: Phaser.GameObjects.Image[] = [];
  private treeKey = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.backWorld = scene.add.container(0, 0).setDepth(DEPTH.back);
    this.world = scene.add.container(0, 0).setDepth(DEPTH.world);
    this.decals = scene.add.container(0, 0);
    this.marksLayer = scene.add.container(0, 0);
    this.lightLayer = scene.add.container(0, 0);
    this.frontProps = scene.add.container(0, 0);
    this.farLane = scene.add.container(0, 0);
    this.midProps = scene.add.container(0, 0);
    this.nearLane = scene.add.container(0, 0);
    this.fxLayer = scene.add.container(0, 0);
    this.world.add([this.decals, this.marksLayer, this.lightLayer, this.frontProps, this.farLane, this.midProps, this.nearLane, this.fxLayer]);
    this.treeG = scene.add.graphics();
  }

  private tex(key: string, make: () => HTMLCanvasElement): string {
    if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, make());
    if (!this.keys.includes(key)) this.keys.push(key);
    return key;
  }

  private prop(kind: PropKind, xM: number, layer: Phaser.GameObjects.Container, yPx: number, opt: PropOptions = {}, list = this.staticObjects): Phaser.GameObjects.Image {
    const L = this.lighting!;
    const theme = this.track!.theme;
    const key = this.tex(`prop-${this.lightingId}-${kind}-${opt.variant ?? 0}-${opt.label ?? ''}-${this.propPpm}`, () => buildProp(kind, theme, L, this.propPpm, opt));
    const img = this.scene.add.image(xM * PPM_BASE, yPx, key).setOrigin(0.5, 1).setScale(PPM_BASE / this.propPpm);
    layer.add(img);
    list.push(img);
    const half = (img.width * (PPM_BASE / this.propPpm)) / PPM_BASE / 2;
    this.props.push({ obj: img, x0: xM - half, x1: xM + half });
    return img;
  }

  /** (Re)builds the static track for a track configuration, lighting and graphics profile. */
  build(track: TrackConfig, lighting: LightingState, lightingId: string, profile: GraphicsProfile): void {
    this.clear();
    this.track = track;
    this.lighting = lighting;
    this.lightingId = lightingId;
    const sc = this.scene;
    const s = profile.sceneryScale;
    const theme: Theme = track.theme;
    const surf = SURFACES[theme];
    this.propPpm = Math.round(64 * Math.max(0.6, s));
    const p = `trk-${lightingId}-${s}`;

    // ---- screen-space tiles: road, wall, near shoulder, foreground
    this.roadTexW = Math.round(1024 * s);
    this.road = sc.add.tileSprite(0, 0, 16, 16, this.tex(`${p}-road`, () => buildRoad(theme, lighting, s))).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.road);
    const wallPpm = Math.round(64 * Math.max(0.6, s));
    this.wallTexW = 8 * wallPpm;
    this.wallTexH = Math.round(WALL_HEIGHT_M * wallPpm);
    this.wall = sc.add.tileSprite(0, 0, 16, 16, this.tex(`${p}-wall`, () => buildWall(theme, lighting, wallPpm, WALL_HEIGHT_M))).setOrigin(0, 1).setScrollFactor(0).setDepth(DEPTH.wall);
    this.shoulderTex = { w: Math.round(512 * s), h: Math.round(256 * s) };
    this.shoulder = sc.add.tileSprite(0, 0, 16, 16, this.tex(`${p}-shoulder`, () => buildShoulder(theme, lighting, s))).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.shoulder);
    this.groundFill = sc.add.rectangle(0, 0, 16, 16, hexNum(lit(shade(surf.ground, -0.4), lighting))).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.ground);
    this.farShoulder = sc.add.rectangle(0, 0, 16, 16, hexNum(lit(shade(surf.shoulder, -0.12), lighting))).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.farShoulder);
    if (profile.foreground) {
      this.foregroundTex = { w: Math.round(2048 * s), h: Math.round(200 * s) };
      this.foreground = sc.add.tileSprite(0, 0, 16, this.foregroundTex.h, this.tex(`${p}-fg`, () => buildForeground(theme, lighting, s))).setOrigin(0, 1).setScrollFactor(0).setDepth(DEPTH.foreground);
    }

    // ---- world decals
    const padKey = this.tex(`${p}-pad`, () => buildRoad(theme, lighting, s, 'concrete'));
    const padTexW = Math.round(512 * s);
    const padTexH = Math.round(256 * s);
    const pad = sc.add.tileSprite(PAD_FROM_M * PPM_BASE, ROAD_TOP_PX, (PAD_TO_M - PAD_FROM_M) * PPM_BASE, BAND_M * PPM_BASE, padKey).setOrigin(0, 0);
    pad.setTileScale((PAD_TILE_M * PPM_BASE) / padTexW, (BAND_M * PPM_BASE) / padTexH);
    this.decals.add(pad);
    this.staticObjects.push(pad);

    const g = sc.add.graphics();
    this.decals.add(g);
    this.staticObjects.push(g);
    const band = ROAD_BOTTOM_PX - ROAD_TOP_PX;
    const white = hexNum(lit(surf.line, lighting));
    // pad joints at both ends
    g.fillStyle(0x000000, 0.45);
    g.fillRect(PAD_FROM_M * PPM_BASE - 1, ROAD_TOP_PX, 2, band);
    g.fillRect(PAD_TO_M * PPM_BASE - 1, ROAD_TOP_PX, 2, band);
    // water box before the line
    g.fillStyle(hexNum(lit('#0b141c', lighting)), 0.55);
    g.fillRoundedRect(-22 * PPM_BASE, ROAD_TOP_PX + 0.25 * PPM_BASE, 7 * PPM_BASE, band - 0.5 * PPM_BASE, 6);
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(-21.6 * PPM_BASE, ROAD_TOP_PX + 0.5 * PPM_BASE, 6.2 * PPM_BASE, band * 0.22, 5);
    // pre-stage marks and the start line
    g.fillStyle(hexNum(lit(surf.centre, lighting)), 0.9);
    g.fillRect(-0.2 * PPM_BASE, ROAD_TOP_PX, 0.04 * PPM_BASE, band);
    g.fillStyle(white, 0.97);
    g.fillRect(-0.08 * PPM_BASE, ROAD_TOP_PX, 0.16 * PPM_BASE, band);
    // end of the track: sand trap and catch wall
    const endM = track.lengthM;
    g.fillStyle(hexNum(lit('#c9a66b', lighting)), 1);
    g.fillRect((endM - 18) * PPM_BASE, ROAD_TOP_PX, 18 * PPM_BASE, band);
    g.lineStyle(1.5, 0x000000, 0.12);
    for (let i = 0; i < 9; i++) {
      const y = ROAD_TOP_PX + (band * (i + 0.5)) / 9;
      g.lineBetween((endM - 18) * PPM_BASE, y, endM * PPM_BASE, y + 3);
    }
    const wallTop = ROAD_TOP_PX - 1.7 * PPM_BASE;
    const stripe = (ROAD_BOTTOM_PX - wallTop) / 10;
    for (let i = 0; i < 10; i++) {
      g.fillStyle(hexNum(lit(i % 2 ? '#f4f4f0' : '#d62828', lighting)), 1);
      g.fillRect(endM * PPM_BASE, wallTop + i * stripe, 0.6 * PPM_BASE, stripe);
    }
    this.prop('tyrewall', endM - 0.5, this.nearLane, ROAD_BOTTOM_PX - 0.1 * PPM_BASE);
    this.prop('tyrewall', endM - 0.5, this.farLane, CENTRE_PX);

    // burnout and launch rubber: heavier near the line, fading down-track
    const rubber: [number, number, number][] = [
      [-13, -1, 0.3],
      [-1, 14, 0.42],
      [14, 34, 0.28],
      [34, 70, 0.16],
      [70, 130, 0.08],
    ];
    for (const lane of [0, 1] as const) {
      const ly = lane === 1 ? -LANE_GAP_M * PPM_BASE : 0;
      const sc2 = lane === 1 ? FAR_LANE_SCALE : 1;
      for (const [off, hM] of [
        [0.02, 0.3],
        [-FAR_TYRE_OFFSET_M * sc2, 0.2],
      ] as const) {
        for (const [x0, x1, a] of rubber) {
          const img = sc.add.image(x0 * PPM_BASE, ly + off * PPM_BASE, FX_TEXTURE, 'skid').setOrigin(0, 0.5);
          img.setDisplaySize((x1 - x0) * PPM_BASE, hM * sc2 * PPM_BASE).setAlpha(a);
          this.decals.add(img);
          this.staticObjects.push(img);
        }
      }
    }

    // timing beam emitters at the start line (centre line and both edges)
    this.prop('timing', -0.1, this.frontProps, ROAD_TOP_PX + 0.06 * PPM_BASE);
    this.prop('timing', -0.1, this.midProps, CENTRE_PX + 0.06 * PPM_BASE);

    // ---- lamp posts and their light on the road
    // street venues of the campaign are lit by closely spaced public lamps
    const lampStep = { nightIndustrial: 30, distritoIndustrial: 32, baixada: 40, avenidaNorte: 36, patioDasTorres: 34, distritoFinanceiro: 30, corredorDaLiga: 28, marginalAlta: 30, hangarExecutivo: 34, pierElite: 32 }[theme as string] ?? 75;
    for (let x = lampStep < 75 ? 8 : 20; x < track.lengthM + 10; x += lampStep) {
      this.prop('lamp', x, this.frontProps, WALL_FOOT_PX + 0.15 * PPM_BASE);
      if (lighting.trackLamps) {
        const pool = sc.add.image(x * PPM_BASE, CENTRE_PX, FX_TEXTURE, 'pool').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe2a0).setAlpha(0.55 * lighting.glow);
        pool.setDisplaySize(17 * PPM_BASE, 5.4 * PPM_BASE);
        this.lightLayer.add(pool);
        this.staticObjects.push(pool);
        this.props.push({ obj: pool, x0: x - 9, x1: x + 9 });
      }
    }

    // ---- structures behind the wall, per theme (deterministic layout)
    const foot = WALL_FOOT_PX - 0.05 * PPM_BASE;
    const front = WALL_FOOT_PX + 0.15 * PPM_BASE;
    const L = track.lengthM;
    const rng = new Prng(track.id.length * 13 + Math.round(L));
    switch (theme) {
      case 'testTrack':
        [-12, 20, 52].forEach((x, i) => this.prop('grandstand', x, this.backWorld, foot, { variant: i }));
        this.prop('pit', 140, this.backWorld, foot);
        this.prop('pit', 620, this.backWorld, foot);
        this.prop('sign', 220, this.frontProps, front, { variant: 0 });
        this.prop('sign', L - 160, this.frontProps, front, { variant: 4 });
        for (let x = 300; x < L; x += 260) this.prop('grandstand', x, this.backWorld, foot, { variant: Math.round(x / 260) });
        break;
      case 'desert':
        this.prop('grandstand', 4, this.backWorld, foot, { variant: 3 });
        this.prop('sign', -20, this.frontProps, front, { variant: 0 });
        this.prop('sign', 180, this.frontProps, front, { variant: 2 });
        this.prop('sign', 760, this.frontProps, front, { variant: 3 });
        for (let x = 40; x < L; x += 25 + rng.next() * 45) this.prop('cactus', x, this.backWorld, foot, { variant: Math.floor(rng.next() * 3) });
        break;
      case 'nightIndustrial':
        this.prop('grandstand', -8, this.backWorld, foot, { variant: 1 });
        this.prop('pit', 90, this.backWorld, foot);
        this.prop('pit', 520, this.backWorld, foot);
        this.prop('sign', 160, this.frontProps, front, { variant: 1 });
        this.prop('sign', L - 200, this.frontProps, front, { variant: 4 });
        break;
      case 'distritoIndustrial':
        this.prop('pit', 70, this.backWorld, foot);
        this.prop('pit', 460, this.backWorld, foot);
        this.prop('sign', 140, this.frontProps, front, { variant: 1 });
        this.prop('sign', L - 220, this.frontProps, front, { variant: 3 });
        break;
      case 'baixada':
        this.prop('sign', 120, this.frontProps, front, { variant: 2 });
        this.prop('sign', L - 240, this.frontProps, front, { variant: 4 });
        break;
      case 'avenidaNorte':
        this.prop('sign', 100, this.frontProps, front, { variant: 0 });
        this.prop('sign', L - 200, this.frontProps, front, { variant: 2 });
        break;
      case 'patioDasTorres':
        this.prop('sign', 90, this.frontProps, front, { variant: 1 });
        this.prop('sign', L - 210, this.frontProps, front, { variant: 3 });
        break;
      case 'distritoFinanceiro':
        this.prop('sign', 110, this.frontProps, front, { variant: 4 });
        this.prop('sign', L - 230, this.frontProps, front, { variant: 0 });
        break;
      case 'corredorDaLiga':
        this.prop('grandstand', -10, this.backWorld, foot, { variant: 2 });
        this.prop('sign', 60, this.frontProps, front, { variant: 2 });
        this.prop('sign', 260, this.frontProps, front, { variant: 4 });
        this.prop('sign', L - 180, this.frontProps, front, { variant: 1 });
        break;
      case 'marginalAlta':
        this.prop('sign', 100, this.frontProps, front, { variant: 3 });
        this.prop('sign', L - 220, this.frontProps, front, { variant: 1 });
        break;
      case 'hangarExecutivo':
        this.prop('hangar', 60, this.backWorld, foot);
        this.prop('hangar', 460, this.backWorld, foot);
        this.prop('windsock', 120, this.backWorld, foot);
        this.prop('sign', 80, this.frontProps, front, { variant: 0 });
        this.prop('sign', L - 200, this.frontProps, front, { variant: 2 });
        break;
      case 'pierElite':
        this.prop('grandstand', -10, this.backWorld, foot, { variant: 1 });
        this.prop('sign', 70, this.frontProps, front, { variant: 4 });
        this.prop('sign', L - 190, this.frontProps, front, { variant: 0 });
        break;
      case 'airfield':
        this.prop('tower', 150, this.backWorld, foot);
        this.prop('hangar', 40, this.backWorld, foot);
        this.prop('hangar', 420, this.backWorld, foot);
        this.prop('windsock', 80, this.backWorld, foot);
        this.prop('windsock', 540, this.backWorld, foot);
        this.prop('pit', 300, this.backWorld, foot);
        this.prop('sign', 30, this.frontProps, front, { variant: 0 });
        this.prop('sign', L - 180, this.frontProps, front, { variant: 4 });
        break;
    }
    // ---- starting-line tree (shown when the mode has one)
    this.treeImg = this.prop('tree', TREE_X_M, this.midProps, CENTRE_PX + 0.12 * PPM_BASE);
    this.treeImg.setVisible(false);
    this.midProps.add(this.treeG);
    this.treeKey = '';
    this.markerKey = '';
  }

  /** Distance boards, split lines and the finish line (rebuilt only when they change). */
  private syncMarkers(markers: TrackMarker[], finishM: number | null): void {
    const key = `${markers.map((m) => `${m.xM}:${m.label}`).join('|')}#${finishM}`;
    if (key === this.markerKey || !this.lighting || !this.track) return;
    this.markerKey = key;
    for (const o of this.markerObjects) {
      this.props = this.props.filter((p) => p.obj !== o);
      o.destroy();
    }
    this.markerObjects = [];
    const g = this.scene.add.graphics();
    this.decals.add(g);
    this.markerObjects.push(g);
    const band = ROAD_BOTTOM_PX - ROAD_TOP_PX;
    const white = hexNum(lit(SURFACES[this.track.theme].line, this.lighting));
    for (const m of markers) {
      g.fillStyle(white, m.major ? 0.85 : 0.5);
      g.fillRect(m.xM * PPM_BASE - 1.5, ROAD_TOP_PX, 3, band);
      this.prop('board', m.xM, this.frontProps, ROAD_TOP_PX - 0.05 * PPM_BASE, { label: m.label }, this.markerObjects);
    }
    if (finishM !== null) {
      const sq = 0.3 * PPM_BASE;
      const a = hexNum(lit('#f4f4f0', this.lighting));
      const b = hexNum(lit('#111316', this.lighting));
      for (let yy = ROAD_TOP_PX, row = 0; yy < ROAD_BOTTOM_PX; yy += sq, row++) {
        for (let c = 0; c < 3; c++) {
          g.fillStyle((row + c) % 2 ? b : a, 1);
          g.fillRect(finishM * PPM_BASE + c * sq - sq * 1.5, yy, sq, Math.min(sq, ROAD_BOTTOM_PX - yy));
        }
      }
      this.prop('banner', finishM, this.frontProps, WALL_FOOT_PX + 0.1 * PPM_BASE, { label: 'CHEGADA' }, this.markerObjects);
      this.prop('timing', finishM, this.midProps, CENTRE_PX + 0.06 * PPM_BASE, {}, this.markerObjects);
      this.prop('timing', finishM, this.frontProps, ROAD_TOP_PX + 0.06 * PPM_BASE, {}, this.markerObjects);
    }
  }

  /** Lit lamps of the tree from the real race state (redrawn only when the state changes). */
  private syncTree(lights: TreeLights | null): void {
    const img = this.treeImg;
    if (!img) return;
    img.setVisible(!!lights);
    const key = lights ? JSON.stringify(lights) : '';
    if (key === this.treeKey) return;
    this.treeKey = key;
    const g = this.treeG;
    g.clear();
    for (const o of this.treeGlows) o.setVisible(false);
    if (!lights) return;
    const left = TREE_X_M * PPM_BASE - 0.75 * PPM_BASE;
    const topY = img.y - 5.2 * PPM_BASE;
    let used = 0;
    const bulb = (lane: number, row: number, on: boolean, color: number): void => {
      if (!on) return;
      const bx = left + (0.75 + (lane === 0 ? -0.27 : 0.27)) * PPM_BASE;
      const by = topY + (0.36 + row * 0.44) * PPM_BASE;
      const r = (row < 2 ? 0.1 : 0.15) * PPM_BASE;
      g.fillStyle(color, 1);
      g.fillCircle(bx, by, r);
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(bx - r * 0.25, by - r * 0.25, r * 0.4);
      let glow = this.treeGlows[used];
      if (!glow) {
        glow = this.scene.add.image(0, 0, FX_TEXTURE, 'glow').setBlendMode(Phaser.BlendModes.ADD);
        this.midProps.add(glow);
        this.treeGlows.push(glow);
      }
      glow.setVisible(true).setPosition(bx, by).setDisplaySize(r * 7, r * 7).setTint(color).setAlpha(0.75);
      used++;
    };
    for (const lane of [0, 1] as const) {
      bulb(lane, 0, lights.prestage[lane], 0xfff2b0);
      bulb(lane, 1, lights.stage[lane], 0xfff2b0);
      for (let a = 0; a < 3; a++) bulb(lane, 2 + a, lights.amber[lane] > a, 0xffa31a);
      bulb(lane, 5, lights.green[lane], 0x2bff5a);
      bulb(lane, 6, lights.red[lane], 0xff2b2b);
    }
    this.midProps.bringToTop(g);
    for (const o of this.treeGlows) this.midProps.bringToTop(o);
  }

  update(camX: number, ppm: number, groundY: number, W: number, H: number, markers: TrackMarker[], finishM: number | null, tree: TreeLights | null): { x0: number; x1: number } {
    const track = this.track;
    if (!track || !this.road || !this.wall || !this.shoulder || !this.groundFill) return { x0: 0, x1: 0 };
    const zoom = ppm / PPM_BASE;
    const left = W / 2 - camX * ppm;
    this.world.setScale(zoom).setPosition(left, groundY);
    this.backWorld.setScale(zoom).setPosition(left, groundY);
    const leftM = camX - W / 2 / ppm;

    // road band
    const roadTop = groundY + ROAD_TOP_PX * zoom;
    const bandPx = BAND_M * ppm;
    this.road.setPosition(0, roadTop).setSize(W, bandPx);
    this.road.setTileScale((ROAD_TILE_M * ppm) / this.roadTexW, bandPx / this.road.texture.getSourceImage().height);
    this.road.tilePositionX = (leftM / ROAD_TILE_M) * this.roadTexW;

    // wall, clipped to the track's extent
    const sx0 = Math.max(0, left + (TRACK_START_M - 10) * ppm);
    const sx1 = Math.min(W, left + (track.lengthM + TRACK_END_MARGIN_M) * ppm);
    const wallVisible = sx1 > sx0;
    this.wall.setVisible(wallVisible);
    if (wallVisible) {
      const kx = (8 * ppm) / this.wallTexW;
      const ky = (WALL_HEIGHT_M * ppm) / this.wallTexH;
      this.wall.setPosition(sx0, groundY + WALL_FOOT_PX * zoom).setSize((sx1 - sx0) / kx, this.wallTexH).setScale(kx, ky);
      this.wall.tilePositionX = ((camX + (sx0 - W / 2) / ppm) / 8) * this.wallTexW;
    }

    // near shoulder down to the bottom of the view
    const shTop = groundY + ROAD_BOTTOM_PX * zoom;
    const shH = Math.min(Math.max(0, H - shTop), SHOULDER_M * ppm);
    this.shoulder.setVisible(shH > 0).setPosition(0, shTop).setSize(W, Math.max(1, shH));
    this.shoulder.setTileScale((8 * ppm) / this.shoulderTex.w, (SHOULDER_M * ppm) / this.shoulderTex.h);
    this.shoulder.tilePositionX = (leftM / 8) * this.shoulderTex.w;
    this.groundFill.setPosition(0, shTop).setSize(W, Math.max(1, H - shTop));
    const wallFootY = groundY + WALL_FOOT_PX * zoom;
    this.farShoulder?.setPosition(0, wallFootY - 1).setSize(W, Math.max(1, roadTop - wallFootY + 2));

    if (this.foreground) {
      const s = (H * 0.15) / this.foregroundTex.h;
      this.foreground.setPosition(0, H + 4).setSize(W / s, this.foregroundTex.h).setScale(s);
      this.foreground.tilePositionX = (camX * ppm * 1.7) / s;
    }

    // culling of world props
    const half = W / 2 / ppm + 6;
    const x0 = camX - half;
    const x1 = camX + half;
    for (const p of this.props) {
      if (p.obj === this.treeImg) continue;
      p.obj.setVisible(p.x1 > x0 && p.x0 < x1);
    }
    this.syncMarkers(markers, finishM);
    this.syncTree(tree);
    return { x0, x1 };
  }

  /** Geometry for the visual tests (world pixels). */
  debug(): { props: number; roadTop: number; roadBottom: number; wallFoot: number; textures: number; treeVisible: boolean; litBulbs: number } {
    return {
      props: this.props.length,
      roadTop: ROAD_TOP_PX,
      roadBottom: ROAD_BOTTOM_PX,
      wallFoot: WALL_FOOT_PX,
      textures: this.keys.length,
      treeVisible: !!this.treeImg?.visible,
      litBulbs: this.treeGlows.filter((g) => g.visible).length,
    };
  }

  private clear(): void {
    for (const o of [...this.staticObjects, ...this.markerObjects, ...this.treeGlows]) o.destroy();
    this.staticObjects = [];
    this.markerObjects = [];
    this.treeGlows = [];
    this.props = [];
    this.treeImg = null;
    this.treeG.clear();
    for (const o of [this.road, this.wall, this.shoulder, this.groundFill, this.farShoulder, this.foreground]) o?.destroy();
    this.road = this.wall = this.shoulder = this.foreground = null;
    this.groundFill = this.farShoulder = null;
    for (const k of this.keys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.keys = [];
  }

  destroy(): void {
    this.clear();
    this.treeG.destroy();
    this.world.destroy();
    this.backWorld.destroy();
  }
}
