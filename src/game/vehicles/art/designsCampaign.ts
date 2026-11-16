import type { VehicleDesign } from './designs';

/**
 * Side-view designs of the six real campaign cars (original vector artwork drawn from the cars'
 * documented dimensions and from the proportions of period photographs; no photo, logo or
 * manufacturer emblem is embedded — only the model lettering a badge would carry).
 *
 * Same conventions as designs.ts: u = 0 rear bumper … 1 nose, v = 0 sill … 1 roof. Each one keeps
 * the features that make the car recognisable from the side:
 *  - Uno Mille: tall box, near-vertical hatch, flat roof to the windscreen, wedge bonnet, black
 *    bumpers and a thin side strip, narrow 13" wheels with hubcaps.
 *  - Celta: rounded 2000s hatch, high belt line, big teardrop headlamp, vertical tail lamp at the
 *    C-pillar, body-coloured bumpers.
 *  - Corsa GL: "egg" profile with a round roof, oval headlamp, short bulbous nose, grey bumpers and
 *    side strip.
 *  - Kadett SL: long low wedge (Cx 0.32), very raked screen, sloping fastback hatch with a wide
 *    C-pillar, slim headlamp, black bumpers with pinstripe.
 *  - Chevette SL: THREE-BOX SEDAN — long bonnet, upright cabin, notchback boot, square lamps.
 *  - Saveiro GL: PICKUP — square Gol front, short cab, open load bed with a tailgate.
 */

export const unoMille95: VehicleDesign = {
  outline: [
    [0.012, 0.03, 1],
    [0.0, 0.08],
    [0.0, 0.31, 1],
    [0.006, 0.55],
    [0.016, 0.85],
    [0.028, 0.965],
    [0.055, 0.998],
    [0.3, 1.0],
    [0.5, 0.997],
    [0.522, 0.985],
    [0.54, 0.965, 1],
    [0.675, 0.6, 1],
    [0.8, 0.552],
    [0.93, 0.484],
    [0.985, 0.445, 1],
    [0.995, 0.4],
    [1.0, 0.3],
    [0.998, 0.08],
    [0.985, 0.02, 1],
  ],
  glass: [
    [
      [0.068, 0.63, 1],
      [0.072, 0.925],
      [0.09, 0.955],
      [0.49, 0.958],
      [0.515, 0.945],
      [0.652, 0.618, 1],
    ],
  ],
  pillars: [
    { u: 0.372, lean: 0, w: 0.065 },
    { u: 0.098, lean: 0.002, w: 0.07 },
  ],
  screens: [
    [
      [0.545, 0.962],
      [0.668, 0.612],
    ],
    [
      [0.01, 0.6],
      [0.026, 0.955],
    ],
  ],
  shoulder: [
    [0.01, 0.598],
    [0.4, 0.61],
    [0.7, 0.596],
    [0.97, 0.462],
  ],
  creases: [
    [
      [0.21, 0.43],
      [0.5, 0.425],
      [0.76, 0.43],
    ],
  ],
  cuts: [
    [
      [0.66, 0.605],
      [0.664, 0.4],
      [0.66, 0.02],
    ],
    [
      [0.372, 0.625],
      [0.372, 0.02],
    ],
    [
      [0.024, 0.6],
      [0.012, 0.33],
    ],
  ],
  handles: [[0.405, 0.57]],
  mirror: [0.648, 0.64],
  headlight: [
    [0.997, 0.33],
    [0.994, 0.43],
    [0.986, 0.436],
    [0.988, 0.33],
  ],
  cornerLamp: [
    [0.963, 0.33, 1],
    [0.965, 0.418, 1],
    [0.985, 0.434, 1],
    [0.987, 0.33, 1],
  ],
  taillight: [
    [0.003, 0.33, 1],
    [0.007, 0.585, 1],
    [0.03, 0.585, 1],
    [0.027, 0.33, 1],
  ],
  tailRibs: 3,
  vents: [],
  cladding: 0,
  stripe: 'none',
  spoiler: 'none',
  spoilerAt: [0.06, 0.998],
  exhaust: { u: 0.03, v: 0.03, side: false },
  seats: [0.3, 0.48],
  wheelU: 0.6,
  beltV: 0.62,
  wheel: { style: 'turbine', count: 8, rim: 0.6, finish: 'silver', caliper: 'grey', lettering: 'subtle', centreLock: false, lugs: 4, rearBrake: 'drum', discDrilled: false },
  archGap: 0.05,
  flare: 0.008,
  lowerTrim: { color: '#25272a', bumperTop: 0.3, bumperBottom: -0.05, rearU: 0.07, frontU: 0.93, sideTop: 0.215, sideBottom: 0.15, pinstripe: false },
  badges: [{ text: 'Mille', u: 0.13, v: 0.36, size: 0.06, color: '#e3e5e8' }],
};

