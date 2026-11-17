import type { TrackConfig } from '../../data/schema';
import { mix, parseHex, toHex } from '../vehicles/art/svg';

/**
 * Scene lighting: day, late afternoon and night. One state drives everything that depends on the
 * light – sky, ambient tint of sprites, vehicle reflections, shadows, track lamps and the cars'
 * own lamps – so the whole picture changes together.
 */
export type TimeOfDay = 'day' | 'dusk' | 'night';
export type TimeOfDaySetting = 'track' | TimeOfDay;

export interface LightingState {
  time: TimeOfDay;
  /** Sky gradient from the zenith to the horizon. */
  sky: [string, string, string];
  /** Sun or moon: position as a fraction of the view (x) and of the sky height (y). */
  orb: { x: number; y: number; radius: number; color: string; halo: string; haloRadius: number };
  /** Star visibility 0..1. */
  stars: number;
  /** Colour and strength of the ambient light (multiplies every lit surface). */
  ambient: string;
  intensity: number;
  /** Atmospheric haze: distant objects fade towards this colour. */
  haze: string;
  hazeAmount: number;
  cloud: { lit: string; shade: string; alpha: number };
  /** Vehicle reflections: colour of the reflected sky and their strength. */
  gloss: { color: string; alpha: number };
  /** Contact shadows: opacity, horizontal offset (m, + towards the front) and stretch. */
  shadow: { alpha: number; offsetM: number; stretch: number };
  /** Track floodlights and the cars' head/tail lamps. */
  trackLamps: boolean;
  headlights: boolean;
  /** Strength of additive light effects 0..1. */
  glow: number;
}

/** Default time of day of each track theme. */
export const THEME_TIME: Record<TrackConfig['theme'], TimeOfDay> = {
  testTrack: 'day',
  desert: 'dusk',
  nightIndustrial: 'night',
  airfield: 'day',
  // campaign scenes: always night
  distritoIndustrial: 'night',
  baixada: 'night',
  avenidaNorte: 'night',
  patioDasTorres: 'night',
  distritoFinanceiro: 'night',
  corredorDaLiga: 'night',
};

/** Themes that are only ever lit at night (the campaign's street scenes). */
export const NIGHT_ONLY_THEMES: ReadonlySet<TrackConfig['theme']> = new Set(['distritoIndustrial', 'baixada', 'avenidaNorte', 'patioDasTorres', 'distritoFinanceiro', 'corredorDaLiga']);

const BASE: Record<TimeOfDay, LightingState> = {
  day: {
    time: 'day',
    sky: ['#2f6fb5', '#74aede', '#cfe4f2'],
    orb: { x: 0.78, y: 0.2, radius: 0.028, color: '#fffbe6', halo: '#fff3c0', haloRadius: 0.22 },
    stars: 0,
    ambient: '#ffffff',
    intensity: 1,
    haze: '#c4d9e8',
    hazeAmount: 0.55,
    cloud: { lit: '#ffffff', shade: '#b9c8d6', alpha: 0.9 },
    gloss: { color: '#eaf4ff', alpha: 1 },
    shadow: { alpha: 0.85, offsetM: -0.12, stretch: 1 },
    trackLamps: false,
    headlights: false,
    glow: 0,
  },
  dusk: {
    time: 'dusk',
    sky: ['#2a3f78', '#d9795a', '#ffd08a'],
    orb: { x: 0.2, y: 0.82, radius: 0.04, color: '#fff0c8', halo: '#ffb060', haloRadius: 0.42 },
    stars: 0.15,
    ambient: '#ffd2a6',
    intensity: 0.86,
    haze: '#f3b98a',
    hazeAmount: 0.6,
    cloud: { lit: '#ffc9a0', shade: '#7d5f7e', alpha: 0.85 },
    gloss: { color: '#ffd9b0', alpha: 0.95 },
    shadow: { alpha: 0.7, offsetM: 0.55, stretch: 1.35 },
    trackLamps: true,
    headlights: true,
    glow: 0.55,
  },
  night: {
    time: 'night',
    sky: ['#03050c', '#0b1326', '#1c2740'],
    orb: { x: 0.72, y: 0.24, radius: 0.022, color: '#e9eefc', halo: '#7f9bd8', haloRadius: 0.14 },
    stars: 1,
    ambient: '#9db1e6',
    intensity: 0.6,
    haze: '#101828',
    hazeAmount: 0.7,
    cloud: { lit: '#27324d', shade: '#0c1220', alpha: 0.7 },
    gloss: { color: '#aebff0', alpha: 0.75 },
    shadow: { alpha: 0.55, offsetM: 0, stretch: 1.1 },
    trackLamps: true,
    headlights: true,
    glow: 1,
  },
};

