import Phaser from 'phaser';
import { GRAPHICS, type GraphicsProfile } from '../../app/graphics';
import { buildFxAtlas } from '../vehicles/fxArt';
import { FX_TEXTURE, VehicleParticleSystem } from '../vehicles/VehicleParticleSystem';
import { VehicleTextureRegistry, VehicleVisualController, type VehicleVisualInfo } from '../vehicles/VehicleVisualController';
import { CameraController } from './CameraController';
import { LightingController, lit, spriteTint } from './LightingController';
import { ParallaxEnvironment } from './ParallaxEnvironment';
import { CAMERA_MODE_CODE, FrameLog, type FrameField } from './frameLog';
import type { RenderVehicle, SceneBridge } from './renderTypes';
import { SURFACES } from './trackArt';
import { TrackRenderer } from './TrackRenderer';
import { LANE_GAP_M, PPM_BASE, TRACK_END_MARGIN_M, TRACK_START_M, laneScale, laneYPx } from './worldScale';

export { PPM_BASE };
export type { CameraMode } from './CameraController';
export type { RenderVehicle, SceneBridge, TrackMarker, TreeLights } from './renderTypes';

interface Indicator {
  box: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

/** Snapshot of what is on screen, read by the visual tests. */
export interface VisualDebug {
  viewW: number;
  viewH: number;
  ppm: number;
  camX: number;
  groundY: number;
  lighting: string;
  profile: string;
  vehicles: (VehicleVisualInfo & { id: string; lane: number; screenX: number; screenGroundY: number; screenLengthPx: number })[];
  particles: { live: number; marks: number; pooled: number; emitted: Record<string, number> };
  parallax: { layers: { index: number; tileX: number; y: number; scale: number }[] };
  track: { props: number; textures: number; treeVisible: boolean; litBulbs: number };
  vehicleTextures: number;
  fps: number;
  /** Camera mode, zoom and the player's positions for the last frame (diagnostics). */
  cameraMode: string;
  zoom: number;
  player: { physicsX: number; renderX: number; screenX: number; interpolationAlpha: number; physicsSteps: number } | null;
  realDeltaMs: number;
  visualDeltaMs: number;
  /** The last `frames` recorded frames (oldest first; none unless asked), see frameLog.ts. */
  frames: Record<FrameField, number[]>;
}

/**
 * Side-view scene. It is an orchestrator: the camera, lighting, environment, track, vehicle and
 * particle components do the work. Purely a view – every position, wheel speed, acceleration and
 * slip comes from the physics through the bridge; the scene never changes the simulation.
 */
export class RaceScene extends Phaser.Scene {
  private bridge!: SceneBridge;
  private readonly camera = new CameraController();
  private readonly lighting = new LightingController();
  private env!: ParallaxEnvironment;
  private track!: TrackRenderer;
  private particles!: VehicleParticleSystem;
  private vehTextures!: VehicleTextureRegistry;
  private readonly cars = new Map<string, { ctl: VehicleVisualController; lane: 0 | 1 }>();
  private ui!: Phaser.GameObjects.Graphics;
  private youLabel!: Phaser.GameObjects.Text;
  private readonly indicators = new Map<string, Indicator>();
  private profile: GraphicsProfile | null = null;
  private trackKey = '';
  private lastNow = 0;
  private lastVehicles: RenderVehicle[] = [];
  readonly frameLog = new FrameLog();

  constructor() {
    super('race');
  }

  init(data: { bridge: SceneBridge }): void {
    this.bridge = data.bridge;
  }

  create(): void {
    const fx = buildFxAtlas();
    const tex = this.textures.addCanvas(FX_TEXTURE, fx.canvas);
    if (tex) for (const [name, f] of Object.entries(fx.frames)) tex.add(name, 0, f.x, f.y, f.w, f.h);
    this.env = new ParallaxEnvironment(this);
    this.track = new TrackRenderer(this);
    this.vehTextures = new VehicleTextureRegistry(this);
    this.particles = new VehicleParticleSystem(this, this.track.fxLayer, this.track.marksLayer, GRAPHICS.high);
    this.ui = this.add.graphics().setScrollFactor(0).setDepth(40);
    this.youLabel = this.add
      .text(0, 0, 'VOCÊ', { fontFamily: 'system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#101418', backgroundColor: '#f2b705', padding: { x: 5, y: 2 } })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(41)
      .setVisible(false);
  }

