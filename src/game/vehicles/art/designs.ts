import type { BodyStyle } from '../../../data/schema';
import type { P } from './svg';

/**
 * Side-view design of each body style. Original artwork for the fictional cars of this game.
 *
 * Every point is [u, v]: u = x / length (0 = rear bumper, 1 = nose), v = height above the sill
 * as a fraction of the body height (0 = sill, 1 = roof). The designs are stretched to the car's
 * real length and height and the wheel arches are cut at the real axle positions, so the art
 * always agrees with the physics geometry. A third value of 1 marks a sharp corner.
 */
export interface WheelDesign {
  style: 'five' | 'twin' | 'multi' | 'split' | 'turbine';
  count: number;
  /** Rim radius / tyre radius (sidewall height). */
  rim: number;
  finish: 'silver' | 'gunmetal' | 'black' | 'polished';
  /** Brake caliper colour: the car's paint, its accent colour or plain grey. */
  caliper: 'paint' | 'accent' | 'grey';
  lettering: 'subtle' | 'white';
  centreLock: boolean;
}

export interface VehicleDesign {
  /** Upper outline from the rear bumper's lower corner, over the roof, to the front lower corner. */
  outline: P[];
  /** Side glass shapes (closed). */
  glass: P[][];
  /** Black pillars over the glass: u at the belt line, lean (Δu up to the roof), width (m). */
  pillars: { u: number; lean: number; w: number }[];
  /** Windscreen and rear screen seen edge-on (open lines hugging the outline). */
  screens: P[][];
  /** Shoulder line: carries the main highlight and sets the horizon reflection. */
  shoulder: P[];
  creases: P[][];
  /** Panel gaps (doors, boot, bonnet). */
  cuts: P[][];
  handles: [number, number][];
  mirror: [number, number];
  headlight: P[];
  taillight: P[];
  /** Black openings: intakes, vents, grille corners. */
  vents: P[][];
  /** Height (v) of the black lower cladding; 0 = body-coloured sills. */
  cladding: number;
  stripe: 'none' | 'sill' | 'pin' | 'rally';
  spoiler: 'none' | 'roof' | 'roofBig' | 'lip' | 'ducktail' | 'wing';
  /** Where the spoiler attaches (u, v). */
  spoilerAt: [number, number];
  /** Bonnet scoop between these u positions. */
  scoop?: [number, number];
  /** Engine-cover louvres between these u positions (mid-engined cars). */
  louvres?: [number, number];
  exhaust: { u: number; v: number; side: boolean };
  fuelDoor?: [number, number];
  /** Side repeater lamp. */
  marker: [number, number];
  /** Seat backs visible through the glass (u). */
  seats: number[];
  /** Steering wheel position (u). */
  wheelU: number;
  beltV: number;
  wheel: WheelDesign;
  /** Clearance between tyre and arch (m) and width of the arch lip (m). */
  archGap: number;
  flare: number;
}

