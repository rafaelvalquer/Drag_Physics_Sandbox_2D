import { ENGINE_VW_AP18S_1988 } from '../engines/vwAp18s1988';
import type { AcousticConfig, CarConfig, ExhaustConfig, TransmissionConfig } from '../schema';

/**
 * Volkswagen Gol GTS, model-year 1988 — first generation ("Gol quadrado"), two-door hatch,
 * AP 1.8S on hydrated ethanol, five-speed gearbox, front-wheel drive. Original factory spec.
 *
 * Primary source: owner's manual "Manual do proprietário VW Gol GTS 1988", pp. 47–51
 * (Características gerais — descrição técnica e dados técnicos).
 * Every number used by the simulation carries its provenance in GOL_GTS_1988_PROVENANCE.
 */

export type Provenance = 'factory' | 'secondary' | 'derived' | 'estimated' | 'calibrated';

/** Factory data quoted from the owner's manual (pages in the manual's own numbering). */
export const GOL_GTS_1988_FACTORY = {
  source: 'Manual do proprietário VW Gol GTS 1988, pp. 47–51',
  engine: {
    layout: '4 cilindros em linha, 4 tempos, dianteiro longitudinal, comando no cabeçote por correia dentada',
    displacementCm3: 1781,
    boreMm: 81.0,
    strokeMm: 86.4,
    compressionRatio: 12.3,
    fuel: 'etanol hidratado',
    firingOrder: [1, 3, 4, 2],
    powerNbr5484: { kw: 73, cv: 99, rpm: 5600 },
    powerSaeJ1349: { kw: 71, hp: 96, rpm: 5600 },
    torqueNbr5484: { nm: 146, rpm: 3200 },
    torqueSaeJ1349: { lbft: 106, rpm: 3200 },
    carburettor: 'corpo duplo, 2 estágios progressivos',
    ignition: 'distribuidor com ignição eletrônica transistorizada, sensor indutivo, avanço centrífugo e a vácuo',
    sparkPlugs: 'Bosch W6D / NGK BP6ES, M14 × 1,25',
    starterKw: 0.95,
  },
  transmission: {
    gearRatios: [3.45, 1.94, 1.29, 0.97, 0.8],
    reverse: 3.17,
    finalDrive: 4.11,
    type: 'manual, 5 marchas sincronizadas, alavanca no assoalho',
    clutch: 'monodisco a seco, platô com mola tipo membrana',
    drive: 'dianteira, semiárvores com juntas homocinéticas',
  },
  chassis: {
    brakes: 'hidráulico com servo, disco na dianteira e tambor na traseira, circuito em diagonal',
    steering: 'mecânica, pinhão e cremalheira (sem assistência)',
  },
  wheels: { rim: '6J × 14H2 (liga leve)', tyres: 'Firestone S660 ou Pirelli P6 (medida não informada no manual)' },
  dimensions: {
    wheelbaseMm: 2358,
    trackFrontMm: 1364,
    trackRearMm: 1384,
    lengthMm: 3849,
    widthMm: 1601,
    heightMm: 1350,
    groundClearanceFullLoadMm: 130,
  },
  weights: { tareKg: 930, payloadKg: 390, grossKg: 1320, maxAxleFrontKg: 700, maxAxleRearKg: 620 },
  performance: {
    topSpeedKmh: 180,
    topSpeedRpm: 5588,
    accel0to80S: 6.5,
    accel0to100S: 9.7,
    accel0to120S: 13.8,
    accel0to400mS: 17.0,
    accel0to1000mS: 31.8,
    gradeabilityHalfLoadPct: [41.0, 32.0, 19.6, 13.4, 10.1],
  },
} as const;

/** Secondary sources (period press, enthusiast technical sheets). Not confirmed by the manual. */
export const GOL_GTS_1988_SECONDARY = {
  tyres: '185/60 R14 (fichacompleta.com.br)',
  dragCoefficient: 0.43,
  frontalAreaM2: 1.87,
  carburettor: 'Brosol 2E (FlatOut)',
  camshaft: '49G, tuchos mecânicos (FlatOut)',
  idleRpm: '950–1060 rpm (literatura de reparação do AP a etanol)',
  disagreements: [
    'Torque de 14,9 kgfm a 3600 rpm em fontes secundárias; o manual de 1988 informa 146 N·m a 3200 rpm (usado).',
    '0–100 km/h em 10,8–11 s em testes de imprensa; o manual declara 9,7 s (meta usada).',
  ],
} as const;

/** Operating mass = tare (factory) + driver + fuel, kept separate as the brief requires. */
export const GOL_GTS_1988_MASS = {
  tareKg: GOL_GTS_1988_FACTORY.weights.tareKg,
  driverKg: 75, // estimated: one occupant
  fuelKg: 22, // estimated: ≈ 28 L of ethanol (half of the 55 L tank), assumed not included in the tare
} as const;

