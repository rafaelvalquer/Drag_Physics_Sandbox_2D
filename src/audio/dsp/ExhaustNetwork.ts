import type { ExhaustConfig } from '../../data/schema';
import { GAMMA_EXHAUST, R_EXHAUST_SPECIFIC, Waveguide, scatterJunction } from './Waveguide';
import { OnePole } from './Filters';

/**
 * Exhaust system as a network of digital waveguides.
 *
 * ORIGIN (MIT © Antonio-R1, engine-sound-generator): the chain cylinder → exhaust waveguide →
 * extractor → straight pipe → `Muffler` (parallel waveguide elements with a partially reflecting
 * end, "action") → outlet waveguide, and the valve-dependent reflection factors of
 * `Cylinder.updateWaveguidesReflectionValues`.
 *
 * CHANGES:
 * - Geometry from the car's exhaust configuration (metres and millimetres): one header primary
 *   per cylinder, one collector per bank, optional Y-merge (single layout) or true dual lines.
 * - Junctions are lossless N-port scattering junctions weighted by pipe areas (diameters), so
 *   area changes (expansion chambers, tailpipe) reflect with the physically right sign.
 * - Muffler chambers are parallel pipes between an inlet and an outlet junction (as in the
 *   original), absorption from the preset, plus an optional closed quarter-wave resonator branch.
 * - Open tailpipe end: low frequencies are reflected inverted, high frequencies radiate
 *   (one-pole split at ≈ 0.3·c/(2πa)); the radiated part is the line output.
 * - Gas temperature (EGT, cooling along the pipe) sets the speed of sound in every segment.
 */
/** Extra path from the far tailpipe to a side-view listener (≈ track width). */
export const FAR_PIPE_PATH_M = 1.45;

/** Reflection of the header wave at the exhaust port: closed valve ≈ rigid, open ≈ absorbing. */
export function portReflection(valveOpening: number): number {
  return 0.97 - 0.72 * valveOpening;
}

interface Line {
  inputPipe: number; // index into wg of the pipe feeding this line
  chambers: number[];
  resonator: number; // −1 when none
  tailpipe: number;
  openLp: OnePole;
  /** Body shadow of the far tailpipe (diffraction: high frequencies are blocked more). */
  shadow: OnePole | null;
  gain: number;
  delay: Float32Array;
  delayIdx: number;
  delaySamples: number;
  // junction scratch
  inArea: Float64Array;
  inIn: Float64Array;
  inOut: Float64Array;
  outArea: Float64Array;
  outIn: Float64Array;
  outOut: Float64Array;
}

export class ExhaustNetwork {
  private readonly wg: Waveguide[] = [];
  private readonly wL: Float64Array;
  private readonly wR: Float64Array;
  private readonly headers: number[] = [];
  private readonly collectors: number[] = [];
  private merge = -1;
  private readonly lines: Line[] = [];
  private readonly bankMembers: number[][] = [];
  private readonly bankArea: Float64Array[] = [];
  private readonly bankIn: Float64Array[] = [];
  private readonly bankOut: Float64Array[] = [];
  private readonly yArea = new Float64Array(3);
  private readonly yIn = new Float64Array(3);
  private readonly yOut = new Float64Array(3);
  /** Temperature fraction (0 = ambient, 1 = EGT) of each segment, for setGasTemperature. */
  private readonly segFrac: number[] = [];
  /** Extra pressure injected at the start of the tailpipe (afterfire pops). */
  tailInjection = 0;
  readonly lineOutputs: Float64Array;

