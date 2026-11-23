import { z } from 'zod';

/**
 * Validated configuration schema. Every preset (built-in, edited in the Sandbox, imported JSON
 * or loaded from IndexedDB) passes through these schemas. Ranges reject configurations that are
 * physically impossible or numerically dangerous for the fixed-step integrator and the DSP.
 * All values are SI unless the field name states the unit (Mm, L, Deg, Rpm, Bar...).
 */

const finite = (min: number, max: number) => z.number().finite().min(min).max(max);

export const ArchitectureSchema = z.enum(['I4', 'I6', 'V6', 'V8', 'V12']);
export type Architecture = z.infer<typeof ArchitectureSchema>;

export const TorqueCurveSchema = z
  .object({
    rpm: z.array(finite(0, 20000)).min(4).max(64),
    torqueNm: z.array(finite(0, 3000)).min(4).max(64),
  })
  .superRefine((c, ctx) => {
    if (c.rpm.length !== c.torqueNm.length) {
      ctx.addIssue({ code: 'custom', message: 'curva de torque: listas de rpm e torque devem ter o mesmo tamanho' });
    }
    for (let i = 1; i < c.rpm.length; i++) {
      if (!(c.rpm[i]! > c.rpm[i - 1]!)) {
        ctx.addIssue({ code: 'custom', message: 'curva de torque: as rotações devem ser estritamente crescentes' });
        break;
      }
    }
  });

export const CamProfileSchema = z.object({
  /** Valve events in crank degrees measured from the firing TDC of the cylinder (0..720). */
  evoDeg: finite(90, 200),
  evcDeg: finite(340, 420),
  ivoDeg: finite(300, 380),
  ivcDeg: finite(540, 660),
  intakeLiftMm: finite(4, 16),
  exhaustLiftMm: finite(4, 16),
});
export type CamProfile = z.infer<typeof CamProfileSchema>;

export const TurboSchema = z.object({
  maxBoostBar: finite(0.1, 3),
  /** First order spool time constant of the shaft speed at full exhaust flow. */
  spoolTimeS: finite(0.05, 5),
  /** Exhaust mass flow (fraction of the WOT flow at peak torque) required for full shaft speed. */
  fullBoostFlowFraction: finite(0.15, 1.5),
  maxShaftRpm: finite(40000, 300000),
  compressorBlades: z.number().int().min(4).max(16),
  bovEnabled: z.boolean(),
  /** Pressure ratio drop time constant when the BOV vents. */
  bovVentTimeS: finite(0.02, 1),
  /**
   * Where the valve vents: to the atmosphere (aftermarket blow-off valve, audible "pssh") or back
   * into the compressor inlet (factory diverter/recirculating valve: a soft whoosh inside the
   * intake duct). Absent = atmosphere (behaviour of the configurations before Chapter 2).
   */
  bovVent: z.enum(['atmosphere', 'recirculating']).optional(),
  /**
   * 'single' (absent) = one turbocharger; 'parallel-twin' = one turbocharger per bank, both feeding
   * the same plenum (Chapter 3 V6 biturbo). Every value above is then per rotor: the exhaust flow
   * of one bank drives one rotor, so the same flow fraction spools a smaller (lower inertia) rotor faster.
   */
  layout: z.enum(['single', 'parallel-twin']).optional(),
});
export type TurboConfig = z.infer<typeof TurboSchema>;

