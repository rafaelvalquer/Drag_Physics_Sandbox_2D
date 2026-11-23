import { Prng } from '../../core/prng';
import type { VehicleSimulation } from '../../physics/vehicle/VehicleSimulation';
import type { DragAI } from '../ai/DragAI';
import type { TreeLights } from '../scenes/RaceScene';

export const FT = 0.3048;
/** Distance the front tyre travels before it un-blocks the stage beam (≈ 11.5 in). */
export const ROLLOUT_M = 0.29;
/** Trap speed is the average over the last 66 ft before a timing point. */
export const TRAP_M = 66 * FT;

/** Rest tolerance for being "ready" at the line (m/s). */
export const READY_SPEED_MS = 0.05;
export const READY_MESSAGE = 'Pronto para largar — acelere em neutro ou engate a primeira.';

export type RaceDistanceId = 'eighth' | 'quarter' | 'km';
export const RACE_DISTANCES: Record<RaceDistanceId, { label: string; m: number }> = {
  eighth: { label: '1/8 milha (201 m)', m: 660 * FT },
  quarter: { label: '1/4 milha (402 m)', m: 1320 * FT },
  km: { label: '1 km', m: 1000 },
};

export interface SplitDef {
  id: string;
  label: string;
  m: number;
  trap: boolean;
}

export const SPLITS: SplitDef[] = [
  { id: '60ft', label: '60 ft', m: 60 * FT, trap: false },
  { id: '330ft', label: '330 ft', m: 330 * FT, trap: false },
  { id: 'eighth', label: '1/8 milha', m: 660 * FT, trap: true },
  { id: '1000ft', label: '1000 ft', m: 1000 * FT, trap: false },
  { id: 'quarter', label: '1/4 milha', m: 1320 * FT, trap: true },
  { id: 'km', label: '1 km', m: 1000, trap: true },
];

export type TreeType = 'pro' | 'sportsman';
/** A blown engine coasts this long (s) before the safety braking, when the car is moving. */
export const BLOWN_COAST_S = 1.25;
export type DnfReason = 'timeout' | 'engine-blown';
/**
 * Time after the green light (s) at which a lane that has not finished is out of the race. The
 * 201 m and 402 m values are unchanged; the 1 km takes about 70 s, so even the slowest car that can
 * enter an Elite duel (a long-gearing 1000 m run takes well under 60 s) is never cut by the clock
 * while it is still accelerating. Timing the attempt out is the only use of this value.
 */
export const DNF_TIMEOUT_S: Record<RaceDistanceId, number> = { eighth: 45, quarter: 45, km: 70 };
export type RacePhase = 'staging' | 'tree' | 'racing' | 'finished';

export interface LaneResult {
  /** Reaction time (s): leaving the stage beam minus green. Negative = red light. */
  rt: number | null;
  redLight: boolean;
  /** Elapsed times from leaving the beam, per split id (s). */
  splits: Record<string, number>;
  /** Trap speeds (m/s) at the trap splits. */
  traps: Record<string, number>;
  et: number | null;
  trapMs: number | null;
  finished: boolean;
  dnf: boolean;
  /** Why the lane did not finish: timeout (45 s after the green; 70 s at 1 km) or a blown engine. */
  dnfReason?: DnfReason;
  /** Engine speed at the failure (rpm), from the failure model (blown engine only). */
  blownAtRpm?: number;
  maxSpeedMs: number;
  /** Total time = RT + ET = finish − green (s); null until the finish line is crossed. */
  total?: number | null;
  /** Captured when the lane crosses the finish line (absent in runs saved by older versions). */
  maxRpm?: number;
  gearsUsed?: number[];
  /** Accumulated slip distance of the driven tyres, ∫|ωr − v| dt (m). */
  slipM?: number;
}

export interface RaceLane {
  sim: VehicleSimulation;
  ai: DragAI | null;
  /** Player throttle (read each step; ignored for AI lanes). */
  pedal?: () => number;
  name: string;
}

