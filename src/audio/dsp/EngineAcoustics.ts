import { Prng } from '../../core/prng';
import type { AcousticVehicleConfig } from './AcousticConfig';
import { Biquad, OnePole, ParamSmoother } from './Filters';
import { ExhaustNetwork, portReflection } from './ExhaustNetwork';
import { GAMMA_AIR, GAMMA_EXHAUST, R_AIR_SPECIFIC, R_EXHAUST_SPECIFIC, Waveguide, soundSpeed } from './Waveguide';

const FOUR_PI = 4 * Math.PI;
/** Tailpipe jet calibration (see EngineAcoustics.process): reference intensity of the saturating
 * curve (Pa), jet RMS relative to the pipe-pulse RMS at saturation, Strouhal number and corner limits. */
const JET_INTENSITY_REF = 300;
const JET_REL_LEVEL = 0.3;
const JET_STROUHAL = 0.2;
const JET_FC_MIN = 250;
const JET_FC_MAX = 1400;
const DEG = Math.PI / 180;
const LUT = 1440; // points over the 720° cycle (0.5° resolution)
const LUT_SCALE = LUT / FOUR_PI;

/** Per-sample control values the engine voice needs (filled by VehicleAcoustics from the stream). */
export interface EngineControl {
  theta: number;
  omega: number;
  throttle: number;
  load: number;
  manifoldPa: number;
  boostPa: number;
  combustion: boolean;
  sparkCut: number;
  exhaustTempK: number;
  starter: boolean;
}

/**
 * Engine acoustic source model (exhaust ports, intake runners, engine block).
 *
 * ORIGIN (MIT © Antonio-R1, engine-sound-generator `Cylinder` / `Engine`): one source per
 * cylinder, phased by the firing order over the 720° cycle, driving an exhaust waveguide and an
 * intake waveguide; valve-dependent reflection at the cylinder end; three outputs (intake, block,
 * exhaust outlet).
 *
 * CHANGES (the original used a fixed analytic pressure pulse with random phase jitter):
 * - Valve lift curves are built from the cam timing of the engine config (EVO/EVC/IVO/IVC, crank
 *   degrees from the firing TDC) – the same data the physics uses.
 * - Exhaust blowdown is a small gas-dynamics model per cylinder: at EVO the cylinder pressure is
 *   estimated from the trapped charge (load), the compression ratio and the polytropic expansion
 *   to the EVO volume, with or without heat release (spark cut, rev limiter and ignition off give
 *   the motored value). While the valve is open the cylinder pressure obeys
 *     dp/dt = −γ·p·(dV/dt + u)/V,   u = Cd·A_valve·L(θ)·c·√(2Δp/(γ·p))  (capped at choked flow)
 *   with Δp measured against the pressure in the header at the port, so pulses of neighbouring
 *   cylinders interact (scavenging). The pressure wave entering the header is ρc·u/A_header.
 * - Intake: the piston draws air through the open intake valve; the volume flow excites a
 *   physical runner waveguide and the airbox Helmholtz resonance f = c/2π·√(A/(V·L)).
 * - Block: reciprocating inertia forces m·r·ω²(cos α + λ·cos 2α) projected on each bank axis,
 *   combustion pressure rise (Wiebe heat-release rate over the burn duration) through structural
 *   resonances, valve closing ticks, starter motor whine.
 * - Cycle-to-cycle combustion variation from a seeded PRNG (deterministic rendering for tests).
 * - Real sample rate everywhere; no allocations per sample.
 */
