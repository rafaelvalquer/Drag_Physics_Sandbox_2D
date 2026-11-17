/**
 * Headless calibration of the blown-engine model (EngineOverrevFailure + EngineReliability) on
 * several engines, with the real physics and the game's AI driver.
 *
 *   npx tsx scripts/overrev-calibration.ts [--json]
 *
 * Cases:
 *  A  factory build, factory cut: 402 m race + 30 s on the limiter in neutral → never breaks
 *  B  programmable cut at the recommended speed − overshoot margin (Seguro) → never breaks
 *  C  cut half-way to the mechanical limit (Esportivo/Agressivo): 402 m race → survives, some strain
 *  D  cut at the mechanical limit (Crítico): 402 m race → exposure reported (may break)
 *  E  cut at the mechanical limit, held on the limiter in neutral → seconds to failure
 *  F  as E with more boost (turbo engines) → fails sooner
 *  G  recovery: 50 % of E's time on the limiter, then 10 s at idle → exposure falls
 *  H  as E with valve springs (and forged internals where they fit) → lasts longer / never breaks
 */
import { CAREER_CARS } from '../src/data/cars/campaign';
import { TRACKS } from '../src/data/tracks/index';
import { DragAI } from '../src/game/ai/DragAI';
import { resolveBuild, type ResolverVersion } from '../src/game/career/tuning/BuildResolver';
import { failureSpecFor, tuningCapabilities } from '../src/game/career/tuning/TuningCapabilities';
import { VehicleSimulation } from '../src/physics/vehicle/VehicleSimulation';
import type { CarConfig } from '../src/data/schema';
import type { BuildTune } from '../src/game/career/tuning/buildCommon';

const H = 1 / 120;
const track = TRACKS.find((t) => t.id === 'test-track')!;

interface Subject {
  carId: string;
  version: ResolverVersion;
  /** Parts that give the cut setting (programmable ECU) + what they need. */
  ecu: string[];
  /** Hardware that raises the safe speed (case H). */
  strong: string[];
}

export const SUBJECTS: Subject[] = [
  { carId: 'vw-gol-gts-1988', version: 1, ecu: ['ecu-street'], strong: ['valve-springs', 'forged-kit'] },
  { carId: 'fiat-uno-mille-1995', version: 1, ecu: ['ecu-street'], strong: ['valve-springs', 'forged-kit'] },
  { carId: 'gm-chevette-sl-1988', version: 1, ecu: ['ecu-street'], strong: ['valve-springs', 'forged-kit'] },
  { carId: 'honda-civic-si-2008', version: 2, ecu: ['ecu-stage1-na'], strong: ['valve-springs'] },
  { carId: 'vw-golf-gti-mk4-2003', version: 2, ecu: ['ecu-programmable'], strong: ['valve-springs', 'pistons-forged-modern'] },
  { carId: 'mitsubishi-evo-x-2012', version: 2, ecu: ['ecu-programmable'], strong: ['valve-springs', 'pistons-forged-modern'] },
  { carId: 'bmw-335i-f30-2013', version: 2, ecu: ['ecu-programmable'], strong: ['valve-springs', 'pistons-forged-modern'] },
];

function build(base: CarConfig, parts: string[], tune: BuildTune, version: ResolverVersion): CarConfig {
  const r = resolveBuild(base, parts, tune, version);
  if (!r.ok) throw new Error(`${base.id} [${parts.join(',')}] ${JSON.stringify(tune)}: ${r.errors.join('; ')}`);
  return r.car;
}

function newSim(car: CarConfig, base: CarConfig, parts: string[], version: ResolverVersion): VehicleSimulation {
  const sim = new VehicleSimulation(car, track);
  sim.enableEngineFailure(failureSpecFor(base, parts, version));
  return sim;
}

/** 402 m with the advanced AI. */
export function race(car: CarConfig, base: CarConfig, parts: string[], version: ResolverVersion): { broken: boolean; at: number | null; exposure: number; et: number | null } {
  const sim = newSim(car, base, parts, version);
  const ai = new DragAI(car, 'advanced', 7);
  let t0: number | null = null;
  for (let i = 0; i < 120 * 6; i++) {
    ai.update(H, sim, { timeSinceGreen: null, staged: true, finished: false });
    sim.controls.holdBrake = sim.gear === 0 || sim.controls.pedal < 0.02;
    sim.step(H);
  }
  sim.controls.holdBrake = false;
  const green = sim.simTime;
  let peak = 0;
  for (let i = 0; i < 120 * 40; i++) {
    ai.update(H, sim, { timeSinceGreen: sim.simTime - green, staged: true, finished: false });
    sim.controls.holdBrake = false;
    sim.step(H);
    if (t0 === null && sim.x > 0.29) t0 = sim.simTime;
    peak = Math.max(peak, sim.failure!.exposure);
    if (sim.x >= 402.336 || sim.engine.runState === 'BROKEN') break;
  }
  const f = sim.failure!;
  return { broken: f.broken, at: f.brokenAt === null ? null : f.brokenAt - green, exposure: peak, et: sim.x >= 402.336 && t0 !== null ? sim.simTime - t0 : null };
}