const hatch: VehicleDesign = {
  outline: [
    [0.022, 0.1, 1],
    [0.004, 0.22],
    [0, 0.42],
    [0.008, 0.58],
    [0.022, 0.7],
    [0.07, 0.82],
    [0.135, 0.93],
    [0.19, 0.972],
    [0.3, 0.995],
    [0.42, 1],
    [0.52, 0.985],
    [0.575, 0.955],
    [0.7, 0.7],
    [0.8, 0.665],
    [0.93, 0.62],
    [0.985, 0.555],
    [1, 0.42],
    [0.998, 0.2],
    [0.975, 0.08, 1],
  ],
  glass: [
    [
      [0.165, 0.7, 1],
      [0.2, 0.875],
      [0.26, 0.94],
      [0.42, 0.955],
      [0.5, 0.945],
      [0.555, 0.92],
      [0.672, 0.675, 1],
    ],
  ],
  pillars: [
    { u: 0.432, lean: -0.006, w: 0.075 },
    { u: 0.262, lean: -0.02, w: 0.05 },
  ],
  screens: [
    [
      [0.585, 0.94],
      [0.697, 0.708],
    ],
    [
      [0.045, 0.76],
      [0.128, 0.915],
    ],
  ],
  shoulder: [
    [0.015, 0.62],
    [0.2, 0.655],
    [0.6, 0.645],
    [0.86, 0.615],
    [0.978, 0.55],
  ],
  creases: [
    [
      [0.275, 0.3],
      [0.5, 0.272],
      [0.7, 0.29],
    ],
  ],
  cuts: [
    [
      [0.662, 0.675],
      [0.668, 0.45],
      [0.66, 0.05],
    ],
    [
      [0.432, 0.69],
      [0.432, 0.04],
    ],
    [
      [0.232, 0.7],
      [0.236, 0.53],
      [0.27, 0.42],
      [0.284, 0.04],
    ],
    [
      [0.03, 0.69],
      [0.04, 0.55],
      [0.018, 0.3],
    ],
  ],
  handles: [
    [0.474, 0.6],
    [0.264, 0.615],
  ],
  mirror: [0.668, 0.7],
  headlight: [
    [0.999, 0.5],
    [0.99, 0.59],
    [0.955, 0.628],
    [0.9, 0.635],
    [0.925, 0.575],
    [0.965, 0.51],
  ],
  taillight: [
    [0.003, 0.48],
    [0.008, 0.6],
    [0.024, 0.7],
    [0.055, 0.7],
    [0.04, 0.59],
    [0.028, 0.48],
  ],
  vents: [
    [
      [0.997, 0.2, 1],
      [0.992, 0.3, 1],
      [0.95, 0.31, 1],
      [0.944, 0.2, 1],
    ],
  ],
  cladding: 0.1,
  stripe: 'none',
  spoiler: 'roof',
  spoilerAt: [0.17, 0.958],
  exhaust: { u: 0.012, v: 0.11, side: false },
  fuelDoor: [0.1, 0.5],
  marker: [0.752, 0.54],
  seats: [0.325, 0.535],
  wheelU: 0.62,
  beltV: 0.685,
  wheel: { style: 'multi', count: 7, rim: 0.6, finish: 'silver', caliper: 'grey', lettering: 'subtle', centreLock: false },
  archGap: 0.06,
  flare: 0.012,
};