export const celta03: VehicleDesign = {
  outline: [
    [0.014, 0.04, 1],
    [0.0, 0.12],
    [0.0, 0.36],
    [0.012, 0.58],
    [0.04, 0.78],
    [0.085, 0.92],
    [0.15, 0.985],
    [0.3, 1.0],
    [0.46, 0.99],
    [0.53, 0.955, 1],
    [0.68, 0.655],
    [0.78, 0.6],
    [0.9, 0.52],
    [0.975, 0.44],
    [0.997, 0.35],
    [1.0, 0.2],
    [0.99, 0.06],
    [0.975, 0.02, 1],
  ],
  glass: [
    [
      [0.125, 0.665, 1],
      [0.16, 0.86],
      [0.205, 0.93],
      [0.46, 0.945],
      [0.51, 0.928],
      [0.662, 0.665, 1],
    ],
  ],
  pillars: [
    { u: 0.37, lean: 0, w: 0.07 },
    { u: 0.15, lean: 0.03, w: 0.075 },
  ],
  screens: [
    [
      [0.54, 0.948],
      [0.674, 0.668],
    ],
    [
      [0.045, 0.79],
      [0.135, 0.95],
    ],
  ],
  shoulder: [
    [0.03, 0.64],
    [0.4, 0.66],
    [0.7, 0.645],
    [0.96, 0.5],
  ],
  creases: [
    [
      [0.2, 0.36],
      [0.5, 0.33],
      [0.8, 0.36],
    ],
  ],
  cuts: [
    [
      [0.675, 0.655],
      [0.68, 0.03],
    ],
    [
      [0.37, 0.668],
      [0.362, 0.03],
    ],
    [
      [0.07, 0.72],
      [0.05, 0.42],
    ],
    [
      [0.93, 0.44],
      [0.94, 0.05],
    ],
    [
      [0.06, 0.36],
      [0.07, 0.05],
    ],
  ],
  handles: [[0.42, 0.605]],
  mirror: [0.656, 0.672],
  headlight: [
    [0.995, 0.4],
    [0.97, 0.52],
    [0.9, 0.565],
    [0.872, 0.55],
    [0.93, 0.47],
    [0.98, 0.39],
  ],
  taillight: [
    [0.012, 0.55, 1],
    [0.032, 0.75, 1],
    [0.072, 0.77],
    [0.062, 0.55, 1],
  ],
  tailRibs: 2,
  vents: [
    [
      [0.985, 0.12, 1],
      [0.99, 0.2, 1],
      [0.955, 0.2, 1],
      [0.95, 0.12, 1],
    ],
  ],
  cladding: 0,
  stripe: 'none',
  spoiler: 'none',
  spoilerAt: [0.15, 0.985],
  exhaust: { u: 0.04, v: 0.03, side: false },
  seats: [0.3, 0.49],
  wheelU: 0.6,
  beltV: 0.665,
  wheel: { style: 'multi', count: 12, rim: 0.58, finish: 'silver', caliper: 'grey', lettering: 'subtle', centreLock: false, lugs: 4, rearBrake: 'drum', discDrilled: false },
  archGap: 0.045,
  flare: 0.01,
  badges: [{ text: 'Celta', u: 0.085, v: 0.25, size: 0.055, color: '#d9dde1' }],
};

