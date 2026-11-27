import { ISSUE_LABEL } from '../../game/career/tuning/buildIssues';
import type { InstallPlan } from '../../game/career/tuning/ProjectRequirements';
import { CATEGORY_LABEL, type PartDef } from '../../game/career/tuning/parts';
import { drawPartAsset } from '../../game/vehicles/art/parts/PartIllustrations';
import { EXTERNAL_CHANGE_LABEL, resolvePartVisual } from '../../game/vehicles/art/parts/PartVisualResolver';
import { engineSpecOf } from '../../game/vehicles/art/parts/EngineDrawings';
import type { CarConfig } from '../../data/schema';
import { clear, h } from '../dom';
import { CATEGORY_HELP, L, friendlyIssue, stockSpec, TAB_COPY, TECH_LABELS } from './WorkshopCopy';
import { buildComparison, prosAndCons, type ComparisonView } from './WorkshopComparisonPanel';
import type { PartPreview } from './WorkshopPreviewModel';
import type { WorkshopEligibility, WorkshopSnapshot } from './WorkshopAdapter';
import { workshopCategories, workshopCategoryOf } from './WorkshopSlotMapping';

const cr = (v: number): string => `${v.toLocaleString('pt-BR')} CR`;

export interface InspectorActions {
  goToPart(partId: string): void;
  openDyno(): void;
}

export interface InspectorModel {
  preview: PartPreview;
  snapshot: WorkshopSnapshot;
  eligibility?: WorkshopEligibility;
  stockLabel?: string;
  /** Resolved car used for the engine drawing in the illustration. */
  carConfig: CarConfig | null;
}

export interface InspectorView {
  root: HTMLElement;
  update(m: InspectorModel | null): void;
  /** Canvas of the illustration (for the tests and the animation). */
  dispose(): void;
}

export function buildPartInspector(actions: InspectorActions): InspectorView {
  const root = h('aside', { class: 'wv-inspector ws-right', 'data-testid': 'ws-inspector', 'aria-label': L.details });
  const comparison: ComparisonView = buildComparison();
  const render = (m: InspectorModel | null): void => {
    comparison.cancel();
    clear(root);
    root.append(h('div', { class: 'wv-kicker' }, L.details));
    if (!m) {
      root.append(h('div', { class: 'hint wv-hint', 'data-testid': 'ws-detail-empty' }, L.detailsEmpty));
      return;
    }
    root.append(m.preview.kind === 'stock' ? stockDetail(m, comparison) : partDetail(m, actions, comparison));
  };
  return { root, update: render, dispose: () => comparison.dispose() };
}

function illustration(asset: ReturnType<typeof resolvePartVisual>['asset'], car: CarConfig | null, size = 150): HTMLElement {
  const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
  const cv = h('canvas', { class: 'wv-illus-canvas', width: Math.round(size * 1.6 * dpr), height: Math.round(size * dpr), 'data-testid': 'ws-illustration', 'aria-hidden': 'true' }) as HTMLCanvasElement;
  cv.style.width = `${size * 1.6}px`;
  cv.style.height = `${size}px`;
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    drawPartAsset(ctx, asset, size * 0.8, size / 2, size * 0.92, { engine: car ? engineSpecOf(car) : undefined });
  }
  return h('div', { class: 'wv-illus' }, cv, h('small', {}, L.illustrative));
}

function tabLabelOf(category: PartPreview['category']): string {
  const t = workshopCategories.find((x) => x.id === workshopCategoryOf(category));
  return t ? TAB_COPY[t.id]?.label ?? t.label : '';
}

/** Detail of the factory part of a slot: what the car had from the factory, and the way back. */
function stockDetail(m: InspectorModel, cmp: ComparisonView): HTMLElement {
  const p = m.preview;
  const inSlot = !p.installed;
  cmp.render(p.before, p.after, 'Original');
  return h('div', { class: 'ws-detail wv-detail', 'data-testid': 'ws-detail', 'data-state': p.state },
    h('div', { class: 'wv-cat' }, tabLabelOf(p.category)),
    h('h3', {}, m.stockLabel ?? `${CATEGORY_LABEL[p.category]} original`),
    h('div', { class: 'price' }, 'Grátis'),
    h('p', { class: 'wv-lead' }, stockSpec(m.snapshot.baseCar, p.category)),
    h('p', { class: 'wv-sub' }, 'Nenhuma modificação neste item. As peças retiradas ficam no estoque deste carro.'),
    h('details', { class: 'wv-tech' }, h('summary', {}, L.technical),
      h('p', { class: 'physics' }, h('b', {}, `${TECH_LABELS.physics}: `), 'o resolvedor devolve exatamente a física de fábrica deste item.')),
    inSlot ? cmp.root : '',
    !inSlot ? h('div', { class: 'hint', 'data-testid': 'ws-stock-in-use' }, 'Configuração original em uso neste item.') : '',
  );
}