export const EngineSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(64),
    architecture: ArchitectureSchema,
    cylinders: z.number().int().min(1).max(16),
    bankAngleDeg: finite(0, 180),
    crankType: z.enum(['inline', 'crossplane', 'flatplane', 'even-fire', 'split-pin']),
    /** Firing order expressed as 1-based cylinder numbers (display only; the angles drive the model). */
    firingOrder: z.array(z.number().int().min(1).max(16)),
    /** Firing angle of every cylinder (index = cylinder number - 1) within the 720° cycle. */
    firingAnglesDeg: z.array(finite(0, 719.999)),
    /** Bank of every cylinder (0 = left/near, 1 = right/far). */
    bankOfCylinder: z.array(z.number().int().min(0).max(1)),
    boreMm: finite(50, 130),
    strokeMm: finite(40, 130),
    rodLengthMm: finite(80, 250),
    compressionRatio: finite(6, 16),
    /** Moment of inertia of crankshaft + flywheel + clutch pressure plate (kg·m²). */
    inertiaKgM2: finite(0.03, 2),
    reciprocatingMassKg: finite(0.2, 2),
    idleRpm: finite(500, 1500),
    redlineRpm: finite(3000, 12000),
    revLimitRpm: finite(3000, 12500),
    /** Duration of the ignition cut once the limiter trips (engine-sim `limiterDuration`). */
    limiterCutTimeS: finite(0.01, 0.5),
    /** Mechanical over-speed limit used to protect downshifts. */
    maxSafeRpm: finite(3000, 13000),
    torqueCurve: TorqueCurveSchema,
    friction: z.object({
      coulombNm: finite(0, 80),
      viscousNmPerRadS: finite(0, 0.2),
      quadraticNmPerRadS2: finite(0, 0.0005),
    }),
    accessoriesNm: finite(0, 30),
    throttle: z.object({
      bodyDiameterMm: finite(30, 120),
      /** Throttle actuator time constant. */
      responseTimeS: finite(0.005, 0.5),
      /** Plate position at idle stop (engine-sim `IdleThrottlePlatePosition`). */
      idlePlatePosition: finite(0.9, 0.999),
      /** Pedal → plate linkage exponent (engine-sim DirectThrottleLinkage `gamma`): opening = pedal^γ. */
      pedalGamma: finite(0.5, 4),
    }),
    intake: z.object({
      manifoldVolumeL: finite(0.5, 20),
      runnerLengthM: finite(0.05, 1),
      runnerDiameterMm: finite(20, 80),
      airboxVolumeL: finite(1, 30),
    }),
    cam: CamProfileSchema,
    /**
     * Two-step cam switching (Honda i-VTEC style): above `switchRpm` (with hysteresis) an oil
     * pressure spool locks the rocker arms onto the high-lift lobes. The WOT torque curve already
     * contains its effect; the acoustics switch the valve events with the spool's actuation time.
     */
    variableCam: z
      .object({
        switchRpm: finite(2000, 10000),
        hysteresisRpm: finite(0, 1000),
        /** Time the hydraulic spool needs to lock/unlock the rocker pins (s). */
        actuationTimeS: finite(0.005, 0.3),
        high: CamProfileSchema,
      })
      .optional(),
    /**
     * Optional breathing restrictions (career parts). Pressure drops grow with the square of the
     * air mass flow (turbulent flow through a filter element / muffler):
     *   Δp = Δp_ref · (ṁ / ṁ_ref)²
     * Without this block the model keeps its original back-pressure law and no filter loss.
     */
    breathing: z
      .object({
        /** Air mass flow at which the reference drops are quoted (kg/s). */
        referenceFlowKgS: finite(0.01, 1),
        /** Air filter + airbox pressure drop at the reference flow (kPa). */
        airFilterDropKPa: finite(0, 15),
        /** Exhaust system back pressure above ambient at the reference flow (kPa). */
        exhaustBackPressureKPa: finite(0, 80),
      })
      .optional(),
    /**
     * Engine family (career workshop compatibility: parts declare the families they fit, so a
     * part of one engine is never installed on another). Absent on the Chapter 1 / sandbox engines.
     */
    family: z.string().min(1).max(32).optional(),
    /** Fuel (display + knock limit of boosted builds). */
    fuel: z.enum(['gasoline', 'ethanol']).optional(),
    /** Metered fuel capacity and commanded mixture for hardware that models fuel delivery. */
    fueling: z.object({
      maxFuelKgS: finite(0.001, 0.5),
      airFuelRatio: finite(5, 20),
    }).optional(),
    cooling: z.object({
      radiatorScale: finite(1, 3),
      oilCoolerScale: finite(1, 3),
      fanFlowScale: finite(1, 3),
    }).optional(),
    combustion: z.object({
      burnDurationDeg: finite(25, 100),
      /** Cycle-to-cycle variation (coefficient of variation of the combustion pressure rise). */
      cycleVariation: finite(0, 0.3),
    }),
    /** Advertised power (cv). Reference for display and tests only – the physics never uses it. */
    ratedPowerCv: finite(10, 3000),
    induction: z.enum(['NA', 'turbo']),
    turbo: TurboSchema.optional(),
    egt: z.object({ idleK: finite(500, 900), maxK: finite(800, 1300) }),
    starter: z.object({ torqueNm: finite(20, 400), speedRpm: finite(100, 400) }),
    idleControl: z.object({
      naturalFrequencyRadS: finite(0.5, 20),
      damping: finite(0.2, 3),
      maxAirFraction: finite(0.005, 0.2),
    }),
  })
  .superRefine((e, ctx) => {
    const n = e.cylinders;
    if (e.firingAnglesDeg.length !== n)
      ctx.addIssue({ code: 'custom', message: `ângulos de ignição: são necessários ${n} valores` });
    if (e.bankOfCylinder.length !== n)
      ctx.addIssue({ code: 'custom', message: `bancada de cada cilindro: são necessários ${n} valores` });
    if (e.firingOrder.length !== n) ctx.addIssue({ code: 'custom', message: `ordem de ignição: são necessários ${n} cilindros` });
    if (new Set(e.firingOrder).size !== e.firingOrder.length)
      ctx.addIssue({ code: 'custom', message: 'ordem de ignição: cilindro repetido' });
    if (e.firingOrder.some((c) => c > n))
      ctx.addIssue({ code: 'custom', message: 'ordem de ignição: cilindro inexistente' });
    if (!(e.revLimitRpm >= e.redlineRpm))
      ctx.addIssue({ code: 'custom', message: 'o limitador deve ser maior ou igual à faixa vermelha' });
    if (!(e.maxSafeRpm >= e.revLimitRpm))
      ctx.addIssue({ code: 'custom', message: 'a rotação máxima mecânica deve ser maior ou igual ao limitador' });
    if (!(e.idleRpm < e.redlineRpm * 0.5))
      ctx.addIssue({ code: 'custom', message: 'a marcha lenta deve ser menor que metade da faixa vermelha' });
    if (e.rodLengthMm < e.strokeMm * 1.3)
      ctx.addIssue({ code: 'custom', message: 'a biela deve ter pelo menos 1,3× o curso (geometria biela-manivela)' });
    if (e.induction === 'turbo' && !e.turbo)
      ctx.addIssue({ code: 'custom', message: 'motores turbo precisam da configuração do turbo' });
    const last = e.torqueCurve.rpm[e.torqueCurve.rpm.length - 1] ?? 0;
    if (last < e.revLimitRpm)
      ctx.addIssue({ code: 'custom', message: 'a curva de torque deve cobrir a rotação do limitador' });
    if (!(e.cam.evcDeg > e.cam.ivoDeg - 80 && e.cam.ivoDeg < e.cam.evcDeg + 60))
      ctx.addIssue({ code: 'custom', message: 'cruzamento de válvulas implausível' });
  });