export const corsaGl96: VehicleDesign = {
  outline: [
    [0.016, 0.04, 1],
    [0.002, 0.12],
    [0.0, 0.34],
    [0.01, 0.55],
    [0.03, 0.72],
    [0.07, 0.87],
    [0.13, 0.96],
    [0.24, 1.0],
    [0.42, 0.995],
    [0.5, 0.965],
    [0.54, 0.93, 1],
    [0.67, 0.64],
    [0.76, 0.585],
    [0.88, 0.52],
    [0.955, 0.46],
    [0.99, 0.38],
    [1.0, 0.24],
    [0.995, 0.08],
    [0.978, 0.02, 1],
  ],
  glass: [
    [
      [0.1, 0.632, 1],
      [0.14, 0.84],
      [0.21, 0.93],
      [0.42, 0.945],
      [0.5, 0.918],
      [0.655, 0.645, 1],
    ],
  ],
  pillars: [
    { u: 0.36, lean: 0, w: 0.062 },
    { u: 0.122, lean: 0.035, w: 0.07 },
  ],
  screens: [
    [
      [0.55, 0.932],
      [0.665, 0.65],
    ],
    [
      [0.035, 0.73],
      [0.12, 0.93],
    ],
  ],
  shoulder: [
    [0.02, 0.6],
    [0.35, 0.625],
    [0.7, 0.61],
    [0.96, 0.47],
  ],
  creases: [
    [
      [0.18, 0.31],
      [0.5, 0.3],
      [0.82, 0.32],
    ],
  ],
  cuts: [
    [
      [0.665, 0.636],
      [0.67, 0.03],
    ],
    [
      [0.36, 0.64],
      [0.355, 0.03],
    ],
    [
      [0.05, 0.68],
      [0.03, 0.38],
    ],
  ],
  handles: [[0.395, 0.585]],
  mirror: [0.648, 0.652],
  headlight: [
    [0.997, 0.36],
    [0.985, 0.46],
    [0.95, 0.5],
    [0.918, 0.488],
    [0.955, 0.42],
    [0.985, 0.35],
  ],
  taillight: [
    [0.006, 0.4, 1],
    [0.02, 0.665, 1],
    [0.046, 0.685],
    [0.036, 0.4, 1],
  ],
  tailRibs: 3,
  vents: [],
  cladding: 0,
  stripe: 'none',
  spoiler: 'none',
  spoilerAt: [0.13, 0.96],
  exhaust: { u: 0.035, v: 0.03, side: false },
  seats: [0.29, 0.47],
  wheelU: 0.59,
  beltV: 0.635,
  wheel: { style: 'turbine', count: 10, rim: 0.6, finish: 'gunmetal', caliper: 'grey', lettering: 'subtle', centreLock: false, lugs: 4, rearBrake: 'drum', discDrilled: false },
  archGap: 0.05,
  flare: 0.01,
  lowerTrim: { color: '#45484d', bumperTop: 0.3, bumperBottom: -0.05, rearU: 0.072, frontU: 0.925, sideTop: 0.29, sideBottom: 0.215, pinstripe: false },
  badges: [{ text: 'GL', u: 0.09, v: 0.34, size: 0.06, color: '#dde1e5' }],
};

export const kadettSl92: VehicleDesign = {
  outline: [
    [0.014, 0.05, 1],
    [0.0, 0.14],
    [0.002, 0.4, 1],
    [0.02, 0.52],
    [0.06, 0.68],
    [0.15, 0.86],
    [0.25, 0.97],
    [0.34, 1.0],
    [0.47, 0.99],
    [0.53, 0.96, 1],
    [0.7, 0.6],
    [0.82, 0.53],
    [0.94, 0.45],
    [0.985, 0.4],
    [1.0, 0.3],
    [0.998, 0.1],
    [0.984, 0.03, 1],
  ],
  glass: [
    [
      [0.14, 0.635, 1],
      [0.2, 0.84],
      [0.27, 0.935],
      [0.47, 0.952],
      [0.52, 0.93],
      [0.684, 0.622, 1],
    ],
  ],
  pillars: [
    { u: 0.356, lean: -0.004, w: 0.065 },
    { u: 0.225, lean: 0.04, w: 0.11 },
  ],
  screens: [
    [
      [0.536, 0.955],
      [0.69, 0.626],
    ],
    [
      [0.075, 0.71],
      [0.21, 0.93],
    ],
  ],
  shoulder: [
    [0.02, 0.56],
    [0.4, 0.6],
    [0.7, 0.59],
    [0.97, 0.44],
  ],
  creases: [],
  cuts: [
    [
      [0.69, 0.618],
      [0.692, 0.03],
    ],
    [
      [0.356, 0.632],
      [0.35, 0.03],
    ],
    [
      [0.065, 0.69],
      [0.03, 0.5],
      [0.012, 0.42],
    ],
  ],
  handles: [[0.39, 0.575]],
  mirror: [0.675, 0.64],
  headlight: [
    [0.998, 0.33],
    [0.992, 0.4],
    [0.958, 0.428],
    [0.963, 0.36],
  ],
  cornerLamp: [
    [0.938, 0.34, 1],
    [0.942, 0.426, 1],
    [0.957, 0.43, 1],
    [0.962, 0.345, 1],
  ],
  taillight: [
    [0.002, 0.42, 1],
    [0.014, 0.545, 1],
    [0.055, 0.56],
    [0.048, 0.42, 1],
  ],
  tailRibs: 3,
  vents: [],
  cladding: 0,
  stripe: 'none',
  spoiler: 'none',
  spoilerAt: [0.25, 0.97],
  exhaust: { u: 0.03, v: 0.03, side: false },
  seats: [0.3, 0.47],
  wheelU: 0.62,
  beltV: 0.625,
  wheel: { style: 'multi', count: 16, rim: 0.58, finish: 'silver', caliper: 'grey', lettering: 'subtle', centreLock: false, lugs: 4, rearBrake: 'drum', discDrilled: false },
  archGap: 0.05,
  flare: 0.008,
  lowerTrim: { color: '#2a2c2f', bumperTop: 0.33, bumperBottom: -0.05, rearU: 0.07, frontU: 0.94, sideTop: 0.27, sideBottom: 0.17, pinstripe: true },
  badges: [{ text: 'SL', u: 0.105, v: 0.37, size: 0.06, color: '#e2e5e8' }],
};

