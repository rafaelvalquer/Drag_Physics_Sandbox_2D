import type { BuildIssue, IssueCode } from '../../../game/career/tuning/buildIssues';
import { classifyError } from '../../../game/career/tuning/buildIssues';
import type { CarConfig } from '../../../data/schema';
import { CATEGORY_LABEL, type PartCategory } from '../../../game/career/tuning/parts';
import type { EngineMount } from '../../../game/vehicles/art/parts/PartVisualAnchors';

/**
 * Every text of the visual workshop in one place: friendly pt-BR wording for the player, with the
 * technical detail one click away (the original catalogue and resolver sentences are kept in the
 * "Detalhes técnicos" section). Nothing here changes a formula, a price or an id.
 */
export const L = {
  title: 'Oficina',
  chooseTitle: 'Escolha o que melhorar',
  available: 'Peças disponíveis',
  search: 'Buscar peça: turbina, embreagem, pneu…',
  searchLabel: 'Buscar peças',
  details: 'Detalhes da peça',
  detailsEmpty: 'Escolha uma peça na lista para ver o que ela faz, o que muda no carro e quanto custa.',
  whatItDoes: 'O que faz',
  whatChanges: 'O que muda no carro',
  whatYouNeed: 'O que você precisa',
  whatIsMissing: 'O que falta',
  beforeAfter: 'Antes e depois',
  technical: 'Detalhes técnicos',
  advanced: 'Detalhes avançados',
  works: 'Funciona neste carro?',
  worksYes: 'Sim, funciona neste carro.',
  buy: 'Comprar e instalar',
  installOwned: 'Instalar peça que já tenho',
  installBundle: 'Instalar o conjunto',
  remove: 'Remover',
  restoreAll: 'Voltar à configuração original',
  installStock: 'Instalar original (grátis)',
  backToGarage: 'Voltar à garagem',
  openDyno: 'Abrir o Dyno Lab',
  dyno: 'Dinamômetro',
  needsAdjust: 'Esta combinação precisa de ajustes',
  noResults: 'Nenhuma peça com esse filtro. Limpe a busca ou escolha outra categoria.',
  hiddenSelected: 'A peça escolhida está fora do filtro atual.',
  modeExternal: 'Visual externo',
  modeTechnical: 'Visão técnica',
  modeDetail: 'Detalhe da peça',
  versionNow: 'Atual',
  versionWith: 'Com a peça',
  versionSlide: 'Comparar',
  nowNote: 'Mostrando: o carro como está agora.',
  withNote: 'Prévia: nada foi comprado nem instalado.',
  withPendingNote: 'Prévia com as peças que faltam incluídas: nada foi comprado.',
  illustrative: 'Ilustração representativa',
  technicalNote: 'Visão técnica ilustrativa: a posição dos componentes segue a arquitetura deste carro.',
  noExternal: 'Esta peça não muda a aparência externa do carro. A visão técnica mostra onde ela trabalha.',
  externalChanges: 'Muda na aparência:',
  estimateNote: 'Valores calculados pela simulação do jogo. O tempo de 402 m é uma estimativa com piloto ideal na Avenida Norte, não um resultado garantido.',
  nitroKit: 'O kit instala o cilindro e as linhas. A regulagem fica na aba Nitro do Dyno Lab; na corrida, um toque em Shift injeta um estágio.',
  gearboxUpgradeNote: 'Ao melhorar o câmbio automático ou de dupla embreagem, o carro passa a ser manual: você troca as marchas.',
  reducedHint: 'Animações reduzidas.',
} as const;

export const FILTERS: readonly { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'available', label: 'Disponíveis' },
  { id: 'equipped', label: 'Equipadas' },
  { id: 'stock', label: 'No estoque' },
  { id: 'locked', label: 'Bloqueadas' },
  { id: 'compatible', label: 'Compatíveis' },
];
export type FilterId = 'all' | 'available' | 'equipped' | 'stock' | 'locked' | 'compatible';

/** Friendly names and one-line help of the navigation tabs (ids and categories stay those of the catalogue). */
export const TAB_COPY: Record<string, { label: string; help: string }> = {
  engine: { label: 'Motor', help: 'Peças internas: comando, cabeçote, pistões e volante.' },
  intake: { label: 'Admissão', help: 'Por onde o ar entra no motor.' },
  exhaust: { label: 'Escape', help: 'Por onde os gases saem e como o carro soa.' },
  transmission: { label: 'Transmissão', help: 'Embreagem, câmbio e relação final.' },
  tires: { label: 'Rodas e pneus', help: 'Pneus: composto, largura e pressão.' },
  turbo: { label: 'Turbo', help: 'Turbina, pressão e resfriamento do ar.' },
  electronics: { label: 'Eletrônica', help: 'Central, combustível e ignição.' },
  cooling: { label: 'Arrefecimento', help: 'Mantém o motor na temperatura certa.' },
  nitrous: { label: 'Nitro', help: 'Kit de N₂O para força extra por pouco tempo.' },
  chassis: { label: 'Estrutura', help: 'Peso e suspensão.' },
};