  /** Rebuilds the cached scenery when the track, the lighting or the graphics profile changes. */
  private syncScenery(): GraphicsProfile {
    const cfg = this.bridge.track();
    const profile = GRAPHICS[this.bridge.graphics()];
    const lightChanged = this.lighting.update(cfg.theme, this.bridge.timeOfDay());
    const key = `${cfg.id}|${cfg.theme}|${cfg.lengthM}`;
    if (lightChanged || profile !== this.profile || key !== this.trackKey) {
      this.profile = profile;
      this.trackKey = key;
      const L = this.lighting.state;
      this.env.build(cfg.theme, L, this.lighting.id, profile);
      this.track.build(cfg, L, this.lighting.id, profile);
      this.particles.setProfile(profile);
      this.particles.clear();
      this.particles.setLighting(spriteTint(L, 1.12));
    }
    return profile;
  }

  override update(_time: number, deltaMs: number): void {
    // Real elapsed time (Phaser's delta is smoothed/quantised to the target frame rate, which
    // would make the simulation drift from the audio clock). Long gaps are passed through so the
    // runner can cap them and report the dropped time honestly.
    const now = performance.now();
    const realDt = this.lastNow === 0 ? deltaMs / 1000 : (now - this.lastNow) / 1000;
    this.lastNow = now;
    this.bridge.tick(realDt);
    const visible = this.bridge.visible();
    this.cameras.main.setVisible(visible);
    if (!visible) return;
    // one visual clock for everything drawn (camera, easing, animation, particles): the same real
    // elapsed time the physics advanced by, capped so a long gap does not overshoot any easing.
    // Phaser's delta is smoothed to the display rate; mixing it with the physics clock made the
    // camera and the car advance by different amounts each frame.
    const dtS = Math.min(0.1, Math.max(0, realDt));
    const W = this.scale.width;
    const H = this.scale.height;
    const cfg = this.bridge.track();
    const profile = this.syncScenery();
    const L = this.lighting.state;
    const vehicles = this.bridge.vehicles();
    this.lastVehicles = vehicles;
    const player = vehicles.find((v) => v.isPlayer) ?? vehicles[0];

    // ---- camera
    const target = (v: RenderVehicle): { x: number; speed: number; wheelbaseM: number } => ({ x: v.x, speed: v.speed, wheelbaseM: v.car.wheelbaseM });
    const cam = this.camera.update(dtS, {
      mode: this.bridge.cameraMode,
      player: player ? target(player) : null,
      others: vehicles.filter((v) => v !== player).map(target),
      viewW: W,
      viewH: H,
      trackStartM: TRACK_START_M,
      trackEndM: cfg.lengthM + TRACK_END_MARGIN_M,
      userZoom: this.bridge.zoom(),
      include: this.bridge.focusM(),
    });
    const zoom = cam.ppm / PPM_BASE;
    const toScreenX = (xm: number): number => W / 2 + (xm - cam.x) * cam.ppm;

    // ---- environment and track
    this.env.update(cam.x, cam.ppm, cam.groundY, W, H, dtS);
    const { x0, x1 } = this.track.update(cam.x, cam.ppm, cam.groundY, W, H, this.bridge.markers(), this.bridge.finishM(), this.bridge.tree());

    // ---- vehicles
    const dust = SURFACES[cfg.theme].dust;
    const dustTint = dust ? Number.parseInt(lit(dust, L).slice(1), 16) : null;
    const seen = new Set<string>();
    for (const v of vehicles) {
      seen.add(v.id);
      let entry = this.cars.get(v.id);
      if (!entry) {
        entry = { ctl: new VehicleVisualController(this, v.lane === 1 ? this.track.farLane : this.track.nearLane, this.vehTextures, this.particles, v.id), lane: v.lane };
        this.cars.set(v.id, entry);
      } else if (entry.lane !== v.lane) {
        (v.lane === 1 ? this.track.farLane : this.track.nearLane).add(entry.ctl.root);
        entry.lane = v.lane;
      }
      const onScreen = v.x + 4 > x0 && v.x - v.car.wheelbaseM - 4 < x1;
      entry.ctl.sync(v, dtS, { lighting: L, profile, dustTint, onScreen });
    }
    for (const [id, entry] of this.cars) {
      if (seen.has(id)) continue;
      entry.ctl.destroy();
      this.cars.delete(id);
    }
    this.particles.update(dtS, cfg.windMs, x0, x1);

    // ---- screen-space overlays: player marker and off-screen opponent indicator
    this.drawOverlays(vehicles, player, W, zoom, cam.groundY, cam.ppm, toScreenX);

    // ---- diagnostics (no allocation, no console output)
    const r = this.frameLog.row;
    r.t = now;
    r.physicsX = player?.physicsX ?? 0;
    r.renderX = player?.x ?? 0;
    r.cameraX = cam.x;
    r.screenX = player ? toScreenX(player.x) : 0;
    r.interpolationAlpha = player?.interpAlpha ?? 0;
    r.physicsSteps = player?.physicsSteps ?? 0;
    r.realDeltaMs = realDt * 1000;
    r.visualDeltaMs = dtS * 1000;
    r.phaserDeltaMs = deltaMs;
    r.fps = this.game.loop.actualFps;
    r.ppm = cam.ppm;
    r.zoom = zoom;
    r.cameraMode = CAMERA_MODE_CODE[this.bridge.cameraMode];
    r.speed = player?.speed ?? 0;
    this.frameLog.commit();
  }

