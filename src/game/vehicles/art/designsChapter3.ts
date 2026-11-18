import type { VehicleDesign, WheelDesign } from './designs';
import type { P } from './svg';

/**
 * Side-view designs of the eight Chapter 3 cars. Original vector artwork built from each car's
 * documented length, height, wheelbase and overhangs (the arches are cut at the real axles) and
 * from the proportions of the body of the chosen generation; no photograph, logo or emblem is
 * embedded — only model lettering.
 *
 * u = 0 rear bumper … 1 nose, v = 0 sill … 1 roof (designs.ts conventions). Each car is described
 * by the few numbers that make its silhouette — where the bonnet ends and the screen starts, where
 * the roof peaks, how far the rear glass sweeps down, how high the tail stands — and `body()`
 * turns them into the full layered design, so the eight silhouettes differ in their proportions
 * and not only in their colour:
 *  - 350Z (Z33):   short, low two-door fastback, big rounded hatch glass, flared haunches,
 *                  five-spoke 18".
 *  - IS 350 F Sport: compact sport sedan, arched roof flowing into a short boot, big spindle
 *                  front, F Sport mesh, twin tailpipes at the corners.
 *  - 370Z (Z34):   the Z33 sharper: boomerang lamps, shorter overhangs, rear glass lower, 19"
 *                  multi-spoke, ducktail lip.
 *  - AMG C 43 (W205): cab-backward sedan, long bonnet, short high boot, AMG Panamericana-style
 *                  grille (vertical bars), twin tips, 18" twin-spoke.
 *  - Stinger GT:   long liftback: low roof sweeping to a lipped hatch, long bonnet with the two
 *                  side vents, four-lamp tail, 19".
 *  - Ghibli S Q4:  the longest: low coupe-like roof, three side vents behind the front wheel,
 *                  big oval grille, long rear overhang.
 *  - Giulia QV:    short overhangs, tall tail with a carbon ducktail, bonnet vent, triangle
 *                  grille, forged 19".
 *  - GT-R (R35):   wide, squared-off kamm tail, tall rear wing, big round lamps, flared arches,
 *                  rear diffuser and four round tips, 20".
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

const seg = (a: P, b: P): P[] => [a, b];

interface Body {
  /** Boot / hatch top edge at the very rear (v). */
  tailV: number;
  /** Where the deck ends and the rear glass starts (u, v). */
  deckU: number;
  deckV: number;
  /** Rear glass meets the roof (u). */
  rearTopU: number;
  /** Roof flat between these u. */
  roofRearU: number;
  roofFrontU: number;
  /** Windscreen top (u) and base at the cowl (u, v). */
  frontTopU: number;
  cowlU: number;
  cowlV: number;
  /** Leading edge of the bonnet (v). */
  noseV: number;
  /** Belt line (v) and the position of the B pillar (u). */
  beltV: number;
  bU: number;
  wheelU: number;
  /** Two-door coupé: one long door and no rear-door cut. */
  doors?: 2 | 4;
}

type Extras = Partial<VehicleDesign> & Pick<VehicleDesign, 'wheel' | 'spoiler' | 'spoilerAt' | 'exhaust' | 'cladding'>;

