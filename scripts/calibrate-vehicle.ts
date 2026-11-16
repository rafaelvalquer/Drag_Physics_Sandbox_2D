/**
 * Performance calibration report: runs the factory-style standing-start test (src/game/race/
 * accelerationTest.ts) with the real physics and compares it with the documented targets.
 *
 *   npm run calibrate:vehicle                    → Volkswagen Gol GTS 1988 on the Test Track
 *   npm run calibrate:vehicle -- <car-id> [track-id]
 *
 * Nothing here changes the car: it only measures. Calibration means editing the documented
 * calibrated/estimated parameters in the data files and running this report again.
 */
import { findCar } from '../src/data/cars/index';
import { GOL_GTS_1988_FACTORY } from '../src/data/cars/vwGolGts1988';
import { TRACKS } from '../src/data/tracks/index';
import { runAccelerationTest } from '../src/game/race/accelerationTest';

const carId = process.argv[2] ?? 'vw-gol-gts-1988';
const trackId = process.argv[3] ?? 'test-track';
const car = findCar(carId);
const track = TRACKS.find((t) => t.id === trackId);
if (!car || !track) {
  console.error(`carro ou pista desconhecido: ${carId} / ${trackId}`);
  process.exit(1);
}

const t0 = performance.now();
const r = runAccelerationTest(car, track, { speedsKmh: [80, 100, 120], distancesM: [400, 1000], maxS: 150 });
const wall = performance.now() - t0;

const p = GOL_GTS_1988_FACTORY.performance;
const targets: [string, number | null, number | null][] =
  carId === 'vw-gol-gts-1988'
    ? [
        ['0–80 km/h (s)', r.speedTimes.get(80) ?? null, p.accel0to80S],
        ['0–100 km/h (s)', r.speedTimes.get(100) ?? null, p.accel0to100S],
        ['0–120 km/h (s)', r.speedTimes.get(120) ?? null, p.accel0to120S],
        ['0–400 m (s)', r.distanceTimes.get(400) ?? null, p.accel0to400mS],
        ['0–1000 m (s)', r.distanceTimes.get(1000) ?? null, p.accel0to1000mS],
        ['Velocidade máxima (km/h)', r.topSpeedKmh, p.topSpeedKmh],
        ['Rotação na vel. máxima (rpm)', r.topSpeedRpm, p.topSpeedRpm],
      ]
    : [
        ['0–80 km/h (s)', r.speedTimes.get(80) ?? null, null],
        ['0–100 km/h (s)', r.speedTimes.get(100) ?? null, null],
        ['0–120 km/h (s)', r.speedTimes.get(120) ?? null, null],
        ['0–400 m (s)', r.distanceTimes.get(400) ?? null, null],
        ['0–1000 m (s)', r.distanceTimes.get(1000) ?? null, null],
        ['Velocidade máxima (km/h)', r.topSpeedKmh, null],
      ];

console.log(`\n${car.name} — ${track.name} (${track.ambientTempC} °C, ${(track.ambientPressurePa / 1000).toFixed(1)} kPa)`);
console.log(`massa ${car.massKg} kg · Cd·A ${(car.dragCoefficient * car.frontalAreaM2).toFixed(3)} m² · raio ${car.tires.radiusM} m\n`);
console.log('Teste'.padEnd(30) + 'Simulado'.padStart(10) + 'Meta'.padStart(10) + 'Desvio'.padStart(10));
for (const [label, sim, target] of targets) {
  const s = sim === null ? '—' : sim.toFixed(label.includes('rpm') || label.includes('km/h)') && !label.startsWith('0') ? 0 : 2);
  const tg = target === null ? '' : String(target);
  const dev = sim !== null && target !== null ? `${(((sim - target) / target) * 100).toFixed(1)} %` : '';
  console.log(label.padEnd(30) + s.padStart(10) + tg.padStart(10) + dev.padStart(10));
}
console.log(`\nmarcha na vel. máxima: ${r.topSpeedGear}ª`);
console.log(`trocas: ${r.shifts.map((s) => `${s.from}→${s.from + 1} a ${s.rpm.toFixed(0)} rpm (${s.t.toFixed(2)} s)`).join(', ')}`);
console.log(`patinagem máx. ${(r.maxSlipRatio * 100).toFixed(1)} % · ${r.wheelspinS.toFixed(2)} s acima de 15 %`);
console.log(`carga no eixo motriz: ${(r.drivenLoadShare.atRest * 100).toFixed(1)} % parado, ${(r.drivenLoadShare.min * 100).toFixed(1)}–${(r.drivenLoadShare.max * 100).toFixed(1)} % na arrancada`);
console.log(`(${(wall / 1000).toFixed(2)} s de processamento)\n`);