/**
 * Dynamic rolling radius derived from the factory top speed: 180 km/h at 5588 rpm in 5th gear
 *   r = v / ω_wheel = 50 m/s ÷ (5588 rpm / (0.80 × 4.11) · 2π/60) = 0.281 m
 * (the nominal 185/60 R14 radius is 0.289 m: 178 mm rim + 111 mm sidewall).
 */
export const GOL_GTS_1988_ROLLING_RADIUS_M =
  Math.round(((180 / 3.6) / ((5588 / (0.8 * 4.11)) * ((2 * Math.PI) / 60))) * 1000) / 1000;

/** Transmission `vw-gol-gts-1988-5mt` (ratios: factory; timings: gameplay assistance). */
export const VW_GOL_GTS_1988_5MT: TransmissionConfig = {
  gearRatios: [...GOL_GTS_1988_FACTORY.transmission.gearRatios],
  finalDrive: GOL_GTS_1988_FACTORY.transmission.finalDrive,
  efficiency: 0.93, // calibrated: longitudinal FWD transaxle with helical gears
  inputInertiaKgM2: 0.008, // estimated
  outputInertiaKgM2: 0.011, // estimated: differential + half shafts
  clutch: {
    maxTorqueNm: 240, // estimated: single dry plate ≈ 1.6 × peak engine torque
    engageRatePerS: 4.5, // calibrated (automatic clutch of the game)
    launchRpm: 3400, // calibrated (automatic clutch of the game)
    antiStallRpm: 1050, // calibrated
  },
  // The real car has a manual gearbox with a pedal clutch. In the game the automatic clutch and
  // these shift phases are a driving aid: they are calibrated, not a characteristic of the car.
  shift: {
    torqueCutTimeS: 0.04,
    upshiftFreeFallMaxS: 0.05,
    clutchDisengageTimeS: 0.04,
    gearChangeTimeS: 0.09,
    clutchEngageTimeS: 0.13,
    revMatch: { enabled: true, gain: 1.3, toleranceRpm: 250, maxBlipThrottle: 0.55, timeoutS: 0.4, leadTimeS: 0.16 },
    overRevProtection: 'block',
    maxDownshiftRpmFraction: 0.97,
  },
};

/**
 * Exhaust of the acoustic preset `vw-ap18s-stock-exhaust`: original single system, cast-iron
 * 4-into-1 manifold, front pipe, two mufflers. No measured geometry was available: lengths,
 * diameters, chambers and losses are calibrated by ear and against the other presets, NOT
 * official measurements.
 */
export const VW_AP18S_STOCK_EXHAUST: ExhaustConfig = {
  presetId: 'stock',
  layout: 'single',
  headerPrimaryLengthM: 0.32,
  headerDiameterMm: 34,
  collectorLengthM: 1.9,
  collectorDiameterMm: 45,
  mufflerChambersM: [0.12, 0.2, 0.28],
  mufflerAbsorption: 0.6,
  resonatorLengthM: 0.38,
  tailpipeLengthM: 0.45,
  // 48 mm (≈ 1⅞"): a narrower pipe raises the jet velocity and the broadband turbulent noise
  // (∝ v⁴) above the pulse train; at 45 mm the firing harmonics fell below 90 % of the energy.
  tailpipeDiameterMm: 48,
  wallLossDbPerM: 3.5,
  tailTempFraction: 0.45,
  outputGain: 0.72,
};

/** Channel balance of the preset `vw-ap18s-stock-exhaust` (calibrated). No turbo channel. */
export const VW_AP18S_STOCK_ACOUSTIC: AcousticConfig = {
  intakeGain: 0.85, // two-barrel carburettor induction roar at full throttle
  blockGain: 0.62,
  exhaustGain: 0.95,
  turboGain: 0, // naturally aspirated: no turbo, no blow-off valve
  tireGain: 0.8,
  transmissionGain: 0.45,
  environmentGain: 0.5,
  gearTeeth: 17,
  mechanicalNoise: 0.75, // mechanical tappets: audible valve train
};