export type EngineConfig = z.infer<typeof EngineSchema>;

export const ShiftSchema = z.object({
  torqueCutTimeS: finite(0.005, 0.3),
  clutchDisengageTimeS: finite(0.005, 0.3),
  gearChangeTimeS: finite(0.01, 0.5),
  clutchEngageTimeS: finite(0.02, 1),
  /**
   * Upshift: longest time the engine is left to fall freely (closed throttle, spark cut) before the
   * clutch re-engages and synchronizes the remaining speed difference by slipping.
   */
  upshiftFreeFallMaxS: finite(0, 0.5),
  revMatch: z.object({
    enabled: z.boolean(),
    /** Proportional gain of the throttle blip controller (throttle per 1000 rpm of error). */
    gain: finite(0, 5),
    toleranceRpm: finite(20, 1500),
    maxBlipThrottle: finite(0, 1),
    timeoutS: finite(0.05, 1.5),
    /** Prediction horizon of the blip controller (≈ throttle + manifold lag). */
    leadTimeS: finite(0, 0.3),
  }),
  /** Policy when a downshift would exceed the mechanical limit. */
  overRevProtection: z.enum(['block', 'wait']),
  /** Downshift target limit as fraction of the rev limiter. */
  maxDownshiftRpmFraction: finite(0.6, 1),
});
export type ShiftConfig = z.infer<typeof ShiftSchema>;