/** Per-theme atmosphere adjustments on top of the time of day. */
function themed(theme: TrackConfig['theme'], s: LightingState): LightingState {
  const out: LightingState = structuredClone(s);
  if (theme === 'desert') {
    if (s.time === 'day') {
      out.sky = ['#3f7fc0', '#9cc3e2', '#f1e3c4'];
      out.haze = '#ead9b8';
      out.ambient = '#fff6e6';
    } else if (s.time === 'dusk') {
      out.sky = ['#3a3f7a', '#e2814f', '#ffd59a'];
      out.haze = '#f6c08a';
    }
  } else if (theme === 'nightIndustrial' && s.time === 'night') {
    // city glow on the horizon
    out.sky = ['#04060d', '#101a30', '#2c3148'];
    out.haze = '#1a2032';
  } else if (theme === 'distritoIndustrial') {
    // sodium-vapour city glow: warm, yellowish haze
    out.sky = ['#05050a', '#16141c', '#3a2e22'];
    out.haze = '#2a2218';
    out.ambient = '#d9b98a';
  } else if (theme === 'baixada') {
    // cold mercury/LED light under the viaduct
    out.sky = ['#03060c', '#0a1424', '#1a2a3c'];
    out.haze = '#13202e';
    out.ambient = '#9fc0e8';
  } else if (theme === 'avenidaNorte') {
    // open avenue: mixed street light, brighter horizon from the city
    out.sky = ['#04050c', '#121a2e', '#33324a'];
    out.haze = '#1d1f32';
    out.ambient = '#c4c4e0';
    out.intensity = 0.66;
  } else if (theme === 'patioDasTorres') {
    // blue-white LED of office car parks
    out.sky = ['#03060e', '#0c1730', '#22324e'];
    out.haze = '#152238';
    out.ambient = '#b8cff0';
    out.intensity = 0.62;
  } else if (theme === 'distritoFinanceiro') {
    // bright skyline, architectural light, cool haze
    out.sky = ['#040812', '#111f3a', '#34416a'];
    out.haze = '#1c2846';
    out.ambient = '#c8d6f2';
    out.intensity = 0.68;
  } else if (theme === 'corredorDaLiga') {
    // flood-lit event: the brightest night scene
    out.sky = ['#05060c', '#141a2c', '#3c4058'];
    out.haze = '#262a3c';
    out.ambient = '#e2e6f6';
    out.intensity = 0.74;
  } else if (theme === 'airfield' && s.time === 'day') {
    out.sky = ['#3b7cc2', '#8fbfe6', '#e2eef6'];
    out.haze = '#d3e2ec';
  }
  return out;
}

export function resolveTime(theme: TrackConfig['theme'], setting: TimeOfDaySetting): TimeOfDay {
  if (NIGHT_ONLY_THEMES.has(theme)) return 'night';
  return setting === 'track' ? THEME_TIME[theme] : setting;
}

export function lightingFor(theme: TrackConfig['theme'], setting: TimeOfDaySetting): LightingState {
  return themed(theme, BASE[resolveTime(theme, setting)]);
}

/** A surface colour under this light (ambient colour × intensity). */
export function lit(color: string, l: LightingState, extra = 1): string {
  const [r, g, b] = parseHex(color);
  const [ar, ag, ab] = parseHex(l.ambient);
  const k = l.intensity * extra;
  return toHex((r * ar * k) / 255, (g * ag * k) / 255, (b * ab * k) / 255);
}

/** The same, then faded into the haze with distance (0 = near, 1 = horizon). */
export function litFar(color: string, l: LightingState, distance: number): string {
  return mix(lit(color, l), l.haze, Math.min(1, distance * l.hazeAmount));
}

/** Multiply tint (0xRRGGBB) for sprites that carry their own unlit colours. */
export function spriteTint(l: LightingState, extra = 1): number {
  return Number.parseInt(lit('#ffffff', l, extra).slice(1), 16);
}

export class LightingController {
  private key = '';
  state: LightingState = BASE.day;

  /** Returns true when the lighting changed (textures that bake the light must be rebuilt). */
  update(theme: TrackConfig['theme'], setting: TimeOfDaySetting): boolean {
    const key = `${theme}|${resolveTime(theme, setting)}`;
    if (key === this.key) return false;
    this.key = key;
    this.state = lightingFor(theme, setting);
    return true;
  }

  get id(): string {
    return this.key;
  }
}
