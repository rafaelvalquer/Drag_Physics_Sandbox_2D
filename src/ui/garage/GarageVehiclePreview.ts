import type { CarConfig } from '../../data/schema';
import { composeVehicle, type ComposeOptions } from '../../game/vehicles/compose';
import { assembleVehicleSprites, type VehicleSpriteSet } from '../../game/vehicles/VehicleSpriteAssembler';

/**
 * Large studio view of a car: the same atlas artwork used on the track, drawn big on a dark
 * showroom floor with spot lighting, a contact shadow and a floor reflection. Rendering happens
 * only when something changes (car, size, lamps) – it is not an animation loop.
 */
export type PreviewBackdrop = 'studio' | 'plain';

export class GarageVehiclePreview {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private set: VehicleSpriteSet | null = null;
  private token = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  lights = false;
  /** Fraction of the canvas width the car's length should fill. */
  fill = 0.74;

  constructor(private readonly backdrop: PreviewBackdrop = 'studio') {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'garage-preview';
    this.canvas.setAttribute('data-testid', 'garage-preview');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  /** Sets the CSS size; the backing store follows the device pixel ratio. */
  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    this.w = Math.max(50, Math.round(cssW * this.dpr));
    this.h = Math.max(50, Math.round(cssH * this.dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.render();
  }

  /** Loads the car's artwork at a resolution that suits the current size. */
  async setCar(car: CarConfig): Promise<void> {
    const token = ++this.token;
    const needed = (this.w * this.fill) / car.visual.lengthM;
    const pxPerM = Math.min(280, Math.max(60, Math.ceil(needed / 20) * 20));
    const set = await assembleVehicleSprites(car, pxPerM);
    if (token !== this.token) return;
    this.set = set;
    this.render();
  }

  /** Metrics of the last render (for the tests): car length and ground line in canvas pixels. */
  layout(): { carPx: number; groundY: number; width: number; height: number; loaded: boolean } {
    const set = this.set;
    const carPx = set ? this.w * this.fill : 0;
    return { carPx, groundY: this.h * 0.74, width: this.w, height: this.h, loaded: !!set };
  }

  render(opts: ComposeOptions = {}): void {
    const { ctx, w, h } = this;
    if (w === 0 || h === 0) return;
    const groundY = h * 0.74;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (this.backdrop === 'studio') {
      // back wall with a soft spot, then the floor
      const wall = ctx.createLinearGradient(0, 0, 0, groundY);
      wall.addColorStop(0, '#0c0f13');
      wall.addColorStop(1, '#232a33');
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, w, groundY);
      const spot = ctx.createRadialGradient(w * 0.5, groundY * 0.55, 10, w * 0.5, groundY * 0.55, w * 0.55);
      spot.addColorStop(0, 'rgba(190,205,225,0.28)');
      spot.addColorStop(1, 'rgba(190,205,225,0)');
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, w, groundY);
      // light strips on the wall
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (const fx of [0.16, 0.39, 0.61, 0.84]) ctx.fillRect(w * fx - w * 0.045, groundY * 0.1, w * 0.09, groundY * 0.035);
      const floor = ctx.createLinearGradient(0, groundY, 0, h);
      floor.addColorStop(0, '#39414b');
      floor.addColorStop(0.25, '#1d2228');
      floor.addColorStop(1, '#0a0c0f');
      ctx.fillStyle = floor;
      ctx.fillRect(0, groundY, w, h - groundY);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, groundY, w, Math.max(1, this.dpr));
    }
    const set = this.set;
    if (!set) return;
    const k = (w * this.fill) / (set.meta.lengthM * set.meta.pxPerM);
    const px = set.meta.pxPerM * k;
    const frontX = w / 2 - ((set.meta.rearX + set.meta.noseX) / 2) * px;
    const o: ComposeOptions = { lights: this.lights, ...opts };
    if (this.backdrop === 'studio') {
      // polished floor: mirrored car, fading with distance from the contact line
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, groundY, w, h - groundY);
      ctx.clip();
      ctx.translate(0, groundY * 2);
      ctx.scale(1, -1);
      ctx.globalAlpha = 0.2;
      composeVehicle(ctx, set, frontX, groundY, k, { ...o, shadow: false });
      ctx.restore();
      const fade = ctx.createLinearGradient(0, groundY, 0, groundY + (h - groundY) * 0.7);
      fade.addColorStop(0, 'rgba(10,12,15,0)');
      fade.addColorStop(1, 'rgba(10,12,15,1)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, groundY, w, h - groundY);
    }
    composeVehicle(ctx, set, frontX, groundY, k, o);
    if (this.backdrop === 'studio') {
      // vignette
      const v = ctx.createRadialGradient(w / 2, h * 0.5, h * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