const hotHatch: VehicleDesign = {
  outline: [
    [0.022, 0.09, 1],
    [0.003, 0.2],
    [0, 0.42],
    [0.01, 0.6],
    [0.03, 0.715],
    [0.075, 0.82],
    [0.14, 0.925],
    [0.195, 0.968],
    [0.3, 0.994],
    [0.42, 1],
    [0.52, 0.982],
    [0.58, 0.945],
    [0.715, 0.675],
    [0.82, 0.635],
    [0.94, 0.575],
    [0.988, 0.5],
    [1, 0.36],
    [0.997, 0.16],
    [0.97, 0.06, 1],
  ],
  glass: [
    [
      [0.17, 0.725, 1],
      [0.205, 0.875],
      [0.265, 0.935],
      [0.42, 0.953],
      [0.505, 0.94],
      [0.56, 0.912],
      [0.685, 0.675, 1],
    ],
  ],
  pillars: [
    { u: 0.43, lean: -0.008, w: 0.08 },
    { u: 0.268, lean: -0.02, w: 0.05 },
  ],
  screens: [
    [
      [0.59, 0.93],
      [0.711, 0.685],
    ],
    [
      [0.052, 0.765],
      [0.133, 0.91],
    ],
  ],
  shoulder: [
    [0.015, 0.655],
    [0.2, 0.685],
    [0.6, 0.655],
    [0.86, 0.605],
    [0.978, 0.5],
  ],
  creases: [
    [
      [0.29, 0.34],
      [0.5, 0.29],
      [0.7, 0.27],
    ],
  ],
  cuts: [
    [
      [0.674, 0.675],
      [0.68, 0.45],
      [0.668, 0.05],
    ],
    [
      [0.43, 0.7],
      [0.43, 0.04],
    ],
    [
      [0.24, 0.72],
      [0.244, 0.56],
      [0.28, 0.45],
      [0.295, 0.04],
    ],
    [
      [0.04, 0.705],
      [0.05, 0.56],
      [0.02, 0.3],
    ],
  ],
  handles: [
    [0.472, 0.612],
    [0.274, 0.634],
  ],
  mirror: [0.68, 0.7],
  headlight: [
    [0.999, 0.44],
    [0.992, 0.535],
    [0.955, 0.585],
    [0.895, 0.6],
    [0.925, 0.54],
    [0.968, 0.455],
  ],
  taillight: [
    [0.004, 0.5],
    [0.012, 0.63],
    [0.036, 0.715],
    [0.082, 0.705],
    [0.058, 0.61],
    [0.03, 0.5],
  ],
  vents: [
    [
      [0.997, 0.14, 1],
      [0.99, 0.29, 1],
      [0.94, 0.3, 1],
      [0.93, 0.13, 1],
    ],
  ],
  cladding: 0.075,
  stripe: 'sill',
  spoiler: 'roofBig',
  spoilerAt: [0.175, 0.952],
  exhaust: { u: 0.012, v: 0.1, side: false },
  fuelDoor: [0.108, 0.52],
  marker: [0.75, 0.52],
  seats: [0.33, 0.535],
  wheelU: 0.63,
  beltV: 0.69,
  wheel: { style: 'twin', count: 5, rim: 0.7, finish: 'gunmetal', caliper: 'accent', lettering: 'subtle', centreLock: false },
  archGap: 0.05,
  flare: 0.016,
};

const coupe: VehicleDesign = {
  outline: [
    [0.016, 0.11, 1],
    [0.001, 0.24],
    [0.002, 0.45],
    [0.012, 0.6],
    [0.028, 0.695],
    [0.1, 0.715],
    [0.2, 0.8],
    [0.3, 0.93],
    [0.38, 0.99],
    [0.45, 1.0],
    [0.52, 0.975],
    [0.636, 0.7],
    [0.78, 0.66],
    [0.92, 0.585],
    [0.98, 0.5],
    [1.0, 0.37],
    [0.995, 0.17],
    [0.972, 0.07, 1],
  ],
  glass: [
    [
      [0.238, 0.728, 1],
      [0.306, 0.88],
      [0.385, 0.944],
      [0.45, 0.955],
      [0.504, 0.934],
      [0.61, 0.715, 1],
    ],
  ],
  pillars: [{ u: 0.392, lean: -0.014, w: 0.05 }],
  screens: [
    [
      [0.528, 0.962],
      [0.632, 0.708],
    ],
    [
      [0.205, 0.815],
      [0.3, 0.925],
    ],
  ],
  shoulder: [
    [0.015, 0.65],
    [0.2, 0.705],
    [0.45, 0.678],
    [0.75, 0.645],
    [0.972, 0.52],
  ],
  creases: [
    [
      [0.31, 0.33],
      [0.5, 0.3],
      [0.69, 0.3],
    ],
  ],
  cuts: [
    [
      [0.6, 0.712],
      [0.606, 0.45],
      [0.597, 0.05],
    ],
    [
      [0.37, 0.724],
      [0.366, 0.4],
      [0.337, 0.05],
    ],
    [
      [0.03, 0.68],
      [0.04, 0.55],
    ],
  ],
  handles: [[0.402, 0.636]],
  mirror: [0.606, 0.735],
  headlight: [
    [0.998, 0.43],
    [0.988, 0.51],
    [0.94, 0.565],
    [0.89, 0.585],
    [0.925, 0.52],
    [0.972, 0.44],
  ],
  taillight: [
    [0.004, 0.5],
    [0.012, 0.61],
    [0.03, 0.685],
    [0.09, 0.7],
    [0.07, 0.62],
    [0.03, 0.51],
  ],
  vents: [
    [
      [0.7, 0.4, 1],
      [0.704, 0.52, 1],
      [0.682, 0.52, 1],
      [0.672, 0.4, 1],
    ],
    [
      [0.996, 0.16, 1],
      [0.988, 0.29, 1],
      [0.945, 0.29, 1],
      [0.94, 0.16, 1],
    ],
  ],
  cladding: 0.055,
  stripe: 'pin',
  spoiler: 'lip',
  spoilerAt: [0.028, 0.695],
  exhaust: { u: 0.01, v: 0.115, side: false },
  fuelDoor: [0.13, 0.56],
  marker: [0.745, 0.5],
  seats: [0.45],
  wheelU: 0.555,
  beltV: 0.72,
  wheel: { style: 'five', count: 5, rim: 0.68, finish: 'silver', caliper: 'accent', lettering: 'subtle', centreLock: false },
  archGap: 0.05,
  flare: 0.014,
};