/** Hydrodynamic torque converter (automatic transmissions). */
export const TorqueConverterSchema = z.object({
  /**
   * Capacity (K) factor at stall in rpm/√(N·m): impeller torque at stall = (n_impeller/K)².
   * The coupling law used is T_i = (n_i² − n_t²)/K² (fluid coupling shape, zero at speed ratio 1).
   */
  kFactor: finite(60, 320),
  /** Torque ratio (turbine/impeller) at stall; falls linearly to 1 at the coupling point. */
  stallTorqueRatio: finite(1, 3),
  /** Speed ratio (turbine/impeller) of the coupling point. */
  couplingSpeedRatio: finite(0.5, 0.95),
  /** Turbine + gearbox input member inertia (kg·m²). */
  turbineInertiaKgM2: finite(0.01, 0.5),
  lockup: z.object({
    maxTorqueNm: finite(100, 3000),
    /** Lowest gear in which the lock-up clutch may close. */
    minGear: z.number().int().min(1).max(9),
    engageRatePerS: finite(0.5, 30),
    /** Turbine speed below which the lock-up clutch opens. */
    minTurbineRpm: finite(600, 4000),
  }),
});
export type TorqueConverterConfig = z.infer<typeof TorqueConverterSchema>;

/** Clutch-to-clutch power shifts (dual-clutch gearboxes and planetary automatics). */
export const PowershiftSchema = z.object({
  /** Torque phase: the oncoming element takes the torque while the offgoing one releases. */
  torquePhaseS: finite(0.01, 0.6),
  /** Longest inertia phase (oncoming element slipping until the input speed is synchronized). */
  inertiaPhaseMaxS: finite(0.02, 1),
  /** Engine torque reduction requested by the gearbox during the inertia phase (fraction of combustion events). */
  torqueReduction: finite(0, 0.9),
  /** Capacity of the oncoming element during the inertia phase (fraction of its maximum). */
  inertiaCapacity: finite(0.2, 1),
  /** Downshift: release time of the offgoing element before the rev rise. */
  downshiftReleaseS: finite(0.01, 0.5),
  /** Dual-clutch only: next gear is preselected on the idle shaft (no dog change during the shift). */
  preselect: z.boolean(),
});
export type PowershiftConfig = z.infer<typeof PowershiftSchema>;

/** Shift schedule of the automatic modes (D). */
export const AutoShiftSchema = z.object({
  /** Upshift speed at full throttle as fraction of the rev limiter. */
  wotUpshiftFraction: finite(0.6, 1),
  /** Upshift speed at light throttle (rpm). */
  lightUpshiftRpm: finite(1200, 5000),
  /** Pedal above which kickdown is allowed. */
  kickdownPedal: finite(0.5, 1),
  /** Kickdown when the engine is below this speed and the lower gear fits under 85 % of the limiter (rpm). */
  kickdownRpm: finite(1000, 6000),
  /** Coast downshift speed (rpm). */
  coastDownshiftRpm: finite(700, 3000),
});
export type AutoShiftConfig = z.infer<typeof AutoShiftSchema>;

export const TransmissionKindSchema = z.enum(['manual', 'torque-converter-auto', 'dual-clutch']);
export type TransmissionKind = z.infer<typeof TransmissionKindSchema>;

export const TransmissionSchema = z.object({
  /** Absent = 'manual' (sequential assisted shift + automatic clutch, the original model). */
  kind: TransmissionKindSchema.optional(),
  gearRatios: z.array(finite(0.4, 6)).min(4).max(9),
  finalDrive: finite(1.5, 6.5),
  efficiency: finite(0.7, 0.99),
  inputInertiaKgM2: finite(0.001, 0.2),
  outputInertiaKgM2: finite(0.001, 0.5),
  clutch: z.object({
    maxTorqueNm: finite(100, 4000),
    /** Maximum engagement rate (fraction of capacity per second) – "velocidade de acoplamento". */
    engageRatePerS: finite(0.5, 50),
    /** Engine speed held by the automatic clutch while slipping at launch. */
    launchRpm: finite(1000, 9000),
    /** Engine speed below which the anti-stall logic opens the clutch. */
    antiStallRpm: finite(300, 2000),
  }),
  shift: ShiftSchema,
  /**
   * The player does every shift (E/Q): the D schedule is off. Set by an upgraded automatic / dual-clutch
   * box (the Workshop's "câmbio melhorado"): the box keeps its power shifts, its launch and its gains.
   */
  playerShifts: z.boolean().optional(),
  torqueConverter: TorqueConverterSchema.optional(),
  powershift: PowershiftSchema.optional(),
  autoShift: AutoShiftSchema.optional(),
});
export type TransmissionConfig = z.infer<typeof TransmissionSchema>;