  private drawOverlays(vehicles: RenderVehicle[], player: RenderVehicle | undefined, W: number, zoom: number, groundY: number, ppm: number, toScreenX: (xm: number) => number): void {
    const ui = this.ui;
    ui.clear();
    const multi = vehicles.length > 1;
    const seen = new Set<string>();
    if (player && multi) {
      const ctl = this.cars.get(player.id)?.ctl;
      const sc = laneScale(player.lane);
      const sx = toScreenX(player.x - player.car.wheelbaseM / 2);
      const sy = groundY + (laneYPx(player.lane) + (ctl?.topPx ?? -1.4 * PPM_BASE) * sc) * zoom - 8;
      const inView = sx > 0 && sx < W && sy > 24;
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
            text: this.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#f2f4f6' }).setScrollFactor(0).setDepth(41),
          };
          this.indicators.set(v.id, ind);
        }
        const gap = v.x - player.x;
        const right = sx >= W;
        ind.text.setText(`${v.name}  ${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)} m`);
        const tw = ind.text.width;
        const y = Math.max(40, groundY + (v.lane === 1 ? -LANE_GAP_M : 0) * ppm - 1.9 * ppm);
        const bx = right ? W - tw - 34 : 34;
        ind.text.setOrigin(0, 0.5).setPosition(bx, y).setVisible(true);
        const b = ind.box;
        b.clear();
        b.fillStyle(0x0d1014, 0.82);
        b.fillRoundedRect(bx - 10, y - 13, tw + 20, 26, 6);
        b.fillStyle(0x2bb3ff, 1);
        if (right) b.fillTriangle(W - 6, y, W - 20, y - 9, W - 20, y + 9);
        else b.fillTriangle(6, y, 20, y - 9, 20, y + 9);
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

  /** What is currently drawn, in screen pixels (read-only; used by the visual tests). */
  visualDebug(frames = 0): VisualDebug {
    const cam = this.camera.state;
    const W = this.scale.width;
    const zoom = cam.ppm / PPM_BASE;
    return {
      viewW: W,
      viewH: this.scale.height,
      ppm: cam.ppm,
      camX: cam.x,
      groundY: cam.groundY,
      lighting: this.lighting.id,
      profile: this.profile?.id ?? '',
      vehicles: this.lastVehicles.map((v) => {
        const info = this.cars.get(v.id)!.ctl.info();
        return {
          ...info,
          id: v.id,
          lane: v.lane,
          screenX: W / 2 + (v.x - cam.x) * cam.ppm,
          screenGroundY: cam.groundY + laneYPx(v.lane) * zoom,
          screenLengthPx: info.lengthM * cam.ppm * laneScale(v.lane),
        };
      }),
      particles: { ...this.particles.stats, emitted: { ...this.particles.emitted } },
      parallax: this.env.debug(),
      track: this.track.debug(),
      vehicleTextures: this.vehTextures.liveTextures,
      fps: this.game.loop.actualFps,
      cameraMode: this.bridge.cameraMode,
      zoom,
      player: (() => {
        const p = this.lastVehicles.find((v) => v.isPlayer) ?? this.lastVehicles[0];
        return p ? { physicsX: p.physicsX, renderX: p.x, screenX: W / 2 + (p.x - cam.x) * cam.ppm, interpolationAlpha: p.interpAlpha, physicsSteps: p.physicsSteps } : null;
      })(),
      realDeltaMs: this.frameLog.row.realDeltaMs,
      visualDeltaMs: this.frameLog.row.visualDeltaMs,
      frames: this.frameLog.dump(frames),
    };
  }
}