export class EngineAcoustics {
  readonly cylinders: number;
  private readonly firing: Float64Array;
  private readonly bankDirX: Float64Array;
  private readonly bankDirY: Float64Array;
  private readonly prevLocal: Float64Array;
  /** Cylinder pressure above the header pressure (Pa) while the exhaust valve is open. */
  private readonly pc: Float64Array;
  private readonly burnAmp: Float64Array; // heat release of the current cycle (0 = cut/misfire)
  private readonly sparkAcc: Float64Array;
  private readonly exhaustSrc: Float64Array;
  private readonly exhaustValve: Float64Array;
  // LUTs over the cycle angle measured from the cylinder's firing TDC
  private readonly lutExhaust = new Float64Array(LUT + 1);
  private readonly lutIntake = new Float64Array(LUT + 1);
  private readonly lutVolume = new Float64Array(LUT + 1); // V/Vd (incl. clearance)
  private readonly lutDVdTheta = new Float64Array(LUT + 1); // d(V/Vd)/dθ (1/rad)
  private readonly lutRecip = new Float64Array(LUT + 1); // cos α + λ cos 2α
  private readonly lutBurnRate = new Float64Array(LUT + 1); // Wiebe dx/dθ (1/rad)
  readonly exhaust: ExhaustNetwork;
  private readonly runner: Waveguide | null;
  private readonly runnerAreaM2: number;
  private readonly airbox: Biquad;
  private readonly intakeHp: OnePole;
  private readonly structLow: Biquad;
  private readonly structMid: Biquad;
  private readonly structHigh: Biquad;
  private readonly tickRes: Biquad;
  private readonly starterRes: Biquad;
  private readonly throttleHissBp: Biquad;
  private readonly jetHp: Biquad;
  private readonly roarHp: OnePole;
  private readonly roarLp: OnePole;
  private readonly snorkelAreaM2: number;
  private readonly cavity: Biquad;
  private cavityKick = 0;
  private readonly jetLp: Biquad;
  private readonly jetLp2: OnePole;
  private readonly jetFc: ParamSmoother;
  private readonly jetAmp: ParamSmoother;
  private readonly tailDiameterM: number;
  private readonly sampleRate: number;
  private jetAmpTarget = 0;
  private jetDrive = 1;
  private readonly radEnvK: number;
  private radEnvSq = 0;
  private jetFcTarget = 400;
  private jetCounter = 0;
  private readonly tailAreaM2: number;
  private readonly tailTempFraction: number;
  private readonly displacementM3: number;
  private readonly rng: Prng;
  private readonly vd: number; // swept volume per cylinder (m³)
  private readonly evoPressureRatioFired: number;
  private readonly evoPressureRatioMotored: number;
  private readonly valveAreaM2: number;
  private readonly headerAreaM2: number;
  private readonly crankRadiusM: number;
  private readonly recipMass: number;
  private readonly lowQuality: boolean;
  private readonly evoRad: number;
  private readonly evcRad: number;
  private readonly ivcRad: number;
  private readonly dt: number;
  private starterPhase = 0;
  private tick = 0;
  private readonly tickDecay: number;
  private readonly redlineOmega: number;
  private egtK = 800;
  private ambientK = 298;
  private cExh = 560;
  private cAir = 346;
  // outputs of the last sample (Pa-scale, before mixing gains)
  intakeOut = 0;
  blockOut = 0;
  exhaustOut = 0;
  /** Components of `exhaustOut` (Pa), kept for offline diagnostics: pipe radiation and tailpipe jet noise. */
  exhaustRadiated = 0;
  exhaustJet = 0;
  /** Number of combustion / cut events seen (diagnostics and tests). */
  firedEvents = 0;
  cutEvents = 0;

