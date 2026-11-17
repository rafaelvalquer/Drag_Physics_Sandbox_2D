import type { VehicleDesign, WheelDesign } from './designs';
import type { P } from './svg';

/**
 * Side-view designs of the ten Chapter 2 cars. Original vector artwork built from each car's
 * documented length, height, wheelbase and overhangs (the arches are cut at the real axles) and
 * from the proportions of the body of the chosen generation; no photograph, logo or emblem is
 * embedded — only model lettering.
 *
 * u = 0 rear bumper … 1 nose, v = 0 sill … 1 roof (designs.ts conventions). What each one keeps:
 *  - Astra 2011 (G hatch): rounded "egg" roof, steep but curved hatch, tall tail lamps, smooth
 *    bonnet with a small grille, body-coloured bumpers.
 *  - 208 GT 2017: short and tall, high belt line, glass roof edge ending in a kicked-up rear
 *    quarter, steep hatch with roof spoiler, cat-eye lamp, big lower intake, 17" diamond-cut rims.
 *  - Golf GTI Mk4: the thick sloping C-pillar, arched roof, upright hatch, flush round-edged
 *    headlamp, red-lined grille (accent), 16" multi-spoke.
 *  - A3 8L: lower and longer than the Golf, flatter roof, longer rear overhang, slimmer lamps,
 *    rubbing strip, five-spoke rims.
 *  - C200 W205: long bonnet, cab-backward coupe-like roof that flows into a short high boot,
 *    big grille, swept lamp, 17" five twin-spoke.
 *  - 320i F30: classic three-box with the Hofmeister kink, long bonnet, short front overhang,
 *    lamps reaching the kidney grille, 17" multi-spoke.
 *  - 335i F30 M Sport: same F30 shell, M Sport bumper with three big intakes, side skirts, 19"
 *    double spoke, blue calipers, twin tailpipes.
 *  - Civic Si (8th gen sedan): monovolume-like screen starting far forward, arc roof, short high
 *    boot with a pedestal wing, two-piece tail lamp.
 *  - Jetta 6: straight, crisp three-box: horizontal shoulder, flat roof, upright C-pillar, square
 *    lamps.
 *  - Lancer Evolution X: shark-nose front with a huge trapezoid intake, bonnet vents, fender vent,
 *    big pedestal wing, wide arches, 18" spokes.
 */

const W = (o: Partial<WheelDesign> & Pick<WheelDesign, 'style' | 'count' | 'rim' | 'finish'>): WheelDesign => ({
  caliper: 'grey',
  lettering: 'subtle',
  centreLock: false,
  lugs: 5,
  discDrilled: false,
  rearBrake: 'disc',
  ...o,
});

/** Straight two-point segment. */
const seg = (a: P, b: P): P[] => [a, b];

