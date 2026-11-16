/**
 * Volkswagen Gol GTS 1988 — AP 1.8S original: acceptance tests of the brief
 * "IMPLEMENTAÇÃO — GOL GTS 1988 AP 1.8S ORIGINAL". Factory data: owner's manual, pp. 47–51.
 * Everything is measured on the same physics, dyno, AI and synthesizer the other cars use.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { radSToRpm } from '../../../src/core/units';
import { CARS, LAB_CARS, findCar } from '../../../src/data/cars/index';
import {
  CAR_VW_GOL_GTS_1988,
  GOL_GTS_1988_FACTORY,
  GOL_GTS_1988_MASS,
  GOL_GTS_1988_PROVENANCE,
  GOL_GTS_1988_SECONDARY,
} from '../../../src/data/cars/vwGolGts1988';
import { ENGINES } from '../../../src/data/engines/index';
import { validateCar } from '../../../src/data/schema';
import { TRACKS } from '../../../src/data/tracks/index';
import { CH, carToAcousticConfig } from '../../../src/audio/dsp/AcousticConfig';
import { autocorrelationPitch, rms } from '../../../src/audio/analysis/spectrum';
import { optimalShiftRpms } from '../../../src/game/ai/DragAI';
import { runAccelerationTest, type AccelerationResult } from '../../../src/game/race/accelerationTest';
import { DESIGNS } from '../../../src/game/vehicles/art/designs';
import { buildVehicleLayers } from '../../../src/game/vehicles/VehicleSpriteAssembler';
import { EngineDyno } from '../../../src/physics/engine/EngineDyno';
import { engineGeometry } from '../../../src/physics/engine/EngineGeometry';
import { VehicleSimulation } from '../../../src/physics/vehicle/VehicleSimulation';
import { renderSynthetic } from '../audio/helpers';

const H = 1 / 120;
const ID = 'vw-gol-gts-1988';
const gol = (): typeof CAR_VW_GOL_GTS_1988 => findCar(ID)!;
const testTrack = TRACKS.find((t) => t.id === 'test-track')!;
const rel = (sim: number, target: number): number => Math.abs(sim - target) / target;

function run(sim: VehicleSimulation, seconds: number, each?: (s: VehicleSimulation) => void): void {
  for (let i = 0, n = Math.round(seconds / H); i < n; i++) {
    sim.step(H);
    each?.(sim);
  }
}

function readyInFirst(): VehicleSimulation {
  const sim = new VehicleSimulation(gol(), testTrack);
  run(sim, 4);
  expect(sim.engine.runState).toBe('RUNNING');
  expect(sim.requestShift(1)).toBe('started');
  run(sim, 0.3);
  expect(sim.gear).toBe(1);
  return sim;
}

describe('Gol GTS 1988 — registration and data', () => {
  it('1. is available in the garage, sandbox, race and dyno car lists', () => {
    const car = gol();
    expect(car).toBeDefined();
    expect(car.name).toBe('Volkswagen Gol GTS 1988 — AP 1.8S Original');
    expect(CARS.map((c) => c.id)).toContain(ID);
    expect(LAB_CARS.map((c) => c.id)).toContain(ID);
    expect(car.engine.id).toBe('vw-ap-18s-1988-ethanol');
    expect(ENGINES.map((e) => e.id)).toContain('vw-ap-18s-1988-ethanol');
    const r = validateCar(car);
    expect(r.errors).toEqual([]);
  });

  it('2. dimensions and mass come from the manual; operating mass keeps tare, driver and fuel apart', () => {
    const car = gol();
    const d = GOL_GTS_1988_FACTORY.dimensions;
    expect(car.wheelbaseM).toBe(2.358);
    expect(car.visual.lengthM).toBe(3.849);
    expect(car.visual.heightM).toBe(1.35);
    expect([d.widthMm, d.trackFrontMm, d.trackRearMm]).toEqual([1601, 1364, 1384]);
    expect(GOL_GTS_1988_MASS.tareKg).toBe(930);
    expect(car.massKg).toBe(GOL_GTS_1988_MASS.tareKg + GOL_GTS_1988_MASS.driverKg + GOL_GTS_1988_MASS.fuelKg);
    expect(car.massKg).toBeLessThan(GOL_GTS_1988_FACTORY.weights.grossKg);
    expect(GOL_GTS_1988_FACTORY.wheels.rim).toContain('6J × 14H2');
  });

  it('3. the original sprite: own square-Gol body, 14" teardrop wheels, rear drums, GTS badge', () => {
    const car = gol();
    expect(car.visual.bodyStyle).toBe('golGts88');
    const d = DESIGNS.golGts88;
    expect(d.wheel.style).toBe('teardrop');
    expect(d.wheel.lugs).toBe(4);
    expect(d.wheel.rearBrake).toBe('drum');
    expect(d.badges?.map((b) => b.text)).toContain('GTS');
    expect(d.lowerTrim).toBeDefined();
    expect(d.spoiler).toBe('hatchLip');
    // the 14" rim fills the same share of the tyre as on the real 185/60 R14 (356 / 578 mm)
    expect(d.wheel.rim).toBeCloseTo(0.615, 1);
    const { meta, layers } = buildVehicleLayers(car, 100);
    expect(meta.noseX - meta.rearX).toBeCloseTo(3.849, 6);
    expect(meta.wheelCentres.rear.x).toBeCloseTo(-2.358, 9);
    // front hub (ventilated disc) and rear hub (drum) are different drawings
    const hub = layers.find((l) => l.name === 'hub')!;
    const hubRear = layers.find((l) => l.name === 'hubRear')!;
    expect(hubRear.svg).not.toBe(hub.svg);
    // no manufacturer logo is drawn: only the model badge text
    expect(layers.find((l) => l.name === 'body')!.svg).toContain('>GTS<');
  });
});

describe('Gol GTS 1988 — AP 1.8S on the dyno', () => {
  const e = CAR_VW_GOL_GTS_1988.engine;

  it('4. original AP 1.8S: 1781 cm³, 81.0 × 86.4 mm, 12.3:1, naturally aspirated, no turbo', () => {
    expect(engineGeometry(e).displacement * 1e6).toBeCloseTo(1781, 0);
    expect([e.boreMm, e.strokeMm, e.compressionRatio]).toEqual([81.0, 86.4, 12.3]);
    expect(e.cylinders).toBe(4);
    expect(e.architecture).toBe('I4');
    expect(e.induction).toBe('NA');
    expect(e.turbo).toBeUndefined();
  });

  it('5. measured 146 N·m at 3200 rpm and 99 cv at 5600 rpm (NBR 5484), peaks where the manual says', () => {
    const d = new EngineDyno(e);
    expect(d.start()).toBe(true);
    const t3200 = d.measure(3200, 1, H, 2, 0.4);
    expect(rel(t3200.torqueNm, 146)).toBeLessThan(0.01);
    const p5600 = d.measure(5600, 1, H, 2, 0.4);
    expect(rel(p5600.powerCv, 99)).toBeLessThan(0.01);
    let tMax = { rpm: 0, v: 0 };
    let pMax = { rpm: 0, v: 0 };
    for (let rpm = 2000; rpm <= 6400; rpm += 100) {
      const p = d.measure(rpm, 1, H, 0.8, 0.2);
      if (p.torqueNm > tMax.v) tMax = { rpm, v: p.torqueNm };
      if (p.powerCv > pMax.v) pMax = { rpm, v: p.powerCv };
    }
    expect(Math.abs(tMax.rpm - 3200)).toBeLessThanOrEqual(200);
    expect(Math.abs(pMax.rpm - 5600)).toBeLessThanOrEqual(200);
    expect(rel(pMax.v, 99)).toBeLessThan(0.015);
    expect(rel(tMax.v, 146)).toBeLessThan(0.015);
  });

  it('6. throttle controls torque and engine speed', () => {
    const d = new EngineDyno(e);
    d.start();
    const wot = d.measure(3200, 1);
    const part = d.measure(3200, 0.2);
    expect(part.torqueNm).toBeLessThan(wot.torqueNm * 0.7);
    // free revving in neutral in the car: more pedal, more rpm; the simulation limit holds it
    const sim = new VehicleSimulation(gol(), testTrack);
    run(sim, 4);
    expect(Math.abs(sim.engine.rpm - e.idleRpm)).toBeLessThan(60);
    sim.controls.pedal = 0.25;
    run(sim, 1.5);
    const rpmPart = sim.engine.rpm;
    expect(rpmPart).toBeGreaterThan(e.idleRpm + 1000);
    sim.controls.pedal = 1;
    let maxRpm = 0;
    run(sim, 2, (s) => (maxRpm = Math.max(maxRpm, s.engine.rpm)));
    expect(maxRpm).toBeGreaterThan(rpmPart);
    expect(maxRpm).toBeLessThan(e.revLimitRpm + 150);
    sim.controls.pedal = 0;
    run(sim, 4);
    expect(Math.abs(sim.engine.rpm - e.idleRpm)).toBeLessThan(80);
  });

  it('7. dyno and race use the same engine model and the same curve', () => {
    const dyno = new EngineDyno(e);
    const sim = new VehicleSimulation(gol(), testTrack);
    for (const rpm of [1500, 2500, 3200, 4400, 5600, 6200]) {
      expect(sim.engine.torqueCurve.evaluate(rpm)).toBe(dyno.engine.torqueCurve.evaluate(rpm));
    }
    dyno.start();
    expect(rel(dyno.measure(4400, 1).torqueNm, 141.2)).toBeLessThan(0.01);
  });
});

describe('Gol GTS 1988 — gearbox and front-wheel drive', () => {
  it('8. five forward gears with the factory ratios and a 4.11 final drive', () => {
    const t = gol().transmission;
    expect(t.gearRatios).toEqual([3.45, 1.94, 1.29, 0.97, 0.8]);
    expect(t.finalDrive).toBe(4.11);
    // reverse is documented (the game has no reverse gear in a drag run)
    expect(GOL_GTS_1988_FACTORY.transmission.reverse).toBe(3.17);
    const sim = new VehicleSimulation(gol(), testTrack);
    expect(sim.gearbox.gearCount).toBe(5);
    expect(sim.gearbox.overallRatio(5)).toBeCloseTo(0.8 * 4.11, 9);
  });

  it('9. up- and downshifts with W / E / Q only — there is no clutch control', () => {
    const sim = readyInFirst();
    expect(Object.keys(sim.controls)).not.toContain('clutch');
    sim.controls.pedal = 1;
    let guard = 0;
    while (sim.gear < 3 && guard++ < 120 * 20) {
      sim.step(H);
      if (!sim.shift.active && sim.clutchCtl.mode === 'LOCKED' && sim.engine.rpm > 6000) sim.requestShift(1);
    }
    expect(sim.gear).toBe(3);
    run(sim, 0.6);
    sim.controls.pedal = 0;
    run(sim, 0.3);
    // downshift 3 → 2 at a speed where 2nd stays below the limit
    expect(sim.requestShift(-1)).toBe('started');
    run(sim, 1);
    expect(sim.gear).toBe(2);
    expect(sim.engine.runState).toBe('RUNNING');
    expect(sim.engine.stallCount).toBe(0);
  });

  it('10. front-wheel drive: the front axle is driven and loses load when the car accelerates', () => {
    const car = gol();
    expect(car.drivenAxle).toBe('front');
    const sim = readyInFirst();
    const atRest = sim.telemetry.normalLoadDriven / (sim.telemetry.normalLoadDriven + sim.telemetry.normalLoadFree);
    expect(atRest).toBeCloseTo(car.frontWeightFraction, 2);
    sim.controls.pedal = 1;
    let minShare = 1;
    let spin = 0;
    let wheelVsEngine = 0;
    run(sim, 2.5, (s) => {
      const t = s.telemetry;
      minShare = Math.min(minShare, t.normalLoadDriven / (t.normalLoadDriven + t.normalLoadFree));
      // the driven (front) wheels can spin; the free (rear) ones roll with the body
      spin = Math.max(spin, t.wheelOmegaDriven - t.wheelOmegaFree);
      // the wheels follow their own physical speed, not the engine speed
      if (s.clutchCtl.mode === 'LAUNCH') {
        const engineAtWheel = s.engine.omega / s.gearbox.overallRatio(s.gear);
        wheelVsEngine = Math.max(wheelVsEngine, Math.abs(engineAtWheel - t.wheelOmegaDriven));
      }
    });
    expect(minShare).toBeLessThan(atRest - 0.03);
    expect(spin).toBeGreaterThan(0.5);
    expect(radSToRpm(wheelVsEngine)).toBeGreaterThan(50);
    // the sprite angles are integrated from those wheel speeds
    const a0 = sim.wheelAngleDriven;
    sim.step(H);
    expect(sim.wheelAngleDriven - a0).toBeCloseTo(sim.driveline.v * H, 9);
  });
});

describe('Gol GTS 1988 — sound (procedural, stock exhaust)', () => {
  it('11. four cylinders firing 1-3-4-2 every 180°: firing frequency = rpm × 4 / 120', () => {
    const e = CAR_VW_GOL_GTS_1988.engine;
    expect(e.firingOrder).toEqual([1, 3, 4, 2]);
    e.firingOrder.forEach((cyl, k) => expect(e.firingAnglesDeg[cyl - 1]).toBe(180 * k));
    const rpm = 3000;
    const fFire = (rpm * 4) / 120;
    const fs = 48000;
    const { ch, voice } = renderSynthetic(carToAcousticConfig(CAR_VW_GOL_GTS_1988), fs, 1.6, () => ({ rpm, load: 1 }));
    expect(voice.nanResets).toBe(0);
    const ac = autocorrelationPitch(ch[CH.exhaust]!, fs, 20, fFire * 1.5, Math.round(0.4 * fs));
    // fundamental of the exhaust pulse train = firing frequency (100 Hz), not half of it
    expect(rel(ac.hz, fFire)).toBeLessThan(0.015);
  });

  it('12. no turbo, no blow-off: the turbo channel is silent at full load', () => {
    const cfg = carToAcousticConfig(CAR_VW_GOL_GTS_1988);
    expect(CAR_VW_GOL_GTS_1988.acoustic.turboGain).toBe(0);
    const { ch } = renderSynthetic(cfg, 48000, 1.2, (t) => ({ rpm: 2500 + 3000 * t, load: t < 0.9 ? 1 : 0 }));
    expect(rms(ch[CH.turbo]!)).toBe(0);
    expect(rms(ch[CH.exhaust]!)).toBeGreaterThan(0);
  });
});

describe('Gol GTS 1988 — factory performance (owner’s manual, p. 51)', () => {
  let r: AccelerationResult;
  beforeAll(() => {
    r = runAccelerationTest(gol(), testTrack, { speedsKmh: [80, 100, 120], distancesM: [400, 1000], maxS: 150 });
  }, 120000);

  it('13. completes 400 m and 1000 m and reaches 80/100/120 km/h within 5 % of the manual', () => {
    const p = GOL_GTS_1988_FACTORY.performance;
    const checks: [number | null | undefined, number][] = [
      [r.speedTimes.get(80), p.accel0to80S],
      [r.speedTimes.get(100), p.accel0to100S],
      [r.speedTimes.get(120), p.accel0to120S],
      [r.distanceTimes.get(400), p.accel0to400mS],
      [r.distanceTimes.get(1000), p.accel0to1000mS],
    ];
    for (const [sim, target] of checks) {
      expect(sim).not.toBeNull();
      expect(rel(sim!, target)).toBeLessThan(0.05);
    }
  });

  it('14. top speed 180 km/h in 5th near 5588 rpm (within 5 %), shifting on the AP curve', () => {
    expect(rel(r.topSpeedKmh, 180)).toBeLessThan(0.05);
    expect(r.topSpeedGear).toBe(5);
    expect(rel(r.topSpeedRpm, GOL_GTS_1988_FACTORY.performance.topSpeedRpm)).toBeLessThan(0.05);
    expect(r.shifts.map((s) => s.from)).toEqual([1, 2, 3, 4]);
    const planned = optimalShiftRpms(gol());
    for (const s of r.shifts) {
      expect(s.rpm).toBeGreaterThan(5500);
      expect(s.rpm).toBeLessThan(CAR_VW_GOL_GTS_1988.engine.revLimitRpm + 50);
      expect(Math.abs(s.rpm - planned[s.from - 1]!)).toBeLessThan(400);
    }
  });
});

describe('Gol GTS 1988 — provenance', () => {
  it('15. values tagged "factory" equal the manual; secondary, derived and calibrated values are never "factory"', () => {
    const car = gol();
    const f = GOL_GTS_1988_FACTORY;
    const P = GOL_GTS_1988_PROVENANCE;
    // every "factory" tag is checked against the manual data
    const factoryChecks: Record<string, () => void> = {
      wheelbaseM: () => expect(car.wheelbaseM * 1000).toBe(f.dimensions.wheelbaseMm),
      drivenAxle: () => expect(car.drivenAxle).toBe('front'),
      'engine.architecture': () => expect(car.engine.architecture).toBe('I4'),
      'engine.firingOrder': () => expect(car.engine.firingOrder).toEqual([...f.engine.firingOrder]),
      'engine.boreMm': () => expect(car.engine.boreMm).toBe(f.engine.boreMm),
      'engine.strokeMm': () => expect(car.engine.strokeMm).toBe(f.engine.strokeMm),
      'engine.compressionRatio': () => expect(car.engine.compressionRatio).toBe(f.engine.compressionRatio),
      'engine.torqueCurve@3200': () => {
        const i = car.engine.torqueCurve.rpm.indexOf(f.engine.torqueNbr5484.rpm);
        expect(car.engine.torqueCurve.torqueNm[i]).toBe(f.engine.torqueNbr5484.nm);
      },
      'engine.torqueCurve@5600': () => {
        const i = car.engine.torqueCurve.rpm.indexOf(f.engine.powerNbr5484.rpm);
        const cv = (car.engine.torqueCurve.torqueNm[i]! * ((5600 * 2 * Math.PI) / 60)) / 735.49875;
        expect(cv).toBeCloseTo(f.engine.powerNbr5484.cv, 1);
      },
      'engine.ratedPowerCv': () => expect(car.engine.ratedPowerCv).toBe(f.engine.powerNbr5484.cv),
      'engine.induction': () => expect(car.engine.induction).toBe('NA'),
      'transmission.gearRatios': () => expect(car.transmission.gearRatios).toEqual([...f.transmission.gearRatios]),
      'transmission.finalDrive': () => expect(car.transmission.finalDrive).toBe(f.transmission.finalDrive),
      'visual.lengthM': () => expect(car.visual.lengthM * 1000).toBe(f.dimensions.lengthMm),
      'visual.heightM': () => expect(car.visual.heightM * 1000).toBe(f.dimensions.heightMm),
    };
    const tagged = Object.entries(P).filter(([, p]) => p === 'factory').map(([k]) => k);
    expect(tagged.sort()).toEqual(Object.keys(factoryChecks).sort());
    for (const k of tagged) factoryChecks[k]!();
    // not in the manual → never "factory"
    for (const k of ['engine.revLimitRpm', 'engine.redlineRpm', 'engine.idleRpm', 'dragCoefficient', 'frontalAreaM2', 'tires.radiusM', 'massKg', 'engine.torqueCurve(other points)', 'exhaust', 'acoustic']) {
      expect(P[k]).toBeDefined();
      expect(P[k]).not.toBe('factory');
    }
    expect(P.dragCoefficient).toBe('secondary');
    expect(car.dragCoefficient).toBe(GOL_GTS_1988_SECONDARY.dragCoefficient);
    // the rolling radius is derived from the factory top speed in 5th gear
    const r = f.performance.topSpeedKmh / 3.6 / ((f.performance.topSpeedRpm / (0.8 * 4.11)) * ((2 * Math.PI) / 60));
    expect(car.tires.radiusM).toBeCloseTo(r, 3);
  });
});