/** "O que faz": one friendly sentence per slot (the catalogue's technical line stays in the details). */
export const CATEGORY_HELP: Record<PartCategory, string> = {
  'intake-filter': 'Deixa o ar entrar com menos resistência no motor.',
  'intake-manifold': 'Distribui o ar entre os cilindros. Dutos melhores ajudam em certas faixas de giro.',
  'intake-throttle': 'Controla quanto ar o motor recebe e quão rápido responde ao acelerador.',
  'intake-airbox': 'A caixa onde o ar descansa antes de entrar no motor. Uma melhor deixa o ar chegar mais livre.',
  camshaft: 'Define quando e quanto as válvulas abrem. Muda em que giro o motor rende mais.',
  'engine-head': 'O cabeçote deixa o ar entrar e sair do cilindro. Um melhor trabalhado respira mais.',
  'engine-compression': 'Aperta mais a mistura antes da explosão. Rende mais, mas limita a pressão do turbo.',
  'engine-internals': 'Peças internas mais fortes aguentam mais força sem quebrar.',
  'engine-flywheel': 'Um volante mais leve deixa o motor subir de giro mais rápido.',
  exhaust: 'Deixa os gases saírem com menos resistência. Muda o som e a ponteira que aparece atrás.',
  'exhaust-header': 'Coleta os gases de cada cilindro de forma mais livre.',
  'exhaust-downpipe': 'Libera a saída dos gases logo depois da turbina.',
  'exhaust-pipe': 'O cano do escape: mais largo, menos resistência.',
  'exhaust-muffler': 'O silencioso: mais fluxo e mais som quanto menos ele segura.',
  clutch: 'Transmite a força do motor às rodas sem patinar. Quanto mais força, mais resistente precisa ser.',
  differential: 'A relação final troca arrancada por velocidade final.',
  'transmission-gearbox': 'As marchas: define o quanto o motor pode render entre uma troca e outra.',
  tires: 'O composto do pneu define quanta aderência o carro tem para aproveitar a força.',
  'tires-width': 'Pneu mais largo toca mais asfalto, mas pesa mais para girar.',
  'tires-pressure': 'A pressão ajusta o quanto o pneu esquenta e o quanto ele segura.',
  turbo: 'Um turbo empurra mais ar para dentro do motor: mais força, mas exige peças de apoio.',
  'turbo-turbine': 'A turbina decide entre responder rápido e render mais em giros altos.',
  'turbo-intercooler': 'Esfria o ar do turbo. Ar mais frio rende mais e arrisca menos detonação.',
  'turbo-wastegate': 'Controla a pressão máxima que o turbo pode chegar.',
  'turbo-boost': 'A pressão que o turbo trabalha. Mais pressão, mais força e mais risco.',
  'electronics-ecu': 'A central que decide combustível e ignição. Uma melhor extrai mais com segurança.',
  'electronics-fuel': 'Entrega mais combustível quando o motor pede mais força.',
  'electronics-ignition': 'Faísca mais forte e estável com o motor sob muita pressão.',
  'cooling-radiator': 'Tira calor do motor. Mais área, mais folga térmica.',
  'cooling-oil': 'Mantém o óleo na temperatura certa para proteger o motor.',
  'cooling-fan': 'Ventoinha que gasta menos força do motor para refrigerar.',
  'chassis-weight': 'Menos peso no carro: acelera e freia melhor.',
  'chassis-suspension': 'Ajusta como o peso passa de um eixo para o outro na arrancada.',
  ecu: 'A central que decide pressão, ignição e giro máximo. Uma melhor extrai mais com segurança.',
  intercooler: 'Esfria o ar do turbo. Ar mais frio rende mais e arrisca menos detonação.',
  'boost-control': 'Controla a pressão máxima que o turbo pode chegar.',
  'cylinder-head': 'O cabeçote deixa o ar entrar e sair do cilindro. Um melhor trabalhado respira mais.',
  pistons: 'Pistões e bielas mais fortes aguentam mais força e permitem mudar a compressão.',
  flywheel: 'Um volante mais leve deixa o motor subir de giro mais rápido.',
  gearbox: 'Melhora o câmbio. Atenção: o automático ou de dupla embreagem vira manual: você troca as marchas.',
  awd: 'Distribui a força entre os eixos para sair sem patinar.',
  suspension: 'Ajusta como o peso passa de um eixo para o outro na arrancada.',
  'engine-valvetrain': 'Molas de válvula mais firmes deixam o motor girar mais alto sem perder o controle.',
  'electronics-launch': 'Segura o giro certo na largada para sair forte.',
  nitrous: 'Injeta N₂O por pouco tempo para dar força extra. Um toque em Shift por estágio.',
};

