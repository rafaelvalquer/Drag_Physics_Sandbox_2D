import { DEFAULT_BINDINGS, validateBindings, type Bindings } from '../game/input/InputManager';
import type { Store } from '../storage/db';
import type { GraphicsQuality, TimeOfDaySetting } from './graphics';

export interface AppSettings {
  bindings: Bindings;
  masterVolume: number;
  muted: boolean;
  units: 'kmh' | 'mph';
  audioQuality: 'high' | 'low';
  /** AI opponents use the low quality acoustic model to save CPU. */
  opponentLowQuality: boolean;
  /** Camera zoom multiplier, 0.6 (wider) .. 1.6 (closer). */
  cameraZoom: number;
  /** Time for the throttle to go from 0 to 100 % while the key is held (s). */
  pedalRiseS: number;
  /** On-screen driving buttons: auto = touch screens only. */
  touchControls: 'auto' | 'on' | 'off';
  /** Graphics profile (texture resolution, particles, optional layers). */
  graphics: GraphicsQuality;
  /** Scene lighting: the track's own time of day or a fixed one. */
  timeOfDay: TimeOfDaySetting;
}

export const DEFAULT_SETTINGS: AppSettings = {
  bindings: DEFAULT_BINDINGS,
  masterVolume: 0.5,
  muted: false,
  units: 'kmh',
  audioQuality: 'high',
  opponentLowQuality: true,
  cameraZoom: 1,
  pedalRiseS: 0.09,
  touchControls: 'auto',
  graphics: 'high',
  timeOfDay: 'track',
};

export const ZOOM_RANGE = [0.6, 1.6] as const;
export const PEDAL_RISE_RANGE = [0.02, 0.6] as const;

/** Loads settings, falling back to defaults field by field (invalid stored values are ignored). */
export async function loadSettings(store: Store): Promise<AppSettings> {
  const s: AppSettings = structuredClone(DEFAULT_SETTINGS);
  const get = async <T>(k: string): Promise<T | undefined> => {
    try {
      return await store.get<T>('settings', k);
    } catch {
      return undefined;
    }
  };
  const b = await get<Bindings>('bindings');
  if (b && typeof b === 'object') {
    const merged = { ...DEFAULT_BINDINGS, ...b } as Bindings;
    if (validateBindings(merged).length === 0) s.bindings = merged;
  }
  const vol = await get<number>('masterVolume');
  if (typeof vol === 'number' && Number.isFinite(vol)) s.masterVolume = Math.min(1, Math.max(0, vol));
  const muted = await get<boolean>('muted');
  if (typeof muted === 'boolean') s.muted = muted;
  const units = await get<string>('units');
  if (units === 'kmh' || units === 'mph') s.units = units;
  const q = await get<string>('audioQuality');
  if (q === 'high' || q === 'low') s.audioQuality = q;
  const olq = await get<boolean>('opponentLowQuality');
  if (typeof olq === 'boolean') s.opponentLowQuality = olq;
  const zoom = await get<number>('cameraZoom');
  if (typeof zoom === 'number' && zoom >= ZOOM_RANGE[0] && zoom <= ZOOM_RANGE[1]) s.cameraZoom = zoom;
  const rise = await get<number>('pedalRiseS');
  if (typeof rise === 'number' && rise >= PEDAL_RISE_RANGE[0] && rise <= PEDAL_RISE_RANGE[1]) s.pedalRiseS = rise;
  const tc = await get<string>('touchControls');
  if (tc === 'auto' || tc === 'on' || tc === 'off') s.touchControls = tc;
  const gq = await get<string>('graphics');
  if (gq === 'low' || gq === 'medium' || gq === 'high') s.graphics = gq;
  const tod = await get<string>('timeOfDay');
  if (tod === 'track' || tod === 'day' || tod === 'dusk' || tod === 'night') s.timeOfDay = tod;
  return s;
}

export async function saveSetting<K extends keyof AppSettings>(store: Store, key: K, value: AppSettings[K]): Promise<void> {
  await store.put('settings', value, key);
}
