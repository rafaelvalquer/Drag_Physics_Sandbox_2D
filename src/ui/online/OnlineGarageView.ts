import { findCampaignCar } from '../../data/cars/campaign';
import { transmissionKindOf } from '../../game/career/tuning/BuildResolverV2';
import { ALL_PARTS, CATEGORY_LABEL, findPart } from '../../game/career/tuning/parts';
import { resolveBuild } from '../../game/career/tuning/BuildResolver';
import { careerResolverVersion } from '../../game/career/tuning/resolverVersion';
import { physicalSlotOf } from '../../game/career/tuning/partProgression';
import { reconcileTune } from '../../game/career/tuning/TuningCapabilities';
import { ONLINE_MARKET } from '../../game/online/catalog';
import type { GarageRequest } from '../../game/online/contracts';
import type { Garage } from '../../game/online/OnlineClient';
import { PREPARATION_TREES } from '../../game/online/preparation';
import { h } from '../dom';
import { specRows } from '../garage/GarageDialog';
import { GarageVehiclePreview } from '../garage/GarageVehiclePreview';
import { workshopPartHeading } from '../workshop/WorkshopPartHeading';

export type OnlineCar = Garage['cars'][number];
type Action = GarageRequest['operation'];
type Operate = (action: Action) => Promise<void>;
const money = (amount: number) => `${amount.toLocaleString('pt-BR')} CR`;
const button = (label: string, onclick: () => void, disabled = false) => h('button', { onclick, disabled }, label);

export function garageCards(garage: Garage, mutate: Operate, project: (car: OnlineCar, section: 'tree' | 'workshop' | 'dyno' | 'history') => void): HTMLElement {
  return h('div', { class: 'online-grid' }, garage.cars.map((car) => {
    const active = garage.profile.active_car_id === car.id;
    const preview = new GarageVehiclePreview('studio');
    preview.resize(260, 112);
    preview.canvas.setAttribute('aria-label', car.config.name);
    const config = car.paint ? { ...car.config, visual: { ...car.config.visual, color: car.paint } } : car.config;
    void preview.setCar(config).catch(() => { preview.canvas.hidden = true; });
    const tree = PREPARATION_TREES.get(car.base_car_id)!;
    const completion = Math.round(100 * (car.unlocks.length - 1) / Math.max(1, tree.nodes.length - 1));
    const paint = h('input', { type: 'color', value: car.paint ?? car.config.visual.color, 'aria-label': `Pintura de ${car.config.name}`,
      onchange: (event) => { void mutate({ kind: 'paint', carId: car.id, paint: (event.target as HTMLInputElement).value }); } });
    return h('article', { class: 'online-card' }, h('header', {}, h('h2', {}, car.config.name), active && h('span', {}, 'Em uso')), preview.canvas,
      h('p', {}, `${Math.round(car.peakPowerCv)} cv · ${Math.round(car.peakTorqueNm)} N·m · ${Math.round(car.config.massKg)} kg`),
      h('dl', { class: 'online-specs' }, specRows(car.config).flatMap(([key, value]) => [h('dt', {}, key), h('dd', {}, value)])),
      h('p', {}, `${car.pp_balance} PP · Árvore ${completion}% · ${car.total_races} corridas · ${car.wins} V / ${car.losses} D`),
      h('p', {}, car.parts.length ? car.parts.map((id) => findPart(id)?.name ?? id).join(', ') : 'Peças originais'),
      h('label', { class: 'row' }, 'Pintura', paint),
      h('div', { class: 'row' }, button('Selecionar', () => { void mutate({ kind: 'select', carId: car.id }); }, active),
        button('Preparação', () => project(car, 'tree')), button('Oficina', () => project(car, 'workshop')),
        button('Dinamômetro', () => project(car, 'dyno')), button('Histórico', () => project(car, 'history')),
        button('Vender', () => {
          if (window.confirm(`Vender ${car.config.name} por ${money(Math.round(car.purchase_price * 0.6))}? A progressão deste projeto será encerrada.`)) {
            void mutate({ kind: 'sell', carId: car.id, confirmed: true });
          }
        }, garage.cars.length < 2)));
  }));
}

