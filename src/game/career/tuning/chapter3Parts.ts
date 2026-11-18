import type { PartDef } from './parts';

/**
 * Chapter 3 workshop: the parts the aspirated V6 of the chapter (VQ35DE, VQ37VHR, 2GR-FSE) need
 * for a moderate, coherent preparation. Same rules as the other parts: hardware with a physical
 * effect in the engine model (restriction, valve events, ignition, flow capacity), never a power
 * multiplier, and an explicit engine family. A Nissan cam never fits a Toyota (and the other way
 * round); the 2GR-FSE gets only the conservative selection (intake, exhaust, remap) because the
 * documents consulted do not support a more aggressive one.
 *
 * Available to the player and to the rivals alike: no part exists only for a rival.
 */
const V6_NA = ['nissan-vq35de', 'toyota-2gr-fse', 'nissan-vq37vhr'] as const;
const NISSAN_V6 = ['nissan-vq35de', 'nissan-vq37vhr'] as const;

export const CHAPTER3_PARTS: readonly PartDef[] = [
  {
    id: 'filter-v6-flow',
    since: 2,
    chapter: 3,
    category: 'intake-filter',
    name: 'Admissão V6 de alto fluxo',
    price: 1500,
    unlock: 'c3-v6-parts',
    compat: { families: V6_NA },
    description: 'Caixa de ar com duto dobrado para as duas bancadas e elemento de alto fluxo.',
    physics: 'Queda de pressão da admissão de ≈ 2 kPa para 0,7 kPa no fluxo nominal: o plenum enche melhor em alta rotação. Aumenta o ruído de admissão.',
    airFilterDropKPa: 0.7,
    intakeGainDelta: 0.3,
  },
  {
    id: 'exhaust-v6-sport',
    since: 2,
    chapter: 3,
    category: 'exhaust',
    name: 'Escape esportivo V6',
    price: 2200,
    unlock: 'c3-v6-parts',
    compat: { families: V6_NA },
    description: 'Coletores 3-1 por bancada, catalisadores de alto fluxo e silencioso de fluxo direto.',
    physics: 'Contrapressão de ≈ 12 kPa para 5 kPa no fluxo nominal: menos perda de bombeamento e menos gás residual. Muda a geometria do escape e o som.',
    backPressureKPa: 5,
    acousticPreset: 'sport',
    headerDiameterScale: 1.06,
  },
  {
    id: 'cam-vq35-s1',
    since: 2,
    chapter: 3,
    category: 'camshaft',
    name: 'Comandos VQ35DE Stage 1',
    price: 2800,
    unlock: 'c3-v6-parts',
    compat: { induction: 'NA', families: ['nissan-vq35de'] },
    description: 'Comandos de maior duração para o VQ35DE, com molas de válvula reforçadas.',
    physics: 'Fechamento da admissão 8° mais tarde, cruzamento +8°, levantamento +0,8 mm e corte +200 rpm. Ganha em cima e perde um pouco embaixo.',
    ivoDeltaDeg: -3,
    ivcDeltaDeg: 8,
    evoDeltaDeg: -5,
    evcDeltaDeg: 5,
    liftAddMm: 0.8,
    revLimitAddRpm: 200,
  },
  {
    id: 'cam-vq37-s1',
    since: 2,
    chapter: 3,
    category: 'camshaft',
    name: 'Comandos VQ37VHR Stage 1',
    price: 3200,
    unlock: 'c3-v6-parts',
    compat: { induction: 'NA', families: ['nissan-vq37vhr'] },
    description: 'Perfil de maior duração para o VQ37VHR; o VVEL continua controlando o levantamento.',
    physics: 'Fechamento da admissão 6° mais tarde, cruzamento +5°, levantamento +0,5 mm e corte +200 rpm. O motor já gira alto: o ganho é menor que no VQ35DE.',
    ivoDeltaDeg: -2,
    ivcDeltaDeg: 6,
    evoDeltaDeg: -4,
    evcDeltaDeg: 3,
    liftAddMm: 0.5,
    revLimitAddRpm: 200,
  },
  {
    id: 'ecu-v6-na',
    since: 2,
    category: 'ecu',
    chapter: 3,
    level: 'stage1',
    name: 'Remap aspirado V6',
    price: 3000,
    unlock: 'c3-v6-parts',
    compat: { induction: 'NA', families: V6_NA },
    description: 'Mapa de ignição e combustível refeito para o V6 aspirado, com o corte de giro movido até onde a família aceita.',
    physics: 'Ignição ≈ 2 % mais eficiente com gasolina de alta octanagem e corte +200 rpm (limite mecânico da família). Não cria ar: o ganho é moderado.',
    boostAddBar: 0,
    torqueLimitFraction: 1,
    ignitionGain: 0.02,
    revLimitAddRpm: 200,
  },
  {
    id: 'head-v6-ported',
    since: 2,
    chapter: 3,
    category: 'cylinder-head',
    name: 'Cabeçotes V6 retrabalhados',
    price: 4600,
    unlock: 'c3-v6-parts',
    compat: { families: NISSAN_V6 },
    description: 'Dutos e sedes de válvula retrabalhados nos dois cabeçotes.',
    physics: 'Capacidade de fluxo ≈ 5 % maior onde as válvulas estrangulam (alto giro); embaixo quase nada muda. Só para os VQ, de cabeçote bem documentado.',
    flowGain: 0.05,
  },
];
