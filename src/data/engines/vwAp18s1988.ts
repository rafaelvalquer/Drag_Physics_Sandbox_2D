import type { EngineConfig } from '../schema';
import { firingAngles, fmepFriction } from './builders';

/**
 * Volkswagen AP 1.8S, ethanol, as fitted to the Gol GTS model-year 1988 (original, unmodified).
 *
 * Provenance of every value (see docs/vehicles/vw-gol-gts-1988.md for the full table):
 * - factory:    owner's manual "Gol GTS 1988", pp. 47–48 (Características gerais).
 * - secondary:  period/enthusiast sources (Brosol 2E carburettor, 49G camshaft, idle range).
 * - derived:    computed from factory data (firing angles, displacement, starter torque).
 * - estimated:  plausible engineering value, not documented for this engine.
 * - calibrated: adjusted so the simulation reproduces the documented behaviour.
 *
 * The torque curve passes exactly through the two documented points (146 N·m @ 3200 rpm and
 * 99 cv @ 5600 rpm, NBR 5484). The points between them are calibrated, not documented.
 */
export const VW_AP18S_1988_TORQUE_CURVE = {
  // rpm:      500  1000  1500  2000  2500  3200  3800  4400  5000  5600  6000  6500  7000
  rpm: [500, 1000, 1500, 2000, 2500, 3200, 3800, 4400, 5000, 5600, 6000, 6500, 7000],
  torqueNm: [82, 110, 123, 133, 141, 146, 145, 141.2, 134.1, 124.2, 113.4, 101.5, 86],
} as const;

export const ENGINE_VW_AP18S_1988: EngineConfig = {
  id: 'vw-ap-18s-1988-ethanol',
  name: 'VW AP 1.8S a etanol (1988)',
  architecture: 'I4', // factory: 4 cylinders in line, longitudinal
  cylinders: 4,
  bankAngleDeg: 0,
  crankType: 'inline',
  firingOrder: [1, 3, 4, 2], // factory
  firingAnglesDeg: firingAngles([1, 3, 4, 2], 180), // derived: 0° / 180° / 360° / 540°
  bankOfCylinder: [0, 0, 0, 0],
  boreMm: 81.0, // factory
  strokeMm: 86.4, // factory → 1781 cm³
  rodLengthMm: 144, // estimated
  compressionRatio: 12.3, // factory (ethanol)
  inertiaKgM2: 0.13, // estimated: crank + flywheel + 210 mm clutch
  reciprocatingMassKg: 0.55, // estimated
  idleRpm: 1000, // secondary: 950–1060 rpm for the ethanol AP; calibrated inside that range
  // No electronic rev limiter is documented for the 1988 AP 1.8S (carburettor, Hall distributor).
  // The values below are SIMULATION protection limits, not factory data.
  redlineRpm: 6200, // estimated (tachometer warning zone)
  revLimitRpm: 6500, // simulation safety limit
  limiterCutTimeS: 0.08,
  maxSafeRpm: 6800, // simulation: downshift over-rev protection
  torqueCurve: {
    rpm: [...VW_AP18S_1988_TORQUE_CURVE.rpm],
    torqueNm: [...VW_AP18S_1988_TORQUE_CURVE.torqueNm],
  },
  ratedPowerCv: 99, // factory: 73 kW (99 cv) @ 5600 rpm, NBR 5484
  friction: fmepFriction(81, 86.4, 4), // estimated: FMEP correlation, mechanical tappets
  accessoriesNm: 2.0, // estimated: water pump, 45 A alternator, mechanical fuel pump (no power steering)
  throttle: {
    // secondary: Brosol 2E two-stage progressive carburettor. One equivalent throttle of the same
    // total area (estimated); the progressive second stage is approximated by the pedal exponent.
    bodyDiameterMm: 47,
    responseTimeS: 0.06, // estimated: mechanical linkage + carburettor
    idlePlatePosition: 0.998,
    pedalGamma: 2.4, // calibrated: second barrel opens late in the pedal travel
  },
  intake: { manifoldVolumeL: 1.8, runnerLengthM: 0.22, runnerDiameterMm: 32, airboxVolumeL: 5.5 }, // estimated
  // secondary: camshaft "49G" with mechanical tappets; valve events estimated (not documented)
  cam: { evoDeg: 130, evcDeg: 372, ivoDeg: 348, ivcDeg: 594, intakeLiftMm: 10.5, exhaustLiftMm: 10 },
  combustion: { burnDurationDeg: 56, cycleVariation: 0.06 }, // estimated: Heron chamber, carburettor
  induction: 'NA', // factory: naturally aspirated
  egt: { idleK: 640, maxK: 1080 }, // estimated: ethanol runs cooler than petrol
  starter: { torqueNm: 38, speedRpm: 250 }, // derived: 38 N·m × 250 rpm ≈ 0.99 kW (factory starter: 0.95 kW)
  // The model's idle air controller stands in for the mechanical idle setting (idle screw and
  // automatic choke): low authority and slow response, unlike an electronic idle valve.
  idleControl: { naturalFrequencyRadS: 2.2, damping: 1, maxAirFraction: 0.04 },
};