/** What the technical "Efeito físico" line of the catalogue is called in the details. */
export const TECH_LABELS = { description: 'Descrição do catálogo', physics: 'Efeito físico', chapter: 'Capítulo' } as const;

const ISSUE_FRIENDLY: Record<IssueCode, string> = {
  'needs-turbo-kit': 'Esta peça só funciona num carro que já tem um kit turbo instalado.',
  'fuel-limit': 'O sistema de combustível atual não entrega o suficiente. Instale uma alimentação melhor.',
  'internals-limit': 'O motor ainda não aguenta essa força por dentro. Instale peças internas mais resistentes.',
  'clutch-limit': 'A embreagem atual não segura essa força. Instale uma embreagem mais resistente.',
  'gearbox-limit': 'O câmbio atual não segura essa força. Instale um câmbio mais resistente.',
  'compression-limit': 'A compressão do motor é alta demais para essa pressão. Ajuste a taxa de compressão.',
  'needs-ecu': 'Esta peça precisa de uma central eletrônica programável.',
  'intercooler-limit': 'O intercooler atual esquenta demais o ar. Instale um de maior capacidade.',
  'turbine-limit': 'Esta combinação precisa de uma turbina de maior fluxo.',
  'ignition-limit': 'A ignição atual não é forte o bastante. Instale uma ignição melhor.',
  'oil-cooling': 'Falta resfriamento de óleo para essa força.',
  'needs-part': 'Falta uma peça de apoio para esta combinação.',
  knock: 'A pressão escolhida causa detonação. Reduza a pressão ou melhore o resfriamento.',
  range: 'A pressão escolhida está fora da faixa que as peças aceitam. Ajuste no Dyno Lab.',
  'na-remap-on-conversion': 'Este remap é para motor aspirado. Com a conversão turbo, use um Mapa turbo.',
  other: 'Esta combinação precisa de ajustes.',
};

/** Friendly sentence for a resolver error, with the original one kept for the "Detalhes técnicos". */
export function friendlyIssue(message: string): { friendly: string; technical: string; code: IssueCode } {
  const i: BuildIssue = classifyError(message);
  return { friendly: ISSUE_FRIENDLY[i.code], technical: message, code: i.code };
}

/** Friendly version of a controller error (purchase, install, remove); unknown ones pass through. */
export function friendlyOpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('créditos insuficientes')) return `Você não tem créditos suficientes. ${message.replace(/^créditos insuficientes:\s*/i, '')}`;
  if (m.includes('ainda não está liberada')) return `${message}. Continue a campanha para liberar.`;
  if (m.startsWith('incompatível')) {
    const first = message.replace(/^incompatível:\s*/i, '').split(';')[0] ?? message;
    return `${ISSUE_FRIENDLY[classifyError(first).code]}`;
  }
  return message;
}

/**
 * Compare-table labels: friendly name first, technical name in the advanced list. Keys are the
 * technical labels the comparison produces.
 */
export const COMPARE_FRIENDLY: Record<string, string> = {
  Potência: 'Potência',
  Torque: 'Força do motor',
  'Capacidade do câmbio': 'Quanta força o câmbio segura',
  Embreagem: 'Quanta força a embreagem segura',
  'Capacidade dos internos': 'Quanta força o motor aguenta por dentro',
  'Constante de enchimento do turbo': 'Tempo de resposta da turbina',
  'Pressão sem atraso por detonação': 'Pressão do turbo sem risco de detonação',
  Massa: 'Peso',
  'Aderência (μ pico)': 'Aderência dos pneus',
  '0–100 km/h (estimativa)': 'Tempo estimado de 0 a 100 km/h',
  '201 m (estimativa)': 'Tempo estimado em 201 m',
  '402 m (estimativa)': 'Tempo estimado em 402 m',
  '1 km (estimativa)': 'Tempo estimado em 1 km',
};