const sedan: VehicleDesign = {
  outline: [
    [0.014, 0.1, 1],
    [0.001, 0.22],
    [0.002, 0.42],
    [0.01, 0.55],
    [0.022, 0.665],
    [0.1, 0.685],
    [0.165, 0.7],
    [0.265, 0.93],
    [0.36, 0.995],
    [0.47, 1.0],
    [0.555, 0.975],
    [0.69, 0.685],
    [0.8, 0.645],
    [0.93, 0.585],
    [0.985, 0.5],
    [1.0, 0.36],
    [0.995, 0.16],
    [0.975, 0.07, 1],
  ],
  glass: [
    [
      [0.202, 0.708, 1],
      [0.276, 0.895],
      [0.36, 0.953],
      [0.47, 0.96],
      [0.543, 0.938],
      [0.664, 0.703, 1],
    ],
  ],
  pillars: [
    { u: 0.446, lean: -0.004, w: 0.075 },
    { u: 0.268, lean: 0.004, w: 0.035 },
  ],
  screens: [
    [
      [0.563, 0.962],
      [0.686, 0.694],
    ],
    [
      [0.172, 0.715],
      [0.262, 0.922],
    ],
  ],
  shoulder: [
    [0.012, 0.6],
    [0.3, 0.64],
    [0.7, 0.632],
    [0.972, 0.52],
  ],
  creases: [
    [
      [0.315, 0.3],
      [0.5, 0.285],
      [0.71, 0.3],
    ],
  ],
  cuts: [
    [
      [0.655, 0.7],
      [0.661, 0.45],
      [0.652, 0.05],
    ],
    [
      [0.446, 0.7],
      [0.446, 0.04],
    ],
    [
      [0.262, 0.706],
      [0.263, 0.56],
      [0.3, 0.44],
      [0.314, 0.04],
    ],
    [
      [0.03, 0.655],
      [0.044, 0.5],
    ],
  ],
  handles: [
    [0.486, 0.622],
    [0.298, 0.634],
  ],
  mirror: [0.66, 0.722],
  headlight: [
    [0.997, 0.45],
    [0.986, 0.53],
    [0.945, 0.575],
    [0.9, 0.588],
    [0.928, 0.535],
    [0.972, 0.465],
  ],
  taillight: [
    [0.004, 0.5],
    [0.011, 0.59],
    [0.026, 0.655],
    [0.085, 0.67],
    [0.068, 0.59],
    [0.022, 0.505],
  ],
  vents: [
    [
      [0.996, 0.15, 1],
      [0.988, 0.28, 1],
      [0.945, 0.28, 1],
      [0.94, 0.15, 1],
    ],
  ],
  cladding: 0.05,
  stripe: 'none',
  spoiler: 'lip',
  spoilerAt: [0.022, 0.665],
  exhaust: { u: 0.008, v: 0.105, side: false },
  fuelDoor: [0.15, 0.53],
  marker: [0.74, 0.49],
  seats: [0.345, 0.54],
  wheelU: 0.615,
  beltV: 0.705,
  wheel: { style: 'multi', count: 10, rim: 0.69, finish: 'gunmetal', caliper: 'accent', lettering: 'subtle', centreLock: false },
  archGap: 0.05,
  flare: 0.012,
};