export const chevetteSl88: VehicleDesign = {
  outline: [
    [0.012, 0.06, 1],
    [0.0, 0.14],
    [0.0, 0.43, 1],
    [0.01, 0.53],
    [0.04, 0.565, 1],
    [0.2, 0.588],
    [0.232, 0.6, 1],
    [0.3, 0.86],
    [0.335, 0.965],
    [0.36, 0.998, 1],
    [0.58, 0.996],
    [0.6, 0.97, 1],
    [0.71, 0.625, 1],
    [0.8, 0.603],
    [0.93, 0.565],
    [0.985, 0.535, 1],
    [0.995, 0.46],
    [1.0, 0.25],
    [0.998, 0.1],
    [0.986, 0.04, 1],
  ],
  glass: [
    [
      [0.258, 0.625, 1],
      [0.33, 0.9],
      [0.372, 0.955],
      [0.572, 0.955],
      [0.598, 0.93],
      [0.694, 0.638, 1],
    ],
  ],
  pillars: [
    { u: 0.472, lean: 0, w: 0.06 },
    { u: 0.286, lean: 0.05, w: 0.065 },
  ],
  screens: [
    [
      [0.608, 0.96],
      [0.704, 0.636],
    ],
    [
      [0.238, 0.612],
      [0.348, 0.985],
    ],
  ],
  shoulder: [
    [0.0, 0.5],
    [0.3, 0.552],
    [0.7, 0.57],
    [0.98, 0.52],
  ],
  creases: [
    [
      [0.03, 0.36],
      [0.5, 0.35],
      [0.96, 0.36],
    ],
  ],
  cuts: [
    [
      [0.472, 0.628],
      [0.468, 0.04],
    ],
    [
      [0.7, 0.626],
      [0.704, 0.04],
    ],
    [
      [0.045, 0.565],
      [0.012, 0.52],
      [0.006, 0.44],
    ],
    [
      [0.715, 0.62],
      [0.95, 0.556],
    ],
  ],
  handles: [[0.5, 0.555]],
  mirror: [0.69, 0.665],
  headlight: [
    [0.999, 0.37],
    [0.997, 0.5],
    [0.987, 0.508],
    [0.989, 0.37],
  ],
  cornerLamp: [
    [0.962, 0.37, 1],
    [0.964, 0.494, 1],
    [0.985, 0.505, 1],
    [0.987, 0.37, 1],
  ],
  taillight: [
    [0.0, 0.37, 1],
    [0.004, 0.505, 1],
    [0.028, 0.51, 1],
    [0.025, 0.37, 1],
  ],
  tailRibs: 2,
  vents: [],
  cladding: 0,
  stripe: 'none',
  spoiler: 'none',
  spoilerAt: [0.1, 0.58],
  exhaust: { u: 0.035, v: 0.04, side: false },
  seats: [0.4, 0.56],
  wheelU: 0.65,
  beltV: 0.62,
  wheel: { style: 'turbine', count: 6, rim: 0.6, finish: 'silver', caliper: 'grey', lettering: 'subtle', centreLock: false, lugs: 4, rearBrake: 'drum', discDrilled: false },
  archGap: 0.055,
  flare: 0.01,
  lowerTrim: { color: '#2e3033', bumperTop: 0.33, bumperBottom: -0.05, rearU: 0.05, frontU: 0.955, sideTop: 0.31, sideBottom: 0.27, pinstripe: false },
  badges: [{ text: 'SL', u: 0.08, v: 0.42, size: 0.06, color: '#e6e1d4' }],
};