/** Words players use, mapped to the catalogue's words (accent-free, lower case). */
export const SEARCH_ALIASES: Record<string, string> = {
  turbina: 'turbo', turbo: 'turbina', escapamento: 'escape', escape: 'escapamento', ponteira: 'escape',
  roda: 'pneu', pneu: 'roda', nitro: 'n2o', n2o: 'nitro', oxido: 'nitro',
  embreagem: 'clutch', cambio: 'gearbox', marcha: 'cambio', freio: 'arrefecimento', peso: 'alivio',
  central: 'ecu', mapa: 'ecu', remap: 'ecu', oleo: 'oil', radiador: 'cooling', intercooler: 'resfriamento',
};

/** One sentence about where the parts go on this car (technical view note). */
export function layoutNote(carName: string, mount: EngineMount, drive: 'front' | 'rear' | 'awd'): string {
  const pos = mount.position === 'front' ? 'dianteiro' : mount.position === 'mid' ? 'central' : 'traseiro';
  const orient = mount.orientation === 'transverse' ? 'transversal' : 'longitudinal';
  const dr = drive === 'front' ? 'tração dianteira' : drive === 'rear' ? 'tração traseira' : 'tração integral';
  return `${L.technicalNote} ${carName}: motor ${pos} ${orient}, ${dr}.`;
}

export function externalLabel(changes: readonly string[]): string {
  return changes.join(', ');
}

/** What the factory fitted in a slot, from the catalogue car (never mutated). */
export function stockSpec(car: CarConfig, cat: PartCategory): string {
  const e = car.engine;
  switch (cat) {
    case 'intake-filter':
      return 'Filtro de ar de papel na caixa de ar original de fábrica.';
    case 'intake-manifold':
      return 'Coletor de admissão original, com os dutos e o plenum de fábrica.';
    case 'camshaft':
      return `Comando de válvulas original; corte de giro de fábrica em ${e.revLimitRpm} rpm.`;
    case 'exhaust':
      return 'Escapamento original de fábrica, com os abafadores da época.';
    case 'turbo':
      return e.induction === 'turbo' ? 'Turbo original de fábrica.' : 'Motor aspirado, como saiu de fábrica.';
    case 'clutch':
      return `Embreagem original: ${car.transmission.clutch.maxTorqueNm} N·m de capacidade.`;
    case 'differential':
      return `Relação final original: ${car.transmission.finalDrive.toFixed(3).replace('.', ',')}.`;
    case 'tires':
      return `Pneus de rua originais (μ de pico ${car.tires.muPeak.toFixed(2).replace('.', ',')}).`;
    case 'ecu':
      return e.turbo
        ? `ECU original: pressão de fábrica ${e.turbo.maxBoostBar.toFixed(2).replace('.', ',')} bar e o limitador de torque da curva original.`
        : `ECU original: corte em ${e.revLimitRpm} rpm.`;
    case 'intercooler':
      return 'Intercooler original de fábrica (≈ 60 % de eficiência).';
    case 'boost-control':
      return 'Solenoide original de controle da pressão.';
    case 'turbo-wastegate':
      return e.induction === 'turbo'
        ? 'Atuador original: sustenta até 0,35 bar acima do alvo de fábrica.'
        : 'Sem atuador separado na configuração original.';
    case 'cylinder-head':
      return 'Cabeçote original, dutos de fundição.';
    case 'engine-compression':
      return `Taxa de compressão original: ${e.compressionRatio.toFixed(2).replace('.', ',')}:1.`;
    case 'pistons':
      return `Pistões e bielas originais; taxa ${e.compressionRatio.toFixed(1).replace('.', ',')}:1.`;
    case 'flywheel':
      return `Volante original (inércia do motor ${e.inertiaKgM2.toFixed(3).replace('.', ',')} kg·m²).`;
    case 'gearbox':
      return car.transmission.kind === 'dual-clutch'
        ? `Embreagens da dupla embreagem originais: ${car.transmission.clutch.maxTorqueNm} N·m.`
        : `Elementos e conversor originais: ${car.transmission.clutch.maxTorqueNm} N·m.`;
    case 'awd':
      return car.awd ? `Diferencial central original: ${car.awd.centerCouplingNm} N·m de acoplamento.` : 'Sem tração integral.';
    case 'suspension':
      return 'Suspensão original de rua.';
    default:
      return `${CATEGORY_LABEL[cat]} original de fábrica: sem alteração de componentes.`;
  }
}