  constructor(
    sampleRate: number,
    cfg: ExhaustConfig,
    bankOfCylinder: readonly number[],
    turbo: boolean,
    lowQuality: boolean,
    ambientK = 298,
    egtK = 700,
  ) {
    const banks = Math.max(...bankOfCylinder) + 1;
    const minT = 230;
    const add = (lengthM: number, diameterMm: number, frac: number, lossDb: number): number => {
      const t = ambientK + (egtK - ambientK) * frac;
      const w = new Waveguide(lengthM, diameterMm, sampleRate, minT, t, GAMMA_EXHAUST, R_EXHAUST_SPECIFIC, lossDb);
      this.wg.push(w);
      this.segFrac.push(frac);
      return this.wg.length - 1;
    };
    const loss = cfg.wallLossDbPerM;
    // header primaries
    for (let i = 0; i < bankOfCylinder.length; i++) {
      this.headers.push(add(cfg.headerPrimaryLengthM, cfg.headerDiameterMm, 1, loss));
    }
    // collectors (turbine on turbo engines: strong extra damping, it absorbs pulse energy)
    const collLen = Math.max(0.12, cfg.collectorLengthM * (cfg.layout === 'single' && banks > 1 ? 0.35 : 1));
    for (let b = 0; b < banks; b++) {
      this.collectors.push(add(collLen, cfg.collectorDiameterMm, 0.85, loss + (turbo ? 9 : 0)));
      const members = bankOfCylinder.map((bb, i) => (bb === b ? i : -1)).filter((i) => i >= 0);
      this.bankMembers.push(members);
      this.bankArea.push(new Float64Array(members.length + 1));
      this.bankIn.push(new Float64Array(members.length + 1));
      this.bankOut.push(new Float64Array(members.length + 1));
    }
    const dual = cfg.layout === 'dual' && banks > 1 && !lowQuality;
    if (!dual && banks > 1) {
      this.merge = add(cfg.collectorLengthM * 0.65, cfg.collectorDiameterMm * 1.15, 0.7, loss);
    }
    const lineCount = dual ? 2 : 1;
    const chambers = lowQuality ? cfg.mufflerChambersM.slice(0, 2) : cfg.mufflerChambersM;
    const chamberDiam = Math.max(cfg.collectorDiameterMm * 2.6, 110);
    for (let l = 0; l < lineCount; l++) {
      const inputPipe = dual ? this.collectors[l]! : this.merge >= 0 ? this.merge : this.collectors[0]!;
      const ch = chambers.map((len) => add(len, chamberDiam, 0.55, loss + cfg.mufflerAbsorption * 40));
      const res = cfg.resonatorLengthM > 0.02 && !lowQuality ? add(cfg.resonatorLengthM, cfg.collectorDiameterMm, 0.5, loss) : -1;
      const tail = add(cfg.tailpipeLengthM, cfg.tailpipeDiameterMm, cfg.tailTempFraction, loss);
      const a = (Math.PI * (cfg.tailpipeDiameterMm / 2000) ** 2);
      const radius = Math.sqrt(a / Math.PI);
      const fc = (0.3 * 343) / (2 * Math.PI * radius);
      const nIn = 1 + ch.length + (res >= 0 ? 1 : 0) + (ch.length === 0 ? 1 : 0);
      const nOut = ch.length + 1;
      // dual, side view: the far tailpipe is one track width (≈ 1.45 m) further from the listener
      // and behind the car body – later, quieter, and low-passed by diffraction around the body
      const delaySamples = l === 1 ? Math.round((FAR_PIPE_PATH_M / 343) * sampleRate) : 0;
      this.lines.push({
        inputPipe,
        chambers: ch,
        resonator: res,
        tailpipe: tail,
        openLp: new OnePole(sampleRate, fc),
        shadow: l === 1 ? new OnePole(sampleRate, 1400) : null,
        gain: l === 1 ? 0.62 : 1,
        delay: new Float32Array(Math.max(1, delaySamples + 1)),
        delayIdx: 0,
        delaySamples,
        inArea: new Float64Array(nIn),
        inIn: new Float64Array(nIn),
        inOut: new Float64Array(nIn),
        outArea: new Float64Array(nOut),
        outIn: new Float64Array(nOut),
        outOut: new Float64Array(nOut),
      });
    }
    this.lineOutputs = new Float64Array(lineCount);
    this.wL = new Float64Array(this.wg.length);
    this.wR = new Float64Array(this.wg.length);
    // static junction areas
    for (let b = 0; b < banks; b++) {
      const m = this.bankMembers[b]!;
      const ar = this.bankArea[b]!;
      for (let k = 0; k < m.length; k++) ar[k] = this.wg[this.headers[m[k]!]!]!.areaM2;
      ar[m.length] = this.wg[this.collectors[b]!]!.areaM2;
    }
    if (this.merge >= 0) {
      this.yArea[0] = this.wg[this.collectors[0]!]!.areaM2;
      this.yArea[1] = this.wg[this.collectors[1]!]!.areaM2;
      this.yArea[2] = this.wg[this.merge]!.areaM2;
    }
    for (const line of this.lines) {
      let k = 0;
      line.inArea[k++] = this.wg[line.inputPipe]!.areaM2;
      for (const c of line.chambers) line.inArea[k++] = this.wg[c]!.areaM2;
      if (line.resonator >= 0) line.inArea[k++] = this.wg[line.resonator]!.areaM2;
      if (line.chambers.length === 0) line.inArea[k++] = this.wg[line.tailpipe]!.areaM2;
      for (let c = 0; c < line.chambers.length; c++) line.outArea[c] = this.wg[line.chambers[c]!]!.areaM2;
      line.outArea[line.chambers.length] = this.wg[line.tailpipe]!.areaM2;
    }
  }

  get segmentCount(): number {
    return this.wg.length;
  }

  /** Pressure wave arriving at the exhaust port of cylinder i (from the previous sample). */
  incomingAtPort(i: number): number {
    return this.wg[this.headers[i]!]!.arriveLeft;
  }

  get headerDelaySamples(): number {
    return this.wg[this.headers[0]!]!.delaySamples;
  }