const muscle: VehicleDesign = {
  outline: [
    [0.013, 0.13, 1],
    [0.001, 0.27],
    [0.0, 0.5],
    [0.006, 0.63],
    [0.02, 0.705],
    [0.1, 0.71],
    [0.165, 0.725],
    [0.26, 0.9],
    [0.33, 0.985],
    [0.42, 1.0],
    [0.5, 0.985],
    [0.6, 0.718],
    [0.74, 0.692],
    [0.9, 0.665],
    [0.975, 0.628],
    [0.998, 0.55],
    [1.0, 0.34],
    [0.99, 0.17],
    [0.965, 0.08, 1],
  ],
  glass: [
    [
      [0.205, 0.74, 1],
      [0.272, 0.882],
      [0.336, 0.944],
      [0.42, 0.955],
      [0.484, 0.938],
      [0.575, 0.732, 1],
    ],
  ],
  pillars: [{ u: 0.355, lean: -0.012, w: 0.05 }],
  screens: [
    [
      [0.507, 0.972],
      [0.597, 0.726],
    ],
    [
      [0.172, 0.74],
      [0.257, 0.892],
    ],
  ],
  shoulder: [
    [0.012, 0.655],
    [0.15, 0.7],
    [0.26, 0.722],
    [0.4, 0.69],
    [0.7, 0.665],
    [0.972, 0.6],
  ],
  creases: [
    [
      [0.34, 0.36],
      [0.5, 0.33],
      [0.68, 0.33],
    ],
  ],
  cuts: [
    [
      [0.585, 0.725],
      [0.59, 0.45],
      [0.58, 0.05],
    ],
    [
      [0.335, 0.735],
      [0.33, 0.4],
      [0.326, 0.05],
    ],
    [
      [0.026, 0.69],
      [0.034, 0.56],
    ],
  ],
  handles: [[0.366, 0.642]],
  mirror: [0.578, 0.752],
  headlight: [
    [0.999, 0.48],
    [0.996, 0.585],
    [0.965, 0.618],
    [0.93, 0.625],
    [0.935, 0.55],
    [0.975, 0.48],
  ],
  taillight: [
    [0.002, 0.52],
    [0.006, 0.63],
    [0.02, 0.695],
    [0.075, 0.7],
    [0.07, 0.62],
    [0.02, 0.525],
  ],
  vents: [
    [
      [0.7, 0.5, 1],
      [0.7, 0.585, 1],
      [0.662, 0.585, 1],
      [0.668, 0.5, 1],
    ],
    [
      [0.997, 0.18, 1],
      [0.994, 0.32, 1],
      [0.95, 0.32, 1],
      [0.94, 0.18, 1],
    ],
  ],
  cladding: 0.045,
  stripe: 'rally',
  spoiler: 'ducktail',
  spoilerAt: [0.02, 0.705],
  scoop: [0.69, 0.84],
  exhaust: { u: 0.018, v: 0.08, side: false },
  fuelDoor: [0.12, 0.57],
  marker: [0.76, 0.52],
  seats: [0.42],
  wheelU: 0.52,
  beltV: 0.735,
  wheel: { style: 'five', count: 5, rim: 0.6, finish: 'polished', caliper: 'grey', lettering: 'white', centreLock: false },
  archGap: 0.065,
  flare: 0.02,
};

