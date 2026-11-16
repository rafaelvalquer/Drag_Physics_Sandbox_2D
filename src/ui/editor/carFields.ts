import type { CarConfig } from '../../data/schema';

/** Declarative description of an editable configuration value. Ranges mirror src/data/schema.ts. */
export type FieldKind = 'number' | 'int' | 'list' | 'select' | 'bool' | 'text' | 'color';

export interface FieldDef {
  path: string;
  label: string;
  kind: FieldKind;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: [string, string][];
  /** list: number of decimals shown. */
  digits?: number;
  hint?: string;
  /** Only shown when the predicate is true. */
  when?: (c: CarConfig) => boolean;
}

export interface FieldGroup {
  id: string;
  label: string;
  sections: { title: string; fields: FieldDef[] }[];
}

const turbo = (c: CarConfig): boolean => c.engine.induction === 'turbo';

export const FIELD_GROUPS: FieldGroup[] = [
  {
    id: 'engine',
    label: 'Motor',
    sections: [
      {
        title: 'Geometria e arquitetura',
        fields: [
          {
            path: 'engine.architecture',
            label: 'Arquitetura',
            kind: 'select',
            options: [
              ['I4', '4 em linha'],
              ['I6', '6 em linha'],
              ['V6', 'V6'],
              ['V8', 'V8'],
              ['V12', 'V12'],
            ],
            hint: 'Trocar a arquitetura aplica um modelo coerente de cilindros, bancadas, virabrequim e ordem de ignição.',
          },
          { path: 'engine.cylinders', label: 'Cilindros', kind: 'int', min: 1, max: 16, hint: 'Alterar exige ordem de ignição e bancadas coerentes.' },
          { path: 'engine.boreMm', label: 'Diâmetro', kind: 'number', unit: 'mm', min: 50, max: 130, step: 0.5 },
          { path: 'engine.strokeMm', label: 'Curso', kind: 'number', unit: 'mm', min: 40, max: 130, step: 0.5 },
          { path: 'engine.rodLengthMm', label: 'Biela', kind: 'number', unit: 'mm', min: 80, max: 250, step: 0.5 },
          { path: 'engine.compressionRatio', label: 'Taxa de compressão', kind: 'number', min: 6, max: 16, step: 0.1 },
          { path: 'engine.inertiaKgM2', label: 'Inércia vir. + volante', kind: 'number', unit: 'kg·m²', min: 0.03, max: 2, step: 0.01 },
          { path: 'engine.reciprocatingMassKg', label: 'Massa alternada/cil.', kind: 'number', unit: 'kg', min: 0.2, max: 2, step: 0.01 },
          {
            path: 'engine.crankType',
            label: 'Virabrequim',
            kind: 'select',
            options: [
              ['inline', 'em linha'],
              ['crossplane', 'cross-plane'],
              ['flatplane', 'flat-plane'],
              ['even-fire', 'ignição uniforme'],
              ['split-pin', 'split-pin'],
            ],
          },
          { path: 'engine.bankAngleDeg', label: 'Ângulo entre bancadas', kind: 'number', unit: '°', min: 0, max: 180, step: 1 },
          { path: 'engine.firingOrder', label: 'Ordem de ignição', kind: 'list', digits: 0, hint: 'Cilindros 1-based. Os ângulos de ignição (720°/n) são recalculados.' },
          { path: 'engine.bankOfCylinder', label: 'Bancada de cada cilindro', kind: 'list', digits: 0, hint: '0 = esquerda/próxima, 1 = direita/distante' },
        ],
      },
      {
        title: 'Rotação e controle',
        fields: [
          { path: 'engine.idleRpm', label: 'Marcha lenta', kind: 'number', unit: 'rpm', min: 500, max: 1500, step: 10 },
          { path: 'engine.redlineRpm', label: 'Faixa vermelha', kind: 'number', unit: 'rpm', min: 3000, max: 12000, step: 50 },
          { path: 'engine.revLimitRpm', label: 'Limitador', kind: 'number', unit: 'rpm', min: 3000, max: 12500, step: 50 },
          { path: 'engine.limiterCutTimeS', label: 'Duração do corte', kind: 'number', unit: 's', min: 0.01, max: 0.5, step: 0.005 },
          { path: 'engine.maxSafeRpm', label: 'Rotação máx. mecânica', kind: 'number', unit: 'rpm', min: 3000, max: 13000, step: 50 },
          { path: 'engine.throttle.bodyDiameterMm', label: 'Corpo de borboleta', kind: 'number', unit: 'mm', min: 30, max: 120, step: 1 },
          { path: 'engine.throttle.responseTimeS', label: 'Resposta da borboleta', kind: 'number', unit: 's', min: 0.005, max: 0.5, step: 0.005 },
          { path: 'engine.throttle.pedalGamma', label: 'Progressividade do pedal (γ)', kind: 'number', min: 0.5, max: 4, step: 0.1 },
          { path: 'engine.accessoriesNm', label: 'Acessórios', kind: 'number', unit: 'N·m', min: 0, max: 30, step: 0.5 },
        ],
      },
      {
        title: 'Curva de torque (WOT, regime permanente)',
        fields: [
          { path: 'engine.torqueCurve.rpm', label: 'Rotações', kind: 'list', digits: 0 },
          { path: 'engine.torqueCurve.torqueNm', label: 'Torque', kind: 'list', digits: 1, unit: 'N·m', hint: 'A física calibra a carga para reproduzir esta curva; o dinamômetro mede o resultado.' },
          { path: 'engine.ratedPowerCv', label: 'Potência anunciada (referência)', kind: 'number', unit: 'cv', min: 10, max: 3000, step: 1 },
        ],
      },
      {
        title: 'Comando e combustão',
        fields: [
          { path: 'engine.cam.evoDeg', label: 'Abertura escape (EVO)', kind: 'number', unit: '°', min: 90, max: 200, step: 1 },
          { path: 'engine.cam.evcDeg', label: 'Fechamento escape (EVC)', kind: 'number', unit: '°', min: 340, max: 420, step: 1 },
          { path: 'engine.cam.ivoDeg', label: 'Abertura admissão (IVO)', kind: 'number', unit: '°', min: 300, max: 380, step: 1 },
          { path: 'engine.cam.ivcDeg', label: 'Fechamento admissão (IVC)', kind: 'number', unit: '°', min: 540, max: 660, step: 1 },
          { path: 'engine.cam.intakeLiftMm', label: 'Levante admissão', kind: 'number', unit: 'mm', min: 4, max: 16, step: 0.1 },
          { path: 'engine.cam.exhaustLiftMm', label: 'Levante escape', kind: 'number', unit: 'mm', min: 4, max: 16, step: 0.1 },
          { path: 'engine.combustion.burnDurationDeg', label: 'Duração da queima', kind: 'number', unit: '°', min: 25, max: 100, step: 1 },
          { path: 'engine.combustion.cycleVariation', label: 'Variação ciclo a ciclo', kind: 'number', min: 0, max: 0.3, step: 0.01 },
        ],
      },
      {
        title: 'Atrito, partida e marcha lenta',
        fields: [
          { path: 'engine.friction.coulombNm', label: 'Atrito constante', kind: 'number', unit: 'N·m', min: 0, max: 80, step: 0.5 },
          { path: 'engine.friction.viscousNmPerRadS', label: 'Atrito viscoso', kind: 'number', unit: 'N·m·s', min: 0, max: 0.2, step: 0.001 },
          { path: 'engine.friction.quadraticNmPerRadS2', label: 'Atrito quadrático', kind: 'number', unit: 'N·m·s²', min: 0, max: 0.0005, step: 0.00001 },
          { path: 'engine.starter.torqueNm', label: 'Torque do motor de partida', kind: 'number', unit: 'N·m', min: 20, max: 400, step: 1 },
          { path: 'engine.starter.speedRpm', label: 'Rotação de partida', kind: 'number', unit: 'rpm', min: 100, max: 400, step: 5 },
          { path: 'engine.throttle.idlePlatePosition', label: 'Batente da borboleta', kind: 'number', min: 0.9, max: 0.999, step: 0.001 },
          { path: 'engine.idleControl.naturalFrequencyRadS', label: 'Controle de lenta: ωn', kind: 'number', unit: 'rad/s', min: 0.5, max: 20, step: 0.1 },
          { path: 'engine.idleControl.damping', label: 'Controle de lenta: ζ', kind: 'number', min: 0.2, max: 3, step: 0.05 },
          { path: 'engine.idleControl.maxAirFraction', label: 'Controle de lenta: ar máx.', kind: 'number', min: 0.005, max: 0.2, step: 0.005 },
          { path: 'engine.egt.idleK', label: 'Temp. escape em lenta', kind: 'number', unit: 'K', min: 500, max: 900, step: 5 },
          { path: 'engine.egt.maxK', label: 'Temp. escape máxima', kind: 'number', unit: 'K', min: 800, max: 1300, step: 5 },
        ],
      },
      {
        title: 'Admissão',
        fields: [
          { path: 'engine.intake.manifoldVolumeL', label: 'Volume do coletor', kind: 'number', unit: 'L', min: 0.5, max: 20, step: 0.1 },
          { path: 'engine.intake.runnerLengthM', label: 'Comprimento do runner', kind: 'number', unit: 'm', min: 0.05, max: 1, step: 0.01 },
          { path: 'engine.intake.runnerDiameterMm', label: 'Diâmetro do runner', kind: 'number', unit: 'mm', min: 20, max: 80, step: 1 },
          { path: 'engine.intake.airboxVolumeL', label: 'Caixa de ar', kind: 'number', unit: 'L', min: 1, max: 30, step: 0.5 },
        ],
      },
      {
        title: 'Turbo',
        fields: [
          {
            path: 'engine.induction',
            label: 'Indução',
            kind: 'select',
            options: [
              ['NA', 'aspirado'],
              ['turbo', 'turbo'],
            ],
          },
          { path: 'engine.turbo.maxBoostBar', label: 'Pressão máx. (wastegate)', kind: 'number', unit: 'bar', min: 0.1, max: 3, step: 0.05, when: turbo },
          { path: 'engine.turbo.spoolTimeS', label: 'Constante de enchimento', kind: 'number', unit: 's', min: 0.05, max: 5, step: 0.05, when: turbo },
          { path: 'engine.turbo.fullBoostFlowFraction', label: 'Vazão p/ pressão total', kind: 'number', min: 0.15, max: 1.5, step: 0.01, when: turbo },
          { path: 'engine.turbo.maxShaftRpm', label: 'Rotação máx. do eixo', kind: 'number', unit: 'rpm', min: 40000, max: 300000, step: 1000, when: turbo },
          { path: 'engine.turbo.compressorBlades', label: 'Pás do compressor', kind: 'int', min: 4, max: 16, when: turbo },
          { path: 'engine.turbo.bovEnabled', label: 'Válvula de alívio (BOV)', kind: 'bool', when: turbo },
          { path: 'engine.turbo.bovVentTimeS', label: 'Tempo de alívio', kind: 'number', unit: 's', min: 0.02, max: 1, step: 0.01, when: turbo },
        ],
      },
    ],
  },
  {
    id: 'transmission',
    label: 'Câmbio',
    sections: [
      {
        title: 'Relações',
        fields: [
          { path: 'transmission.gearRatios', label: 'Relações das marchas', kind: 'list', digits: 3, hint: '4 a 7 marchas, decrescentes' },
          { path: 'transmission.finalDrive', label: 'Diferencial', kind: 'number', min: 1.5, max: 6.5, step: 0.01 },
          { path: 'transmission.efficiency', label: 'Eficiência', kind: 'number', min: 0.7, max: 0.99, step: 0.01 },
          { path: 'transmission.inputInertiaKgM2', label: 'Inércia eixo primário', kind: 'number', unit: 'kg·m²', min: 0.001, max: 0.2, step: 0.001 },
          { path: 'transmission.outputInertiaKgM2', label: 'Inércia eixo de saída', kind: 'number', unit: 'kg·m²', min: 0.001, max: 0.5, step: 0.001 },
        ],
      },
      {
        title: 'Embreagem automática',
        fields: [
          { path: 'transmission.clutch.maxTorqueNm', label: 'Capacidade', kind: 'number', unit: 'N·m', min: 100, max: 4000, step: 10 },
          { path: 'transmission.clutch.engageRatePerS', label: 'Velocidade de acoplamento', kind: 'number', unit: '1/s', min: 0.5, max: 50, step: 0.5 },
          { path: 'transmission.clutch.launchRpm', label: 'Rotação de largada', kind: 'number', unit: 'rpm', min: 1000, max: 9000, step: 50 },
          { path: 'transmission.clutch.antiStallRpm', label: 'Anti-stall abaixo de', kind: 'number', unit: 'rpm', min: 300, max: 2000, step: 10 },
        ],
      },
      {
        title: 'Troca semiautomática',
        fields: [
          { path: 'transmission.shift.torqueCutTimeS', label: 'Corte de torque', kind: 'number', unit: 's', min: 0.005, max: 0.3, step: 0.005 },
          { path: 'transmission.shift.clutchDisengageTimeS', label: 'Desacoplamento', kind: 'number', unit: 's', min: 0.005, max: 0.3, step: 0.005 },
          { path: 'transmission.shift.gearChangeTimeS', label: 'Troca da engrenagem', kind: 'number', unit: 's', min: 0.01, max: 0.5, step: 0.005 },
          { path: 'transmission.shift.clutchEngageTimeS', label: 'Reacoplamento', kind: 'number', unit: 's', min: 0.02, max: 1, step: 0.01 },
          { path: 'transmission.shift.upshiftFreeFallMaxS', label: 'Queda livre máx. (subida)', kind: 'number', unit: 's', min: 0, max: 0.5, step: 0.005 },
          {
            path: 'transmission.shift.overRevProtection',
            label: 'Redução com sobregiro',
            kind: 'select',
            options: [
              ['block', 'bloquear'],
              ['wait', 'aguardar rotação segura'],
            ],
          },
          { path: 'transmission.shift.maxDownshiftRpmFraction', label: 'Limite de redução (× limitador)', kind: 'number', min: 0.6, max: 1, step: 0.01 },
          { path: 'transmission.shift.revMatch.enabled', label: 'Rev-match (blip) na redução', kind: 'bool' },
          { path: 'transmission.shift.revMatch.gain', label: 'Ganho do blip', kind: 'number', min: 0, max: 5, step: 0.05 },
          { path: 'transmission.shift.revMatch.toleranceRpm', label: 'Tolerância', kind: 'number', unit: 'rpm', min: 20, max: 1500, step: 10 },
          { path: 'transmission.shift.revMatch.maxBlipThrottle', label: 'Blip máximo', kind: 'number', min: 0, max: 1, step: 0.05 },
          { path: 'transmission.shift.revMatch.timeoutS', label: 'Tempo máx. do blip', kind: 'number', unit: 's', min: 0.05, max: 1.5, step: 0.01 },
          { path: 'transmission.shift.revMatch.leadTimeS', label: 'Antecipação', kind: 'number', unit: 's', min: 0, max: 0.3, step: 0.01 },
        ],
      },
    ],
  },
  {
    id: 'chassis',
    label: 'Pneus e chassi',
    sections: [
      {
        title: 'Massa e aerodinâmica',
        fields: [
          { path: 'massKg', label: 'Massa', kind: 'number', unit: 'kg', min: 500, max: 3000, step: 5 },
          { path: 'wheelbaseM', label: 'Entre-eixos', kind: 'number', unit: 'm', min: 1.8, max: 3.5, step: 0.01 },
          { path: 'cgHeightM', label: 'Altura do CG', kind: 'number', unit: 'm', min: 0.25, max: 0.8, step: 0.01 },
          { path: 'frontWeightFraction', label: 'Peso na dianteira', kind: 'number', min: 0.3, max: 0.7, step: 0.01 },
          {
            path: 'drivenAxle',
            label: 'Tração',
            kind: 'select',
            options: [
              ['rear', 'traseira'],
              ['front', 'dianteira'],
            ],
          },
          { path: 'dragCoefficient', label: 'Cx', kind: 'number', min: 0.2, max: 0.6, step: 0.01 },
          { path: 'frontalAreaM2', label: 'Área frontal', kind: 'number', unit: 'm²', min: 1.4, max: 3, step: 0.01 },
          { path: 'brakeTorqueNm', label: 'Torque de freio', kind: 'number', unit: 'N·m', min: 500, max: 8000, step: 50 },
        ],
      },
      {
        title: 'Pneus',
        fields: [
          { path: 'tires.radiusM', label: 'Raio', kind: 'number', unit: 'm', min: 0.2, max: 0.5, step: 0.001 },
          { path: 'tires.wheelInertiaKgM2', label: 'Inércia da roda', kind: 'number', unit: 'kg·m²', min: 0.3, max: 5, step: 0.05 },
          { path: 'tires.muPeak', label: 'μ de pico', kind: 'number', min: 0.5, max: 2.5, step: 0.01 },
          { path: 'tires.B', label: 'Magic Formula B', kind: 'number', min: 4, max: 25, step: 0.1 },
          { path: 'tires.C', label: 'Magic Formula C', kind: 'number', min: 1.1, max: 2, step: 0.01 },
          { path: 'tires.E', label: 'Magic Formula E', kind: 'number', min: -2, max: 1, step: 0.01 },
          { path: 'tires.rollingResistance', label: 'Resistência ao rolamento', kind: 'number', min: 0.005, max: 0.05, step: 0.001 },
          { path: 'tires.optimalTempC', label: 'Temperatura ideal', kind: 'number', unit: '°C', min: 0, max: 120, step: 1 },
          { path: 'tires.tempSensitivityPerC', label: 'Perda de aderência por °C', kind: 'number', min: 0, max: 0.01, step: 0.0005 },
        ],
      },
      {
        title: 'Visual',
        fields: [
          { path: 'name', label: 'Nome', kind: 'text' },
          {
            path: 'visual.bodyStyle',
            label: 'Carroceria',
            kind: 'select',
            options: [
              ['hatch', 'hatch'],
              ['hotHatch', 'hot hatch'],
              ['coupe', 'cupê'],
              ['sedan', 'sedã'],
              ['muscle', 'muscle'],
              ['supercar', 'superesportivo'],
              ['prototype', 'protótipo GT'],
              ['golGts88', 'Gol quadrado GTS 1988'],
            ],
          },
          { path: 'visual.color', label: 'Cor', kind: 'color' },
          { path: 'visual.accent', label: 'Cor de detalhe', kind: 'color' },
          { path: 'visual.lengthM', label: 'Comprimento', kind: 'number', unit: 'm', min: 3, max: 5.5, step: 0.01 },
          { path: 'visual.heightM', label: 'Altura', kind: 'number', unit: 'm', min: 1, max: 1.6, step: 0.01 },
          { path: 'visual.frontOverhangM', label: 'Balanço dianteiro', kind: 'number', unit: 'm', min: 0.5, max: 1.3, step: 0.01 },
          { path: 'visual.rideHeightM', label: 'Altura do solo', kind: 'number', unit: 'm', min: 0.08, max: 0.25, step: 0.005 },
        ],
      },
    ],
  },
  {
    id: 'acoustic',
    label: 'Escapamento',
    sections: [
      {
        title: 'Escapamento (rede de guias de onda)',
        fields: [
          {
            path: 'exhaust.layout',
            label: 'Configuração',
            kind: 'select',
            options: [
              ['single', 'simples (Y)'],
              ['dual', 'duplo verdadeiro'],
            ],
          },
          { path: 'exhaust.headerPrimaryLengthM', label: 'Primários do coletor', kind: 'number', unit: 'm', min: 0.15, max: 2, step: 0.01 },
          { path: 'exhaust.headerDiameterMm', label: 'Ø primários', kind: 'number', unit: 'mm', min: 25, max: 70, step: 1 },
          { path: 'exhaust.collectorLengthM', label: 'Tubo intermediário', kind: 'number', unit: 'm', min: 0.1, max: 3, step: 0.01 },
          { path: 'exhaust.collectorDiameterMm', label: 'Ø intermediário', kind: 'number', unit: 'mm', min: 35, max: 110, step: 1 },
          { path: 'exhaust.mufflerChambersM', label: 'Câmaras do abafador', kind: 'list', digits: 2, unit: 'm', hint: 'Até 6 câmaras (0,03–0,8 m). Vazio = sem abafador.' },
          { path: 'exhaust.mufflerAbsorption', label: 'Absorção do abafador', kind: 'number', min: 0, max: 0.98, step: 0.01 },
          { path: 'exhaust.resonatorLengthM', label: 'Ressonador (¼ de onda)', kind: 'number', unit: 'm', min: 0, max: 1, step: 0.01 },
          { path: 'exhaust.tailpipeLengthM', label: 'Ponteira', kind: 'number', unit: 'm', min: 0.05, max: 1.5, step: 0.01 },
          { path: 'exhaust.tailpipeDiameterMm', label: 'Ø ponteira', kind: 'number', unit: 'mm', min: 35, max: 120, step: 1 },
          { path: 'exhaust.wallLossDbPerM', label: 'Perdas na parede', kind: 'number', unit: 'dB/m', min: 0, max: 12, step: 0.1 },
          { path: 'exhaust.tailTempFraction', label: 'Temperatura na ponteira', kind: 'number', min: 0.2, max: 1, step: 0.01 },
          { path: 'exhaust.outputGain', label: 'Ganho de saída', kind: 'number', min: 0, max: 2, step: 0.05 },
        ],
      },
      {
        title: 'Canais',
        fields: [
          { path: 'acoustic.intakeGain', label: 'Admissão', kind: 'number', min: 0, max: 2, step: 0.05 },
          { path: 'acoustic.blockGain', label: 'Bloco / mecânico', kind: 'number', min: 0, max: 2, step: 0.05 },
          { path: 'acoustic.exhaustGain', label: 'Escape', kind: 'number', min: 0, max: 2, step: 0.05 },
          { path: 'acoustic.turboGain', label: 'Turbo', kind: 'number', min: 0, max: 2, step: 0.05 },
          { path: 'acoustic.tireGain', label: 'Pneus', kind: 'number', min: 0, max: 2, step: 0.05 },
          { path: 'acoustic.transmissionGain', label: 'Transmissão', kind: 'number', min: 0, max: 2, step: 0.05 },
          { path: 'acoustic.environmentGain', label: 'Ambiente (vento)', kind: 'number', min: 0, max: 2, step: 0.05 },
          { path: 'acoustic.gearTeeth', label: 'Dentes (zumbido do câmbio)', kind: 'int', min: 8, max: 60 },
          { path: 'acoustic.mechanicalNoise', label: 'Ruído mecânico', kind: 'number', min: 0, max: 2, step: 0.05 },
        ],
      },
    ],
  },
];

export function getPath(obj: unknown, path: string): unknown {
  let o: unknown = obj;
  for (const k of path.split('.')) {
    if (o === null || o === undefined) return undefined;
    o = (o as Record<string, unknown>)[k];
  }
  return o;
}

export function setPath(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  let o = obj as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    if (o[k] === undefined || o[k] === null) o[k] = {};
    o = o[k] as Record<string, unknown>;
  }
  o[keys[keys.length - 1]!] = value;
}