export const astra11: VehicleDesign = {
  outline: [
    [0.018, 0.05, 1],
    [0.0, 0.16],
    [0.0, 0.4],
    [0.014, 0.58],
    [0.045, 0.74],
    [0.095, 0.865],
    [0.17, 0.95],
    [0.3, 0.995],
    [0.42, 0.99],
    [0.53, 0.94, 1],
    [0.67, 0.66],
    [0.76, 0.615],
    [0.88, 0.555],
    [0.96, 0.49],
    [0.995, 0.4],
    [1.0, 0.22],
    [0.99, 0.07],
    [0.972, 0.03, 1],
  ],
  glass: [
    [
      [0.12, 0.665, 1],
      [0.15, 0.82],
      [0.2, 0.9],
      [0.42, 0.94],
      [0.5, 0.92],
      [0.655, 0.665, 1],
    ],
  ],
  pillars: [
    { u: 0.4, lean: 0, w: 0.06 },
    { u: 0.15, lean: 0.035, w: 0.1 },
  ],
  screens: [seg([0.54, 0.935], [0.668, 0.668]), seg([0.05, 0.76], [0.15, 0.935])],
  shoulder: [
    [0.03, 0.62],
    [0.4, 0.645],
    [0.7, 0.62],
    [0.95, 0.5],
  ],
  creases: [
    [
      [0.18, 0.34],
      [0.52, 0.31],
      [0.82, 0.34],
    ],
  ],
  cuts: [seg([0.668, 0.655], [0.672, 0.04]), seg([0.4, 0.66], [0.392, 0.04]), seg([0.17, 0.655], [0.19, 0.25]), seg([0.06, 0.74], [0.045, 0.38]), seg([0.93, 0.5], [0.94, 0.06])],
  handles: [
    [0.45, 0.6],
    [0.22, 0.595],
  ],
  mirror: [0.648, 0.68],
  headlight: [
    [0.997, 0.4],
    [0.975, 0.5],
    [0.9, 0.54],
    [0.875, 0.525],
    [0.93, 0.455],
    [0.985, 0.39],
  ],
  taillight: [
    [0.005, 0.5, 1],
    [0.028, 0.74, 1],
    [0.058, 0.76],
    [0.045, 0.5, 1],
  ],
  tailRibs: 2,
  vents: [
    [
      [0.99, 0.11, 1],
      [0.995, 0.2, 1],
      [0.955, 0.2, 1],
      [0.95, 0.11, 1],
    ],
  ],
  cladding: 0,
  stripe: 'none',
  spoiler: 'none',
  spoilerAt: [0.14, 0.975],
  exhaust: { u: 0.035, v: 0.03, side: false },
  fuelDoor: [0.09, 0.56],
  marker: [0.8, 0.5],
  seats: [0.27, 0.48],
  wheelU: 0.6,
  beltV: 0.665,
  wheel: W({ style: 'multi', count: 7, rim: 0.6, finish: 'silver' }),
  archGap: 0.04,
  flare: 0.008,
  badges: [{ text: 'Astra', u: 0.085, v: 0.3, size: 0.05, color: '#dfe3e7' }],
};

export const peugeot208Gt17: VehicleDesign = {
  outline: [
    [0.02, 0.05, 1],
    [0.0, 0.18],
    [0.002, 0.46],
    [0.018, 0.64],
    [0.05, 0.8],
    [0.1, 0.92],
    [0.17, 0.985],
    [0.3, 1.0],
    [0.43, 0.985],
    [0.5, 0.94, 1],
    [0.665, 0.68],
    [0.76, 0.64],
    [0.88, 0.585],
    [0.955, 0.52],
    [0.99, 0.43],
    [1.0, 0.25],
    [0.99, 0.08],
    [0.975, 0.03, 1],
  ],
  glass: [
    [
      [0.12, 0.705, 1],
      [0.14, 0.84],
      [0.19, 0.92],
      [0.43, 0.94],
      [0.475, 0.915],
      [0.648, 0.69, 1],
    ],
  ],
  pillars: [
    { u: 0.37, lean: 0.005, w: 0.06 },
    // kicked-up rear quarter: the thick C-pillar that rises towards the tail
    { u: 0.14, lean: 0.03, w: 0.12 },
  ],
  screens: [seg([0.51, 0.932], [0.66, 0.69]), seg([0.055, 0.8], [0.15, 0.97])],
  shoulder: [
    [0.03, 0.66],
    [0.2, 0.7],
    [0.42, 0.685],
    [0.72, 0.655],
    [0.95, 0.53],
  ],
  creases: [
    [
      [0.22, 0.38],
      [0.48, 0.32],
      [0.78, 0.4],
    ],
  ],
  cuts: [seg([0.662, 0.67], [0.668, 0.04]), seg([0.37, 0.69], [0.36, 0.04]), seg([0.16, 0.69], [0.18, 0.26]), seg([0.05, 0.86], [0.03, 0.42]), seg([0.935, 0.55], [0.945, 0.06])],
  handles: [
    [0.42, 0.635],
    [0.21, 0.645],
  ],
  mirror: [0.64, 0.7],
  // cat-eye lamp running up into the wing
  headlight: [
    [0.996, 0.43],
    [0.97, 0.53],
    [0.9, 0.585],
    [0.86, 0.585],
    [0.9, 0.53],
    [0.97, 0.46],
  ],
  taillight: [
    [0.008, 0.6, 1],
    [0.03, 0.8, 1],
    [0.075, 0.82],
    [0.07, 0.72],
    [0.04, 0.6, 1],
  ],
  tailRibs: 3,
  vents: [
    [
      [0.995, 0.08, 1],
      [0.998, 0.22, 1],
      [0.93, 0.22, 1],
      [0.92, 0.08, 1],
    ],
  ],
  cladding: 0.06,
  stripe: 'none',
  spoiler: 'roof',
  spoilerColor: 'black',
  spoilerAt: [0.15, 0.975],
  exhaust: { u: 0.03, v: 0.02, side: false },
  fuelDoor: [0.1, 0.62],
  seats: [0.27, 0.47],
  wheelU: 0.58,
  beltV: 0.69,
  wheel: W({ style: 'split', count: 5, rim: 0.72, finish: 'gunmetal', caliper: 'accent' }),
  archGap: 0.035,
  flare: 0.012,
  badges: [{ text: 'GT', u: 0.83, v: 0.42, size: 0.06, color: '#d2141e' }],
};

