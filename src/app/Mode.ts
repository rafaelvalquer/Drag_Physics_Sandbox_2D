import type { AudioEngine } from '../audio/core/AudioEngine';
import type { CameraMode, RenderVehicle, TrackMarker, TreeLights } from '../game/scenes/RaceScene';
import type { InputManager } from '../game/input/InputManager';
import type { TrackConfig } from '../data/schema';
import type { Store } from '../storage/db';
import type { AppSettings } from './settings';

/** Services shared by all modes. */
export interface AppContext {
  readonly panel: HTMLElement;
  readonly hud: HTMLElement;
  readonly overlay: HTMLElement;
  readonly input: InputManager;
  readonly audio: AudioEngine;
  readonly store: Store;
  readonly settings: AppSettings;
  /** Persists one setting and notifies the modes. */
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
}

/**
 * One application mode (Sandbox, Drag Race, Dyno). A mode owns its simulation; the shared Phaser
 * scene only renders what the active mode returns through the view methods.
 */
export interface Mode {
  readonly id: string;
  readonly label: string;
  /** False for modes that render their own view instead of the track (dyno). */
  readonly usesTrack: boolean;
  mount(ctx: AppContext): void;
  unmount(): void;
  /** Real frame time step (s). Called once per rendered frame by the scene. */
  tick(dtS: number): void;
  vehicles(): RenderVehicle[];
  track(): TrackConfig;
  markers(): TrackMarker[];
  tree(): TreeLights | null;
  finishM(): number | null;
  cameraMode: CameraMode;
  /** The audio context became available (first user gesture) – create the voices. */
  onAudioReady(): void;
  onSettingsChanged?(key: keyof AppSettings): void;
}
