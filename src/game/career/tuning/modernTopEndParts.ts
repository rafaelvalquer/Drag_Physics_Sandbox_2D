import { CHAPTER2_CARS } from '../../../data/cars/chapter2/index';
import { CHAPTER3_CARS } from '../../../data/cars/chapter3/index';
import type { CarConfig } from '../../../data/schema';
import { modernStageRelease } from './modernStageRelease';
import type { PartTier } from './partProgression';
import type { CamPart, HeadPart, ManifoldPart } from './parts';

interface FamilyProfile {
  control: string;
  /** Stage 3 limits for this calibration: intake closing, lift, exhaust lift, overlap, spring reserve. */
  cam: readonly [ivcDeg: number, inletMm: number, exhaustMm: number, overlapDeg: number, springsRpm: number];
  head: number;
  runner: readonly [diameterMm: number, lengthReduction: number, plenumIncrease: number];
}

// Workshop calibration estimates, anchored to the original engine profiles. Intake-only lift
// reflects the VVEL and Valvetronic applications. The K20 resolver retains the low-speed lobe.
const profiles: Readonly<Record<string, FamilyProfile>> = {
  'gm-familia2': { control: 'Perfil Família II 8V', cam: [17, 1.55, 1.35, 15, 500], head: .095, runner: [5, .17, .26] },
  'honda-k20': { control: 'Lóbulo alto i-VTEC', cam: [13, 1.3, 1.15, 14, 450], head: .083, runner: [5, .13, .32] },
  'psa-prince-thp': { control: 'Fasagem do Prince THP', cam: [7, .75, .55, 1.8, 250], head: .064, runner: [4, .085, .18] },
  'vw-ea113': { control: 'Perfil EA113 20V', cam: [9, .82, .65, 2.5, 300], head: .07, runner: [4.5, .11, .23] },
  'bmw-n20': { control: 'Fasagem VANOS e levantamento Valvetronic', cam: [7, .94, 0, 1.6, 270], head: .067, runner: [4, .082, .2] },
  'mb-m274': { control: 'Fasagem do M274', cam: [7, .76, .6, 1.7, 260], head: .06, runner: [4, .086, .19] },
  'vw-ea888': { control: 'Fasagem do EA888', cam: [8, .88, .64, 2, 300], head: .068, runner: [4, .09, .21] },
  'mitsubishi-4b11': { control: 'Fasagem MIVEC', cam: [9, 1.02, .75, 2.8, 330], head: .074, runner: [5, .1, .22] },
  'bmw-n55': { control: 'Fasagem VANOS e levantamento Valvetronic', cam: [7, .9, 0, 1.5, 270], head: .065, runner: [4.5, .08, .19] },
  'nissan-vq35de': { control: 'Comandos CVTC do VQ35DE', cam: [14, 1.25, 1.1, 12, 420], head: .085, runner: [5, .12, .25] },
  'toyota-2gr-fse': { control: 'Fasagem Dual VVT-i', cam: [9, .65, .52, 6, 200], head: .009, runner: [4, .075, .17] },
  'nissan-vq37vhr': { control: 'Fasagem CVTCS e levantamento VVEL', cam: [10, .9, 0, 7, 290], head: .075, runner: [4, .09, .215] },
  'mercedes-m276': { control: 'Fasagem do M276 biturbo', cam: [6.5, .78, .63, 1.5, 230], head: .066, runner: [4, .075, .17] },
  'kia-lambda33': { control: 'Fasagem do Lambda II', cam: [7, .8, .64, 1.7, 255], head: .067, runner: [4, .08, .185] },
  'maserati-f160': { control: 'Fasagem do F160 biturbo', cam: [7.5, .87, .68, 1.8, 270], head: .072, runner: [4.5, .09, .21] },
  'alfa-690t': { control: 'Fasagem do 690T biturbo', cam: [7.5, .91, .7, 1.6, 260], head: .073, runner: [4.5, .085, .21] },
  'nissan-vr38dett': { control: 'Fasagem do VR38DETT', cam: [9, .99, .79, 2.2, 300], head: .082, runner: [5, .102, .26] },
};

type TopEndPart = CamPart | HeadPart | ManifoldPart;
const tiers = [1, 2, 3] as const;
const format = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const scaled = (value: number, fraction: number): number => Math.round(value * fraction * 100) / 100;