const supercar: VehicleDesign = {
  outline: [
    [0.022, 0.15, 1],
    [0.003, 0.3],
    [0.0, 0.5],
    [0.01, 0.66],
    [0.03, 0.74],
    [0.12, 0.765],
    [0.24, 0.805],
    [0.34, 0.9],
    [0.43, 0.985],
    [0.5, 1.0],
    [0.57, 0.975],
    [0.72, 0.672],
    [0.8, 0.632],
    [0.9, 0.51],
    [0.97, 0.365],
    [1.0, 0.24],
    [0.995, 0.12],
    [0.975, 0.05, 1],
  ],
  glass: [
    [
      [0.372, 0.752, 1],
      [0.412, 0.895],
      [0.456, 0.948],
      [0.505, 0.96],
      [0.558, 0.938],
      [0.692, 0.69, 1],
    ],
  ],
  pillars: [{ u: 0.445, lean: -0.012, w: 0.045 }],
  screens: [
    [
      [0.578, 0.962],
      [0.716, 0.68],
    ],
    [
      [0.25, 0.815],
      [0.335, 0.895],
    ],
  ],
  shoulder: [
    [0.015, 0.7],
    [0.2, 0.74],
    [0.42, 0.715],
    [0.7, 0.64],
    [0.86, 0.555],
    [0.985, 0.3],
  ],
  creases: [
    [
      [0.42, 0.3],
      [0.55, 0.25],
      [0.68, 0.22],
    ],
  ],
  cuts: [
    [
      [0.688, 0.668],
      [0.698, 0.4],
      [0.684, 0.06],
    ],
    [
      [0.43, 0.742],
      [0.44, 0.45],
      [0.425, 0.06],
    ],
  ],
  handles: [[0.462, 0.672]],
  mirror: [0.672, 0.725],
  headlight: [
    [0.985, 0.305],
    [0.965, 0.385],
    [0.915, 0.475],
    [0.875, 0.5],
    [0.905, 0.42],
    [0.955, 0.32],
  ],
  taillight: [
    [0.004, 0.56],
    [0.012, 0.665],
    [0.032, 0.728],
    [0.1, 0.745],
    [0.085, 0.685],
    [0.025, 0.57],
  ],
  vents: [
    [
      [0.312, 0.36, 1],
      [0.34, 0.635, 1],
      [0.385, 0.655, 1],
      [0.418, 0.6, 1],
      [0.408, 0.46, 1],
      [0.385, 0.365, 1],
    ],
    [
      [0.992, 0.09, 1],
      [0.986, 0.19, 1],
      [0.93, 0.21, 1],
      [0.924, 0.09, 1],
    ],
    [
      [0.018, 0.2, 1],
      [0.012, 0.42, 1],
      [0.06, 0.42, 1],
      [0.07, 0.2, 1],
    ],
  ],
  cladding: 0.06,
  stripe: 'sill',
  spoiler: 'wing',
  spoilerAt: [0.045, 0.745],
  louvres: [0.1, 0.25],
  exhaust: { u: 0.008, v: 0.31, side: false },
  marker: [0.76, 0.46],
  seats: [0.5],
  wheelU: 0.615,
  beltV: 0.72,
  wheel: { style: 'split', count: 5, rim: 0.76, finish: 'black', caliper: 'paint', lettering: 'subtle', centreLock: false },
  archGap: 0.045,
  flare: 0.015,
};