interface LaneState {
  ready: boolean;
  engineOn: boolean;
  leftAt: number | null;
  /** Race time at which the lane finished (finish line crossed or DNF); freezes the timers. */
  endT: number | null;
  prevX: number;
  prevT: number;
  crossT: Map<number, number>; // distance → absolute time of crossing
  result: LaneResult;
}

function emptyResult(): LaneResult {
  return { rt: null, redLight: false, splits: {}, traps: {}, et: null, trapMs: null, finished: false, dnf: false, maxSpeedMs: 0 };
}

/**
 * Drag race logic: staging, Christmas tree (pro 0.4 s / sportsman 0.5 s), reaction time from the
 * stage beam (rollout), interpolated split times (60 ft, 330 ft, 1/8, 1000 ft, 1/4, 1 km), trap
 * speeds over the last 66 ft, red light, DNF and automatic braking after the finish line.
 * It never changes the physics – it only writes the same controls a driver has, plus the
 * automatic brake that the plan specifies after the finish.
 */
export class RaceController {
  phase: RacePhase = 'staging';
  time = 0;
  greenAt: number | null = null;
  private treeStartAt: number | null = null;
  private stagedSince: number | null = null;
  private readonly lanes: LaneState[];
  private readonly rng: Prng;
  readonly distanceM: number;
  readonly splits: SplitDef[];
  winner: number | null = null;
  /** Message for the UI (hints, results). */
  status = 'Preparando…';
  dnfTimeoutS: number;

  constructor(
    readonly raceLanes: RaceLane[],
    readonly distanceId: RaceDistanceId,
    readonly treeType: TreeType = 'pro',
    seed = 1,
  ) {
    this.distanceM = RACE_DISTANCES[distanceId].m;
    this.dnfTimeoutS = DNF_TIMEOUT_S[distanceId];
    this.splits = SPLITS.filter((s) => s.m <= this.distanceM + 1e-6);
    this.rng = new Prng(seed * 977 + 13);
    this.lanes = raceLanes.map((l) => ({ ready: false, engineOn: false, leftAt: null, endT: null, prevX: l.sim.x, prevT: 0, crossT: new Map(), result: emptyResult() }));
    for (const l of raceLanes) {
      l.sim.controls.autoStart = true; // ignition is automatic on the track
      l.sim.controls.autoBrake = false;
      l.sim.controls.holdBrake = true;
      l.ai?.newRace();
    }
  }

  get results(): LaneResult[] {
    return this.lanes.map((l) => l.result);
  }

  /** Running elapsed time of a lane (s since leaving the stage beam); the ET once finished. */
  elapsed(lane: number): number | null {
    const st = this.lanes[lane];
    if (!st || st.leftAt === null) return null;
    return st.result.et ?? this.time - st.leftAt;
  }

  /**
   * Time since the green light (s), from the race simulation clock: 0 until green, then advances
   * even if the car is still in neutral or stopped. Frozen at the finish line (or DNF). null while
   * the tree has not been scheduled. Separate from ET (`elapsed`) and RT.
   */
  elapsedSinceGreen(lane: number): number | null {
    const st = this.lanes[lane];
    if (!st || this.greenAt === null) return null;
    return Math.max(0, (st.endT ?? this.time) - this.greenAt);
  }

  /** Tree lights for the renderer. */
  lights(): TreeLights {
    const t = this.time;
    const amber: [number, number] = [0, 0];
    const green: [boolean, boolean] = [false, false];
    const red: [boolean, boolean] = [false, false];
    if (this.treeStartAt !== null) {
      const dt = t - this.treeStartAt;
      let a = 0;
      if (this.treeType === 'pro') a = dt >= 0 ? 3 : 0;
      else a = dt >= 0 ? Math.min(3, Math.floor(dt / 0.5) + 1) : 0;
      const g = this.greenAt !== null && t >= this.greenAt;
      for (let i = 0; i < 2; i++) {
        const lane = this.lanes[i];
        const foul = lane?.result.redLight ?? false;
        red[i as 0 | 1] = foul;
        green[i as 0 | 1] = g && !foul && !!lane;
        amber[i as 0 | 1] = lane ? (g ? 0 : a) : 0;
      }
    }
    const pre: [boolean, boolean] = [!!this.lanes[0]?.ready, !!this.lanes[1]?.ready];
    const st: [boolean, boolean] = [pre[0] && this.lanes[0]!.leftAt === null, pre[1] && !!this.lanes[1] && this.lanes[1].leftAt === null];
    return { prestage: pre, stage: st, amber, green, red };
  }