export function market(credits: number, mutate: Operate): HTMLElement {
  const list = h('div', { class: 'online-grid' });
  const model = h('input', { type: 'search', placeholder: 'Buscar modelo' });
  const brandOf = (name: string) => name.startsWith('Alfa Romeo ') ? 'Alfa Romeo' : name.split(' ')[0]!;
  const dropdown = (values: readonly (readonly [string, string])[]) =>
    h('select', {}, h('option', { value: '' }, 'Todos'), values.map(([value, label]) => h('option', { value }, label)));
  const brands = [...new Set(ONLINE_MARKET.map((car) => brandOf(car.name)))].sort();
  const brand = dropdown(brands.map((value) => [value, value]));
  const induction = dropdown([['NA', 'Aspirado'], ['turbo', 'Turbo']]);
  const drive = dropdown([['front', 'Dianteira'], ['rear', 'Traseira'], ['awd', 'Integral']]);
  const transmission = dropdown([['manual', 'Manual'], ['dual-clutch', 'Dupla embreagem'], ['torque-converter-auto', 'Automático']]);
  const price = h('input', { type: 'number', min: 0, placeholder: 'Sem limite' });
  const repaint = (): void => {
    const results = ONLINE_MARKET.filter((car) => car.name.toLocaleLowerCase('pt-BR').includes(model.value.toLocaleLowerCase('pt-BR')) &&
      (!brand.value || brandOf(car.name) === brand.value) && (!induction.value || car.induction === induction.value) &&
      (!drive.value || car.drive === drive.value) && (!transmission.value || car.transmission === transmission.value) &&
      (!Number.isFinite(price.valueAsNumber) || car.price <= price.valueAsNumber));
    list.replaceChildren(...results.map((car) => h('article', { class: 'online-card' },
      h('h2', {}, car.name), h('p', {}, money(car.price)), button('Comprar', () => { void mutate({ kind: 'buy', baseCarId: car.id }); }, credits < car.price))));
    if (!results.length) list.append(h('p', {}, 'Nenhum modelo corresponde aos filtros.'));
  };
  [model, brand, induction, drive, transmission, price].forEach((input) => input.addEventListener('input', repaint));
  repaint();
  return h('section', {}, h('div', { class: 'online-filters' }, h('label', {}, 'Modelo', model), h('label', {}, 'Fabricante', brand),
    h('label', {}, 'Aspiração', induction), h('label', {}, 'Tração', drive), h('label', {}, 'Transmissão', transmission), h('label', {}, 'Preço máximo (CR)', price)), list);
}

export function preparationTree(car: OnlineCar, mutate: Operate, focusNode?: string): HTMLElement {
  const tree = PREPARATION_TREES.get(car.base_car_id)!;
  const unlocked = new Set(car.unlocks);
  return h('section', {}, h('h2', {}, car.config.name), h('p', {}, `${car.pp_balance} PP disponíveis · ${car.pp_earned_total} ganhos · ${car.pp_spent_total} utilizados`),
    h('div', { class: 'online-tree' }, tree.branches.map((branch) => h('section', { class: 'online-tree-branch' },
      h('h3', {}, branch.name), tree.nodes.filter((node) => node.branchId === branch.id).map((node) => {
        const have = unlocked.has(node.id);
        const required = node.prerequisites.filter((id) => !unlocked.has(id));
        return h('article', { class: `online-card${focusNode === node.id ? ' online-focused' : ''}`, id: `online-node-${node.id}` },
          h('strong', {}, node.name), h('p', {}, node.unlocksPartIds.map((id) => findPart(id)?.name).join(', ')),
          required.length > 0 && h('p', {}, `Requer ${required.map((id) => tree.nodes.find((item) => item.id === id)?.name).join(', ')}`),
          button(have ? 'Desbloqueado' : `Desbloquear por ${node.costPP} PP`, () => {
            if (window.confirm(`Usar ${node.costPP} PP para desbloquear ${node.name}?`)) void mutate({ kind: 'unlock', carId: car.id, nodeId: node.id });
          }, have || required.length > 0 || car.pp_balance < node.costPP));
      })))));
}