function partDetail(m: InspectorModel, a: InspectorActions, cmp: ComparisonView): HTMLElement {
  const { preview: p, eligibility } = m;
  const part = p.part!;
  const visual = resolvePartVisual(part as unknown as { category: PartDef['category'] } & Record<string, unknown>);
  // with a substitute plan the red "incompatible" line is replaced by the explanation in the checklist
  const hideIncompatible = !!p.plan?.substitutes && !p.after.ok;
  if (!hideIncompatible) cmp.render(p.before, p.after, p.installed ? 'Sem a peça' : p.state === 'preview-pending' ? 'Com a peça e o que falta' : L.versionWith, { removing: p.installed });
  const reqs = eligibility?.requirements ?? [];
  const unlock = eligibility?.unlock;
  const pc = p.before.ok && p.after.ok ? prosAndCons(p.before, p.after) : { pros: [] as string[], cons: [] as string[] };
  const plan = p.plan;
  const worksText =
    p.state === 'equipped' ? (p.after.ok ? 'Instalada e removível.' : 'Instalada. Outras peças dependem dela.')
    : p.state === 'preview' ? L.worksYes
    : p.state === 'preview-pending' ? 'Funciona, mas precisa de outras peças (veja “O que falta”).'
    : L.needsAdjust + '.';
  const issues = !p.after.ok ? p.after.errors.map(friendlyIssue) : [];
  return h('div', { class: 'ws-detail wv-detail', 'data-testid': 'ws-detail', 'data-state': p.state, 'data-part': part.id },
    h('div', { class: 'wv-cat' }, tabLabelOf(p.category), ' · ', CATEGORY_LABEL[p.category]),
    h('h3', {}, part.name),
    h('div', { class: 'price' }, cr(part.price)),
    illustration(visual.asset, m.carConfig),
    h('section', { class: 'wv-sec' }, h('h4', {}, L.whatItDoes), h('p', { class: 'wv-lead' }, CATEGORY_HELP[p.category]), h('p', { class: 'wv-sub' }, part.description)),
    pc.pros.length || pc.cons.length || p.external.length
      ? h('section', { class: 'wv-sec' }, h('h4', {}, L.whatChanges),
          h('ul', { class: 'wv-pros' }, pc.pros.map((t) => h('li', {}, t))),
          h('ul', { class: 'wv-cons' }, pc.cons.map((t) => h('li', {}, t))),
          p.external.length ? h('p', { class: 'wv-external', 'data-testid': 'ws-external' }, `${L.externalChanges} ${p.external.map((e) => EXTERNAL_CHANGE_LABEL[e]).join(', ')}.`) : '')
      : h('section', { class: 'wv-sec' }, h('h4', {}, L.whatChanges), h('p', { class: 'wv-sub' }, p.state === 'equipped' ? 'Esta peça já está instalada.' : 'Veja os números no quadro abaixo.')),
    h('section', { class: 'wv-sec' }, h('h4', {}, L.beforeAfter), hideIncompatible ? '' : cmp.root),
    h('section', { class: 'wv-sec' }, h('h4', {}, L.whatYouNeed),
      h('div', { class: 'hint', 'data-testid': 'ws-requirements' }, `Requisitos: ${reqs.join(' · ')}`),
      unlock ? h('p', { class: 'hint' }, `${unlock.name} · ${unlock.cost} PP · ${unlock.available} PP disponíveis`) : '',
      unlock && unlock.available < unlock.cost ? h('p', { class: 'hint' }, `Faltam ${unlock.cost - unlock.available} PP`) : '',
      m.snapshot.credits < part.price && !p.owned && !p.installed ? h('p', { class: 'hint' }, 'Créditos insuficientes.') : '',
      h('div', { class: 'hint', 'data-testid': 'ws-compat' }, `${L.works} ${worksText}`)),
    plan && (plan.steps.length > 1 || plan.openIssues.length || plan.substitutes) ? requirementsPanel(plan, a) : '',
    issues.length && p.state === 'unavailable' && !plan?.substitutes
      ? h('section', { class: 'wv-sec wv-issues', 'data-testid': 'ws-issues' }, h('h4', {}, L.needsAdjust), h('ul', {}, issues.map((i) => h('li', {}, i.friendly))))
      : '',
    part.category === 'nitrous'
      ? h('div', { class: 'wv-nitro', 'data-testid': 'nitro-dyno-hint' },
          h('span', {}, L.nitroKit),
          p.installed ? h('button', { class: 'primary wv-btn', 'data-testid': 'nitro-open-dyno', onclick: () => a.openDyno() }, L.openDyno) : '')
      : '',
    part.category === 'gearbox' ? h('p', { class: 'hint', 'data-testid': 'ws-gearbox-note' }, L.gearboxUpgradeNote) : '',
    h('details', { class: 'wv-tech', 'data-testid': 'ws-tech' }, h('summary', {}, L.technical),
      h('dl', {},
        h('dt', {}, TECH_LABELS.physics), h('dd', { class: 'physics' }, part.physics),
        h('dt', {}, TECH_LABELS.description), h('dd', {}, part.description),
        h('dt', {}, TECH_LABELS.chapter), h('dd', {}, String(part.chapter ?? 1)),
        h('dt', {}, 'Código da peça'), h('dd', {}, part.id)),
      !p.after.ok ? h('p', { class: 'wv-raw' }, p.after.errors.join('; ')) : ''),
  );
}