function forStage(car: CarConfig, origin: 2 | 3, tier: PartTier, profile: FamilyProfile): TopEndPart[] {
  const { family, induction, cam, intake } = car.engine;
  const fraction = [0.34, 0.65, 1][tier - 1]!;
  const specialization = induction === 'turbo' ? 'turbo' as const : 'aspirado' as const;
  const common = (slot: string, label: string, cost: number) => ({
    id: `${slot}-${family}-s${tier}`,
    name: `${label} Stage ${tier}`,
    ...modernStageRelease(origin, tier),
    price: Math.round(cost * Math.sqrt(car.engine.ratedPowerCv / 170) * [1, 1.64, 2.45][tier - 1]! / 50) * 50,
    since: 2 as const,
    compat: { families: [family!], induction },
    progression: { tier, group: `modern-${slot}`, specialization },
  });
  const [ivc, inlet, exhaust, overlap, rpm] = profile.cam;
  const intakeLift = car.engine.variableCam?.high.intakeLiftMm ?? cam.intakeLiftMm;
  const exhaustLift = car.engine.variableCam?.high.exhaustLiftMm ?? cam.exhaustLiftMm;
  const ivcDeltaDeg = scaled(ivc, fraction);
  const liftAddMm = scaled(Math.min(inlet, 16 - intakeLift), fraction);
  const exhaustLiftAddMm = scaled(Math.min(exhaust, 16 - exhaustLift), fraction);
  const revLimitAddRpm = Math.round((rpm * fraction) / 10) * 10;
  const flowGain = scaled(profile.head * 100, fraction) / 100;
  const [bore, length, volume] = profile.runner;
  const runnerDiameterAddMm = scaled(Math.min(bore, 80 - intake.runnerDiameterMm), fraction);
  const runnerLengthScale = 1 - scaled(length, fraction);
  const plenumScale = 1 + scaled(Math.min(volume, 20 / intake.manifoldVolumeL - 1), fraction);
  return [
    {
      ...common('cam-profile', profile.control, 1420),
      category: 'camshaft',
      ivoDeltaDeg: -scaled(overlap * .4, fraction),
      ivcDeltaDeg,
      evoDeltaDeg: -scaled(ivc * .38, fraction),
      evcDeltaDeg: scaled(overlap * .6, fraction),
      liftAddMm,
      exhaustLiftAddMm,
      revLimitAddRpm,
      description: 'Fase e perfil do conjunto de válvulas calibrados para a faixa de uso deste motor.',
      physics: `A admissão fecha ${format(ivcDeltaDeg)}° mais tarde. Levantamento adicional de ${format(liftAddMm)} mm na admissão e ${format(exhaustLiftAddMm)} mm no escape. Reserva do conjunto de válvulas de ${revLimitAddRpm} rpm.`,
    },
    {
      ...common('ported-head', 'Cabeçote de maior fluxo', 1730),
      category: 'cylinder-head',
      flowGain,
      description: 'Dutos e sedes trabalhados para reduzir o estrangulamento nas válvulas em alta rotação.',
      physics: `A capacidade nominal de fluxo cresce ${format(flowGain * 100)}% na faixa em que os dutos restringem o enchimento.`,
    },
    {
      ...common('intake-runners', 'Coletor de admissão', 1110),
      category: 'intake-manifold',
      runnerDiameterAddMm,
      runnerLengthScale,
      plenumScale,
      description: 'Dutos e plenum dimensionados para elevar a sintonia sem alterar o tipo de motor.',
      physics: `Dutos ${format(runnerDiameterAddMm)} mm mais largos e ${format((1 - runnerLengthScale) * 100)}% mais curtos. Volume do plenum aumenta ${format((plenumScale - 1) * 100)}%.`,
    },
  ];
}

export const MODERN_TOP_END_PARTS: readonly TopEndPart[] = ([2, 3] as const).flatMap((origin) => {
  const families = new Map((origin === 2 ? CHAPTER2_CARS : CHAPTER3_CARS).map((car) => [car.engine.family!, car]));
  return [...families].flatMap(([family, car]) => {
    const profile = profiles[family];
    if (!profile) throw new Error(`Falta calibração de cabeçote para ${family}`);
    return tiers.flatMap((tier) => forStage(car, origin, tier, profile));
  });
});
