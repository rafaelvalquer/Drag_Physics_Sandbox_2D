/**
 * Headless calibration of the blown-engine model (EngineOverrevFailure + EngineReliability) on
 * every campaign car whose cut can be set, with the real physics (real limiter, real gearbox).
 *
 *   npx tsx scripts/overrev-calibration.ts [--json] [--car <id>]
 *
 * Scenarios (held = neutral, full throttle, on the limiter):
 *  1  factory build, factory cut held 30 s                       → never breaks
 *  2  "Esportivo" cut held                                       → slow exposure (time reported)
 *  3  "Agressivo" cut held                                       → 4–6 s target
 *  4  "Crítico" cut (mechanical limit) held                      → 2–4 s target; the real limiter
 *     cycles the ignition: the exposure must never fall while held (limiter cycling check)
 *  5  402 m, critical cut, shifting at the right time (AI)       → no failure
 *  6  402 m, critical cut, every shift 1.5 s late on the limiter → may break before the line
 *  7  recovery: held for half of (4)'s time, then 10 s at idle   → exposure steady, then falls
 *  8  reinforced (valve springs + forged where they fit), the critical cut of (4) held → lasts longer
 *  9  restart: break, reset, the engine runs and breaks again at the same time
 */
import { CAREER_CARS } from '../src/data/cars/campaign';
import { TRACKS } from '../src/data/tracks/index';
import { DragAI } from '../src/game/ai/DragAI';
import { resolveBuild, type ResolverVersion } from '../src/game/career/tuning/BuildResolver';
import { reliabilityLevel } from '../src/game/career/tuning/EngineReliability';
import { failureSpecFor, tuningCapabilities, type TuningCapabilities } from '../src/game/career/tuning/TuningCapabilities';
import { LIMITER_SAG_RPM, X_MAX } from '../src/physics/engine/EngineOverrevFailure';
import { VehicleSimulation } from '../src/physics/vehicle/VehicleSimulation';
import type { CarConfig } from '../src/data/schema';
import type { BuildTune } from '../src/game/career/tuning/buildCommon';

const H = 1 / 120;
const track = TRACKS.find((t) => t.id === 'test-track')!;
const QUARTER = 402.336;
const ECUS = ['ecu-programmable', 'ecu-stage1-na', 'ecu-street', 'ecu-race'];
const STRONG = ['valve-springs', 'forged-kit', 'pistons-forged-modern', 'pistons-forged', 'rods-reinforced'];

export interface Subject {
  base: CarConfig;
  version: ResolverVersion;
  ecu: string[];
  strong: string[];
  caps: TuningCapabilities;
}

const versionOf = (c: CarConfig): ResolverVersion => (c.engine.family ? 2 : 1);

/** Every campaign car with a part that opens the cut setting (and the hardware that reinforces it). */
export function subjects(only?: string): Subject[] {
  const out: Subject[] = [];
  for (const base of CAREER_CARS) {
    if (only && base.id !== only) continue;
    const v = versionOf(base);
    for (const ecu of ECUS) {
      const caps = tuningCapabilities(base, [ecu], v, { tunersUnlocked: true });
      if (!caps.revLimit.enabled || !caps.limits) continue;
      const strong: string[] = [];
      for (const p of STRONG) if (resolveBuild(base, [ecu, ...strong, p], {}, v).ok) strong.push(p);
      out.push({ base, version: v, ecu: [ecu], strong, caps });
      break;
    }
  }
  return out;
}

function build(s: Subject, parts: string[], tune: BuildTune): CarConfig {
  const r = resolveBuild(s.base, parts, tune, s.version);
  if (!r.ok) throw new Error(`${s.base.id} [${parts.join(',')}] ${JSON.stringify(tune)}: ${r.errors.join('; ')}`);
  return r.car;
}

function newSim(car: CarConfig, s: Subject, parts: string[]): VehicleSimulation {
  const sim = new VehicleSimulation(car, track);
  sim.enableEngineFailure(failureSpecFor(s.base, parts, s.version));
  sim.controls.autoStart = true;
  return sim;
}

export interface Hold {
  broken: boolean;
  /** Seconds held to the failure (null = survived). */
  at: number | null;
  meanRpm: number;
  maxRpm: number;
  exposure: number;
  /** Steps where the exposure fell while held (limiter cycling check: must be 0). */
  falls: number;
}

