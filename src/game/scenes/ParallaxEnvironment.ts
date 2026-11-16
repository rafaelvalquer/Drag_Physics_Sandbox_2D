import Phaser from 'phaser';
import type { GraphicsProfile } from '../../app/graphics';
import { FX_TEXTURE } from '../vehicles/VehicleParticleSystem';
import { LAYER_H, buildClouds, buildLayer, buildSky, buildStars } from './environmentArt';
import type { LightingState } from './LightingController';
import { buildField, type Theme } from './trackArt';
import { LANE_EDGE_M, LANE_GAP_M, WALL_GAP_M } from './worldScale';

/** Screen metres from the near lane's ground line up to the horizon. */
export const HORIZON_M = 4.5;
/** Parallax speed of each layer relative to the track (1 = moves with the track). */
export const PARALLAX_FACTORS = [0.035, 0.09, 0.22] as const;
const CLOUD_FACTOR = 0.012;
const DEPTH = { sky: -100, stars: -99, orb: -98, clouds: -97, layer: -96, field: -90 };

const hexNum = (c: string): number => Number.parseInt(c.slice(1), 16);

/**
 * Layered environment behind the track: sky, sun or moon, stars, drifting clouds, three parallax
 * layers and the ground running up to the horizon. Distant layers move slowly, near ones faster;
 * all of them are cached textures – per frame only scroll offsets change.
 */
export class ParallaxEnvironment {
  private keys: string[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private sky: Phaser.GameObjects.Image | null = null;
  private stars: Phaser.GameObjects.TileSprite | null = null;
  private halo: Phaser.GameObjects.Image | null = null;
  private orb: Phaser.GameObjects.Image | null = null;
  private clouds: Phaser.GameObjects.TileSprite | null = null;
  private layers: { ts: Phaser.GameObjects.TileSprite; index: number; texH: number }[] = [];
  private field: Phaser.GameObjects.Image | null = null;
  private lighting: LightingState | null = null;
  private drift = 0;
  private cloudTexH = 300;

  constructor(private readonly scene: Phaser.Scene) {}

  private tex(key: string, make: () => HTMLCanvasElement): string {
    if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, make());
    this.keys.push(key);
    return key;
  }

