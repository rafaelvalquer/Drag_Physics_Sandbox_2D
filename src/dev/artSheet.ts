import { LAB_CARS } from '../data/cars/index';
import { composeVehicle } from '../game/vehicles/compose';
import { assembleVehicleSprites } from '../game/vehicles/VehicleSpriteAssembler';

/**
 * Contact sheet of the vehicle artwork (open the app with `?artsheet`). A review tool of the
 * asset pipeline: every car of the catalogue, composed from the same atlas frames the game uses,
 * on a neutral background. `?artsheet=night` shows the lit lamps, `&car=<id>` a single car.
 */
export async function renderArtSheet(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const night = q.get('artsheet') === 'night';
  const only = q.get('car');
  const from = Number(q.get('from') ?? 0);
  const count = Number(q.get('count') ?? 99);
  const cars = LAB_CARS.filter((c) => !only || c.id === only).slice(from, from + count);
  const pxPerM = Number(q.get('ppm') ?? (only ? 230 : 150));
  const sets = await Promise.all(cars.map((c) => assembleVehicleSprites(c, pxPerM)));
  const rowH = Math.round(pxPerM * 2.05);
  const W = Math.round(pxPerM * 6.4);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = rowH * cars.length;
  canvas.id = 'artsheet';
  const ctx = canvas.getContext('2d')!;
  sets.forEach((set, i) => {
    const y0 = i * rowH;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + rowH);
    if (night) {
      g.addColorStop(0, '#0b1018');
      g.addColorStop(0.78, '#1a2230');
      g.addColorStop(0.8, '#22262b');
      g.addColorStop(1, '#101214');
    } else {
      g.addColorStop(0, '#9fb9cc');
      g.addColorStop(0.78, '#d9e3ea');
      g.addColorStop(0.8, '#5b6066');
      g.addColorStop(1, '#3b3f44');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, rowH);
    const groundY = y0 + rowH * 0.86;
    const frontX = W / 2 - ((set.meta.rearX + set.meta.noseX) / 2) * pxPerM;
    composeVehicle(ctx, set, frontX, groundY, 1, { lights: night, rearAngle: 0.3, frontAngle: 0.3 });
    ctx.fillStyle = night ? '#d5dbe2' : '#1c2126';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(`${cars[i]!.name}  ·  ${cars[i]!.visual.bodyStyle}  ·  ${set.meta.lengthM.toFixed(2)} × ${set.meta.heightM.toFixed(2)} m`, 16, y0 + 30);
  });
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#111';
  document.body.style.overflow = 'auto';
  document.body.append(canvas);
}