export const TireSchema = z.object({
  radiusM: finite(0.2, 0.5),
  wheelInertiaKgM2: finite(0.3, 5),
  /** Peak friction coefficient on the reference surface (Magic Formula D/N). */
  muPeak: finite(0.5, 2.5),
  /** Magic Formula stiffness/shape/curvature factors (longitudinal). */
  B: finite(4, 25),
  C: finite(1.1, 2),
  E: finite(-2, 1),
  rollingResistance: finite(0.005, 0.05),
  /** Temperature with the highest grip and the grip loss per °C away from it. */
  optimalTempC: finite(0, 120),
  tempSensitivityPerC: finite(0, 0.01),
});
export type TireConfig = z.infer<typeof TireSchema>;

export const ExhaustSchema = z.object({
  presetId: z.enum(['stock', 'sport', 'straight', 'custom']),
  layout: z.enum(['single', 'dual']),
  headerPrimaryLengthM: finite(0.15, 2),
  headerDiameterMm: finite(25, 70),
  collectorLengthM: finite(0.1, 3),
  collectorDiameterMm: finite(35, 110),
  mufflerChambersM: z.array(finite(0.03, 0.8)).max(6),
  /** Fraction of acoustic energy absorbed by the muffler packing per pass (engine-sound-generator `action`). */
  mufflerAbsorption: finite(0, 0.98),
  resonatorLengthM: finite(0, 1),
  tailpipeLengthM: finite(0.05, 1.5),
  tailpipeDiameterMm: finite(35, 120),
  /** Wall/viscous attenuation in dB per meter, applied as a damping low-pass in the loop. */
  wallLossDbPerM: finite(0, 12),
  /** Fraction of the exhaust gas temperature rise kept at the tail (gas cools along the pipe). */
  tailTempFraction: finite(0.2, 1),
  outputGain: finite(0, 2),
});
export type ExhaustConfig = z.infer<typeof ExhaustSchema>;

export const AcousticSchema = z.object({
  intakeGain: finite(0, 2),
  blockGain: finite(0, 2),
  exhaustGain: finite(0, 2),
  turboGain: finite(0, 2),
  tireGain: finite(0, 2),
  transmissionGain: finite(0, 2),
  environmentGain: finite(0, 2),
  /** Straight-cut gear teeth for whine (first gear / reverse style gears). */
  gearTeeth: z.number().int().min(8).max(60),
  mechanicalNoise: finite(0, 2),
});
export type AcousticConfig = z.infer<typeof AcousticSchema>;

export const BodyStyleSchema = z.enum([
  'hatch',
  'hotHatch',
  'coupe',
  'sedan',
  'muscle',
  'supercar',
  'prototype',
  'golGts88',
  'unoMille95',
  'chevetteSl88',
  'celta03',
  'corsaGl96',
  'kadettSl92',
  'saveiroGl94',
  'astra11',
  'peugeot208Gt17',
  'golfGtiMk4',
  'audiA3_8l',
  'bmw320iF30',
  'mercedesC200W205',
  'civicSi08',
  'jettaTsi12',
  'lancerEvoX',
  'bmw335iF30',
  // chapter 3
  'nissan350z',
  'lexusIs350',
  'nissan370z',
  'amgC43',
  'kiaStingerGt',
  'maseratiGhibli',
  'alfaGiuliaQv',
  'nissanGtrR35',
]);
export type BodyStyle = z.infer<typeof BodyStyleSchema>;