const prototype: VehicleDesign = {
  outline: [
    [0.016, 0.16, 1],
    [0.001, 0.3],
    [0.0, 0.52],
    [0.004, 0.67],
    [0.006, 0.775, 1],
    [0.1, 0.745],
    [0.2, 0.79],
    [0.29, 0.91],
    [0.36, 0.985],
    [0.42, 1.0],
    [0.48, 0.975],
    [0.585, 0.705],
    [0.7, 0.678],
    [0.8, 0.655],
    [0.9, 0.57],
    [0.965, 0.45],
    [1.0, 0.31],
    [0.995, 0.15],
    [0.975, 0.06, 1],
  ],
  glass: [
    [
      [0.248, 0.762, 1],
      [0.306, 0.884],
      [0.366, 0.944],
      [0.42, 0.955],
      [0.468, 0.934],
      [0.565, 0.728, 1],
    ],
  ],
  pillars: [{ u: 0.345, lean: -0.012, w: 0.045 }],
  screens: [
    [
      [0.488, 0.96],
      [0.582, 0.712],
    ],
    [
      [0.205, 0.8],
      [0.287, 0.905],
    ],
  ],
  shoulder: [
    [0.012, 0.7],
    [0.2, 0.74],
    [0.42, 0.705],
    [0.7, 0.665],
    [0.87, 0.6],
    [0.985, 0.38],
  ],
  creases: [
    [
      [0.33, 0.34],
      [0.5, 0.3],
      [0.66, 0.3],
    ],
  ],
  cuts: [
    [
      [0.565, 0.715],
      [0.575, 0.45],
      [0.56, 0.06],
    ],
    [
      [0.335, 0.752],
      [0.34, 0.45],
      [0.33, 0.06],
    ],
    [
      [0.6, 0.69],
      [0.78, 0.648],
      [0.9, 0.56],
    ],
  ],
  handles: [[0.362, 0.67]],
  mirror: [0.558, 0.755],
  headlight: [
    [0.992, 0.35],
    [0.975, 0.44],
    [0.935, 0.52],
    [0.895, 0.555],
    [0.915, 0.47],
    [0.962, 0.36],
  ],
  taillight: [
    [0.002, 0.6],
    [0.005, 0.7],
    [0.012, 0.76],
    [0.085, 0.74],
    [0.075, 0.69],
    [0.02, 0.61],
  ],
  vents: [
    [
      [0.682, 0.42, 1],
      [0.694, 0.6, 1],
      [0.679, 0.6, 1],
      [0.667, 0.42, 1],
    ],
    [
      [0.658, 0.42, 1],
      [0.67, 0.6, 1],
      [0.655, 0.6, 1],
      [0.643, 0.42, 1],
    ],
    [
      [0.634, 0.42, 1],
      [0.646, 0.6, 1],
      [0.631, 0.6, 1],
      [0.619, 0.42, 1],
    ],
    [
      [0.994, 0.12, 1],
      [0.986, 0.24, 1],
      [0.935, 0.25, 1],
      [0.93, 0.12, 1],
    ],
  ],
  cladding: 0.055,
  stripe: 'pin',
  spoiler: 'none',
  spoilerAt: [0.006, 0.775],
  exhaust: { u: 0.35, v: 0.0, side: true },
  marker: [0.76, 0.5],
  seats: [0.435],
  wheelU: 0.515,
  beltV: 0.745,
  wheel: { style: 'turbine', count: 11, rim: 0.74, finish: 'silver', caliper: 'paint', lettering: 'subtle', centreLock: true },
  archGap: 0.045,
  flare: 0.014,
};

export const DESIGNS: Record<BodyStyle, VehicleDesign> = { hatch, hotHatch, coupe, sedan, muscle, supercar, prototype };

/** Height of the upper outline (v) at position u, measured on the roof side of the silhouette. */
export function outlineV(d: VehicleDesign, u: number): number {
  let best = 0;
  for (let i = 0; i < d.outline.length - 1; i++) {
    const a = d.outline[i]!;
    const b = d.outline[i + 1]!;
    const lo = Math.min(a[0], b[0]);
    const hi = Math.max(a[0], b[0]);
    if (u < lo || u > hi || hi - lo < 1e-6) continue;
    const t = (u - a[0]) / (b[0] - a[0]);
    best = Math.max(best, a[1] + (b[1] - a[1]) * t);
  }
  return best;
}