export const golfGtiMk4: VehicleDesign = {
  outline: [
    [0.018, 0.05, 1],
    [0.0, 0.16],
    [0.0, 0.42],
    [0.008, 0.62],
    [0.024, 0.78],
    [0.055, 0.9],
    [0.11, 0.965],
    [0.25, 1.0],
    [0.41, 0.99],
    [0.51, 0.935, 1],
    [0.665, 0.655],
    [0.77, 0.61],
    [0.89, 0.555],
    [0.965, 0.49],
    [0.997, 0.4],
    [1.0, 0.22],
    [0.99, 0.07],
    [0.972, 0.03, 1],
  ],
  glass: [
    [
      [0.17, 0.665, 1],
      [0.18, 0.86],
      [0.21, 0.93],
      [0.42, 0.945],
      [0.48, 0.915],
      [0.652, 0.665, 1],
    ],
  ],
  pillars: [
    { u: 0.39, lean: 0, w: 0.06 },
    // the Mk4 trademark: a very thick C-pillar, no rear quarter glass
    { u: 0.12, lean: 0.03, w: 0.17 },
  ],
  screens: [seg([0.52, 0.93], [0.664, 0.662]), seg([0.024, 0.8], [0.075, 0.975])],
  shoulder: [
    [0.025, 0.63],
    [0.4, 0.655],
    [0.7, 0.63],
    [0.96, 0.5],
  ],
  creases: [
    [
      [0.16, 0.33],
      [0.82, 0.33],
    ],
  ],
  cuts: [seg([0.665, 0.65], [0.67, 0.04]), seg([0.39, 0.665], [0.385, 0.04]), seg([0.2, 0.665], [0.2, 0.25]), seg([0.05, 0.9], [0.035, 0.4]), seg([0.935, 0.51], [0.945, 0.06])],
  handles: [
    [0.44, 0.605],
    [0.24, 0.605],
  ],
  mirror: [0.645, 0.68],
  headlight: [
    [0.997, 0.4],
    [0.985, 0.5],
    [0.92, 0.53],
    [0.885, 0.52],
    [0.89, 0.44],
    [0.99, 0.39],
  ],
  taillight: [
    [0.004, 0.52, 1],
    [0.012, 0.72, 1],
    [0.05, 0.73],
    [0.045, 0.52, 1],
  ],
  tailRibs: 2,
  vents: [
    [
      [0.99, 0.1, 1],
      [0.995, 0.21, 1],
      [0.94, 0.21, 1],
      [0.935, 0.1, 1],
    ],
  ],
  cladding: 0.04,
  stripe: 'none',
  spoiler: 'hatchLip',
  spoilerAt: [0.09, 0.955],
  exhaust: { u: 0.03, v: 0.03, side: false },
  fuelDoor: [0.08, 0.57],
  seats: [0.28, 0.48],
  wheelU: 0.6,
  beltV: 0.665,
  wheel: W({ style: 'multi', count: 10, rim: 0.66, finish: 'silver', caliper: 'accent' }),
  archGap: 0.035,
  flare: 0.01,
  badges: [{ text: 'GTI', u: 0.07, v: 0.4, size: 0.055, color: '#d71f26' }],
};