export const CAR_VW_GOL_GTS_1988: CarConfig = {
  schemaVersion: 1,
  id: 'vw-gol-gts-1988',
  name: 'Volkswagen Gol GTS 1988 — AP 1.8S Original',
  description:
    'AP 1.8S original a etanol (99 cv, 146 N·m), câmbio de 5 marchas e tração dianteira. Gol "quadrado" de fábrica, com os dados do manual de 1988.',
  massKg: GOL_GTS_1988_MASS.tareKg + GOL_GTS_1988_MASS.driverKg + GOL_GTS_1988_MASS.fuelKg,
  wheelbaseM: GOL_GTS_1988_FACTORY.dimensions.wheelbaseMm / 1000,
  cgHeightM: 0.5, // estimated
  frontWeightFraction: 0.61, // estimated (NOT the admissible axle loads 700/620 kg): engine ahead of the axle, driver aboard
  drivenAxle: 'front',
  dragCoefficient: GOL_GTS_1988_SECONDARY.dragCoefficient, // secondary, consistent with 180 km/h
  frontalAreaM2: GOL_GTS_1988_SECONDARY.frontalAreaM2, // secondary
  brakeTorqueNm: 2800, // estimated: front discs, rear drums
  engine: ENGINE_VW_AP18S_1988,
  transmission: VW_GOL_GTS_1988_5MT,
  tires: {
    radiusM: GOL_GTS_1988_ROLLING_RADIUS_M, // derived from the factory top speed (0.281 m)
    wheelInertiaKgM2: 0.62, // estimated: 6J × 14 alloy + 185/60 R14 tyre
    muPeak: 1.05, // calibrated: period street radial on a dry, warm test surface
    B: 12,
    C: 1.45,
    E: 0.4,
    rollingResistance: 0.012, // estimated
    optimalTempC: 65,
    tempSensitivityPerC: 0.0018,
  },
  exhaust: VW_AP18S_STOCK_EXHAUST,
  acoustic: VW_AP18S_STOCK_ACOUSTIC,
  visual: {
    bodyStyle: 'golGts88',
    color: '#b5141c',
    accent: '#d8262a',
    lengthM: GOL_GTS_1988_FACTORY.dimensions.lengthMm / 1000,
    heightM: GOL_GTS_1988_FACTORY.dimensions.heightMm / 1000,
    frontOverhangM: 0.8, // estimated from photographs (longitudinal engine ahead of the axle)
    rideHeightM: 0.15, // derived: 130 mm clearance at full load (factory) → ≈ 150 mm unladen
  },
};

/** Provenance of every configuration value of the Gol (path in the CarConfig → source). */
export const GOL_GTS_1988_PROVENANCE: Record<string, Provenance> = {
  massKg: 'derived', // tare (factory) + driver + fuel (estimated)
  wheelbaseM: 'factory',
  cgHeightM: 'estimated',
  frontWeightFraction: 'estimated',
  drivenAxle: 'factory',
  dragCoefficient: 'secondary',
  frontalAreaM2: 'secondary',
  brakeTorqueNm: 'estimated',
  'engine.architecture': 'factory',
  'engine.firingOrder': 'factory',
  'engine.firingAnglesDeg': 'derived',
  'engine.boreMm': 'factory',
  'engine.strokeMm': 'factory',
  'engine.rodLengthMm': 'estimated',
  'engine.compressionRatio': 'factory',
  'engine.inertiaKgM2': 'estimated',
  'engine.reciprocatingMassKg': 'estimated',
  'engine.idleRpm': 'secondary',
  'engine.redlineRpm': 'estimated',
  'engine.revLimitRpm': 'calibrated',
  'engine.maxSafeRpm': 'calibrated',
  'engine.limiterCutTimeS': 'calibrated',
  'engine.torqueCurve@3200': 'factory',
  'engine.torqueCurve@5600': 'factory',
  'engine.torqueCurve(other points)': 'calibrated',
  'engine.ratedPowerCv': 'factory',
  'engine.friction': 'estimated',
  'engine.accessoriesNm': 'estimated',
  'engine.throttle.bodyDiameterMm': 'estimated',
  'engine.throttle.responseTimeS': 'estimated',
  'engine.throttle.pedalGamma': 'calibrated',
  'engine.intake': 'estimated',
  'engine.cam': 'estimated',
  'engine.combustion': 'estimated',
  'engine.induction': 'factory',
  'engine.egt': 'estimated',
  'engine.starter': 'derived',
  'engine.idleControl': 'calibrated',
  'transmission.gearRatios': 'factory',
  'transmission.finalDrive': 'factory',
  'transmission.efficiency': 'calibrated',
  'transmission.inputInertiaKgM2': 'estimated',
  'transmission.outputInertiaKgM2': 'estimated',
  'transmission.clutch.maxTorqueNm': 'estimated',
  'transmission.clutch (automatic: rate, launch, anti-stall)': 'calibrated',
  'transmission.shift': 'calibrated',
  'tires.radiusM': 'derived',
  'tires.wheelInertiaKgM2': 'estimated',
  'tires.muPeak/B/C/E': 'calibrated',
  'tires.rollingResistance': 'estimated',
  'tires.temperature': 'estimated',
  exhaust: 'calibrated',
  acoustic: 'calibrated',
  'visual.lengthM': 'factory',
  'visual.heightM': 'factory',
  'visual.frontOverhangM': 'estimated',
  'visual.rideHeightM': 'derived',
};