function body(b: Body, x: Extras): VehicleDesign {
  const coupe = b.doors === 2;
  const hoodMid: P = [(b.cowlU + 1) / 2 + 0.02, b.cowlV - (b.cowlV - b.noseV) * 0.55];
  const outline: P[] = [
    [0.016, 0.05, 1],
    [0.0, 0.17],
    [0.0, Math.max(0.3, b.tailV - 0.16)],
    [0.012, b.tailV - 0.03],
    [0.045, b.tailV],
    [b.deckU, b.deckV],
    [(b.deckU + b.rearTopU) / 2, (b.deckV + 0.94) / 2],
    [b.rearTopU, 0.95],
    [b.roofRearU, 0.995],
    [(b.roofRearU + b.roofFrontU) / 2, 1.0],
    [b.roofFrontU, 0.99],
    [b.frontTopU, 0.95],
    [b.cowlU, b.cowlV, 1],
    hoodMid,
    [0.965, b.noseV + 0.03],
    [0.992, b.noseV + 0.005],
    [1.0, b.noseV - 0.1],
    [0.998, 0.16],
    [0.985, 0.06],
    [0.97, 0.03, 1],
  ];
  const gR = b.rearTopU + 0.045;
  const glass: P[][] = [
    [
      [Math.min(gR - 0.02, b.deckU + 0.1), b.beltV, 1],
      [gR, 0.9],
      [b.roofRearU + 0.035, 0.955],
      [(b.roofRearU + b.roofFrontU) / 2, 0.965],
      [b.roofFrontU - 0.02, 0.95],
      [b.cowlU - 0.02, b.beltV, 1],
    ],
  ];
  const screens: P[][] = [seg([b.roofFrontU + 0.005, 0.975], [b.cowlU - 0.005, b.cowlV + 0.005]), seg([b.rearTopU + 0.004, 0.94], [Math.max(0.03, b.deckU + 0.01), b.deckV + 0.01])];
  const shoulder: P[] = [
    [0.02, b.beltV - 0.04],
    [0.3, b.beltV + 0.02],
    [0.62, b.beltV],
    [0.95, b.noseV + 0.05],
  ];
  const d: VehicleDesign = {
    outline,
    glass,
    pillars: coupe
      ? [{ u: b.deckU + 0.3, lean: 0.05, w: 0.055 }]
      : [
          { u: b.bU, lean: -0.01, w: 0.05 },
          { u: b.bU - 0.2, lean: 0.06, w: 0.06 },
        ],
    screens,
    shoulder,
    creases: [
      [
        [0.14, b.beltV - 0.22],
        [0.5, b.beltV - 0.26],
        [0.86, b.beltV - 0.2],
      ],
    ],
    cuts: coupe
      ? [seg([b.cowlU - 0.02, b.cowlV - 0.02], [b.cowlU - 0.012, 0.04]), seg([b.deckU + 0.3, b.beltV + 0.03], [b.deckU + 0.295, 0.04])]
      : [
          seg([b.bU + 0.2, b.beltV + 0.02], [b.bU + 0.21, 0.04]),
          seg([b.bU, b.beltV + 0.04], [b.bU - 0.008, 0.04]),
          seg([b.bU - 0.2, b.beltV + 0.03], [b.bU - 0.195, 0.28]),
          seg([b.cowlU - 0.02, b.cowlV - 0.02], [b.cowlU - 0.012, 0.04]),
        ],
    handles: coupe
      ? [[b.deckU + 0.38, b.beltV - 0.02]]
      : [
          [b.bU + 0.1, b.beltV - 0.02],
          [b.bU - 0.1, b.beltV - 0.015],
        ],
    mirror: [b.cowlU - 0.04, b.beltV + 0.04],
    headlight: [
      [0.998, b.noseV - 0.08],
      [0.975, b.noseV + 0.04],
      [0.915, b.noseV + 0.085],
      [0.9, b.noseV + 0.06],
      [0.95, b.noseV - 0.01],
      [0.995, b.noseV - 0.1],
    ],
    taillight: [
      [0.003, b.tailV - 0.14, 1],
      [0.012, b.tailV - 0.02, 1],
      [0.1, b.tailV + 0.01],
      [0.09, b.tailV - 0.09],
      [0.03, b.tailV - 0.15, 1],
    ],
    vents: [
      [
        [0.995, 0.08, 1],
        [0.998, 0.21, 1],
        [0.955, 0.22, 1],
        [0.94, 0.08, 1],
      ],
    ],
    cladding: 0.04,
    stripe: 'none',
    spoiler: 'none',
    spoilerAt: [0.05, b.tailV],
    exhaust: { u: 0.03, v: 0.04, side: false },
    fuelDoor: [0.16, b.beltV - 0.02],
    seats: coupe ? [b.deckU + 0.42, b.deckU + 0.28] : [b.bU - 0.04, b.bU - 0.2],
    wheelU: b.wheelU,
    beltV: b.beltV,
    wheel: x.wheel,
    archGap: 0.035,
    flare: 0.012,
  };
  return { ...d, ...x };
}

// ---------------------------------------------------------------- Nissan 350Z (Z33)
export const nissan350z: VehicleDesign = body(
  { tailV: 0.62, deckU: 0.06, deckV: 0.7, rearTopU: 0.33, roofRearU: 0.4, roofFrontU: 0.53, frontTopU: 0.6, cowlU: 0.71, cowlV: 0.62, noseV: 0.44, beltV: 0.6, bU: 0.5, wheelU: 0.66, doors: 2 },
  {
    wheel: W({ style: 'five', count: 5, rim: 0.74, finish: 'silver', caliper: 'accent' }),
    spoiler: 'lip',
    spoilerAt: [0.045, 0.64],
    cladding: 0.05,
    flare: 0.02,
    exhaust: { u: 0.04, v: 0.045, side: false },
    badges: [{ text: '350Z', u: 0.085, v: 0.52, size: 0.04, color: '#d8dbde' }],
    vents: [
      [
        [0.995, 0.07, 1],
        [0.998, 0.2, 1],
        [0.95, 0.2, 1],
        [0.94, 0.07, 1],
      ],
    ],
  },
);