/** Neutral, full throttle for `s` seconds (then `idleS` at idle). */
export function hold(sim: VehicleSimulation, s: number, idleS = 0): Hold {
  for (let i = 0; i < 240; i++) sim.step(H);
  const t0 = sim.simTime;
  sim.controls.pedal = 1;
  let sum = 0;
  let n = 0;
  let mx = 0;
  let falls = 0;
  let prev = 0;
  let peak = 0;
  for (let i = 0; i < s * 120 && !sim.failure!.broken; i++) {
    sim.step(H);
    const f = sim.failure!;
    if (i > 120) {
      sum += sim.engine.rpm;
      n++;
      mx = Math.max(mx, sim.engine.rpm);
      if (f.exposure < prev - 1e-12) falls++;
    }
    prev = f.exposure;
    peak = Math.max(peak, f.exposure);
  }
  sim.controls.pedal = 0;
  for (let i = 0; i < idleS * 120 && !sim.failure!.broken; i++) sim.step(H);
  const f = sim.failure!;
  return { broken: f.broken, at: f.brokenAt === null ? null : f.brokenAt - t0, meanRpm: n ? sum / n : 0, maxRpm: mx, exposure: idleS > 0 ? f.exposure : peak, falls };
}

export interface Run {
  broken: boolean;
  at: number | null;
  et: number | null;
  exposure: number;
  maxRpm: number;
}

/** 402 m. `lateS` null: the advanced AI; a number: full throttle, every upshift that late on the limiter. */
export function run402(car: CarConfig, s: Subject, parts: string[], lateS: number | null): Run {
  const sim = newSim(car, s, parts);
  const ai = lateS === null ? new DragAI(car, 'advanced', 7) : null;
  for (let i = 0; i < 120 * 4; i++) {
    if (ai) ai.update(H, sim, { timeSinceGreen: null, staged: true, finished: false });
    else if (sim.engine.runState === 'RUNNING' && sim.gear === 0) sim.requestShift(1);
    sim.controls.holdBrake = true;
    if (!ai) sim.controls.pedal = 0;
    sim.step(H);
  }
  sim.controls.holdBrake = false;
  const green = sim.simTime;
  let t0: number | null = null;
  let onCut = 0;
  let peak = 0;
  const cut = car.engine.revLimitRpm;
  for (let i = 0; i < 120 * 40; i++) {
    if (ai) ai.update(H, sim, { timeSinceGreen: sim.simTime - green, staged: true, finished: false });
    else {
      sim.controls.pedal = 1;
      if (sim.engine.rpm > cut - 150 && sim.clutchCtl.mode === 'LOCKED') onCut += H;
      if (onCut >= lateS! && sim.gear < sim.gearbox.gearCount && !sim.shift.active) {
        sim.requestShift(1);
        onCut = 0;
      }
    }
    sim.controls.holdBrake = false;
    sim.step(H);
    if (t0 === null && sim.x > 0.29) t0 = sim.simTime;
    peak = Math.max(peak, sim.failure!.exposure);
    if (sim.x >= QUARTER || sim.engine.runState === 'BROKEN') break;
  }
  const f = sim.failure!;
  return { broken: f.broken, at: f.brokenAt === null ? null : f.brokenAt - green, et: sim.x >= QUARTER && t0 !== null ? sim.simTime - t0 : null, exposure: peak, maxRpm: sim.maxRpm };
}

export interface Row {
  car: string;
  family: string;
  parts: string;
  hwCut: number;
  recommended: number;
  maxSafe: number;
  enduranceS: number;
  cuts: { sport: number; aggressive: number; critical: number };
  s1: Hold;
  s2: Hold;
  s3: Hold;
  s4: Hold;
  s5: Run;
  s6: Run;
  s7: { before: number; after: number };
  s8: Hold;
  s9: { exposureAfterReset: number; runs: boolean; again: number | null };
  extremeS: number;
}

/** Cut whose band position is `x` (0 = recommended, 1 = mechanical limit), on the 50 rpm grid. */
function cutAt(c: TuningCapabilities, x: number): number {
  const l = c.limits!;
  const lo = l.recommendedSafeRpm + LIMITER_SAG_RPM;
  const raw = lo + x * (c.revLimit.max - lo);
  return Math.min(c.revLimit.max, Math.max(c.revLimit.min, Math.round(raw / 50) * 50));
}