export const audiA3_8l: VehicleDesign = {
  outline: [
    [0.02, 0.05, 1],
    [0.0, 0.16],
    [0.0, 0.42],
    [0.01, 0.62],
    [0.03, 0.77],
    [0.07, 0.885],
    [0.14, 0.96],
    [0.3, 1.0],
    [0.44, 0.985],
    [0.52, 0.935, 1],
    [0.67, 0.65],
    [0.78, 0.605],
    [0.9, 0.55],
    [0.968, 0.48],
    [0.997, 0.39],
    [1.0, 0.22],
    [0.99, 0.07],
    [0.972, 0.03, 1],
  ],
  glass: [
    [
      [0.13, 0.66, 1],
      [0.145, 0.85],
      [0.19, 0.925],
      [0.44, 0.945],
      [0.49, 0.915],
      [0.655, 0.66, 1],
    ],
  ],
  pillars: [
    { u: 0.4, lean: 0, w: 0.055 },
    { u: 0.21, lean: 0.004, w: 0.035 },
    { u: 0.15, lean: 0.035, w: 0.075 },
  ],
  screens: [seg([0.53, 0.93], [0.668, 0.658]), seg([0.03, 0.79], [0.1, 0.97])],
  shoulder: [
    [0.025, 0.62],
    [0.4, 0.64],
    [0.72, 0.615],
    [0.96, 0.49],
  ],
  creases: [
    [
      [0.17, 0.4],
      [0.84, 0.4],
    ],
  ],
  cuts: [seg([0.668, 0.645], [0.672, 0.04]), seg([0.4, 0.66], [0.396, 0.04]), seg([0.2, 0.66], [0.205, 0.25]), seg([0.06, 0.88], [0.04, 0.4]), seg([0.94, 0.5], [0.95, 0.06])],
  handles: [
    [0.45, 0.6],
    [0.25, 0.6],
  ],
  mirror: [0.65, 0.675],
  headlight: [
    [0.997, 0.39],
    [0.98, 0.475],
    [0.9, 0.51],
    [0.88, 0.495],
    [0.93, 0.43],
    [0.99, 0.38],
  ],
  taillight: [
    [0.004, 0.52, 1],
    [0.02, 0.7, 1],
    [0.07, 0.71],
    [0.06, 0.52, 1],
  ],
  tailRibs: 1,
  vents: [
    [
      [0.99, 0.1, 1],
      [0.995, 0.2, 1],
      [0.95, 0.2, 1],
      [0.945, 0.1, 1],
    ],
  ],
  cladding: 0,
  stripe: 'sill',
  spoiler: 'hatchLip',
  spoilerAt: [0.12, 0.96],
  exhaust: { u: 0.03, v: 0.03, side: false },
  fuelDoor: [0.09, 0.56],
  seats: [0.29, 0.49],
  wheelU: 0.6,
  beltV: 0.66,
  wheel: W({ style: 'five', count: 5, rim: 0.66, finish: 'silver' }),
  archGap: 0.035,
  flare: 0.008,
  badges: [{ text: 'A3', u: 0.06, v: 0.42, size: 0.055, color: '#e1e4e7' }],
};