// ---------------------------------------------------------------- Lexus IS 350 F Sport
export const lexusIs350: VehicleDesign = body(
  { tailV: 0.66, deckU: 0.15, deckV: 0.69, rearTopU: 0.285, roofRearU: 0.34, roofFrontU: 0.56, frontTopU: 0.63, cowlU: 0.765, cowlV: 0.66, noseV: 0.52, beltV: 0.64, bU: 0.49, wheelU: 0.67 },
  {
    wheel: W({ style: 'multi', count: 10, rim: 0.72, finish: 'gunmetal' }),
    spoiler: 'none',
    spoilerAt: [0.06, 0.68],
    cladding: 0.045,
    exhaust: { u: 0.035, v: 0.04, side: false },
    badges: [{ text: 'IS 350', u: 0.09, v: 0.56, size: 0.04, color: '#d5d8dc' }],
    vents: [
      [
        [0.995, 0.06, 1],
        [0.998, 0.26, 1],
        [0.94, 0.27, 1],
        [0.93, 0.06, 1],
      ],
    ],
  },
);

// ---------------------------------------------------------------- Nissan 370Z (Z34)
export const nissan370z: VehicleDesign = body(
  { tailV: 0.58, deckU: 0.05, deckV: 0.66, rearTopU: 0.3, roofRearU: 0.37, roofFrontU: 0.52, frontTopU: 0.59, cowlU: 0.7, cowlV: 0.61, noseV: 0.43, beltV: 0.59, bU: 0.49, wheelU: 0.67, doors: 2 },
  {
    wheel: W({ style: 'multi', count: 14, rim: 0.76, finish: 'gunmetal', caliper: 'accent', discDrilled: true }),
    spoiler: 'ducktail',
    spoilerAt: [0.04, 0.6],
    cladding: 0.05,
    flare: 0.024,
    exhaust: { u: 0.035, v: 0.04, side: false },
    badges: [{ text: '370Z', u: 0.085, v: 0.5, size: 0.04, color: '#d8dbde' }],
    headlight: [
      [0.998, 0.35],
      [0.98, 0.44],
      [0.93, 0.5],
      [0.915, 0.46],
      [0.96, 0.4],
      [0.996, 0.33],
    ],
    taillight: [
      [0.003, 0.46, 1],
      [0.014, 0.57, 1],
      [0.09, 0.6],
      [0.085, 0.52],
      [0.04, 0.47, 1],
    ],
  },
);

// ---------------------------------------------------------------- Mercedes-AMG C 43 (W205)
export const amgC43: VehicleDesign = body(
  { tailV: 0.67, deckU: 0.14, deckV: 0.7, rearTopU: 0.27, roofRearU: 0.325, roofFrontU: 0.53, frontTopU: 0.6, cowlU: 0.78, cowlV: 0.67, noseV: 0.5, beltV: 0.65, bU: 0.49, wheelU: 0.66 },
  {
    wheel: W({ style: 'twin', count: 5, rim: 0.73, finish: 'gunmetal', caliper: 'grey', discDrilled: true }),
    spoiler: 'lip',
    spoilerColor: 'paint',
    spoilerAt: [0.1, 0.7],
    cladding: 0.05,
    exhaust: { u: 0.035, v: 0.04, side: false },
    badges: [{ text: 'C 43', u: 0.09, v: 0.58, size: 0.04, color: '#d5d8dc' }],
    vents: [
      [
        [0.995, 0.07, 1],
        [0.998, 0.28, 1],
        [0.935, 0.29, 1],
        [0.925, 0.07, 1],
      ],
    ],
  },
);

// ---------------------------------------------------------------- Kia Stinger GT
export const kiaStingerGt: VehicleDesign = body(
  { tailV: 0.6, deckU: 0.04, deckV: 0.72, rearTopU: 0.31, roofRearU: 0.36, roofFrontU: 0.55, frontTopU: 0.62, cowlU: 0.775, cowlV: 0.64, noseV: 0.5, beltV: 0.62, bU: 0.5, wheelU: 0.68 },
  {
    wheel: W({ style: 'multi', count: 10, rim: 0.73, finish: 'gunmetal', caliper: 'accent', discDrilled: true }),
    spoiler: 'hatchLip',
    spoilerAt: [0.035, 0.7],
    cladding: 0.05,
    exhaust: { u: 0.035, v: 0.04, side: false },
    badges: [{ text: 'GT', u: 0.085, v: 0.52, size: 0.045, color: '#d5d8dc' }],
    vents: [
      [
        [0.995, 0.07, 1],
        [0.998, 0.25, 1],
        [0.94, 0.26, 1],
        [0.93, 0.07, 1],
      ],
      // the two vents on the front wing
      [
        [0.84, 0.36, 1],
        [0.88, 0.37, 1],
        [0.88, 0.31, 1],
        [0.84, 0.3, 1],
      ],
    ],
  },
);