  /** Call before every physics step: writes the driver controls of every lane. */
  beforeStep(h: number): void {
    const t = this.time;
    // tree sequence
    if (this.phase === 'staging') {
      // a lane out of the race (blown engine on the line) does not hold the others
      const allReady = this.lanes.every((l) => l.ready || l.result.dnf) && this.lanes.some((l) => l.ready);
      // ready = engine running + car at rest at the line (neutral or first gear); the tree
      // starts by itself once everybody has been ready for a moment
      if (allReady) {
        if (this.stagedSince === null) this.stagedSince = t;
        this.status = READY_MESSAGE;
        if (t - this.stagedSince > 0.6) {
          this.treeStartAt = t + 0.6 + this.rng.next() * 1.2;
          this.greenAt = this.treeStartAt + (this.treeType === 'pro' ? 0.4 : 1.5);
          this.phase = 'tree';
        }
      } else {
        this.stagedSince = null;
        this.status = this.lanes.every((l) => l.engineOn) ? 'Aguardando o carro parar na linha…' : 'Ligando o motor…';
      }
    }
    if (this.phase === 'tree' && this.greenAt !== null && t >= this.greenAt) {
      this.phase = 'racing';
      this.status = 'Verde!';
    }
    this.raceLanes.forEach((lane, i) => {
      const st = this.lanes[i]!;
      const sim = lane.sim;
      const c = sim.controls;
      const finished = st.result.finished || st.result.dnf;
      if (lane.ai) {
        lane.ai.update(h, sim, {
          timeSinceGreen: this.greenAt === null ? null : t - this.greenAt,
          // "at the line": the AI may select first gear here (readiness no longer depends on the gear)
          staged: st.ready || (st.leftAt === null && sim.x < ROLLOUT_M),
          finished,
        });
      } else {
        c.pedal = finished ? 0 : (lane.pedal?.() ?? 0);
      }
      // The car is held at the line (no brake key): always in neutral (revving freely without
      // moving, whatever the grade or wind) and, in gear, until the driver applies throttle.
      // Gear + throttle releases it – leaving before the green is a red light, never blocked.
      c.holdBrake = st.leftAt === null && (sim.gear === 0 || c.pedal < 0.02) && !finished;
      // a blown engine coasts first (no drive, drag and rolling resistance only): the driver sees
      // the engine go, not the brakes; then the safety braking stops the car
      const coasting = st.result.dnfReason === 'engine-blown' && st.endT !== null && t - st.endT < BLOWN_COAST_S && sim.speed > 0.5;
      c.autoBrake = finished && !coasting;
    });
  }

