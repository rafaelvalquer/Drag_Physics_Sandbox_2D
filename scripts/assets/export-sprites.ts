/**
 * Asset pipeline: exports the procedural car sprites (body and wheel SVG) for every car in the
 * catalogue, plus a JSON manifest with the texture sizes and physics anchor points.
 *
 * The game builds the same SVGs at runtime from the car configuration (so edited cars always
 * match their physics geometry); this export is for documentation, review and external tools.
 *
 *   npm run assets [outDir]      (default: dist-assets/sprites)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LAB_CARS } from '../../src/data/cars/index';
import { validateCar } from '../../src/data/schema';
import { buildCarArt } from '../../src/game/vehicles/carArt';

const outDir = resolve(process.argv[2] ?? 'dist-assets/sprites');
mkdirSync(outDir, { recursive: true });

const manifest: Record<string, unknown>[] = [];
for (const car of LAB_CARS) {
  const v = validateCar(car);
  if (!v.ok) throw new Error(`${car.id}: invalid configuration – ${v.errors.join('; ')}`);
  const art = buildCarArt(car);
  const body = `${car.id}.body.svg`;
  const wheel = `${car.id}.wheel.svg`;
  writeFileSync(join(outDir, body), art.bodySvg);
  writeFileSync(join(outDir, wheel), art.wheelSvg);
  manifest.push({
    id: car.id,
    name: car.name,
    body,
    wheel,
    pxPerMetre: art.scale,
    bodySizePx: [art.bodyW, art.bodyH],
    wheelDiameterPx: art.wheelD,
    frontAxlePx: [art.frontAxleX, art.axleY],
    exhaustPx: [art.exhaustX, art.exhaustY],
    wheelbaseM: car.wheelbaseM,
    tyreRadiusM: car.tires.radiusM,
  });
  console.log(`${car.name.padEnd(24)} ${body}  ${wheel}  ${art.bodyW}×${art.bodyH}px`);
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${manifest.length} cars → ${outDir}`);