// ---------------------------------------------------------------- Maserati Ghibli S Q4
export const maseratiGhibli: VehicleDesign = body(
  { tailV: 0.6, deckU: 0.14, deckV: 0.67, rearTopU: 0.285, roofRearU: 0.345, roofFrontU: 0.57, frontTopU: 0.64, cowlU: 0.79, cowlV: 0.65, noseV: 0.48, beltV: 0.63, bU: 0.5, wheelU: 0.68 },
  {
    wheel: W({ style: 'five', count: 5, rim: 0.72, finish: 'gunmetal', caliper: 'accent' }),
    spoiler: 'lip',
    spoilerAt: [0.09, 0.68],
    cladding: 0.05,
    exhaust: { u: 0.035, v: 0.04, side: false },
    badges: [{ text: 'Q4', u: 0.09, v: 0.54, size: 0.04, color: '#d5b25a' }],
    vents: [
      [
        [0.995, 0.06, 1],
        [0.998, 0.27, 1],
        [0.94, 0.28, 1],
        [0.93, 0.06, 1],
      ],
      // three vents behind the front wheel
      [
        [0.78, 0.33, 1],
        [0.84, 0.36, 1],
        [0.84, 0.32, 1],
        [0.78, 0.29, 1],
      ],
      [
        [0.73, 0.33, 1],
        [0.77, 0.35, 1],
        [0.77, 0.31, 1],
        [0.73, 0.29, 1],
      ],
    ],
  },
);

// ---------------------------------------------------------------- Alfa Romeo Giulia Quadrifoglio
export const alfaGiuliaQv: VehicleDesign = body(
  { tailV: 0.66, deckU: 0.11, deckV: 0.7, rearTopU: 0.265, roofRearU: 0.315, roofFrontU: 0.52, frontTopU: 0.59, cowlU: 0.76, cowlV: 0.66, noseV: 0.5, beltV: 0.64, bU: 0.49, wheelU: 0.67 },
  {
    wheel: W({ style: 'five', count: 5, rim: 0.75, finish: 'gunmetal', caliper: 'accent', discDrilled: true }),
    spoiler: 'ducktail',
    spoilerColor: 'black',
    spoilerAt: [0.045, 0.68],
    cladding: 0.05,
    flare: 0.018,
    exhaust: { u: 0.035, v: 0.045, side: false },
    badges: [{ text: 'QV', u: 0.095, v: 0.56, size: 0.045, color: '#d6c23a' }],
    vents: [
      [
        [0.995, 0.06, 1],
        [0.998, 0.28, 1],
        [0.94, 0.28, 1],
        [0.93, 0.06, 1],
      ],
      // bonnet vent
      [
        [0.86, 0.58, 1],
        [0.92, 0.55, 1],
        [0.92, 0.52, 1],
        [0.86, 0.55, 1],
      ],
    ],
  },
);

// ---------------------------------------------------------------- Nissan GT-R (R35)
export const nissanGtrR35: VehicleDesign = body(
  { tailV: 0.74, deckU: 0.12, deckV: 0.78, rearTopU: 0.3, roofRearU: 0.35, roofFrontU: 0.5, frontTopU: 0.57, cowlU: 0.72, cowlV: 0.64, noseV: 0.46, beltV: 0.6, bU: 0.48, wheelU: 0.67, doors: 2 },
  {
    wheel: W({ style: 'multi', count: 20, rim: 0.76, finish: 'gunmetal', caliper: 'accent', discDrilled: true }),
    spoiler: 'wing',
    spoilerColor: 'black',
    spoilerAt: [0.07, 0.78],
    cladding: 0.055,
    flare: 0.028,
    exhaust: { u: 0.04, v: 0.05, side: false },
    badges: [{ text: 'GT-R', u: 0.1, v: 0.6, size: 0.04, color: '#d8dbde' }],
    headlight: [
      [0.998, 0.38],
      [0.98, 0.46],
      [0.93, 0.5],
      [0.915, 0.46],
      [0.96, 0.4],
      [0.996, 0.36],
    ],
    taillight: [
      [0.004, 0.55, 1],
      [0.016, 0.7, 1],
      [0.09, 0.74],
      [0.085, 0.62],
      [0.04, 0.55, 1],
    ],
    vents: [
      [
        [0.995, 0.06, 1],
        [0.998, 0.26, 1],
        [0.93, 0.27, 1],
        [0.92, 0.06, 1],
      ],
    ],
  },
);
