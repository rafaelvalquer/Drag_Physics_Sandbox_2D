/**
 * Graphics profiles. They only change how much is drawn (texture resolution, particle budgets,
 * optional layers); the simulation and the audio are identical in every profile.
 */
import type { TimeOfDaySetting } from '../game/scenes/LightingController';

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type { TimeOfDaySetting };

export interface GraphicsProfile {
  id: GraphicsQuality;
  /** Resolution of the vehicle atlas (px per metre). */
  carPxPerM: number;
  /** Wheel motion blur: none, one fully blurred stage, or the progressive three stages. */
  wheelBlur: 'off' | 'full' | 'staged';
  /** Hard limit of live particles (pooled). */
  maxParticles: number;
  /** Multiplier of every particle emission rate. */
  particleRate: number;
  /** Hard limit of tyre-mark decals. */
  maxMarks: number;
  /** Parallax layers behind the track (far, mid, near). */
  parallaxLayers: 1 | 2 | 3;
  clouds: boolean;
  /** Additive light effects: lamp pools, headlight beams, lamp halos. */
  glow: boolean;
  /** Out-of-focus foreground layer in front of the track. */
  foreground: boolean;
  /** Small rubber debris thrown by spinning tyres. */
  debris: boolean;
  /** Resolution multiplier of the scenery textures. */
  sceneryScale: number;
}

export const GRAPHICS: Record<GraphicsQuality, GraphicsProfile> = {
  low: { id: 'low', carPxPerM: 72, wheelBlur: 'off', maxParticles: 70, particleRate: 0.4, maxMarks: 120, parallaxLayers: 2, clouds: false, glow: false, foreground: false, debris: false, sceneryScale: 0.5 },
  medium: { id: 'medium', carPxPerM: 104, wheelBlur: 'full', maxParticles: 160, particleRate: 0.7, maxMarks: 260, parallaxLayers: 3, clouds: true, glow: true, foreground: false, debris: false, sceneryScale: 0.75 },
  high: { id: 'high', carPxPerM: 144, wheelBlur: 'staged', maxParticles: 280, particleRate: 1, maxMarks: 420, parallaxLayers: 3, clouds: true, glow: true, foreground: true, debris: true, sceneryScale: 1 },
};

export const GRAPHICS_LABELS: Record<GraphicsQuality, string> = { low: 'baixo', medium: 'médio', high: 'alto' };
export const TIME_OF_DAY_LABELS: Record<TimeOfDaySetting, string> = { track: 'padrão da pista', day: 'dia', dusk: 'fim de tarde', night: 'noite' };