  /** (Re)builds every texture and object for a theme and lighting; frees the previous ones. */
  build(theme: Theme, lighting: LightingState, id: string, profile: GraphicsProfile): void {
    this.clear();
    this.lighting = lighting;
    const s = profile.sceneryScale;
    const sc = this.scene;
    const p = `env-${id}-${s}`;
    this.sky = sc.add.image(0, 0, this.tex(`${p}-sky`, () => buildSky(lighting))).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.sky);
    this.objects.push(this.sky);
    if (lighting.stars > 0) {
      this.stars = sc.add.tileSprite(0, 0, 16, 16, this.tex('env-stars', buildStars)).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.stars).setAlpha(lighting.stars);
      this.objects.push(this.stars);
    }
    this.halo = sc.add.image(0, 0, FX_TEXTURE, 'glow').setScrollFactor(0).setDepth(DEPTH.orb).setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(lighting.orb.halo)).setAlpha(lighting.time === 'night' ? 0.35 : 0.6);
    this.orb = sc.add.image(0, 0, FX_TEXTURE, 'glow').setScrollFactor(0).setDepth(DEPTH.orb).setTint(hexNum(lighting.orb.color));
    this.objects.push(this.halo, this.orb);
    if (profile.clouds) {
      this.clouds = sc.add.tileSprite(0, 0, 16, 16, this.tex(`${p}-clouds`, () => buildClouds(lighting, s))).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.clouds);
      this.cloudTexH = Math.round(300 * s);
      this.objects.push(this.clouds);
    }
    const wanted: number[] = profile.parallaxLayers === 3 ? [0, 1, 2] : profile.parallaxLayers === 2 ? [0, 2] : [1];
    for (const index of wanted) {
      const key = this.tex(`${p}-layer${index}`, () => buildLayer(theme, index as 0 | 1 | 2, lighting, s));
      const texH = Math.round(LAYER_H[index]! * s);
      const ts = sc.add.tileSprite(0, 0, 16, texH, key).setOrigin(0, 1).setScrollFactor(0).setDepth(DEPTH.layer + index);
      this.layers.push({ ts, index, texH });
      this.objects.push(ts);
    }
    this.field = sc.add.image(0, 0, this.tex(`${p}-field`, () => buildField(theme, lighting))).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.field);
    this.objects.push(this.field);
    sc.cameras.main.setBackgroundColor(lighting.sky[2]);
  }

  /** Screen y of the horizon for a camera state. */
  static horizonY(groundY: number, ppm: number): number {
    return groundY - HORIZON_M * ppm;
  }

  update(camX: number, ppm: number, groundY: number, W: number, H: number, dtS: number): void {
    const L = this.lighting;
    if (!L || !this.sky || !this.field) return;
    const horizon = ParallaxEnvironment.horizonY(groundY, ppm);
    const wallFoot = groundY - (LANE_GAP_M + LANE_EDGE_M + WALL_GAP_M) * ppm;
    const skyH = Math.max(2, horizon + 4);
    this.sky.setDisplaySize(W, skyH);
    if (this.stars) {
      this.stars.setSize(W, skyH);
      this.stars.tilePositionX = camX * ppm * 0.004;
    }
    const ox = W * L.orb.x;
    const oy = Math.max(-200, horizon * L.orb.y);
    const unit = Math.min(W, H * 1.4);
    this.orb?.setPosition(ox, oy).setDisplaySize(unit * L.orb.radius * 5, unit * L.orb.radius * 5);
    this.halo?.setPosition(ox, oy).setDisplaySize(unit * L.orb.haloRadius * 2, unit * L.orb.haloRadius * 2);
    // sizes follow the view height; distant layers barely react to the camera zoom
    const base = H / 760;
    const zoomK = ppm / 72;
    if (this.clouds) {
      // the whole cloud band always fits above the horizon (never cut by its bottom edge)
      const texH = this.cloudTexH;
      const s = Math.min((base * 0.95 * 300) / texH, Math.max(0.05, (horizon * 0.92) / texH));
      this.drift += dtS * 5;
      this.clouds.setVisible(horizon > 30).setPosition(0, 0).setSize(W / s, texH).setScale(s);
      this.clouds.tilePositionX = (camX * ppm * CLOUD_FACTOR + this.drift) / s;
    }
    const fieldH = Math.max(2, wallFoot - horizon);
    for (const { ts, index, texH } of this.layers) {
      const s = (base * zoomK ** [0.12, 0.28, 0.5][index]!) * (LAYER_H[index]! / texH) * [1, 0.95, 0.9][index]!;
      // far and middle layers stand on the horizon; the near one on the ground in front of it
      const foot = horizon + fieldH * [0.02, 0.08, 0.5][index]!;
      ts.setPosition(0, foot).setSize(W / s, texH).setScale(s);
      ts.tilePositionX = (camX * ppm * PARALLAX_FACTORS[index]!) / s;
    }
    this.field.setPosition(0, horizon - 1).setDisplaySize(W, fieldH + 4);
  }

  /** Parallax state for the visual tests. */
  debug(): { layers: { index: number; tileX: number; y: number; scale: number }[]; horizonLayers: number } {
    return { layers: this.layers.map((l) => ({ index: l.index, tileX: l.ts.tilePositionX, y: l.ts.y, scale: l.ts.scaleX })), horizonLayers: this.layers.length };
  }

  private clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.layers = [];
    this.sky = this.stars = this.clouds = null;
    this.halo = this.orb = this.field = null;
    for (const k of this.keys) if (k !== 'env-stars' && this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.keys = [];
  }

  destroy(): void {
    this.clear();
  }
}