export const mercedesC200W205: VehicleDesign = {
  outline: [
    [0.016, 0.05, 1],
    [0.0, 0.17],
    [0.0, 0.42],
    [0.008, 0.6],
    [0.035, 0.665],
    [0.1, 0.68],
    [0.17, 0.7],
    [0.25, 0.84],
    [0.32, 0.95],
    [0.42, 1.0],
    [0.5, 0.995],
    [0.565, 0.95, 1],
    [0.67, 0.675],
    [0.78, 0.64],
    [0.9, 0.585],
    [0.965, 0.52],
    [0.995, 0.43],
    [1.0, 0.24],
    [0.99, 0.08],
    [0.975, 0.03, 1],
  ],
  glass: [
    [
      [0.215, 0.69, 1],
      [0.27, 0.84],
      [0.33, 0.925],
      [0.43, 0.955],
      [0.53, 0.935],
      [0.66, 0.69, 1],
    ],
  ],
  pillars: [
    { u: 0.44, lean: -0.005, w: 0.05 },
    { u: 0.28, lean: 0.06, w: 0.06 },
  ],
  screens: [seg([0.57, 0.945], [0.672, 0.68]), seg([0.18, 0.705], [0.32, 0.945])],
  shoulder: [
    [0.02, 0.6],
    [0.2, 0.64],
    [0.5, 0.65],
    [0.75, 0.63],
    [0.96, 0.53],
  ],
  creases: [
    [
      [0.12, 0.42],
      [0.45, 0.38],
      [0.8, 0.46],
    ],
  ],
  cuts: [seg([0.67, 0.67], [0.672, 0.04]), seg([0.44, 0.68], [0.432, 0.04]), seg([0.25, 0.68], [0.255, 0.28]), seg([0.035, 0.66], [0.12, 0.68]), seg([0.94, 0.55], [0.95, 0.06])],
  handles: [
    [0.49, 0.62],
    [0.3, 0.62],
  ],
  mirror: [0.655, 0.69],
  headlight: [
    [0.997, 0.43],
    [0.975, 0.52],
    [0.91, 0.57],
    [0.88, 0.565],
    [0.925, 0.5],
    [0.985, 0.42],
  ],
  taillight: [
    [0.004, 0.5, 1],
    [0.012, 0.62, 1],
    [0.075, 0.65],
    [0.07, 0.55],
    [0.03, 0.5, 1],
  ],
  tailRibs: 1,
  vents: [
    [
      [0.995, 0.09, 1],
      [0.998, 0.2, 1],
      [0.955, 0.21, 1],
      [0.945, 0.09, 1],
    ],
  ],
  cladding: 0,
  stripe: 'none',
  spoiler: 'lip',
  spoilerAt: [0.025, 0.665],
  exhaust: { u: 0.03, v: 0.04, side: false },
  fuelDoor: [0.13, 0.6],
  seats: [0.34, 0.52],
  wheelU: 0.62,
  beltV: 0.69,
  wheel: W({ style: 'twin', count: 5, rim: 0.68, finish: 'silver' }),
  archGap: 0.035,
  flare: 0.008,
  badges: [{ text: 'C 200', u: 0.07, v: 0.56, size: 0.045, color: '#e6e8ea' }],
};

const f30Outline: P[] = [
  [0.016, 0.05, 1],
  [0.0, 0.17],
  [0.0, 0.42],
  [0.006, 0.58],
  [0.03, 0.645],
  [0.1, 0.66],
  [0.165, 0.675],
  [0.24, 0.83],
  [0.31, 0.95],
  [0.4, 1.0],
  [0.5, 0.995],
  [0.56, 0.955, 1],
  [0.665, 0.68],
  [0.78, 0.65],
  [0.9, 0.6],
  [0.97, 0.54],
  [0.996, 0.44],
  [1.0, 0.24],
  [0.99, 0.08],
  [0.975, 0.03, 1],
];

const f30Base = {
  outline: f30Outline,
  glass: [
    [
      // the Hofmeister kink: the rear side glass ends in a forward-pointing hook
      [0.2, 0.69, 1],
      [0.235, 0.78, 1],
      [0.255, 0.8],
      [0.32, 0.925],
      [0.41, 0.955],
      [0.52, 0.94],
      [0.655, 0.69, 1],
    ],
  ] as P[][],
  pillars: [
    { u: 0.43, lean: -0.005, w: 0.05 },
    { u: 0.265, lean: 0.06, w: 0.05 },
  ],
  screens: [seg([0.565, 0.948], [0.667, 0.675]), seg([0.17, 0.68], [0.31, 0.945])],
  shoulder: [
    [0.02, 0.6],
    [0.3, 0.655],
    [0.7, 0.645],
    [0.96, 0.55],
  ] as P[],
  creases: [
    [
      [0.12, 0.45],
      [0.5, 0.42],
      [0.84, 0.5],
    ],
  ] as P[][],
  cuts: [seg([0.666, 0.665], [0.67, 0.04]), seg([0.43, 0.68], [0.424, 0.04]), seg([0.245, 0.685], [0.25, 0.27]), seg([0.03, 0.645], [0.115, 0.665]), seg([0.945, 0.56], [0.955, 0.06])],
  handles: [
    [0.48, 0.625],
    [0.29, 0.625],
  ] as [number, number][],
  mirror: [0.652, 0.69] as [number, number],
  // lamps reaching back to the kidney grille
  headlight: [
    [0.998, 0.44],
    [0.97, 0.53],
    [0.9, 0.57],
    [0.87, 0.56],
    [0.92, 0.5],
    [0.99, 0.43],
  ] as P[],
  taillight: [
    [0.003, 0.48, 1],
    [0.01, 0.6, 1],
    [0.08, 0.64],
    [0.075, 0.56],
    [0.035, 0.49, 1],
  ] as P[],
  tailRibs: 2,
  cladding: 0,
  stripe: 'none' as const,
  spoilerAt: [0.02, 0.645] as [number, number],
  fuelDoor: [0.13, 0.59] as [number, number],
  seats: [0.33, 0.51],
  wheelU: 0.61,
  beltV: 0.69,
  archGap: 0.035,
  flare: 0.008,
};