export function calibrate(s: Subject): Row {
  const l = s.caps.limits!;
  const stock = build(s, [], {});
  const s1 = hold(newSim(stock, { ...s }, []), 30);
  const sportCut = cutAt(s.caps, 0.3);
  const aggrCut = cutAt(s.caps, 0.65);
  const critCut = s.caps.revLimit.max;
  const car = (cut: number): CarConfig => build(s, s.ecu, { revLimitRpm: cut });
  const s2 = hold(newSim(car(sportCut), s, s.ecu), 40);
  const s3 = hold(newSim(car(aggrCut), s, s.ecu), 30);
  const s4 = hold(newSim(car(critCut), s, s.ecu), 30);
  const s5 = run402(car(critCut), s, s.ecu, null);
  const s6 = run402(car(critCut), s, s.ecu, 1.5);
  const half = s4.at !== null ? s4.at * 0.5 : 3;
  const a = hold(newSim(car(critCut), s, s.ecu), half);
  const b = hold(newSim(car(critCut), s, s.ecu), half, 10);
  const strongParts = [...s.ecu, ...s.strong];
  const s8 = hold(newSim(build(s, strongParts, { revLimitRpm: critCut }), s, strongParts), 30);
  // restart
  const sim = newSim(car(critCut), s, s.ecu);
  const first = hold(sim, 30);
  sim.reset();
  sim.controls.autoStart = true;
  const after = sim.failure!.exposure;
  const again = hold(sim, 30);
  void first;
  return {
    car: s.base.id,
    family: l.label,
    parts: s.ecu.join('+'),
    hwCut: l.hardwareRevLimitRpm,
    recommended: l.recommendedSafeRpm,
    maxSafe: l.maxSafeRpm,
    enduranceS: l.enduranceS,
    cuts: { sport: sportCut, aggressive: aggrCut, critical: critCut },
    s1,
    s2,
    s3,
    s4,
    s5,
    s6,
    s7: { before: a.exposure, after: b.exposure },
    s8,
    s9: { exposureAfterReset: after, runs: again.meanRpm > 1000, again: again.at },
    extremeS: l.enduranceS / (X_MAX * Math.sqrt(X_MAX)),
  };
}

const sec = (v: number | null): string => (v === null ? '—' : v.toFixed(2).replace('.', ','));
const pct = (v: number): string => `${Math.round(v * 100)} %`;
const holdTxt = (h: Hold): string => (h.broken ? `quebra ${sec(h.at)} s` : `ok (${pct(h.exposure)})`);
const runTxt = (r: Run): string => (r.broken ? `quebra ${sec(r.at)} s após o verde` : r.et === null ? `não chegou (${pct(r.exposure)})` : `ok ET ${sec(r.et)} s (${pct(r.exposure)})`);

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/overrev-calibration.ts');
if (isMain) {
  const i = process.argv.indexOf('--car');
  const rows = subjects(i > 0 ? process.argv[i + 1] : undefined).map(calibrate);
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    console.log('| Carro | Motor | Peças | Corte fáb. | Recomendado | Limite | 1 fábrica 30 s | 2 Esportivo | 3 Agressivo | 4 Crítico (rpm médio/máx) | quedas | 5 402 m certo | 6 402 m atrasado | 7 recuperação | 8 reforçado | 9 reinício | extremo |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of rows)
      console.log(
        `| ${r.car} | ${r.family} | ${r.parts} | ${r.hwCut} | ${r.recommended} | ${r.maxSafe} | ${holdTxt(r.s1)} | ${r.cuts.sport}: ${holdTxt(r.s2)} | ${r.cuts.aggressive}: ${holdTxt(r.s3)} | ${r.cuts.critical}: ${holdTxt(r.s4)} (${Math.round(r.s4.meanRpm)}/${Math.round(r.s4.maxRpm)}) | ${r.s4.falls} | ${runTxt(r.s5)} | ${runTxt(r.s6)} | ${pct(r.s7.before)} → ${pct(r.s7.after)} | ${holdTxt(r.s8)} | ${r.s9.exposureAfterReset === 0 && r.s9.runs ? `ok, quebra de novo ${sec(r.s9.again)} s` : 'FALHOU'} | ${sec(r.extremeS)} s |`,
      );
    void reliabilityLevel;
  }
}
