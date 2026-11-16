/**
 * Asset pipeline: exports the vehicle artwork of every car in the catalogue as layered SVG files
 * (under, body, gloss, lights, brake, shadow, hub, wheel) plus a JSON manifest with the visual
 * metadata (scale, wheel centres, exhaust and lamp positions, anchor points).
 *
 * The game builds exactly the same layers at run time from the car configuration and rasterises
 * them into one texture atlas per car (so edited cars always match their physics geometry); this
 * export is for documentation, review and external tools. The pipeline is reproducible: the same
 * configuration always produces the same files.
 *
 *   npm run assets [outDir] [pxPerMetre]      (default: dist-assets/sprites, 144)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LAB_CARS } from '../../src/data/cars/index';
import { validateCar } from '../../src/data/schema';
import { buildVehicleLayers } from '../../src/game/vehicles/VehicleSpriteAssembler';

const outDir = resolve(process.argv[2] ?? 'dist-assets/sprites');
const pxPerM = Number(process.argv[3] ?? 144);
mkdirSync(outDir, { recursive: true });

const manifest: Record<string, unknown>[] = [];
for (const car of LAB_CARS) {
  const v = validateCar(car);
  if (!v.ok) throw new Error(`${car.id}: invalid configuration – ${v.errors.join('; ')}`);
  const { layers, meta } = buildVehicleLayers(car, pxPerM);
  const files: Record<string, { file: string; sizePx: [number, number] }> = {};
  for (const l of layers) {
    const file = `${car.id}.${l.name}.svg`;
    writeFileSync(join(outDir, file), l.svg);
    files[l.name] = { file, sizePx: [l.w, l.h] };
  }
  manifest.push({ id: car.id, name: car.name, bodyStyle: car.visual.bodyStyle, layers: files, meta });
}
writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify({ generator: 'drag-physics-sandbox-2d asset pipeline', pxPerMetre: pxPerM, cars: manifest }, null, 2)}\n`);
console.log(`${manifest.length} cars, ${manifest.length * 8} SVG layers → ${outDir}`);