export const bmw320iF30: VehicleDesign = {
  ...f30Base,
  vents: [
    [
      [0.995, 0.1, 1],
      [0.998, 0.2, 1],
      [0.96, 0.2, 1],
      [0.952, 0.1, 1],
    ],
  ],
  spoiler: 'none',
  exhaust: { u: 0.03, v: 0.04, side: false },
  wheel: W({ style: 'multi', count: 10, rim: 0.66, finish: 'silver' }),
  badges: [{ text: '320i', u: 0.07, v: 0.55, size: 0.045, color: '#e4e6e9' }],
};

/** M Sport apron: deeper front splitter and a rear diffuser below the bumper line. */
const f30MSportOutline: P[] = f30Outline.map(([u, v, k]): P => {
  if (u >= 0.99 && v <= 0.08) return [u + 0.004, v - 0.025, 1];
  if (u <= 0.016 && v <= 0.05) return [u + 0.006, v - 0.02, 1];
  return k === undefined ? [u, v] : [u, v, k];
});

export const bmw335iF30: VehicleDesign = {
  ...f30Base,
  outline: f30MSportOutline,
  // M Sport front apron: three large intakes, deeper corners, side skirt
  vents: [
    [
      [0.995, 0.07, 1],
      [0.998, 0.24, 1],
      [0.955, 0.25, 1],
      [0.94, 0.07, 1],
    ],
    [
      [0.93, 0.06, 1],
      [0.93, 0.18, 1],
      [0.9, 0.17, 1],
      [0.895, 0.07, 1],
    ],
  ],
  cladding: 0.05,
  spoiler: 'lip',
  spoilerColor: 'paint',
  exhaust: { u: 0.035, v: 0.035, side: false },
  wheel: W({ style: 'twin', count: 7, rim: 0.74, finish: 'gunmetal', caliper: 'accent', discDrilled: true }),
  badges: [{ text: '335i', u: 0.07, v: 0.55, size: 0.045, color: '#e4e6e9' }],
};

export const civicSi08: VehicleDesign = {
  outline: [
    [0.016, 0.05, 1],
    [0.0, 0.18],
    [0.0, 0.44],
    [0.01, 0.62],
    [0.04, 0.69],
    [0.12, 0.71],
    [0.18, 0.74],
    [0.27, 0.9],
    [0.36, 0.99],
    [0.45, 1.0],
    [0.53, 0.975],
    // monovolume-like screen: starts far forward and very raked
    [0.73, 0.64, 1],
    [0.84, 0.6],
    [0.93, 0.55],
    [0.98, 0.48],
    [1.0, 0.36],
    [0.998, 0.16],
    [0.985, 0.06],
    [0.97, 0.03, 1],
  ],
  glass: [
    [
      [0.21, 0.71, 1],
      [0.28, 0.87],
      [0.36, 0.955],
      [0.45, 0.965],
      [0.52, 0.945],
      [0.71, 0.65, 1],
    ],
  ],
  pillars: [
    { u: 0.47, lean: -0.01, w: 0.05 },
    { u: 0.29, lean: 0.05, w: 0.06 },
  ],
  screens: [seg([0.54, 0.965], [0.725, 0.645]), seg([0.185, 0.745], [0.33, 0.97])],
  shoulder: [
    [0.02, 0.62],
    [0.35, 0.67],
    [0.7, 0.62],
    [0.96, 0.5],
  ],
  creases: [
    [
      [0.14, 0.44],
      [0.5, 0.4],
      [0.84, 0.44],
    ],
  ],
  cuts: [seg([0.7, 0.66], [0.71, 0.04]), seg([0.47, 0.7], [0.462, 0.04]), seg([0.27, 0.7], [0.275, 0.28]), seg([0.04, 0.69], [0.13, 0.71]), seg([0.95, 0.52], [0.96, 0.06])],
  handles: [
    [0.52, 0.62],
    [0.32, 0.625],
  ],
  mirror: [0.69, 0.665],
  headlight: [
    [0.998, 0.38],
    [0.975, 0.47],
    [0.9, 0.53],
    [0.88, 0.51],
    [0.94, 0.44],
    [0.995, 0.36],
  ],
  // two-piece lamp: on the wing and on the boot lid
  taillight: [
    [0.003, 0.5, 1],
    [0.015, 0.66, 1],
    [0.1, 0.7],
    [0.09, 0.6],
    [0.03, 0.5, 1],
  ],
  tailRibs: 2,
  vents: [
    [
      [0.995, 0.08, 1],
      [0.998, 0.2, 1],
      [0.95, 0.21, 1],
      [0.94, 0.08, 1],
    ],
  ],
  cladding: 0.04,
  stripe: 'none',
  spoiler: 'wing',
  spoilerColor: 'paint',
  spoilerAt: [0.06, 0.7],
  exhaust: { u: 0.03, v: 0.04, side: false },
  fuelDoor: [0.15, 0.62],
  seats: [0.36, 0.55],
  wheelU: 0.65,
  beltV: 0.7,
  wheel: W({ style: 'split', count: 7, rim: 0.7, finish: 'gunmetal', caliper: 'accent' }),
  archGap: 0.035,
  flare: 0.01,
  badges: [{ text: 'Si', u: 0.08, v: 0.57, size: 0.05, color: '#d6111b' }],
};