  /** Updates the speed of sound in every segment (call at block rate). */
  setGasTemperature(egtK: number, ambientK: number): void {
    for (let i = 0; i < this.wg.length; i++) {
      this.wg[i]!.setTemperature(ambientK + (egtK - ambientK) * this.segFrac[i]!);
    }
  }

  /**
   * One sample. `source[i]` is the pressure wave injected by cylinder i at its exhaust port,
   * `valve[i]` its exhaust valve opening (0..1). Returns the radiated pressure (sum of lines).
   */
  process(source: Float64Array, valve: Float64Array): number {
    const wg = this.wg;
    for (let i = 0; i < wg.length; i++) wg[i]!.read();
    const wL = this.wL;
    const wR = this.wR;
    // cylinder ends (port of the valve-dependent reflection: closed ≈ rigid, open ≈ absorbing)
    for (let i = 0; i < this.headers.length; i++) {
      const h = this.headers[i]!;
      const r = portReflection(valve[i]!);
      wL[h] = r * wg[h]!.arriveLeft + source[i]!;
    }
    // bank collector junctions
    for (let b = 0; b < this.collectors.length; b++) {
      const m = this.bankMembers[b]!;
      const inc = this.bankIn[b]!;
      const out = this.bankOut[b]!;
      for (let k = 0; k < m.length; k++) inc[k] = wg[this.headers[m[k]!]!]!.arriveRight;
      const c = this.collectors[b]!;
      inc[m.length] = wg[c]!.arriveLeft;
      scatterJunction(this.bankArea[b]!, inc, out, m.length + 1);
      for (let k = 0; k < m.length; k++) wR[this.headers[m[k]!]!] = out[k]!;
      wL[c] = out[m.length]!;
    }
    // Y merge
    if (this.merge >= 0) {
      const c0 = this.collectors[0]!;
      const c1 = this.collectors[1]!;
      this.yIn[0] = wg[c0]!.arriveRight;
      this.yIn[1] = wg[c1]!.arriveRight;
      this.yIn[2] = wg[this.merge]!.arriveLeft;
      scatterJunction(this.yArea, this.yIn, this.yOut, 3);
      wR[c0] = this.yOut[0]!;
      wR[c1] = this.yOut[1]!;
      wL[this.merge] = this.yOut[2]!;
    }
    // muffler lines
    let sum = 0;
    for (let l = 0; l < this.lines.length; l++) {
      const line = this.lines[l]!;
      const ip = line.inputPipe;
      let k = 0;
      line.inIn[k++] = wg[ip]!.arriveRight;
      for (const c of line.chambers) line.inIn[k++] = wg[c]!.arriveLeft;
      if (line.resonator >= 0) line.inIn[k++] = wg[line.resonator]!.arriveLeft;
      if (line.chambers.length === 0) line.inIn[k++] = wg[line.tailpipe]!.arriveLeft;
      scatterJunction(line.inArea, line.inIn, line.inOut, k);
      k = 0;
      wR[ip] = line.inOut[k++]!;
      for (const c of line.chambers) wL[c] = line.inOut[k++]!;
      if (line.resonator >= 0) {
        wL[line.resonator] = line.inOut[k++]!;
        wR[line.resonator] = wg[line.resonator]!.arriveRight; // closed end: rigid reflection
      }
      if (line.chambers.length === 0) {
        wL[line.tailpipe] = line.inOut[k++]! + (l === 0 ? this.tailInjection : 0);
      } else {
        const n = line.chambers.length;
        for (let c = 0; c < n; c++) line.outIn[c] = wg[line.chambers[c]!]!.arriveRight;
        line.outIn[n] = wg[line.tailpipe]!.arriveLeft;
        scatterJunction(line.outArea, line.outIn, line.outOut, n + 1);
        for (let c = 0; c < n; c++) wR[line.chambers[c]!] = line.outOut[c]!;
        wL[line.tailpipe] = line.outOut[n]! + (l === 0 ? this.tailInjection : 0);
      }
      // open end: low frequencies reflect inverted, high frequencies radiate
      const arrive = wg[line.tailpipe]!.arriveRight;
      const low = line.openLp.lowpass(arrive);
      wR[line.tailpipe] = -0.92 * low;
      let radiated = arrive - low;
      if (line.delaySamples > 0) {
        const d = line.delay;
        const out = d[line.delayIdx]!;
        d[line.delayIdx] = radiated;
        line.delayIdx = (line.delayIdx + 1) % d.length;
        radiated = out;
      }
      if (line.shadow) radiated = 0.35 * radiated + 0.65 * line.shadow.lowpass(radiated);
      radiated *= line.gain;
      this.lineOutputs[l] = radiated;
      sum += radiated;
    }
    for (let i = 0; i < wg.length; i++) wg[i]!.write(wL[i]!, wR[i]!);
    this.tailInjection = 0;
    return sum;
  }

  clear(): void {
    for (const w of this.wg) w.clear();
  }
}