/** Neutral, full throttle on the limiter for `s` seconds (then `idleS` at idle). */
export function limiter(car: CarConfig, base: CarConfig, parts: string[], version: ResolverVersion, s: number, idleS = 0): { broken: boolean; at: number | null; exposure: number } {
  const sim = newSim(car, base, parts, version);
  for (let i = 0; i < 240; i++) sim.step(H);
  const t0 = sim.simTime;
  sim.controls.pedal = 1;
  for (let i = 0; i < s * 120 && !sim.failure!.broken; i++) sim.step(H);
  sim.controls.pedal = 0;
  for (let i = 0; i < idleS * 120 && !sim.failure!.broken; i++) sim.step(H);
  const f = sim.failure!;
  return { broken: f.broken, at: f.brokenAt === null ? null : f.brokenAt - t0, exposure: f.exposure };
}

export interface Row {
  car: string;
  hwCut: number;
  recommended: number;
  maxSafe: number;
  enduranceS: number;
  A: string;
  B: string;
  C: string;
  D: string;
  E: string;
  F: string;
  G: string;
  H: string;
}

const fmt = (r: { broken: boolean; at: number | null; exposure: number }): string => (r.broken ? `QUEBRA ${r.at!.toFixed(2)} s` : `ok (${Math.round(r.exposure * 100)} %)`);

export function calibrate(s: Subject): Row {
  const base = CAREER_CARS.find((c) => c.id === s.carId)!;
  const caps = tuningCapabilities(base, s.ecu, s.version);
  const lim = caps.limits!;
  const stock = build(base, [], {}, s.version);
  const A1 = race(stock, base, [], s.version);
  const A2 = limiter(stock, base, [], s.version, 30);
  const safeCut = Math.floor((lim.recommendedSafeRpm - 200) / 50) * 50;
  const B = race(build(base, s.ecu, { revLimitRpm: Math.max(caps.revLimit.min, safeCut) }, s.version), base, s.ecu, s.version);
  const midCut = Math.round((caps.revLimit.default + caps.revLimit.max) / 2 / 50) * 50;
  const C = race(build(base, s.ecu, { revLimitRpm: midCut }, s.version), base, s.ecu, s.version);
  const maxCar = build(base, s.ecu, { revLimitRpm: caps.revLimit.max }, s.version);
  const D = race(maxCar, base, s.ecu, s.version);
  const E = limiter(maxCar, base, s.ecu, s.version, 30);
  let F = '—';
  if (caps.boost.enabled) {
    // the highest boost the hardware accepts (clutch / gearbox / internals), stepping down from the ECU maximum
    const support = [...s.ecu, ...(base.transmission.kind === 'dual-clutch' ? ['dct-upgrade'] : base.transmission.kind === 'torque-converter-auto' ? ['at-upgrade'] : ['clutch-reinforced'])];
    for (let b = caps.boost.max; b >= caps.boost.default; b = Math.round((b - 0.05) * 100) / 100) {
      const r0 = resolveBuild(base, support, { revLimitRpm: caps.revLimit.max, boostBar: b }, s.version);
      if (!r0.ok) continue;
      const r = limiter(r0.car, base, support, s.version, 30);
      const ref = limiter(build(base, support, { revLimitRpm: caps.revLimit.max }, s.version), base, support, s.version, 30);
      F = `${fmt(r)} a ${b.toFixed(2).replace('.', ',')} bar (mesmo hardware na pressão padrão: ${fmt(ref)})`;
      break;
    }
  }
  const half = E.at !== null ? E.at * 0.5 : 5;
  const G1 = limiter(maxCar, base, s.ecu, s.version, half);
  const G2 = limiter(maxCar, base, s.ecu, s.version, half, 10);
  const strongParts = [...s.ecu, ...s.strong];
  const strongCar = build(base, strongParts, { revLimitRpm: caps.revLimit.max }, s.version);
  const Hr = limiter(strongCar, base, strongParts, s.version, 30);
  return {
    car: s.carId,
    hwCut: lim.hardwareRevLimitRpm,
    recommended: lim.recommendedSafeRpm,
    maxSafe: lim.maxSafeRpm,
    enduranceS: lim.enduranceS,
    A: `${fmt(A1)} / limitador 30 s ${fmt(A2)}`,
    B: `${fmt(B)} (corte ${Math.max(caps.revLimit.min, safeCut)})`,
    C: `${fmt(C)} (corte ${midCut})`,
    D: `${fmt(D)} (corte ${caps.revLimit.max})`,
    E: fmt(E),
    F,
    G: `${Math.round(G1.exposure * 100)} % → ${Math.round(G2.exposure * 100)} % após 10 s`,
    H: `${fmt(Hr)} (corte ${caps.revLimit.max})`,
  };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/overrev-calibration.ts');
if (isMain) {
  const rows = SUBJECTS.map(calibrate);
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else
    for (const r of rows) {
      console.log(`\n${r.car}: corte ${r.hwCut} · recomendado ${r.recommended} · limite ${r.maxSafe} · resistência ${r.enduranceS} s`);
      for (const k of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const) console.log(`  ${k}  ${r[k]}`);
    }
}
