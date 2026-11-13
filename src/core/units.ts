/**
 * Unit conversions. The whole simulation runs in SI units internally:
 * meters, kilograms, seconds, radians, newtons, newton-meters, pascals, kelvin.
 * Conversions to RPM, km/h, cv (metric horsepower), bar etc. happen only at UI boundaries.
 */

export const TWO_PI = Math.PI * 2;
export const FOUR_PI = Math.PI * 4;

/** Metric horsepower (cavalo-vapor) in watts. */
export const WATTS_PER_CV = 735.49875;
export const STANDARD_GRAVITY = 9.80665;
/** Standard ambient temperature used for engine curve reference conditions (25 °C). */
export const STANDARD_TEMPERATURE_K = 298.15;
export const ATMOSPHERIC_PRESSURE = 101325; // Pa
/** Universal gas constant J/(mol K) (same constant used in engine-sim `constants::R`). */
export const R_UNIVERSAL = 8.31446261815324;
/** Molar mass of dry air kg/mol (engine-sim `units::AirMolecularMass`). */
export const AIR_MOLAR_MASS = 0.0289647;
/** Specific gas constant of dry air J/(kg K). */
export const R_AIR = R_UNIVERSAL / AIR_MOLAR_MASS;

export const METERS_PER_MILE = 1609.344;
export const METERS_PER_FOOT = 0.3048;

export const rpmToRadS = (rpm: number): number => (rpm * TWO_PI) / 60;
export const radSToRpm = (w: number): number => (w * 60) / TWO_PI;
export const msToKmh = (v: number): number => v * 3.6;
export const kmhToMs = (v: number): number => v / 3.6;
export const msToMph = (v: number): number => v * 2.2369362920544;
export const wattsToCv = (w: number): number => w / WATTS_PER_CV;
export const cvToWatts = (cv: number): number => cv * WATTS_PER_CV;
export const paToBar = (pa: number): number => pa / 1e5;
export const barToPa = (bar: number): number => bar * 1e5;
export const celsiusToKelvin = (c: number): number => c + 273.15;
export const kelvinToCelsius = (k: number): number => k - 273.15;
export const degToRad = (d: number): number => (d * Math.PI) / 180;
export const radToDeg = (r: number): number => (r * 180) / Math.PI;
export const litersToM3 = (l: number): number => l / 1000;
export const m3ToLiters = (m3: number): number => m3 * 1000;

/** Mechanical power from torque and angular speed: P(W) = T(N·m) · ω(rad/s). */
export const powerW = (torqueNm: number, omegaRadS: number): number => torqueNm * omegaRadS;

/**
 * Air density from the ideal gas law, ρ = p·M/(R·T).
 * Port of the expression used in engine-sim `VehicleDragConstraint::calculate`
 * (AirMolecularMass · 1 atm / (R · 25 °C)), generalized for pressure and temperature.
 */
export const airDensity = (pressurePa: number, temperatureK: number): number =>
  (pressurePa * AIR_MOLAR_MASS) / (R_UNIVERSAL * temperatureK);

/** Speed of sound in an ideal gas c = sqrt(γ·R·T). */
export const speedOfSound = (temperatureK: number, gamma = 1.4, rSpecific = R_AIR): number =>
  Math.sqrt(gamma * rSpecific * temperatureK);

export const DISTANCES = {
  eighthMile: METERS_PER_MILE / 8, // 201.168 m
  quarterMile: METERS_PER_MILE / 4, // 402.336 m
  oneKm: 1000,
  sixtyFeet: 60 * METERS_PER_FOOT, // 18.288 m
  threeThirtyFeet: 330 * METERS_PER_FOOT,
  thousandFeet: 1000 * METERS_PER_FOOT,
} as const;
