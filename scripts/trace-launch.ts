import { CHAPTER2_CARS } from '../src/data/cars/chapter2/index';
import { TRACKS } from '../src/data/tracks/index';
import { VehicleSimulation } from '../src/physics/vehicle/VehicleSimulation';
import { DragAI } from '../src/game/ai/DragAI';
const H = 1 / 120;
const car = CHAPTER2_CARS.find((c) => c.id === process.argv[2])!;
const sim = new VehicleSimulation(car, TRACKS.find((t) => t.id === 'test-track')!);
const ai = new DragAI(car, (process.argv[3] as 'advanced') ?? 'advanced', 7);
let i = 0;
while (i++ < 120 * 4) { ai.update(H, sim, { timeSinceGreen: null, staged: true, finished: false }); sim.step(H); }
const g0 = sim.simTime;
for (let k = 0; k < 120 * Number(process.argv[4] ?? 6); k++) {
  ai.update(H, sim, { timeSinceGreen: sim.simTime - g0, staged: true, finished: false });
  sim.step(H);
  if (k % 6 === 0) {
    const t = sim.telemetry;
    console.log(`${(sim.simTime - g0).toFixed(2)} g${sim.gear}${sim.gearbox.engaged ? '' : 'n'} ${sim.gearboxMode ?? ''} ${t.shiftState.padEnd(13)} ${t.clutchMode.padEnd(8)} rpm ${sim.engine.rpm.toFixed(0).padStart(5)} ped ${sim.controls.pedal.toFixed(2)} v ${(sim.speed * 3.6).toFixed(1).padStart(5)} slip ${t.slipRatio.toFixed(2)} F ${t.tireForce.toFixed(0)}/${t.tireForceMax.toFixed(0)} Ff ${(t.frontTireForce ?? 0).toFixed(0)} boost ${(sim.engine.turbo?.boostPa ?? 0 / 1e5).toFixed(0)} sr ${(t.converterSpeedRatio ?? 1).toFixed(2)} Tc ${t.clutchTorque.toFixed(0)}`);
  }
}