  constructor(
    sampleRate: number,
    cfg: AcousticVehicleConfig,
  ) {
    const e = cfg.engine;
    this.dt = 1 / sampleRate;
    this.lowQuality = cfg.quality === 'low';
    this.cylinders = e.cylinders;
    const n = e.cylinders;
    this.firing = Float64Array.from(e.firingAnglesDeg, (d) => d * DEG);
    this.bankDirX = new Float64Array(n);
    this.bankDirY = new Float64Array(n);
    const half = (e.bankAngleDeg * DEG) / 2;
    for (let i = 0; i < n; i++) {
      const phi = e.bankAngleDeg > 0 ? (e.bankOfCylinder[i] === 0 ? -half : half) : 0;
      this.bankDirX[i] = Math.sin(phi);
      this.bankDirY[i] = Math.cos(phi);
    }
    this.prevLocal = new Float64Array(n).fill(-1);
    this.pc = new Float64Array(n);
    this.burnAmp = new Float64Array(n);
    this.sparkAcc = new Float64Array(n);
    this.exhaustSrc = new Float64Array(n);
    this.exhaustValve = new Float64Array(n);
    this.rng = new Prng(cfg.seed * 7919 + 17);

    const bore = e.boreMm / 1000;
    const stroke = e.strokeMm / 1000;
    this.crankRadiusM = stroke / 2;
    this.vd = (Math.PI / 4) * bore * bore * stroke;
    this.recipMass = e.reciprocatingMassKg;
    const lambda = this.crankRadiusM / (e.rodLengthMm / 1000);
    const cr = e.compressionRatio;
    const vClear = 1 / (cr - 1);

    // two exhaust valves of ≈ 0.31·bore; curtain area at max lift, limited by the seat area
    const dv = 0.31 * bore;
    const lift = e.cam.exhaustLiftMm / 1000;
    this.valveAreaM2 = 2 * Math.min(Math.PI * dv * lift, (Math.PI * dv * dv) / 4) * 0.7;
    this.headerAreaM2 = (Math.PI * (cfg.exhaust.headerDiameterMm / 1000) ** 2) / 4;

    this.evoRad = e.cam.evoDeg * DEG;
    this.evcRad = e.cam.evcDeg * DEG;
    const ivoRad = e.cam.ivoDeg * DEG;
    this.ivcRad = e.cam.ivcDeg * DEG;
    const burn = e.combustion.burnDurationDeg * DEG;
    const sparkAdv = -burn * 0.45; // 50 % burn point ≈ 8–10° after TDC

    const lift01 = (a: number, open: number, close: number): number => {
      // smooth cam lobe (raised cosine with flattened top) between open and close
      let span = close - open;
      if (span <= 0) span += FOUR_PI;
      let x = a - open;
      if (x < 0) x += FOUR_PI;
      if (x > span) return 0;
      const u = x / span;
      const s = Math.sin(Math.PI * u);
      // flow (curtain) area grows ~linearly with lift; flank ramps then dwell at full lift
      return Math.min(1, s * 1.6);
    };
    for (let k = 0; k <= LUT; k++) {
      const a = (k / LUT) * FOUR_PI;
      const crank = a % (2 * Math.PI);
      // piston position x(α) from TDC, α = crank angle
      const c = Math.cos(crank);
      const s = Math.sin(crank);
      const root = Math.sqrt(1 - lambda * lambda * s * s);
      const x = 1 - c + (1 - root) / lambda; // (in units of r)
      this.lutVolume[k] = vClear + x / 2;
      this.lutDVdTheta[k] = (s + (lambda * s * c) / root) / 2;
      this.lutRecip[k] = c + lambda * Math.cos(2 * crank);
      this.lutExhaust[k] = lift01(a, this.evoRad, this.evcRad);
      this.lutIntake[k] = lift01(a, ivoRad, this.ivcRad);
      // Wiebe heat release rate (a = 5, m = 2)
      let xb = a - sparkAdv;
      if (xb > 2 * Math.PI) xb -= FOUR_PI;
      if (xb >= 0 && xb <= burn) {
        const u = xb / burn;
        this.lutBurnRate[k] = (5 * 3 * u * u * Math.exp(-5 * u * u * u)) / burn;
      }
    }
    // cylinder pressure at EVO relative to the manifold pressure (polytropic, n = 1.3)
    const vEvo = this.lutVolume[Math.round((this.evoRad / FOUR_PI) * LUT)]!;
    const vTdc = vClear;
    const vIvc = this.lutVolume[Math.round(((this.ivcRad % FOUR_PI) / FOUR_PI) * LUT)]!;
    const compression = Math.pow(vIvc / vTdc, 1.3);
    const expansion = Math.pow(vTdc / vEvo, 1.3);
    // constant-volume heat release of a stoichiometric charge raises the pressure ≈ 3.2×
    const heat = 3.2 * (1 + (e.combustion.burnDurationDeg - 50) / 250);
    this.evoPressureRatioFired = compression * expansion * heat;
    this.evoPressureRatioMotored = compression * expansion;

    this.exhaust = new ExhaustNetwork(sampleRate, cfg.exhaust, e.bankOfCylinder, e.induction === 'turbo', this.lowQuality, 298, e.egt.idleK);

    // intake: shared representative runner + airbox Helmholtz resonator
    const runnerD = e.intake.runnerDiameterMm;
    this.runnerAreaM2 = (Math.PI * (runnerD / 1000) ** 2) / 4;
    this.runner = this.lowQuality
      ? null
      : new Waveguide(e.intake.runnerLengthM, runnerD, sampleRate, 230, 310, GAMMA_AIR, R_AIR_SPECIFIC, 1.5);
    const snorkelA = this.runnerAreaM2 * 2.2;
    this.snorkelAreaM2 = snorkelA;
    const snorkelL = 0.12 + e.intake.runnerLengthM * 0.5;
    const fH = (343 / (2 * Math.PI)) * Math.sqrt(snorkelA / ((e.intake.airboxVolumeL / 1000) * snorkelL));
    this.airbox = new Biquad(sampleRate).setBandpass(fH, 1.4);
    this.intakeHp = new OnePole(sampleRate, 25);
    this.throttleHissBp = new Biquad(sampleRate).setBandpass(3200, 0.8);
    this.jetHp = new Biquad(sampleRate).setHighpass(150, 0.7);
    this.jetLp2 = new OnePole(sampleRate, 900);
    this.jetFc = new ParamSmoother(sampleRate, 0.08, 0.08, 400);
    this.jetAmp = new ParamSmoother(sampleRate, 0.03, 0.06);
    this.sampleRate = sampleRate;
    this.tailDiameterM = cfg.exhaust.tailpipeDiameterMm / 1000;
    this.radEnvK = 1 - Math.exp(-1 / (0.08 * sampleRate));
    this.roarHp = new OnePole(sampleRate, 120);
    this.roarLp = new OnePole(sampleRate, 1800);
    // first circumferential acoustic mode of the combustion chamber f = 1.841·c/(π·B), excited
    // by every combustion (the "clatter" part of combustion noise, transmitted by the block)
    this.cavity = new Biquad(sampleRate).setBandpass((1.841 * 640) / (Math.PI * bore), 14);
    this.jetLp = new Biquad(sampleRate).setLowpass(400, 0.6);
    const lines = cfg.exhaust.layout === 'dual' && Math.max(...e.bankOfCylinder) > 0 && !this.lowQuality ? 2 : 1;
    this.tailAreaM2 = lines * Math.PI * (cfg.exhaust.tailpipeDiameterMm / 2000) ** 2;
    this.tailTempFraction = cfg.exhaust.tailTempFraction;
    this.displacementM3 = this.vd * n;

    // block structure resonances scale with engine size
    const size = Math.cbrt((this.vd * n) / 0.002);
    this.structLow = new Biquad(sampleRate).setBandpass(260 / size, 1.2);
    this.structMid = new Biquad(sampleRate).setBandpass(1150 / size, 2.2);
    this.structHigh = new Biquad(sampleRate).setBandpass(2700 / size, 3.5);
    this.tickRes = new Biquad(sampleRate).setBandpass(3300 / Math.sqrt(size), 4);
    this.tickDecay = Math.exp(-1 / (0.0025 * sampleRate));
    this.redlineOmega = (e.redlineRpm * 2 * Math.PI) / 60;
    this.starterRes = new Biquad(sampleRate).setBandpass(1800, 2);
  }