/**
 * "What is missing" checklist: every part the build needs besides the selected one, with where it
 * comes from (stock / price / locked), a shortcut to it and "install with requirements" (one atomic
 * purchase). Settings the player must change (pressure, knock) are listed as open issues.
 */
function requirementsPanel(plan: InstallPlan, a: InspectorActions): HTMLElement {
  // with a substitute the first step is the part that works on this car, so it is listed too
  const extra = plan.substitutes ? plan.steps : plan.steps.slice(1);
  const rows = extra.map((st, i) => {
    const why = plan.substitutes && i === 0 ? 'Alternativa para o motor turbo' : st.resolves ? ISSUE_LABEL[st.resolves.code] : 'Requisito';
    const where = st.source === 'stock' ? 'no seu estoque (grátis)' : st.state === 'locked' ? st.status.detail : cr(st.price);
    return h('div', { class: 'ws-req-row', 'data-testid': `ws-req-${st.partId}`, 'data-state': st.state, 'data-source': st.source },
      h('span', { class: 'ws-req-mark', 'aria-hidden': 'true' }, st.source === 'stock' ? '✓' : '✗'),
      h('span', { class: 'ws-req-text' }, h('b', {}, st.name), ` — ${why} · ${where}`),
      h('button', { class: 'ws-req-go', 'data-testid': `ws-req-go-${st.partId}`, onclick: () => a.goToPart(st.partId) }, 'Ver peça'));
  });
  const open = plan.openIssues.map((i) => h('div', { class: 'ws-req-row open', 'data-testid': 'ws-req-open' }, h('span', { class: 'ws-req-mark', 'aria-hidden': 'true' }, '!'), h('span', { class: 'ws-req-text' }, friendlyIssue(i.message).friendly)));
  return h('section', { class: 'ws-req wv-sec', 'data-testid': 'ws-req-list' },
    h('h4', { class: 'ws-req-title' }, plan.substitutes ? 'Este remap é para motor aspirado' : L.whatIsMissing),
    plan.substitutes ? h('div', { class: 'hint', 'data-testid': 'ws-req-substitute' }, `${plan.substitutes.reason} Para o seu motor turbo, a lista abaixo troca o remap aspirado pelo Mapa turbo equivalente e traz o que ele pede.`) : '',
    ...rows, ...open,
    plan.blockers.length ? h('div', { class: 'ws-req-blockers', 'data-testid': 'ws-req-blockers' }, plan.blockers.join(' ')) : '');
}