export const jettaTsi12: VehicleDesign = {
  outline: [
    [0.016, 0.05, 1],
    [0.0, 0.17],
    [0.0, 0.43],
    [0.005, 0.6],
    [0.025, 0.655, 1],
    [0.1, 0.665],
    [0.17, 0.68],
    [0.24, 0.84],
    [0.3, 0.965],
    [0.36, 1.0],
    [0.52, 1.0],
    [0.575, 0.955, 1],
    [0.68, 0.675],
    [0.79, 0.645],
    [0.92, 0.6],
    [0.98, 0.54],
    [0.998, 0.44],
    [1.0, 0.24],
    [0.99, 0.08],
    [0.975, 0.03, 1],
  ],
  glass: [
    [
      [0.2, 0.685, 1],
      [0.25, 0.83],
      [0.3, 0.935],
      [0.37, 0.96],
      [0.52, 0.96],
      [0.565, 0.935],
      [0.67, 0.685, 1],
    ],
  ],
  pillars: [
    { u: 0.45, lean: 0, w: 0.05 },
    { u: 0.26, lean: 0.045, w: 0.05 },
  ],
  screens: [seg([0.58, 0.95], [0.682, 0.672]), seg([0.175, 0.685], [0.3, 0.96])],
  shoulder: [
    [0.01, 0.62, 1],
    [0.5, 0.635],
    [0.96, 0.6, 1],
  ],
  creases: [
    [
      [0.1, 0.4],
      [0.9, 0.42],
    ],
  ],
  cuts: [seg([0.68, 0.665], [0.684, 0.04]), seg([0.45, 0.68], [0.446, 0.04]), seg([0.24, 0.68], [0.243, 0.27]), seg([0.025, 0.655], [0.12, 0.67]), seg([0.95, 0.57], [0.958, 0.06])],
  handles: [
    [0.5, 0.62],
    [0.29, 0.62],
  ],
  mirror: [0.665, 0.69],
  headlight: [
    [0.998, 0.44],
    [0.99, 0.54],
    [0.92, 0.565],
    [0.9, 0.555],
    [0.905, 0.46],
    [0.995, 0.435],
  ],
  taillight: [
    [0.003, 0.5, 1],
    [0.006, 0.62, 1],
    [0.08, 0.655, 1],
    [0.075, 0.55, 1],
    [0.03, 0.5, 1],
  ],
  tailRibs: 1,
  vents: [
    [
      [0.995, 0.1, 1],
      [0.998, 0.2, 1],
      [0.955, 0.2, 1],
      [0.95, 0.1, 1],
    ],
  ],
  cladding: 0,
  stripe: 'none',
  spoiler: 'none',
  spoilerAt: [0.02, 0.655],
  exhaust: { u: 0.03, v: 0.04, side: false },
  fuelDoor: [0.13, 0.6],
  seats: [0.34, 0.53],
  wheelU: 0.62,
  beltV: 0.685,
  wheel: W({ style: 'five', count: 5, rim: 0.68, finish: 'silver' }),
  archGap: 0.04,
  flare: 0.006,
  badges: [{ text: 'TSI', u: 0.08, v: 0.56, size: 0.045, color: '#e4e6e9' }],
};