export function workshop(garage: Garage, car: OnlineCar, mutate: Operate, openNode: (id: string) => void): HTMLElement {
  const tree = PREPARATION_TREES.get(car.base_car_id)!;
  const base = findCampaignCar(car.base_car_id)!;
  const unlocked = new Set(car.unlocks);
  const nodeNames = new Map(tree.nodes.map((node) => [node.id, node.name]));
  const nodes = new Map(tree.nodes.flatMap((node) => node.unlocksPartIds.map((id) => [id, node] as const)));
  const installed = new Set(car.parts);
  const occupiedSlots = new Set(car.parts.map((id) => physicalSlotOf(findPart(id)!)));
  const factoryCategories = [...new Set(ALL_PARTS.filter((part) => nodes.has(part.id) && !occupiedSlots.has(physicalSlotOf(part)))
    .map((part) => CATEGORY_LABEL[part.category]))];
  const stock = new Map(garage.inventory.filter((item) => item.base_car_id === car.base_car_id).map((item) => [item.part_id, item.quantity]));
  const parts = h('div', { class: 'online-grid' });
  const filter = h('input', { type: 'search', placeholder: 'Buscar na oficina', 'aria-label': 'Buscar na oficina' });
  const incompatible = h('input', { type: 'checkbox' });
  const redraw = (): void => {
    const wanted = filter.value.toLocaleLowerCase('pt-BR');
    const displayed = ALL_PARTS.filter((part) => (incompatible.checked || nodes.has(part.id) || installed.has(part.id)) &&
      `${part.name} ${CATEGORY_LABEL[part.category]}`.toLocaleLowerCase('pt-BR').includes(wanted));
    parts.replaceChildren(...displayed.map((part) => {
      const node = nodes.get(part.id);
      const isInstalled = installed.has(part.id);
      const quantity = stock.get(part.id) ?? 0;
      const ready = !!node && unlocked.has(node.id);
      const requirements = node?.prerequisites.filter((id) => !unlocked.has(id)).map((id) => nodeNames.get(id)) ?? [];
      let blockers: string[] = [];
      if (ready && !isInstalled) {
        const slot = physicalSlotOf(part);
        const next = [...car.parts.filter((id) => physicalSlotOf(findPart(id)!) !== slot), part.id];
        const version = careerResolverVersion(base.id, next, car.build_version);
        const tune = reconcileTune(base, next, version, car.tune, { tunersUnlocked: true }).tune;
        const candidate = resolveBuild(base, next, tune, version);
        if (!candidate.ok) blockers = candidate.errors;
      }
      const [state, label] = isInstalled ? ['installed', 'Instalada'] as const : !node ? ['locked', 'Incompatível'] as const :
        !ready ? ['locked', 'Bloqueada por preparação'] as const : blockers.length ? ['locked', 'Requisito mecânico pendente'] as const :
        quantity ? ['owned', 'Adquirida'] as const : garage.profile.cr_balance < part.price ? ['unaffordable', 'Créditos insuficientes'] as const :
          ['available', 'Disponível'] as const;
      return h('article', { class: 'online-card' }, workshopPartHeading(h('h3', {}, part.name), state, label), h('p', {}, `${CATEGORY_LABEL[part.category]} · ${money(part.price)}`),
        !ready && node && h('p', {}, `${node.name} · ${node.costPP} PP · ${car.pp_balance} PP disponíveis`),
        requirements.length > 0 && h('p', {}, `Requer ${requirements.join(', ')}`),
        blockers.length > 0 && h('p', {}, blockers.join('. ')),
        quantity > 0 && h('p', {}, `${quantity} em estoque`),
        h('div', { class: 'row' }, isInstalled ? button('Remover', () => { void mutate({ kind: 'remove', carId: car.id, partId: part.id, buildRevision: car.build_revision }); }) :
          ready ? [button('Comprar peça', () => { void mutate({ kind: 'buyPart', carId: car.id, partId: part.id }); }, garage.profile.cr_balance < part.price),
            button('Instalar', () => { void mutate({ kind: 'install', carId: car.id, partId: part.id, buildRevision: car.build_revision }); }, quantity === 0 || blockers.length > 0)] :
            node ? button('Ver preparação', () => openNode(node.id)) : null));
    }));
  };
  filter.addEventListener('input', redraw);
  incompatible.addEventListener('change', redraw);
  redraw();
  return h('section', {}, h('h2', {}, car.config.name), h('p', {}, `Configuração de fábrica · ${transmissionKindOf(base)} · ${car.parts.length} alterações instaladas`),
    factoryCategories.length > 0 && h('article', { class: 'online-card' },
      workshopPartHeading(h('h3', {}, 'Componentes de fábrica'), 'stock', 'Original'), h('p', {}, factoryCategories.join(' · '))),
    h('div', { class: 'online-filters' }, filter, h('label', { class: 'row' }, incompatible, 'Mostrar incompatíveis')), parts);
}