  /** Call after every physics step: staging state, beams, splits, finish. */
  afterStep(h: number): void {
    this.time += h;
    const t = this.time;
    this.raceLanes.forEach((lane, i) => {
      const st = this.lanes[i]!;
      const sim = lane.sim;
      const res = st.result;
      st.engineOn = sim.engine.runState === 'RUNNING';
      // blown engine: out of this attempt, before or after the green (the other lane races on)
      if (sim.engine.runState === 'BROKEN' && !res.finished && !res.dnf) {
        res.dnf = true;
        res.dnfReason = 'engine-blown';
        res.maxRpm = sim.maxRpm;
        res.blownAtRpm = sim.failure?.brokenRpm ?? sim.engine.rpm;
        st.endT = t;
        st.ready = false;
        this.status = `Motor quebrado: ${lane.name}`;
      }
      if (st.leftAt === null) st.ready = st.engineOn && Math.abs(sim.speed) < READY_SPEED_MS && sim.x < ROLLOUT_M;
      res.maxSpeedMs = Math.max(res.maxSpeedMs, sim.speed);
      const x0 = st.prevX;
      const x1 = sim.x;
      const t0 = st.prevT;
      const cross = (d: number): number | null => {
        if (x0 < d && x1 >= d) return t0 + (h * (d - x0)) / Math.max(1e-9, x1 - x0);
        return null;
      };
      // leaving the stage beam
      if (st.leftAt === null) {
        const tl = cross(ROLLOUT_M);
        if (tl !== null) {
          st.leftAt = tl;
          if (this.greenAt === null || tl < this.greenAt) {
            res.redLight = true;
            res.rt = this.greenAt === null ? -(this.treeStartAt !== null ? this.treeStartAt + 0.4 - tl : 9.999) : tl - this.greenAt;
            if (this.phase === 'staging') {
              // left before the tree even started: abort the tree for everybody
              this.treeStartAt = t;
              this.greenAt = t + 0.4;
              this.phase = 'tree';
            }
            this.status = `Queimou a largada: ${lane.name}`;
          } else {
            res.rt = tl - this.greenAt;
          }
        }
      }
      if (st.leftAt !== null && !res.finished && !res.dnf) {
        for (const s of this.splits) {
          const tc = cross(s.m);
          if (tc !== null) {
            st.crossT.set(s.m, tc);
            res.splits[s.id] = tc - st.leftAt;
          }
          if (s.trap) {
            const tt = cross(s.m - TRAP_M);
            if (tt !== null) st.crossT.set(s.m - TRAP_M, tt);
            const a = st.crossT.get(s.m - TRAP_M);
            const b = st.crossT.get(s.m);
            if (a !== undefined && b !== undefined && res.traps[s.id] === undefined) res.traps[s.id] = TRAP_M / (b - a);
          }
        }
        const tf = cross(this.distanceM);
        if (tf !== null) {
          res.finished = true;
          sim.nitrous?.disable(); // the attempt is over: no injection until the next one
          st.endT = tf;
          res.et = tf - st.leftAt;
          res.total = (res.rt ?? 0) + res.et; // = finish − green
          res.maxRpm = sim.maxRpm;
          res.gearsUsed = [...sim.gearsUsed].sort((a, b) => a - b);
          res.slipM = sim.slipIntegral;
          const id = this.splits[this.splits.length - 1]!.id;
          res.trapMs = res.traps[id] ?? null;
        }
      }
      if (!res.finished && !res.dnf && this.greenAt !== null && t - this.greenAt > this.dnfTimeoutS) {
        res.dnf = true;
        res.dnfReason = 'timeout';
        sim.nitrous?.disable();
        st.endT = t;
      }
      st.prevX = x1;
      st.prevT = t;
    });
    this.decide();
  }

  private decide(): void {
    if (this.phase === 'finished') return;
    const all = this.lanes.every((l) => l.result.finished || l.result.dnf);
    if (!all) return;
    this.phase = 'finished';
    const score = (r: LaneResult): number => {
      if (r.dnf || r.et === null) return Number.POSITIVE_INFINITY;
      if (r.redLight) return 1e6 + (r.rt ?? 0);
      return (r.rt ?? 0) + r.et;
    };
    if (this.lanes.length === 1) {
      this.winner = this.lanes[0]!.result.redLight || this.lanes[0]!.result.dnf ? null : 0;
    } else {
      const s = this.lanes.map((l) => score(l.result));
      if (s.every((v) => !Number.isFinite(v))) this.winner = null;
      else if (this.lanes.every((l) => l.result.redLight)) {
        // both fouled: the one who fouled later (smaller |RT|) wins
        const rts = this.lanes.map((l) => l.result.rt ?? -99);
        this.winner = rts[0]! > rts[1]! ? 0 : 1;
      } else this.winner = s[0]! <= s[1]! ? 0 : 1;
    }
    this.status = this.winner === null ? 'Sem vencedor' : `Vencedor: ${this.raceLanes[this.winner]!.name}`;
  }
}
