import type { GraphicsQuality } from '../../app/graphics';
import type { CarConfig, TrackConfig } from '../../data/schema';
import type { CameraMode } from './CameraController';
import type { TimeOfDaySetting } from './LightingController';

/**
 * What the scene needs to draw one vehicle. Every value is read from the physics; the renderer
 * never writes anything back.
 */
export interface RenderVehicle {
  id: string;
  car: CarConfig;
  /** Front axle ground contact, metres along the track (0 = start line). */
  x: number;
  lane: 0 | 1;
  /** Body pitch computed by the physics (rad). */
  pitch: number;
  /** Rotation angles integrated by the physics for each axle (rad). */
  wheelAngleDriven: number;
  wheelAngleFree: number;
  /** Angular speed of each axle's wheels (rad/s): driven = driveline, free = road speed / radius. */
  wheelOmegaDriven: number;
  wheelOmegaFree: number;
  /** Tread speed relative to the road at the driven tyres (m/s, signed) and their slip ratio. */
  slipSpeed: number;
  slipRatio: number;
  speed: number;
  /** Longitudinal acceleration (m/s²). */
  accel: number;
  afterfire: boolean;
  isPlayer: boolean;
  /** Changes whenever the car's visual config changes (texture rebuild). */
  artKey: string;
  rpm: number;
  running: boolean;
  cranking: boolean;
  /** Engine load 0..1. */
  load: number;
  /** The automatic brakes are applied (held on the line or stopping after the finish). */
  braking: boolean;
  /** A gear change is in progress. */
  shifting: boolean;
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
  /** False while the active mode shows its own view (the scene then skips its work). */
  visible(): boolean;
  /** A point (m) the camera should keep in frame with the player, or null. */
  focusM(): number | null;
  graphics(): GraphicsQuality;
  timeOfDay(): TimeOfDaySetting;
}