  /** Call at block rate (every 64–128 samples): gas temperatures → speed of sound, delays. */
  updateSlow(exhaustTempK: number, ambientK: number): void {
    this.egtK = exhaustTempK;
    this.ambientK = ambientK;
    this.cExh = soundSpeed(exhaustTempK, GAMMA_EXHAUST, R_EXHAUST_SPECIFIC);
    this.cAir = soundSpeed(ambientK + 15);
    this.exhaust.setGasTemperature(exhaustTempK, ambientK);
    if (this.runner) this.runner.setTemperature(ambientK + 15);
  }

  private lut(table: Float64Array, a: number): number {
    const x = a * LUT_SCALE;
    const i = x | 0;
    const f = x - i;
    const v0 = table[i]!;
    return v0 + (table[i + 1]! - v0) * f;
  }

  /** Renders one sample; results in intakeOut / blockOut / exhaustOut (Pa). */
  process(c: EngineControl): void {
    const n = this.cylinders;
    const omega = c.omega;
    const absW = Math.abs(omega);
    const dt = this.dt;
    const pMan = Math.max(c.manifoldPa, 5000);
    const turbo = c.boostPa > 0;
    // exhaust back pressure at the port (turbine restriction rises with boost)
    const pExh = 101325 + (turbo ? 0.85 * c.boostPa : 0) + 4000 * c.load;
    const rhoExh = pExh / (R_EXHAUST_SPECIFIC * this.egtK);
    const zExh = (rhoExh * this.cExh) / this.headerAreaM2;
    const rhoAir = pMan / (R_AIR_SPECIFIC * (this.ambientK + 15));
    const zAir = (rhoAir * this.cAir) / this.runnerAreaM2;
    const cdA = this.valveAreaM2;
    const gam = GAMMA_EXHAUST;

    let intakeFlow = 0;
    let gasForce = 0;
    let fx = 0;
    let fy = 0;
    let ticks = 0;
    const omega2 = omega * omega;
    for (let i = 0; i < n; i++) {
      let a = (c.theta - this.firing[i]!) % FOUR_PI;
      if (a < 0) a += FOUR_PI;
      const prev = this.prevLocal[i]!;
      this.prevLocal[i] = a;
      if (prev >= 0 && omega > 0) {
        const wrapped = a < prev; // passed 720°/0
        // ignition (at the start of the cycle window: spark ≈ before TDC is folded into the LUT)
        if (wrapped) {
          let fire = c.combustion;
          if (fire && c.sparkCut > 0) {
            this.sparkAcc[i]! += c.sparkCut;
            if (this.sparkAcc[i]! >= 1) {
              this.sparkAcc[i]! -= 1;
              fire = false;
            }
          }
          if (fire) {
            const cv = 1 + 0.12 * this.rng.gaussian();
            this.burnAmp[i] = Math.max(0.2, cv);
            this.firedEvents++;
            this.cavityKick += this.burnAmp[i]! * (pMan / 101325);
          } else {
            this.burnAmp[i] = 0;
            this.cutEvents++;
          }
        }
        // exhaust valve opening: blowdown initial pressure
        if ((prev < this.evoRad && a >= this.evoRad) || (wrapped && a >= this.evoRad)) {
          const ratio =
            this.evoPressureRatioMotored + (this.evoPressureRatioFired - this.evoPressureRatioMotored) * Math.min(this.burnAmp[i]!, 2);
          this.pc[i] = pMan * ratio - pExh;
        }
        // valve closing ticks (lash): exhaust at EVC, intake at IVC
        const evc = this.evcRad % FOUR_PI;
        const ivc = this.ivcRad % FOUR_PI;
        if ((prev < evc && a >= evc) || (prev < ivc && a >= ivc)) ticks += 1;
      }

      // exhaust port
      const lx = this.lut(this.lutExhaust, a);
      this.exhaustValve[i] = lx;
      let src = 0;
      if (lx > 1e-4) {
        const vol = this.lut(this.lutVolume, a) * this.vd;
        const dVdt = this.lut(this.lutDVdTheta, a) * this.vd * omega;
        const pCyl = Math.max(pExh + this.pc[i]!, 20000);
        // Flow is driven by the cylinder pressure against the pressure at the port. The port
        // pressure is the wave arriving from the header (pulses of the other cylinders of the
        // bank: scavenging / back-flow) plus the cylinder's own emitted wave Z·u; the latter is
        // solved implicitly (u = G·Δp_ext / (1 + G·Z)), which keeps the coupled loop passive.
        const pIn = this.exhaust.incomingAtPort(i);
        const pExt = (1 + portReflection(lx)) * pIn;
        const pcN = this.pc[i]! - gam * pCyl * (dVdt / vol) * dt; // piston motion
        const dp = pcN - pExt;
        // secant conductance of the orifice: u = Cd·A·L·c·√(2Δp/(γp)) / Δp, choked at u = Cd·A·L·c,
        // laminarized below 1.5 kPa so the conductance stays finite at Δp → 0
        // Cylinder gas is hotter and denser than the header gas (isentropic relation to the port):
        // the speed of sound in the cylinder sets the choked velocity, and one m³ leaving the
        // cylinder occupies ρ_cyl/ρ_pipe m³ in the header – this is what makes the WOT blowdown
        // spike several times stronger than the displacement flow.
        const pr = pCyl / pExh;
        const cCyl = this.cExh * Math.sqrt(Math.pow(pr, (gam - 1) / gam));
        const dens = Math.pow(pr, 1 / gam);
        const m = Math.max(Math.abs(dp), 1500);
        let v = cCyl * Math.sqrt((2 * m) / (gam * pCyl));
        if (v > cCyl) v = cCyl;
        const g = (cdA * lx * v) / m;
        const gi = g / (1 + g * zExh * dens);
        // cylinder pressure relaxes towards the port pressure (exact exponential step) and the
        // volume that left the cylinder during the step is what enters the pipe (mass-consistent)
        const k = (gam * pCyl * gi) / vol;
        const pcNew = pExt + dp * Math.exp(-Math.min(k * dt, 30));
        const u = ((pcN - pcNew) * vol) / (gam * pCyl * dt);
        this.pc[i] = pcNew;
        src = zExh * u * dens;
      }
      this.exhaustSrc[i] = src;

      // intake suction while the intake valve is open
      const li = this.lut(this.lutIntake, a);
      if (li > 1e-4) {
        const dVdt = this.lut(this.lutDVdTheta, a) * this.vd * omega;
        intakeFlow += li * dVdt;
      }
      // block: inertia force along the bank axis, combustion pressure rise rate
      const fr = this.recipMass * this.crankRadiusM * omega2 * this.lut(this.lutRecip, a);
      fx += fr * this.bankDirX[i]!;
      fy += fr * this.bankDirY[i]!;
      const br = this.burnAmp[i]!;
      if (br > 0) gasForce += br * this.lut(this.lutBurnRate, a);
    }

    // ---- exhaust network
    const radiated = this.exhaust.process(this.exhaustSrc, this.exhaustValve);
    // Turbulent jet noise at the tailpipe exit. Physical intensity (Lighthill, ∝ ρ·v²·(v/c)², i.e.
    // ∝ v⁴ in pressure) from the mean exhaust velocity: trapped mass per cycle (load) · cycles/s,
    // expanded to the tailpipe temperature. The physical value is only the DRIVER: it is mapped
    // through a smooth saturating curve x/(1+x) (monotonic in the flow, no hard corner) onto an
    // amplitude relative to the running level of the pipe pulses, so turbulence stays a discreet
    // layer under the combustion roar at any rpm/load/preset instead of growing with v⁴ until it
    // masks the pulses. Spectrum: Strouhal-scaled low-pass (≈ 0.2·v/D, ~−18 dB/oct above), so it
    // never reaches the radio-static region.
    const tTail = this.ambientK + (this.egtK - this.ambientK) * this.tailTempFraction;
    const mDot = c.load * this.displacementM3 * 1.18 * (absW / FOUR_PI);
    const rhoTail = 101325 / (R_EXHAUST_SPECIFIC * tTail);
    const vJet = mDot / (rhoTail * this.tailAreaM2);
    this.radEnvSq += (radiated * radiated - this.radEnvSq) * this.radEnvK;
    const radEnv = Math.sqrt(this.radEnvSq);
    if ((this.jetCounter++ & 31) === 0) {
      const cTail = soundSpeed(tTail, GAMMA_EXHAUST, R_EXHAUST_SPECIFIC);
      const mach = vJet / cTail;
      const intensity = 4 * rhoTail * vJet * vJet * mach * mach;
      const x = intensity / JET_INTENSITY_REF;
      this.jetAmpTarget = JET_REL_LEVEL * radEnv * (x / (1 + x));
      this.jetFcTarget = Math.min(JET_FC_MAX, Math.max(JET_FC_MIN, (JET_STROUHAL * vJet) / this.tailDiameterM));
      const fc = this.jetFc.value;
      this.jetLp.setLowpass(fc, 0.6);
      this.jetLp2.setCutoff(fc * 1.8);
      // unit-RMS drive for a white source of variance 1/3 band-limited to ≈ 1.1·fc
      this.jetDrive = 1 / (0.577 * Math.sqrt((2.2 * fc) / this.sampleRate));
    }
    this.jetFc.next(this.jetFcTarget);
    const jetAmp = this.jetAmp.next(this.jetAmpTarget);
    const pulse = 1 + Math.max(-0.9, Math.min(1.5, radiated / (2 * radEnv + 1e-6)));
    const jet = this.jetLp2.lowpass(this.jetLp.process(this.jetHp.process(this.rng.bipolar()))) * this.jetDrive * jetAmp * pulse;
    // low speed fade (engine stopped): avoids residual hum from held states
    const runFade = absW < 8 ? (absW / 8) * (absW / 8) : 1;
    this.exhaustRadiated = radiated * runFade;
    this.exhaustJet = jet * runFade;
    this.exhaustOut = (radiated + jet) * runFade;

    // ---- intake: runner (cylinder end ↔ airbox end), Helmholtz airbox, throttle hiss
    const suction = -zAir * intakeFlow;
    let intakeSig: number;
    if (this.runner) {
      const r = this.runner;
      r.read();
      // valve end: mostly reflective (closed valves); airbox end: large area → inverted reflection
      const fromValve = 0.6 * r.arriveLeft + suction;
      const fromBox = -0.75 * r.arriveRight;
      r.write(fromValve, fromBox);
      intakeSig = r.arriveRight * 0.25 + suction * 0.15;
    } else {
      intakeSig = suction * 0.4;
    }
    intakeSig = this.airbox.process(intakeSig) * 0.7 + intakeSig * 0.3;
    // turbulent throttle noise: grows with the pressure drop across a partly open plate
    const drop = Math.max(0, 1 - pMan / 101325);
    const flowRpm = absW / 600;
    const hiss = this.throttleHissBp.process(this.rng.bipolar()) * drop * flowRpm * c.throttle * 900;
    // induction roar: turbulent flow noise at the airbox inlet, same scaling as the tailpipe jet
    // (∝ ρ·v²·(v/c)², v from the inducted mass flow), modulated by the pulsating suction
    const mAir = c.load * this.displacementM3 * 1.18 * (absW / FOUR_PI);
    const vIn = mAir / (1.18 * this.snorkelAreaM2);
    const machIn = vIn / this.cAir;
    const mod = 1 + Math.max(-0.9, Math.min(2, -suction / 3000));
    const roar = this.roarLp.lowpass(this.roarHp.highpass(this.rng.bipolar())) * 4 * 1.18 * vIn * vIn * machIn * machIn * mod;
    this.intakeOut = this.intakeHp.highpass(intakeSig + hiss + roar) * runFade;

    // ---- block
    // vertical and lateral components both radiate from the block walls
    const force = fy + 0.7 * fx;
    const comb = gasForce * omega * (pMan / 101325) * 60; // ∝ dp/dt of combustion
    let block = this.structLow.process(force * 0.004) + this.structMid.process(comb) * 0.8 + this.structHigh.process(comb) * 0.5;
    if (this.cavityKick > 0) {
      block += this.cavity.process(this.cavityKick * 9000);
      this.cavityKick = 0;
    } else block += this.cavity.process(0);
    // valve seating impacts (lash): a short noise burst per valve closing, impact energy grows
    // with the closing velocity (∝ engine speed)
    if (!this.lowQuality && ticks > 0) this.tick = Math.max(this.tick, 0.5 + 0.5 * Math.min(1.5, absW / this.redlineOmega));
    if (this.tick > 1e-4) {
      block += this.tickRes.process(this.tick * this.rng.bipolar() * 6000);
      this.tick *= this.tickDecay;
    }
    if (c.starter) {
      // starter motor ≈ 12× crank speed, pinion/flywheel mesh whine plus brush noise
      this.starterPhase += (absW * 12 * dt) / (2 * Math.PI);
      this.starterPhase -= Math.floor(this.starterPhase);
      const tone = Math.sin(2 * Math.PI * this.starterPhase) + 0.4 * Math.sin(4 * Math.PI * this.starterPhase);
      block += this.starterRes.process(tone * 300 + this.rng.bipolar() * 150);
    }
    this.blockOut = block * Math.min(1, runFade + (c.starter ? 1 : 0));
  }

  reset(): void {
    this.prevLocal.fill(-1);
    this.pc.fill(0);
    this.burnAmp.fill(0);
    this.exhaust.clear();
    this.runner?.clear();
  }
}
