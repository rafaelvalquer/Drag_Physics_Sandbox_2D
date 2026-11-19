import type { PartCategory } from './parts';

/**
 * What stands in the way of a build, as data. The resolvers (BuildResolver / BuildResolverV2) report
 * pt-BR sentences; this turns each sentence into a code plus the part categories that can fix it, so
 * the Workshop can list the missing pieces and install them together (ProjectRequirements).
 * A test keeps every message the resolvers can emit classified (tests/unit/career/build-issues.test.ts).
 */
export type IssueCode =
  | 'needs-turbo-kit'
  | 'fuel-limit'
  | 'internals-limit'
  | 'clutch-limit'
  | 'gearbox-limit'
  | 'compression-limit'
  | 'needs-ecu'
  | 'needs-part'
  | 'knock'
  | 'range'
  | 'other';

export interface BuildIssue {
  code: IssueCode;
  /** The resolver's sentence (pt-BR). */
  message: string;
  /** Categories whose parts can resolve it (tried cheapest first). Empty = the player must change a setting. */
  fixCategories: readonly PartCategory[];
}

/** Short label of each code (checklist row title). */
export const ISSUE_LABEL: Record<IssueCode, string> = {
  'needs-turbo-kit': 'Kit turbo instalado',
  'fuel-limit': 'Alimentação de combustível',
  'internals-limit': 'Internos reforçados',
  'clutch-limit': 'Embreagem para o torque',
  'gearbox-limit': 'Câmbio para o torque',
  'compression-limit': 'Taxa de compressão compatível',
  'needs-ecu': 'ECU compatível',
  'needs-part': 'Peça de apoio',
  knock: 'Pressão sem detonação',
  range: 'Pressão dentro da faixa',
  other: 'Requisito do build',
};

const RULES: { re: RegExp; code: IssueCode; fix: readonly PartCategory[] }[] = [
  { re: /exigem um kit turbo|exige kit turbo|sem turbo instalado/, code: 'needs-turbo-kit', fix: ['turbo'] },
  { re: /alimentação de combustível|pressão superior a 0,95/, code: 'fuel-limit', fix: ['electronics-fuel'] },
  { re: /limite mecânico dos internos|pistões e bielas de fábrica/, code: 'internals-limit', fix: ['engine-internals', 'pistons'] },
  { re: /upgrade DSG|upgrade do automático|elementos do câmbio|embreagens do câmbio/, code: 'gearbox-limit', fix: ['gearbox'] },
  { re: /embreagem segura/, code: 'clutch-limit', fix: ['clutch', 'gearbox'] },
  { re: /taxa .*(kit turbo|detona)/, code: 'compression-limit', fix: ['engine-compression'] },
  { re: /exige ECU programável|turbina de maior fluxo exige ECU/, code: 'needs-ecu', fix: ['ecu'] },
  { re: /wastegate não segura/, code: 'needs-part', fix: ['boost-control'] },
  { re: /^.+ exige .+/, code: 'needs-part', fix: [] }, // ECU `requiresParts`: the ids come from the ECU part
  { re: /detonação/, code: 'knock', fix: [] },
  { re: /pressão fora da faixa/, code: 'range', fix: [] },
];

export function classifyError(message: string): BuildIssue {
  for (const r of RULES) if (r.re.test(message)) return { code: r.code, message, fixCategories: r.fix };
  return { code: 'other', message, fixCategories: [] };
}

export const issuesOf = (errors: readonly string[]): BuildIssue[] => errors.map(classifyError);