export const lancerEvoX: VehicleDesign = {
  outline: [
    [0.018, 0.05, 1],
    [0.0, 0.18],
    [0.0, 0.44],
    [0.006, 0.6],
    [0.03, 0.665],
    [0.11, 0.685],
    [0.18, 0.7],
    [0.26, 0.86],
    [0.33, 0.97],
    [0.42, 1.0],
    [0.52, 0.995],
    [0.58, 0.955, 1],
    [0.685, 0.69],
    [0.8, 0.665],
    [0.92, 0.635],
    // shark nose: the front leans forward at the top
    [0.995, 0.6, 1],
    [0.985, 0.42],
    [1.0, 0.2],
    [0.99, 0.06],
    [0.97, 0.025, 1],
  ],
  glass: [
    [
      [0.21, 0.7, 1],
      [0.27, 0.85],
      [0.33, 0.94],
      [0.42, 0.965],
      [0.53, 0.945],
      [0.67, 0.7, 1],
    ],
  ],
  pillars: [
    { u: 0.45, lean: -0.005, w: 0.05 },
    { u: 0.28, lean: 0.055, w: 0.06 },
  ],
  screens: [seg([0.585, 0.95], [0.68, 0.692]), seg([0.185, 0.7], [0.33, 0.965])],
  shoulder: [
    [0.02, 0.62],
    [0.4, 0.665],
    [0.75, 0.66],
    [0.99, 0.6],
  ],
  creases: [
    [
      [0.1, 0.42],
      [0.5, 0.38],
      [0.88, 0.46],
    ],
  ],
  cuts: [seg([0.684, 0.68], [0.688, 0.04]), seg([0.45, 0.69], [0.443, 0.04]), seg([0.26, 0.69], [0.265, 0.28]), seg([0.03, 0.665], [0.12, 0.685]), seg([0.96, 0.62], [0.97, 0.06])],
  handles: [
    [0.5, 0.63],
    [0.31, 0.63],
  ],
  mirror: [0.67, 0.7],
  // slim lamp under the shark-nose brow
  headlight: [
    [0.99, 0.48],
    [0.975, 0.56],
    [0.9, 0.6],
    [0.88, 0.59],
    [0.93, 0.53],
    [0.985, 0.46],
  ],
  taillight: [
    [0.003, 0.5, 1],
    [0.012, 0.64, 1],
    [0.085, 0.67],
    [0.08, 0.58],
    [0.035, 0.5, 1],
  ],
  tailRibs: 2,
  vents: [
    // corner of the big trapezoid intake, seen from the side
    [
      [0.997, 0.1, 1],
      [0.996, 0.24, 1],
      [0.975, 0.24, 1],
      [0.968, 0.1, 1],
    ],
    // fender vent behind the front wheel
    [
      [0.71, 0.5, 1],
      [0.71, 0.58, 1],
      [0.75, 0.6, 1],
      [0.745, 0.52, 1],
    ],
    // bonnet vent seen edge-on
    [
      [0.8, 0.66, 1],
      [0.86, 0.645, 1],
      [0.86, 0.66, 1],
      [0.8, 0.672, 1],
    ],
  ],
  cladding: 0.06,
  stripe: 'none',
  spoiler: 'wing',
  spoilerColor: 'paint',
  spoilerAt: [0.06, 0.68],
  exhaust: { u: 0.04, v: 0.04, side: false },
  fuelDoor: [0.14, 0.6],
  seats: [0.35, 0.53],
  wheelU: 0.62,
  beltV: 0.7,
  wheel: W({ style: 'multi', count: 10, rim: 0.72, finish: 'gunmetal', caliper: 'accent', discDrilled: true }),
  archGap: 0.03,
  flare: 0.02,
  badges: [{ text: 'EVOLUTION', u: 0.09, v: 0.55, size: 0.035, color: '#e8eaec' }],
};