export const saveiroGl94: VehicleDesign = {
  outline: [
    [0.012, 0.04, 1],
    [0.0, 0.1],
    [0.0, 0.56, 1],
    [0.004, 0.605, 1],
    [0.36, 0.605, 1],
    [0.366, 0.94, 1],
    [0.378, 0.99],
    [0.395, 1.0],
    [0.56, 1.0],
    [0.585, 0.988],
    [0.602, 0.966, 1],
    [0.716, 0.63, 1],
    [0.8, 0.603],
    [0.9, 0.55],
    [0.97, 0.5],
    [0.984, 0.484, 1],
    [0.989, 0.41],
    [0.992, 0.335, 1],
    [0.999, 0.312],
    [1.0, 0.22],
    [0.999, 0.08],
    [0.986, 0.022, 1],
  ],
  glass: [
    [
      [0.386, 0.652, 1],
      [0.389, 0.93],
      [0.404, 0.956],
      [0.556, 0.956],
      [0.584, 0.94],
      [0.7, 0.66, 1],
    ],
  ],
  pillars: [{ u: 0.393, lean: 0, w: 0.035 }],
  screens: [
    [
      [0.607, 0.96],
      [0.71, 0.642],
    ],
    [
      [0.369, 0.64],
      [0.372, 0.955],
    ],
  ],
  shoulder: [
    [0.0, 0.58],
    [0.36, 0.59],
    [0.7, 0.586],
    [0.976, 0.468],
  ],
  creases: [
    [
      [0.02, 0.42],
      [0.36, 0.415],
      [0.72, 0.42],
    ],
    [
      [0.006, 0.6],
      [0.358, 0.6],
    ],
  ],
  cuts: [
    [
      [0.016, 0.6],
      [0.016, 0.05],
    ],
    [
      [0.385, 0.646],
      [0.385, 0.02],
    ],
    [
      [0.712, 0.628],
      [0.715, 0.4],
      [0.712, 0.02],
    ],
  ],
  handles: [[0.42, 0.585]],
  mirror: [0.69, 0.666],
  headlight: [
    [0.993, 0.365],
    [0.99, 0.462],
    [0.982, 0.466],
    [0.984, 0.365],
  ],
  cornerLamp: [
    [0.958, 0.365, 1],
    [0.96, 0.452, 1],
    [0.981, 0.466, 1],
    [0.983, 0.365, 1],
  ],
  taillight: [
    [0.001, 0.3, 1],
    [0.004, 0.55, 1],
    [0.022, 0.552, 1],
    [0.02, 0.3, 1],
  ],
  tailRibs: 3,
  vents: [],
  cladding: 0,
  stripe: 'none',
  spoiler: 'none',
  spoilerAt: [0.37, 0.99],
  exhaust: { u: 0.05, v: 0.03, side: false },
  seats: [0.47],
  wheelU: 0.63,
  beltV: 0.652,
  wheel: { style: 'turbine', count: 8, rim: 0.6, finish: 'silver', caliper: 'grey', lettering: 'subtle', centreLock: false, lugs: 4, rearBrake: 'drum', discDrilled: false },
  archGap: 0.06,
  flare: 0.01,
  lowerTrim: { color: '#3b3e42', bumperTop: 0.3, bumperBottom: -0.05, rearU: 0.035, frontU: 0.89, sideTop: 0.29, sideBottom: 0.22, pinstripe: false },
  badges: [{ text: 'GL', u: 0.28, v: 0.47, size: 0.06, color: '#2a2d31' }],
};