export const VisualSchema = z.object({
  bodyStyle: BodyStyleSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  lengthM: finite(3, 5.5),
  heightM: finite(1, 1.6),
  frontOverhangM: finite(0.5, 1.3),
  rideHeightM: finite(0.08, 0.25),
  /** Parts that show on the body (career builds). Absent on catalogue cars. */
  mods: z
    .object({
      intercooler: z.boolean(),
      sportTip: z.boolean(),
      /** Tyre sidewall lettering / tread of performance tyres. */
      tyre: z.enum(['stock', 'sport', 'semiSlick', 'slick']),
    })
    .optional(),
});
export type VisualConfig = z.infer<typeof VisualSchema>;

export const CarSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(64),
    description: z.string().max(400),
    massKg: finite(500, 3000),
    wheelbaseM: finite(1.8, 3.5),
    cgHeightM: finite(0.25, 0.8),
    frontWeightFraction: finite(0.3, 0.7),
    drivenAxle: z.enum(['rear', 'front', 'awd']),
    /**
     * Four-wheel drive: open centre differential (fixed static split) + a bounded centre coupling
     * (multi-plate / active centre differential) that transfers up to `centerCouplingNm` between
     * the axles when their speeds differ. Required when drivenAxle = 'awd'.
     */
    awd: z
      .object({
        frontTorqueFraction: finite(0.2, 0.8),
        centerCouplingNm: finite(0, 4000),
        /** Efficiency of the transfer case + extra differential, multiplies the gearbox efficiency. */
        transferEfficiency: finite(0.8, 1),
      })
      .optional(),
    dragCoefficient: finite(0.2, 0.6),
    frontalAreaM2: finite(1.4, 3),
    brakeTorqueNm: finite(500, 8000),
    engine: EngineSchema,
    transmission: TransmissionSchema,
    tires: TireSchema,
    exhaust: ExhaustSchema,
    acoustic: AcousticSchema,
    visual: VisualSchema,
  })
  .superRefine((c, ctx) => {
    if (c.visual.frontOverhangM + c.wheelbaseM > c.visual.lengthM - 0.4) {
      ctx.addIssue({ code: 'custom', message: 'entre-eixos + balanço dianteiro deve caber no comprimento da carroceria' });
    }
    if (c.drivenAxle === 'awd' && !c.awd) ctx.addIssue({ code: 'custom', message: 'tração integral precisa da configuração do diferencial central' });
    const k = c.transmission.kind ?? 'manual';
    if (k === 'torque-converter-auto' && !c.transmission.torqueConverter)
      ctx.addIssue({ code: 'custom', message: 'câmbio automático precisa do conversor de torque' });
    if (k !== 'manual' && (!c.transmission.powershift || !c.transmission.autoShift))
      ctx.addIssue({ code: 'custom', message: 'câmbio automático/dupla embreagem precisa da estratégia de troca' });
    if (c.cgHeightM > c.wheelbaseM * 0.35) {
      ctx.addIssue({ code: 'custom', message: 'centro de gravidade alto demais para o entre-eixos' });
    }
  });
export type CarConfig = z.infer<typeof CarSchema>;

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  theme: z.enum(['testTrack', 'desert', 'nightIndustrial', 'airfield', 'distritoIndustrial', 'baixada', 'avenidaNorte', 'patioDasTorres', 'distritoFinanceiro', 'corredorDaLiga', 'marginalAlta', 'hangarExecutivo', 'pierElite']),
  surfaceGrip: finite(0.5, 1.3),
  rollingResistanceFactor: finite(0.5, 2),
  surfaceTempC: finite(-10, 70),
  ambientTempC: finite(-20, 50),
  ambientPressurePa: finite(70000, 108000),
  /** Wind speed along the track (positive = tail wind). */
  windMs: finite(-20, 20),
  gradePercent: finite(-5, 5),
  /** Track length available, including the shutdown area after the finish line. */
  lengthM: finite(400, 3000),
});
export type TrackConfig = z.infer<typeof TrackSchema>;

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

export function validateCar(input: unknown): ValidationResult<CarConfig> {
  const r = CarSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data, errors: [] };
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

export function validateTrack(input: unknown): ValidationResult<TrackConfig> {
  const r = TrackSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data, errors: [] };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
